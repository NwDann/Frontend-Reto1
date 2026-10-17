import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyAction,
  alerts,
  assistantAnswer,
  dateAfter,
} from "../src/lib/model.ts";
import {
  upgradeState,
  compareLogistics,
  defaultPlan,
} from "../src/lib/logistics.ts";
import {
  deriveOperationalInputs,
  vehicleTrips,
  vehicleChecks,
  eligibleEvaluations,
  financialSummary,
} from "../src/lib/enterprise.ts";
import { forecastClient } from "../src/lib/demand.ts";
const demo = () => upgradeState(initialState());
const operational = (s) => ({
  ...defaultPlan(s),
  registered: true,
  vehicleId: "VH-001",
  externalVehicleId: "VH-003",
  departure: dateAfter(0) + "T08:00",
  finishBy: dateAfter(0) + "T18:00",
  laborHours: 8,
  laborRate: 5,
  extraServiceCosts: 10,
});

test("schema enrichment preserves edits and is idempotent; real companies get no fabricated fleet or consumption", () => {
  const s = demo();
  s.enterprise.vehicles[0].fixedMonthly = 987;
  s.enterprise.contacts["PS-001"].contact.name = "Persona real";
  const once = structuredClone(s);
  assert.deepEqual(upgradeState(s), once);
  const real = upgradeState(initialState("real", "Empresa", false));
  assert.equal(real.points.length, 0);
  assert.equal(real.enterprise.vehicles.length, 0);
  assert.equal(real.enterprise.demand.length, 0);
  assert.equal(real.enterprise.trips.length, 0);
  assert.equal(financialSummary(real).inventoryStatus, "Sin parámetros");
});
test("vehicle and staff records override forged automatic inputs; finish time defines the actual available window", () => {
  const s = demo(),
    v = s.enterprise.vehicles[0];
  v.technicalUntil = dateAfter(-1);
  v.fixedMonthly = 777;
  const { inputs: p, derived: d } = deriveOperationalInputs(s, ["PS-001"], {
    ...operational(s),
    technicalValid: true,
    fixedMonthly: 0,
    tripsMonthly: 900,
    speed: 120,
  });
  assert.equal(p.technicalValid, false);
  assert.equal(p.fixedMonthly, 777);
  assert.equal(p.tripsMonthly, vehicleTrips(s, v.id).length + 1);
  assert.equal(p.deadlineMinutes, 600);
  assert.notEqual(p.speed, 120);
  assert.equal(d.labor, 40);
  assert.ok(
    compareLogistics(s, ["PS-001"], p)
      .find((c) => c.mode === "own")
      .warnings.includes("Revisión técnica no vigente."),
  );
  assert.throws(
    () =>
      deriveOperationalInputs(s, ["PS-001"], {
        ...operational(s),
        finishBy: dateAfter(0) + "T07:00",
      }),
    /posterior/,
  );
});
test("tolls follow destination and vehicle class; current tariff replaces a prior one without double counting", () => {
  let s = demo();
  s = applyAction(s, "toll.save", {
    zone: "Valle",
    vehicleType: "Furgoneta",
    fee: 3,
    source: "Operador confirmado",
    confirmedAt: dateAfter(0),
  });
  s = applyAction(s, "toll.save", {
    zone: "Valle",
    vehicleType: "Furgoneta",
    fee: 4,
    source: "Actualización operador",
    confirmedAt: dateAfter(0),
  });
  const a = deriveOperationalInputs(s, ["PS-004"], operational(s)),
    b = deriveOperationalInputs(s, ["PS-002"], operational(s));
  assert.equal(a.inputs.tolls, 8);
  assert.equal(b.inputs.tolls, 0);
  assert.equal(a.derived.tollsConfirmed, true);
  assert.equal(a.derived.externalTolls, 2);
});
test("service price uses materials, labor and transport rather than a user-entered sales estimate", () => {
  const s = demo(),
    ids = ["PS-005", "PS-006"],
    { inputs: p, derived: d } = deriveOperationalInputs(s, ids, {
      ...operational(s),
      serviceRevenue: 999999,
      otherServiceCosts: 0,
    });
  assert.ok(d.materials > 0);
  assert.equal(p.serviceRevenue, 0);
  assert.equal(p.otherServiceCosts, d.materials + 40 + 10);
  const c = compareLogistics(s, ids, p)[0];
  assert.ok(
    Math.abs(
      c.minimumServiceRevenue -
        (c.cost + p.otherServiceCosts) /
          (1 - s.enterprise.finance.targetMargin / 100),
    ) < 1e-9,
  );
});
test("external-only planning still detects chemical incompatibility", () => {
  const s = demo();
  s.enterprise.vehicles.find((v) => v.id === "VH-003").chemicalAllowed = false;
  s.dispatches.push({
    id: "GR-CHEM",
    point: "PS-002",
    fecha: dateAfter(0),
    estado: "Programada",
    lines: [{ insumo_id: "INS-001", cantidad: 1 }],
  });
  const { inputs } = deriveOperationalInputs(s, ["PS-002"], {
    ...operational(s),
    mode: "external",
  });
  assert.equal(inputs.cargoRisk, 2);
  const [c] = compareLogistics(s, ["PS-002"], inputs);
  assert.equal(c.feasible, false);
  assert.ok(c.warnings.some((w) => w.includes("química")));
});
test("a new item always starts at zero without a fictitious initial batch", () => {
  let s = demo();
  const p = {
    nombre: "Producto nuevo",
    categoria: "quimico",
    unidad_medida: "litro",
    stock_actual: 100,
    stock_minimo: 3,
    precio_unitario: 2,
    peso_unitario_kg: 1,
    volumen_unitario_m3: 0.001,
    vencimiento: dateAfter(30),
  };
  s = applyAction(s, "item.create", p);
  const i = s.items.at(-1);
  assert.equal(i.stock_actual, 0);
  assert.equal(i.vencimiento, "");
  assert.equal(
    s.enterprise.balances.find((b) => b.itemId === i.id).quantity,
    0,
  );
  assert.throws(() => applyAction(s, "item.create", p), /ya existe/);
});
test("partial purchase receipts use actual quantity, weighted cost, responsibility and discrepancy alerts; cannot repeat", () => {
  let s = demo(),
    po = s.purchases.find((p) => p.estado === "En camino"),
    item = s.items.find((i) => i.id === po.item);
  const before = item.stock_actual,
    price = item.precio_unitario;
  po.unitPrice = 50;
  const payload = {
    id: po.id,
    quantity: 20,
    expiry: dateAfter(180),
    receiver: "Ana",
    driver: "Luis",
    vehicle: "ABC-123",
    dispatcher: "Bodega proveedor",
    contact: "ana@example.com",
  };
  s = applyAction(s, "purchase.receive", payload);
  const next = s.items.find((i) => i.id === po.item);
  assert.equal(next.stock_actual, before + 20);
  assert.equal(
    next.precio_unitario,
    (before * price + 20 * 50) / (before + 20),
  );
  assert.equal(
    s.purchases.find((p) => p.id === po.id).responsibility.receiver,
    "Ana",
  );
  assert.ok(alerts(s).some((a) => a.id === `purchase-diff-${po.id}`));
  assert.throws(() => applyAction(s, "purchase.receive", payload), /en camino/);
});
test("transfers preserve global stock and block using stock held at other locations for a central dispatch", () => {
  let s = demo(),
    total = s.items[0].stock_actual;
  s = applyAction(s, "stock.transfer", {
    itemId: "INS-001",
    from: "warehouse",
    to: "PS-001",
    quantity: total,
    reference: "TR-01",
    receiver: "Ana",
  });
  assert.equal(s.items[0].stock_actual, total);
  assert.equal(
    s.enterprise.balances.find(
      (b) => b.itemId === "INS-001" && b.locationId === "PS-001",
    ).quantity,
    total,
  );
  s = applyAction(s, "dispatch.create", {
    point: "PS-002",
    fecha: dateAfter(0),
    lines: [{ insumo_id: "INS-001", cantidad: 1 }],
  });
  const d = s.dispatches[0],
    before = JSON.stringify(s);
  assert.throws(
    () =>
      applyAction(s, "dispatch.receive", {
        id: d.id,
        lines: [{ ...d.lines[0], recibido: 1 }],
      }),
    /bodega central/,
  );
  assert.equal(JSON.stringify(s), before);
});
test("evaluations must reference eligible closed operations and cannot duplicate a rating", () => {
  let s = demo();
  assert.ok(
    eligibleEvaluations(s, "PR-001").some((x) => x.id === "SC-DEMO-REC"),
  );
  const p = {
    id: "PR-001",
    referenceId: "SC-DEMO-REC",
    puntualidad: 4,
    calidad: 5,
    costo: 3,
    observacion: "Conforme",
  };
  s = applyAction(s, "supplier.evaluate", p);
  assert.equal(s.suppliers[0].evaluations[0].referenceId, p.referenceId);
  assert.throws(() => applyAction(s, "supplier.evaluate", p), /sin evaluar/);
  assert.throws(
    () => applyAction(s, "supplier.evaluate", { ...p, referenceId: "SC-0024" }),
    /sin evaluar/,
  );
});
test("client forecasts hold out four closed weeks, differentiate clients, and label synthetic data", () => {
  const s = demo(),
    a = forecastClient(s, "PS-001", "INS-001", 4),
    b = forecastClient(s, "PS-002", "INS-001", 4);
  assert.ok(a.ready && b.ready);
  assert.ok(a.synthetic);
  assert.notEqual(a.total, b.total);
  assert.equal(a.validation.length, 3);
  assert.ok(a.mae >= 0 && Number.isFinite(a.wape));
  const doubled = forecastClient(
    s,
    "PS-001",
    "INS-001",
    4,
    a.historicalVisits * 2,
  );
  assert.ok(Math.abs(doubled.total - a.total * 2) < 0.1);
  assert.equal(forecastClient(s, "PS-007", "INS-001", 4).ready, false);
});
test("real history replaces only the selected client-item series; validation cannot see reserved targets", () => {
  let s = demo();
  const oldOther = structuredClone(
    s.enterprise.demand.filter((r) => r.clientId === "PS-002"),
  );
  const start = new Date(dateAfter(-100)),
    rows = Array.from({ length: 12 }, (_, i) => ({
      clientId: "PS-001",
      itemId: "INS-001",
      week: new Date(start.getTime() + i * 7 * 864e5)
        .toISOString()
        .slice(0, 10),
      quantity: 10,
      visits: 2,
      area: 4800,
    }));
  s = applyAction(s, "demand.import", { rows });
  const f = forecastClient(s, "PS-001", "INS-001", 4, 2);
  assert.equal(f.synthetic, false);
  assert.equal(f.mae, 0);
  assert.equal(f.total, 40);
  assert.deepEqual(
    s.enterprise.demand.filter((r) => r.clientId === "PS-002"),
    oldOther,
  );
  const changed = structuredClone(s);
  changed.enterprise.demand
    .filter((r) => r.clientId === "PS-001" && r.itemId === "INS-001")
    .slice(-4)
    .forEach((r) => (r.quantity = 100));
  const high = forecastClient(changed, "PS-001", "INS-001", 4, 2);
  assert.equal(high.mae, 90);
  assert.throws(
    () => applyAction(s, "demand.import", { rows: [...rows, rows[0]] }),
    /duplicadas/,
  );
  assert.throws(
    () =>
      applyAction(s, "demand.import", {
        rows: rows.map((r) => ({ ...r, week: dateAfter(1) })),
      }),
    /cerradas/,
  );
});
test("a completed registered route creates one trip automatically and cannot count twice", () => {
  let s = demo(),
    ids = ["PS-002"],
    { inputs } = deriveOperationalInputs(s, ids, {
      ...operational(s),
      mode: "own",
    }),
    [c] = compareLogistics(s, ids, inputs),
    before = vehicleTrips(s, "VH-001").length;
  s = applyAction(s, "route.create", {
    points: ids,
    scenario: c.id,
    inputs: c.inputs,
    nombre: "Ruta de prueba",
    vehicle: "forged",
    date: inputs.departure.slice(0, 10),
  });
  const r = s.routes[0];
  assert.equal(r.vehicle, "PBA-2048");
  s = applyAction(s, "route.status", { id: r.id, estado: "En tránsito" });
  s = applyAction(s, "route.status", { id: r.id, estado: "Completada" });
  assert.equal(vehicleTrips(s, "VH-001").length, before + 1);
  assert.equal(s.enterprise.trips.filter((t) => t.routeId === r.id).length, 1);
  assert.throws(
    () => applyAction(s, "route.status", { id: r.id, estado: "Completada" }),
    /no permitido/,
  );
});
test("assistant answers purchases, fleet, client contacts, financial context and concrete guide discrepancies with sources", () => {
  const s = demo();
  for (const [q, expected] of [
    ["compras pendientes", "SC-0024"],
    ["vehículos y mantenimiento", "PBA-2048"],
    ["contacto del Hospital del Norte", "Hospital"],
    ["valor de inventario y presupuesto", "Inventario"],
    ["guías con diferencias", "GR-2026-0125"],
  ]) {
    const a = assistantAnswer(s, q);
    assert.ok(a.text.includes(expected), `${q}: ${a.text}`);
    assert.ok(a.sources.length > 0);
  }
  assert.ok(assistantAnswer(s, "hola").text.includes("Hola"));
});
test("saving an external comparison does not add tolls twice and completion counts the external vehicle", () => {
  let s = demo(),
    ids = ["PS-004"],
    { inputs } = deriveOperationalInputs(s, ids, {
      ...operational(s),
      mode: "both",
      externalExtras: 7,
    }),
    c = compareLogistics(s, ids, inputs).find((c) => c.mode === "external");
  s = applyAction(s, "route.create", {
    points: ids,
    scenario: c.id,
    inputs: c.inputs,
    nombre: "Externo valle",
    vehicle: "Operador",
    date: inputs.departure.slice(0, 10),
  });
  const r = s.routes[0];
  assert.equal(r.scenario.cost, c.cost);
  assert.equal(r.vehicle, "DEMO-EXT");
  // This destination has a legacy in-transit guide, not attached to the newly scheduled route.
  s = applyAction(s, "route.status", { id: r.id, estado: "En tránsito" });
  s = applyAction(s, "route.status", { id: r.id, estado: "Completada" });
  assert.equal(
    s.enterprise.trips.find((t) => t.routeId === r.id).vehicleId,
    "VH-003",
  );
});
test("expiry alerts require physical stock and central shortages recommend a transfer before purchasing again", () => {
  let s = demo();
  s.items.find((i) => i.id === "INS-007").stock_actual = 0;
  assert.ok(!alerts(s).some((a) => a.id === "expiry-INS-007"));
  s = applyAction(s, "stock.transfer", {
    itemId: "INS-005",
    from: "warehouse",
    to: "PS-002",
    quantity: 65,
    reference: "TR-CENTRAL",
    receiver: "Bodega del punto",
  });
  assert.ok(alerts(s).some((a) => a.id === "central-INS-005"));
});
