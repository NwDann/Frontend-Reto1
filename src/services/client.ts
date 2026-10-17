import type * as B from "./backend.types.ts";
export type Resource =
  | "insumos"
  | "puntos-servicio"
  | "personal"
  | "rutas"
  | "despachos"
  | "contratos";
export type Item = B.InsumoResponse &
  Required<
    Pick<
      B.InsumoResponse,
      | "stock_actual"
      | "stock_minimo"
      | "precio_unitario"
      | "peso_unitario_kg"
      | "volumen_unitario_m3"
      | "unidad_medida"
    >
  >;
export type RouteRecord = B.RutaResponse &
  Required<
    Pick<
      B.RutaResponse,
      | "capacidad_peso_max_kg"
      | "capacidad_volumen_max_m3"
      | "es_multiparada"
      | "conductor_id"
    >
  >;
export type StaffRecord = B.PersonalResponse &
  Required<
    Pick<B.PersonalResponse, "acreditado" | "disponible" | "especialidad">
  >;
export type CriticalRecord = Omit<B.InsumoCriticoResponse, "insumo"> & {
  insumo: Item;
};
export type Records = {
  insumos: Item;
  "puntos-servicio": B.PuntoServicioResponse;
  personal: StaffRecord;
  rutas: RouteRecord;
  despachos: B.DespachoResponse;
  contratos: B.ContratoResponse;
};
export type Creates = {
  insumos: B.InsumoCreate;
  "puntos-servicio": B.PuntoServicioCreate;
  personal: B.PersonalCreate;
  rutas: B.RutaCreate;
  despachos: B.DespachoCreate;
  contratos: B.ContratoCreate;
};
export type Updates = {
  insumos: B.InsumoUpdate;
  "puntos-servicio": B.PuntoServicioUpdate;
  personal: B.PersonalUpdate;
  rutas: B.RutaUpdate;
  despachos: B.DespachoUpdate;
  contratos: B.ContratoUpdate;
};
export class ApiError extends Error {
  status: number;
  detail: unknown;
  ambiguous: boolean;
  constructor(
    message: string,
    status = 0,
    detail?: unknown,
    ambiguous = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.ambiguous = ambiguous;
  }
}
export function describeError(data: unknown) {
  const d = data as any;
  if (typeof d?.detail === "string") return d.detail;
  if (Array.isArray(d?.detail))
    return d.detail
      .map((e: any) => `${e.loc?.slice(1).join(".") || "Datos"}: ${e.msg}`)
      .join("; ");
  if (typeof d?.error === "string") return d.error;
  return "El backend rechazó la operación.";
}
export class ApiClient {
  base: string;
  fetcher: typeof fetch;
  proxy: boolean;
  constructor(base: string, fetcher: typeof fetch = fetch) {
    this.proxy = base.startsWith("/");
    this.base = base.replace(/\/$/, "").replace(/\/api$/, "");
    if (!this.base && !base.startsWith("/"))
      throw Error("Configura la URL del backend.");
    this.fetcher = fetcher;
  }
  async call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const url = `${this.base}${(path.startsWith("/health") || path.startsWith("/openapi.json")) && !this.proxy ? "" : "/api"}/${path.replace(/^\//, "")}`;
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        method === "GET"
          ? "No se pudo conectar con el backend. Revisa conexión, URL y CORS."
          : "Se perdió la conexión al guardar. Actualiza los registros para comprobar si el cambio se aplicó antes de repetirlo.",
        0,
        undefined,
        method !== "GET",
      );
    }
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {}
    if (!response.ok) {
      const protectedPage =
        response.status === 401 &&
        (/vercel|authentication required/i.test(text) || !data);
      throw new ApiError(
        protectedPage
          ? "Este despliegue de Vercel está protegido (401). Usa una URL pública o habilita el acceso al despliegue desde Vercel."
          : response.status === 403
            ? "Acceso denegado por el backend o el despliegue."
            : data
              ? describeError(data)
              : `El servidor respondió HTTP ${response.status}.`,
        response.status,
        data,
      );
    }
    if (!text || response.status === 204) return undefined as T;
    if (
      data === undefined &&
      /vercel/i.test(text) &&
      /authentication|required|login|sso/i.test(text)
    )
      throw new ApiError(
        "Este despliegue devuelve una página de acceso de Vercel. Configura una URL pública del backend o habilita el acceso a ese despliegue.",
        401,
      );
    if (data === undefined)
      throw new ApiError(
        method === "GET"
          ? "El servidor devolvió HTML o una respuesta que no es JSON. Comprueba la URL del backend."
          : "El servidor respondió sin un resultado JSON válido. Actualiza los registros antes de repetir la operación.",
        response.status,
        undefined,
        method !== "GET",
      );
    return data as T;
  }
  async list<K extends Resource>(resource: K) {
    const data = await this.call<Records[K][]>(resource);
    if (!Array.isArray(data))
      throw new ApiError(`La respuesta de ${resource} no es una lista válida.`);
    data.forEach((row) => validateRecord(resource, row));
    return data;
  }
  async get<K extends Resource>(resource: K, id: number) {
    const data = await this.call<Records[K]>(`${resource}/${id}`);
    validateRecord(resource, data);
    return data;
  }
  create<K extends Resource>(resource: K, body: Creates[K]) {
    return this.call<Records[K]>(resource, "POST", body);
  }
  update<K extends Resource>(resource: K, id: number, body: Updates[K]) {
    return this.call<Records[K]>(`${resource}/${id}`, "PATCH", body);
  }
  remove(resource: Resource, id: number) {
    return this.call(`${resource}/${id}`, "DELETE");
  }
  async critical() {
    const data = await this.call<CriticalRecord[]>(
      "insumos/criticos-y-proyeccion",
    );
    if (!Array.isArray(data))
      throw new ApiError("La respuesta de críticos no es una lista.");
    data.forEach((row) => {
      validateRecord("insumos", row.insumo);
      if (
        !Array.isArray(row.puntos_en_riesgo) ||
        typeof row.stock_deficit !== "number"
      )
        throw new ApiError(
          "El análisis de críticos no tiene el formato esperado.",
        );
    });
    return data;
  }
  kpis() {
    return this.call<B.KPIResumenResponse>("kpis/resumen");
  }
  suggested(body: B.CalcularSugeridoRequest) {
    return this.call<B.CalcularSugeridoResponse>(
      "inventario/calcular-sugerido",
      "POST",
      body,
    );
  }
  accredited(
    options: {
      especialidad?: string;
      solo_disponibles?: boolean;
      requiere_acreditado?: boolean;
    } = {},
  ) {
    const q = new URLSearchParams(
      Object.entries(options)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
    return this.call<B.ValidarAcreditacionResponse>(
      `personal/validar-acreditacion?${q}`,
    );
  }
  routeStatus(id: number, body: B.ActualizarEstadoRutaRequest) {
    return this.call<unknown>(`rutas/${id}/estado`, "PATCH", body);
  }
  urgent(id: number) {
    return this.call<B.DespachoResponse>(
      `despachos/${id}/apurar-produccion`,
      "PATCH",
    );
  }
  health() {
    return this.call<{ status: string }>("/health");
  }
}

