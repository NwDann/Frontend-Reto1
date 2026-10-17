import { config } from "./config";
import { coordKey, validateMatrix } from "../lib/planning";
import type { Coords } from "../lib/models";
import type { Matrix } from "../lib/planning";
export async function roadMatrix(
  coords: Coords[],
  fetcher: typeof fetch = fetch,
): Promise<Matrix> {
  const r = await fetcher(
      `${config.osrmBase}/table/v1/driving/${coords.map(coordKey).join(";")}?annotations=distance,duration`,
      { signal: AbortSignal.timeout(12000) },
    ),
    d = await r.json();
  if (!r.ok || d.code !== "Ok")
    throw Error("No se pudo obtener una matriz de la red vial.");
  const matrix: Matrix = {
    keys: coords.map(coordKey),
    distances: d.distances,
    durations: d.durations,
    source: "OSRM / OpenStreetMap · sin tráfico en vivo",
    fetchedAt: new Date().toISOString(),
  };
  validateMatrix(matrix, coords);
  return matrix;
}
export async function roadLine(
  coords: Coords[],
  fetcher: typeof fetch = fetch,
): Promise<[number, number][]> {
  const r = await fetcher(
      `${config.osrmBase}/route/v1/driving/${coords.map(coordKey).join(";")}?overview=simplified&geometries=geojson`,
      { signal: AbortSignal.timeout(12000) },
    ),
    d = await r.json();
  if (!r.ok || d.code !== "Ok" || !d.routes?.[0]?.geometry?.coordinates)
    throw Error("No se pudo dibujar el recorrido vial.");
  return d.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [
    lat,
    lng,
  ]);
}
