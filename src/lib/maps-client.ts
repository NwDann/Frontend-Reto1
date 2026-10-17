import type { State } from "./model";
import { coordinateKey, warehouseFor } from "./logistics";
import type { RoadMatrix, Warehouse } from "./logistics";
const cache = new Map<string, RoadMatrix>();
export async function roadMatrix(
  s: State,
  ids: string[],
  start: Warehouse = warehouseFor(s),
): Promise<RoadMatrix> {
  const locations = [
      start,
      ...ids.map((id) => s.points.find((p) => p.id === id)!),
    ],
    coordinates = coordinateKey(locations),
    cacheKey = ids.join("|") + "|" + coordinates,
    cached = cache.get(cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 300000)
    return cached;
  const r = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coordinates}?annotations=distance,duration`,
      { signal: AbortSignal.timeout(12000) },
    ),
    data: any = await r.json();
  if (
    !r.ok ||
    data.code !== "Ok" ||
    !data.distances ||
    !data.durations ||
    [data.distances, data.durations].some((g: any) =>
      g.some((row: any) =>
        row.some((x: any) => typeof x !== "number" || !Number.isFinite(x)),
      ),
    )
  )
    throw Error("No hay una matriz vial completa para esta selección.");
  const result: RoadMatrix = {
    ids: ["warehouse", ...ids],
    coordinates,
    distances: data.distances,
    durations: data.durations,
    source: "OSRM",
    fetchedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, result);
  return result;
}
