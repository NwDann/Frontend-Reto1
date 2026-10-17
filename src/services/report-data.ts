import type { State } from "../lib/model.ts";
import { alerts, supplierScore } from "../lib/model.ts";
import {
  clientFor,
  financialSummary,
  inventoryHealth,
  vehicleChecks,
} from "../lib/enterprise.ts";
import { forecastClient } from "../lib/demand.ts";
import { warehouseFor } from "../lib/logistics.ts";
import { packagingLabel, containedQuantity } from "../lib/units.ts";
export type Cell = string | number | boolean | null;
export type ReportSection = {
  title: string;
  columns: string[];
  rows: Cell[][];
  note?: string;
};
export const REPORTS = {
  summary: "Vista general",
  routes: "Optimización de rutas",
  inventory: "Inventario",
  purchases: "Compras",
  tracking: "Trazabilidad",
  points: "Ubicaciones",
  fleet: "Gestión de flota",
  demand: "Predicción de demanda",
  suppliers: "Proveedores",
  alerts: "Alertas",
  all: "Todos los módulos",
};
export type ReportType = keyof typeof REPORTS;
export function reportData(s: State, type: ReportType): ReportSection[] {
  if (type === "all")
    return (Object.keys(REPORTS) as ReportType[])
      .filter((k) => k !== "all")
      .flatMap((k) => reportData(s, k));
  const e = s.enterprise!,
    item = (id: string) => s.items.find((i) => i.id === id),
    point = (id: string) => s.points.find((p) => p.id === id),
    supplier = (id: string) =>
      s.suppliers.find((p) => p.id === id)?.nombre || id;
  switch (type) {
    case "summary": {
      const f = financialSummary(s);
      return [
        {
          title: "Resumen de la operación",
          columns: ["Indicador", "Valor", "Unidad / contexto"],
          rows: [
            [
              "Empresa",
              s.company.name,
              s.company.demo ? "Datos sintéticos" : "Datos registrados",
            ],
            ["Fecha de corte", s.updatedAt, "ISO 8601"],
            [
              "Valor de inventario",
              s.items.reduce(
                (a, i) => a + i.stock_actual * i.precio_unitario,
                0,
              ),
              "USD",
            ],
            ["Presupuesto de inventario", e.finance.inventoryBudget, "USD"],
            [
              "Rutas abiertas",
              s.routes.filter((r) => r.estado !== "Completada").length,
              "rutas",
            ],
            [
              "Compras abiertas",
              s.purchases.filter(
                (p) => !["Recibida", "Rechazada"].includes(p.estado),
              ).length,
              "solicitudes",
            ],
            [
              "Cuenta de inventario",
              e.finance.inventoryAccount,
              "Cuenta configurada por la empresa",
            ],
            [
              "Cuenta de consumo",
              e.finance.consumptionAccount,
              "Cuenta configurada por la empresa",
            ],
            ["Margen objetivo", e.finance.targetMargin, "%"],
            [
              "Cobertura de inventario",
              f.coverage === null ? null : Number(f.coverage.toFixed(1)),
              "Días estimados",
            ],
            [
              "Estado del inventario",
              f.inventoryStatus,
              "Comparado con los parámetros del espacio",
            ],
            [
              "Estado de rutas",
              f.routeStatus,
              "Según validaciones y presupuesto",
            ],
            ["Costo rutas del mes", f.monthCost, "USD estimados"],
            [
              "Presupuesto utilizado",
              f.budgetPercent === null
                ? null
                : Number(f.budgetPercent.toFixed(1)),
              "%",
            ],
          ],
        },
      ];
    }
    case "inventory":
      return [
        {
          title: "Inventario",
          columns: [
            "Código",
            "Insumo",
            "Categoría",
            "Unidad de stock",
            "Contenido por agrupación",
            "Stock",
            "Equivalencia de stock",
            "Mínimo",
            "Precio por unidad USD",
            "Valor stock USD",
            "Vencimiento registrado",
            "Estado",
          ],
          rows: s.items.map((i) => [
            i.id,
            i.nombre,
            i.categoria,
            i.unidad_medida,
            packagingLabel(i),
            i.stock_actual,
            containedQuantity(i, i.stock_actual) || "",
            i.stock_minimo,
            i.precio_unitario,
            Number((i.stock_actual * i.precio_unitario).toFixed(2)),
            i.vencimiento || "",
            inventoryHealth(s, i).state,
          ]),
          note: "Stock, mínimo, precio, peso y volumen se expresan en la unidad de stock. El contenido de una agrupación es informativo; no convierte automáticamente cantidades.",
        },
        {
          title: "Stock por ubicación",
          columns: [
            "Insumo",
            "Ubicación",
            "Cantidad",
            "Unidad",
            "Vencimiento registrado",
          ],
          rows: e.balances.map((b) => [
            item(b.itemId)?.nombre || b.itemId,
            b.locationId === "warehouse"
              ? warehouseFor(s).nombre_cliente
              : point(b.locationId)?.nombre_cliente || b.locationId,
            b.quantity,
            item(b.itemId)?.unidad_medida || "",
            b.expiry || "",
          ]),
        },
      ];
    case "purchases":
      return [
        {
          title: "Solicitudes de compra",
          columns: [
            "Solicitud",
            "Fecha",
            "Insumo",
            "Proveedor",
            "Solicitado",
            "Unidad",
            "Recibido",
            "Estado",
            "Prioridad",
            "Precio USD",
            "Motivo",
            "Vehículo",
            "Conductor",
            "Despachador",
            "Receptor",
          ],
          rows: s.purchases.map((p) => [
            p.id,
            p.fecha,
            item(p.item)?.nombre || p.item,
            supplier(p.supplier),
            p.cantidad,
            item(p.item)?.unidad_medida || "",
            p.receivedQuantity ?? null,
            p.estado,
            p.prioridad,
            p.unitPrice ?? null,
            p.motivo,
            p.responsibility?.vehicle || "",
            p.responsibility?.driver || "",
            p.responsibility?.dispatcher || "",
            p.responsibility?.receiver || "",
          ]),
        },
      ];
    case "tracking":
      return [
        {
          title: "Guías y entregas",
          columns: [
            "Guía",
            "Fecha",
            "Destino",
            "Insumo",
            "Despachado",
            "Entregado",
            "Unidad",
            "Estado",
            "Vehículo",
            "Conductor",
            "Despachador",
            "Receptor",
            "Documento",
            "Observaciones",
          ],
          rows: s.dispatches.flatMap((d) =>
            d.lines.map((l) => [
              d.id,
              d.fecha,
              point(d.point)?.nombre_cliente || d.point,
              item(l.insumo_id)?.nombre || l.insumo_id,
              l.cantidad,
              l.entregado ?? l.recibido ?? null,
              item(l.insumo_id)?.unidad_medida || "",
              d.estado,
              d.responsibility?.vehicle || "",
              d.responsibility?.driver || "",
              d.responsibility?.dispatcher || "",
              d.responsibility?.receiver || "",
              d.document || "",
              d.notas || "",
            ]),
          ),
        },
        {
          title: "Movimientos",
          columns: [
            "Movimiento",
            "Fecha",
            "Tipo",
            "Insumo",
            "Cantidad",
            "Unidad",
            "Origen",
            "Destino",
            "Referencia",
            "Conductor",
            "Despachador",
            "Receptor",
          ],
          rows: s.movements.map((m) => [
            m.id,
            m.fecha,
            m.tipo,
            item(m.item)?.nombre || m.item,
            m.cantidad,
            item(m.item)?.unidad_medida || "",
            m.origen,
            m.destino,
            m.referencia,
            m.responsibility?.driver || "",
            m.responsibility?.dispatcher || "",
            m.responsibility?.receiver || "",
          ]),
        },
      ];
    case "points":
      return [
        {
          title: "Ubicaciones y contactos",
          columns: [
            "Código",
            "Nombre",
            "Tipo",
            "Dirección",
            "Zona",
            "Latitud",
            "Longitud",
            "Frecuencia semanal",
            "Próxima visita prospecto",
            "Contacto",
            "Cargo",
            "Teléfono",
            "Correo",
            "Horario",
          ],
          rows: [
            [
              "warehouse",
              warehouseFor(s).nombre_cliente,
              "Bodega central",
              warehouseFor(s).direccion || "",
              "",
              warehouseFor(s).latitud,
              warehouseFor(s).longitud,
              0,
              "",
              ...["name", "role", "phone", "email", "hours"].map(
                (k) =>
                  clientFor(s, "warehouse").contact[
                    k as keyof ReturnType<typeof clientFor>["contact"]
                  ],
              ),
            ],
            ...s.points.map((p) => {
              const c = clientFor(s, p.id);
              return [
                p.id,
                p.nombre_cliente,
                c.kind,
                p.direccion,
                p.zona_reparto,
                p.latitud,
                p.longitud,
                c.frequency,
                c.kind === "prospect" ? c.nextService : "",
                c.contact.name,
                c.contact.role,
                c.contact.phone,
                c.contact.email,
                c.contact.hours,
              ];
            }),
          ],
        },
      ];
    case "fleet":
      return [
        {
          title: "Flota",
          columns: [
            "ID",
            "Placa",
            "Nombre",
            "Tipo",
            "Propiedad",
            "Activo",
            "Capacidad kg",
            "Capacidad m3",
            "Odómetro km",
            "Fijo mensual USD",
            "Revisión hasta",
            "Póliza hasta",
            "Mantenimiento previsto",
            "Conductor",
            "Acreditado",
            "Apto químicos",
          ],
          rows: e.vehicles.map((v) => {
            const c = vehicleChecks(s, v);
            return [
              v.id,
              v.plate,
              v.name,
              v.type,
              v.ownership,
              v.active,
              v.capacityKg,
              v.capacityM3,
              v.odometer,
              v.fixedMonthly,
              v.technicalUntil,
              v.insuranceUntil,
              v.maintenanceDate,
              c.driver?.name || "",
              c.accredited,
              v.chemicalAllowed,
            ];
          }),
        },
        {
          title: "Gastos de flota",
          columns: ["Fecha", "Vehículo", "Categoría", "Importe USD", "Detalle"],
          rows: e.costs.map((c) => [
            c.date,
            e.vehicles.find((v) => v.id === c.vehicleId)?.plate || c.vehicleId,
            c.category,
            c.amount,
            c.detail,
          ]),
        },
        {
          title: "Viajes completados",
          columns: [
            "ID",
            "Fecha",
            "Vehículo",
            "Ruta",
            "Kilómetros",
            "Minutos",
            "Peajes USD",
          ],
          rows: e.trips.map((t) => [
            t.id,
            t.date,
            e.vehicles.find((v) => v.id === t.vehicleId)?.plate || t.vehicleId,
            t.routeId || "",
            t.km,
            t.minutes,
            t.tolls,
          ]),
        },
      ];
    case "routes":
      return [
        {
          title: "Planes guardados",
          columns: [
            "Plan",
            "Nombre",
            "Fecha",
            "Estado",
            "Vehículo",
            "Origen",
            "Destinos en orden",
            "Modo",
            "Kilómetros",
            "Minutos",
            "Costo transporte USD",
            "Riesgo interno",
            "Viable",
          ],
          rows: s.routes.map((r) => {
            const sc = r.scenario as any;
            return [
              r.id,
              r.nombre,
              r.date,
              r.estado,
              r.vehicle,
              r.snapshot?.origin.nombre_cliente ||
                sc.origin?.nombre_cliente ||
                "Ver plan legado",
              sc.order
                .map(
                  (id: string) =>
                    r.snapshot?.destinations.find((p) => p.id === id)
                      ?.nombre_cliente ||
                    point(id)?.nombre_cliente ||
                    id,
                )
                .join(" → "),
              sc.mode || "",
              sc.distance,
              sc.minutes,
              sc.cost,
              sc.risk,
              sc.feasible,
            ];
          }),
        },
        {
          title: "Detalles de planes guardados",
          columns: ["Plan", "Categoría", "Parámetro", "Valor"],
          rows: s.routes.flatMap((r) => {
            const sc = r.scenario as any;
            return [
              ...Object.entries(sc.inputs || {}).map(
                ([k, v]) =>
                  [
                    r.id,
                    "Entrada",
                    k,
                    typeof v === "object" ? JSON.stringify(v) : v,
                  ] as Cell[],
              ),
              ...(sc.components || []).map(
                (c: { label: string; value: number }) =>
                  [r.id, "Costo USD", c.label, c.value] as Cell[],
              ),
            ];
          }),
          note: "Los planes nuevos conservan sus entradas y contactos al momento del cálculo. Los planes antiguos sin instantánea no permiten reconstruir información que no se guardó.",
        },
      ];
    case "demand": {
      const rows: Cell[][] = [];
      for (const p of s.points)
        for (const i of s.items) {
          const f = forecastClient(s, p.id, i.id, 4);
          if (f.rows.length)
            rows.push([
              p.nombre_cliente,
              i.nombre,
              i.unidad_medida,
              f.synthetic ? "Sintético" : "Real importado",
              f.rows.length,
              f.ready ? f.method : "Histórico insuficiente",
              f.ready ? f.total : null,
              f.ready ? f.mae : null,
              f.ready ? f.wape : null,
              f.ready ? f.low : null,
              f.ready ? f.high : null,
            ]);
        }
      return [
        {
          title: "Demanda por cliente - cuatro semanas",
          columns: [
            "Cliente",
            "Insumo",
            "Unidad",
            "Origen histórico",
            "Semanas",
            "Modelo",
            "Demanda 4 semanas",
            "MAE validación",
            "WAPE %",
            "Sensibilidad baja",
            "Sensibilidad alta",
          ],
          rows,
          note: "Se validan tres modelos con cuatro semanas reservadas. El rango de sensibilidad no es un intervalo probabilístico. El stock es compartido; no se reserva por esta proyección.",
        },
        {
          title: "Histórico de demanda",
          columns: [
            "Cliente",
            "Insumo",
            "Semana",
            "Cantidad",
            "Servicios",
            "Área m2",
            "Origen",
          ],
          rows: e.demand.map((d) => [
            point(d.clientId)?.nombre_cliente || d.clientId,
            item(d.itemId)?.nombre || d.itemId,
            d.week,
            d.quantity,
            d.visits,
            d.area,
            d.source,
          ]),
        },
      ];
    }
    case "suppliers":
      return [
        {
          title: "Proveedores",
          columns: [
            "ID",
            "Proveedor",
            "RUC",
            "Categoría",
            "Dirección",
            "Contacto",
            "Teléfono",
            "Correo",
            "Plazo días",
            "Evaluaciones",
            "Puntaje 0-100",
            "Condiciones pago",
          ],
          rows: s.suppliers.map((p) => [
            p.id,
            p.nombre,
            p.ruc || "",
            p.categoria,
            p.direccion || "",
            p.contacto || "",
            p.telefono || "",
            p.email,
            p.lead,
            p.evaluations.length,
            p.evaluations.length ? supplierScore(p) : null,
            p.paymentTerms || "",
          ]),
        },
        {
          title: "Evaluaciones de proveedores",
          columns: [
            "Proveedor",
            "Referencia",
            "Servicio",
            "Fecha",
            "Puntualidad 1-5",
            "Calidad 1-5",
            "Costo 1-5",
            "Observación",
          ],
          rows: s.suppliers.flatMap((p) =>
            p.evaluations.map((v) => [
              p.nombre,
              v.referenceId || "",
              v.service,
              v.fecha,
              v.puntualidad,
              v.calidad,
              v.costo,
              v.observacion,
            ]),
          ),
        },
      ];
    case "alerts":
      return [
        {
          title: "Alertas operativas",
          columns: ["ID", "Tipo", "Título", "Detalle", "Perfil", "Revisada"],
          rows: alerts(s).map((a: any) => [
            a.id,
            a.severity || "",
            a.title || "",
            a.detail || "",
            a.roles.join(", "),
            s.reviewed.includes(a.id),
          ]),
        },
      ];
  }
}
