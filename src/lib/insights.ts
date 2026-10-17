import type { Snapshot } from "./models.ts";
export function inventoryValue(s: Snapshot) {
  return (
    s.items?.reduce((sum, i) => sum + i.stock_actual * i.precio_unitario, 0) ??
    null
  );
}
export function dispatchState(d: {
  fecha_entrega_real?: string | null;
  estado_produccion: string;
}) {
  return d.fecha_entrega_real
    ? "Entrega registrada"
    : d.estado_produccion === "Apurado/Urgente"
      ? "Producción urgente"
      : "Pendiente de entrega";
}
export function replenishment(s: Snapshot) {
  return (s.items || []).map((item) => ({
    item,
    deficit: Math.max(0, item.stock_minimo - item.stock_actual),
    api: s.critical?.find((c) => c.insumo.id === item.id),
  }));
}
export function operationalAlerts(s: Snapshot, now = Date.now()) {
  const rows: {
    id: string;
    title: string;
    detail: string;
    severity: "Crítica" | "Revisar";
    roles: string[];
    page: string;
  }[] = [];
  for (const i of s.items || [])
    if (i.stock_actual < i.stock_minimo)
      rows.push({
        id: `stock-${i.id}`,
        title: `Stock bajo: ${i.nombre}`,
        detail: `Stock ${i.stock_actual}; mínimo ${i.stock_minimo} ${i.unidad_medida}.`,
        severity: "Crítica",
        roles: ["Bodega", "Compras", "Gerencia"],
        page: "inventory",
      });
  for (const d of s.dispatches || [])
    if (!d.fecha_entrega_real) {
      const late = d.fecha_programada && Date.parse(d.fecha_programada) < now;
      if (late || d.estado_produccion === "Apurado/Urgente")
        rows.push({
          id: `dispatch-${d.id}`,
          title: `Despacho #${d.id}: ${late ? "fecha programada superada" : "producción urgente"}`,
          detail:
            "Revisa la entrega y la programación en el backend. La falta de fecha real no confirma una pérdida física.",
          severity: late ? "Crítica" : "Revisar",
          roles: ["Logística", "Bodega", "Gerencia"],
          page: "tracking",
        });
    }
  for (const p of s.points || [])
    if (!p.contrato_validado)
      rows.push({
        id: `contract-${p.id}`,
        title: `Contrato por validar: ${p.nombre_cliente}`,
        detail: "El punto de servicio tiene contrato_validado=false.",
        severity: "Revisar",
        roles: ["Logística", "Gerencia"],
        page: "points",
      });
  for (const r of s.routes || [])
    if (r.estado !== "Completada") {
      const driver = s.staff?.find((p) => p.id === r.conductor_id);
      if (!driver || !driver.disponible)
        rows.push({
          id: `staff-${r.id}`,
          title: `Revisar responsable de ruta #${r.id}`,
          detail: driver
            ? `${driver.nombre} figura no disponible.`
            : "El conductor no está asignado o no pudo consultarse.",
          severity: "Revisar",
          roles: ["Logística", "Gerencia"],
          page: "fleet",
        });
    }
  return rows;
}
