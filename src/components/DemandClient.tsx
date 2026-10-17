"use client";
import React, { useState } from "react";
import { Upload, Download, TrendingUp, ArrowUpRight } from "lucide-react";
import { State } from "@/lib/model";
import { forecastClient } from "@/lib/demand";
import { clientFor, kindLabel } from "@/lib/enterprise";
import {
  Open,
  SectionTitle,
  CardTitle,
  Badge,
  Empty,
  download,
  toCSV,
} from "./ui";
export default function Demand({ s, open }: { s: State; open: Open }) {
  const [clientId, setClient] = useState(
      s.points.find((p) => clientFor(s, p.id).kind === "service")?.id ||
        s.points[0]?.id ||
        "",
    ),
    [itemId, setItem] = useState(s.items[0]?.id || ""),
    [weeks, setWeeks] = useState(4),
    [visits, setVisits] = useState<number | undefined>(undefined),
    [showHistory, setShow] = useState(false);
  const item = s.items.find((i) => i.id === itemId),
    point = s.points.find((p) => p.id === clientId),
    f =
      point && item ? forecastClient(s, clientId, itemId, weeks, visits) : null;
  const incoming = s.purchases
    .filter(
      (p) => p.item === itemId && !["Recibida", "Rechazada"].includes(p.estado),
    )
    .reduce((a, p) => a + p.cantidad, 0);
  return (
    <>
      <SectionTitle
        eyebrow="PREDICCIÓN POR CLIENTE"
        title="Anticipa el consumo de cada servicio."
        text="Compara modelos con semanas reservadas para validación y ajusta la frecuencia futura del cliente."
      >
        <button
          className="btn secondary"
          onClick={() => open("demand-import", { clientId, itemId })}
        >
          <Upload size={15} />
          Cargar histórico por cliente
        </button>
      </SectionTitle>
      <section className="card padded">
        <CardTitle
          title="Cliente, insumo y horizonte"
          sub="Cada serie corresponde a un cliente y a una unidad de medida."
        />
        <div className="form-grid four-columns">
          <label className="form-field">
            Cliente
            <select
              value={clientId}
              onChange={(e) => {
                setClient(e.target.value);
                setVisits(undefined);
              }}
            >
              {s.points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_cliente} · {kindLabel(clientFor(s, p.id).kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Insumo
            <select value={itemId} onChange={(e) => setItem(e.target.value)}>
              {s.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.unidad_medida})
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Semanas a proyectar
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {[2, 4, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n} semanas
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Servicios semanales previstos
            <input
              type="number"
              min="0"
              max="14"
              step="1"
              value={visits ?? (point ? clientFor(s, clientId).frequency : 0)}
              onChange={(e) =>
                setVisits(Math.min(14, Math.max(0, Number(e.target.value))))
              }
            />
            <small>Reescala consumo según frecuencia histórica.</small>
          </label>
        </div>
      </section>
      {f && (
        <>
          <div className={`dataset-note ${f.synthetic ? "synthetic" : ""}`}>
            <Badge tone={f.synthetic ? "sand" : "blue"}>
              {f.synthetic
                ? "Datos sintéticos · demostración"
                : "Datos reales registrados"}
            </Badge>
            <p>
              {f.synthetic
                ? "Histórico generado para evaluar el flujo del concurso. No representa consumos reales ni demuestra precisión para la empresa."
                : "Usa el histórico importado para este cliente e insumo."}{" "}
              {f.rows.length} semanas registradas.
            </p>
          </div>
          {f.ready ? (
            <>
              <section className="card padded">
                <CardTitle
                  title={`${point?.nombre_cliente} · ${item?.nombre}`}
                  sub={`Cantidades en ${item?.unidad_medida}; modelo elegido: ${f.method}`}
                />
                <div className="forecast-metrics">
                  <span>
                    <small>Demanda del cliente</small>
                    <strong>
                      {f.total.toFixed(1)} <em>{item?.unidad_medida}</em>
                    </strong>
                  </span>
                  <span>
                    <small>Error en 4 semanas reservadas</small>
                    <strong>
                      {f.mae.toFixed(2)} <em>{item?.unidad_medida}/sem.</em>
                    </strong>
                  </span>
                  <span>
                    <small>Error relativo WAPE</small>
                    <strong>
                      {f.wape === null ? "Sin base" : f.wape.toFixed(1) + "%"}
                    </strong>
                  </span>
                  <span>
                    <small>Rango de sensibilidad</small>
                    <strong>
                      {f.low.toFixed(1)}–{f.high.toFixed(1)}
                    </strong>
                  </span>
                </div>
                <DemandChart
                  actual={f.rows.map((r) => r.quantity)}
                  predicted={f.values}
                  unit={f.unit}
                />
                <p className="hint">
                  Línea sólida: historial. Línea punteada: futuro. Rango
                  orientativo = proyección ± error absoluto medio × semanas ×
                  ajuste de frecuencia; no es un intervalo probabilístico.
                </p>
              </section>
              <div className="two-col">
                <section className="card padded">
                  <CardTitle
                    title="Validación y elección del modelo"
                    sub="Los últimos 4 datos no se usan al ajustar cada modelo durante la validación."
                  />
                  <table>
                    <thead>
                      <tr>
                        <th>MODELO</th>
                        <th>ERROR ABSOLUTO</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {f.validation.map((v) => (
                        <tr key={v.method}>
                          <td>{v.method}</td>
                          <td>
                            {v.mae.toFixed(2)} {f.unit}/sem.
                          </td>
                          <td>
                            {v.method === f.method && (
                              <Badge tone="green">Menor error</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="hint">
                    Después de elegir, se reajusta el modelo con todo el
                    histórico. La frecuencia pasa de{" "}
                    {f.historicalVisits.toFixed(1)} a {f.plannedVisits}{" "}
                    servicios/semana. No incorpora clima, contratos no
                    registrados ni eventos extraordinarios.
                  </p>
                </section>
                <section className="card padded">
                  <CardTitle title="Cómo usar la proyección para comprar" />
                  <p>
                    Este cliente requeriría{" "}
                    <strong>
                      {f.total.toFixed(1)} {f.unit}
                    </strong>{" "}
                    en {weeks} semanas.
                  </p>
                  <div className="derived-box">
                    <span>
                      Stock de toda la empresa
                      <strong>
                        {item?.stock_actual} {f.unit}
                      </strong>
                    </span>
                    <span>
                      Compras abiertas
                      <strong>
                        {incoming} {f.unit}
                      </strong>
                    </span>
                  </div>
                  <p className="hint">
                    El stock es compartido con otros clientes. Esta vista no lo
                    reserva ni lo asigna automáticamente. Consolida clientes,
                    guías y plazos de entrega antes de aprobar una compra.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() =>
                      open("purchase", {
                        item: itemId,
                        cantidad: Math.max(1, Math.ceil(f.total)),
                      })
                    }
                  >
                    Preparar solicitud con esta cantidad{" "}
                    <ArrowUpRight size={14} />
                  </button>
                </section>
              </div>
            </>
          ) : (
            <Empty
              title={
                f.gaps
                  ? "El histórico tiene semanas faltantes"
                  : "Faltan datos para una predicción por cliente"
              }
              text="Carga al menos 8 semanas consecutivas cerradas para comparar y validar los tres modelos. Un cliente futuro sin histórico no recibe una predicción fabricada."
            />
          )}
          <section className="card padded">
            <CardTitle title="Histórico y datos de entrada">
              <button
                className="text-button"
                onClick={() => setShow((v) => !v)}
              >
                {showHistory ? "Ocultar" : "Ver datos"}
              </button>
              <button
                className="btn secondary small"
                onClick={() => download("historico-cliente.csv", toCSV(f.rows))}
              >
                <Download size={14} />
                Exportar
              </button>
            </CardTitle>
            {showHistory && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SEMANA</th>
                      <th>CONSUMO ({f.unit})</th>
                      <th>SERVICIOS</th>
                      <th>ÁREA</th>
                      <th>ORIGEN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rows.map((r) => (
                      <tr key={r.week}>
                        <td>{r.week}</td>
                        <td>{r.quantity}</td>
                        <td>{r.visits}</td>
                        <td>{r.area} m²</td>
                        <td>
                          {r.source === "synthetic"
                            ? "Sintético"
                            : "Real importado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
function DemandChart({
  actual,
  predicted,
  unit,
}: {
  actual: number[];
  predicted: number[];
  unit: string;
}) {
  const all = [...actual, ...predicted],
    max = Math.max(1, ...all) * 1.15,
    x = (i: number) => 50 + (i / (all.length - 1)) * 900,
    y = (v: number) => 220 - (v / max) * 185,
    line = (a: number[], start = 0) =>
      a.map((v, i) => `${i ? "L" : "M"}${x(i + start)},${y(v)}`).join(" ");
  return (
    <div className="forecast-chart">
      <svg
        viewBox="0 0 1000 260"
        role="img"
        aria-label={`Consumo histórico y pronóstico en ${unit}`}
      >
        <rect
          x={x(actual.length - 1)}
          y="20"
          width={950 - x(actual.length - 1)}
          height="200"
          fill="#e7f3f0"
        />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <path
              d={`M50 ${y(t * max)}H950`}
              stroke="#cbd5df"
              strokeDasharray="3 4"
            />
            <text
              x="40"
              y={y(t * max) + 4}
              textAnchor="end"
              fill="#475569"
              fontSize="12"
            >
              {(t * max).toFixed(0)}
            </text>
          </g>
        ))}
        <path d={line(actual)} fill="none" stroke="#0f766e" strokeWidth="3" />
        <path
          d={line([actual[actual.length - 1], ...predicted], actual.length - 1)}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3"
          strokeDasharray="7 5"
        />
        {all.map((v, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(v)}
              r="3"
              fill={i < actual.length ? "#0f766e" : "white"}
              stroke="#0f766e"
            />
            <title>
              Semana {i + 1}: {v.toFixed(2)} {unit}
            </title>
            {i % 4 === 0 && (
              <text
                x={x(i)}
                y="245"
                textAnchor="middle"
                fill="#475569"
                fontSize="12"
              >
                Sem {i + 1}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
