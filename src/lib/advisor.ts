import type { State } from "./model.ts";
import {
  clientFor,
  financialSummary,
  inventoryHealth,
  vehicleChecks,
  vehicleTrips,
  kindLabel,
} from "./enterprise.ts";
import { forecastClient } from "./demand.ts";
const clean = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const cash = (v: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    v,
  );
export function answerRecords(s: State, q: string) {
  const query = clean(q.trim()),
    tokens = query
      .split(/[^a-z0-9-]+/)
      .filter(
        (w) =>
          w.length > 2 &&
          ![
            "que",
            "del",
            "los",
            "las",
            "para",
            "por",
            "con",
            "una",
            "hay",
            "como",
            "cual",
            "mis",
            "tengo",
            "dame",
            "muestra",
            "muestrame",
            "puedes",
          ].includes(w),
      );
  if (!query)
    return {
      text: "Escribe el nombre o código de un insumo, cliente, guía, vehículo o solicitud.",
      sources: [],
    };
  const matchedItem = s.items.filter(
      (i) =>
        query.includes(clean(i.id)) ||
        clean(i.nombre)
          .split(" ")
          .some((w) => w.length > 4 && query.includes(w)),
    ),
    matchedClient = s.points.filter(
      (p) =>
        query.includes(clean(p.id)) ||
        clean(p.nombre_cliente)
          .split(" ")
          .some((w) => w.length > 4 && query.includes(w)),
    );
  const rows: { text: string; source: string }[] = [],
    add = (text: string, source: string) => rows.push({ text, source });
  if (/^(hola|buenas|hey|buenos dias)[ !.]*$/.test(query))
    return {
      text: `Hola. Estoy conectado a ${s.company.name}. Puedes consultar existencias, compras pendientes, entregas con diferencias, costos de rutas, clientes, vencimientos de flota y predicciones por cliente. Prueba: “¿Cuánto desinfectante hay?” o “¿Qué vehículos tienen obligaciones pendientes?”.`,
      sources: ["Guía de Nexo"],
    };
  if (/diferenc|inconsisten|guia|entreg/.test(query))
    for (const d of s.dispatches.filter(
      (d) =>
        !tokens.some((t) => t.startsWith("gr-")) || query.includes(clean(d.id)),
    )) {
      if (
        /diferenc|inconsisten/.test(query) &&
        !d.lines.some(
          (l) =>
            d.estado === "Entregada" &&
            (l.entregado ?? l.recibido) !== l.cantidad,
        )
      )
        continue;
      add(
        `${d.id} · ${s.points.find((p) => p.id === d.point)?.nombre_cliente}: ${d.estado}. ${d.lines.map((l) => `${s.items.find((i) => i.id === l.insumo_id)?.nombre}: solicitado ${l.cantidad}, entregado ${l.entregado ?? l.recibido ?? "pendiente"}`).join("; ")}. Conductor: ${d.responsibility?.driver || "sin registrar"}; despachador: ${d.responsibility?.dispatcher || "sin registrar"}; receptor: ${d.responsibility?.receiver || "sin registrar"}.`,
        `${d.id} · Trazabilidad`,
      );
    }
  else if (/compra|solicitud|pedido/.test(query))
    for (const p of s.purchases.filter((p) =>
      /pendient|abiert|proceso/.test(query)
        ? !["Recibida", "Rechazada"].includes(p.estado)
        : true,
    )) {
      if (matchedItem.length && !matchedItem.some((i) => i.id === p.item))
        continue;
      add(
        `${p.id}: ${s.items.find((i) => i.id === p.item)?.nombre}, ${p.cantidad} ${s.items.find((i) => i.id === p.item)?.unidad_medida}; ${p.estado}. Proveedor: ${s.suppliers.find((x) => x.id === p.supplier)?.nombre}. Importe de referencia: ${cash(p.cantidad * (p.unitPrice ?? s.items.find((i) => i.id === p.item)?.precio_unitario ?? 0))}.`,
        `${p.id} · Compras`,
      );
    }
  else if (/demanda|predic|pronostic|consum.*seman/.test(query)) {
    const clients = matchedClient.length
        ? matchedClient
        : s.points
            .filter((p) => clientFor(s, p.id).kind !== "prospect")
            .slice(0, 3),
      items = matchedItem.length ? matchedItem : s.items.slice(0, 2),
      h = Number(query.match(/(\d+)\s*seman/)?.[1] || 4);
    for (const p of clients)
      for (const i of items) {
        const f = forecastClient(s, p.id, i.id, Math.max(1, Math.min(12, h)));
        add(
          `${p.nombre_cliente} · ${i.nombre}: ${f.ready ? `${f.total.toFixed(1)} ${i.unidad_medida} para ${h} semanas; ${f.method}, error de validación ${f.mae.toFixed(2)} ${i.unidad_medida}/semana.` : "Histórico insuficiente o semanas incompletas."} ${f.synthetic ? "Datos sintéticos de demostración." : ""}`,
          `${p.id} / ${i.id} · Predicción por cliente`,
        );
      }
  } else if (
    /flota|vehicul|placa|mantenimiento|revision|conductor/.test(query) ||
    s.enterprise!.vehicles.some(
      (v) => query.includes(clean(v.plate)) || query.includes(clean(v.id)),
    )
  )
    for (const v of s.enterprise!.vehicles) {
      if (
        /pba-|pbc-|vh-/.test(query) &&
        !query.includes(clean(v.plate)) &&
        !query.includes(clean(v.id))
      )
        continue;
      const c = vehicleChecks(s, v);
      add(
        `${v.plate} · ${v.name} · ${v.ownership}: ${v.active ? "activo" : "inactivo"}. Revisión técnica ${c.technical ? "vigente" : "por revisar"}; póliza vehicular ${c.insurance ? "vigente" : "por revisar"}; mantenimiento ${c.maintenance ? "al día" : "pendiente"}. Próximo: ${v.maintenanceDate || "sin fecha"} o ${v.maintenanceKm} km. ${vehicleTrips(s, v.id).length} viajes completados este mes; fijos ${cash(v.fixedMonthly)}/mes. Conductor: ${c.driver?.name || "sin asignar"}.`,
        `${v.id} · Flota`,
      );
    }
  else if (/proveedor|riesgo.*prove/.test(query))
    for (const p of [...s.suppliers].sort((a, b) => score(b) - score(a))) {
      add(
        `${p.nombre}: ${p.evaluations.length ? `${score(p).toFixed(0)}/100; riesgo ${score(p) >= 85 ? "bajo" : score(p) >= 70 ? "medio" : "alto"}` : "sin evaluar"}; ${p.evaluations.length} evaluaciones. Plazo registrado ${p.lead} días. ${p.ruc ? "RUC " + p.ruc : "RUC pendiente"}.`,
        `${p.id} · Proveedores`,
      );
    }
  else if (/valor|contab|presupuesto|finanz|capital/.test(query)) {
    const f = financialSummary(s);
    add(
      `Inventario: ${cash(f.value)} · ${f.inventoryStatus}. ${f.budgetPercent === null ? "Configura el presupuesto para compararlo." : `Equivale al ${f.budgetPercent.toFixed(1)}% del presupuesto registrado.`} Cuenta: ${s.enterprise!.finance.inventoryAccount}. El consumo se imputa a ${s.enterprise!.finance.consumptionAccount}. ${f.active.length} rutas activas con ${cash(f.cost)} de transporte estimado.`,
      "Parámetros financieros / Inventario / Rutas",
    );
  } else if (/ruta|flete|transporte/.test(query))
    for (const r of s.routes)
      add(
        `${r.id} · ${r.nombre}: ${r.estado}, vehículo ${r.vehicle}, costo ${cash(r.scenario.cost)}, ${r.scenario.distance.toFixed(1)} km, ${Math.ceil(r.scenario.minutes)} minutos. ${r.scenario.feasible ? "Capacidad viable" : "Revisar capacidad/obligaciones"}.`,
        `${r.id} · Rutas`,
      );
  else if (
    /stock|existenc|insumo|agot|reponer|cuanto|vencim/.test(query) ||
    matchedItem.length
  ) {
    const items = matchedItem.length
      ? matchedItem
      : /vencim/.test(query)
        ? s.items.filter(
            (i) =>
              inventoryHealth(s, i).expiry !== null &&
              inventoryHealth(s, i).expiry! <= 30 &&
              i.stock_actual > 0,
          )
        : /critico|bajo|reponer|falt/.test(query)
          ? s.items.filter((i) => inventoryHealth(s, i).state === "Revisar")
          : s.items;
    for (const i of items) {
      const h = inventoryHealth(s, i);
      add(
        `${i.nombre}: ${i.stock_actual} ${i.unidad_medida}; mínimo ${i.stock_minimo}; estado ${h.state}. ${h.committed} comprometidos y ${h.pending} en compras abiertas. Reposición sugerida ${h.need} ${i.unidad_medida}. ${i.vencimiento ? "Vence: " + i.vencimiento + "." : ""}`,
        `${i.id} · Inventario`,
      );
    }
  } else if (
    matchedClient.length ||
    /cliente|contacto|bodega|ubicacion/.test(query)
  ) {
    for (const p of matchedClient.length ? matchedClient : s.points) {
      const c = clientFor(s, p.id);
      add(
        `${p.nombre_cliente} · ${kindLabel(c.kind)}: ${p.direccion}. Contacto: ${c.contact.name || "pendiente"}; ${c.contact.phone || c.contact.email || "sin teléfono o correo"}. Próximo servicio: ${c.nextService || "sin programar"}.`,
        `${p.id} · Ubicaciones`,
      );
    }
  } else if (/ayuda|funciona|hacer|como/.test(query))
    add(
      "Registra flota y personal en Flota; define bodega y clientes en Ubicaciones. En Inventario consulta existencias y crea referencias con stock cero. Compras registra solicitudes y recepciones. Optimización calcula costo y precio sugerido con los registros. Trazabilidad confirma entregas y responsables. Predicción compara modelos por cliente; muestra el error de validación y si usa datos sintéticos.",
      "Guía de Nexo",
    );
  if (!rows.length) {
    const docs = [
      ...s.items.map((i) => ({
        text: `${i.id} · ${i.nombre}: ${i.stock_actual} ${i.unidad_medida}.`,
        source: "Inventario",
      })),
      ...s.dispatches.map((d) => ({
        text: `${d.id} · ${s.points.find((p) => p.id === d.point)?.nombre_cliente}: ${d.estado}. Vehículo: ${d.responsibility?.vehicle || "sin registrar"}; conductor: ${d.responsibility?.driver || "sin registrar"}.`,
        source: d.id + " · Trazabilidad",
      })),
      ...s.purchases.map((p) => ({
        text: `${p.id} · ${p.estado} · ${s.items.find((i) => i.id === p.item)?.nombre}`,
        source: "Compras",
      })),
      ...s.routes.map((r) => ({
        text: `${r.id} · ${r.nombre} · ${r.estado} · ${r.vehicle}`,
        source: "Rutas",
      })),
    ];
    rows.push(
      ...docs.filter((r) => tokens.some((t) => clean(r.text).includes(t))),
    );
  }
  return {
    text: rows.length
      ? rows
          .slice(0, 16)
          .map((r) => r.text)
          .join("\n\n")
      : "No encontré coincidencias para esa consulta. Prueba con un nombre o código exacto, o pregunta “compras pendientes”, “guías con diferencias”, “flota” o “stock crítico”.",
    sources: [...new Set(rows.slice(0, 16).map((r) => r.source))],
  };
}
function score(p: State["suppliers"][number]) {
  return p.evaluations.length
    ? p.evaluations.reduce(
        (a, e) =>
          a + (0.4 * e.puntualidad + 0.4 * e.calidad + 0.2 * e.costo) * 20,
        0,
      ) / p.evaluations.length
    : 0;
}
