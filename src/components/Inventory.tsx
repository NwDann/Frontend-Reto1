import { useState } from "react";
import { Plus, Package, Calculator } from "lucide-react";
import type { Snapshot, Modal } from "../lib/models";
import { money, number, saveText } from "../lib/format";
import { stockAdjustment } from "../lib/payloads";
import { api } from "../services/api";
import { SectionTitle, CardTitle, Badge, Empty, Field } from "./ui";
import { SourceError } from "./LiveUI";
export default function Inventory({
  s,
  open,
  perform,
}: {
  s: Snapshot;
  open: (m: Modal) => void;
  perform: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [adjust, setAdjust] = useState<number | null>(null),
    [quantity, setQuantity] = useState(""),
    [ratioResult, setRatioResult] = useState<any>(null),
    [calcError, setCalcError] = useState(""),
    [calcBusy, setCalcBusy] = useState(false);
  const rows = s.items?.filter(
    (i) =>
      (filter === "all" ||
        (filter === "low" && i.stock_actual < i.stock_minimo) ||
        (filter === "above" && i.stock_actual >= i.stock_minimo)) &&
      (i.nombre.toLowerCase().includes(query.toLowerCase()) ||
        String(i.id) === query),
  );
  return (
    <>
      <SectionTitle
        eyebrow="EXISTENCIAS Y ABASTECIMIENTO"
        title="Inventario en vivo."
        text="Unidades, saldos y precios actualizados. El saldo es global; no se muestran existencias por bodega."
      >
        <button
          className="btn primary"
          disabled={!s.items}
          onClick={() => open({ kind: "edit", resource: "insumos" })}
        >
          <Plus size={15} />
          Nuevo insumo
        </button>
      </SectionTitle>
      <SourceError s={s} keys={["items", "critical"]} />
      <section className="card padded">
        <div className="table-toolbar">
          <div className="filter-buttons">
            {[
              ["all", "Todos"],
              ["low", "Bajo mínimo"],
              ["above", "En o sobre mínimo"],
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
          <input
            aria-label="Buscar un insumo existente"
            placeholder="Buscar por nombre o ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>INSUMO / ID</th>
                <th>UNIDAD</th>
                <th>STOCK</th>
                <th>MÍNIMO</th>
                <th>PRECIO USD</th>
                <th>VALOR USD</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.nombre}</strong>
                    <small>
                      #{i.id} · {i.categoria}
                    </small>
                  </td>
                  <td>{i.unidad_medida}</td>
                  <td>{number(i.stock_actual)}</td>
                  <td>{number(i.stock_minimo)}</td>
                  <td>{money(i.precio_unitario)}</td>
                  <td>{money(i.stock_actual * i.precio_unitario)}</td>
                  <td>
                    <Badge
                      tone={i.stock_actual < i.stock_minimo ? "rose" : "green"}
                    >
                      {i.stock_actual < i.stock_minimo
                        ? "Reponer"
                        : "En / sobre mínimo"}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() =>
                          open({ kind: "edit", resource: "insumos", record: i })
                        }
                      >
                        Ver / editar
                      </button>
                      <button
                        className="text-button"
                        onClick={() => open({ kind: "draft", itemId: i.id })}
                      >
                        Preparar reposición
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setAdjust(i.id);
                          setQuantity(String(i.stock_actual));
                        }}
                      >
                        Ajustar saldo
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          open({
                            kind: "delete",
                            resource: "insumos",
                            record: i,
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
          {rows?.length === 0 && <Empty title="Sin insumos para este filtro" />}
        </div>
      </section>
      {adjust !== null && (
        <section className="card padded">
          <CardTitle
            title={`Conciliación del saldo: ${s.items?.find((i) => i.id === adjust)?.nombre}`}
            sub="PATCH directo del saldo. No registra recepción, compra, lote o movimiento contable."
          />
          <form
            className="inline-edit"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await perform(() =>
                api.update("insumos", adjust, stockAdjustment(quantity)),
              );
              if (ok) setAdjust(null);
            }}
          >
            <label className="form-field">
              Saldo físico total confirmado
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </label>
            <button className="btn primary">Confirmar nuevo saldo</button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setAdjust(null)}
            >
              Cancelar
            </button>
          </form>
          <p className="hint">
            Revisa los despachos que ya descontaron stock antes de conciliar. No
            uses este ajuste como si fuera una recepción de compra.
          </p>
        </section>
      )}
      <div className="live-two-col">
        <section className="card padded">
          <CardTitle
            title="Cantidad sugerida para un servicio"
            icon={Calculator}
            sub="Calculada por /api/inventario/calcular-sugerido, con el área real del cliente."
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCalcBusy(true);
              setCalcError("");
              setRatioResult(null);
              const f = new FormData(e.currentTarget),
                ratio = String(f.get("consumo_por_m2") || "");
              try {
                setRatioResult(
                  await api.suggested({
                    punto_servicio_id: Number(f.get("punto_servicio_id")),
                    insumo_id: Number(f.get("insumo_id")),
                    ...(ratio ? { consumo_por_m2: Number(ratio) } : {}),
                  }),
                );
              } catch (e) {
                setCalcError((e as Error).message);
              } finally {
                setCalcBusy(false);
              }
            }}
          >
            <label className="form-field">
              Cliente
              <select name="punto_servicio_id" required>
                <option value="">Seleccionar</option>
                {s.points?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_cliente} · {p.metros_cuadrados_atendidos ?? 0} m²
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Insumo
              <select name="insumo_id" required>
                <option value="">Seleccionar</option>
                {s.items?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad_medida})
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Consumo por m² (opcional; si se omite, criterio disponibles)"
              name="consumo_por_m2"
              type="number"
              step="any"
              min="0.0000001"
              required={false}
            />
            <button
              className="btn primary"
              disabled={calcBusy || !s.items || !s.points}
            >
              {calcBusy ? "Consultando…" : "Calcular sugerido"}
            </button>
          </form>
          {calcError && (
            <p className="form-error" role="alert">
              {calcError}
            </p>
          )}
          {ratioResult && (
            <div className="live-note">
              <strong>
                {number(ratioResult.cantidad_sugerida)}{" "}
                {ratioResult.unidad_medida} sugeridos
              </strong>
              <p>
                {ratioResult.metros_cuadrados} m² × {ratioResult.consumo_por_m2}{" "}
                · {ratioResult.nombre_insumo}
              </p>
              <p>
                Desglose reportado:{" "}
                {JSON.stringify(ratioResult.desglose_empaque)}
              </p>
              <button
                className="text-button"
                onClick={() =>
                  saveText(
                    "cantidad-sugerida.json",
                    JSON.stringify(ratioResult, null, 2),
                  )
                }
              >
                Descargar cálculo ↗
              </button>
            </div>
          )}
        </section>
        <section className="card padded">
          <CardTitle title="Indicadores y límites de estos datos" />
          <div className="live-note">
            <strong>Reposición</strong>
            <p>
              La recomendación mínima se obtiene de máximo(0, mínimo − stock).
              Los puntos en riesgo aparecen también en Predicción de demanda.
            </p>
          </div>
          <div className="live-note">
            <strong>Rotación y vencimientos</strong>
            <p>
              Por ahora no hay consumo contable por periodo, inventario promedio,
              lotes ni fechas de vencimiento. Esos indicadores se mostrarán
              cuando existan esos datos.
            </p>
          </div>
          <div className="live-note">
            <strong>Empaques y bodegas</strong>
            <p>
              Las unidades admitidas son unidad, caja, caneca y litro. El
              contenido de una agrupación y las existencias por ubicación
              requieren campos adicionales en el sistema.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
