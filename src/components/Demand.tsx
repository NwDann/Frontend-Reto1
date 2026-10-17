import { useState } from "react";
import type { Snapshot, Preferences, Modal } from "../lib/models";
import { clientForecast } from "../lib/forecast";
import { number } from "../lib/format";
import { SectionTitle, CardTitle, Badge, Empty } from "./ui";
import { SourceError } from "./LiveUI";
export default function Demand({
  s,
  prefs,
  open,
}: {
  s: Snapshot;
  prefs: Preferences;
  open: (m: Modal) => void;
}) {
  const [client, setClient] = useState(s.points?.[0]?.id || 0),
    [itemId, setItem] = useState(s.items?.[0]?.id || 0),
    [weeks, setWeeks] = useState(4),
    [coverage, setCoverage] = useState(false),
    [show, setShow] = useState(true);
  const actualClient = s.points?.some((p) => p.id === client)
      ? client
      : s.points?.[0]?.id || 0,
    actualItem = s.items?.some((i) => i.id === itemId)
      ? itemId
      : s.items?.[0]?.id || 0,
    point = s.points?.find((p) => p.id === actualClient),
    item = s.items?.find((i) => i.id === actualItem),
    f = clientForecast(
      s,
      actualClient,
      actualItem,
      weeks,
      coverage,
      Date.now(),
      prefs.timezone,
    ),
    max = Math.max(...f.rows.map((r) => r.quantity || 0), ...f.values, 1);
  return (
    <>
      <SectionTitle
        eyebrow="DEMANDA BASADA EN REGISTROS"
        title="Primero el histórico, después la predicción."
        text="Analiza cantidades solicitadas por cliente e insumo a partir del historial de despachos. Es una proyección orientativa, no un consumo físico confirmado."
      />
      <SourceError s={s} keys={["points", "items", "dispatches", "critical"]} />
      <section className="card padded">
        <CardTitle
          title="Serie de solicitudes"
          sub="La fuente es el detalle de despachos, agregado por fecha programada en semanas cerradas."
        />
        <div className="form-grid">
          <label className="form-field">
            Cliente
            <select
              value={actualClient}
              onChange={(e) => {
                setClient(Number(e.target.value));
                setCoverage(false);
              }}
            >
              {s.points?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_cliente}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Insumo
            <select
              value={actualItem}
              onChange={(e) => {
                setItem(Number(e.target.value));
                setCoverage(false);
              }}
            >
              {s.items?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.unidad_medida})
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Horizonte
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {[1, 2, 4, 8, 12].map((w) => (
                <option key={w} value={w}>
                  {w} semanas
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={coverage}
            onChange={(e) => setCoverage(e.target.checked)}
          />
          Confirmo que hay registrados todos los pedidos del periodo:
          semanas sin registros equivalen a cero solicitudes.
        </label>
        <p className="live-note">
          No se usan datos sintéticos. La serie representa pedidos, incluidos
          los pendientes, no consumo físico ni ventas cobradas. No incorpora la
          semana actual incompleta.
        </p>
        {f.ready ? (
          <>
            <div className="forecast-metrics">
              <span>
                <small>Demanda solicitada estimada</small>
                <strong>
                  {number(f.total)} <em>{item?.unidad_medida}</em>
                </strong>
              </span>
              <span>
                <small>Error MAE en 4 semanas reservadas</small>
                <strong>{number(f.mae, 2)}</strong>
              </span>
              <span>
                <small>WAPE de validación</small>
                <strong>
                  {f.wape === null ? "Sin base" : `${number(f.wape)}%`}
                </strong>
              </span>
              <span>
                <small>Modelo seleccionado</small>
                <strong className="live-model-name">{f.method}</strong>
              </span>
            </div>
            <div
              className="live-bar-chart"
              aria-label="Histórico y proyección de solicitudes"
            >
              {[
                ...f.rows.slice(-16).map((r) => ({
                  label: r.week,
                  value: r.quantity,
                  forecast: false,
                })),
                ...f.values.map((v, i) => ({
                  label: `+${i + 1} sem.`,
                  value: v,
                  forecast: true,
                })),
              ].map((r, i) => (
                <div
                  className={r.forecast ? "forecast-bar" : ""}
                  key={i}
                  title={`${r.label}: ${r.value === null ? "Sin datos" : number(r.value)} ${item?.unidad_medida}`}
                >
                  <div
                    className="live-bar"
                    style={{
                      height: `${Math.max(2, ((r.value || 0) / max) * 140)}px`,
                    }}
                  />
                  <small>{r.label.slice(5)}</small>
                </div>
              ))}
            </div>
            <p className="hint">
              Verde: semanas históricas; azul: proyección local. Se compara el
              error de tres modelos sobre cuatro semanas reservadas y después se
              reajusta el elegido con todo el histórico.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MODELO</th>
                    <th>MAE</th>
                    <th>ELECCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {f.validation.map((v) => (
                    <tr key={v.method}>
                      <td>{v.method}</td>
                      <td>{number(v.mae, 3)}</td>
                      <td>
                        {v.method === f.method && (
                          <Badge tone="green">Menor error</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-actions">
              <button
                className="btn primary"
                onClick={() => open({ kind: "draft", itemId: actualItem })}
              >
                Preparar borrador de compra
              </button>
              <button
                className="btn secondary"
                onClick={async () => {
                  const { exportTables } = await import("../services/reports");
                  await exportTables(
                    [
                      {
                        title: "Proyección local de solicitudes",
                        columns: [
                          "Cliente",
                          "Insumo",
                          "Unidad",
                          "Semana futura",
                          "Cantidad",
                          "Modelo",
                          "MAE",
                        ],
                        rows: f.values.map((v, i) => [
                          point?.nombre_cliente || actualClient,
                          item?.nombre || actualItem,
                          item?.unidad_medida || "",
                          i + 1,
                          v,
                          f.method,
                          f.mae,
                        ]),
                        note: "Cálculo local sobre el historial de despachos; no representa consumo físico confirmado.",
                      },
                    ],
                    "xlsx",
                    "demanda-cliente",
                  );
                }}
              >
                Exportar proyección Excel
              </button>
            </div>
          </>
        ) : (
          <Empty
            title="Todavía no hay base suficiente para pronosticar"
            text={f.reason}
          />
        )}
        <p className="hint">
          La proyección no reserva stock. El saldo puede haber sido descontado
          al crear despachos; no se deduce otra vez la demanda pendiente.
        </p>
      </section>
      <section className="card padded">
        <CardTitle
          title={`Histórico consultado · ${point?.nombre_cliente || "Sin cliente"}`}
          sub={`${f.rows.length} semanas cerradas desde el primer pedido disponible.`}
        >
          <button className="text-button" onClick={() => setShow((v) => !v)}>
            {show ? "Ocultar" : "Ver datos"}
          </button>
        </CardTitle>
        {show && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SEMANA</th>
                  <th>SOLICITADO ({item?.unidad_medida})</th>
                  <th>DESPACHOS DE ORIGEN</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r) => (
                  <tr key={r.week}>
                    <td>{r.week}</td>
                    <td>
                      {r.quantity === null ? "Sin dato" : number(r.quantity)}
                    </td>
                    <td>
                      {r.dispatches.length
                        ? r.dispatches.map((id) => (
                            <button
                              className="text-button"
                              key={id}
                              onClick={() =>
                                open({ kind: "dispatch-detail", id })
                              }
                            >
                              #{id}{" "}
                            </button>
                          ))
                        : coverage
                          ? "Cero, por cobertura confirmada"
                          : "Sin registros"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!f.rows.length && (
              <p className="hint">
                Aún no hay solicitudes suficientes de esta
                serie en semanas cerradas.
              </p>
            )}
          </div>
        )}
      </section>
      <section className="card padded">
        <CardTitle
          title="Insumos críticos y puntos en riesgo"
          sub="Resultado de /api/insumos/criticos-y-proyeccion; es una alerta de abastecimiento, no un pronóstico estadístico."
        />
        {s.critical?.map((c) => (
          <div className="live-note warning" key={c.insumo.id}>
            <strong>
              {c.insumo.nombre}: déficit {c.stock_deficit}{" "}
              {c.insumo.unidad_medida}
            </strong>
            <p>{c.puntos_en_riesgo.length} puntos reportados en riesgo.</p>
            <pre className="live-json">
              {JSON.stringify(c.puntos_en_riesgo, null, 2)}
            </pre>
          </div>
        ))}
        {s.critical?.length === 0 && (
          <p>No hay insumos críticos reportados en este momento.</p>
        )}
      </section>
    </>
  );
}
