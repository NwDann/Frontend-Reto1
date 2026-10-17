import type { ApiClient } from "./client.ts";
import type { Snapshot, DataKey } from "../lib/models.ts";
const keys: DataKey[] = [
  "items",
  "points",
  "staff",
  "routes",
  "dispatches",
  "contracts",
  "critical",
  "kpis",
];
export async function loadSnapshot(api: ApiClient): Promise<Snapshot> {
  const calls = [
    () => api.list("insumos"),
    () => api.list("puntos-servicio"),
    () => api.list("personal"),
    () => api.list("rutas"),
    () => api.list("despachos"),
    () => api.list("contratos"),
    () => api.critical(),
    () => api.kpis(),
  ];
  const results = await Promise.allSettled(calls.map((fn) => fn()));
  const state: Snapshot = { errors: {}, loadedAt: {} };
  results.forEach((result, i) => {
    const key = keys[i];
    if (result.status === "fulfilled") {
      (state as any)[key] = result.value;
      state.loadedAt[key] = new Date().toISOString();
    } else
      state.errors[key] =
        result.reason?.message || "No se pudo consultar este recurso.";
  });
  return state;
}
