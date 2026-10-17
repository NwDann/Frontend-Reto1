import { useRef, useState } from "react";
import {
  Route,
  Download,
  LoaderCircle,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import type { Snapshot, Preferences, Modal } from "../lib/models";
import type { PlanningInputs, PlanResult } from "../lib/planning";
import { calculatePlan } from "../lib/planning";
import { validCoords, money, number, saveText } from "../lib/format";
import { roadMatrix, roadLine } from "../services/roads";
import { SectionTitle, CardTitle, Badge, Empty } from "./ui";
import LiveMap, { CoordinateFields, googleRoute } from "./LiveMap";
const defaults: PlanningInputs = {
  priority: "cost",
  roundTrip: true,
  ownEnabled: true,
  externalEnabled: true,
  externalMode: "km",
  externalRate: 0,
  externalExtras: 0,
  externalTollsIncluded: false,
  fuelPrice: 0,
  kmPerGallon: 1,
  driverHourly: 0,
  fixedPerTrip: 0,
  maintenanceKm: 0,
  tolls: 0,
  unloadingMinutes: 15,
  breakMinutes: 0,
  fallbackSpeed: 25,
  roadFactor: 1.3,
  materials: 0,
  labor: 0,
  otherService: 0,
  margin: 20,
  availableMinutes: 480,
};
export default function Planner({
  s,
  prefs,
  setPrefs,
  open,
}: {
  s: Snapshot;
  prefs: Preferences;
  setPrefs: (p: Preferences) => void;
  open: (m: Modal) => void;
}) {
  const [tab, setTab] = useState<"compare" | "saved">("compare"),
    [selected, setSelected] = useState<number[]>([]),
    [dispatchIds, setDispatchIds] = useState<number[]>([]),
    [routeId, setRouteId] = useState(""),
    [inputs, setInputs] = useState({ ...defaults, margin: prefs.targetMargin }),
    [result, setResult] = useState<PlanResult | null>(null),
    [line, setLine] = useState<[number, number][]>([]),
    [error, setError] = useState(""),
    [roadNote, setRoadNote] = useState(""),
    [busy, setBusy] = useState(false),
    [scenarioId, setScenarioId] = useState(""),
    [signature, setSignature] = useState(""),
    [useRoads, setUseRoads] = useState(false);
  const roadSeq = useRef(0);
  const points = s.points || [],
    route = s.routes?.find((r) => r.id === Number(routeId)),
    origin = prefs.origin,
    chosen =
      result?.scenarios.find((x) => x.id === scenarioId) ||
      result?.scenarios[0];
  const fingerprint = JSON.stringify({
    selected,
    dispatchIds,
    routeId,
    useRoads,
    inputs,
    origin,
    points: s.points,
    items: s.items,
    routes: s.routes,
    dispatches: s.dispatches,
    staff: s.staff,
  });
  const stale = !!result && fingerprint !== signature;
  const pending =
    s.dispatches?.filter(
      (d) => !d.fecha_entrega_real && selected.includes(d.punto_servicio_id),
    ) || [];
  const set = (key: keyof PlanningInputs, value: any) => {
    setInputs((p) => ({ ...p, [key]: value }));
    roadSeq.current++;
    setLine([]);
  };
  const input = (
    key: keyof PlanningInputs,
    label: string,
    hint?: string,
    min = 0,
  ) => (
    <label className="form-field" key={key}>
      {label}
      <input
        type="number"
        min={min}
        step="any"
        value={inputs[key] as number}
        onChange={(e) => set(key, Number(e.target.value))}
        required
      />
      {hint && <small>{hint}</small>}
    </label>
  );
  const compute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin)
      return setError("Selecciona el origen sobre el mapa o en Configuración.");
    setBusy(true);
    setError("");
    setResult(null);
    setLine([]);
    try {
      if (!selected.length || selected.length > 7)
        throw Error("Selecciona entre uno y siete destinos.");
      const ps = selected.map((id) => points.find((p) => p.id === id)!);
      if (ps.some((p) => !p || !validCoords(p.latitud, p.longitud)))
        throw Error("Revisa las coordenadas de los destinos.");
      let matrix;
      if (useRoads)
        try {
          matrix = await roadMatrix([
            origin,
            ...ps.map((p) => ({ lat: p.latitud!, lng: p.longitud! })),
          ]);
          setRoadNote("Matriz vial OSRM, sin información de tráfico en vivo.");
        } catch {
          setRoadNote(
            "Servicio vial no disponible. Se usará aproximación geográfica, identificada en el resultado.",
          );
        }
      else
        setRoadNote(
          "Aproximación geográfica local. Activa OSRM para consultar distancias y tiempos por calles.",
        );
      const data = calculatePlan(
        s,
        origin,
        selected,
        dispatchIds,
        inputs,
        matrix,
        routeId ? Number(routeId) : undefined,
      );
      setResult(data);
      setScenarioId(data.scenarios[0]?.id || "");
      setSignature(fingerprint);
      await draw(data, data.scenarios[0].order);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const draw = async (data: PlanResult, order: number[]) => {
    if (!useRoads) {
      setLine([]);
      return;
    }
    const requestId = ++roadSeq.current;
    const coords = [
      data.origin,
      ...order.map((id) => {
        const p = points.find((p) => p.id === id)!;
        return { lat: p.latitud!, lng: p.longitud! };
      }),
      ...(inputs.roundTrip ? [data.origin] : []),
    ];
    try {
      const geometry = await roadLine(coords);
      if (requestId === roadSeq.current) setLine(geometry);
    } catch {
      if (requestId !== roadSeq.current) return;
      setLine([]);
      setRoadNote(
        (note) =>
          note +
          " No se pudo dibujar el recorrido; se muestran solo los puntos.",
      );
    }
  };
  const displayedIds = result && !stale && chosen ? chosen.order : selected;
  const markers = displayedIds
    .map((id) => points.find((p) => p.id === id))
    .filter((p) => p && validCoords(p.latitud, p.longitud))
    .map((p) => ({
      id: p!.id,
      name: p!.nombre_cliente,
      lat: p!.latitud!,
      lng: p!.longitud!,
    }));
  return (
    <>
      <SectionTitle
        eyebrow="OPTIMIZACIÓN Y EJECUCIÓN"
        title="Compara rutas con datos de tu operación."
        text="Destinos, despachos y carga registrados. Costos y condiciones de viaje declarados para esta comparación."
      >
        <button
          className="btn primary"
          onClick={() => open({ kind: "edit", resource: "rutas" })}
        >
          <Plus size={15} />
          Registrar ruta
        </button>
      </SectionTitle>
      <div className="tabs">
        <button
          className={tab === "compare" ? "active" : ""}
          onClick={() => setTab("compare")}
        >
          Comparar escenarios
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          Rutas registradas ({s.routes?.length ?? "—"})
        </button>
      </div>
      {tab === "saved" ? (
        <section className="card padded">
          <CardTitle
            title="Operaciones de ruta guardadas"
            sub="Estado, carga y valor de mercadería de cada vehículo."
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RUTA / VEHÍCULO</th>
                  <th>CONDUCTOR</th>
                  <th>CARGA</th>
                  <th>MERCADERÍA USD</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {s.routes?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        #{r.id} · {r.codigo_vehiculo}
                      </strong>
                      <small>
                        {r.es_multiparada ? "Multiparada" : "Una parada"}
                      </small>
                    </td>
                    <td>
                      {s.staff?.find((p) => p.id === r.conductor_id)?.nombre ||
                        "Sin asignar"}
                    </td>
                    <td>
                      {number(r.peso_actual_carga)} /{" "}
                      {number(r.capacidad_peso_max_kg)} kg
                    </td>
                    <td>{money(r.valor_mercaderia_total)}</td>
                    <td>
                      <Badge
                        tone={r.estado === "Completada" ? "green" : "blue"}
                      >
                        {r.estado}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() =>
                            open({ kind: "route-detail", id: r.id })
                          }
                        >
                          Ver detalle
                        </button>
                        <button
                          className="text-button"
                          onClick={() => open({ kind: "status", route: r })}
                        >
                          Cambiar estado
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            open({ kind: "edit", resource: "rutas", record: r })
                          }
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.routes?.length === 0 && (
              <Empty title="Aún no hay rutas registradas" />
            )}
          </div>
        </section>
      ) : (
        <form onSubmit={compute}>
          <div className="live-planning-layout">
            <section className="card padded">
              <CardTitle
                title="1. Origen y destinos"
                sub="El origen de la bodega se define en Configuración (no hay un catálogo de bodegas)."
              />
              <label className="form-field">
                Nombre del punto de partida
                <input
                  value={origin?.name || ""}
                  placeholder="Bodega central u otro punto"
                  onChange={(e) =>
                    origin &&
                    setPrefs({
                      ...prefs,
                      origin: { ...origin, name: e.target.value },
                    })
                  }
                />
              </label>
              <CoordinateFields
                name="Origen"
                value={origin}
                onChange={(p) =>
                  setPrefs({
                    ...prefs,
                    origin: {
                      ...p,
                      name: origin?.name || "Origen seleccionado",
                    },
                  })
                }
              />
              <LiveMap
                points={markers}
                origin={origin}
                provider={prefs.mapProvider}
                onPick={(p) =>
                  setPrefs({
                    ...prefs,
                    origin: {
                      ...p,
                      name: origin?.name || "Origen seleccionado",
                    },
                  })
                }
                line={stale ? [] : line}
                large
              />
              <p className="hint">
                Haz clic sobre el mapa para elegir o mover el punto de partida.
                Las coordenadas de destino proceden de /api/puntos-servicio.
              </p>
              <div className="live-destinations">
                {points.map((p) => (
                  <label className="checkbox-label" key={p.id}>
                    <input
                      type="checkbox"
                      disabled={!validCoords(p.latitud, p.longitud)}
                      checked={selected.includes(p.id)}
                      onChange={(e) => {
                        setSelected((xs) =>
                          e.target.checked
                            ? [...xs, p.id]
                            : xs.filter((id) => id !== p.id),
                        );
                        setDispatchIds((xs) =>
                          xs.filter(
                            (id) =>
                              s.dispatches?.find((d) => d.id === id)
                                ?.punto_servicio_id !== p.id,
                          ),
                        );
                      }}
                    />
                    <span>
                      <strong>{p.nombre_cliente}</strong>
                      <small>
                        {p.zona_reparto || "Sin zona"} ·{" "}
                        {p.contrato_validado
                          ? "contrato validado"
                          : "contrato por validar"}
                        {!validCoords(p.latitud, p.longitud)
                          ? " · Faltan coordenadas"
                          : ""}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useRoads}
                  onChange={(e) => {
                    setUseRoads(e.target.checked);
                    roadSeq.current++;
                    setLine([]);
                  }}
                />
                <span>
                  Consultar distancias y recorridos viales con OSRM
                  <small>
                    Al comparar se enviarán a ese servicio externo las
                    coordenadas del origen y los destinos seleccionados.
                  </small>
                </span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={inputs.roundTrip}
                  onChange={(e) => set("roundTrip", e.target.checked)}
                />
                Regresar al mismo punto de partida
              </label>
              <CardTitle
                title="2. Carga que se transportará"
                sub="Selecciona despachos pendientes; el cálculo no vuelve a descontar stock."
              />
              {pending.map((d) => (
                <label key={d.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={dispatchIds.includes(d.id)}
                    onChange={(e) =>
                      setDispatchIds((xs) =>
                        e.target.checked
                          ? [...xs, d.id]
                          : xs.filter((id) => id !== d.id),
                      )
                    }
                  />
                  <span>
                    Despacho #{d.id} ·{" "}
                    {
                      points.find((p) => p.id === d.punto_servicio_id)
                        ?.nombre_cliente
                    }
                    <small>
                      Ruta {d.ruta_id ? `#${d.ruta_id}` : "sin asignar"} ·{" "}
                      {d.detalles?.length || 0} insumos
                    </small>
                  </span>
                </label>
              ))}
              {!pending.length && (
                <p className="hint">
                  No hay despachos pendientes para los destinos seleccionados.
                  Puedes comparar solo el transporte; se identificará que falta
                  la carga.
                </p>
              )}
            </section>
            <section className="card padded">
              <CardTitle
                title="3. Parámetros de comparación"
                sub="Estos importes son supuestos del usuario; no son costos históricos registrados."
              />
              <label className="form-field">
                Ruta / vehículo de referencia
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                >
                  <option value="">
                    Sin ruta: capacidad y responsable sin verificar
                  </option>
                  {s.routes
                    ?.filter((r) => r.estado !== "Completada")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.id} · {r.codigo_vehiculo} ·{" "}
                        {r.capacidad_peso_max_kg} kg
                      </option>
                    ))}
                </select>
              </label>
              {route && (
                <div className="live-note">
                  Capacidad registrada: {route.capacidad_peso_max_kg} kg /{" "}
                  {route.capacidad_volumen_max_m3} m³. Conductor:{" "}
                  {s.staff?.find((p) => p.id === route.conductor_id)?.nombre ||
                    "Sin asignar"}
                  . El sistema no proporciona mantenimiento, pólizas o costos
                  del vehículo.
                </div>
              )}
              <label className="form-field">
                Criterio de elección
                <select
                  value={inputs.priority}
                  onChange={(e) => set("priority", e.target.value)}
                >
                  <option value="cost">Menor costo de transporte</option>
                  <option value="time">Menor tiempo total</option>
                  <option value="balanced">
                    Equilibrado: 60% costo / 40% tiempo
                  </option>
                </select>
              </label>
              <div className="form-grid">
                {input(
                  "availableMinutes",
                  "Tiempo disponible (min)",
                  "Desde la salida hasta la hora límite, incluido retorno si se activa.",
                  1,
                )}
                {input(
                  "unloadingMinutes",
                  "Descarga y verificación por destino (min)",
                )}
                {input("breakMinutes", "Pausas previstas (min)")}
                {input(
                  "tolls",
                  "Peajes cotizados para todo el recorrido (USD)",
                  "Confirma peajes y tarifas de esta ruta; no se calculan automáticamente.",
                )}
              </div>
              <details open>
                <summary>Transporte propio</summary>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={inputs.ownEnabled}
                    onChange={(e) => set("ownEnabled", e.target.checked)}
                  />
                  Incluir en la comparación
                </label>
                <div className="form-grid">
                  {input("fuelPrice", "Combustible (USD/galón)")}
                  {input(
                    "kmPerGallon",
                    "Rendimiento (km/galón)",
                    undefined,
                    0.01,
                  )}
                  {input("driverHourly", "Conductor (USD/hora total)")}
                  {input("fixedPerTrip", "Costo fijo asignado al viaje (USD)")}
                  {input(
                    "maintenanceKm",
                    "Reserva de mantenimiento (USD/km)",
                    "Presupuesto de desgaste, separado de gastos ya pagados.",
                  )}
                </div>
              </details>
              <details open>
                <summary>Transporte externo</summary>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={inputs.externalEnabled}
                    onChange={(e) => set("externalEnabled", e.target.checked)}
                  />
                  Incluir cotización externa
                </label>
                <label className="form-field">
                  Tipo de tarifa
                  <select
                    value={inputs.externalMode}
                    onChange={(e) => set("externalMode", e.target.value)}
                  >
                    <option value="km">USD por kilómetro</option>
                    <option value="fixed">USD por viaje completo</option>
                  </select>
                </label>
                {input(
                  "externalRate",
                  inputs.externalMode === "km"
                    ? "Tarifa externa (USD/km)"
                    : "Tarifa fija (USD/viaje)",
                )}
                {input("externalExtras", "Recargos externos (USD)")}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={inputs.externalTollsIncluded}
                    onChange={(e) =>
                      set("externalTollsIncluded", e.target.checked)
                    }
                  />
                  La tarifa ya incluye los peajes cotizados
                </label>
              </details>
              <details>
                <summary>Cotización del servicio de limpieza</summary>
                <p className="hint">
                  Se suman automáticamente los insumos de los despachos
                  seleccionados a su precio registrado. Los importes siguientes
                  se añaden a ese costo.
                </p>
                {input(
                  "materials",
                  "Otros insumos no incluidos en despachos (USD)",
                )}
                {input("labor", "Mano de obra de limpieza (USD)")}
                {input("otherService", "Otros costos directos (USD)")}
                {input("margin", "Margen objetivo sobre ventas (%)")}
              </details>
              <details>
                <summary>Aproximación cuando no responde la red vial</summary>
                {input(
                  "fallbackSpeed",
                  "Velocidad de referencia (km/h)",
                  "Solo se usa si OSRM no responde; la velocidad del resultado es un output.",
                  1,
                )}
                {input(
                  "roadFactor",
                  "Factor de distancia geográfica",
                  "Supuesto sin red vial; no representa una ruta real.",
                  1,
                )}
              </details>
              <div className="live-note warning">
                Los importes empiezan en cero para no inventar tarifas. Completa
                los costos de las modalidades que vas a comparar. El riesgo del
                proveedor, los seguros y el estado mecánico no están disponibles
                en este sistema.
              </div>
              <button
                className="btn primary"
                disabled={busy || !selected.length || !origin}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Route size={16} />
                )}
                Comparar escenarios
              </button>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </div>
          {result && (
            <section className="card padded">
              <CardTitle title="Resultado de la comparación" sub={roadNote} />
              {stale && (
                <p className="live-note warning">
                  Cambiaste los datos de entrada. Vuelve a calcular antes de
                  usar este resultado.
                </p>
              )}
              <div className="live-scenario-grid">
                {result.scenarios.map((c, i) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`live-scenario ${chosen?.id === c.id ? "selected" : ""}`}
                    onClick={() => {
                      setScenarioId(c.id);
                      if (!stale) draw(result, c.order);
                    }}
                  >
                    <Badge tone={c.feasible && c.onTime ? "green" : "sand"}>
                      {!c.feasible
                        ? "Revisar validaciones"
                        : !c.onTime
                          ? "Fuera de plazo"
                          : i === 0
                            ? "Mejor con estos supuestos"
                            : "Alternativa"}
                    </Badge>
                    <h3>{c.mode}</h3>
                    <strong className="scenario-price">
                      {money(c.transportCost)}
                    </strong>
                    <p>
                      {number(c.distanceKm)} km · {number(c.totalMinutes, 0)}{" "}
                      min
                    </p>
                    <p>{number(c.speed)} km/h de conducción</p>
                  </button>
                ))}
              </div>
              <p>
                Carga calculada:{" "}
                <strong>
                  {number(result.loadKg)} kg · {number(result.loadM3, 3)} m³
                </strong>{" "}
                · Insumos: {money(result.merchandiseValue)}.
              </p>
              {chosen && (
                <>
                  <div className="two-col">
                    <div>
                      <h3>Orden propuesto</h3>
                      <ol>
                        <li>{origin?.name}</li>
                        {chosen.order.map((id) => (
                          <li key={id}>
                            {points.find((p) => p.id === id)?.nombre_cliente}
                          </li>
                        ))}
                        {inputs.roundTrip && <li>Regreso al origen</li>}
                      </ol>
                    </div>
                    <div>
                      <h3>Desglose de transporte</h3>
                      {chosen.components.map((c) => (
                        <div className="list-row" key={c.label}>
                          <span>{c.label}</span>
                          <strong>{money(c.value)}</strong>
                        </div>
                      ))}
                      <div className="list-row">
                        <span>Costo directo total del servicio</span>
                        <strong>{money(chosen.serviceCost)}</strong>
                      </div>
                      <div className="list-row">
                        <span>Precio sugerido sin impuestos</span>
                        <strong>{money(chosen.suggestedPrice)}</strong>
                      </div>
                    </div>
                  </div>
                  {chosen.warnings.map((w) => (
                    <p key={w} className="live-note warning">
                      {w}
                    </p>
                  ))}
                  <div className="row-actions">
                    <a
                      className="btn secondary"
                      href={googleRoute(
                        result.origin,
                        chosen.order.map((id) => {
                          const p = points.find((p) => p.id === id)!;
                          return { lat: p.latitud!, lng: p.longitud! };
                        }),
                        inputs.roundTrip,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir recorrido en Google Maps <ArrowUpRight size={15} />
                    </a>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={stale}
                      onClick={() =>
                        saveText(
                          "analisis-ruta.json",
                          JSON.stringify(
                            {
                              ...result,
                              sistemaRouteId: routeId || null,
                              points: chosen.order.map((id) =>
                                points.find((p) => p.id === id),
                              ),
                              source:
                                "Comparación calculada en esta sesión. No se guarda como plan definitivo.",
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download size={15} />
                      Descargar análisis completo
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={stale}
                      onClick={async () => {
                        const { exportTables } =
                          await import("../services/reports");
                        await exportTables(
                          [
                            {
                              title: "Comparación de rutas",
                              columns: [
                                "Modalidad",
                                "Kilómetros",
                                "Minutos",
                                "Costo transporte USD",
                                "Precio sugerido USD",
                                "Validaciones",
                                "En plazo",
                              ],
                              rows: result.scenarios.map((c) => [
                                c.mode,
                                c.distanceKm,
                                c.totalMinutes,
                                c.transportCost,
                                c.suggestedPrice,
                                c.feasible,
                                c.onTime,
                              ]),
                            },
                            {
                              title: "Supuestos y costos",
                              columns: ["Tipo", "Dato", "Valor"],
                              rows: [
                                ...Object.entries(inputs).map(([k, v]) => [
                                  "Supuesto",
                                  k,
                                  String(v),
                                ]),
                                ...chosen.components.map((c) => [
                                  "Costo USD",
                                  c.label,
                                  c.value,
                                ]),
                              ],
                            },
                          ],
                          "pdf",
                          "comparacion-rutas",
                        );
                      }}
                    >
                      Descargar PDF
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </form>
      )}
    </>
  );
}
