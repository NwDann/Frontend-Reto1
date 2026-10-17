import test from "node:test";
import assert from "node:assert/strict";
import { snapshot } from "./fixtures.mjs";
import { clientForecast, weekKey } from "../src/lib/forecast.ts";
import { answerRecords } from "../src/lib/assistant.ts";
import { inventoryValue, operationalAlerts } from "../src/lib/insights.ts";
function history() {
  const s = snapshot();
  s.dispatches = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    ruta_id: 1,
    punto_servicio_id: 1,
    estado_produccion: "Normal",
    fecha_programada: new Date(
      Date.parse("2026-07-20T13:00:00Z") + i * 6048e5,
    ).toISOString(),
    fecha_entrega_real: null,
    costo_envio: 1,
    detalles: [
      {
        id: i + 1,
        insumo_id: 1,
        cantidad_solicitada: 10 + i,
        es_promocion: false,
      },
    ],
  }));
  return s;
}
test("Sparse real backend history never creates an invented forecast", () => {
  const f = clientForecast(
    snapshot(),
    1,
    1,
    4,
    false,
    Date.parse("2026-10-17T12:00:00Z"),
  );
  assert.equal(f.ready, false);
  assert.equal(f.values.length, 0);
});
test("Three models reserve the last four closed weeks and forecast the selected client only", () => {
  const s = history(),
    f = clientForecast(s, 1, 1, 4, false, Date.parse("2026-10-17T12:00:00Z"));
  assert.equal(f.ready, true);
  assert.equal(f.validation.length, 3);
  assert.equal(f.values.length, 4);
  assert.equal(f.method, "Tendencia lineal");
  assert.ok(f.mae < 1e-9);
  assert.deepEqual(
    f.values.map((v) => Math.round(v)),
    [22, 23, 24, 25],
  );
  assert.equal(
    clientForecast(s, 2, 1, 4, false, Date.parse("2026-10-17T12:00:00Z")).ready,
    false,
  );
});
test("Missing weeks require explicit complete-coverage confirmation and current-week orders are excluded", () => {
  const s = history();
  s.dispatches.splice(4, 1);
  s.dispatches.push({
    ...s.dispatches[0],
    id: 99,
    fecha_programada: "2026-10-16T13:00:00Z",
    detalles: [
      { id: 99, insumo_id: 1, cantidad_solicitada: 9999, es_promocion: false },
    ],
  });
  const no = clientForecast(
      s,
      1,
      1,
      4,
      false,
      Date.parse("2026-10-17T12:00:00Z"),
    ),
    yes = clientForecast(s, 1, 1, 4, true, Date.parse("2026-10-17T12:00:00Z"));
  assert.equal(no.ready, false);
  assert.equal(no.gaps, 1);
  assert.equal(yes.ready, true);
  assert.equal(yes.rows.filter((r) => r.quantity === 0).length, 1);
  assert.ok(yes.rows.every((r) => r.quantity !== 9999));
});
test("The holdout is not used to train candidate models during validation", () => {
  const s = history();
  s.dispatches.at(-1).detalles[0].cantidad_solicitada = 999;
  const f = clientForecast(
    s,
    1,
    1,
    4,
    false,
    Date.parse("2026-10-17T12:00:00Z"),
  );
  assert.ok(f.validation.every((v) => v.mae > 100));
});
test("Week aggregation uses Ecuador local time and assistant cites actual record IDs", () => {
  assert.equal(weekKey("2026-10-19T02:00:00Z"), "2026-10-12");
  const s = snapshot(),
    a = answerRecords(s, "¿Qué insumos tienen stock bajo?");
  assert.match(a.text, /12 caneca/);
  assert.deepEqual(a.sources[0], {
    label: "Insumo #1",
    resource: "insumos",
    id: 1,
  });
  assert.match(
    answerRecords(s, "¿Cuáles son los indicadores de mermas?").text,
    /proxy/,
  );
  assert.match(
    answerRecords(s, "¿Cuáles son los proveedores?").text,
    /no se expone/,
  );
  assert.equal(inventoryValue({ errors: {}, loadedAt: {} }), null);
  assert.ok(operationalAlerts(s).some((a) => a.id === "stock-1"));
});
