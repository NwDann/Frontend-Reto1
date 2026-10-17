import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  applyAction,
  dateAfter,
  money,
  optimize,
} from "../src/lib/model.ts";
import {
  upgradeState,
  defaultPlan,
  compareLogistics,
  coordinateKey,
  warehouseFor,
} from "../src/lib/logistics.ts";
import { deriveOperationalInputs } from "../src/lib/enterprise.ts";
import { LOCATION_TYPES, movementGeography } from "../src/lib/locations.ts";
import {
  containedQuantity,
  packagingLabel,
  normalizePackaging,
} from "../src/lib/units.ts";
const state = () => upgradeState(initialState());
const inputs = (s) => ({
  ...defaultPlan(s),
  registered: true,
  vehicleId: "VH-001",
  externalVehicleId: "VH-003",
  departure: dateAfter(0) + "T08:00",
  finishBy: dateAfter(0) + "T18:00",
  laborHours: 8,
  laborRate: 5,
  extraServiceCosts: 5,
});
function road(s, ids, start, leg = 10000) {
  return {
    ids: ["warehouse", ...ids],
    coordinates: coordinateKey([
      start,
      ...ids.map((id) => s.points.find((p) => p.id === id)),
    ]),
    distances: [
      [0, leg],
      [leg, 0],
    ],
    durations: [
      [0, 1200],
      [1200, 0],
    ],
    source: "OSRM",
    fetchedAt: new Date().toISOString(),
  };
}

