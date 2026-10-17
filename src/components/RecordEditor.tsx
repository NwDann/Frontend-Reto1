import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, LoaderCircle } from "lucide-react";
import { api } from "../services/api";
import type { Snapshot, Modal, Preferences } from "../lib/models";
import { createPayload, updatePayload } from "../lib/payloads";
import {
  dateTime,
  money,
  toInputDate,
  validCoords,
  saveText,
} from "../lib/format";
import { Badge, Field, Empty } from "./ui";
import LiveMap, { CoordinateFields } from "./LiveMap";
const resourceNames = {
  insumos: "insumo",
  "puntos-servicio": "punto de servicio",
  personal: "persona",
  rutas: "ruta",
  despachos: "despacho",
  contratos: "contrato",
};
export default function RecordEditor({
  modal,
  s,
  prefs,
  close,
  saved,
}: {
  modal: Exclude<Modal, { kind: "draft" }>;
  s: Snapshot;
  prefs: Preferences;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<any>(null),
    [loading, setLoading] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const edit = modal.kind === "edit" ? modal : null,
    r = edit?.record,
    seed = edit?.seed || {},
    resource = edit?.resource;
  const [coords, setCoords] = useState(
      r?.latitud !== null && r?.latitud !== undefined && r?.longitud !== null
        ? { lat: r.latitud, lng: r.longitud }
        : null,
    ),
    [lines, setLines] = useState<any[]>([
      {
        insumo_id: s.items?.[0]?.id ?? "",
        cantidad_solicitada: 1,
        es_promocion: false,
      },
    ]),
    [deduct, setDeduct] = useState(true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = panel.current;
    node?.querySelector<HTMLElement>("input,select,button")?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
      if (e.key === "Tab" && node) {
        const focusable = Array.from(
          node.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
          ),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [busy]);
  useEffect(() => {
    if (modal.kind !== "dispatch-detail" && modal.kind !== "route-detail")
      return;
    let alive = true;
    setLoading(true);
    api
      .get(modal.kind === "dispatch-detail" ? "despachos" : "rutas", modal.id)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [modal]);
  const title = edit
    ? `${r ? "Editar" : "Crear"} ${resourceNames[edit.resource]}`
    : modal.kind === "status"
      ? `Estado de ruta #${modal.route.id}`
      : modal.kind === "delete"
        ? `Eliminar ${resourceNames[modal.resource]} #${modal.record.id}`
        : modal.kind === "route-detail"
          ? `Ruta #${modal.id}`
          : "id" in modal
            ? `Despacho #${modal.id}`
            : "Formulario";
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const f = Object.fromEntries(new FormData(e.currentTarget));
      if (edit) {
        const values = {
          ...f,
          ...(edit.resource === "puntos-servicio"
            ? { latitud: coords?.lat ?? "", longitud: coords?.lng ?? "" }
            : {}),
          ...(edit.resource === "despachos" && !r
            ? { detalles: lines, descontar_stock: deduct }
            : {}),
        };
        if (r)
          await api.update(
            edit.resource,
            r.id,
            updatePayload(edit.resource, values, prefs.timezone),
          );
        else
          await api.create(
            edit.resource,
            createPayload(edit.resource, values, prefs.timezone),
          );
      }
      if (modal.kind === "status")
        await api.routeStatus(modal.route.id, {
          estado: f.estado as any,
          notas_imprevisto: String(f.notas_imprevisto || "").trim() || null,
          tiene_adenda: f.tiene_adenda === "on",
        });
      if (modal.kind === "delete") {
        if (String(f.confirm) !== String(modal.record.id))
          throw Error("Escribe el ID del registro para confirmar.");
        await api.remove(modal.resource, modal.record.id);
      }
      await saved();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pointSelect = (name = "punto_servicio_id", value?: number) => (
    <label className="form-field">
      Punto de servicio
      <select
        name={name}
        required
        defaultValue={value ?? seed.punto_servicio_id ?? ""}
      >
        <option value="" disabled>
          Selecciona un punto
        </option>
        {s.points?.map((p) => (
          <option value={p.id} key={p.id}>
            #{p.id} · {p.nombre_cliente}
          </option>
        ))}
      </select>
    </label>
  );
  const routeSelect = (value?: number | null) => (
    <label className="form-field">
      Ruta asignada
      <select name="ruta_id" defaultValue={value ?? seed.ruta_id ?? ""}>
        <option value="">Sin asignar</option>
        {s.routes?.map((p) => (
          <option value={p.id} key={p.id}>
            #{p.id} · {p.codigo_vehiculo} · {p.estado}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}
    >
      <div
        className="modal-box live-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        ref={panel}
      >
        <header className="modal-header">
          <div>
            <h2 id="edit-title">{title}</h2>
            <p>
              {edit
                ? "Los campos se guardan en el registro operativo."
                : "Datos de la operación seleccionada."}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            className="icon-button"
            aria-label="Cerrar formulario"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <form className="modal-body" onSubmit={submit}>
          {edit && resource === "insumos" && (
            <>
              <Field
                label="Nombre del insumo"
                name="nombre"
                value={r?.nombre}
              />
              <div className="form-grid">
                <label className="form-field">
                  Categoría
                  <select
                    name="categoria"
                    defaultValue={r?.categoria || "quimico"}
                  >
                    {["quimico", "consumible", "herramienta"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  Unidad del inventario
                  <select
                    name="unidad_medida"
                    defaultValue={r?.unidad_medida || "unidad"}
                  >
                    {["unidad", "caja", "caneca", "litro"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Stock mínimo"
                  name="stock_minimo"
                  type="number"
                  min="0"
                  step="any"
                  value={r?.stock_minimo ?? 0}
                />
                <Field
                  label="Precio por unidad registrada (USD)"
                  name="precio_unitario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={r?.precio_unitario ?? 0}
                />
                <Field
                  label="Peso por unidad registrada (kg)"
                  name="peso_unitario_kg"
                  type="number"
                  min="0"
                  step="any"
                  value={r?.peso_unitario_kg ?? 0}
                />
                <Field
                  label="Volumen por unidad registrada (m³)"
                  name="volumen_unitario_m3"
                  type="number"
                  min="0"
                  step="any"
                  value={r?.volumen_unitario_m3 ?? 0}
                />
              </div>
              <div className="live-note">
                {r
                  ? `Stock actual consultado: ${r.stock_actual} ${r.unidad_medida}. Este formulario conserva el saldo; los ajustes se realizan desde Inventario.`
                  : "Una referencia nueva se crea con stock cero. La unidad, peso, volumen y precio deben corresponder a la misma presentación."}{" "}
                El sistema no registra contenido por caja, lotes ni vencimientos.
              </div>
            </>
          )}
          {edit && resource === "puntos-servicio" && (
            <>
              <Field
                label="Nombre del cliente / punto"
                name="nombre_cliente"
                value={r?.nombre_cliente}
              />
              <Field
                label="Dirección"
                name="direccion"
                value={r?.direccion || ""}
                required={false}
              />
              <div className="form-grid">
                <Field
                  label="Zona de reparto"
                  name="zona_reparto"
                  value={r?.zona_reparto || ""}
                  required={false}
                />
                <Field
                  label="Área atendida (m²)"
                  name="metros_cuadrados_atendidos"
                  type="number"
                  min="0"
                  step="any"
                  value={r ? (r.metros_cuadrados_atendidos ?? "") : 0}
                  required={false}
                />
              </div>
              <CoordinateFields value={coords} onChange={setCoords} />
              <LiveMap
                points={
                  coords
                    ? [
                        {
                          ...coords,
                          id: "edit-point",
                          name: "Ubicación a guardar",
                        },
                      ]
                    : []
                }
                origin={null}
                provider={prefs.mapProvider}
                onPick={setCoords}
              />
              <label className="checkbox-label">
                <input
                  name="contrato_validado"
                  type="checkbox"
                  defaultChecked={r?.contrato_validado ?? false}
                />
                Contrato validado
              </label>
              <label className="checkbox-label">
                <input
                  name="requiere_personal_acreditado"
                  type="checkbox"
                  defaultChecked={r?.requiere_personal_acreditado ?? false}
                />
                Requiere personal acreditado
              </label>
              <p className="hint">
                El contrato actual almacena puntos de servicio. Bodegas,
                oficinas, contacto y categorías adicionales requieren ampliar el
                sistema.
              </p>
            </>
          )}
          {edit && resource === "personal" && (
            <>
              <Field label="Nombre" name="nombre" value={r?.nombre} />
              <label className="form-field">
                Especialidad
                <select
                  name="especialidad"
                  defaultValue={r?.especialidad || "general"}
                >
                  {["general", "hospitalario", "emergencia"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="acreditado"
                  defaultChecked={r?.acreditado ?? false}
                />
                Acreditación confirmada en el registro
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="disponible"
                  defaultChecked={r?.disponible ?? true}
                />
                Disponible
              </label>
              <p className="hint">
                El sistema registra indicadores sí/no; no devuelve fechas de
                vigencia, documentos, teléfonos o costos por hora.
              </p>
            </>
          )}
          {edit && resource === "rutas" && (
            <>
              <Field
                label="Código / placa del vehículo"
                name="codigo_vehiculo"
                value={r?.codigo_vehiculo ?? seed.codigo_vehiculo}
              />
              <label className="form-field">
                Conductor
                <select
                  name="conductor_id"
                  defaultValue={r?.conductor_id ?? seed.conductor_id ?? ""}
                >
                  <option value="">Sin asignar</option>
                  {s.staff?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ·{" "}
                      {p.acreditado ? "acreditado" : "sin acreditar"} ·{" "}
                      {p.disponible ? "disponible" : "no disponible"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <Field
                  label="Capacidad de peso máxima (kg)"
                  name="capacidad_peso_max_kg"
                  type="number"
                  min="0.01"
                  step="any"
                  value={
                    r?.capacidad_peso_max_kg ??
                    seed.capacidad_peso_max_kg ??
                    2000
                  }
                />
                <Field
                  label="Capacidad de volumen máxima (m³)"
                  name="capacidad_volumen_max_m3"
                  type="number"
                  min="0"
                  step="any"
                  value={
                    r?.capacidad_volumen_max_m3 ??
                    seed.capacidad_volumen_max_m3 ??
                    0
                  }
                />
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="es_multiparada"
                  defaultChecked={r?.es_multiparada ?? true}
                />
                Ruta con múltiples paradas
              </label>
              <p className="hint">
                Esta acción registra la operación de ruta y el vehículo en ella.
                El sistema no guarda el orden optimizado, su geometría ni los
                supuestos de costos; descárgalos desde el simulador.
              </p>
            </>
          )}
          {edit && resource === "despachos" && (
            <>
              {!r ? (
                pointSelect()
              ) : (
                <p>
                  <strong>
                    Destino:{" "}
                    {s.points?.find((p) => p.id === r.punto_servicio_id)
                      ?.nombre_cliente || `#${r.punto_servicio_id}`}
                  </strong>
                </p>
              )}
              {routeSelect(r?.ruta_id)}
              <div className="form-grid">
                <Field
                  label={`Fecha programada (${prefs.timezone})`}
                  name="fecha_programada"
                  type="datetime-local"
                  value={toInputDate(r?.fecha_programada, prefs.timezone)}
                  required={false}
                />
                <Field
                  label="Costo de envío registrado (USD, opcional)"
                  name="costo_envio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={r ? (r.costo_envio ?? "") : 0}
                  required={false}
                />
              </div>
              {r ? (
                <>
                  <Field
                    label={`Fecha real de entrega (${prefs.timezone})`}
                    name="fecha_entrega_real"
                    type="datetime-local"
                    value={toInputDate(r?.fecha_entrega_real, prefs.timezone)}
                    required={false}
                  />
                  <label className="form-field">
                    Estado de producción
                    <select
                      name="estado_produccion"
                      defaultValue={r?.estado_produccion || "Normal"}
                    >
                      <option>Normal</option>
                      <option>Apurado/Urgente</option>
                    </select>
                  </label>
                  <div className="live-note">
                    Actualizar la fecha de entrega no vuelve a descontar stock.
                    El sistema no permite registrar cantidades entregadas distintas
                    de las solicitadas ni editar el detalle del despacho.
                  </div>
                </>
              ) : (
                <>
                  <h3>Insumos solicitados</h3>
                  {lines.map((line, i) => (
                    <div className="live-dispatch-line" key={i}>
                      <label className="form-field">
                        Insumo
                        <select
                          required
                          value={line.insumo_id}
                          onChange={(e) =>
                            setLines((xs) =>
                              xs.map((l, j) =>
                                j === i
                                  ? { ...l, insumo_id: Number(e.target.value) }
                                  : l,
                              ),
                            )
                          }
                        >
                          <option value="" disabled>
                            Seleccionar
                          </option>
                          {s.items?.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nombre} · {item.stock_actual}{" "}
                              {item.unidad_medida} disponibles
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        Cantidad
                        <input
                          required
                          type="number"
                          step="any"
                          min="0.000001"
                          value={line.cantidad_solicitada}
                          onChange={(e) =>
                            setLines((xs) =>
                              xs.map((l, j) =>
                                j === i
                                  ? {
                                      ...l,
                                      cantidad_solicitada: Number(
                                        e.target.value,
                                      ),
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={line.es_promocion}
                          onChange={(e) =>
                            setLines((xs) =>
                              xs.map((l, j) =>
                                j === i
                                  ? { ...l, es_promocion: e.target.checked }
                                  : l,
                              ),
                            )
                          }
                        />
                        Promoción
                      </label>
                      <button
                        type="button"
                        aria-label={`Quitar insumo ${i + 1}`}
                        className="icon-button"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((xs) => xs.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() =>
                      setLines((xs) => [
                        ...xs,
                        {
                          insumo_id: "",
                          cantidad_solicitada: 1,
                          es_promocion: false,
                        },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Agregar insumo
                  </button>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={deduct}
                      onChange={(e) => setDeduct(e.target.checked)}
                    />
                    Descontar existencias al crear este despacho
                  </label>
                  <div className="live-note warning">
                    {deduct
                      ? "El sistema descontará las cantidades al crear. La fecha de entrega se registrará después."
                      : "Este despacho se creará sin descontar existencias. El contrato actual no tiene una acción posterior dedicada a descontar este despacho."}{" "}
                    Ante un error de conexión, comprueba el listado antes de
                    volver a enviar.
                  </div>
                </>
              )}
            </>
          )}
          {edit && resource === "contratos" && (
            <>
              {!r ? (
                pointSelect()
              ) : (
                <p>
                  <strong>
                    {s.points?.find((p) => p.id === r.punto_servicio_id)
                      ?.nombre_cliente || `Punto #${r.punto_servicio_id}`}
                  </strong>
                  <input
                    type="hidden"
                    name="punto_servicio_id"
                    value={r.punto_servicio_id}
                  />
                </p>
              )}
              <label className="form-field">
                Detalles del acuerdo
                <textarea
                  name="detalles_acuerdo"
                  rows={5}
                  defaultValue={r?.detalles_acuerdo || ""}
                />
              </label>
              <label className="checkbox-label">
                <input
                  name="vigente"
                  type="checkbox"
                  defaultChecked={r?.vigente ?? true}
                />
                Contrato vigente
              </label>
              <label className="checkbox-label">
                <input
                  name="tiene_adenda"
                  type="checkbox"
                  defaultChecked={r?.tiene_adenda ?? false}
                />
                Tiene adenda
              </label>
            </>
          )}
          {modal.kind === "status" && (
            <>
              <label className="form-field">
                Estado
                <select name="estado" defaultValue={modal.route.estado}>
                  {["Planificada", "En Tránsito", "Completada"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Notas del imprevisto / cambio
                <textarea name="notas_imprevisto" rows={4} />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="tiene_adenda" />
                Cambio respaldado por adenda
              </label>
              <p className="hint">
                Estado actual: {modal.route.estado}. Se enviará PATCH a
                ruta {modal.route.id}/estado. El sistema decide qué
                validaciones aplica.
              </p>
            </>
          )}
          {modal.kind === "delete" && (
            <>
              <div className="live-note warning">
                Eliminar afecta el registro del sistema. Revisa sus relaciones
                antes de continuar. El contrato no documenta que eliminar un
                despacho restituya stock ni cómo trata cada dependencia.
              </div>
              <Field
                label={`Escribe ${modal.record.id} para confirmar`}
                name="confirm"
              />
            </>
          )}
          {loading && (
            <p className="loading-inline">
              <LoaderCircle className="spin" size={17} />
              Consultando detalle…
            </p>
          )}
          {modal.kind === "dispatch-detail" && detail && (
            <>
              <div className="detail-hero">
                <div>
                  <h3>
                    {s.points?.find((p) => p.id === detail.punto_servicio_id)
                      ?.nombre_cliente || `Punto #${detail.punto_servicio_id}`}
                  </h3>
                  <p>
                    Ruta {detail.ruta_id ? `#${detail.ruta_id}` : "sin asignar"}
                  </p>
                </div>
                <Badge tone={detail.fecha_entrega_real ? "green" : "sand"}>
                  {detail.fecha_entrega_real
                    ? "Entrega registrada"
                    : "Pendiente"}
                </Badge>
              </div>
              <div className="derived-box">
                <span>
                  Programada
                  <strong>
                    {dateTime(detail.fecha_programada, prefs.timezone)}
                  </strong>
                </span>
                <span>
                  Entrega real
                  <strong>
                    {dateTime(detail.fecha_entrega_real, prefs.timezone)}
                  </strong>
                </span>
                <span>
                  Costo de envío<strong>{money(detail.costo_envio)}</strong>
                </span>
                <span>
                  Producción<strong>{detail.estado_produccion}</strong>
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>INSUMO</th>
                      <th>SOLICITADO</th>
                      <th>UNIDAD</th>
                      <th>PROMOCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.detalles?.map((l: any) => (
                      <tr key={l.id}>
                        <td>
                          {s.items?.find((i) => i.id === l.insumo_id)?.nombre ||
                            `#${l.insumo_id}`}
                        </td>
                        <td>{l.cantidad_solicitada}</td>
                        <td>
                          {s.items?.find((i) => i.id === l.insumo_id)
                            ?.unidad_medida || "Sin catálogo"}
                        </td>
                        <td>{l.es_promocion ? "Sí" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(() => {
                const route = s.routes?.find((r) => r.id === detail.ruta_id),
                  driver = s.staff?.find((p) => p.id === route?.conductor_id);
                return (
                  <p className="live-note">
                    Vehículo: {route?.codigo_vehiculo || "Sin ruta asignada"} ·
                    Conductor: {driver?.nombre || "Sin asignación consultada"}.
                    Despachador, receptor, guías adjuntas y cantidades
                    efectivamente entregadas no se incluyen en este sistema.
                  </p>
                );
              })()}
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  saveText(
                    `despacho-${detail.id}.json`,
                    JSON.stringify(detail, null, 2),
                  )
                }
              >
                Descargar registro JSON
              </button>
            </>
          )}
          {modal.kind === "route-detail" && detail && (
            <>
              <Badge tone={detail.estado === "Completada" ? "green" : "blue"}>
                {detail.estado}
              </Badge>
              <div className="derived-box">
                {[
                  ["Vehículo", detail.codigo_vehiculo],
                  [
                    "Conductor",
                    s.staff?.find((p) => p.id === detail.conductor_id)
                      ?.nombre || "Sin asignar",
                  ],
                  ["Peso actual", `${detail.peso_actual_carga} kg`],
                  [
                    "Capacidad",
                    `${detail.capacidad_peso_max_kg} kg / ${detail.capacidad_volumen_max_m3} m³`,
                  ],
                  ["Valor de mercadería", money(detail.valor_mercaderia_total)],
                  ["Creada", dateTime(detail.created_at, prefs.timezone)],
                ].map(([k, v]) => (
                  <span key={k}>
                    {k}
                    <strong>{v}</strong>
                  </span>
                ))}
              </div>
              <h3>Despachos vinculados</h3>
              {s.dispatches
                ?.filter((d) => d.ruta_id === detail.id)
                .map((d) => (
                  <div className="list-row" key={d.id}>
                    <span>
                      <strong>
                        #{d.id} ·{" "}
                        {s.points?.find((p) => p.id === d.punto_servicio_id)
                          ?.nombre_cliente || d.punto_servicio_id}
                      </strong>
                      <small>
                        {dateTime(d.fecha_programada, prefs.timezone)}
                      </small>
                    </span>
                    <Badge tone={d.fecha_entrega_real ? "green" : "sand"}>
                      {d.fecha_entrega_real
                        ? "Entrega registrada"
                        : "Pendiente"}
                    </Badge>
                  </div>
                ))}
              <p className="live-note">
                El sistema devuelve el estado y la carga de la ruta; no almacena su
                origen, orden óptimo, geometría, costos detallados ni historial
                de cambios.
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  saveText(
                    `ruta-${detail.id}.json`,
                    JSON.stringify(
                      {
                        route: detail,
                        dispatches: s.dispatches?.filter(
                          (d) => d.ruta_id === detail.id,
                        ),
                        source: "Sistema",
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Descargar detalle completo disponible
              </button>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="live-modal-footer">
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={close}
            >
              Cerrar
            </button>
            {(edit || modal.kind === "status" || modal.kind === "delete") && (
              <button
                className={`btn ${modal.kind === "delete" ? "danger" : "primary"}`}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Guardando…
                  </>
                ) : modal.kind === "delete" ? (
                  "Eliminar del sistema"
                ) : edit?.resource === "despachos" && !r && deduct ? (
                  "Crear y descontar stock"
                ) : (
                  "Guardar en el sistema"
                )}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
