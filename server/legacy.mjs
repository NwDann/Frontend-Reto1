import { createHash } from "node:crypto";
import { upgradeState } from "../src/lib/logistics.ts";
/** Read-only bridge. Original API has no documented user/workspace authentication. */
export async function legacyPreview(base, fetcher = fetch) {
  const resources = ["insumos", "puntos-servicio", "personal"];
  const [items, points, staff] = await Promise.all(
    resources.map(async (path) => {
      const r = await fetcher(`${base.replace(/\/$/, "")}/api/${path}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw Error(`API del reto: ${path} respondió ${r.status}.`);
      const data = await r.json();
      if (!Array.isArray(data) || data.length > 10000)
        throw Error("Respuesta de catálogo no válida.");
      return data;
    }),
  );
  const data = { items, points, staff };
  return {
    ...data,
    source: base,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex"),
  };
}
const numeric = (x, label, min = 0) => {
  if (typeof x !== "number" || !Number.isFinite(x) || x < min)
    throw Error(`La API devolvió ${label} no válido.`);
  return x;
};
export function importLegacy(state, data) {
  const e = state.enterprise;
  if (
    state.company.demo ||
    state.items.length ||
    state.points.length ||
    state.dispatches.length ||
    state.purchases.length ||
    state.routes.length ||
    state.movements.length ||
    state.suppliers.length ||
    e?.vehicles.length ||
    e?.staff.length ||
    e?.demand.length
  )
    throw Error(
      "La importación inicial requiere un espacio vacío sin registros de demostración.",
    );
  const next = structuredClone(state);
  next.items = data.items.map((i) => ({
    id: `API-INS-${i.id}`,
    nombre: String(i.nombre),
    categoria: i.categoria,
    unidad_medida: i.unidad_medida,
    stock_actual: numeric(i.stock_actual, "stock"),
    stock_minimo: numeric(i.stock_minimo, "mínimo"),
    precio_unitario: numeric(i.precio_unitario, "precio"),
    peso_unitario_kg: numeric(i.peso_unitario_kg, "peso"),
    volumen_unitario_m3: numeric(i.volumen_unitario_m3, "volumen"),
    vencimiento: "",
    history: [],
    opening: i.stock_actual,
    monthly: 0,
    color: "mint",
  }));
  next.points = data.points.map((p) => {
    if (p.latitud === null || p.longitud === null)
      throw Error(
        `Completa las coordenadas de ${p.nombre_cliente} en el backend antes de importar.`,
      );
    numeric(p.latitud, "latitud", -90);
    numeric(p.longitud, "longitud", -180);
    if (p.latitud > 90 || p.longitud > 180)
      throw Error("Coordenadas fuera de rango.");
    return {
      id: `API-PS-${p.id}`,
      nombre_cliente: String(p.nombre_cliente),
      direccion: p.direccion || "",
      zona_reparto: p.zona_reparto || "",
      latitud: p.latitud,
      longitud: p.longitud,
      metros_cuadrados_atendidos: p.metros_cuadrados_atendidos || 0,
      requiere_personal_acreditado: !!p.requiere_personal_acreditado,
      contrato_validado: !!p.contrato_validado,
      urgente: false,
    };
  });
  // The API exposes a Boolean accreditation; it does not expose validity dates.
  // Do not invent dates or automatically certify a driver.
  const upgraded = upgradeState(next);
  upgraded.enterprise.staff = data.staff.map((p) => ({
    id: `API-PER-${p.id}`,
    name: String(p.nombre),
    role: p.especialidad || "general",
    phone: "",
    accreditedUntil: "",
    available: !!p.disponible,
    hourly: 0,
  }));
  upgraded.enterprise.balances = upgraded.items.map((i) => ({
    itemId: i.id,
    locationId: "warehouse",
    quantity: i.stock_actual,
    expiry: "",
  }));
  upgraded.enterprise.contacts = Object.fromEntries(
    upgraded.points.map((p) => [
      p.id,
      {
        kind: "service",
        segment: "Importado de API",
        frequency: 0,
        nextService: "",
        contact: { name: "", role: "", phone: "", email: "", hours: "" },
      },
    ]),
  );
  upgraded.updatedAt = new Date().toISOString();
  return upgraded;
}
