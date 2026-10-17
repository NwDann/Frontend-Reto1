"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Check, Search, Plus, Download, LoaderCircle } from "lucide-react";
import { State, money, dateAfter } from "@/lib/model";
import { clientFor, kindLabel } from "@/lib/enterprise";
import { MovementLocationFields } from "./MovementMap";
import RouteDetails from "./RouteDetails";
import UnitFields from "./UnitFields";
import { packagingLabel, containedQuantity } from "@/lib/units";
import { LOCATION_TYPES } from "@/lib/locations";
import { ContactCard } from "./EnterpriseViews";
import { Action, Open, Field, Badge, Empty, download } from "./ui";
export const enterpriseModalTypes = [
  "movement-locations",
  "route-detail",
  "inventory-register",
  "finance",
  "contact",
  "contact-edit",
  "vehicle",
  "staff",
  "fleet-cost",
  "trip",
  "toll",
  "purchase-receive",
  "purchase-detail",
  "supplier-contact",
  "movement-detail",
  "dispatch-responsibility",
  "stock-transfer",
  "demand-import",
];
const labels: Record<string, [string, string]> = {
  "movement-locations": [
    "Ubicaciones del movimiento",
    "Confirma el origen y destino físicos de esta operación.",
  ],
  "route-detail": [
    "Detalles del plan guardado",
    "Origen, destinos, costos, flota, guías y parámetros conservados.",
  ],
  "inventory-register": [
    "Buscar o crear un insumo",
    "Usa una referencia existente para evitar duplicados. Las existencias provienen de movimientos.",
  ],
  finance: [
    "Objetivos financieros y cuentas",
    "Define los criterios de tu empresa para interpretar los indicadores.",
  ],
  contact: [
    "Ficha de ubicación",
    "Contacto, frecuencia y enlaces de navegación.",
  ],
  "contact-edit": [
    "Contacto y clasificación",
    "Estos datos aparecen en las fichas y diferencian el mapa.",
  ],
  vehicle: [
    "Registro de vehículo",
    "Características, documentos, mantenimiento y estructura de costos.",
  ],
  staff: [
    "Personal y acreditación",
    "La vigencia y disponibilidad se reflejan automáticamente en la planificación.",
  ],
  "fleet-cost": [
    "Gasto o mantenimiento de flota",
    "Registra un gasto real y, si corresponde, programa el próximo mantenimiento.",
  ],
  trip: [
    "Registrar viaje completado",
    "Este registro alimenta el recuento mensual y la velocidad histórica.",
  ],
  toll: [
    "Tarifa de peaje para una zona",
    "Registra una referencia confirmada por la empresa. Se usa al seleccionar los destinos.",
  ],
  "purchase-receive": [
    "Recibir compra en bodega",
    "Confirma lo recibido, el vencimiento y las personas responsables.",
  ],
  "purchase-detail": [
    "Detalle de compra",
    "Productos recibidos y datos para investigar inconsistencias.",
  ],
  "supplier-contact": [
    "Datos del proveedor",
    "Identificación tributaria y contacto comercial.",
  ],
  "movement-detail": [
    "Detalle del movimiento",
    "Consulta la operación que originó el movimiento y sus responsables.",
  ],
  "dispatch-responsibility": [
    "Responsables de la entrega",
    "Registra quién transporta, despacha y confirma la entrega.",
  ],
  "stock-transfer": [
    "Trasladar stock entre ubicaciones",
    "Un traslado cambia la ubicación; no altera el stock total de la empresa.",
  ],
  "demand-import": [
    "Histórico de consumo por cliente",
    "Una fila por semana cerrada. Esta importación reemplaza la serie seleccionada.",
  ],
};
export default function EnterpriseModal({
  modal,
  s,
  action,
  busy,
  close,
  open,
}: {
  modal: { type: string; data?: any };
  s: State;
  action: Action;
  busy: boolean;
  close: () => void;
  open: Open;
}) {
  const { type, data: providedData = {} } = modal,
    data =
      type === "purchase-detail"
        ? s.purchases.find((p) => p.id === providedData.id) || providedData
        : providedData,
    e = s.enterprise!,
    [q, setQ] = useState(""),
    [create, setCreate] = useState(false),
    [itemId, setItem] = useState(""),
    [error, setError] = useState(""),
    [localBusy, setBusy] = useState(false),
    [ownership, setOwnership] = useState(data.ownership || "Propio"),
    [vehicleId, setVehicle] = useState(
      data.vehicleId || e.vehicles[0]?.id || "",
    ),
    [clientId, setClient] = useState(data.clientId || s.points[0]?.id || ""),
    [forecastItem, setForecastItem] = useState(
      data.itemId || s.items[0]?.id || "",
    ),
    [importText, setImport] = useState(""),
    [locationId, setLocationId] = useState(data.id || "warehouse"),
    [locationKind, setLocationKind] = useState(
      clientFor(s, data.id || "warehouse").kind,
    ),
    box = useRef<HTMLDivElement>(null);
  const title = labels[type] || ["Detalle", ""],
    existing = s.items.find((i) => i.id === itemId),
    c = clientFor(s, data.id || "warehouse");
  useEffect(() => {
    const old = document.body.style.overflow,
      prev = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const el = box.current;
    el?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !el) return;
      const nodes = Array.from(
          el.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]",
          ),
        ),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      prev?.focus();
      document.removeEventListener("keydown", handler);
    };
  }, []);
  const check = (name: string, label: string, value = false) => (
    <label className="checkbox-label">
      <input name={name} type="checkbox" defaultChecked={value} />
      {label}
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: { id: string; label: string }[],
    value?: string,
    required = true,
  ) => (
    <label className="form-field">
      {label}
      <select name={name} defaultValue={value || ""} required={required}>
        <option value="">Seleccionar…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (
    name: string,
    label: string,
    value = 0,
    min = 0,
    step = "any",
  ) => (
    <Field
      name={name}
      label={label}
      type="number"
      min={min}
      step={step}
      value={value}
    />
  );
  const vehicles = e.vehicles.map((v) => ({
      id: v.id,
      label: `${v.plate} · ${v.name}`,
    })),
    locations = [
      { id: "warehouse", label: s.warehouse!.nombre_cliente },
      ...s.points.map((p) => ({ id: p.id, label: p.nombre_cliente })),
    ];
  const responsibility = (r: any = {}) => (
    <>
      <div className="form-grid">
        <Field
          name="vehicle"
          label="Vehículo / placa"
          value={r.vehicle || ""}
          required={type === "dispatch-responsibility"}
        />
        <Field
          name="driver"
          label="Conductor"
          value={r.driver || ""}
          required={type === "dispatch-responsibility"}
        />
        <Field
          name="dispatcher"
          label="Despachador"
          value={r.dispatcher || ""}
          required={type === "dispatch-responsibility"}
        />
        <Field
          name="receiver"
          label="Receptor / responsable de la conformidad"
          value={r.receiver || ""}
        />
        <Field
          name="contact"
          label="Teléfono o correo para seguimiento"
          value={r.contact || ""}
          required={false}
        />
      </div>
      <p className="hint">
        Los nombres quedan asociados a la operación. Si hay diferencias,
        consulta esta ficha para coordinar la revisión.
      </p>
    </>
  );
  const showResponsibility = (r: any) => (
    <div className="detail-grid">
      {[
        ["Vehículo", r?.vehicle],
        ["Conductor", r?.driver],
        ["Despachador", r?.dispatcher],
        ["Receptor", r?.receiver],
        ["Contacto", r?.contact],
      ].map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value || "Sin registrar"}</strong>
        </span>
      ))}
    </div>
  );
  const supplierFields = (p: any) => (
    <>
      <Field
        name="ruc"
        label="RUC (13 dígitos)"
        value={p.ruc || ""}
        pattern="[0-9]{13}"
        minLength={13}
        maxLength={13}
      />
      <Field
        name="direccion"
        label="Dirección fiscal / comercial"
        value={p.direccion || ""}
      />
      <div className="form-grid">
        <Field
          name="contacto"
          label="Persona de contacto"
          value={p.contacto || ""}
        />
        <Field name="telefono" label="Teléfono" value={p.telefono || ""} />
      </div>
      <Field
        name="paymentTerms"
        label="Condiciones de pago"
        value={p.paymentTerms || ""}
        placeholder="Ej. crédito 30 días, transferencia"
      />
    </>
  );
  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (localBusy || busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(ev.currentTarget),
      p: any = Object.fromEntries(f);
    let a = "";
    try {
      if (type === "inventory-register") {
        a = create ? "item.create" : "item.update";
        if (!create) {
          if (!existing)
            throw Error("Selecciona un insumo existente o crea uno nuevo.");
          p.id = existing.id;
        }
      }
      if (type === "finance") a = "finance.update";
      if (type === "movement-locations") {
        a = "movement.locations";
        p.id = data.id;
        if (!p.originSnapshot || !p.destinationSnapshot)
          throw Error(
            "Selecciona y confirma las dos ubicaciones del movimiento.",
          );
        p.origin = JSON.parse(p.originSnapshot);
        p.destination = JSON.parse(p.destinationSnapshot);
      }
      if (type === "contact-edit") {
        a = "location.contact";
        p.id = data.id;
      }
      if (type === "vehicle") {
        a = "vehicle.save";
        p.id = data.id;
        p.active = f.has("active");
        p.chemicalAllowed = f.has("chemicalAllowed");
        p.ownership = ownership;
      }
      if (type === "staff") {
        a = "staff.save";
        p.id = data.id;
        p.available = f.has("available");
      }
      if (type === "fleet-cost") {
        a = "fleet.cost";
        p.vehicleId = vehicleId;
      }
      if (type === "trip") a = "trip.create";
      if (type === "toll") a = "toll.save";
      if (type === "purchase-receive") {
        a = "purchase.receive";
        p.id = data.id;
      }
      if (type === "supplier-contact") {
        a = "supplier.details";
        p.id = data.id;
      }
      if (type === "dispatch-responsibility") {
        a = "dispatch.responsibility";
        p.id = data.id;
      }
      if (type === "stock-transfer") a = "stock.transfer";
      if (type === "demand-import") {
        a = "demand.import";
        const lines = importText
            .replace(/^\uFEFF/, "")
            .trim()
            .split(/\r?\n/)
            .filter(Boolean),
          body = /semana|week/i.test(lines[0] || "") ? lines.slice(1) : lines;
        p.rows = body.map((line) => {
          const parts = line.split(/[;,\t]/).map((x) => x.trim());
          if (parts.length !== 4)
            throw Error("Cada fila requiere semana,cantidad,servicios,area.");
          return {
            clientId,
            itemId: forecastItem,
            week: parts[0],
            quantity: Number(parts[1]),
            visits: Number(parts[2]),
            area: Number(parts[3]),
          };
        });
      }
      if (await action(a, p)) close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const readOnly = [
    "route-detail",
    "contact",
    "purchase-detail",
    "movement-detail",
  ].includes(type);
  let movementDispatch =
      type === "movement-detail"
        ? s.dispatches.find((d) => d.id === data.referencia)
        : undefined,
    movementPurchase =
      type === "movement-detail"
        ? s.purchases.find((p) => p.id === data.referencia)
        : undefined;
  return (
    <div
      className="modal-overlay"
      onMouseDown={(ev) =>
        ev.target === ev.currentTarget && !localBusy && close()
      }
    >
      <div
        className={`modal ${["movement-locations", "route-detail", "vehicle", "finance", "demand-import", "movement-detail"].includes(type) ? "wide" : ""}`}
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enterprise-modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">NEXO · DATOS CONECTADOS</div>
            <h2 id="enterprise-modal-title">{title[0]}</h2>
            <p>{title[1]}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar ventana"
            disabled={localBusy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {type === "movement-locations" && (
              <MovementLocationFields
                s={s}
                movement={s.movements.find((m) => m.id === data.id) || data}
              />
            )}
            {type === "route-detail" &&
              (s.routes.find((r) => r.id === data.id) ? (
                <RouteDetails
                  s={s}
                  route={s.routes.find((r) => r.id === data.id)!}
                />
              ) : (
                <Empty title="Plan no encontrado" />
              ))}
            {type === "contact" && (
              <>
                <ContactCard s={s} id={data.id} />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => open("contact-edit", data)}
                >
                  Editar contacto y clasificación
                </button>
              </>
            )}
            {type === "inventory-register" && (
              <>
                <div className="inventory-register-head">
                  <label className="form-field">
                    Buscar insumo existente
                    <input
                      value={q}
                      onChange={(ev) => {
                        setQ(ev.target.value);
                        setCreate(false);
                        setItem("");
                      }}
                      placeholder="Nombre o código…"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      setCreate(true);
                      setItem("");
                    }}
                  >
                    <Plus size={15} />
                    Crear nuevo insumo
                  </button>
                </div>
                {!create && (
                  <>
                    <div className="picker-list">
                      {s.items
                        .filter((i) =>
                          (i.nombre + " " + i.id)
                            .toLowerCase()
                            .includes(q.toLowerCase()),
                        )
                        .map((i) => (
                          <button
                            type="button"
                            className={itemId === i.id ? "selected" : ""}
                            key={i.id}
                            onClick={() => setItem(i.id)}
                          >
                            <strong>{i.nombre}</strong>
                            <small>
                              {i.id} · {i.stock_actual} {i.unidad_medida}
                            </small>
                          </button>
                        ))}
                    </div>
                    {!s.items.length && (
                      <p className="hint">
                        No hay referencias. Usa Crear nuevo insumo.
                      </p>
                    )}
                    {existing && (
                      <>
                        <div className="derived-box">
                          <span>
                            Stock inicial / saldo existente
                            <strong>
                              {existing.stock_actual} {existing.unidad_medida}
                            </strong>
                          </span>
                          {existing.stock_actual > 0 && (
                            <span>
                              Vencimiento registrado
                              <strong>
                                {existing.vencimiento ||
                                  "Sin vencimiento informado"}
                              </strong>
                            </span>
                          )}
                        </div>
                        <UnitFields
                          key={existing.id + "units"}
                          item={existing}
                          locked
                        />
                        <div className="form-grid" key={existing.id}>
                          {number(
                            "stock_minimo",
                            "Mínimo de reposición",
                            existing.stock_minimo,
                          )}
                          {number(
                            "precio_unitario",
                            "Costo unitario registrado · USD",
                            existing.precio_unitario,
                          )}
                        </div>
                        <p className="hint">
                          Las existencias y el vencimiento se consultan del
                          registro y no se modifican desde este formulario.
                        </p>
                      </>
                    )}
                  </>
                )}
                {create && (
                  <>
                    <Badge tone="blue">
                      Referencia nueva · stock inicial automático: 0
                    </Badge>
                    <Field
                      label="Nombre del nuevo insumo"
                      name="nombre"
                      value={q}
                    />
                    <div className="form-grid">
                      <label className="form-field">
                        Categoría
                        <select name="categoria">
                          <option value="quimico">Químico</option>
                          <option value="consumible">Consumible</option>
                          <option value="herramienta">Herramienta</option>
                        </select>
                      </label>
                      <UnitFields />
                      {number("stock_minimo", "Stock mínimo")}
                      {number("precio_unitario", "Costo unitario · USD")}
                      {number("peso_unitario_kg", "Peso por unidad · kg")}
                      {number("volumen_unitario_m3", "Volumen por unidad · m³")}
                    </div>
                    <p className="hint">
                      El vencimiento se registra al recibir existencias. Una
                      referencia nueva no tiene lote inicial ni stock físico.
                    </p>
                  </>
                )}
              </>
            )}
            {type === "finance" && (
              <>
                <Badge tone={s.company.demo ? "sand" : "blue"}>
                  {s.company.demo
                    ? "Valores sintéticos de demostración"
                    : "Parámetros definidos por la empresa"}
                </Badge>
                <div className="form-grid">
                  {number(
                    "inventoryBudget",
                    "Presupuesto máximo en inventario · USD",
                    e.finance.inventoryBudget,
                  )}
                  {number(
                    "monthlyServiceCosts",
                    "Presupuesto mensual de transporte · USD",
                    e.finance.monthlyServiceCosts,
                  )}
                  {number(
                    "minCoverageDays",
                    "Cobertura mínima objetivo · días",
                    e.finance.minCoverageDays,
                  )}
                  {number(
                    "maxCoverageDays",
                    "Cobertura máxima objetivo · días",
                    e.finance.maxCoverageDays,
                    0.1,
                  )}
                  {number(
                    "targetMargin",
                    "Margen objetivo sobre la venta · %",
                    e.finance.targetMargin,
                  )}
                </div>
                <Field
                  name="inventoryAccount"
                  label="Cuenta contable de insumos disponibles"
                  value={e.finance.inventoryAccount}
                />
                <Field
                  name="consumptionAccount"
                  label="Cuenta para el consumo en servicios"
                  value={e.finance.consumptionAccount}
                />
                <Field
                  name="fleetAccount"
                  label="Cuenta de transporte"
                  value={e.finance.fleetAccount}
                />
                <p className="hint">
                  Son objetivos internos, no umbrales universales. La valoración
                  usa costo unitario registrado; el precio sugerido divide los
                  costos directos por (1 − margen). Un objetivo de 20% es margen
                  sobre ventas, no recargo de 20% al costo.
                </p>
              </>
            )}
            {type === "contact-edit" && (
              <>
                <label className="form-field">
                  Tipo de ubicación
                  <select
                    name="kind"
                    value={locationKind}
                    onChange={(ev) =>
                      setLocationKind(ev.target.value as typeof locationKind)
                    }
                    disabled={data.id === "warehouse"}
                  >
                    {LOCATION_TYPES.filter(
                      (t) => data.id !== "warehouse" || t.value === "warehouse",
                    ).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name="segment"
                  label="Segmento del cliente"
                  value={c.segment}
                />
                <div className="form-grid">
                  {number("frequency", "Servicios por semana", c.frequency)}
                  {locationKind === "prospect" && (
                    <Field
                      name="nextService"
                      label="Próxima atención / visita"
                      type="date"
                      value={c.nextService}
                      required={false}
                    />
                  )}
                </div>
                <Field
                  name="contactName"
                  label="Nombre del contacto"
                  value={c.contact.name}
                  required={false}
                />
                <div className="form-grid">
                  <Field
                    name="contactRole"
                    label="Cargo"
                    value={c.contact.role}
                    required={false}
                  />
                  <Field
                    name="phone"
                    label="Teléfono"
                    value={c.contact.phone}
                    required={false}
                  />
                  <Field
                    name="email"
                    label="Correo"
                    type="email"
                    value={c.contact.email}
                    required={false}
                  />
                  <Field
                    name="hours"
                    label="Horario de atención"
                    value={c.contact.hours}
                    required={false}
                  />
                </div>
              </>
            )}
            {type === "vehicle" && (
              <>
                <div className="form-grid">
                  <Field
                    name="plate"
                    label="Placa / identificación"
                    value={data.plate}
                  />
                  <Field
                    name="name"
                    label="Nombre del vehículo"
                    value={data.name}
                  />
                  <label className="form-field">
                    Tipo
                    <select name="type" defaultValue={data.type || "Furgoneta"}>
                      {[
                        "Furgoneta",
                        "Camioneta",
                        "Camión liviano",
                        "Camión mediano",
                        "Motocicleta",
                        "Otro",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Propiedad
                    <select
                      value={ownership}
                      onChange={(ev) => setOwnership(ev.target.value)}
                    >
                      <option>Propio</option>
                      <option>Externo</option>
                    </select>
                  </label>
                  {ownership === "Externo" &&
                    select(
                      "supplierId",
                      "Proveedor de transporte",
                      s.suppliers.map((p) => ({ id: p.id, label: p.nombre })),
                      data.supplierId,
                    )}
                  {select(
                    "driverId",
                    "Conductor asignado",
                    e.staff.map((p) => ({ id: p.id, label: p.name })),
                    data.driverId,
                  )}
                  {number(
                    "capacityKg",
                    "Capacidad útil · kg",
                    data.capacityKg || 1000,
                    0.1,
                  )}
                  {number(
                    "capacityM3",
                    "Capacidad útil · m³",
                    data.capacityM3 || 6,
                    0.01,
                  )}
                  {number(
                    "kmPerGallon",
                    "Rendimiento registrado · km/galón",
                    data.kmPerGallon || 25,
                    0.1,
                  )}
                  {number(
                    "odometer",
                    "Odómetro actual · km",
                    data.odometer || 0,
                  )}
                </div>
                {!e.staff.length && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("staff")}
                  >
                    Registrar primero al conductor ↗
                  </button>
                )}
                <h3>Obligaciones y cobertura registrada</h3>
                <div className="form-grid">
                  <Field
                    name="technicalUntil"
                    label="Revisión técnica · vigente hasta"
                    type="date"
                    value={data.technicalUntil || ""}
                    required={false}
                  />
                  <Field
                    name="insuranceUntil"
                    label="Póliza vehicular · vigente hasta"
                    type="date"
                    value={data.insuranceUntil || ""}
                    required={false}
                  />
                  <Field
                    name="policy"
                    label="Póliza vehicular / referencia de cobertura"
                    value={data.policy || ""}
                    required={false}
                  />
                  <Field
                    name="cargoInsuranceUntil"
                    label="Mercadería en tránsito · vigente hasta"
                    type="date"
                    value={data.cargoInsuranceUntil || ""}
                    required={false}
                  />
                  {number(
                    "cargoPremiumMonthly",
                    "Prima mercadería en tránsito · USD/mes",
                    data.cargoPremiumMonthly || 0,
                  )}
                </div>
                {check(
                  "chemicalAllowed",
                  "Apto para los químicos transportados, según fichas de seguridad y revisión de la empresa",
                  !!data.chemicalAllowed,
                )}
                <h3>Mantenimiento y costos para planificar</h3>
                <div className="form-grid">
                  <Field
                    name="maintenanceDate"
                    label="Próximo mantenimiento · fecha límite"
                    type="date"
                    value={data.maintenanceDate || ""}
                    required={false}
                  />
                  {number(
                    "maintenanceKm",
                    "Próximo mantenimiento · km de odómetro",
                    data.maintenanceKm || 0,
                  )}
                  {number(
                    "maintenanceReserveKm",
                    "Presupuesto de mantenimiento · USD/km",
                    data.maintenanceReserveKm || 0,
                  )}
                  {number(
                    "fixedMonthly",
                    "Costos fijos mensuales · USD",
                    data.fixedMonthly || 0,
                  )}
                </div>
                <p className="hint">
                  Fijos: cuota/depreciación de gestión, GPS, póliza vehicular y
                  otros costos mensuales definidos por la empresa. Excluye
                  combustible, mantenimiento por km y prima de mercadería en
                  tránsito para evitar duplicarlos. El presupuesto por km se usa
                  para cotizar y no representa un pago o provisión contable.
                </p>
                {check("active", "Vehículo activo", data.active ?? true)}
                <Field
                  name="notes"
                  label="Observaciones / alcance de coberturas"
                  value={data.notes || ""}
                  required={false}
                />
              </>
            )}
            {type === "staff" && (
              <>
                <Field
                  name="name"
                  label="Nombre y apellido"
                  value={data.name}
                />
                <div className="form-grid">
                  <Field
                    name="role"
                    label="Función"
                    value={data.role || "Conductor"}
                  />
                  <Field
                    name="phone"
                    label="Teléfono"
                    value={data.phone || ""}
                    required={false}
                  />
                  <Field
                    name="accreditedUntil"
                    label="Acreditación · vigente hasta"
                    type="date"
                    value={data.accreditedUntil || ""}
                    required={false}
                  />
                  {number("hourly", "Costo por hora · USD", data.hourly || 0)}
                  {number(
                    "experienceYears",
                    "Experiencia de conducción · años",
                    data.experienceYears || 0,
                  )}
                </div>
                {check(
                  "available",
                  "Disponible para asignación",
                  data.available ?? true,
                )}
              </>
            )}
            {type === "fleet-cost" && (
              <>
                <label className="form-field">
                  Vehículo
                  <select
                    value={vehicleId}
                    required
                    onChange={(ev) => setVehicle(ev.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <Field
                    name="date"
                    label="Fecha del gasto"
                    type="date"
                    max={dateAfter(0)}
                    value={dateAfter(0)}
                  />
                  {select(
                    "category",
                    "Categoría",
                    [
                      "Combustible",
                      "Mantenimiento",
                      "Seguro",
                      "Matrícula / revisión",
                      "Cuota / arriendo",
                      "Parqueadero",
                      "Otros",
                    ].map((v) => ({ id: v, label: v })),
                    "Mantenimiento",
                  )}
                  {number("amount", "Importe pagado · USD")}
                </div>
                <Field name="detail" label="Concepto / comprobante" />
                <h3>Solo si es mantenimiento</h3>
                <div className="form-grid">
                  <Field
                    name="nextDate"
                    label="Próxima fecha límite"
                    type="date"
                    required={false}
                  />
                  <Field
                    name="nextKm"
                    label="Próximo kilometraje de mantenimiento"
                    type="number"
                    min="0"
                    required={false}
                  />
                </div>
              </>
            )}
            {type === "trip" && (
              <>
                {select("vehicleId", "Vehículo", vehicles)}
                <div className="form-grid">
                  <Field
                    name="date"
                    label="Fecha del viaje"
                    type="date"
                    max={dateAfter(0)}
                    value={dateAfter(-1)}
                  />
                  {number("km", "Distancia recorrida · km", 1, 0.01)}
                  {number("minutes", "Tiempo de conducción · min", 1, 1)}
                  {number("tolls", "Peajes pagados · USD")}
                </div>
                <p className="hint">
                  No registres manualmente un viaje que ya fue creado al
                  completar una ruta. Un viaje histórico no modifica el odómetro
                  actual; actualízalo en la ficha si hace falta.
                </p>
              </>
            )}
            {type === "toll" && (
              <>
                <Field
                  name="zone"
                  label="Zona de destino que requiere el paso"
                  placeholder="Debe coincidir con la zona del punto, ej. Valle"
                />
                <Field
                  name="vehicleType"
                  label="Tipo de vehículo (* para todos)"
                  value="*"
                />
                {number("fee", "Tarifa por un paso · USD")}
                <Field
                  name="source"
                  label="Fuente / operador / referencia de tarifa"
                />
                <Field
                  name="confirmedAt"
                  label="Fecha de confirmación"
                  type="date"
                  value={dateAfter(0)}
                />
                <p className="hint">
                  La planificación considera un paso de ida y otro si se regresa
                  a la bodega. Revisa que esa hipótesis corresponda al
                  recorrido. No es una consulta automática a Google Maps ni al
                  operador del peaje.
                </p>
              </>
            )}
            {type === "purchase-receive" && (
              <>
                <h3>
                  {data.id} · {s.items.find((i) => i.id === data.item)?.nombre}
                </h3>
                <div className="form-grid">
                  {number(
                    "quantity",
                    `Cantidad recibida · ${s.items.find((i) => i.id === data.item)?.unidad_medida}`,
                    data.cantidad,
                    0.001,
                  )}
                  <Field
                    name="expiry"
                    label="Vencimiento del lote recibido"
                    type="date"
                    required={
                      s.items.find((i) => i.id === data.item)?.categoria ===
                      "quimico"
                    }
                  />
                </div>
                <p className="hint">
                  Solicitado: {data.cantidad}. Si llega menos, el stock aumenta
                  solo con lo recibido y se registra una alerta. El costo
                  unitario se actualiza con promedio ponderado.
                </p>
                {responsibility(data.responsibility)}
              </>
            )}
            {type === "purchase-detail" && (
              <>
                <h3>
                  {data.id} · {s.items.find((i) => i.id === data.item)?.nombre}
                </h3>
                <Badge tone="blue">{data.estado}</Badge>
                <div className="detail-grid">
                  <span>
                    <small>Proveedor</small>
                    <strong>
                      {s.suppliers.find((p) => p.id === data.supplier)
                        ?.nombre || "Sin registrar"}
                    </strong>
                  </span>
                  <span>
                    <small>Fecha de solicitud</small>
                    <strong>{dateLabelFull(data.fecha)}</strong>
                  </span>
                  <span>
                    <small>Prioridad</small>
                    <strong>{data.prioridad}</strong>
                  </span>
                  <span>
                    <small>Precio unitario de referencia</small>
                    <strong>
                      {money(
                        data.unitPrice ??
                          s.items.find((i) => i.id === data.item)
                            ?.precio_unitario ??
                          0,
                      )}
                    </strong>
                  </span>
                  <span>
                    <small>Total solicitado de referencia</small>
                    <strong>
                      {money(
                        data.cantidad *
                          (data.unitPrice ??
                            s.items.find((i) => i.id === data.item)
                              ?.precio_unitario ??
                            0),
                      )}
                    </strong>
                  </span>
                  <span>
                    <small>Solicitado</small>
                    <strong>
                      {data.cantidad}{" "}
                      {s.items.find((i) => i.id === data.item)?.unidad_medida}
                    </strong>
                  </span>
                  <span>
                    <small>Recibido</small>
                    <strong>
                      {data.estado === "Recibida"
                        ? (data.receivedQuantity ?? data.cantidad)
                        : "No recibido"}
                    </strong>
                  </span>
                </div>
                {s.items.find((i) => i.id === data.item) &&
                  packagingLabel(s.items.find((i) => i.id === data.item)!) && (
                    <p className="hint">
                      {packagingLabel(s.items.find((i) => i.id === data.item)!)}{" "}
                      · Cantidad solicitada equivalente:{" "}
                      {containedQuantity(
                        s.items.find((i) => i.id === data.item)!,
                        data.cantidad,
                      )}
                    </p>
                  )}
                {showResponsibility(data.responsibility)}
                <p>Motivo: {data.motivo}</p>
              </>
            )}
            {type === "supplier-contact" && supplierFields(data)}
            {type === "dispatch-responsibility" && (
              <>
                <h3>
                  {data.id} ·{" "}
                  {s.points.find((p) => p.id === data.point)?.nombre_cliente}
                </h3>
                {responsibility(data.responsibility)}
              </>
            )}
            {type === "movement-detail" && (
              <>
                <Badge tone="blue">{data.tipo}</Badge>
                <h3>{data.referencia}</h3>
                <p>
                  {s.items.find((i) => i.id === data.item)?.nombre} ·{" "}
                  {data.cantidad}{" "}
                  {s.items.find((i) => i.id === data.item)?.unidad_medida}
                </p>
                <p>
                  {data.origen} → {data.destino}
                </p>
                <p>{dateLabelFull(data.fecha)}</p>
                {showResponsibility(
                  movementDispatch?.responsibility ||
                    movementPurchase?.responsibility ||
                    data.responsibility,
                )}
                {movementDispatch && (
                  <>
                    <p>
                      Solicitado y entregado:{" "}
                      {movementDispatch.lines
                        .map(
                          (l) =>
                            `${s.items.find((i) => i.id === l.insumo_id)?.nombre} ${l.cantidad} / ${l.entregado ?? l.recibido ?? "pendiente"}`,
                        )
                        .join("; ")}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        open("dispatch-responsibility", movementDispatch)
                      }
                    >
                      Completar / revisar responsables ↗
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => open("movement-locations", data)}
                >
                  Ubicaciones geográficas de la operación ↗
                </button>
                {!movementDispatch && !movementPurchase && (
                  <p className="hint">
                    Este registro no está vinculado a una guía o compra.
                    Consulta su referencia y los responsables registrados para
                    el seguimiento.
                  </p>
                )}
              </>
            )}
            {type === "stock-transfer" && (
              <>
                {select(
                  "itemId",
                  "Insumo",
                  s.items.map((i) => ({
                    id: i.id,
                    label: `${i.nombre} · ${i.unidad_medida}`,
                  })),
                )}
                <div className="form-grid">
                  {select("from", "Origen", locations, "warehouse")}
                  {select("to", "Destino", locations)}
                  {number(
                    "quantity",
                    "Cantidad en la unidad del insumo",
                    1,
                    0.001,
                  )}
                </div>
                <Field
                  name="reference"
                  label="Referencia del traslado / documento"
                />
                {responsibility()}
              </>
            )}
            {type === "demand-import" && (
              <>
                <div className="form-grid">
                  <label className="form-field">
                    Cliente
                    <select
                      value={clientId}
                      onChange={(ev) => setClient(ev.target.value)}
                    >
                      {s.points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre_cliente}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Insumo
                    <select
                      value={forecastItem}
                      onChange={(ev) => setForecastItem(ev.target.value)}
                    >
                      {s.items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre} ({i.unidad_medida})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="hint">
                  CSV: semana (AAAA-MM-DD), cantidad en la unidad del insumo,
                  servicios de la semana, área en m². Usa punto decimal y
                  semanas consecutivas; mínimo 8 para validar.
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  aria-label="Cargar CSV de consumo"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (file) {
                      if (file.size > 250000) {
                        setError("Usa un archivo de hasta 250 KB.");
                        return;
                      }
                      setImport(await file.text());
                    }
                  }}
                />
                <label className="form-field">
                  Datos semanales
                  <textarea
                    required
                    rows={8}
                    value={importText}
                    onChange={(ev) => setImport(ev.target.value)}
                    placeholder="semana,cantidad,servicios,area&#10;2026-07-06,8,2,3200&#10;2026-07-13,9,2,3200"
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    download(
                      "plantilla-demanda-cliente.csv",
                      "semana,cantidad,servicios,area\n",
                    )
                  }
                >
                  Descargar encabezados CSV <Download size={14} />
                </button>
                <p className="hint">
                  Al guardar, se reemplaza solo la serie de este cliente e
                  insumo y se marca como real importada. Los datos sintéticos de
                  otras series permanecen identificados.
                </p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="btn secondary"
              type="button"
              disabled={localBusy}
              onClick={close}
            >
              {readOnly ? "Cerrar" : "Cancelar"}
            </button>
            {!readOnly && (
              <button
                className="btn primary"
                type="submit"
                disabled={
                  busy ||
                  localBusy ||
                  (type === "inventory-register" && !create && !existing)
                }
              >
                {busy || localBusy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}{" "}
                {type === "purchase-receive" ? "Confirmar recibido" : "Guardar"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
function dateLabelFull(date: string) {
  return new Date(date).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
  });
}
