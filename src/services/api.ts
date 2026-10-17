import type * as Backend from "./backend.types";
import { authClient } from "./supabase";
import { config, isDemo } from "./config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function errorMessage(data: any): string {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail))
    return data.detail
      .map((e: any) => `${e.loc?.slice(1).join(".") || "Datos"}: ${e.msg}`)
      .join("; ");
  return "El servidor no pudo completar la solicitud.";
}
export async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
) {
  const session = await authClient?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new ApiError("Inicia sesión para continuar.", 401);
  return fetch(`${config.apiBase}/${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
    signal: options.signal || AbortSignal.timeout(30000),
  });
}
export async function request(
  company: string,
  path: string,
  body?: unknown,
): Promise<any> {
  if (isDemo) {
    const { demoRequest } = await import("./demo");
    return demoRequest(company, path, body);
  }
  let response: Response;
  try {
    response = await authenticatedFetch(
      `${path}?company=${encodeURIComponent(company)}`,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      "No se pudo conectar al servidor. Revisa su URL y vuelve a intentar.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(errorMessage(data), response.status, data);
  if (data === null)
    throw new ApiError(
      "La respuesta del servidor no es JSON válido.",
      response.status,
    );
  return data;
}
export async function uploadFile(company: string, file: File) {
  if (isDemo) {
    const { demoUpload } = await import("./demo");
    return demoUpload(company, file);
  }
  const form = new FormData();
  form.append("file", file);
  const response = await authenticatedFetch(
    `upload?company=${encodeURIComponent(company)}`,
    { method: "POST", body: form },
  );
  const data = await response.json();
  if (!response.ok) throw new ApiError(errorMessage(data), response.status);
  return data;
}
export async function downloadFile(company: string, id: string) {
  let blob: Blob, name: string;
  if (isDemo) {
    const { demoFile } = await import("./demo");
    const f = await demoFile(company, id);
    blob = f.blob;
    name = f.name;
  } else {
    const r = await authenticatedFetch(
      `files/${encodeURIComponent(id)}?company=${encodeURIComponent(company)}`,
    );
    if (!r.ok)
      throw new ApiError(
        errorMessage(await r.json().catch(() => null)),
        r.status,
      );
    blob = await r.blob();
    name = decodeURIComponent(r.headers.get("X-File-Name") || "documento");
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Verified FastAPI contract. It does NOT replace the companion state API.
 * Optional token is useful only after the FastAPI owner implements JWT validation.
 * No automatic retries/failover for writes (dispatch creation can deduct stock).
 */
export class LogisticsApi {
  constructor(
    private base = config.logisticsUrl,
    private token?: () => Promise<string | undefined>,
  ) {}
  async call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const token = await this.token?.();
    const r = await fetch(`${this.base}/api/${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    if (r.status === 204) return undefined as T;
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(errorMessage(data), r.status, data);
    return data;
  }
  list<K extends LegacyResource>(resource: K) {
    return this.call<LegacyRecord[K][]>(resource);
  }
  get<K extends LegacyResource>(resource: K, id: number) {
    return this.call<LegacyRecord[K]>(`${resource}/${id}`);
  }
  create<K extends LegacyResource>(resource: K, body: LegacyCreate[K]) {
    return this.call<LegacyRecord[K]>(resource, "POST", body);
  }
  update<K extends LegacyResource>(
    resource: K,
    id: number,
    body: LegacyUpdate[K],
  ) {
    return this.call<LegacyRecord[K]>(`${resource}/${id}`, "PATCH", body);
  }
  remove(resource: LegacyResource, id: number) {
    return this.call(`${resource}/${id}`, "DELETE");
  }
  critical() {
    return this.call("insumos/criticos-y-proyeccion");
  }
  suggested(body: {
    punto_servicio_id: number;
    insumo_id: number;
    consumo_por_m2: number;
  }) {
    return this.call("inventario/calcular-sugerido", "POST", body);
  }
  kpis() {
    return this.call("kpis/resumen");
  }
  routeStatus(
    id: number,
    estado: "Planificada" | "En Tránsito" | "Completada",
  ) {
    return this.call(`rutas/${id}/estado`, "PATCH", { estado });
  }
  urgent(id: number) {
    return this.call(`despachos/${id}/apurar-produccion`, "PATCH");
  }
}
export type LegacyResource =
  | "insumos"
  | "puntos-servicio"
  | "personal"
  | "rutas"
  | "despachos"
  | "contratos";
export type InsumoDTO = Backend.InsumoResponse;
export type LegacyRecord = {
  insumos: Backend.InsumoResponse;
  "puntos-servicio": Backend.PuntoServicioResponse;
  personal: Backend.PersonalResponse;
  rutas: Backend.RutaResponse;
  despachos: Backend.DespachoResponse;
  contratos: Backend.ContratoResponse;
};
export type LegacyCreate = {
  insumos: Backend.InsumoCreate;
  "puntos-servicio": Backend.PuntoServicioCreate;
  personal: Backend.PersonalCreate;
  rutas: Backend.RutaCreate;
  despachos: Backend.DespachoCreate;
  contratos: Backend.ContratoCreate;
};
export type LegacyUpdate = {
  insumos: Backend.InsumoUpdate;
  "puntos-servicio": Backend.PuntoServicioUpdate;
  personal: Backend.PersonalUpdate;
  rutas: Backend.RutaUpdate;
  despachos: Backend.DespachoUpdate;
  contratos: Backend.ContratoUpdate;
};
