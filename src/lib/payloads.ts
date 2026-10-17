import type { Creates, Updates, Resource } from "../services/client.ts";
import { fromInputDate } from "./format.ts";
const numeric = (v: unknown, label: string, min = 0) => {
  const n = Number(v);
  if (
    v === "" ||
    v === null ||
    v === undefined ||
    !Number.isFinite(n) ||
    n < min
  )
    throw Error(`Revisa ${label}.`);
  return n;
};
const nullableNumber = (value: unknown, label: string) =>
  value === "" || value === null || value === undefined
    ? null
    : numeric(value, label);
const id = (v: unknown, label: string) => {
  const n = numeric(v, label, 1);
  if (!Number.isInteger(n)) throw Error(`Revisa ${label}.`);
  return n;
};
const optionalId = (v: unknown) =>
  v === "" || v === undefined || v === null ? null : id(v, "la referencia");
const text = (v: unknown, label: string) => {
  const t = String(v ?? "").trim();
  if (!t) throw Error(`Completa ${label}.`);
  return t;
};
const bool = (v: unknown) => v === true || v === "on" || v === "true";
/** Explicit allowlists: never forward UI-only values, snapshots or stock a second time. */
export function createPayload<K extends Resource>(
  resource: K,
  form: Record<string, unknown>,
  timezone = "America/Guayaquil",
): Creates[K] {
  const f = form;
  let out: unknown;
  switch (resource) {
    case "insumos":
      if (
        !["quimico", "consumible", "herramienta"].includes(
          String(f.categoria),
        ) ||
        !["unidad", "caja", "caneca", "litro"].includes(String(f.unidad_medida))
      )
        throw Error("Selecciona una categoría y unidad admitidas por la API.");
      out = {
        nombre: text(f.nombre, "el nombre"),
        categoria: f.categoria,
        unidad_medida: f.unidad_medida,
        stock_actual: 0,
        stock_minimo: numeric(f.stock_minimo, "el mínimo"),
        precio_unitario: numeric(f.precio_unitario, "el precio"),
        peso_unitario_kg: numeric(f.peso_unitario_kg, "el peso"),
        volumen_unitario_m3: numeric(f.volumen_unitario_m3, "el volumen"),
      };
      break;
    case "puntos-servicio": {
      const lat =
          f.latitud === "" || f.latitud === undefined
            ? null
            : numeric(f.latitud, "la latitud", -90),
        lng =
          f.longitud === "" || f.longitud === undefined
            ? null
            : numeric(f.longitud, "la longitud", -180);
      if (
        (lat !== null && lat > 90) ||
        (lng !== null && lng > 180) ||
        (lat === null) !== (lng === null)
      )
        throw Error("Registra ambas coordenadas dentro de sus límites.");
      out = {
        nombre_cliente: text(f.nombre_cliente, "el nombre"),
        direccion: String(f.direccion || "").trim() || null,
        zona_reparto: String(f.zona_reparto || "").trim() || null,
        latitud: lat,
        longitud: lng,
        metros_cuadrados_atendidos: nullableNumber(
          f.metros_cuadrados_atendidos,
          "el área",
        ),
        requiere_personal_acreditado: bool(f.requiere_personal_acreditado),
        contrato_validado: bool(f.contrato_validado),
      };
      break;
    }
    case "personal":
      if (
        !["general", "hospitalario", "emergencia"].includes(
          String(f.especialidad),
        )
      )
        throw Error("Selecciona una especialidad válida.");
      out = {
        nombre: text(f.nombre, "el nombre"),
        especialidad: f.especialidad,
        acreditado: bool(f.acreditado),
        disponible: bool(f.disponible),
      };
      break;
    case "rutas":
      out = {
        codigo_vehiculo: text(f.codigo_vehiculo, "el código del vehículo"),
        conductor_id: optionalId(f.conductor_id),
        capacidad_peso_max_kg: numeric(
          f.capacidad_peso_max_kg,
          "la capacidad de peso",
          0.01,
        ),
        capacidad_volumen_max_m3: numeric(
          f.capacidad_volumen_max_m3,
          "la capacidad volumétrica",
        ),
        es_multiparada: bool(f.es_multiparada),
      };
      break;
    case "despachos": {
      const details = f.detalles;
      if (!Array.isArray(details) || !details.length)
        throw Error("Agrega al menos un insumo al despacho.");
      const seen = new Set<number>();
      const lines = details.map((l: any) => {
        const insumo_id = id(l.insumo_id, "el insumo");
        if (seen.has(insumo_id))
          throw Error("Un despacho no puede repetir el mismo insumo.");
        seen.add(insumo_id);
        return {
          insumo_id,
          cantidad_solicitada: numeric(
            l.cantidad_solicitada,
            "la cantidad",
            Number.EPSILON,
          ),
          es_promocion: bool(l.es_promocion),
        };
      });
      out = {
        punto_servicio_id: id(f.punto_servicio_id, "el punto de servicio"),
        ruta_id: optionalId(f.ruta_id),
        fecha_programada: fromInputDate(
          String(f.fecha_programada || ""),
          timezone,
        ),
        costo_envio: nullableNumber(f.costo_envio, "el costo de envío"),
        detalles: lines,
        descontar_stock: bool(f.descontar_stock),
      };
      break;
    }
    case "contratos":
      out = {
        punto_servicio_id: id(f.punto_servicio_id, "el punto de servicio"),
        detalles_acuerdo: String(f.detalles_acuerdo || "").trim() || null,
        tiene_adenda: bool(f.tiene_adenda),
        vigente: bool(f.vigente),
      };
      break;
  }
  return out as Creates[K];
}
export function updatePayload<K extends Resource>(
  resource: K,
  form: Record<string, unknown>,
  timezone = "America/Guayaquil",
): Updates[K] {
  if (resource === "despachos")
    return {
      ruta_id: optionalId(form.ruta_id),
      fecha_programada: fromInputDate(
        String(form.fecha_programada || ""),
        timezone,
      ),
      fecha_entrega_real: fromInputDate(
        String(form.fecha_entrega_real || ""),
        timezone,
      ),
      costo_envio: nullableNumber(form.costo_envio, "el costo de envío"),
      estado_produccion:
        form.estado_produccion === "Apurado/Urgente"
          ? "Apurado/Urgente"
          : "Normal",
    } as Updates[K];
  if (resource === "contratos") {
    const { punto_servicio_id: _, ...rest } = createPayload(
      resource,
      { ...form, punto_servicio_id: form.punto_servicio_id || 1 },
      timezone,
    ) as Creates["contratos"];
    return rest as Updates[K];
  }
  const payload = createPayload(resource, form, timezone) as Record<
    string,
    unknown
  >;
  if (resource === "insumos") delete payload.stock_actual; // Stock is an independent explicit reconciliation.
  return payload as Updates[K];
}
export function stockAdjustment(value: unknown) {
  return { stock_actual: numeric(value, "el saldo de inventario") };
}
