import type { State } from "./model.ts";
import { clientFor } from "./enterprise.ts";
const mean = (a: number[]) =>
  a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
function predict(ys: number[], h: number, method: string) {
  if (method === "Promedio móvil ponderado") {
    const tail = ys.slice(-4),
      den = tail.reduce((a, _, i) => a + i + 1, 0),
      v = tail.reduce((a, y, i) => a + y * (i + 1), 0) / den;
    return Array.from({ length: h }, () => v);
  }
  if (method === "Estacional de 4 semanas")
    return Array.from(
      { length: h },
      (_, i) => ys[ys.length - 4 + (i % 4)] || 0,
    );
  const n = ys.length,
    x = (n - 1) / 2,
    y = mean(ys),
    den = ys.reduce((a, _, i) => a + (i - x) ** 2, 0),
    b = den ? ys.reduce((a, v, i) => a + (i - x) * (v - y), 0) / den : 0;
  return Array.from({ length: h }, (_, i) => Math.max(0, y + b * (n + i - x)));
}
export function forecastClient(
  s: State,
  clientId: string,
  itemId: string,
  horizon = 4,
  plannedVisits?: number,
) {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 12)
    throw Error("El horizonte debe estar entre 1 y 12 semanas.");
  const rows = (s.enterprise?.demand || [])
    .filter((r) => r.clientId === clientId && r.itemId === itemId)
    .sort((a, b) => a.week.localeCompare(b.week));
  const client = clientFor(s, clientId),
    item = s.items.find((i) => i.id === itemId),
    point = s.points.find((p) => p.id === clientId);
  if (!item || !point) throw Error("Selecciona un cliente y un insumo.");
  if (rows.length < 8)
    return {
      ready: false,
      rows,
      values: [] as number[],
      total: 0,
      low: 0,
      high: 0,
      mae: 0,
      wape: null,
      method: "Se requieren 8 semanas cerradas para comparar modelos.",
      validation: [] as { method: string; mae: number }[],
      synthetic: rows.some((r) => r.source === "synthetic"),
      historicalVisits: 0,
      plannedVisits: plannedVisits ?? client.frequency,
      unit: item.unidad_medida,
      gaps: false,
    };
  const ys = rows.map((r) => r.quantity),
    train = ys.slice(0, -4),
    test = ys.slice(-4),
    methods = [
      "Promedio móvil ponderado",
      "Tendencia lineal",
      "Estacional de 4 semanas",
    ],
    validation = methods
      .map((method) => ({
        method,
        mae: mean(
          predict(train, 4, method).map((y, i) => Math.abs(y - test[i])),
        ),
      }))
      .sort((a, b) => a.mae - b.mae),
    winner = validation[0],
    historicalVisits = mean(rows.slice(-4).map((r) => r.visits)),
    visits = plannedVisits ?? client.frequency,
    factor = historicalVisits > 0 ? visits / historicalVisits : 1;
  const values = predict(ys, horizon, winner.method).map(
      (y) => Math.round(Math.max(0, y * factor) * 100) / 100,
    ),
    total = values.reduce((a, b) => a + b, 0),
    error = winner.mae * horizon * Math.abs(factor),
    testTotal = test.reduce((a, b) => a + b, 0),
    gaps = rows.some(
      (r, i) =>
        i > 0 &&
        Math.abs(
          (new Date(r.week).getTime() - new Date(rows[i - 1].week).getTime()) /
            864e5 -
            7,
        ) > 0.1,
    );
  return {
    ready: !gaps,
    rows,
    values,
    total,
    low: Math.max(0, total - error),
    high: total + error,
    mae: winner.mae,
    wape: testTotal ? ((winner.mae * 4) / testTotal) * 100 : null,
    method: winner.method,
    validation,
    synthetic: rows.some((r) => r.source === "synthetic"),
    historicalVisits,
    plannedVisits: visits,
    unit: item.unidad_medida,
    gaps,
  };
}
export function companyDemand(s: State, itemId: string, horizon = 4) {
  return s.points.reduce((a, p) => {
    const f = forecastClient(s, p.id, itemId, horizon);
    return a + (f.ready ? f.total : 0);
  }, 0);
}
