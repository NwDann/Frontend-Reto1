import type { State, Movement } from "./model.ts";
import type { Warehouse } from "./logistics.ts";

export const LOCATION_TYPES = [
  { value: "warehouse", label: "Bodega" },
  { value: "office", label: "Oficina" },
  { value: "sale", label: "Punto de venta" },
  { value: "client", label: "Cliente" },
  { value: "prospect", label: "Cliente futuro" },
  { value: "plant", label: "Planta de producción" },
  { value: "service", label: "Punto de servicio" },
] as const;
export type LocationKind = (typeof LOCATION_TYPES)[number]["value"];
export const validLocationKind = (kind: unknown): kind is LocationKind =>
  LOCATION_TYPES.some((t) => t.value === kind);
export const locationLabel = (kind: string) =>
  LOCATION_TYPES.find((t) => t.value === kind)?.label || "Punto de servicio";
export function normalizeLocation(input: unknown): Warehouse {
  if (!input || typeof input !== "object")
    throw Error("Selecciona una ubicación válida.");
  const p = input as Record<string, unknown>;
  const coordinate = (v: unknown, max: number) => {
    if (v === null || v === "" || v === undefined)
      throw Error("Completa las coordenadas de la ubicación.");
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > max)
      throw Error("Las coordenadas están fuera de rango.");
    return n;
  };
  if (
    typeof p.nombre_cliente !== "string" ||
    !p.nombre_cliente.trim() ||
    p.nombre_cliente.length > 250
  )
    throw Error("Escribe un nombre para la ubicación.");
  if (
    p.direccion !== undefined &&
    (typeof p.direccion !== "string" || p.direccion.length > 500)
  )
    throw Error("Revisa la dirección de la ubicación.");
  return {
    nombre_cliente: p.nombre_cliente.trim(),
    direccion: typeof p.direccion === "string" ? p.direccion.trim() : "",
    latitud: coordinate(p.latitud, 90),
    longitud: coordinate(p.longitud, 180),
  };
}
export function registeredLocation(
  s: State,
  id: string,
): Warehouse | undefined {
  if (id === "warehouse") return s.warehouse ? { ...s.warehouse } : undefined;
  const p = s.points.find((p) => p.id === id);
  return p
    ? {
        nombre_cliente: p.nombre_cliente,
        direccion: p.direccion,
        latitud: p.latitud,
        longitud: p.longitud,
      }
    : undefined;
}
function locationByName(s: State, name: string) {
  const candidates = [
    ...(s.warehouse ? [s.warehouse] : []),
    ...s.points,
  ].filter(
    (p) => p.nombre_cliente.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  return candidates.length === 1
    ? {
        nombre_cliente: candidates[0].nombre_cliente,
        direccion: candidates[0].direccion,
        latitud: candidates[0].latitud,
        longitud: candidates[0].longitud,
      }
    : undefined;
}
export function movementGeography(s: State, m: Movement) {
  const guide = s.dispatches.find((d) => d.id === m.referencia);
  const origin =
    m.originLocation ||
    registeredLocation(s, m.originId || "") ||
    locationByName(s, m.origen);
  const destination =
    m.destinationLocation ||
    registeredLocation(s, m.destinationId || "") ||
    locationByName(s, m.destino) ||
    (guide ? registeredLocation(s, guide.point) : undefined);
  return {
    origin,
    destination,
    complete: !!origin && !!destination,
    historical: !!m.originLocation && !!m.destinationLocation,
  };
}
