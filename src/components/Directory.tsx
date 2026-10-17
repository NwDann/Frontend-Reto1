import { useState } from "react";
import { Plus, Truck, Users, ShieldCheck, Wallet } from "lucide-react";
import type { Snapshot, Preferences, Modal } from "../lib/models";
import { money, number, validCoords } from "../lib/format";
import { api } from "../services/api";
import { SectionTitle, CardTitle, Badge, Empty, Metric } from "./ui";
import { SourceError, CheckLabel } from "./LiveUI";
import LiveMap, { googleLocation } from "./LiveMap";
export function Locations({
  s,
  prefs,
  open,
}: {
  s: Snapshot;
  prefs: Preferences;
  open: (m: Modal) => void;
}) {
  const [tab, setTab] = useState("points"),
    markers = (s.points || [])
      .filter((p) => validCoords(p.latitud, p.longitud))
      .map((p) => ({
        id: p.id,
        name: p.nombre_cliente,
        lat: p.latitud!,
        lng: p.longitud!,
      }));
  return (
    <>
      <SectionTitle
        eyebrow="UBICACIONES Y ACUERDOS"
        title="Puntos de servicio con información útil."
        text="Área, dirección, zona, coordenadas y condiciones contractuales registradas."
      >
        <button
          className="btn secondary"
          disabled={!s.points}
          onClick={() => open({ kind: "edit", resource: "contratos" })}
        >
          Nuevo contrato
        </button>
        <button
          className="btn primary"
          disabled={!s.points}
          onClick={() => open({ kind: "edit", resource: "puntos-servicio" })}
        >
          <Plus size={15} />
          Nuevo punto
        </button>
      </SectionTitle>
      <SourceError s={s} keys={["points", "contracts"]} />
      <div className="tabs">
        <button
          className={tab === "points" ? "active" : ""}
          onClick={() => setTab("points")}
        >
          Directorio de puntos
        </button>
        <button
          className={tab === "contracts" ? "active" : ""}
          onClick={() => setTab("contracts")}
        >
          Contratos y adendas
        </button>
      </div>
      {tab === "points" ? (
        <>
          <section className="card padded">
            <LiveMap
              points={markers}
              origin={prefs.origin}
              provider={prefs.mapProvider}
              large
            />
            <p className="hint">
              La bodega se configura como origen local desde Configuración. Las
              categorías bodega, oficina, venta, cliente futuro y planta
              requieren ampliar el modelo de puntos operativos.
            </p>
          </section>
          <div className="live-location-grid">
            {s.points?.map((p) => (
              <section className="card padded" key={p.id}>
                <Badge tone={p.contrato_validado ? "green" : "sand"}>
                  {p.contrato_validado
                    ? "Contrato validado"
                    : "Validación pendiente"}
                </Badge>
                <h2>{p.nombre_cliente}</h2>
                <p>{p.direccion || "Dirección no registrada"}</p>
                <div className="derived-box">
                  <span>
                    Zona<strong>{p.zona_reparto || "Sin registrar"}</strong>
                  </span>
                  <span>
                    Área atendida
                    <strong>{number(p.metros_cuadrados_atendidos)} m²</strong>
                  </span>
                  <span>
                    Personal acreditado
                    <strong>
                      {p.requiere_personal_acreditado
                        ? "Requerido"
                        : "No requerido"}
                    </strong>
                  </span>
                  <span>
                    Despachos consultados
                    <strong>
                      {s.dispatches?.filter((d) => d.punto_servicio_id === p.id)
                        .length ?? "—"}
                    </strong>
                  </span>
                </div>
                <p className="hint">
                  Contacto, teléfono, correo y próxima visita no forman parte
                  del registro actual.
                </p>
                <div className="row-actions">
                  <button
                    className="btn secondary small"
                    onClick={() =>
                      open({
                        kind: "edit",
                        resource: "puntos-servicio",
                        record: p,
                      })
                    }
                  >
                    Ver / editar ficha
                  </button>
                  {validCoords(p.latitud, p.longitud) && (
                    <a
                      className="text-button"
                      href={googleLocation({
                        lat: p.latitud!,
                        lng: p.longitud!,
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Maps ↗
                    </a>
                  )}
                  <button
                    className="text-button"
                    onClick={() =>
                      open({
                        kind: "delete",
                        resource: "puntos-servicio",
                        record: p,
                      })
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </section>
            ))}
          </div>
          {s.points?.length === 0 && (
            <Empty title="No hay puntos de servicio registrados" />
          )}
        </>
      ) : (
        <section className="card padded">
          <CardTitle
            title="Contratos existentes"
            sub="El estado vigente y las adendas corresponden al registro de contrato; la bandera de validación del punto se edita en su ficha."
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CONTRATO / PUNTO</th>
                  <th>ACUERDO</th>
                  <th>VIGENTE</th>
                  <th>ADENDA</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {s.contracts?.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>#{c.id}</strong>
                      <small>
                        {s.points?.find((p) => p.id === c.punto_servicio_id)
                          ?.nombre_cliente || `Punto #${c.punto_servicio_id}`}
                      </small>
                    </td>
                    <td className="live-long-cell">
                      {c.detalles_acuerdo || "Sin detalle"}
                    </td>
                    <td>
                      <CheckLabel value={!!c.vigente} />
                    </td>
                    <td>
                      <CheckLabel value={!!c.tiene_adenda} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() =>
                            open({
                              kind: "edit",
                              resource: "contratos",
                              record: c,
                            })
                          }
                        >
                          Ver / editar
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            open({
                              kind: "delete",
                              resource: "contratos",
                              record: c,
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.contracts?.length === 0 && (
              <Empty title="No hay contratos registrados" />
            )}
          </div>
        </section>
      )}
    </>
  );
}
export function Fleet({ s, open }: { s: Snapshot; open: (m: Modal) => void }) {
  const [tab, setTab] = useState("routes"),
    [filter, setFilter] = useState("all"),
    [accredited, setAccredited] = useState<any>(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  return (
    <>
      <SectionTitle
        eyebrow="OPERACIÓN DE FLOTA Y PERSONAL"
        title="Vehículos en ruta y responsables reales."
        text="Vehículos asociados a rutas y personal por especialidad, acreditación y disponibilidad."
      >
        <button
          className="btn secondary"
          disabled={!s.staff}
          onClick={() => open({ kind: "edit", resource: "personal" })}
        >
          <Users size={15} />
          Registrar personal
        </button>
        <button
          className="btn primary"
          disabled={!s.routes}
          onClick={() => open({ kind: "edit", resource: "rutas" })}
        >
          <Plus size={15} />
          Registrar ruta / vehículo
        </button>
      </SectionTitle>
      <SourceError s={s} keys={["routes", "staff"]} />
      <div className="metrics-grid">
        <Metric
          label="Códigos de vehículo en rutas"
          value={
            s.routes
              ? new Set(s.routes.map((r) => r.codigo_vehiculo)).size
              : "—"
          }
          icon={Truck}
          detail="Conteo de códigos consultados; no es un catálogo de vehículos activos."
        />
        <Metric
          label="Personal disponible"
          value={s.staff ? s.staff.filter((p) => p.disponible).length : "—"}
          icon={Users}
          detail="Según el indicador disponible operativos."
        />
        <Metric
          label="Disponible y acreditado"
          value={
            s.staff
              ? s.staff.filter((p) => p.disponible && p.acreditado).length
              : "—"
          }
          icon={ShieldCheck}
          detail="Sin fecha de vencimiento documental registrada."
        />
        <Metric
          label="Mercadería asignada a rutas"
          value={money(
            s.routes?.reduce((a, r) => a + r.valor_mercaderia_total, 0),
          )}
          icon={Wallet}
          detail="Suma de valores de ruta; no es costo de flota ni utilidad."
        />
      </div>
      <div className="tabs">
        <button
          className={tab === "routes" ? "active" : ""}
          onClick={() => setTab("routes")}
        >
          Vehículos y carga por ruta
        </button>
        <button
          className={tab === "staff" ? "active" : ""}
          onClick={() => setTab("staff")}
        >
          Personal y acreditaciones
        </button>
      </div>
      {tab === "routes" ? (
        <>
          <section className="card padded">
            <div className="filter-buttons">
              {["all", "Planificada", "En Tránsito", "Completada"].map((v) => (
                <button
                  key={v}
                  className={filter === v ? "active" : ""}
                  onClick={() => setFilter(v)}
                >
                  {v === "all" ? "Todas" : v}
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>RUTA / VEHÍCULO</th>
                    <th>CONDUCTOR</th>
                    <th>CAPACIDAD</th>
                    <th>PESO REGISTRADO</th>
                    <th>ESTADO</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {s.routes
                    ?.filter((r) => filter === "all" || r.estado === filter)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>
                            #{r.id} · {r.codigo_vehiculo}
                          </strong>
                        </td>
                        <td>
                          {s.staff?.find((p) => p.id === r.conductor_id)
                            ?.nombre || "Sin asignar"}
                        </td>
                        <td>
                          {number(r.capacidad_peso_max_kg)} kg /{" "}
                          {number(r.capacidad_volumen_max_m3)} m³
                        </td>
                        <td>
                          {number(r.peso_actual_carga)} kg
                          <small>
                            {r.capacidad_peso_max_kg > 0
                              ? `${number((r.peso_actual_carga / r.capacidad_peso_max_kg) * 100)}% de ocupación por peso`
                              : "Capacidad no configurada"}
                          </small>
                        </td>
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
                              Detalle
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                open({
                                  kind: "edit",
                                  resource: "rutas",
                                  record: r,
                                })
                              }
                            >
                              Editar
                            </button>
                            <button
                              className="text-button"
                              onClick={() => open({ kind: "status", route: r })}
                            >
                              Estado
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="live-note">
            Mantenimientos, pólizas, revisión técnica, kilometraje y gastos
            mensuales requieren un catálogo de flota y endpoints adicionales. No
            se deducen de un código de vehículo.
          </p>
        </>
      ) : (
        <section className="card padded">
          <CardTitle
            title="Personal registrado"
            sub="Filtra por especialidad y solo personal disponible y acreditado."
          >
            <button
              className="btn secondary"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                setError("");
                try {
                  setAccredited(
                    await api.accredited({
                      solo_disponibles: true,
                      requiere_acreditado: true,
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? "Consultando…" : "Buscar personal apto"}
            </button>
          </CardTitle>
          {accredited && (
            <p className="live-note">
              La API devuelve {accredited.total} personas disponibles y
              acreditadas:{" "}
              {accredited.personal_disponible_acreditado
                ?.map((p: any) => p.nombre)
                .join(", ") || "ninguna"}
              .
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>NOMBRE / ID</th>
                  <th>ESPECIALIDAD</th>
                  <th>ACREDITADO</th>
                  <th>DISPONIBLE</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {s.staff?.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                      <small>#{p.id}</small>
                    </td>
                    <td>{p.especialidad}</td>
                    <td>
                      <CheckLabel value={p.acreditado} />
                    </td>
                    <td>
                      <CheckLabel value={p.disponible} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          onClick={() =>
                            open({
                              kind: "edit",
                              resource: "personal",
                              record: p,
                            })
                          }
                        >
                          Ver / editar
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            open({
                              kind: "delete",
                              resource: "personal",
                              record: p,
                            })
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.staff?.length === 0 && <Empty title="Sin personal registrado" />}
          </div>
        </section>
      )}
    </>
  );
}
