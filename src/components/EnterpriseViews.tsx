"use client";
import React, { useState } from "react";
import {
  Package,
  Truck,
  Route,
  Wallet,
  ArrowUpRight,
  Plus,
  MapPin,
  Building2,
  Phone,
  Mail,
  CalendarDays,
  ShieldCheck,
  Settings2,
  UserRound,
  Check,
  Download,
} from "lucide-react";
import { State, money, supplierScore } from "@/lib/model";
import { LOCATION_TYPES } from "@/lib/locations";
import {
  clientFor,
  kindLabel,
  financialSummary,
  vehicleChecks,
  vehicleTrips,
  eligibleEvaluations,
  inventoryHealth,
} from "@/lib/enterprise";
import { warehouseFor } from "@/lib/logistics";
import {
  Action,
  Open,
  Page,
  SectionTitle,
  CardTitle,
  Badge,
  Empty,
  Metric,
  Field,
  dateLabel,
  download,
  toCSV,
} from "./ui";
import GeoMap, { googleLocation } from "./GeoMap";
const tone = (status: string) =>
  /Sobre|Revisar|inmovilizado|revisar|pendiente/.test(status)
    ? "sand"
    : /Sin /.test(status)
      ? "gray"
      : "green";
export function Dashboard({
  s,
  open,
  go,
}: {
  s: State;
  open: Open;
  go: (p: Page) => void;
  role?: string;
}) {
  const f = financialSummary(s),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState("warehouse"),
    finance = s.enterprise!.finance,
    points = s.points.filter(
      (p) =>
        filter === "all" ||
        (filter === "frequent" && clientFor(s, p.id).frequency >= 3) ||
        clientFor(s, p.id).kind === filter,
    ),
    next = s.points
      .filter(
        (p) =>
          clientFor(s, p.id).kind === "prospect" &&
          clientFor(s, p.id).nextService,
      )
      .sort((a, b) =>
        clientFor(s, a.id).nextService.localeCompare(
          clientFor(s, b.id).nextService,
        ),
      );
  const low = s.items.filter((i) => inventoryHealth(s, i).state === "Revisar");
  return (
    <>
      <SectionTitle
        eyebrow="TU OPERACIÓN, EN CONTEXTO"
        title="Cada indicador, una decisión."
        text="Existencias, compromisos y ubicaciones conectados con los objetivos de tu empresa."
      >
        <button className="btn secondary" onClick={() => open("finance")}>
          Parámetros financieros <Settings2 size={15} />
        </button>
        <button className="btn primary" onClick={() => go("routes")}>
          Planificar abastecimiento <ArrowUpRight size={15} />
        </button>
      </SectionTitle>
      <div className="metrics-grid">
        <Metric
          label="Capital en inventario"
          value={money(f.value)}
          icon={Package}
          detail={
            <>
              <Badge tone={tone(f.inventoryStatus)}>{f.inventoryStatus}</Badge>
              <span className="metric-explanation">
                {f.budgetPercent === null
                  ? "Define tu presupuesto para interpretarlo."
                  : `${f.budgetPercent.toFixed(0)}% de ${money(finance.inventoryBudget)} presupuestados.`}
              </span>
            </>
          }
        />
        <Metric
          label="Cobertura valorizada"
          value={
            f.coverage === null
              ? "Sin histórico"
              : `${f.coverage.toFixed(0)} días`
          }
          icon={CalendarDays}
          detail={
            <span>
              Objetivo: {finance.minCoverageDays || "—"}–
              {finance.maxCoverageDays || "—"} días.{" "}
              {f.coverage !== null &&
              finance.maxCoverageDays > 0 &&
              f.coverage > finance.maxCoverageDays
                ? "Revisar excedentes."
                : "Contrasta con demanda y mínimos."}
            </span>
          }
        />
        <Metric
          label="Rutas activas"
          value={f.active.length}
          icon={Route}
          detail={
            <>
              <Badge tone={tone(f.routeStatus)}>{f.routeStatus}</Badge>
              <span className="metric-explanation">
                {f.late
                  ? `${f.late} planes requieren ajustes.`
                  : `${money(f.monthCost)} estimados este mes / ${finance.monthlyServiceCosts ? money(finance.monthlyServiceCosts) + " presupuestados" : "presupuesto sin definir"}.`}
              </span>
            </>
          }
        />
        <Metric
          label="Referencias por revisar"
          value={low.length}
          icon={Wallet}
          detail={`${low.length ? "Prioriza reposición o reasigna existencias." : "Mínimos cubiertos; revisa vencimientos."}`}
          accent
        />
      </div>
      <div className="accounting-strip">
        <div>
          <strong>¿Cómo leer el valor y las rutas?</strong>
          <p>
            Más inventario no significa mejor desempeño. Es capital disponible
            en insumos: compáralo con presupuesto, cobertura y vencimientos. Los
            costos mensuales de rutas incluyen los planes registrados del mes y
            se comparan con el presupuesto de transporte.
          </p>
        </div>
        <span>
          <small>Cuenta de existencias</small>
          {finance.inventoryAccount}
        </span>
        <span>
          <small>Al consumir</small>
          {finance.consumptionAccount}
        </span>
      </div>
      <div className="section-heading">
        <div>
          <h2>Tu red, en el territorio</h2>
          <p>
            Bodega, atención, ventas y oportunidades con contactos accesibles.
          </p>
        </div>
        <button className="text-button" onClick={() => go("points")}>
          Gestionar ubicaciones ↗
        </button>
      </div>
      <div className="filter-buttons map-filters">
        {[
          ["all", "Toda la red"],
          ...LOCATION_TYPES.map((t) => [t.value, t.label]),
          ["frequent", "Frecuentes · ≥3 servicios/sem."],
        ].map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="map-contact-grid">
        <section className="card">
          <GeoMap
            s={s}
            pointIds={points.map((p) => p.id)}
            active={selected}
            onSelect={setSelected}
            large
          />
          <MapLegend />
        </section>
        <ContactCard s={s} id={selected} open={open} />
      </div>
      <div className="two-col">
        <section className="card padded">
          <CardTitle
            title="Próximas visitas comerciales"
            sub="Fechas de visita registradas para clientes futuros."
          />
          {next.slice(0, 5).map((p) => (
            <button
              className="list-row"
              key={p.id}
              onClick={() => open("contact", { id: p.id })}
            >
              <span>
                <strong>{p.nombre_cliente}</strong>
                <small>
                  {kindLabel(clientFor(s, p.id).kind)} ·{" "}
                  {clientFor(s, p.id).contact.name || "Contacto pendiente"}
                </small>
              </span>
              <Badge
                tone={clientFor(s, p.id).kind === "prospect" ? "sand" : "blue"}
              >
                {dateLabel(clientFor(s, p.id).nextService)}
              </Badge>
            </button>
          ))}
          {!next.length && (
            <Empty
              title="Sin visitas comerciales programadas"
              text="Registra la próxima visita en la ficha de un cliente futuro."
            />
          )}
        </section>
        <section className="card padded">
          <CardTitle title="Acciones recomendadas" />
          {low.slice(0, 4).map((i) => (
            <button
              className="list-row"
              key={i.id}
              onClick={() => go("inventory")}
            >
              <span>
                <strong>{i.nombre}</strong>
                <small>
                  Disponible {i.stock_actual} {i.unidad_medida} · mínimo{" "}
                  {i.stock_minimo}
                </small>
              </span>
              <Badge tone="sand">Revisar</Badge>
            </button>
          ))}
          <button className="text-button" onClick={() => go("purchases")}>
            Ver todas las recomendaciones ↗
          </button>
          <p className="hint">
            Valorización operativa a costo unitario registrado. No sustituye un
            cierre contable. Los objetivos{" "}
            {s.company.demo
              ? "de demostración son sintéticos y deben sustituirse por los de tu empresa."
              : "son definidos por tu empresa."}
          </p>
        </section>
      </div>
    </>
  );
}
export function MapLegend() {
  return (
    <div className="map-legend">
      <span>
        <i className="legend-bodega" />
        Bodega
      </span>
      <span>
        <i className="legend-service" />
        Atención
      </span>
      <span>
        <i className="legend-sale" />
        Venta
      </span>
      <span>
        <i className="legend-prospect" />
        Cliente futuro
      </span>
      <span>
        <i className="legend-office" />
        Oficina
      </span>
      <span>
        <i className="legend-client" />
        Cliente
      </span>
      <span>
        <i className="legend-plant" />
        Planta
      </span>
      <span>★ Frecuente</span>
    </div>
  );
}
export function ContactCard({
  s,
  id,
  open,
}: {
  s: State;
  id: string;
  open?: Open;
}) {
  const p =
    id === "warehouse" ? warehouseFor(s) : s.points.find((p) => p.id === id);
  if (!p) return <Empty title="Selecciona una ubicación" />;
  const c = clientFor(s, id);
  return (
    <section className="card padded contact-card">
      <div className="contact-card-title">
        <span className={`location-glyph ${c.kind}`}>
          <Building2 size={23} />
        </span>
        <Badge tone={c.kind === "prospect" ? "sand" : "blue"}>
          {kindLabel(c.kind)}
        </Badge>
      </div>
      <h2>{p.nombre_cliente}</h2>
      <p>{p.direccion}</p>
      <div className="contact-info">
        <span>
          <UserRound size={16} />
          <div>
            <small>Responsable / contacto</small>
            <strong>{c.contact.name || "Pendiente de registrar"}</strong>
            <small>{c.contact.role}</small>
          </div>
        </span>
        <span>
          <Phone size={16} />
          {c.contact.phone ? (
            <a href={`tel:${c.contact.phone}`}>{c.contact.phone}</a>
          ) : (
            "Sin teléfono registrado"
          )}
        </span>
        <span>
          <Mail size={16} />
          {c.contact.email ? (
            <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
          ) : (
            "Sin correo registrado"
          )}
        </span>
        <span>
          <CalendarDays size={16} />
          {c.contact.hours || "Horario por confirmar"}
        </span>
      </div>
      {id !== "warehouse" && (
        <div className="detail-grid">
          <span>
            <small>Frecuencia registrada</small>
            <strong>{c.frequency} / semana</strong>
          </span>
          {c.kind === "prospect" && (
            <span>
              <small>Próxima atención / visita</small>
              <strong>
                {c.nextService ? dateLabel(c.nextService) : "Sin programar"}
              </strong>
            </span>
          )}
        </div>
      )}
      <a
        className="btn secondary"
        href={googleLocation(p)}
        target="_blank"
        rel="noreferrer"
      >
        Google Maps ↗
      </a>
      <a
        className="text-button"
        href={`https://waze.com/ul?ll=${p.latitud},${p.longitud}&navigate=yes`}
        target="_blank"
        rel="noreferrer"
      >
        Navegar con Waze ↗
      </a>
      {open && (
        <button
          className="text-button"
          onClick={() => open("contact-edit", { id })}
        >
          Editar contacto y clasificación ↗
        </button>
      )}
    </section>
  );
}
export function Locations({ s, open }: { s: State; open: Open }) {
  const [filter, setFilter] = useState("all"),
    [q, setQ] = useState("");
  const points = s.points.filter(
    (p) =>
      (filter === "all" || clientFor(s, p.id).kind === filter) &&
      p.nombre_cliente.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        eyebrow="BODEGA, SERVICIOS Y CLIENTES"
        title="Una ficha para cada ubicación."
        text="Selecciona las coordenadas sobre el mapa y registra a quién contactar en cada entrega."
      >
        <button className="btn secondary" onClick={() => open("warehouse")}>
          Editar bodega
        </button>
        <button className="btn primary" onClick={() => open("point")}>
          <Plus size={15} />
          Nueva ubicación
        </button>
      </SectionTitle>
      <section className="card">
        <GeoMap
          s={s}
          pointIds={points.map((p) => p.id)}
          large
          onSelect={(id) => open("contact", { id })}
        />
        <MapLegend />
      </section>
      <div className="table-toolbar">
        <div className="filter-buttons">
          {[
            ["all", "Todas"],
            ...LOCATION_TYPES.map((t) => [t.value, t.label]),
          ].map(([v, label]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="compact-input"
          placeholder="Buscar ubicación…"
          aria-label="Buscar ubicación"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="location-grid">
        {(filter === "all" || filter === "warehouse") && (
          <ContactCard s={s} id="warehouse" open={open} />
        )}{" "}
        {points.map((p) => (
          <section className="card padded" key={p.id}>
            <Badge
              tone={clientFor(s, p.id).kind === "prospect" ? "sand" : "blue"}
            >
              {kindLabel(clientFor(s, p.id).kind)}
            </Badge>
            <h3>{p.nombre_cliente}</h3>
            <p>{p.direccion}</p>
            <small>
              {p.id} · {p.zona_reparto} · {p.metros_cuadrados_atendidos} m²
            </small>
            <p>{clientFor(s, p.id).contact.name || "Contacto pendiente"}</p>
            <div className="row-actions">
              <button
                className="btn secondary small"
                onClick={() => open("contact", { id: p.id })}
              >
                Ficha y contacto
              </button>
              <button className="text-button" onClick={() => open("point", p)}>
                Editar ubicación ↗
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
export function Fleet({ s, open }: { s: State; open: Open }) {
  const e = s.enterprise!,
    [tab, setTab] = useState("vehicles"),
    [ownership, setOwnership] = useState("all"),
    [vehicleId, setVehicleId] = useState("all"),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const costs = e.costs.filter(
      (c) =>
        (vehicleId === "all" || c.vehicleId === vehicleId) &&
        c.date.startsWith(month),
    ),
    trips = e.trips.filter(
      (t) =>
        (vehicleId === "all" || t.vehicleId === vehicleId) &&
        t.date.startsWith(month),
    );
  return (
    <>
      <SectionTitle
        eyebrow="GESTIÓN DE FLOTA"
        title="Vehículos listos, costos visibles."
        text="Registra tus vehículos y los del operador externo, sus documentos, mantenimientos y responsables."
      >
        <button className="btn secondary" onClick={() => open("staff")}>
          Registrar personal
        </button>
        <button className="btn primary" onClick={() => open("vehicle")}>
          <Plus size={15} />
          Registrar vehículo
        </button>
      </SectionTitle>
      <div className="metrics-grid">
        <Metric
          label="Vehículos activos"
          value={e.vehicles.filter((v) => v.active).length}
          icon={Truck}
          detail={`${e.vehicles.filter((v) => v.ownership === "Propio").length} propios · ${e.vehicles.filter((v) => v.ownership === "Externo").length} externos`}
        />
        <Metric
          label="Obligaciones por revisar"
          value={
            e.vehicles.filter((v) => {
              const c = vehicleChecks(s, v);
              return !c.technical || !c.insurance || !c.maintenance;
            }).length
          }
          icon={ShieldCheck}
          detail="Según fechas y kilometraje registrados"
        />
        <Metric
          label="Viajes del mes"
          value={e.trips.filter((t) => t.date.startsWith(month)).length}
          icon={Route}
          detail="Completados; se actualizan al cerrar rutas"
        />
        <Metric
          label="Gastos registrados del mes"
          value={money(
            e.costs
              .filter((c) => c.date.startsWith(month))
              .reduce((a, c) => a + c.amount, 0),
          )}
          icon={Wallet}
          detail="Pagos registrados; separados del costo estimado"
        />
      </div>
      <div className="tabs">
        {[
          ["vehicles", "Vehículos y obligaciones"],
          ["costs", "Costos y viajes"],
          ["staff", "Personal"],
          ["tolls", "Catálogo de peajes"],
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
      {tab === "vehicles" ? (
        <>
          <div className="filter-buttons">
            {["all", "Propio", "Externo"].map((v) => (
              <button
                key={v}
                className={ownership === v ? "active" : ""}
                onClick={() => setOwnership(v)}
              >
                {v === "all" ? "Todos" : v}
              </button>
            ))}
          </div>
          <div className="fleet-grid">
            {e.vehicles
              .filter((v) => ownership === "all" || v.ownership === ownership)
              .map((v) => {
                const c = vehicleChecks(s, v);
                return (
                  <section className="card padded vehicle-card" key={v.id}>
                    <div className="contact-card-title">
                      <Truck size={26} />
                      <Badge tone={v.active ? "green" : "gray"}>
                        {v.active ? "Activo" : "Inactivo"} · {v.ownership}
                      </Badge>
                    </div>
                    <h2>{v.plate}</h2>
                    <p>
                      {v.name} · {v.type}
                    </p>
                    <div className="derived-box">
                      <span>
                        Capacidad
                        <strong>
                          {v.capacityKg} kg / {v.capacityM3} m³
                        </strong>
                      </span>
                      <span>
                        Kilometraje<strong>{v.odometer.toFixed(0)} km</strong>
                      </span>
                      <span>
                        Fijos mensuales<strong>{money(v.fixedMonthly)}</strong>
                      </span>
                      <span>
                        Viajes completados
                        <strong>{vehicleTrips(s, v.id).length} este mes</strong>
                      </span>
                    </div>
                    <div className="obligations">
                      {[
                        ["Revisión técnica", v.technicalUntil, c.technical],
                        ["Póliza vehicular", v.insuranceUntil, c.insurance],
                        [
                          "Próximo mantenimiento",
                          `${v.maintenanceDate || "sin fecha"} / ${v.maintenanceKm} km`,
                          c.maintenance,
                        ],
                        [
                          "Personal acreditado",
                          c.driver?.name || "Sin asignar",
                          c.accredited,
                        ],
                      ].map(([label, date, ok]) => (
                        <div key={String(label)}>
                          <span>
                            <small>{label}</small>
                            <strong>{date || "Sin registrar"}</strong>
                          </span>
                          <Badge tone={ok ? "green" : "rose"}>
                            {ok ? "Al día" : "Revisar"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <div className="row-actions">
                      <button
                        className="btn secondary small"
                        onClick={() => open("vehicle", v)}
                      >
                        Editar ficha
                      </button>
                      <button
                        className="btn primary small"
                        onClick={() => open("fleet-cost", { vehicleId: v.id })}
                      >
                        Registrar gasto / mantenimiento
                      </button>
                    </div>
                  </section>
                );
              })}
          </div>
          {!e.vehicles.length && (
            <Empty
              title="Registra tu primer vehículo"
              text="Sus datos completarán automáticamente el simulador de rutas."
            />
          )}
        </>
      ) : tab === "costs" ? (
        <>
          <div className="table-toolbar">
            <div className="row-actions">
              <select
                aria-label="Filtrar vehículo"
                value={vehicleId}
                onChange={(ev) => setVehicleId(ev.target.value)}
              >
                <option value="all">Todos los vehículos</option>
                {e.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
              <input
                aria-label="Mes de costos y viajes"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="row-actions">
              <button className="btn secondary" onClick={() => open("trip")}>
                Registrar viaje histórico
              </button>
              <button
                className="btn primary"
                onClick={() => open("fleet-cost")}
              >
                Registrar gasto
              </button>
            </div>
          </div>
          <section className="card padded">
            <CardTitle
              title={`Gastos reales · ${money(costs.reduce((a, c) => a + c.amount, 0))}`}
              sub="Estos registros no duplican el presupuesto por km de las simulaciones."
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>VEHÍCULO</th>
                    <th>TIPO / DETALLE</th>
                    <th>IMPORTE</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.id}>
                      <td>{dateLabel(c.date)}</td>
                      <td>
                        {e.vehicles.find((v) => v.id === c.vehicleId)?.plate}
                      </td>
                      <td>
                        <strong>{c.category}</strong>
                        <small>{c.detail}</small>
                      </td>
                      <td>{money(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!costs.length && <Empty title="Sin gastos para este filtro" />}
            </div>
          </section>
          <section className="card padded">
            <CardTitle
              title={`Viajes completados · ${trips.length}`}
              sub="La cantidad mensual se obtiene de este registro; no se ingresa en el simulador."
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FECHA</th>
                    <th>VEHÍCULO</th>
                    <th>RECORRIDO</th>
                    <th>CONDUCCIÓN</th>
                    <th>PEAJES</th>
                    <th>REFERENCIA</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>
                        {e.vehicles.find((v) => v.id === t.vehicleId)?.plate}
                      </td>
                      <td>{t.km.toFixed(1)} km</td>
                      <td>{Math.ceil(t.minutes)} min</td>
                      <td>{money(t.tolls)}</td>
                      <td>{t.routeId || t.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : tab === "staff" ? (
        <section className="card padded">
          <CardTitle
            title="Personal y acreditaciones"
            sub="La disponibilidad y vigencia alimentan las verificaciones del vehículo."
          />
          {e.staff.map((p) => (
            <button
              className="list-row"
              key={p.id}
              onClick={() => open("staff", p)}
            >
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.role} · {money(p.hourly)}/hora · acreditación hasta{" "}
                  {p.accreditedUntil || "sin registrar"}
                </small>
              </span>
              <Badge tone={p.available ? "green" : "gray"}>
                {p.available ? "Disponible" : "No disponible"}
              </Badge>
            </button>
          ))}
          {!e.staff.length && <Empty />}
        </section>
      ) : (
        <section className="card padded">
          <CardTitle
            title="Tarifas de peajes por zona y vehículo"
            sub="Se aplican automáticamente al incluir una zona en la ruta. Confirma el trazado y la tarifa antes de salir."
          >
            <button className="btn primary" onClick={() => open("toll")}>
              Registrar tarifa
            </button>
          </CardTitle>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ZONA</th>
                  <th>VEHÍCULO</th>
                  <th>POR PASO</th>
                  <th>FUENTE / FECHA</th>
                </tr>
              </thead>
              <tbody>
                {e.tolls.map((t) => (
                  <tr key={t.id}>
                    <td>{t.zone}</td>
                    <td>{t.vehicleType === "*" ? "Todos" : t.vehicleType}</td>
                    <td>{money(t.fee)}</td>
                    <td>
                      {t.source}
                      <small>
                        {dateLabel(t.confirmedAt)} ·{" "}
                        {t.synthetic
                          ? "Sintético"
                          : "Registrado por la empresa"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            El catálogo relaciona zonas de destino con pasos previstos. No
            detecta casetas en la geometría vial ni consulta tarifas en vivo.
            Sin tarifa, el simulador avisa “Por confirmar”.
          </p>
        </section>
      )}
    </>
  );
}
export function Suppliers({ s, open }: { s: State; open: Open }) {
  const [tab, setTab] = useState("pending"),
    [supplier, setSupplier] = useState("all"),
    pending = s.suppliers
      .flatMap((p) =>
        eligibleEvaluations(s, p.id).map((op) => ({ ...op, provider: p })),
      )
      .filter((op) => supplier === "all" || op.provider.id === supplier);
  return (
    <>
      <SectionTitle
        eyebrow="PROVEEDORES Y CALIDAD"
        title="Evalúa lo que ya ocurrió."
        text="Cada calificación queda asociada a una compra recibida, rechazada o transporte externo completado."
      >
        <button className="btn primary" onClick={() => open("supplier")}>
          <Plus size={15} />
          Agregar proveedor
        </button>
      </SectionTitle>
      <div className="tabs">
        <button
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          Operaciones sin calificar ({pending.length})
        </button>
        <button
          className={tab === "directory" ? "active" : ""}
          onClick={() => setTab("directory")}
        >
          Directorio y evaluaciones
        </button>
      </div>
      {tab === "pending" ? (
        <section className="card padded">
          <CardTitle title="Pendientes de evaluación">
            <select
              aria-label="Filtrar proveedor"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="all">Todos los proveedores</option>
              {s.suppliers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </CardTitle>
          {pending.map((op) => (
            <div className="list-row" key={op.id}>
              <span>
                <strong>{op.label}</strong>
                <small>
                  {op.provider.nombre} · {dateLabel(op.date)}
                </small>
              </span>
              <button
                className="btn primary small"
                onClick={() =>
                  open("evaluation", { ...op.provider, referenceId: op.id })
                }
              >
                Calificar
              </button>
            </div>
          ))}
          {!pending.length && (
            <Empty
              title="No hay operaciones pendientes de evaluación"
              text="Aparecen aquí al recibir o rechazar una compra, o completar un transporte externo."
            />
          )}
        </section>
      ) : (
        <div className="supplier-grid">
          {s.suppliers.map((p) => {
            const score = supplierScore(p);
            return (
              <section className="card padded supplier-card" key={p.id}>
                <Badge
                  tone={
                    !p.evaluations.length
                      ? "gray"
                      : score >= 85
                        ? "green"
                        : score >= 70
                          ? "sand"
                          : "rose"
                  }
                >
                  {!p.evaluations.length
                    ? "Sin evaluar"
                    : score >= 85
                      ? "Riesgo bajo"
                      : score >= 70
                        ? "Riesgo medio"
                        : "Riesgo alto"}
                </Badge>
                <h2>{p.nombre}</h2>
                <p>{p.categoria}</p>
                <div className="supplier-score">
                  <strong>
                    {p.evaluations.length ? score.toFixed(0) : "—"}
                    <small>/100</small>
                  </strong>
                  <span>{p.evaluations.length} evaluaciones</span>
                </div>
                <div className="supplier-contact">
                  <p>RUC: {p.ruc || "Pendiente"}</p>
                  <p>{p.direccion || "Dirección pendiente"}</p>
                  <p>
                    {p.contacto || "Contacto pendiente"} ·{" "}
                    {p.telefono || p.email || "Sin teléfono o correo"}
                  </p>
                  <p>Pago: {p.paymentTerms || "Sin condiciones registradas"}</p>
                </div>
                <div className="row-actions">
                  <button
                    className="btn secondary small"
                    onClick={() => open("supplier-contact", p)}
                  >
                    Completar ficha
                  </button>
                  <button
                    className="btn secondary small"
                    onClick={() => open("catalog", p)}
                  >
                    Catálogo ({p.products?.length || 0})
                  </button>
                  <button
                    className="text-button"
                    onClick={() => open("supplierdetail", p)}
                  >
                    Evaluaciones ↗
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="method-note">
        Puntaje operativo: 40% puntualidad + 40% calidad + 20% costo. Cada
        dimensión se evalúa de 1 a 5. El índice no es una calificación
        crediticia. Los registros de demostración incluyen evaluaciones
        históricas sintéticas.
      </p>
    </>
  );
}
export function Settings({
  s,
  action,
  busy,
}: {
  s: State;
  action: Action;
  busy: boolean;
}) {
  const e = s.enterprise!;
  return (
    <>
      <SectionTitle
        eyebrow="TU ESPACIO EN NEXO"
        title="Perfil y preferencias."
        text="Administra tus datos de perfil, idioma regional y planes de operación guardados."
      />
      <div className="two-col">
        <section className="card padded">
          <CardTitle icon={UserRound} title="Mi perfil" />
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              action("profile.update", {
                ...Object.fromEntries(f),
                digest: f.has("digest"),
              });
            }}
          >
            <Field label="Nombre" name="name" value={e.profile.name} />
            <Field
              label="Correo de contacto"
              name="email"
              type="email"
              value={e.profile.email}
              required={false}
            />
            <Field
              label="Cargo o función"
              name="position"
              value={e.profile.position}
            />
            <div className="form-grid">
              <label className="form-field">
                Idioma y formato regional
                <select name="locale" defaultValue={e.profile.locale}>
                  <option value="es-EC">Español · Ecuador</option>
                  <option value="es-419">Español · Latinoamérica</option>
                </select>
              </label>
              <label className="form-field">
                Zona horaria
                <select name="timezone" defaultValue={e.profile.timezone}>
                  <option value="America/Guayaquil">
                    Ecuador continental · UTC−5
                  </option>
                  <option value="Pacific/Galapagos">Galápagos · UTC−6</option>
                </select>
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="digest"
                defaultChecked={e.profile.digest}
              />
              Mostrar avisos operativos en mi espacio
            </label>
            <p className="hint">
              Preferencias del espacio; las alertas por perfil se consultan en
              Centro de alertas. Los horarios del simulador se expresan en hora
              continental de Ecuador.
            </p>
            <button className="btn primary" disabled={busy}>
              Guardar preferencias <Check size={15} />
            </button>
          </form>
        </section>
        <div>
          <section className="card padded">
            <CardTitle title="Plan del espacio" />
            <Badge tone="blue">Prototipo del concurso</Badge>
            <p>
              Espacio con datos persistentes y módulos de logística, inventario,
              compras y flota. Nexo no tiene facturación ni suscripciones
              comerciales integradas.
            </p>
            <div className="derived-box">
              <span>
                Empresa<strong>{s.company.name}</strong>
              </span>
              <span>
                Datos
                <strong>
                  {s.company.demo
                    ? "Demostración sintética"
                    : "Registros de mi empresa"}
                </strong>
              </span>
            </div>
          </section>
          <section className="card padded">
            <CardTitle
              title="Planes de rutas activos"
              sub="Los planes operativos que aún no se han completado."
            />
            {s.routes
              .filter((r) => r.estado !== "Completada")
              .map((r) => (
                <div className="list-row" key={r.id}>
                  <span>
                    <strong>{r.nombre}</strong>
                    <small>
                      {r.id} · {dateLabel(r.date)}
                    </small>
                  </span>
                  <Badge tone="blue">{r.estado}</Badge>
                </div>
              ))}
            {!s.routes.some((r) => r.estado !== "Completada") && (
              <p className="hint">Sin planes de ruta activos.</p>
            )}
          </section>
          <section className="card padded">
            <CardTitle title="Mis datos" />
            <button
              className="btn secondary"
              onClick={() =>
                download("nexo-datos.json", JSON.stringify(s, null, 2))
              }
            >
              Descargar copia de datos <Download size={15} />
            </button>
            <p className="hint">
              Los registros de cada empresa se conservan en su propio espacio.
              Las tarifas, obligaciones y objetivos financieros se gestionan en
              sus módulos correspondientes.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
