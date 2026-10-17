/** Generated from docs/backend-openapi.json by npm run api:types. Do not edit manually. */
export type ActualizarEstadoRutaRequest = {
  estado: EstadoRutaEnum;
  notas_imprevisto?: string | null;
  tiene_adenda?: boolean;
};

export type CalcularSugeridoRequest = {
  punto_servicio_id: number;
  insumo_id: number;
  consumo_por_m2?: number | null;
};

export type CalcularSugeridoResponse = {
  punto_servicio_id: number;
  nombre_cliente: string;
  metros_cuadrados: number;
  insumo_id: number;
  nombre_insumo: string;
  unidad_medida: string;
  consumo_por_m2: number;
  cantidad_sugerida: number;
  desglose_empaque: {
    [key: string]: unknown;
  };
};

export type CategoriaInsumoEnum = "quimico" | "consumible" | "herramienta";

export type ContratoCreate = {
  punto_servicio_id: number;
  detalles_acuerdo?: string | null;
  tiene_adenda?: boolean;
  vigente?: boolean;
};

export type ContratoResponse = {
  punto_servicio_id: number;
  detalles_acuerdo?: string | null;
  tiene_adenda?: boolean;
  vigente?: boolean;
  id: number;
};

export type ContratoUpdate = {
  detalles_acuerdo?: string | null;
  tiene_adenda?: boolean | null;
  vigente?: boolean | null;
};

export type DespachoCreate = {
  punto_servicio_id: number;
  fecha_programada?: string | null;
  ruta_id?: number | null;
  costo_envio?: number | null;
  detalles?: Array<DetalleDespachoCreate>;
  descontar_stock?: boolean;
};

export type DespachoResponse = {
  id: number;
  ruta_id: number | null;
  punto_servicio_id: number;
  estado_produccion: string;
  fecha_programada: string | null;
  fecha_entrega_real: string | null;
  costo_envio: number | null;
  detalles?: Array<DetalleDespachoResponse>;
};

export type DespachoUpdate = {
  ruta_id?: number | null;
  estado_produccion?: EstadoProduccionEnum | null;
  fecha_programada?: string | null;
  fecha_entrega_real?: string | null;
  costo_envio?: number | null;
};

export type DetalleDespachoCreate = {
  insumo_id: number;
  cantidad_solicitada: number;
  es_promocion?: boolean;
};

export type DetalleDespachoResponse = {
  id: number;
  insumo_id: number;
  cantidad_solicitada: number;
  es_promocion: boolean;
};

export type EspecialidadEnum = "general" | "hospitalario" | "emergencia";

export type EstadoProduccionEnum = "Normal" | "Apurado/Urgente";

export type EstadoRutaEnum = "Planificada" | "En Tránsito" | "Completada";

export type HTTPValidationError = {
  detail?: Array<ValidationError>;
};

export type InsumoCreate = {
  nombre: string;
  categoria: CategoriaInsumoEnum;
  unidad_medida?: UnidadMedidaEnum;
  peso_unitario_kg?: number;
  volumen_unitario_m3?: number;
  stock_actual?: number;
  stock_minimo?: number;
  precio_unitario?: number;
};

export type InsumoCriticoResponse = {
  insumo: InsumoResponse;
  stock_deficit: number;
  puntos_en_riesgo: Array<{
    [key: string]: unknown;
  }>;
};

export type InsumoResponse = {
  nombre: string;
  categoria: CategoriaInsumoEnum;
  unidad_medida?: UnidadMedidaEnum;
  peso_unitario_kg?: number;
  volumen_unitario_m3?: number;
  stock_actual?: number;
  stock_minimo?: number;
  precio_unitario?: number;
  id: number;
  created_at: string;
};

export type InsumoUpdate = {
  nombre?: string | null;
  categoria?: CategoriaInsumoEnum | null;
  unidad_medida?: UnidadMedidaEnum | null;
  peso_unitario_kg?: number | null;
  volumen_unitario_m3?: number | null;
  stock_actual?: number | null;
  stock_minimo?: number | null;
  precio_unitario?: number | null;
};

export type KPIResumenResponse = {
  otif_porcentaje: number;
  otif_detalle: {
    [key: string]: unknown;
  };
  rentabilidad_por_ruta: {
    [key: string]: unknown;
  };
  tasa_mermas: number;
  mermas_detalle: {
    [key: string]: unknown;
  };
  cumplimiento_contratos_porcentaje: number;
  cumplimiento_contratos_detalle: {
    [key: string]: unknown;
  };
  total_rutas: number;
  total_despachos: number;
  total_contratos: number;
};

export type PersonalCreate = {
  nombre: string;
  especialidad?: EspecialidadEnum;
  acreditado?: boolean;
  disponible?: boolean;
};

export type PersonalResponse = {
  nombre: string;
  especialidad?: EspecialidadEnum;
  acreditado?: boolean;
  disponible?: boolean;
  id: number;
};

export type PersonalUpdate = {
  nombre?: string | null;
  especialidad?: EspecialidadEnum | null;
  acreditado?: boolean | null;
  disponible?: boolean | null;
};

export type PuntoServicioCreate = {
  nombre_cliente: string;
  direccion?: string | null;
  zona_reparto?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  metros_cuadrados_atendidos?: number | null;
  requiere_personal_acreditado?: boolean;
  contrato_validado?: boolean;
};

export type PuntoServicioResponse = {
  nombre_cliente: string;
  direccion?: string | null;
  zona_reparto?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  metros_cuadrados_atendidos?: number | null;
  requiere_personal_acreditado?: boolean;
  contrato_validado?: boolean;
  id: number;
  created_at: string;
};

export type PuntoServicioUpdate = {
  nombre_cliente?: string | null;
  direccion?: string | null;
  zona_reparto?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  metros_cuadrados_atendidos?: number | null;
  requiere_personal_acreditado?: boolean | null;
  contrato_validado?: boolean | null;
};

export type RutaCreate = {
  codigo_vehiculo: string;
  conductor_id?: number | null;
  capacidad_peso_max_kg?: number;
  capacidad_volumen_max_m3?: number;
  es_multiparada?: boolean;
};

export type RutaResponse = {
  codigo_vehiculo: string;
  conductor_id?: number | null;
  capacidad_peso_max_kg?: number;
  capacidad_volumen_max_m3?: number;
  es_multiparada?: boolean;
  id: number;
  peso_actual_carga: number;
  valor_mercaderia_total: number;
  estado: EstadoRutaEnum;
  created_at: string;
};

export type RutaUpdate = {
  codigo_vehiculo?: string | null;
  conductor_id?: number | null;
  capacidad_peso_max_kg?: number | null;
  capacidad_volumen_max_m3?: number | null;
  peso_actual_carga?: number | null;
  valor_mercaderia_total?: number | null;
  es_multiparada?: boolean | null;
  estado?: EstadoRutaEnum | null;
};

export type UnidadMedidaEnum = "unidad" | "caja" | "caneca" | "litro";

export type ValidarAcreditacionResponse = {
  personal_disponible_acreditado: Array<PersonalResponse>;
  total: number;
  filtro_especialidad?: string | null;
  filtro_requiere_acreditado?: boolean;
};

export type ValidationError = {
  loc: Array<string | number>;
  msg: string;
  type: string;
  input?: unknown;
  ctx?: {};
};
