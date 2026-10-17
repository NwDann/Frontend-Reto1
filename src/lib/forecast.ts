import type { Snapshot } from "./models.ts";
export function weekKey(date: string | number, timezone = "America/Guayaquil") {
  const d = new Date(date);
  if (Number.isNaN(d.getTime()))
    throw Error("Fecha no válida para agregar demanda.");
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d),
    get = (k: string) => Number(parts.find((p) => p.type === k)!.value),
    local = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}
export const METHODS = [
  "Promedio ponderado",
  "Tendencia lineal",
  "Estacional de 4 semanas",
] as const;
export type Forecast = {
  rows: { week: string; quantity: number | null; dispatches: number[] }[];
  ready: boolean;
  reason: string;
  validation: { method: string; mae: number }[];
  method: string;
  values: number[];
  total: number;
  mae: number | null;
  wape: number | null;
  gaps: number;
};
export function predict(ys: number[], h: number, method: string) {
  if (!ys.length) return [];
  if (method === METHODS[0]) {
    const tail = ys.slice(-4),
      den = tail.reduce((a, _, i) => a + i + 1, 0),
      mean = tail.reduce((a, v, i) => a + v * (i + 1), 0) / den;
    return Array.from({ length: h }, () => mean);
  }
  if (method === METHODS[2])
    return Array.from({ length: h }, (_, i) =>
      Math.max(0, ys[ys.length - 4 + (i % 4)] ?? 0),
    );
  const n = ys.length,
    x = (n - 1) / 2,
    y = ys.reduce((a, b) => a + b, 0) / n,
    den = ys.reduce((a, _, i) => a + (i - x) ** 2, 0),
    b = den ? ys.reduce((a, v, i) => a + (i - x) * (v - y), 0) / den : 0;
  return Array.from({ length: h }, (_, i) => Math.max(0, y + b * (n + i - x)));
}
export function clientForecast(
  s: Snapshot,
  clientId: number,
  itemId: number,
  horizon = 4,
  completeCoverage = false,
  now = Date.now(),
  timezone = "America/Guayaquil",
): Forecast {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 12)
    throw Error("El horizonte debe estar entre 1 y 12 semanas.");
  const byWeek = new Map<string, { quantity: number; dispatches: number[] }>(),
    current = weekKey(now, timezone);
  for (const d of s.dispatches || []) {
    if (d.punto_servicio_id !== clientId || !d.fecha_programada) continue;
    const week = weekKey(d.fecha_programada, timezone);
    if (week >= current) continue;
    for (const line of d.detalles || [])
      if (line.insumo_id === itemId) {
        const row = byWeek.get(week) || { quantity: 0, dispatches: [] };
        row.quantity += line.cantidad_solicitada;
        if (!row.dispatches.includes(d.id)) row.dispatches.push(d.id);
        byWeek.set(week, row);
      }
  }
  const dates = [...byWeek.keys()].sort(),
    rows: Forecast["rows"] = [];
  if (dates.length) {
    let date = Date.parse(dates[0] + "T00:00:00Z");
    const end = Date.parse(current + "T00:00:00Z");
    if ((end - date) / 6048e5 > 260) date = end - 260 * 6048e5;
    for (; date < end; date += 6048e5) {
      const week = new Date(date).toISOString().slice(0, 10),
        actual = byWeek.get(week);
      rows.push({
        week,
        quantity: actual?.quantity ?? (completeCoverage ? 0 : null),
        dispatches: actual?.dispatches || [],
      });
    }
  }
  const gaps = rows.filter((r) => r.quantity === null).length,
    result: Forecast = {
      rows,
      ready: false,
      reason: !s.dispatches
        ? "No se pudo consultar el historial de despachos."
        : !rows.length
          ? "No hay semanas cerradas con solicitudes para esta serie."
          : gaps
            ? "Hay semanas sin datos. Confirma cobertura completa solo si esas semanas representan cero pedidos."
            : rows.length < 8
              ? "Se necesitan al menos 8 semanas cerradas y consecutivas."
              : "",
      validation: [],
      method: "",
      values: [],
      total: 0,
      mae: null,
      wape: null,
      gaps,
    };
  if (result.reason) return result;
  const ys = rows.map((r) => r.quantity!),
    train = ys.slice(0, -4),
    test = ys.slice(-4),
    validation = METHODS.map((method) => {
      const values = predict(train, 4, method);
      return {
        method,
        mae: values.reduce((sum, v, i) => sum + Math.abs(v - test[i]), 0) / 4,
      };
    }).sort((a, b) => a.mae - b.mae),
    chosen = validation[0],
    values = predict(ys, horizon, chosen.method),
    den = test.reduce((a, b) => a + Math.abs(b), 0);
  return {
    ...result,
    ready: true,
    validation,
    method: chosen.method,
    values,
    total: values.reduce((a, b) => a + b, 0),
    mae: chosen.mae,
    wape: den ? ((chosen.mae * 4) / den) * 100 : null,
  };
}
