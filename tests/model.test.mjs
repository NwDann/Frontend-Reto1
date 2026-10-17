import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyAction,
  optimize,
  forecast,
  supplierScore,
  alerts,
  assistantAnswer,
  km,
  origin,
} from "../src/lib/model.ts";

test("a purchase adds stock once and records the receipt", () => {
  let s = initialState();
  const original = s.items[0].stock_actual;
  s = applyAction(s, "purchase.create", {
    item: "INS-001",
    cantidad: 12,
    supplier: "PR-001",
    prioridad: "Alta",
    motivo: "Prueba de recepción",
  });
  const id = s.purchases[0].id;
  for (const estado of ["Aprobada", "En camino", "Recibida"])
    s = applyAction(s, "purchase.status", { id, estado });
  assert.equal(s.items[0].stock_actual, original + 12);
  assert.equal(s.movements[0].referencia, id);
  assert.throws(
    () => applyAction(s, "purchase.status", { id, estado: "Recibida" }),
    /no está permitido/,
  );
  assert.equal(s.items[0].stock_actual, original + 12);
});
test("invalid transitions and negative quantities are rejected", () => {
  const s = initialState();
  assert.throws(() =>
    applyAction(s, "purchase.status", { id: "SC-0024", estado: "Recibida" }),
  );
  assert.throws(() =>
    applyAction(s, "purchase.create", {
      item: "INS-001",
      cantidad: -4,
      supplier: "PR-001",
      motivo: "Inválida",
    }),
  );
});
test("a partial delivery deducts the dispatched quantity and creates a discrepancy", () => {
  const s = initialState(),
    d = s.dispatches[3],
    before = s.items.find((i) => i.id === d.lines[0].insumo_id).stock_actual;
  const lines = d.lines.map((l, i) => ({
    ...l,
    recibido: l.cantidad - (i === 0 ? 2 : 0),
  }));
  const next = applyAction(s, "dispatch.receive", { id: d.id, lines });
  assert.equal(
    next.items.find((i) => i.id === d.lines[0].insumo_id).stock_actual,
    before - d.lines[0].cantidad,
  );
  assert.equal(next.dispatches[3].estado, "Entregada");
  assert.ok(alerts(next).some((a) => a.id === `diff-${d.id}`));
  assert.equal(s.dispatches[3].estado, "En tránsito");
  assert.throws(
    () => applyAction(next, "dispatch.receive", { id: d.id, lines }),
    /ya fue confirmada/,
  );
});
test("insufficient stock leaves the original state unchanged", () => {
  const s = initialState();
  s.items.find(
    (i) => i.id === s.dispatches[3].lines[1].insumo_id,
  ).stock_actual = 0;
  const before = JSON.stringify(s),
    d = s.dispatches[3];
  assert.throws(
    () =>
      applyAction(s, "dispatch.receive", {
        id: d.id,
        lines: d.lines.map((l) => ({ ...l, recibido: l.cantidad })),
      }),
    /Stock insuficiente/,
  );
  assert.equal(JSON.stringify(s), before);
});
test("a guide cannot repeat an item", () => {
  const s = initialState();
  assert.throws(
    () =>
      applyAction(s, "dispatch.create", {
        point: s.points[0].id,
        fecha: "2026-10-17",
        lines: [
          { insumo_id: "INS-001", cantidad: 1 },
          { insumo_id: "INS-001", cantidad: 1 },
        ],
      }),
    /No repitas/,
  );
});
test("route scenarios minimize their declared objectives", () => {
  const s = initialState(),
    points = s.points.slice(0, 3),
    ids = points.map((p) => p.id),
    scenarios = optimize(s, ids);
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const metrics = perms.map((order) => {
    let previous = origin,
      distance = 0,
      time = 0,
      waiting = 0;
    for (const index of order) {
      const p = points[index],
        distanceLeg = km(previous, p) * s.settings.roadFactor;
      distance += distanceLeg;
      time += (distanceLeg / s.settings.speed) * 60;
      waiting += time * (p.urgente ? 4 : 1);
      time += 12;
      previous = p;
    }
    const back = km(previous, origin) * s.settings.roadFactor;
    distance += back;
    time += (back / s.settings.speed) * 60;
    return {
      cost: 18 + distance * s.settings.costKm + (time / 60) * 5,
      waiting,
    };
  });
  assert.ok(
    Math.abs(scenarios[0].cost - Math.min(...metrics.map((m) => m.cost))) <
      1e-8,
  );
  assert.ok(
    Math.abs(scenarios[1].risk - Math.min(...metrics.map((m) => m.waiting))) <
      1e-8,
  );
  for (const c of scenarios) {
    assert.equal(c.order.length, 3);
    assert.equal(new Set(c.order).size, 3);
    assert.ok(c.feasible);
  }
});
test("route constraints and invalid point selections are enforced", () => {
  const s = initialState();
  s.settings.accredited = false;
  assert.ok(optimize(s, [s.points[0].id]).every((c) => !c.feasible));
  assert.throws(() => optimize(s, ["unknown"]));
  assert.throws(() => optimize(s, [s.points[0].id, s.points[0].id]));
  s.settings.capacity = 1;
  assert.ok(
    optimize(
      s,
      s.points.map((p) => p.id),
    ).every((c) => !c.feasible),
  );
});
test("a point at the warehouse yields finite scenario scores", () => {
  const s = initialState();
  s.points[0] = { ...s.points[0], ...origin };
  for (const c of optimize(s, [s.points[0].id]))
    assert.ok(Number.isFinite(c.score));
});
test("forecast extrapolates a trend and validates short histories", () => {
  const item = initialState().items[0];
  item.history = Array.from({ length: 12 }, (_, i) => i + 1);
  const f = forecast(item, 4);
  assert.deepEqual(f.values, [13, 14, 15, 16]);
  assert.equal(f.total, 58);
  assert.equal(f.mae, 0);
  item.history = [1, 2, 3, 4];
  assert.ok(Number.isFinite(forecast(item, 2).mae));
  item.history = [1, 2, 3];
  assert.equal(forecast(item, 4).values.length, 0);
  item.history = [0, 0, 0, 0];
  assert.equal(forecast(item, 4).total, 0);
});
test("supplier evaluation uses the documented weighting", () => {
  const p = initialState().suppliers[0];
  p.evaluations = [{ puntualidad: 5, calidad: 4, costo: 3 }];
  assert.ok(Math.abs(supplierScore(p) - 84) < 1e-8);
});
test("alerts cover scheduled shortages and separate recipients by profile", () => {
  let s = initialState();
  s = applyAction(s, "dispatch.create", {
    point: s.points[0].id,
    fecha: "2026-10-17",
    lines: [{ insumo_id: "INS-001", cantidad: 100 }],
  });
  assert.ok(alerts(s).some((a) => a.id === "demand-INS-001"));
  const expiry = alerts(s).find((a) => a.id === "expiry-INS-001");
  assert.ok(expiry.roles.includes("Bodega"));
  assert.ok(!expiry.roles.includes("Compras"));
});
test("new companies are empty, isolated and ready for input", () => {
  const a = initialState("a", "Empresa A", false),
    b = initialState("b", "Empresa B", false);
  assert.equal(a.items.length, 0);
  a.items.push(initialState().items[0]);
  assert.equal(b.items.length, 0);
  assert.equal(b.company.demo, false);
});
test("the assistant cites stored records and handles unknown queries", () => {
  const s = initialState();
  const answer = assistantAnswer(s, "¿Qué stock tiene el desinfectante?");
  assert.ok(answer.text.includes("42"));
  assert.ok(answer.sources.some((s) => s.includes("INS-001")));
  assert.match(assistantAnswer(s, "zzxyy999").text, /No encontré/);
});
