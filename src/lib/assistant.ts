import type { Snapshot } from "./models.ts";
import { normalized, money } from "./format.ts";
export type Answer = {
  text: string;
  sources: {
    label: string;
    resource:
      | "insumos"
      | "despachos"
      | "rutas"
      | "puntos-servicio"
      | "personal"
      | "contratos"
      | "kpis";
    id?: number;
  }[];
};
export function answerRecords(s: Snapshot, query: string): Answer {
  const q = normalized(query),
    sources: Answer["sources"] = [];
  if (
    /vencim|lote|proveedor|compra|seguro|mantenimiento|usuario|rotacion/.test(q)
  )
    return {
      text: "Ese dato no se expone en la API actual. Compras permite preparar borradores sobre el stock consultado; proveedores, usuarios, obligaciones, lotes y rotación contable necesitan sus propias fuentes. No puedo inferir esos datos a partir de un saldo o un código de vehículo.",
      sources,
    };
  const add = (
    label: string,
    resource: Answer["sources"][number]["resource"],
    id?: number,
  ) => sources.push({ label, resource, id });
  if (/stock|inventario|insumo|cloro|quimic|repon/.test(q)) {
    if (!s.items)
      return {
        text: "No se pudo consultar inventario. Actualiza la conexión antes de usar una respuesta.",
        sources,
      };
    let items = s.items.filter(
      (i) =>
        q.includes(normalized(i.nombre)) ||
        normalized(i.nombre)
          .split(" ")
          .some((word) => word.length > 3 && q.includes(word)),
    );
    if (!items.length)
      items = /critic|baj|repon|minim/.test(q)
        ? s.items.filter((i) => i.stock_actual < i.stock_minimo)
        : s.items;
    const lines = items.map((i) => {
      add(`Insumo #${i.id}`, "insumos", i.id);
      return `${i.nombre}: ${i.stock_actual} ${i.unidad_medida}; mínimo ${i.stock_minimo}; déficit ${Math.max(0, i.stock_minimo - i.stock_actual)}; precio ${money(i.precio_unitario)} por ${i.unidad_medida}.`;
    });
    return {
      text: lines.length
        ? lines.join("\n")
        : "Ningún insumo consultado está por debajo de su mínimo. El backend no expone vencimientos ni lotes.",
      sources,
    };
  }
  if (/despacho|entrega|guia|atras|urgente/.test(q)) {
    if (!s.dispatches)
      return { text: "No se pudo consultar despachos.", sources };
    const id = q.match(/(?:#|despacho\s+|guia\s+)(\d+)/)?.[1],
      rows = s.dispatches
        .filter((d) =>
          id
            ? d.id === Number(id)
            : /pendiente|atras|urgente/.test(q)
              ? !d.fecha_entrega_real
              : true,
        )
        .slice(0, 10);
    return {
      text: rows.length
        ? rows
            .map((d) => {
              add(`Despacho #${d.id}`, "despachos", d.id);
              return `Despacho #${d.id}: ${s.points?.find((p) => p.id === d.punto_servicio_id)?.nombre_cliente || `punto #${d.punto_servicio_id}`}, ${d.estado_produccion}; programado ${d.fecha_programada || "sin fecha"}; entrega real ${d.fecha_entrega_real || "no registrada"}. La API no informa cantidades efectivamente entregadas.`;
            })
            .join("\n")
        : "No encontré despachos para esa referencia en los registros consultados.",
      sources,
    };
  }
  if (/ruta|vehiculo|flota|conductor|personal|acredit/.test(q)) {
    if (/personal|acredit|conductor/.test(q)) {
      if (!s.staff) return { text: "No se pudo consultar personal.", sources };
      return {
        text:
          s.staff
            .map((p) => {
              add(`Personal #${p.id}`, "personal", p.id);
              return `${p.nombre}: ${p.especialidad}, ${p.acreditado ? "acreditado" : "sin acreditar"}, ${p.disponible ? "disponible" : "no disponible"}.`;
            })
            .join("\n") || "No hay personal registrado.",
        sources,
      };
    }
    if (!s.routes) return { text: "No se pudo consultar rutas.", sources };
    return {
      text:
        s.routes
          .map((r) => {
            add(`Ruta #${r.id}`, "rutas", r.id);
            return `Ruta #${r.id} · ${r.codigo_vehiculo}: ${r.estado}, ${r.peso_actual_carga}/${r.capacidad_peso_max_kg} kg y ${money(r.valor_mercaderia_total)} de mercadería. No hay mantenimiento ni pólizas en la API.`;
          })
          .join("\n") || "No hay rutas registradas.",
      sources,
    };
  }
  if (/cliente|punto|direccion|ubicacion|contrato/.test(q)) {
    if (!s.points)
      return { text: "No se pudo consultar puntos de servicio.", sources };
    const rows = s.points.filter(
      (p) =>
        q.includes(normalized(p.nombre_cliente)) ||
        normalized(p.nombre_cliente)
          .split(" ")
          .some((w) => w.length > 3 && q.includes(w)),
    );
    const ps = rows.length ? rows : s.points;
    return {
      text:
        ps
          .map((p) => {
            add(`Punto #${p.id}`, "puntos-servicio", p.id);
            return `${p.nombre_cliente}: ${p.direccion || "dirección no registrada"}, zona ${p.zona_reparto || "sin registrar"}, ${p.metros_cuadrados_atendidos ?? "sin dato"} m². Contrato ${p.contrato_validado ? "validado" : "pendiente"}; personal acreditado ${p.requiere_personal_acreditado ? "requerido" : "no requerido"}.`;
          })
          .join("\n") || "No hay puntos registrados.",
      sources,
    };
  }
  if (/otif|kpi|indicador|rentabilidad|merma/.test(q)) {
    if (!s.kpis) return { text: "No se pudo consultar indicadores.", sources };
    add("GET /api/kpis/resumen", "kpis");
    return {
      text: `OTIF: ${s.kpis.otif_porcentaje}%. Cumplimiento de contratos: ${s.kpis.cumplimiento_contratos_porcentaje}%. El indicador de «mermas» (${s.kpis.tasa_mermas}%) es un proxy de insumos bajo mínimo, no pérdida física. «Rentabilidad por ruta» compara valor de mercadería contra un umbral; no calcula utilidad.`,
      sources,
    };
  }
  if (/proveedor|compra|usuario|seguro|mantenimiento|vencim/.test(q))
    return {
      text: "Ese dato no se expone en la documentación de este backend. Compras permite preparar borradores; proveedores, usuarios, obligaciones y lotes necesitan endpoints específicos. No puedo inferirlos de los registros actuales.",
      sources,
    };
  return {
    text: "Puedo consultar stock, insumos, despachos pendientes, rutas, personal acreditado, puntos e indicadores. Indica un nombre o referencia. Esta búsqueda usa los datos consultados de la API; no utiliza un modelo generativo ni lee documentos adjuntos.",
    sources,
  };
}
