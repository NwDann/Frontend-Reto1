import type { Item } from "./model.ts";
const normalize = (unit: string) =>
  unit
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
export const STOCK_UNITS = [
  "unidad",
  "litro",
  "kilogramo",
  "galón",
  "caja",
  "paquete",
  "pallet",
  "bulto",
  "fardo",
  "saco",
  "rollo",
  "kit",
  "caneca",
  "agrupación",
];
export function isGroupedUnit(unit: string) {
  return /^(cajas?|paquetes?|pallets?|palets?|bultos?|fardos?|sacos?|rollos?|kits?|canecas?|packs?|cajon(?:es)?|agrupacion(?:es)?)$/.test(
    normalize(unit),
  );
}
export function normalizePackaging(
  unit: string,
  p: { packSize?: unknown; packUnit?: unknown },
) {
  if (!isGroupedUnit(unit)) return { packSize: undefined, packUnit: undefined };
  const size = Number(p.packSize),
    base = typeof p.packUnit === "string" ? p.packUnit.trim() : "";
  if (
    p.packSize === "" ||
    p.packSize === null ||
    p.packSize === undefined ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > 1e8
  )
    throw Error("Indica cuántas unidades contiene cada agrupación.");
  if (!base || base.length > 30 || normalize(base) === normalize(unit))
    throw Error(
      "Selecciona una unidad de contenido distinta de la agrupación.",
    );
  if (
    ["unidad", "unidades", "par", "pares"].includes(normalize(base)) &&
    !Number.isInteger(size)
  )
    throw Error("El contenido en unidades o pares debe ser un número entero.");
  return { packSize: size, packUnit: base };
}
const contentLabel = (unit: string, quantity: number) =>
  quantity === 1
    ? unit
    : {
        unidad: "unidades",
        litro: "litros",
        kilogramo: "kilogramos",
        par: "pares",
        caja: "cajas",
        paquete: "paquetes",
        rollo: "rollos",
        metro: "metros",
        "metro cuadrado": "metros cuadrados",
      }[unit] || unit;
export function packagingLabel(
  item: Pick<Item, "unidad_medida" | "packSize" | "packUnit">,
) {
  if (!isGroupedUnit(item.unidad_medida)) return "";
  return item.packSize && item.packUnit
    ? `1 ${item.unidad_medida} = ${item.packSize} ${contentLabel(item.packUnit, item.packSize)}`
    : "Contenido de la agrupación por registrar";
}
export function containedQuantity(
  item: Pick<Item, "packSize" | "packUnit">,
  quantity: number,
) {
  return item.packSize && item.packUnit
    ? `${Number((quantity * item.packSize).toFixed(4))} ${contentLabel(item.packUnit, quantity * item.packSize)}`
    : "";
}