export function validateRecord(resource: Resource, data: any) {
  if (!data || typeof data !== "object" || !Number.isInteger(data.id))
    throw new ApiError(`Registro inválido en ${resource}.`);
  const numbers =
    resource === "insumos"
      ? [
          "stock_actual",
          "stock_minimo",
          "precio_unitario",
          "peso_unitario_kg",
          "volumen_unitario_m3",
        ]
      : resource === "rutas"
        ? [
            "capacidad_peso_max_kg",
            "capacidad_volumen_max_m3",
            "peso_actual_carga",
            "valor_mercaderia_total",
          ]
        : [];
  for (const key of numbers)
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]))
      throw new ApiError(`Falta un valor numérico válido: ${resource}.${key}.`);
  if (resource === "insumos" && typeof data.nombre !== "string")
    throw new ApiError("Falta el nombre del insumo.");
  if (
    resource === "puntos-servicio" &&
    (typeof data.contrato_validado !== "boolean" ||
      typeof data.requiere_personal_acreditado !== "boolean")
  )
    throw new ApiError(
      "El punto no devuelve sus condiciones de contrato o acreditación.",
    );
  if (
    resource === "personal" &&
    (typeof data.acreditado !== "boolean" ||
      typeof data.disponible !== "boolean")
  )
    throw new ApiError(
      "El registro de personal no devuelve acreditación o disponibilidad.",
    );
}
