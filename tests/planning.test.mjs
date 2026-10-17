import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePlan,
  coordKey,
  validateMatrix,
} from "../src/lib/planning.ts";
import { snapshot, preferences, planningInputs } from "./fixtures.mjs";
function fixture() {
  const s = snapshot(),
    origin = preferences.origin,
    points = s.points.map((p) => ({ lat: p.latitud, lng: p.longitud })),
    matrix = {
      keys: [origin, ...points].map(coordKey),
      distances: [
        [0, 10000, 25000],
        [10000, 0, 10000],
        [25000, 10000, 0],
      ],
      durations: [
        [0, 600, 1800],
        [600, 0, 1200],
        [1800, 1200, 0],
      ],
      source: "Matriz de prueba",
      fetchedAt: "2026-10-17T00:00:00Z",
    };
  return { s, origin, matrix };
}
test("Route load comes from exact selected dispatch lines, without changing inventory", () => {
  const { s, origin, matrix } = fixture(),
    stock = s.items[0].stock_actual,
    result = calculatePlan(s, origin, [1, 2], [1], planningInputs, matrix, 1);
  assert.equal(result.loadKg, 20);
  assert.equal(result.loadM3, 0.04);
  assert.equal(result.merchandiseValue, 30);
  assert.equal(s.items[0].stock_actual, stock);
  assert.equal(result.scenarios[0].distanceKm, 45);
  assert.equal(result.scenarios[0].speed, (45 / 60) * 60);
});
test("External per-km and fixed rates are mutually exclusive and included tolls are not counted twice", () => {
  const { s, origin, matrix } = fixture();
  let result = calculatePlan(
    s,
    origin,
    [1, 2],
    [1],
    {
      ...planningInputs,
      ownEnabled: false,
      externalMode: "fixed",
      externalRate: 60,
      externalExtras: 5,
      externalTollsIncluded: true,
    },
    matrix,
    1,
  );
  assert.equal(result.scenarios[0].transportCost, 65);
  result = calculatePlan(
    s,
    origin,
    [1, 2],
    [1],
    {
      ...planningInputs,
      ownEnabled: false,
      externalMode: "km",
      externalRate: 2,
      externalExtras: 5,
    },
    matrix,
    1,
  );
  assert.equal(result.scenarios[0].transportCost, 99);
});
test("Price uses transport, recorded materials, declared service costs and margin on sales", () => {
  const { s, origin, matrix } = fixture(),
    r = calculatePlan(s, origin, [1, 2], [1], planningInputs, matrix, 1)
      .scenarios[0];
  assert.equal(r.serviceCost, r.transportCost + 30 + 40);
  assert.equal(r.suggestedPrice, r.serviceCost / 0.8);
});
test("A matrix for another origin is rejected and constraints mark over-capacity or missing accreditation", () => {
  const { s, origin, matrix } = fixture();
  assert.throws(
    () =>
      validateMatrix({ ...matrix, keys: ["x", ...matrix.keys.slice(1)] }, [
        origin,
        ...s.points.map((p) => ({ lat: p.latitud, lng: p.longitud })),
      ]),
    /no corresponde/,
  );
  s.routes[0].capacidad_peso_max_kg = 10;
  s.staff[0].acreditado = false;
  const r = calculatePlan(s, origin, [1, 2], [1], planningInputs, matrix, 1);
  assert.equal(r.scenarios[0].feasible, false);
  assert.ok(r.scenarios[0].warnings.some((w) => w.includes("acreditado")));
});
test("The independent origin changes distance and remains independent from API points", () => {
  const { s, origin } = fixture(),
    before = JSON.stringify(s.points),
    a = calculatePlan(s, origin, [1], [1], planningInputs),
    b = calculatePlan(
      s,
      { lat: -0.5, lng: -78.8, name: "Otro origen" },
      [1],
      [1],
      planningInputs,
    );
  assert.notEqual(a.scenarios[0].distanceKm, b.scenarios[0].distanceKm);
  assert.equal(JSON.stringify(s.points), before);
  assert.match(a.matrixSource, /Aproximación/);
});
test("Zero quotes and delivered dispatches cannot create a misleading recommendation", () => {
  const { s, origin } = fixture();
  assert.throws(
    () =>
      calculatePlan(s, origin, [1], [1], {
        ...planningInputs,
        externalRate: 0,
      }),
    /tarifa externa/,
  );
  s.dispatches[0].fecha_entrega_real = "2026-10-17T12:00:00Z";
  assert.throws(
    () => calculatePlan(s, origin, [1], [1], planningInputs),
    /pendientes/,
  );
});
