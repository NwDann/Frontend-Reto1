"use client";
import React, { useState } from "react";
import {
  Package,
  Plus,
  Download,
  Search,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  X,
  Upload,
  FileText,
} from "lucide-react";
import { State, money } from "@/lib/model";
import { packagingLabel, containedQuantity } from "@/lib/units";
import { inventoryHealth } from "@/lib/enterprise";
import {
  Open,
  Action,
  Badge,
  Empty,
  SectionTitle,
  CardTitle,
  dateLabel,
  download,
} from "./ui";
import GeoMap from "./GeoMap";
import MovementMap from "./MovementMap";
export function Inventory({
  s,
  open,
  exportData,
}: {
  s: State;
  open: Open;
  exportData: (t: string) => void;
}) {
  const [status, setStatus] = useState("Todos"),
    [q, setQ] = useState(""),
    [view, setView] = useState("catalog"),
    items = s.items.filter(
      (i) =>
        (status === "Todos" || inventoryHealth(s, i).state === status) &&
        (i.nombre + " " + i.id).toLowerCase().includes(q.toLowerCase()),
    );
  const location = (id: string) =>
    id === "warehouse"
      ? s.warehouse!.nombre_cliente
      : s.points.find((p) => p.id === id)?.nombre_cliente || id;
  return (
    <>
      <SectionTitle
        eyebrow="INVENTARIO Y REPOSICIÓN"
        title="Existencias con ubicación y criterio."
        text="Consulta el stock disponible y entiende qué referencias requieren una decisión."
      >
        <button
          className="btn secondary"
          onClick={() => exportData("inventory")}
        >
          <Download size={16} />
          Exportar
        </button>
        <button
          className="btn secondary"
          onClick={() => open("stock-transfer")}
          disabled={!s.items.length}
        >
          Trasladar existencias
        </button>
        <button
          className="btn primary"
          onClick={() => open("inventory-register")}
        >
          <Plus size={16} />
          Registrar insumo
        </button>
      </SectionTitle>
      <div className="tabs">
        <button
          className={view === "catalog" ? "active" : ""}
          onClick={() => setView("catalog")}
        >
          Catálogo y existencias
        </button>
        <button
          className={view === "indicators" ? "active" : ""}
          onClick={() => setView("indicators")}
        >
          Indicadores y recomendaciones
        </button>
      </div>
      <div className="table-toolbar">
        <div className="filter-buttons">
          {["Todos", "Estable", "Revisar", "Exceso", "Vencimiento"].map((v) => (
            <button
              key={v}
              className={status === v ? "active" : ""}
              onClick={() => setStatus(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="table-search">
          <Search size={15} />
          <input
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {view === "catalog" ? (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>INSUMO / UNIDAD</th>
                  <th>UBICACIÓN DEL STOCK</th>
                  <th>DISPONIBLE</th>
                  <th>MÍNIMO</th>
                  <th>COSTO UNITARIO</th>
                  <th>ESTADO</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const h = inventoryHealth(s, i),
                    balances = s.enterprise!.balances.filter(
                      (b) => b.itemId === i.id && b.quantity > 0,
                    );
                  return (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.nombre}</strong>
                        <small>
                          {i.id} · {i.unidad_medida}
                        </small>
                        {packagingLabel(i) && (
                          <small>{packagingLabel(i)}</small>
                        )}
                      </td>
                      <td>
                        {balances.length ? (
                          balances.map((b, n) => (
                            <div key={n}>
                              {location(b.locationId)}
                              <small>
                                {b.quantity} {i.unidad_medida}
                                {b.expiry ? " · vence " + b.expiry : ""}
                              </small>
                            </div>
                          ))
                        ) : (
                          <span className="muted">
                            Sin existencias registradas
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{i.stock_actual}</strong> {i.unidad_medida}
                        {containedQuantity(i, i.stock_actual) && (
                          <small>
                            Equivale a {containedQuantity(i, i.stock_actual)}
                          </small>
                        )}
                      </td>
                      <td>{i.stock_minimo}</td>
                      <td>{money(i.precio_unitario)}</td>
                      <td>
                        <Badge
                          tone={
                            h.state === "Estable"
                              ? "green"
                              : h.state === "Vencimiento"
                                ? "rose"
                                : "sand"
                          }
                        >
                          {h.state}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="table-arrow"
                          title="Ver detalle y parámetros"
                          onClick={() => open("itemdetail", i)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!items.length && <Empty title="Sin insumos para este filtro" />}
          </div>
          <div className="table-summary">
            {items.length} referencias · stock total de ubicaciones gestionadas
          </div>
        </section>
      ) : (
        <div className="inventory-recs">
          {items.map((i) => {
            const h = inventoryHealth(s, i);
            return (
              <section className="card padded recommendation" key={i.id}>
                <div className="recommendation-top">
                  <span className={`item-icon ${i.color}`}>
                    <Package size={18} />
                  </span>
                  <div>
                    <h3>{i.nombre}</h3>
                    <p>
                      {i.id} · {i.unidad_medida}
                    </p>
                  </div>
                  <Badge tone={h.state === "Estable" ? "green" : "sand"}>
                    {h.state}
                  </Badge>
                </div>
                <div className="rec-values">
                  <span>
                    <small>Rotación base</small>
                    <strong>
                      {h.rotation === null
                        ? "Sin consumo"
                        : h.rotation.toFixed(2) + "×"}
                    </strong>
                  </span>
                  <span>
                    <small>Cobertura reciente</small>
                    <strong>
                      {h.days === null
                        ? "Sin histórico"
                        : h.days.toFixed(0) + " días"}
                    </strong>
                  </span>
                  <span>
                    <small>Comprometido en guías</small>
                    <strong>
                      {h.committed} {i.unidad_medida}
                    </strong>
                  </span>
                </div>
                <p className="rec-advice">
                  {h.state === "Vencimiento"
                    ? "Prioriza FEFO y verifica el vencimiento antes de despachar."
                    : h.state === "Exceso"
                      ? "Reduce nuevas compras y reasigna stock donde exista demanda."
                      : h.need
                        ? `Solicita ${h.need} ${i.unidad_medida} para recuperar la cobertura definida.`
                        : "Sin compra adicional sugerida con los datos actuales."}
                </p>
                <details className="method-details">
                  <summary>¿De dónde sale la cantidad?</summary>
                  <p>
                    Objetivo = máximo de mínimo registrado ({i.stock_minimo}),
                    guías pendientes ({h.committed}) y consumo semanal reciente
                    ({h.mean.toFixed(2)}) × días mínimos de cobertura (
                    {s.enterprise!.finance.minCoverageDays || 7}) / 7.
                  </p>
                  <p>
                    Compra sugerida = máximo(0, {h.target.toFixed(2)} objetivo −{" "}
                    {i.stock_actual} stock − {h.pending} ya solicitado) ={" "}
                    {h.need} {i.unidad_medida}. No se convierte una unidad
                    registrada en canecas o litros automáticamente.
                  </p>
                  <p>
                    Rotación base = consumo del mes / promedio de saldo inicial
                    y actual. Cobertura = stock / promedio de últimas 4 semanas
                    × 7.{" "}
                    {s.company.demo
                      ? "El mes base y el histórico de este espacio son sintéticos."
                      : ""}
                  </p>
                </details>
                <button
                  className="text-button"
                  onClick={() =>
                    open("purchase", {
                      item: i.id,
                      cantidad: Math.max(1, h.need),
                    })
                  }
                >
                  Preparar reposición <ArrowRight size={14} />
                </button>
              </section>
            );
          })}
        </div>
      )}
      <p className="method-note">
        Un insumo nuevo se crea con saldo cero. Los saldos se actualizan
        mediante compras recibidas, entregas confirmadas y traslados internos
        registrados. Cada cantidad conserva la unidad del catálogo.
      </p>
    </>
  );
}
export function Purchases({
  s,
  open,
  action,
  busy,
}: {
  s: State;
  open: Open;
  action: Action;
  busy: boolean;
}) {
  const [filter, setFilter] = useState("Todas"),
    [tab, setTab] = useState("requests"),
    rows = s.purchases.filter(
      (p) =>
        filter === "Todas" ||
        (filter === "En proceso" &&
          !["Recibida", "Rechazada"].includes(p.estado)) ||
        p.estado === filter,
    ),
    recs = s.items
      .map((i) => ({ i, h: inventoryHealth(s, i) }))
      .filter(({ h }) => h.need > 0 || h.state !== "Estable");
  return (
    <>
      <SectionTitle
        eyebrow="SOLICITUDES Y RECEPCIONES"
        title="Compra con la información completa."
        text="Crea solicitudes nuevas, consulta procesos abiertos y revisa todas las recomendaciones."
      >
        <button
          className="btn secondary"
          onClick={() => {
            setTab("requests");
            setFilter("En proceso");
          }}
        >
          Solicitudes en proceso
        </button>
        <button
          className="btn primary"
          onClick={() => open("purchase")}
          disabled={!s.items.length || !s.suppliers.length}
        >
          <Plus size={16} />
          Nueva solicitud
        </button>
      </SectionTitle>
      <div className="tabs">
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          Solicitudes
        </button>
        <button
          className={tab === "recommendations" ? "active" : ""}
          onClick={() => setTab("recommendations")}
        >
          Todas las recomendaciones ({recs.length})
        </button>
      </div>
      {tab === "recommendations" ? (
        <section className="card padded">
          <CardTitle
            title="Recomendaciones de abastecimiento"
            sub="Descuentan las cantidades que ya están en solicitudes abiertas."
          />
          {recs.map(({ i, h }) => (
            <div className="list-row" key={i.id}>
              <span>
                <strong>{i.nombre}</strong>
                <small>
                  {h.state} · {i.stock_actual} disponibles · {h.pending}{" "}
                  solicitados · {h.committed} comprometidos ({i.unidad_medida})
                </small>
                <small>
                  {h.need > 0
                    ? `Solicitar ${h.need} ${i.unidad_medida}`
                    : h.state === "Vencimiento"
                      ? "Revisar lote y priorizar consumo seguro."
                      : "Revisar cobertura y reasignar antes de comprar."}
                </small>
              </span>
              <button
                className="btn secondary small"
                onClick={() =>
                  open("purchase", {
                    item: i.id,
                    cantidad: Math.max(1, h.need),
                  })
                }
              >
                Preparar solicitud
              </button>
            </div>
          ))}
          {!recs.length && <Empty title="Sin recomendaciones pendientes" />}
        </section>
      ) : (
        <>
          <div className="recommendation-banner">
            <Sparkles size={23} />
            <div>
              <strong>{recs.length} referencias con recomendaciones</strong>
              <p>
                Revisa cantidades sugeridas, vencimientos y excedentes antes de
                solicitar.
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={() => setTab("recommendations")}
            >
              Ver todas <ArrowUpRight size={15} />
            </button>
          </div>
          <section className="card">
            <div className="table-toolbar">
              <div className="filter-buttons">
                {[
                  "Todas",
                  "En proceso",
                  "Pendiente",
                  "Aprobada",
                  "En camino",
                  "Recibida",
                  "Rechazada",
                ].map((v) => (
                  <button
                    key={v}
                    className={filter === v ? "active" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SOLICITUD / INSUMO</th>
                    <th>PROVEEDOR</th>
                    <th>SOLICITADO / RECIBIDO</th>
                    <th>TOTAL ESTIMADO</th>
                    <th>ESTADO</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>
                          {s.items.find((i) => i.id === p.item)?.nombre}
                        </strong>
                        <small>
                          {p.id} · {dateLabel(p.fecha)}
                        </small>
                      </td>
                      <td>
                        {s.suppliers.find((i) => i.id === p.supplier)?.nombre}
                      </td>
                      <td>
                        {p.cantidad}{" "}
                        {s.items.find((i) => i.id === p.item)?.unidad_medida}
                        {p.estado === "Recibida" && (
                          <small>
                            Recibido: {p.receivedQuantity ?? p.cantidad}
                          </small>
                        )}
                      </td>
                      <td>
                        {money(
                          p.cantidad *
                            (p.unitPrice ??
                              s.items.find((i) => i.id === p.item)
                                ?.precio_unitario ??
                              0),
                        )}
                      </td>
                      <td>
                        <Badge
                          tone={
                            p.estado === "Recibida"
                              ? "green"
                              : p.estado === "Rechazada"
                                ? "rose"
                                : "blue"
                          }
                        >
                          {p.estado}
                        </Badge>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn secondary small"
                            onClick={() => open("purchase-detail", p)}
                          >
                            Ver detalle
                          </button>
                          {p.estado === "Pendiente" ? (
                            <>
                              <button
                                className="btn small secondary"
                                disabled={busy}
                                onClick={() =>
                                  action("purchase.status", {
                                    id: p.id,
                                    estado: "Aprobada",
                                  })
                                }
                              >
                                Aprobar
                              </button>
                              <button
                                className="icon-button"
                                title="Rechazar solicitud"
                                disabled={busy}
                                onClick={() =>
                                  action("purchase.status", {
                                    id: p.id,
                                    estado: "Rechazada",
                                  })
                                }
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : p.estado === "Aprobada" ? (
                            <button
                              className="btn small secondary"
                              disabled={busy}
                              onClick={() =>
                                action("purchase.status", {
                                  id: p.id,
                                  estado: "En camino",
                                })
                              }
                            >
                              Marcar en camino
                            </button>
                          ) : p.estado === "En camino" ? (
                            <button
                              className="btn small primary"
                              onClick={() => open("purchase-receive", p)}
                            >
                              Recibir en bodega
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <Empty title="Sin solicitudes en este estado" />}
            </div>
          </section>
        </>
      )}
    </>
  );
}
export function Tracking({
  s,
  open,
  exportData,
}: {
  s: State;
  open: Open;
  exportData: (t: string) => void;
}) {
  const [tab, setTab] = useState("guides"),
    [movementId, setMovementId] = useState(s.movements[0]?.id || ""),
    [filter, setFilter] = useState("Todas"),
    rows = s.dispatches.filter(
      (d) => filter === "Todas" || d.estado === filter,
    );
  return (
    <>
      <SectionTitle
        eyebrow="TRAZABILIDAD Y RESPONSABLES"
        title="Cada movimiento tiene una referencia."
        text="Consulta productos, vehículos, conductor, despachador y receptor para investigar diferencias."
      >
        <button
          className="btn secondary"
          onClick={() => exportData("movements")}
        >
          <Download size={16} />
          Exportar
        </button>
        <button
          className="btn primary"
          disabled={!s.items.length || !s.points.length}
          onClick={() => open("guide")}
        >
          <Upload size={16} />
          Cargar guía
        </button>
      </SectionTitle>
      <div className="tabs">
        {[
          ["guides", "Guías y entregas"],
          ["movements", "Historial de movimientos"],
          ["map", "Vista geográfica"],
        ].map(([v, label]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => setTab(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "map" ? (
        <MovementMap
          s={s}
          movementId={movementId}
          setMovementId={setMovementId}
          open={open}
        />
      ) : tab === "movements" ? (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>FECHA / REFERENCIA</th>
                  <th>INSUMO</th>
                  <th>MOVIMIENTO</th>
                  <th>CANTIDAD</th>
                  <th>ORIGEN → DESTINO</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.referencia}</strong>
                      <small>{dateLabel(m.fecha)}</small>
                    </td>
                    <td>{s.items.find((i) => i.id === m.item)?.nombre}</td>
                    <td>
                      <Badge tone={m.tipo === "Ingreso" ? "green" : "blue"}>
                        {m.tipo}
                      </Badge>
                    </td>
                    <td>
                      {m.cantidad}{" "}
                      {s.items.find((i) => i.id === m.item)?.unidad_medida}
                    </td>
                    <td>
                      {m.origen}
                      <small>→ {m.destino}</small>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn small secondary"
                          onClick={() => open("movement-detail", m)}
                        >
                          Datos y responsables ↗
                        </button>
                        <button
                          className="btn small secondary"
                          onClick={() => {
                            setMovementId(m.id);
                            setTab("map");
                          }}
                        >
                          Ver en mapa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!s.movements.length && <Empty />}
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="table-toolbar">
            <div className="filter-buttons">
              {["Todas", "Programada", "En tránsito", "Entregada"].map((v) => (
                <button
                  key={v}
                  className={v === filter ? "active" : ""}
                  onClick={() => setFilter(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>GUÍA / DESTINO</th>
                  <th>FECHA</th>
                  <th>ESTADO</th>
                  <th>CONCILIACIÓN</th>
                  <th>RESPONSABLES</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => open("contact", { id: d.point })}
                      >
                        {s.points.find((p) => p.id === d.point)?.nombre_cliente}
                      </button>
                      <small>{d.id}</small>
                    </td>
                    <td>{dateLabel(d.fecha)}</td>
                    <td>
                      <Badge tone={d.estado === "Entregada" ? "green" : "blue"}>
                        {d.estado}
                      </Badge>
                    </td>
                    <td>
                      {d.estado === "Entregada" ? (
                        <Badge
                          tone={
                            d.lines.some(
                              (l) => (l.entregado ?? l.recibido) !== l.cantidad,
                            )
                              ? "rose"
                              : "green"
                          }
                        >
                          {d.lines.some(
                            (l) => (l.entregado ?? l.recibido) !== l.cantidad,
                          )
                            ? "Con diferencias"
                            : "Completa"}
                        </Badge>
                      ) : (
                        "Por confirmar"
                      )}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => open("dispatch-responsibility", d)}
                      >
                        {d.responsibility?.driver || "Completar responsables"} ↗
                      </button>
                      <small>
                        {d.responsibility?.vehicle || "Vehículo pendiente"}
                      </small>
                    </td>
                    <td>
                      <button
                        className="btn small secondary"
                        onClick={() => open("dispatch", d)}
                      >
                        {d.estado === "Entregada"
                          ? "Ver entregado"
                          : "Confirmar entrega"}{" "}
                        ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty />}
          </div>
        </section>
      )}
      <div className="info-note">
        <FileText size={17} />
        <p>
          Las salidas a clientes muestran entregado; las compras muestran
          recibido. CSV/JSON permite importar cantidades. PDF o imagen queda
          como respaldo revisado manualmente.
        </p>
        <button
          className="text-button"
          onClick={() =>
            download(
              "plantilla-guia-nexo.csv",
              "insumo_id,cantidad\n" + (s.items[0]?.id || "INS-001") + ",10",
            )
          }
        >
          Plantilla CSV ↗
        </button>
      </div>
    </>
  );
}
