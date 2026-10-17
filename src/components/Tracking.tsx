import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import type { Snapshot, Preferences, Modal } from "../lib/models";
import { dispatchState } from "../lib/insights";
import { dateTime, money, validCoords } from "../lib/format";
import { api } from "../services/api";
import { SectionTitle, CardTitle, Badge, Empty } from "./ui";
import { SourceError } from "./LiveUI";
import LiveMap, { googleRoute, googleLocation } from "./LiveMap";
export default function Tracking({
  s,
  prefs,
  open,
  perform,
}: {
  s: Snapshot;
  prefs: Preferences;
  open: (m: Modal) => void;
  perform: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<number | null>(null);
  const rows = s.dispatches?.filter(
      (d) =>
        filter === "all" ||
        (filter === "pending" && !d.fecha_entrega_real) ||
        (filter === "delivered" && d.fecha_entrega_real),
    ),
    d = s.dispatches?.find((d) => d.id === selected),
    point = s.points?.find((p) => p.id === d?.punto_servicio_id),
    route = s.routes?.find((r) => r.id === d?.ruta_id),
    driver = s.staff?.find((p) => p.id === route?.conductor_id);
  return (
    <>
      <SectionTitle
        eyebrow="TRAZABILIDAD DE DESPACHOS"
        title="Cada entrega conserva su referencia."
        text="Consulta detalles, programación, producción y fecha real. El mapa corresponde al despacho seleccionado."
      >
        <button
          className="btn primary"
          disabled={!s.items || !s.points || !s.routes}
          onClick={() => open({ kind: "edit", resource: "despachos" })}
        >
          <Plus size={15} />
          Nuevo despacho
        </button>
      </SectionTitle>
      <SourceError s={s} keys={["dispatches", "points", "routes", "items"]} />
      <section className="card padded">
        <CardTitle
          title="Guías y entregas"
          sub="La API almacena despachos estructurados; no incluye adjuntos de guías."
        />
        <div className="filter-buttons">
          {[
            ["all", "Todos"],
            ["pending", "Pendientes"],
            ["delivered", "Con fecha de entrega"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DESPACHO / CLIENTE</th>
                <th>RUTA</th>
                <th>PROGRAMACIÓN</th>
                <th>ENTREGA REAL</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>
                      #{d.id} ·{" "}
                      {s.points?.find((p) => p.id === d.punto_servicio_id)
                        ?.nombre_cliente || `Punto #${d.punto_servicio_id}`}
                    </strong>
                    <small>
                      {d.detalles?.length || 0} insumos · {money(d.costo_envio)}{" "}
                      de envío
                    </small>
                  </td>
                  <td>{d.ruta_id ? `#${d.ruta_id}` : "Sin asignar"}</td>
                  <td>{dateTime(d.fecha_programada, prefs.timezone)}</td>
                  <td>{dateTime(d.fecha_entrega_real, prefs.timezone)}</td>
                  <td>
                    <Badge
                      tone={
                        d.fecha_entrega_real
                          ? "green"
                          : d.estado_produccion === "Apurado/Urgente"
                            ? "rose"
                            : "sand"
                      }
                    >
                      {dispatchState(d)}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          open({ kind: "dispatch-detail", id: d.id })
                        }
                      >
                        Ver detalle
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setSelected(d.id)}
                      >
                        Ver en mapa
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            kind: "edit",
                            resource: "despachos",
                            record: d,
                          })
                        }
                      >
                        Actualizar entrega / ruta
                      </button>
                      {!d.fecha_entrega_real &&
                        d.estado_produccion !== "Apurado/Urgente" && (
                          <button
                            className="text-button"
                            onClick={() => perform(() => api.urgent(d.id))}
                          >
                            Priorizar producción
                          </button>
                        )}
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            kind: "delete",
                            resource: "despachos",
                            record: d,
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
          {rows?.length === 0 && (
            <Empty title="No hay despachos para este filtro" />
          )}
        </div>
      </section>
      <section className="card padded">
        <CardTitle
          title="Vista geográfica del despacho"
          sub="Coordenadas actuales del destino; no es seguimiento GPS ni reconstrucción histórica de ubicaciones."
        />
        <label className="form-field">
          Despacho a visualizar
          <select
            value={selected ?? ""}
            onChange={(e) =>
              setSelected(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Selecciona un despacho</option>
            {s.dispatches?.map((d) => (
              <option key={d.id} value={d.id}>
                #{d.id} ·{" "}
                {s.points?.find((p) => p.id === d.punto_servicio_id)
                  ?.nombre_cliente || d.punto_servicio_id}
              </option>
            ))}
          </select>
        </label>
        {d ? (
          <>
            <div className="derived-box">
              <span>
                Destino
                <strong>
                  {point?.nombre_cliente || `Punto #${d.punto_servicio_id}`}
                </strong>
              </span>
              <span>
                Vehículo de la ruta
                <strong>{route?.codigo_vehiculo || "Sin asignar"}</strong>
              </span>
              <span>
                Conductor<strong>{driver?.nombre || "Sin asignar"}</strong>
              </span>
              <span>
                Referencia<strong>Despacho #{d.id}</strong>
              </span>
            </div>
            {point && validCoords(point.latitud, point.longitud) ? (
              <>
                <LiveMap
                  points={[
                    {
                      id: point.id,
                      name: point.nombre_cliente,
                      lat: point.latitud!,
                      lng: point.longitud!,
                    },
                  ]}
                  origin={prefs.origin}
                  provider={prefs.mapProvider}
                  large
                />
                <div className="row-actions">
                  <a
                    className="btn secondary"
                    href={
                      prefs.origin
                        ? googleRoute(
                            prefs.origin,
                            [{ lat: point.latitud!, lng: point.longitud! }],
                            false,
                          )
                        : googleLocation({
                            lat: point.latitud!,
                            lng: point.longitud!,
                          })
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir ubicación / ruta en Google Maps ↗
                  </a>
                  <a
                    className="btn secondary"
                    href={`https://www.waze.com/ul?${new URLSearchParams({ ll: `${point.latitud},${point.longitud}`, navigate: "yes" })}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Navegar con Waze ↗
                  </a>
                </div>
              </>
            ) : (
              <Empty
                title="Faltan coordenadas del destino"
                text="Completa la ubicación del punto de servicio para mostrar su mapa."
              />
            )}
            <p className="live-note">
              {prefs.origin
                ? "El origen mostrado es la preferencia local de bodega, no un dato histórico del despacho."
                : "La API no registra el origen del despacho. Configura tu bodega para abrir un recorrido desde ella."}{" "}
              No se devuelven despachador, receptor o diferencias de cantidades
              recibidas.
            </p>
          </>
        ) : (
          <Empty title="Selecciona un despacho para ver su destino" />
        )}
      </section>
    </>
  );
}