test("an independent origin changes the route, keeps company locations intact, and is preserved in the saved snapshot", () => {
  let s = state(),
    beforeLocations = JSON.stringify([s.warehouse, s.points]),
    origin = {
      nombre_cliente: "Salida independiente",
      direccion: "Punto temporal",
      latitud: -0.21,
      longitud: -78.497,
    },
    ids = ["PS-005"];
  const a = deriveOperationalInputs(s, ids, { ...inputs(s), mode: "own" }),
    b = deriveOperationalInputs(s, ids, { ...inputs(s), mode: "own", origin }),
    normal = compareLogistics(s, ids, a.inputs)[0],
    custom = compareLogistics(s, ids, b.inputs)[0];
  assert.notEqual(normal.distance, custom.distance);
  assert.equal(JSON.stringify([s.warehouse, s.points]), beforeLocations);
  s = applyAction(s, "route.create", {
    points: ids,
    scenario: custom.id,
    inputs: custom.inputs,
    nombre: "Origen alternativo",
    vehicle: "fixture",
    date: dateAfter(0),
  });
  assert.deepEqual(s.routes[0].snapshot.origin, origin);
  assert.deepEqual(s.routes[0].scenario.inputs.origin, origin);
  assert.equal(JSON.stringify([s.warehouse, s.points]), beforeLocations);
});
test("the road matrix must belong to the selected custom origin, including the return leg", () => {
  const s = state(),
    ids = ["PS-002"],
    origin = {
      ...warehouseFor(s),
      nombre_cliente: "Origen temporal",
      latitud: -0.25,
    },
    p = { ...defaultPlan(s), mode: "own", origin, serviceMinutes: 0 },
    m = road(s, ids, origin);
  const [back] = compareLogistics(s, ids, p, m),
    [oneWay] = compareLogistics(s, ids, { ...p, returnToWarehouse: false }, m);
  assert.equal(back.distance, 20);
  assert.equal(oneWay.distance, 10);
  assert.throws(
    () => compareLogistics(s, ids, p, road(s, ids, warehouseFor(s))),
    /ubicaciones/,
  );
  assert.throws(
    () =>
      compareLogistics(s, ids, { ...p, origin: { ...origin, latitud: 91 } }),
    /rango/,
  );
});
test("external km and fixed-trip quotes are mutually exclusive; included tolls and repeated calculation do not double count", () => {
  const s = state(),
    ids = ["PS-004"],
    origin = warehouseFor(s),
    m = road(s, ids, origin),
    base = {
      ...inputs(s),
      mode: "external",
      externalExtras: 7,
      externalKm: 2,
      externalFee: 85,
    };
  const km = deriveOperationalInputs(s, ids, {
      ...base,
      externalRateMode: "km",
    }),
    fixed = deriveOperationalInputs(s, ids, {
      ...base,
      externalRateMode: "fixed",
    }),
    included = deriveOperationalInputs(s, ids, {
      ...base,
      externalRateMode: "fixed",
      externalTollsIncluded: true,
    });
  assert.equal(km.inputs.externalFee, 0);
  assert.equal(fixed.inputs.externalKm, 0);
  const [a] = compareLogistics(s, ids, km.inputs, m),
    [b] = compareLogistics(s, ids, fixed.inputs, m),
    [c] = compareLogistics(s, ids, included.inputs, m);
  assert.equal(a.cost, 20 * 2 + 7 + 2);
  assert.equal(b.cost, 85 + 7 + 2);
  assert.equal(c.cost, 85 + 7);
  assert.equal(
    compareLogistics(s, ids, fixed.inputs, road(s, ids, origin, 20000))[0].cost,
    b.cost,
  );
  const saved = applyAction(s, "route.create", {
    points: ids,
    scenario: b.id,
    inputs: b.inputs,
    matrix: m,
    nombre: "Tarifa fija",
    vehicle: "fixture",
    date: dateAfter(0),
  });
  assert.equal(saved.routes[0].scenario.cost, b.cost);
  assert.equal(saved.routes[0].scenario.inputs.externalRateMode, "fixed");
});
test("a saved plan retains destinations, contact, fleet and pricing data after later master-data edits", () => {
  let s = state();
  const ids = ["PS-005"],
    p = deriveOperationalInputs(s, ids, { ...inputs(s), mode: "own" }).inputs,
    c = compareLogistics(s, ids, p)[0];
  s = applyAction(s, "route.create", {
    points: ids,
    scenario: c.id,
    inputs: c.inputs,
    nombre: "Auditable",
    vehicle: "fixture",
    date: dateAfter(0),
  });
  const snapshot = structuredClone(s.routes[0].snapshot);
  assert.ok(snapshot.serviceCosts.materials > 0);
  assert.ok(snapshot.dispatches.length);
  assert.ok(snapshot.items.length);
  assert.equal(
    snapshot.contacts["PS-005"].contact.name,
    s.enterprise.contacts["PS-005"].contact.name,
  );
  s = applyAction(s, "point.update", {
    ...s.points.find((p) => p.id === "PS-005"),
    nombre_cliente: "Nombre corregido",
    latitud: -0.3,
  });
  s.enterprise.vehicles[0].fixedMonthly = 999;
  s.items[0].precio_unitario = 999;
  s.enterprise.contacts["PS-005"].contact.name = "Contacto nuevo";
  assert.deepEqual(s.routes[0].snapshot, snapshot);
});
test("grouped stock is received and valued in groups while exposing contained units without multiplying the ledger", () => {
  let s = state();
  s = applyAction(s, "item.create", {
    nombre: "Guantes por caja QA",
    categoria: "consumible",
    unidad_medida: "caja",
    packSize: 12,
    packUnit: "unidad",
    stock_minimo: 2,
    precio_unitario: 24,
    peso_unitario_kg: 1,
    volumen_unitario_m3: 0.01,
  });
  const itemId = s.items.at(-1).id;
  s = applyAction(s, "supplier.catalog", {
    id: "PR-004",
    products: [
      ...s.suppliers.find((p) => p.id === "PR-004").products,
      { itemId, price: 24, lead: 2, minOrder: 1 },
    ],
  });
  s = applyAction(s, "purchase.create", {
    item: itemId,
    cantidad: 3,
    supplier: "PR-004",
    motivo: "Reposición por caja",
  });
  const po = s.purchases[0];
  s = applyAction(s, "purchase.status", { id: po.id, estado: "Aprobada" });
  s = applyAction(s, "purchase.status", { id: po.id, estado: "En camino" });
  s = applyAction(s, "purchase.receive", {
    id: po.id,
    quantity: 3,
    receiver: "Receptor QA",
  });
  const item = s.items.find((i) => i.id === itemId);
  assert.equal(item.stock_actual, 3);
  assert.equal(item.stock_actual * item.precio_unitario, 72);
  assert.equal(packagingLabel(item), "1 caja = 12 unidades");
  assert.equal(containedQuantity(item, item.stock_actual), "36 unidades");
  assert.equal(s.movements[0].cantidad, 3);
});
test("grouped presentations require their content, support other containers, and do not invent metadata for old stock", () => {
  assert.throws(() => normalizePackaging("pallet", {}), /cuántas/);
  assert.throws(
    () => normalizePackaging("caja", { packSize: 1.5, packUnit: "unidad" }),
    /entero/,
  );
  assert.throws(
    () => normalizePackaging("paquete", { packSize: 12, packUnit: "paquete" }),
    /distinta/,
  );
  assert.deepEqual(
    normalizePackaging("caneca", { packSize: 18.5, packUnit: "litro" }),
    { packSize: 18.5, packUnit: "litro" },
  );
  const s = state(),
    old = s.items.find((i) => i.unidad_medida === "caja");
  assert.equal(old.packSize, undefined);
  assert.ok(packagingLabel(old).includes("por registrar"));
  const oldQty = old.stock_actual,
    next = applyAction(s, "item.update", {
      id: old.id,
      stock_minimo: old.stock_minimo,
      precio_unitario: old.precio_unitario,
      packSize: 24,
      packUnit: "unidad",
    });
  assert.equal(next.items.find((i) => i.id === old.id).stock_actual, oldQty);
});
test("all location categories persist and visit dates are accepted only for prospects", () => {
  let s = state();
  for (const t of LOCATION_TYPES) {
    s = applyAction(s, "point.create", {
      nombre_cliente: "QA " + t.label,
      direccion: "Dirección QA",
      zona_reparto: "QA",
      latitud: -0.2,
      longitud: -78.5,
      metros_cuadrados_atendidos: 0,
      kind: t.value,
      frequency: 0,
      nextService: dateAfter(5),
      contrato_validado: false,
      requiere_personal_acreditado: false,
      urgente: false,
    });
    const p = s.points.at(-1),
      meta = s.enterprise.contacts[p.id];
    assert.equal(meta.kind, t.value);
    assert.equal(meta.nextService, t.value === "prospect" ? dateAfter(5) : "");
    if (["office", "warehouse", "plant"].includes(t.value)) {
      assert.ok(optimize(s, [p.id])[0].feasible);
      assert.ok(
        compareLogistics(s, [p.id], defaultPlan(s)).every((c) => c.feasible),
      );
    }
  }
  const p = s.points.find(
    (p) => s.enterprise.contacts[p.id].kind === "prospect",
  );
  s = applyAction(s, "location.contact", {
    id: p.id,
    kind: "client",
    segment: "General",
    frequency: 1,
    nextService: dateAfter(8),
  });
  assert.equal(s.enterprise.contacts[p.id].nextService, "");
  assert.throws(
    () =>
      applyAction(s, "location.contact", {
        id: p.id,
        kind: "unknown",
        frequency: 0,
      }),
    /Tipo de ubicación/,
  );
});
test("movement geography uses that movement and keeps historical endpoints when locations are edited", () => {
  let s = state();
  s = applyAction(s, "stock.transfer", {
    itemId: "INS-001",
    from: "warehouse",
    to: "PS-002",
    quantity: 2,
    reference: "TR-GEO",
    receiver: "QA",
  });
  const m = s.movements[0],
    before = movementGeography(s, m);
  assert.ok(before.historical && before.complete);
  assert.equal(
    before.destination.nombre_cliente,
    s.points.find((p) => p.id === "PS-002").nombre_cliente,
  );
  s = applyAction(s, "warehouse.update", { ...s.warehouse, latitud: -0.4 });
  s = applyAction(s, "point.update", {
    ...s.points.find((p) => p.id === "PS-002"),
    longitud: -78.7,
  });
  assert.deepEqual(
    movementGeography(
      s,
      s.movements.find((x) => x.id === m.id),
    ),
    before,
  );
});
test("an incoming purchase never invents supplier coordinates and manual correction is atomic", () => {
  let s = state(),
    po = s.purchases.find((p) => p.estado === "En camino");
  s = applyAction(s, "purchase.receive", {
    id: po.id,
    quantity: po.cantidad,
    receiver: "QA",
  });
  const m = s.movements[0],
    geo = movementGeography(s, m);
  assert.equal(geo.origin, undefined);
  assert.ok(geo.destination);
  assert.equal(geo.complete, false);
  const original = JSON.stringify(s),
    origin = {
      nombre_cliente: "Bodega proveedor",
      direccion: "Dirección confirmada",
      latitud: -0.18,
      longitud: -78.49,
    };
  assert.throws(
    () =>
      applyAction(s, "movement.locations", {
        id: m.id,
        origin,
        destination: { ...origin, latitud: 100 },
      }),
    /rango/,
  );
  assert.equal(JSON.stringify(s), original);
  s = applyAction(s, "movement.locations", {
    id: m.id,
    origin,
    destination: s.warehouse,
  });
  const result = movementGeography(s, s.movements[0]);
  assert.ok(result.complete && result.historical);
  assert.deepEqual(result.origin, origin);
});
