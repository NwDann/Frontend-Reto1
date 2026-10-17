import test from "node:test";
import assert from "node:assert/strict";
import { initialState, applyAction } from "../src/lib/model.ts";
import {
  defaultPlan,
  compareLogistics,
  upgradeState,
  offersFor,
  warehouseFor,
  coordinateKey,
} from "../src/lib/logistics.ts";
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function matrix(s, ids, distances, durations) {
  return {
    source: "OSRM",
    ids: ["warehouse", ...ids],
    coordinates: coordinateKey([
      warehouseFor(s),
      ...ids.map((id) => s.points.find((p) => p.id === id)),
    ]),
    distances,
    durations,
    fetchedAt: new Date().toISOString(),
  };
}
test("4ROPOA planning formulas reconcile to the workbook example", () => {
  const s = initialState(),
    ids = [s.points[1].id],
    p = {
      ...defaultPlan(s),
      mode: "own",
      fuelPrice: 3.2,
      kmPerGallon: 10,
      driverCost: 20,
      driverHourly: 0,
      food: 15,
      tolls: 15,
      other: 5,
      maintenanceKm: 0,
      fixedMonthly: 0,
      insuranceTrip: 0,
      serviceRevenue: 350,
      otherServiceCosts: 0,
      serviceMinutes: 0,
      breakMinutes: 120,
    };
  const m = matrix(
      s,
      ids,
      [
        [0, 270000],
        [270000, 0],
      ],
      [
        [0, (270 / 35) * 3600],
        [(270 / 35) * 3600, 0],
      ],
    ),
    [c] = compareLogistics(s, ids, p, m);
  approx(c.distance, 540);
  approx(c.fuelGallons, 54);
  approx(c.cost, 227.8);
  approx(c.netContribution, 122.2);
  approx(c.margin, 34.91428571428571);
  approx(c.co2, 551.34);
  approx(c.minimumServiceRevenue, 284.75);
  approx(c.costKm, 227.8 / 540);
});
test("external quote avoids double-counting internal fuel, drivers and tolls", () => {
  const s = initialState(),
    ids = [s.points[1].id],
    p = {
      ...defaultPlan(s),
      mode: "external",
      externalFee: 70,
      externalKm: 0,
      externalStop: 0,
      externalExtras: 5,
      fuelPrice: 99,
      tolls: 999,
      driverCost: 999,
    };
  const [c] = compareLogistics(s, ids, p);
  assert.equal(c.cost, 75);
  assert.equal(c.fuelGallons, null);
  assert.equal(c.co2, null);
  assert.equal(c.margin, null);
});
test("changing fuel price changes own costs and not the external quote", () => {
  const s = initialState(),
    ids = [s.points[1].id],
    p = defaultPlan(s),
    a = compareLogistics(s, ids, p),
    b = compareLogistics(s, ids, { ...p, fuelPrice: p.fuelPrice * 2 });
  const own = a.find((x) => x.mode === "own"),
    own2 = b.find((x) => x.mode === "own");
  approx(own2.cost - own.cost, own.fuelGallons * p.fuelPrice);
  approx(
    a.find((x) => x.mode === "external").cost,
    b.find((x) => x.mode === "external").cost,
  );
});
test("weight, documents and chemical requirements affect eligibility", () => {
  const s = initialState(),
    ids = [s.points[0].id],
    p = {
      ...defaultPlan(s),
      loadKg: 2000,
      capacityKg: 100,
      externalCapacityKg: 100,
      cargoRisk: 4,
      cargoAllowed: false,
      externalInsurance: false,
    };
  const result = compareLogistics(s, ids, p);
  assert.ok(result.every((c) => !c.feasible));
  assert.ok(
    result
      .find((c) => c.mode === "own")
      .warnings.some((w) => w.includes("química")),
  );
  assert.ok(
    result
      .find((c) => c.mode === "external")
      .warnings.some((w) => w.includes("seguro")),
  );
});
test("partial or mismatched road matrices are rejected", () => {
  const s = initialState(),
    ids = [s.points[1].id],
    p = defaultPlan(s),
    m = matrix(
      s,
      ids,
      [
        [0, null],
        [1, 0],
      ],
      [
        [0, 1],
        [1, 0],
      ],
    );
  assert.throws(() => compareLogistics(s, ids, p, m), /incompleta/);
  m.distances = [
    [0, 10],
    [10, 0],
  ];
  m.coordinates = "wrong";
  assert.throws(() => compareLogistics(s, ids, p, m), /ubicaciones/);
});
test("warehouse and destination edits persist without losing prior records", () => {
  let s = initialState();
  const purchases = s.purchases.length;
  s = applyAction(s, "warehouse.update", {
    nombre_cliente: "Bodega Sur",
    direccion: "Quito sur",
    latitud: -0.28,
    longitud: -78.53,
  });
  assert.equal(warehouseFor(s).nombre_cliente, "Bodega Sur");
  s = applyAction(s, "point.update", { ...s.points[0], latitud: -0.29 });
  assert.equal(s.points[0].latitud, -0.29);
  assert.equal(s.purchases.length, purchases);
});
test("old workspaces gain catalogs from historical purchases and demo references", () => {
  const s = upgradeState(initialState());
  assert.ok(offersFor(s, "INS-001").some((o) => o.supplier.id === "PR-001"));
  assert.ok(offersFor(s, "INS-003").some((o) => o.supplier.id === "PR-003"));
  assert.ok(s.warehouse);
  assert.ok(s.logistics);
});
test("supplier catalog prices, minimums and associations govern new purchases", () => {
  let s = initialState();
  s = applyAction(s, "supplier.catalog", {
    id: "PR-001",
    products: [{ itemId: "INS-001", price: 13.5, lead: 2, minOrder: 10 }],
  });
  assert.throws(
    () =>
      applyAction(s, "purchase.create", {
        item: "INS-001",
        supplier: "PR-001",
        cantidad: 5,
        motivo: "Reposición",
      }),
    /mínimo/,
  );
  s = applyAction(s, "purchase.create", {
    item: "INS-001",
    supplier: "PR-001",
    cantidad: 10,
    motivo: "Reposición",
  });
  assert.equal(s.purchases[0].unitPrice, 13.5);
  assert.throws(
    () =>
      applyAction(s, "purchase.create", {
        item: "INS-002",
        supplier: "PR-001",
        cantidad: 10,
        motivo: "Reposición",
      }),
    /no tiene registrado/,
  );
});
test("saved scenarios keep the full assumptions and warehouse used", () => {
  let s = initialState();
  const ids = [s.points[1].id],
    p = { ...defaultPlan(s), deadlineMinutes: 1000 },
    c = compareLogistics(s, ids, p)[0];
  s = applyAction(s, "route.create", {
    points: ids,
    scenario: c.id,
    inputs: p,
    nombre: "Circuito prueba",
    vehicle: "Unidad 1",
    date: "2026-10-17",
  });
  assert.ok(s.routes[0].scenario.inputs);
  assert.ok(s.routes[0].scenario.warehouse);
  approx(s.routes[0].scenario.cost, c.cost);
});
test("unsupported or invalid numeric assumptions remain visible errors", () => {
  const s = initialState(),
    ids = [s.points[1].id];
  for (const delta of [
    { kmPerGallon: 0 },
    { tripsMonthly: 0 },
    { targetMargin: 100 },
    { vehicles: 1.5 },
    { externalOTD: 101 },
  ])
    assert.throws(() =>
      compareLogistics(s, ids, { ...defaultPlan(s), ...delta }),
    );
});
