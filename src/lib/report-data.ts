import type { Snapshot } from "./models.ts";
import { dispatchState, operationalAlerts } from "./insights.ts";
export type Cell = string | number | boolean | null | undefined;
export type ReportSection = {
  title: string;
  columns: string[];
  rows: Cell[][];
  note?: string;
};
export const REPORTS = {
  dashboard: "Vista general",
  inventory: "Inventario",
  tracking: "Trazabilidad",
  points: "Ubicaciones y contratos",
  fleet: "Flota y personal",
  demand: "Histórico de solicitudes",
  routes: "Rutas guardadas",
  alerts: "Alertas",
  all: "Todos los datos disponibles",
};
export type ReportType = keyof typeof REPORTS;
export function reportSections(s: Snapshot, type: ReportType): ReportSection[] {
  const item = (id: number) => s.items?.find((i) => i.id === id),
    point = (id: number) => s.points?.find((p) => p.id === id),
    staff = (id: number | null) => s.staff?.find((p) => p.id === id);
  if (type === "all")
    return (Object.keys(REPORTS) as ReportType[])
      .filter((k) => k !== "all")
      .flatMap((k) => reportSections(s, k));
  switch (type) {
    case "dashboard":
      return [
        {
          title: "Indicadores publicados por FastAPI",
          columns: ["Indicador", "Valor", "Interpretación / fuente"],
          rows: [
            [
              "OTIF %",
              s.kpis?.otif_porcentaje ?? null,
              "A tiempo y completo, según el cálculo del backend",
            ],
            [
              "Contratos %",
              s.kpis?.cumplimiento_contratos_porcentaje ?? null,
              "Regla del backend",
            ],
            [
              "Proxy stock bajo %",
              s.kpis?.tasa_mermas ?? null,
              "El campo tasa_mermas no mide pérdidas físicas",
            ],
            ["Total rutas", s.kpis?.total_rutas ?? null, "/api/kpis/resumen"],
            [
              "Total despachos",
              s.kpis?.total_despachos ?? null,
              "/api/kpis/resumen",
            ],
            [
              "Total contratos",
              s.kpis?.total_contratos ?? null,
              "/api/kpis/resumen",
            ],
            [
              "Valor inventario USD",
              s.items?.reduce(
                (sum, i) => sum + i.stock_actual * i.precio_unitario,
                0,
              ) ?? null,
              "Cálculo frontend: stock × precio unitario",
            ],
            ...Object.entries(s.kpis?.rentabilidad_por_ruta || {}).map(
              ([k, v]) =>
                [
                  k,
                  typeof v === "number" ? v : JSON.stringify(v),
                  "Valor de mercadería por umbral, no utilidad",
                ] as Cell[],
            ),
          ],
        },
      ];
    case "inventory":
      return [
        {
          title: "Inventario",
          columns: [
            "ID",
            "Insumo",
            "Categoría",
            "Unidad",
            "Stock",
            "Mínimo",
            "Precio USD",
            "Valor stock USD",
            "Peso por unidad kg",
            "Volumen por unidad m3",
          ],
          rows: (s.items || []).map((i) => [
            i.id,
            i.nombre,
            i.categoria,
            i.unidad_medida,
            i.stock_actual,
            i.stock_minimo,
            i.precio_unitario,
            i.stock_actual * i.precio_unitario,
            i.peso_unitario_kg,
            i.volumen_unitario_m3,
          ]),
          note: "Saldos globales del backend. No incluye bodegas, lotes ni contenido de agrupaciones.",
        },
        {
          title: "Críticos publicados",
          columns: ["Insumo", "Déficit", "Unidad", "Puntos en riesgo JSON"],
          rows: (s.critical || []).map((c) => [
            c.insumo.nombre,
            c.stock_deficit,
            c.insumo.unidad_medida,
            JSON.stringify(c.puntos_en_riesgo),
          ]),
        },
      ];
    case "tracking":
      return [
        {
          title: "Despachos",
          columns: [
            "ID",
            "Cliente",
            "Ruta",
            "Programada ISO",
            "Entrega real ISO",
            "Producción",
            "Estado derivado",
            "Costo envío USD",
          ],
          rows: (s.dispatches || []).map((d) => [
            d.id,
            point(d.punto_servicio_id)?.nombre_cliente ||
              `#${d.punto_servicio_id}`,
            d.ruta_id,
            d.fecha_programada,
            d.fecha_entrega_real,
            d.estado_produccion,
            dispatchState(d),
            d.costo_envio,
          ]),
          note: "El backend no devuelve cantidades efectivamente entregadas ni responsables de despacho/recepción.",
        },
        {
          title: "Detalle de despachos",
          columns: [
            "Despacho",
            "Detalle ID",
            "Insumo",
            "Solicitado",
            "Unidad",
            "Promoción",
          ],
          rows: (s.dispatches || []).flatMap((d) =>
            (d.detalles || []).map((l) => [
              d.id,
              l.id,
              item(l.insumo_id)?.nombre || `#${l.insumo_id}`,
              l.cantidad_solicitada,
              item(l.insumo_id)?.unidad_medida || "",
              l.es_promocion,
            ]),
          ),
        },
      ];
    case "points":
      return [
        {
          title: "Puntos de servicio",
          columns: [
            "ID",
            "Cliente",
            "Dirección",
            "Zona",
            "Latitud",
            "Longitud",
            "Área m2",
            "Contrato validado",
            "Requiere acreditación",
          ],
          rows: (s.points || []).map((p) => [
            p.id,
            p.nombre_cliente,
            p.direccion ?? null,
            p.zona_reparto ?? null,
            p.latitud ?? null,
            p.longitud ?? null,
            p.metros_cuadrados_atendidos ?? null,
            p.contrato_validado,
            p.requiere_personal_acreditado,
          ]),
        },
        {
          title: "Contratos",
          columns: ["ID", "Punto de servicio", "Acuerdo", "Vigente", "Adenda"],
          rows: (s.contracts || []).map((c) => [
            c.id,
            point(c.punto_servicio_id)?.nombre_cliente || c.punto_servicio_id,
            c.detalles_acuerdo ?? null,
            c.vigente ?? null,
            c.tiene_adenda ?? null,
          ]),
        },
      ];
    case "routes":
      return [
        {
          title: "Rutas del backend",
          columns: [
            "ID",
            "Vehículo",
            "Conductor",
            "Capacidad kg",
            "Capacidad m3",
            "Peso actual kg",
            "Mercadería USD",
            "Multiparada",
            "Estado",
            "Creada ISO",
          ],
          rows: (s.routes || []).map((r) => [
            r.id,
            r.codigo_vehiculo,
            staff(r.conductor_id)?.nombre || r.conductor_id,
            r.capacidad_peso_max_kg,
            r.capacidad_volumen_max_m3,
            r.peso_actual_carga,
            r.valor_mercaderia_total,
            r.es_multiparada,
            r.estado,
            r.created_at,
          ]),
          note: "El backend no conserva orden optimizado ni parámetros de costos. El análisis del simulador se descarga desde su propia pantalla.",
        },
      ];
    case "fleet":
      return [
        {
          title: "Personal",
          columns: ["ID", "Nombre", "Especialidad", "Acreditado", "Disponible"],
          rows: (s.staff || []).map((p) => [
            p.id,
            p.nombre,
            p.especialidad,
            p.acreditado,
            p.disponible,
          ]),
        },
        {
          title: "Capacidad en rutas",
          columns: [
            "Ruta",
            "Vehículo",
            "Capacidad kg",
            "Carga registrada kg",
            "Ocupación peso %",
          ],
          rows: (s.routes || []).map((r) => [
            r.id,
            r.codigo_vehiculo,
            r.capacidad_peso_max_kg,
            r.peso_actual_carga,
            r.capacidad_peso_max_kg > 0
              ? (r.peso_actual_carga / r.capacidad_peso_max_kg) * 100
              : null,
          ]),
          note: "Códigos usados en operaciones; no representa un catálogo de flota ni historial de mantenimiento.",
        },
      ];
    case "demand":
      return [
        {
          title: "Solicitudes por cliente e insumo",
          columns: [
            "Despacho",
            "Cliente",
            "Fecha programada ISO",
            "Insumo",
            "Unidad",
            "Cantidad solicitada",
            "Fecha entrega real ISO",
          ],
          rows: (s.dispatches || []).flatMap((d) =>
            (d.detalles || []).map((l) => [
              d.id,
              point(d.punto_servicio_id)?.nombre_cliente || d.punto_servicio_id,
              d.fecha_programada,
              item(l.insumo_id)?.nombre || l.insumo_id,
              item(l.insumo_id)?.unidad_medida || "",
              l.cantidad_solicitada,
              d.fecha_entrega_real,
            ]),
          ),
          note: "Pedidos del backend. No equivale a consumos confirmados ni a un pronóstico de IA.",
        },
      ];
    case "alerts":
      return [
        {
          title: "Alertas derivadas",
          columns: [
            "Referencia",
            "Título",
            "Detalle",
            "Severidad",
            "Áreas",
            "Módulo",
          ],
          rows: operationalAlerts(s).map((a) => [
            a.id,
            a.title,
            a.detail,
            a.severity,
            a.roles.join(", "),
            a.page,
          ]),
          note: "Alertas calculadas sobre registros consultados. Los perfiles son filtros de visualización, no permisos de acceso.",
        },
      ];
  }
}
