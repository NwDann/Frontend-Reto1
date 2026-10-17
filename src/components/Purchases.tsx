import { useState } from "react";
import { Plus, Download, X } from "lucide-react";
import type { Snapshot, Draft, Modal } from "../lib/models";
import { replenishment } from "../lib/insights";
import { number, money, saveText } from "../lib/format";
import { SectionTitle, CardTitle, Badge, Empty, Field } from "./ui";
import { SourceError } from "./LiveUI";
export function Purchases({
  s,
  drafts,
  open,
}: {
  s: Snapshot;
  drafts: Draft[];
  open: (m: Modal) => void;
}) {
  const [tab, setTab] = useState("recommendations");
  return (
    <>
      <SectionTitle
        eyebrow="REPOSICIÓN CON EVIDENCIA"
        title="Prepara compras a partir del stock real."
        text="Consulta recomendaciones y genera borradores. La API actual no incluye solicitudes de compra, proveedores o recepción de insumos."
      >
        <button
          className="btn primary"
          disabled={!s.items?.length}
          onClick={() => open({ kind: "draft" })}
        >
          <Plus size={15} />
          Preparar nueva solicitud
        </button>
      </SectionTitle>
      <SourceError s={s} keys={["items", "critical"]} />
      <div className="tabs">
        <button
          className={tab === "recommendations" ? "active" : ""}
          onClick={() => setTab("recommendations")}
        >
          Todas las recomendaciones
        </button>
        <button
          className={tab === "drafts" ? "active" : ""}
          onClick={() => setTab("drafts")}
        >
          Borradores de esta sesión ({drafts.length})
        </button>
      </div>
      {tab === "recommendations" ? (
        <section className="card padded">
          <CardTitle
            title="Reposición por insumo"
            sub="El déficit mínimo es máximo(0, stock mínimo − stock actual). No se descuentan otra vez los despachos pendientes."
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>INSUMO</th>
                  <th>STOCK / MÍNIMO</th>
                  <th>DÉFICIT CALCULADO</th>
                  <th>REFERENCIA DEL BACKEND</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {replenishment(s).map(({ item: i, deficit, api }) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.nombre}</strong>
                      <small>
                        #{i.id} · {i.unidad_medida}
                      </small>
                    </td>
                    <td>
                      {number(i.stock_actual)} / {number(i.stock_minimo)}
                    </td>
                    <td>
                      <Badge tone={deficit ? "rose" : "green"}>
                        {number(deficit)} {i.unidad_medida}
                      </Badge>
                    </td>
                    <td>
                      {api
                        ? `${api.stock_deficit} de déficit · ${api.puntos_en_riesgo.length} puntos en riesgo`
                        : s.critical
                          ? "No listado como crítico"
                          : "Sin consulta de críticos"}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => open({ kind: "draft", itemId: i.id })}
                      >
                        Preparar reposición ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="card padded">
          <CardTitle
            title="Borradores sin enviar"
            sub="Se conservan en memoria durante esta sesión. Descárgalos antes de recargar."
          />
          {drafts.map((d) => (
            <div className="list-row" key={d.id}>
              <span>
                <strong>
                  {s.items?.find((i) => i.id === d.itemId)?.nombre || d.itemId}{" "}
                  · {d.quantity}{" "}
                  {s.items?.find((i) => i.id === d.itemId)?.unidad_medida}
                </strong>
                <small>
                  {d.reason} · Proveedor propuesto:{" "}
                  {d.provider || "Por definir"}
                </small>
              </span>
              <button
                className="text-button"
                onClick={() =>
                  saveText(
                    `borrador-${d.id}.json`,
                    JSON.stringify(
                      {
                        ...d,
                        state: "BORRADOR SIN ENVIAR",
                        source: "Preparado en frontend sobre catálogo FastAPI",
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Descargar detalle JSON
              </button>
            </div>
          ))}
          {!drafts.length && (
            <Empty
              title="Todavía no hay borradores"
              text="Preparar una solicitud abre un formulario nuevo; no simula un trámite en el backend."
            />
          )}
          {drafts.length > 0 && (
            <div className="row-actions">
              {(["xlsx", "pdf"] as const).map((format) => (
                <button
                  className="btn secondary"
                  key={format}
                  onClick={async () => {
                    const { exportTables } =
                      await import("../services/reports");
                    await exportTables(
                      [
                        {
                          title: "Borradores de compra SIN ENVIAR",
                          columns: [
                            "ID",
                            "Insumo",
                            "Cantidad",
                            "Unidad",
                            "Proveedor propuesto",
                            "Motivo",
                            "Estado",
                          ],
                          rows: drafts.map((d) => [
                            d.id,
                            s.items?.find((i) => i.id === d.itemId)?.nombre ||
                              d.itemId,
                            d.quantity,
                            s.items?.find((i) => i.id === d.itemId)
                              ?.unidad_medida || "",
                            d.provider,
                            d.reason,
                            "BORRADOR SIN ENVIAR",
                          ]),
                          note: "No registrado ni enviado al backend. No hay aprobación ni recepción de compras en la API documentada.",
                        },
                      ],
                      format,
                      "borradores-compra",
                    );
                  }}
                >
                  <Download size={15} />
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <p className="live-note">
        Al recibir físicamente una compra, este frontend solo ofrece una
        conciliación explícita del saldo en Inventario. Eso no equivale a
        registrar una compra ni su trazabilidad. Para ese flujo se necesitan
        endpoints de compras y movimientos.
      </p>
    </>
  );
}
export function DraftEditor({
  s,
  itemId,
  close,
  save,
}: {
  s: Snapshot;
  itemId?: number;
  close: () => void;
  save: (d: Draft) => void;
}) {
  const [selected, setSelected] = useState(itemId || s.items?.[0]?.id || 0),
    [error, setError] = useState("");
  const item = s.items?.find((i) => i.id === selected);
  return (
    <div className="modal-overlay">
      <section
        className="live-modal modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="draft-title">Nueva solicitud · borrador</h2>
            <p>Documento preparatorio. No se enviará al backend.</p>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              qty = Number(f.get("quantity"));
            if (!item || !Number.isFinite(qty) || qty <= 0) {
              setError("Selecciona un insumo y una cantidad mayor que cero.");
              return;
            }
            save({
              id: crypto.randomUUID(),
              itemId: selected,
              quantity: qty,
              reason: String(f.get("reason") || "").trim(),
              provider: String(f.get("provider") || "").trim(),
              createdAt: new Date().toISOString(),
            });
            close();
          }}
        >
          <label className="form-field">
            Insumo del catálogo real
            <select
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {s.items?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.unidad_medida})
                </option>
              ))}
            </select>
          </label>
          <Field
            key={selected}
            label={`Cantidad (${item?.unidad_medida || "unidad"})`}
            name="quantity"
            type="number"
            min="0.000001"
            step="any"
            value={Math.max(
              1,
              (item?.stock_minimo || 0) - (item?.stock_actual || 0),
            )}
          />
          <Field label="Motivo" name="reason" value="Reposición de insumos" />
          <Field
            label="Proveedor propuesto (texto libre, sin catálogo en la API)"
            name="provider"
            required={false}
          />
          <p className="live-note">
            El borrador no cambia stock, no genera una orden de compra y no
            tiene un estado de aprobación del backend.
          </p>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary">
            Agregar a borradores de esta sesión
          </button>
        </form>
      </section>
    </div>
  );
}
export function Suppliers() {
  return (
    <>
      <SectionTitle
        eyebrow="PROVEEDORES"
        title="Este módulo necesita una fuente de proveedores."
        text="La documentación recibida no expone proveedores, catálogos comerciales ni evaluaciones de operaciones."
      />
      <section className="card padded">
        <CardTitle title="Datos pendientes de habilitar en el backend" />
        <div className="live-note">
          <strong>Directorio</strong>
          <p>
            RUC, razón social, dirección, contacto, condiciones de pago y
            productos ofrecidos.
          </p>
        </div>
        <div className="live-note">
          <strong>Evaluaciones</strong>
          <p>
            Compras recibidas o rechazadas y servicios externos completados, con
            su referencia, puntualidad, calidad y costo.
          </p>
        </div>
        <p>
          No se mostrarán proveedores inventados o calificaciones sin
          operaciones que las respalden. Puedes proponer un proveedor en un
          borrador de Compras.
        </p>
        <button
          className="btn secondary"
          onClick={() =>
            saveText(
              "requisitos-modulo-proveedores.json",
              JSON.stringify(
                {
                  status: "Propuesta de ampliación, no contrato existente",
                  entities: {
                    proveedores: [
                      "id",
                      "ruc",
                      "nombre",
                      "direccion",
                      "contacto",
                      "telefono",
                      "email",
                      "condiciones_pago",
                    ],
                    productos_proveedor: [
                      "proveedor_id",
                      "insumo_id",
                      "precio",
                      "minimo_pedido",
                      "plazo_dias",
                    ],
                    evaluaciones: [
                      "proveedor_id",
                      "operacion_id",
                      "tipo_operacion",
                      "puntualidad",
                      "calidad",
                      "costo",
                      "fecha",
                    ],
                  },
                  flows: [
                    "GET/POST/PATCH proveedores",
                    "GET catálogo por insumo",
                    "GET operaciones pendientes de evaluar",
                    "POST evaluación asociada a operación",
                  ],
                },
                null,
                2,
              ),
            )
          }
        >
          Descargar especificación de datos requerida
        </button>
      </section>
    </>
  );
}
