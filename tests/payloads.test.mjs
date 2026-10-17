import test from "node:test";
import assert from "node:assert/strict";
import {
  createPayload,
  updatePayload,
  stockAdjustment,
} from "../src/lib/payloads.ts";
import { fromInputDate, toInputDate } from "../src/lib/format.ts";

test("Item creation uses supported units and stock zero; editing excludes stock", () => {
  const form = {
    nombre: "Prueba",
    categoria: "quimico",
    unidad_medida: "caja",
    stock_minimo: "4",
    precio_unitario: "20",
    peso_unitario_kg: "8",
    volumen_unitario_m3: ".1",
    stock_actual: "999",
    packSize: 12,
  };
  const created = createPayload("insumos", form),
    updated = updatePayload("insumos", form);
  assert.equal(created.stock_actual, 0);
  assert.equal(created.packSize, undefined);
  assert.equal(updated.stock_actual, undefined);
  assert.deepEqual(stockAdjustment("25"), { stock_actual: 25 });
  assert.throws(
    () => createPayload("insumos", { ...form, unidad_medida: "pallet" }),
    /admitidas/,
  );
});
test("Dispatch creation and delivery update cannot deduct stock twice", () => {
  const create = createPayload("despachos", {
    punto_servicio_id: "2",
    ruta_id: "",
    fecha_programada: "2026-10-17T08:00",
    costo_envio: "10",
    detalles: [
      { insumo_id: "1", cantidad_solicitada: "2", es_promocion: false },
    ],
    descontar_stock: true,
  });
  assert.equal(create.fecha_programada, "2026-10-17T13:00:00.000Z");
  assert.equal(create.descontar_stock, true);
  const update = updatePayload("despachos", {
    ruta_id: "1",
    fecha_programada: "2026-10-17T08:00",
    fecha_entrega_real: "2026-10-17T09:00",
    costo_envio: "10",
    estado_produccion: "Normal",
    descontar_stock: true,
    detalles: [{ insumo_id: 1, cantidad_solicitada: 2 }],
  });
  assert.equal(update.descontar_stock, undefined);
  assert.equal(update.detalles, undefined);
  assert.equal(update.fecha_entrega_real, "2026-10-17T14:00:00.000Z");
});
test("Duplicate lines, invalid quantities and coordinate pairs are blocked before POST", () => {
  assert.throws(
    () =>
      createPayload("despachos", {
        punto_servicio_id: 1,
        costo_envio: 1,
        detalles: [
          { insumo_id: 1, cantidad_solicitada: 2 },
          { insumo_id: 1, cantidad_solicitada: 3 },
        ],
      }),
    /repetir/,
  );
  assert.throws(
    () =>
      createPayload("despachos", {
        punto_servicio_id: 1,
        costo_envio: 1,
        detalles: [{ insumo_id: 1, cantidad_solicitada: 0 }],
      }),
    /cantidad/,
  );
  assert.throws(
    () =>
      createPayload("puntos-servicio", {
        nombre_cliente: "X",
        metros_cuadrados_atendidos: 1,
        latitud: 12,
        longitud: "",
      }),
    /ambas coordenadas/,
  );
});
test("Service date serialization uses the chosen Ecuador zone and rejects calendar overflow", () => {
  assert.equal(
    fromInputDate("2026-10-17T08:00", "Pacific/Galapagos"),
    "2026-10-17T14:00:00.000Z",
  );
  assert.equal(toInputDate("2026-10-17T13:00:00Z"), "2026-10-17T08:00");
  assert.throws(() => fromInputDate("2026-02-30T10:00"), /fecha/);
});

test("Unknown optional service cost and area are preserved as null rather than invented zeros", () => {
  assert.equal(
    updatePayload("despachos", {
      ruta_id: "",
      fecha_programada: "",
      fecha_entrega_real: "",
      costo_envio: "",
      estado_produccion: "Normal",
    }).costo_envio,
    null,
  );
  assert.equal(
    createPayload("puntos-servicio", {
      nombre_cliente: "X",
      latitud: "",
      longitud: "",
      metros_cuadrados_atendidos: "",
    }).metros_cuadrados_atendidos,
    null,
  );
});
