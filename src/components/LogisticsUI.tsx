"use client";
import React, { useState } from "react";
import {
  Truck,
  MapPin,
  Clock3,
  Sparkles,
  ArrowUpRight,
  LoaderCircle,
  ShieldCheck,
  Download,
  Route as RouteIcon,
} from "lucide-react";
import { State, money, dateAfter } from "@/lib/model";
import {
  defaultPlan,
  LogisticsScenario,
  warehouseFor,
  originFor,
} from "@/lib/logistics";
import {
  OperationalPlan,
  clientFor,
  vehicleChecks,
  vehicleTrips,
  deriveOperationalInputs,
} from "@/lib/enterprise";
import { RISK_OPTIONS } from "@/lib/route-options";
import { roadMatrix } from "@/lib/maps-client";
import {
  Action,
  Open,
  Requester,
  SectionTitle,
  CardTitle,
  Badge,
  Empty,
  dateLabel,
  download,
  toCSV,
} from "./ui";
import GeoMap, { googleRoute, LocationPicker } from "./GeoMap";
export default function LogisticsUI({
  s,
  request,
  action,
  open,
  busy,
}: {
  s: State;
  request: Requester;
  action: Action;
  open: Open;
  busy: boolean;
}) {
  const e = s.enterprise!,
    own = e.vehicles.filter((v) => v.active && v.ownership === "Propio"),
    ext = e.vehicles.filter((v) => v.active && v.ownership === "Externo");
  const [inputs, setInputs] = useState<OperationalPlan>({
      ...defaultPlan(s),
      ...s.logistics,
      registered: true,
      vehicleId: own[0]?.id || "",
      externalVehicleId: ext[0]?.id || "",
      laborHours: 8,
      laborRate: 4.5,
      extraServiceCosts: 0,
      departure: dateAfter(0) + "T08:00",
      finishBy: dateAfter(0) + "T16:00",
      externalRateMode: "km",
      externalFee: 0,
      externalKm: 0.9,
      externalStop: 0,
    }),
    [vehicleType, setVehicleType] = useState(own[0]?.type || ""),
    [selected, setSelected] = useState(
      [
        ...new Set(
          s.dispatches
            .filter((d) => d.estado === "Programada")
            .map((d) => d.point),
        ),
      ]
        .filter((id) =>
          s.points.some(
            (p) =>
              p.id === id &&
              p.contrato_validado &&
              clientFor(s, id).kind !== "prospect",
          ),
        )
        .slice(0, 7).length
        ? [
            ...new Set(
              s.dispatches
                .filter((d) => d.estado === "Programada")
                .map((d) => d.point),
            ),
          ]
            .filter((id) =>
              s.points.some(
                (p) =>
                  p.id === id &&
                  p.contrato_validado &&
                  clientFor(s, id).kind !== "prospect",
              ),
            )
            .slice(0, 7)
        : s.points
            .filter(
              (p) =>
                clientFor(s, p.id).kind !== "prospect" && p.contrato_validado,
            )
            .slice(0, 4)
            .map((p) => p.id),
    ),
    [tab, setTab] = useState("compare"),
    [result, setResult] = useState<any>(null),
    [current, setCurrent] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [source, setSource] = useState(""),
    [signature, setSignature] = useState("");
  const [customStart, setCustomStart] = useState(!!inputs.origin);
  const start = inputs.origin || warehouseFor(s);
  const set = (key: keyof OperationalPlan, value: any) => {
    setInputs((p) => ({
      ...p,
      [key]: value,
      ...(key === "externalExtras" ? { externalQuotedExtras: undefined } : {}),
    }));
    setResult(null);
  };
  const number = (
    key: keyof OperationalPlan,
    label: string,
    hint: string,
    min = 0,
  ) => (
    <label className="form-field" key={key}>
      {label}
      <input
        type="number"
        min={min}
        step="any"
        required
        value={(inputs[key] as number) ?? 0}
        onChange={(e) => set(key, Number(e.target.value))}
      />
      <small>{hint}</small>
    </label>
  );
  let derived: any;
  try {
    derived = deriveOperationalInputs(s, selected, inputs).derived;
  } catch {}
  const fingerprint = JSON.stringify({
      inputs,
      selected,
      warehouse: s.warehouse,
      vehicles: e.vehicles,
      staff: e.staff,
      trips: e.trips,
      finance: e.finance,
      dispatches: s.dispatches,
      points: s.points,
      tolls: e.tolls,
    }),
    stale = !!result && fingerprint !== signature;
  const scenarios: LogisticsScenario[] = result?.scenarios || [],
    chosen = scenarios.find((c) => c.id === current) || scenarios[0],
    recommended = scenarios.find((c) => c.feasible && c.onTime),
    vehicle = e.vehicles.find((v) => v.id === inputs.vehicleId),
    external = e.vehicles.find((v) => v.id === inputs.externalVehicleId);
  const compare = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    setLoading(true);
    setResult(null);
    try {
      let matrix;
      try {
        matrix = await roadMatrix(s, selected, start);
        setSource(
          "Red vial OSRM / OpenStreetMap · tiempos sin tráfico en vivo.",
        );
      } catch {
        setSource(
          "Red vial no disponible. Distancia geográfica aproximada y velocidad histórica de la flota.",
        );
      }
      const data = await request("logistics/compare", {
        points: selected,
        inputs,
        matrix,
      });
      setResult(data);
      setCurrent(data.scenarios[0]?.id || "");
      setSignature(fingerprint);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <SectionTitle
        eyebrow="PLANIFICACIÓN DE ABASTECIMIENTO"
        title="Una ruta. Una decisión explicada."
        text="Compara flota propia y transporte externo con costos registrados, horarios y requisitos de cada destino."
      >
        <button className="btn secondary" onClick={() => open("warehouse")}>
          Ubicar bodega <MapPin size={15} />
        </button>
      </SectionTitle>
      <div className="tabs">
        <button
          className={tab === "compare" ? "active" : ""}
          onClick={() => setTab("compare")}
        >
          Generar escenarios
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          Planes guardados ({s.routes.length})
        </button>
      </div>
      {tab === "saved" ? (
        <SavedRoutes s={s} action={action} busy={busy} open={open} />
      ) : (
        <>
          <form onSubmit={compare} className="logistics-form">
            <div className="two-col">
              <section className="card padded">
                <CardTitle
                  title="1. Destinos y ventana de operación"
                  sub={`Salida desde ${start.nombre_cliente}. Selecciona hasta 7 destinos.`}
                />
                <div className="route-origin-selector">
                  <label className="form-field">
                    Punto de partida
                    <select
                      value={customStart ? "custom" : "central"}
                      onChange={(ev) => {
                        const custom = ev.target.value === "custom";
                        setCustomStart(custom);
                        set(
                          "origin",
                          custom
                            ? {
                                ...warehouseFor(s),
                                nombre_cliente: "Otro punto de partida",
                              }
                            : undefined,
                        );
                      }}
                    >
                      <option value="central">
                        Bodega central · predeterminado
                      </option>
                      <option value="custom">
                        Otro punto de partida · elegir en el mapa
                      </option>
                    </select>
                  </label>
                  {customStart && (
                    <>
                      <label className="form-field">
                        Nombre del punto de partida
                        <input
                          required
                          maxLength={250}
                          value={start.nombre_cliente}
                          onChange={(ev) =>
                            set("origin", {
                              ...start,
                              nombre_cliente: ev.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="form-field">
                        Dirección o referencia
                        <input
                          maxLength={500}
                          value={start.direccion}
                          onChange={(ev) =>
                            set("origin", {
                              ...start,
                              direccion: ev.target.value,
                            })
                          }
                        />
                      </label>
                      <LocationPicker
                        s={s}
                        value={start}
                        onChange={(location) =>
                          set("origin", { ...start, ...location })
                        }
                      />
                      <p className="hint">
                        Este punto se usa solo para el recorrido. Puedes elegir
                        cualquier coordenada sin crear una bodega, cliente u
                        otra ubicación.
                      </p>
                    </>
                  )}
                </div>
                <div className="point-checks">
                  {s.points
                    .filter((p) => clientFor(s, p.id).kind !== "prospect")
                    .map((p) => (
                      <label className="checkbox-label" key={p.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() => {
                            setSelected((ids) =>
                              ids.includes(p.id)
                                ? ids.filter((id) => id !== p.id)
                                : [...ids, p.id],
                            );
                            setResult(null);
                          }}
                        />
                        <span>
                          {p.nombre_cliente}
                          <small className="block muted">
                            {p.zona_reparto}
                            {p.urgente ? " · Entrega prioritaria" : ""}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
                <div className="form-grid">
                  <label className="form-field">
                    Salida · hora de Ecuador
                    <input
                      type="datetime-local"
                      required
                      value={inputs.departure}
                      onChange={(e) => set("departure", e.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    Hora límite para terminar la ruta
                    <input
                      type="datetime-local"
                      required
                      min={inputs.departure}
                      value={inputs.finishBy}
                      onChange={(e) => set("finishBy", e.target.value)}
                    />
                    <small>
                      Incluye conducir, descargar, verificar y regresar si lo
                      marcas. No es la duración del servicio de limpieza.
                    </small>
                  </label>
                  {number(
                    "serviceMinutes",
                    "Descarga y verificación por destino",
                    "Minutos para estacionar, descargar insumos y firmar la guía.",
                  )}
                  {number(
                    "breakMinutes",
                    "Descansos y otras paradas",
                    "Minutos adicionales en todo el recorrido.",
                  )}
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={inputs.returnToWarehouse}
                    onChange={(e) => set("returnToWarehouse", e.target.checked)}
                  />
                  Regresar al punto de partida al finalizar
                </label>
                <div className="form-grid">
                  <label className="form-field">
                    Modalidad
                    <select
                      value={inputs.mode}
                      onChange={(e) => set("mode", e.target.value)}
                    >
                      <option value="both">Comparar propia y externa</option>
                      <option value="own">Flota propia</option>
                      <option value="external">Servicio externo</option>
                    </select>
                  </label>
                  <label className="form-field">
                    Prioridad de elección
                    <select
                      value={inputs.priority}
                      onChange={(e) => set("priority", e.target.value)}
                    >
                      <option value="balanced">Costo, tiempo y riesgo</option>
                      <option value="cost">Menor costo</option>
                      <option value="time">
                        Atender antes los destinos urgentes
                      </option>
                      <option value="risk">Menor riesgo registrado</option>
                    </select>
                  </label>
                </div>
              </section>
              <section className="card">
                <GeoMap
                  s={s}
                  origin={customStart ? start : undefined}
                  order={chosen?.order || selected}
                  returnToWarehouse={inputs.returnToWarehouse}
                  large
                  onSelect={(id) => {
                    if (id !== "route-origin") open("contact", { id });
                  }}
                />
                <div className="map-legend">
                  <span>Salida desde {start.nombre_cliente}</span>
                  <a
                    className="text-button"
                    href={googleRoute(
                      s,
                      chosen?.order || selected,
                      inputs.returnToWarehouse,
                      start,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir Google Maps ↗
                  </a>
                </div>
              </section>
            </div>
            <div className="two-col">
              {inputs.mode !== "external" && (
                <section className="card padded">
                  <CardTitle
                    icon={Truck}
                    title="2. Vehículo propio"
                    sub="Los datos se toman de Gestión de flota y del conductor asignado."
                  />
                  <div className="form-grid">
                    <label className="form-field">
                      Tipo de vehículo
                      <select
                        value={vehicleType}
                        onChange={(ev) => {
                          const type = ev.target.value;
                          setVehicleType(type);
                          set(
                            "vehicleId",
                            own.find((v) => v.type === type)?.id || "",
                          );
                        }}
                      >
                        <option value="">Selecciona un tipo</option>
                        {[...new Set(own.map((v) => v.type))].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      Vehículo registrado
                      <select
                        required
                        value={inputs.vehicleId}
                        onChange={(ev) => set("vehicleId", ev.target.value)}
                      >
                        <option value="">Selecciona un vehículo</option>
                        {own
                          .filter((v) => v.type === vehicleType)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.plate} · {v.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {number(
                      "fuelPrice",
                      "Combustible · USD/galón",
                      "Precio vigente de tu abastecimiento.",
                    )}
                    {number(
                      "food",
                      "Alimentación del viaje · USD",
                      "Solo gastos atribuibles a este viaje.",
                    )}
                    {number(
                      "other",
                      "Otros gastos del viaje · USD",
                      "Parqueadero, carga u otros costos no incluidos.",
                    )}
                  </div>
                  {vehicle && (
                    <>
                      <VehicleFacts
                        s={s}
                        id={vehicle.id}
                        on={inputs.departure?.slice(0, 10)}
                      />
                      <div className="derived-box">
                        <span>
                          Fijos registrados
                          <strong>{money(vehicle.fixedMonthly)} / mes</strong>
                        </span>
                        <span>
                          Viajes completados este mes
                          <strong>
                            {
                              vehicleTrips(
                                s,
                                vehicle.id,
                                inputs.departure?.slice(0, 7),
                              ).length
                            }
                          </strong>
                        </span>
                        <span>
                          Rendimiento registrado
                          <strong>{vehicle.kmPerGallon} km/gal</strong>
                        </span>
                        <span>
                          Presupuesto de mantenimiento
                          <strong>
                            {money(vehicle.maintenanceReserveKm)} / km
                          </strong>
                        </span>
                      </div>
                      <p className="hint">
                        El presupuesto por km permite incluir desgaste esperado
                        (llantas, aceite, taller) al comparar viajes. No crea
                        una provisión contable ni un pago real. Se configura en
                        Flota.
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("vehicle")}
                  >
                    Registrar vehículo ↗
                  </button>
                </section>
              )}
              {inputs.mode !== "own" && (
                <section className="card padded">
                  <CardTitle
                    title="3. Transporte externo"
                    sub="Elige cómo cotiza el operador: por kilómetro o por viaje."
                  />
                  <label className="form-field">
                    Vehículo y operador registrados
                    <select
                      required
                      value={inputs.externalVehicleId}
                      onChange={(e) => set("externalVehicleId", e.target.value)}
                    >
                      <option value="">Selecciona un registro externo</option>
                      {ext.map((v) => (
                        <option key={v.id} value={v.id}>
                          {s.suppliers.find((p) => p.id === v.supplierId)
                            ?.nombre || v.name}{" "}
                          · {v.plate}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Tipo de tarifa externa
                    <select
                      value={inputs.externalRateMode || "km"}
                      onChange={(ev) =>
                        set("externalRateMode", ev.target.value)
                      }
                    >
                      <option value="km">Tarifa por kilómetro · USD/km</option>
                      <option value="fixed">
                        Tarifa fija por viaje · USD/viaje
                      </option>
                    </select>
                  </label>
                  <div className="form-grid">
                    {inputs.externalRateMode === "fixed"
                      ? number(
                          "externalFee",
                          "Tarifa fija del viaje · USD",
                          "Importe total cotizado por el recorrido, incluida la vuelta si la seleccionas.",
                        )
                      : number(
                          "externalKm",
                          "Tarifa externa · USD/km",
                          "Cotización o promedio observado del proveedor. Se multiplica por los km del recorrido.",
                        )}
                    {number(
                      "externalExtras",
                      "Recargos del operador · USD",
                      "Solo conceptos fuera de la tarifa elegida. Excluye combustible y conductor si ya están incluidos.",
                    )}
                    {number(
                      "externalMinutes",
                      "Espera de disponibilidad",
                      "Minutos antes de iniciar la conducción.",
                    )}
                  </div>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!inputs.externalTollsIncluded}
                      onChange={(ev) =>
                        set("externalTollsIncluded", ev.target.checked)
                      }
                    />
                    La tarifa del operador ya incluye peajes
                  </label>
                  {external && (
                    <VehicleFacts
                      s={s}
                      id={external.id}
                      on={inputs.departure?.slice(0, 10)}
                    />
                  )}
                  <p className="hint">
                    El riesgo externo se deriva de evaluaciones asociadas a
                    operaciones cerradas. Cuando no hay evaluaciones se
                    identifica como desconocido y no se interpreta como riesgo
                    bajo.
                  </p>
                </section>
              )}
            </div>
            <section className="card padded">
              <CardTitle
                title="4. Costos del servicio de limpieza"
                sub="Insumos de las guías programadas + personal de limpieza + otros costos directos. El transporte se suma al calcular."
              />
              <div className="form-grid three-columns">
                {number(
                  "laborHours",
                  "Horas totales del equipo de limpieza",
                  "Suma de horas de todos los operarios; excluye al conductor.",
                )}
                {number(
                  "laborRate",
                  "Costo del operario · USD/h",
                  "Costo por hora de tu empresa, con cargas aplicables.",
                )}
                {number(
                  "extraServiceCosts",
                  "Otros costos directos · USD",
                  "Equipos alquilados, viáticos de limpieza y servicios auxiliares.",
                )}
              </div>
              <div className="derived-box">
                <span>
                  Insumos según guías
                  <strong>{money(derived?.materials || 0)}</strong>
                </span>
                <span>
                  Mano de obra de limpieza
                  <strong>
                    {money(
                      Number(inputs.laborHours || 0) *
                        Number(inputs.laborRate || 0),
                    )}
                  </strong>
                </span>
                <span>
                  Margen objetivo sobre venta
                  <strong>{e.finance.targetMargin}%</strong>
                </span>
                <span>
                  Peajes según catálogo de ruta
                  <strong>
                    {derived?.tollSources.length
                      ? money(derived.tolls)
                      : "Por confirmar"}
                  </strong>
                </span>
              </div>
              <p className="hint">
                Si no hay guías programadas, los insumos figuran en cero y el
                precio queda incompleto. Los peajes se asignan al incluir los
                destinos: se usan zonas y tarifas registradas, no detección de
                casetas en tiempo real.{" "}
                {derived?.tollSources.some((t: any) => t.synthetic)
                  ? "Esta ruta contiene tarifas sintéticas de demostración."
                  : ""}
              </p>
              <details className="method-details">
                <summary>Contexto variable y significado del riesgo</summary>
                <div className="form-grid">
                  {[
                    ["weatherRisk", "Clima esperado"],
                    ["roadRisk", "Condición vial"],
                    ["nightRisk", "Conducción nocturna"],
                  ].map(([key, label]) => (
                    <label className="form-field" key={key}>
                      {label}
                      <select
                        value={inputs[key as keyof OperationalPlan] as number}
                        onChange={(e) =>
                          set(
                            key as keyof OperationalPlan,
                            Number(e.target.value),
                          )
                        }
                      >
                        {RISK_OPTIONS[key as keyof typeof RISK_OPTIONS].map(
                          (option, n) => (
                            <option key={n} value={n}>
                              {n} · {option}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ))}
                </div>
                <p>
                  El índice interno de riesgo suma clima, vía, horario, químicos
                  y experiencia, más penalizaciones por obligaciones. Se expresa
                  de 0 a 35: a mayor puntaje, mayor exposición declarada. No es
                  una probabilidad de accidente. Las obligaciones incumplidas
                  impiden elegir el escenario aunque el puntaje sea bajo.
                </p>
                <p>
                  En transporte externo, el puntaje se deriva de las
                  calificaciones registradas; sin evaluaciones se usa un
                  supuesto conservador de 17,5/35 para comparar y se muestra
                  como desconocido.
                </p>
                <p>
                  Mercadería en tránsito se refiere a una póliza privada que
                  cubra los insumos transportados según sus condiciones. Es
                  distinta de la póliza del vehículo. El sistema muestra su
                  vigencia y asigna la prima registrada; no presupone que todos
                  los químicos o trayectos estén cubiertos.
                </p>
              </details>
            </section>
            <div className="logistics-submit">
              <span>
                {selected.length} destinos · un vehículo por escenario
              </span>
              <button
                type="submit"
                className="btn primary"
                disabled={loading || !selected.length || selected.length > 7}
              >
                {loading ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Generar escenarios
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
          {source && <p className="method-note">{source}</p>}
          {stale && (
            <p className="form-error">
              Los registros cambiaron. Genera de nuevo para actualizar los
              resultados.
            </p>
          )}
          {!!scenarios.length && !stale && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Comparación para decidir</h2>
                  <p>
                    Primero se exige viabilidad y hora límite; después se aplica
                    tu prioridad.
                  </p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() =>
                    download(
                      "escenarios-nexo.csv",
                      toCSV(
                        scenarios.map((c) => ({
                          modalidad: c.nombre,
                          costo: c.cost,
                          km: c.distance,
                          minutos: c.minutes,
                          precio_sugerido: c.minimumServiceRevenue,
                          riesgo: c.roadRisk,
                          recomendacion: c.recommendation,
                        })),
                      ),
                    )
                  }
                >
                  <Download size={15} />
                  Exportar
                </button>
              </div>
              <div
                className={
                  recommended ? "comparison-recommendation" : "form-error"
                }
              >
                {recommended
                  ? `Recomendado: ${recommended.nombre}. ${recommended.recommendation}`
                  : "Ningún escenario cumple los requisitos y el horario. Revisa los motivos."}
              </div>
              <div className="logistics-results">
                {scenarios.map((c) => (
                  <section
                    className={`card logistics-result ${c.id === recommended?.id ? "recommended" : ""}`}
                    key={c.id}
                  >
                    <div className="scenario-heading">
                      <Truck size={24} />
                      <Badge
                        tone={
                          !c.feasible
                            ? "rose"
                            : !c.onTime
                              ? "sand"
                              : c.id === recommended?.id
                                ? "green"
                                : "blue"
                        }
                      >
                        {!c.feasible
                          ? "No elegible"
                          : !c.onTime
                            ? "Fuera de horario"
                            : c.id === recommended?.id
                              ? "Recomendado"
                              : "Viable"}
                      </Badge>
                    </div>
                    <h3>{c.nombre}</h3>
                    <p>{c.mode === "own" ? vehicle?.plate : external?.plate}</p>
                    <div className="scenario-price">
                      {money(c.cost)}
                      <small>Costo de transporte estimado</small>
                    </div>
                    <div className="result-metrics">
                      {[
                        ["Recorrido", `${c.distance.toFixed(1)} km`],
                        [
                          "Tiempo de conducción",
                          `${Math.ceil(c.drivingMinutes)} min`,
                        ],
                        ["Tiempo total", `${Math.ceil(c.minutes)} min`],
                        [
                          "Velocidad calculada",
                          c.drivingMinutes
                            ? `${((c.distance / c.drivingMinutes) * 60).toFixed(1)} km/h`
                            : "Sin recorrido",
                        ],
                        ["Costo por km", money(c.costKm || 0)],
                        ["Uso de carga", `${c.utilizationKg.toFixed(1)}%`],
                        [
                          "Riesgo interno",
                          c.mode === "external" &&
                          result.derived.externalRiskUnknown
                            ? "Sin evaluaciones"
                            : `${c.roadRisk.toFixed(1)}/35`,
                        ],
                        [
                          "Cierre estimado",
                          new Date(c.arrival).toLocaleTimeString("es-EC", {
                            timeZone: "America/Guayaquil",
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <details className="cost-breakdown" open>
                      <summary>Cómo se calcula el transporte</summary>
                      {c.components.map((x) => (
                        <div key={x.label}>
                          <span>{x.label}</span>
                          <strong>{money(x.value)}</strong>
                        </div>
                      ))}
                    </details>
                    <div className="quote-box">
                      <small>
                        PRECIO SUGERIDO DEL SERVICIO · SIN IMPUESTOS
                      </small>
                      <strong>{money(c.minimumServiceRevenue)}</strong>
                      <p>
                        ({money(c.cost)} transporte +{" "}
                        {money(result.derived.materials)} insumos +{" "}
                        {money(result.derived.labor)} personal +{" "}
                        {money(result.derived.extra)} otros) / (1 −{" "}
                        {e.finance.targetMargin}%).
                      </p>
                    </div>
                    {!result.derived.materials && (
                      <p className="scenario-warning">
                        Faltan guías con insumos: precio incompleto.
                      </p>
                    )}
                    <p className="hint">
                      Asignación de fijos: viajes completados del mes + este
                      viaje. Peajes{" "}
                      {result.derived.tollsConfirmed
                        ? "según catálogo confirmado"
                        : "estimados o pendientes de confirmar"}
                      . No incluye impuestos ni una validación comercial del
                      precio.
                    </p>
                    {c.warnings.map((w) => (
                      <p className="scenario-warning" key={w}>
                        {w}
                      </p>
                    ))}
                    <div className="result-actions">
                      <button
                        className="btn secondary"
                        onClick={() => setCurrent(c.id)}
                      >
                        Ver en mapa
                      </button>
                      <button
                        className="btn primary"
                        disabled={!c.feasible || !c.onTime}
                        onClick={() =>
                          open("route", {
                            scenario: c,
                            points: selected,
                            inputs: c.inputs,
                            matrix: c.matrix,
                          })
                        }
                      >
                        Elegir y guardar <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
function VehicleFacts({ s, id, on }: { s: State; id: string; on?: string }) {
  const v = s.enterprise!.vehicles.find((v) => v.id === id)!;
  const c = vehicleChecks(s, v, on);
  return (
    <div className="automatic-checks">
      <small>
        <ShieldCheck size={13} />
        DATOS AUTOMÁTICOS DEL REGISTRO
      </small>
      {[
        ["Revisión técnica", c.technical],
        ["Póliza del vehículo", c.insurance],
        ["Mantenimiento", c.maintenance],
        ["Personal disponible y acreditado", c.accredited],
        ["Apto para químicos declarados", c.cargo],
      ].map(([label, ok]) => (
        <span key={String(label)}>
          <span>{label}</span>
          <Badge tone={ok ? "green" : "rose"}>
            {ok ? "Vigente / confirmado" : "Revisar registro"}
          </Badge>
        </span>
      ))}
      <p className="hint">
        Responsable: {c.driver?.name || "sin asignar"}. Mercadería en tránsito:{" "}
        {v.cargoInsuranceUntil && v.cargoInsuranceUntil >= (on || dateAfter(0))
          ? "póliza vigente registrada"
          : "cobertura por confirmar"}
        . Confirmación documental de la empresa; sin consulta automática a
        autoridades.
      </p>
    </div>
  );
}
function SavedRoutes({
  s,
  action,
  busy,
  open,
}: {
  s: State;
  action: Action;
  busy: boolean;
  open: Open;
}) {
  return (
    <section className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PLAN</th>
              <th>VEHÍCULO / OPERADOR</th>
              <th>COSTO ESTIMADO</th>
              <th>ESTADO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.routes.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.nombre}</strong>
                  <small>
                    {r.id} · {dateLabel(r.date)}
                  </small>
                </td>
                <td>{r.vehicle}</td>
                <td>{money(r.scenario.cost)}</td>
                <td>
                  <Badge tone={r.estado === "Completada" ? "green" : "blue"}>
                    {r.estado}
                  </Badge>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn secondary small"
                      onClick={() => open("route-detail", { id: r.id })}
                    >
                      Ver detalles
                    </button>
                    {r.estado !== "Completada" && (
                      <button
                        className="btn secondary small"
                        disabled={busy}
                        onClick={() =>
                          action("route.status", {
                            id: r.id,
                            estado:
                              r.estado === "Planificada"
                                ? "En tránsito"
                                : "Completada",
                          })
                        }
                      >
                        {r.estado === "Planificada" ? "Iniciar" : "Completar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!s.routes.length && <Empty />}
      </div>
    </section>
  );
}
