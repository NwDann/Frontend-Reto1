import { downloadFile } from "../services/api";
("use client");
import { State, Route, money } from "@/lib/model";
import type { LogisticsScenario } from "@/lib/logistics";
import { riskOptionLabel } from "@/lib/route-options";
import { Badge, CardTitle, Empty, download, dateLabel } from "./ui";
import GeoMap, { googleRoute } from "./GeoMap";
const parameterLabels: Record<string, string> = {
  mode: "Modalidad",
  priority: "Prioridad",
  vehicleId: "Registro de vehículo propio",
  externalVehicleId: "Registro de vehículo externo",
  vehicleType: "Tipo de vehículo",
  vehicles: "Vehículos asignados",
  driversPerVehicle: "Conductores por vehículo",
  fuelPrice: "Combustible · USD/galón",
  kmPerGallon: "Rendimiento · km/galón",
  driverCost: "Pago fijo de conductor · USD",
  driverHourly: "Costo horario del conductor · USD/h",
  food: "Alimentación · USD",
  tolls: "Peajes propios · USD",
  other: "Otros gastos del viaje · USD",
  maintenanceKm: "Presupuesto de mantenimiento · USD/km",
  fixedMonthly: "Fijos mensuales · USD",
  tripsMonthly: "Viajes usados para asignar fijos",
  insuranceTrip: "Prima de mercadería asignada · USD",
  serviceRevenue: "Ingreso declarado · USD",
  otherServiceCosts: "Costos directos de limpieza · USD",
  targetMargin: "Margen objetivo sobre ventas · %",
  speed: "Velocidad histórica de referencia · km/h",
  serviceMinutes: "Descarga y verificación por destino · min",
  breakMinutes: "Pausas · min",
  returnToWarehouse: "Regresar al punto de partida",
  returnLoaded: "Retorno con carga",
  loadKg: "Peso declarado · kg (0: guías)",
  loadM3: "Volumen declarado · m³ (0: guías)",
  capacityKg: "Capacidad por vehículo · kg",
  capacityM3: "Capacidad por vehículo · m³",
  accredited: "Personal propio acreditado",
  technicalValid: "Revisión técnica propia vigente",
  insuranceValid: "Póliza propia vigente",
  maintenanceValid: "Mantenimiento propio al día",
  cargoAllowed: "Vehículo propio apto para químicos",
  weatherRisk: "Clima esperado",
  roadRisk: "Condición vial",
  nightRisk: "Conducción nocturna",
  cargoRisk: "Puntaje por naturaleza de carga",
  experienceRisk: "Puntaje por experiencia",
  co2Factor: "Factor de emisiones · kg CO₂/galón",
  departure: "Salida · hora continental Ecuador",
  finishBy: "Hora límite · hora continental Ecuador",
  deadlineMinutes: "Ventana disponible · min",
  externalName: "Operador externo",
  externalRateMode: "Tipo de tarifa externa",
  externalFee: "Tarifa fija cotizada · USD/viaje",
  externalKm: "Tarifa cotizada · USD/km",
  externalStop: "Tarifa por parada · USD",
  externalQuotedExtras: "Recargos cotizados fuera de peajes · USD",
  externalExtras: "Recargos y peajes externos asignados · USD",
  externalTollsIncluded: "Tarifa externa incluye peajes",
  externalMinutes: "Espera del operador · min",
  externalCapacityKg: "Capacidad externa · kg",
  externalCapacityM3: "Capacidad externa · m³",
  externalOTD: "Evaluaciones externas con puntualidad ≥4 · %",
  externalRisk: "Índice de riesgo externo · 0–35",
  externalAccredited: "Personal externo acreditado",
  externalTechnical: "Revisión técnica externa vigente",
  externalInsurance: "Póliza externa vigente",
  externalMaintenance: "Mantenimiento externo al día",
  externalCargo: "Vehículo externo apto para químicos",
  laborHours: "Horas del equipo de limpieza",
  laborRate: "Costo horario de limpieza · USD/h",
  extraServiceCosts: "Otros costos directos · USD",
};
const indicatorLabels: Record<string, string> = {
  distance: "Distancia · km",
  minutes: "Tiempo total · min",
  drivingMinutes: "Conducción · min",
  waiting: "Espera ponderada por urgencia · min ponderados",
  cost: "Costo logístico · USD",
  costKm: "Costo por km · USD/km",
  costDelivery: "Costo por destino · USD",
  costTon: "Costo por tonelada · USD/t",
  costKg: "Costo por kg · USD/kg",
  load: "Carga · kg",
  volume: "Volumen de carga · m³",
  fuelGallons: "Combustible · galones",
  co2: "Emisiones estimadas · kg CO₂",
  netContribution: "Contribución con ingreso declarado · USD",
  margin: "Margen con ingreso declarado · %",
  minimumServiceRevenue: "Precio sugerido · USD sin impuestos",
  utilizationKg: "Uso de capacidad de peso · %",
  utilizationM3: "Uso de capacidad de volumen · %",
  emptyKm: "Retorno sin carga · km",
  emptyPercent: "Recorrido sin carga · %",
  roadRisk: "Índice interno de riesgo · 0–35",
  riskLabel: "Categoría del índice de riesgo",
  score: "Puntaje relativo de selección · 0–100",
  savings: "Ahorro frente al orden inicial · USD",
  externalOTD: "Evaluaciones externas con puntualidad ≥4 · %",
  rank: "Posición en la comparación",
};
function displayParameter(key: string, value: unknown) {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (["weatherRisk", "roadRisk", "nightRisk"].includes(key))
    return `${value} · ${riskOptionLabel(key, Number(value))}`;
  if (key === "mode")
    return (
      {
        own: "Flota propia",
        external: "Servicio externo",
        both: "Comparación propia y externa",
      }[String(value)] || String(value)
    );
  if (key === "priority")
    return (
      {
        cost: "Costo",
        time: "Atención de urgentes",
        risk: "Riesgo",
        balanced: "Equilibrio",
      }[String(value)] || String(value)
    );
  if (key === "externalRateMode")
    return value === "fixed" ? "Fija por viaje" : "Por kilómetro";
  return String(value);
}
export default function RouteDetails({
  s,
  route: r,
}: {
  s: State;
  route: Route;
}) {
  const c = r.scenario as Partial<LogisticsScenario> & Route["scenario"],
    snapshot = r.snapshot,
    p = c.inputs,
    origin = snapshot?.origin || c.warehouse,
    destinations =
      snapshot?.destinations ||
      r.scenario.order.flatMap((id) => {
        const point = s.points.find((x) => x.id === id);
        return point ? [point] : [];
      }),
    historical = !!snapshot,
    view: State = {
      ...s,
      warehouse: origin || s.warehouse,
      points: destinations,
      enterprise: s.enterprise
        ? {
            ...s.enterprise,
            contacts: { ...s.enterprise.contacts, ...snapshot?.contacts },
          }
        : undefined,
    };
  const guides =
      snapshot?.dispatches ||
      r.dispatches.flatMap((id) => {
        const d = s.dispatches.find((x) => x.id === id);
        return d ? [d] : [];
      }),
    items = snapshot?.items || s.items,
    vehicle = snapshot?.vehicle,
    driver = snapshot?.driver;
  return (
    <div className="saved-route-detail">
      <div className="section-heading">
        <div>
          <Badge tone={r.estado === "Completada" ? "green" : "blue"}>
            {r.estado}
          </Badge>
          <h3>{r.nombre}</h3>
          <p>
            {r.id} · {dateLabel(r.date)} · {r.vehicle}
          </p>
        </div>
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            download(`${r.id}-plan-completo.json`, JSON.stringify(r, null, 2))
          }
        >
          Descargar plan completo
        </button>
      </div>
      <div className="derived-box">
        <span>
          Transporte estimado<strong>{money(c.cost)}</strong>
        </span>
        <span>
          Distancia<strong>{c.distance.toFixed(1)} km</strong>
        </span>
        <span>
          Tiempo total<strong>{Math.ceil(c.minutes)} min</strong>
        </span>
        <span>
          Modalidad<strong>{c.nombre}</strong>
        </span>
        <span>
          Carga
          <strong>
            {c.load.toFixed(2)} kg / {c.volume.toFixed(3)} m³
          </strong>
        </span>
        <span>
          Precio sugerido del servicio
          <strong>
            {c.minimumServiceRevenue === undefined
              ? "No registrado"
              : money(c.minimumServiceRevenue)}
          </strong>
        </span>
        {c.drivingMinutes !== undefined && (
          <span>
            Conducción / velocidad calculada
            <strong>
              {Math.ceil(c.drivingMinutes)} min /{" "}
              {c.drivingMinutes > 0
                ? ((c.distance / c.drivingMinutes) * 60).toFixed(1)
                : "0"}{" "}
              km/h
            </strong>
          </span>
        )}
        {c.roadRisk !== undefined && (
          <span>
            Riesgo interno
            <strong>
              {c.roadRisk.toFixed(1)}/35 · {c.riskLabel}
            </strong>
          </span>
        )}
      </div>
      <p className="hint">
        {historical
          ? `Datos conservados al guardar el plan, ${new Date(snapshot.createdAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.`
          : "Este plan anterior conserva los indicadores y parámetros que aparecen abajo. Sus contactos y destinos se consultan del registro actual cuando no existe una copia histórica."}
      </p>
      <section className="card padded">
        <CardTitle title="Origen y secuencia de destinos" />
        {origin ? (
          <p>
            <strong>Inicio: {origin.nombre_cliente}</strong>
            <br />
            {origin.direccion} · {origin.latitud}, {origin.longitud}
          </p>
        ) : (
          <p className="hint">
            El plan antiguo no guardó las coordenadas del origen.
          </p>
        )}
        <ol className="route-stop-list">
          {r.scenario.order.map((id) => {
            const point = destinations.find((x) => x.id === id),
              contact =
                snapshot?.contacts[id]?.contact ||
                (!historical ? s.enterprise?.contacts[id]?.contact : undefined);
            return (
              <li key={id}>
                <strong>{point?.nombre_cliente || id}</strong>
                <p>{point?.direccion || "Dirección no conservada"}</p>
                {point && (
                  <small>
                    {point.latitud}, {point.longitud} ·{" "}
                    {point.urgente ? "Entrega prioritaria" : "Entrega normal"} ·{" "}
                    {point.requiere_personal_acreditado
                      ? "Requiere acreditación"
                      : "Acceso general"}
                  </small>
                )}
                {contact && (
                  <p className="hint">
                    Contacto: {contact.name || "Sin registrar"} ·{" "}
                    {contact.phone || contact.email || "Sin teléfono/correo"}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <p className="hint">
          {p?.returnToWarehouse === false
            ? "Finaliza en el último destino."
            : "Incluye regreso al punto de partida."}
        </p>
        {origin && destinations.length === r.scenario.order.length && (
          <>
            <GeoMap
              s={view}
              origin={origin}
              order={r.scenario.order}
              returnToWarehouse={p?.returnToWarehouse !== false}
            />
            <a
              className="text-button"
              href={googleRoute(
                view,
                r.scenario.order,
                p?.returnToWarehouse !== false,
                origin,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Abrir recorrido en Google Maps ↗
            </a>
          </>
        )}
      </section>
      <section className="card padded">
        <CardTitle title="Costos y resultado de la comparación" />
        {c.components?.length ? (
          <div className="cost-breakdown">
            {c.components.map((x) => (
              <div key={x.label}>
                <span>{x.label}</span>
                <strong>{money(x.value)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">
            El desglose por concepto no se conservó en este plan antiguo.
          </p>
        )}
        {snapshot?.serviceCosts && (
          <div className="derived-box">
            <span>
              Insumos<strong>{money(snapshot.serviceCosts.materials)}</strong>
            </span>
            <span>
              Personal de limpieza
              <strong>{money(snapshot.serviceCosts.labor)}</strong>
            </span>
            <span>
              Otros costos directos
              <strong>{money(snapshot.serviceCosts.extra)}</strong>
            </span>
            <span>
              Margen objetivo<strong>{p?.targetMargin ?? "—"}%</strong>
            </span>
          </div>
        )}
        <p>{c.recommendation || c.description}</p>
        {c.warnings?.map((w) => (
          <p className="scenario-warning" key={w}>
            {w}
          </p>
        ))}
        <div className="detail-grid">
          <span>
            <small>Factibilidad al calcular</small>
            <strong>
              {c.feasible ? "Cumplía requisitos" : "Revisar requisitos"}
            </strong>
          </span>
          <span>
            <small>Cumplía la hora límite</small>
            <strong>
              {c.onTime === undefined
                ? "No conservado"
                : c.onTime
                  ? "Sí"
                  : "No"}
            </strong>
          </span>
          <span>
            <small>Cierre estimado</small>
            <strong>
              {c.arrival
                ? new Date(c.arrival).toLocaleString("es-EC", {
                    timeZone: "America/Guayaquil",
                  })
                : "No conservado"}
            </strong>
          </span>
          <span>
            <small>Fuente de distancias</small>
            <strong>
              {c.dataSource || "Aproximación geográfica del plan antiguo"}
            </strong>
          </span>
        </div>
        <p className="hint">
          Son estimaciones guardadas, no gastos reales ni tráfico en vivo.
        </p>
      </section>
      <section className="card padded">
        <CardTitle title="Vehículo y conductor al guardar" />
        {vehicle ? (
          <>
            <div className="detail-grid">
              <span>
                <small>Vehículo / propiedad</small>
                <strong>
                  {vehicle.plate} · {vehicle.type} · {vehicle.ownership}
                </strong>
              </span>
              <span>
                <small>Capacidad</small>
                <strong>
                  {vehicle.capacityKg} kg / {vehicle.capacityM3} m³
                </strong>
              </span>
              <span>
                <small>Odómetro</small>
                <strong>{vehicle.odometer} km</strong>
              </span>
              <span>
                <small>Revisión técnica hasta</small>
                <strong>{vehicle.technicalUntil || "Sin registrar"}</strong>
              </span>
              <span>
                <small>Póliza vehicular hasta</small>
                <strong>{vehicle.insuranceUntil || "Sin registrar"}</strong>
              </span>
              <span>
                <small>Referencia de póliza</small>
                <strong>{vehicle.policy || "Sin registrar"}</strong>
              </span>
              <span>
                <small>Mercadería en tránsito hasta</small>
                <strong>
                  {vehicle.cargoInsuranceUntil || "Sin registrar"}
                </strong>
              </span>
              <span>
                <small>Próximo mantenimiento</small>
                <strong>
                  {vehicle.maintenanceDate || "Sin fecha"} /{" "}
                  {vehicle.maintenanceKm} km
                </strong>
              </span>
              <span>
                <small>Conductor asignado</small>
                <strong>
                  {driver?.name || "Sin registrar"}
                  {driver?.phone ? " · " + driver.phone : ""}
                </strong>
              </span>
              <span>
                <small>Acreditación hasta</small>
                <strong>{driver?.accreditedUntil || "Sin registrar"}</strong>
              </span>
            </div>
            {vehicle.notes && <p className="hint">{vehicle.notes}</p>}
          </>
        ) : (
          <p className="hint">
            Vehículo u operador registrado en este plan: {r.vehicle}. No se
            conservó una ficha histórica completa.
          </p>
        )}
      </section>
      <section className="card padded">
        <CardTitle
          title="Guías y carga usadas en el cálculo"
          sub="Se distingue si la guía quedó asignada a la ejecución de este plan."
        />
        {guides.map((d) => (
          <div key={d.id} className="plan-guide">
            <strong>{d.id}</strong>{" "}
            <Badge tone={r.dispatches.includes(d.id) ? "blue" : "gray"}>
              {r.dispatches.includes(d.id)
                ? "Asignada al plan"
                : "Solo referencia del cálculo"}
            </Badge>
            <small className="block">
              Destino:{" "}
              {destinations.find((x) => x.id === d.point)?.nombre_cliente ||
                d.point}{" "}
              · Estado al guardar: {d.estado} · Actual:{" "}
              {s.dispatches.find((x) => x.id === d.id)?.estado ||
                "No disponible"}
            </small>
            <ul>
              {d.lines.map((l) => (
                <li key={l.insumo_id}>
                  {items.find((i) => i.id === l.insumo_id)?.nombre ||
                    l.insumo_id}
                  : {l.cantidad}{" "}
                  {items.find((i) => i.id === l.insumo_id)?.unidad_medida}
                </li>
              ))}
            </ul>
            {d.document && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  downloadFile(s.company.id, d.document!).catch((e) =>
                    alert(e.message),
                  )
                }
              >
                Ver guía adjunta ↗
              </button>
            )}
            {d.notas && (
              <p className="hint">Observaciones al guardar: {d.notas}</p>
            )}
            {d.responsibility && (
              <p className="hint">
                Vehículo: {d.responsibility.vehicle || "Sin registrar"} ·
                Conductor: {d.responsibility.driver || "Sin registrar"} ·
                Despachador: {d.responsibility.dispatcher || "Sin registrar"} ·
                Receptor: {d.responsibility.receiver || "Sin registrar"}
              </p>
            )}
          </div>
        ))}
        {!guides.length && (
          <p className="hint">
            No hay guías conservadas o asociadas a este plan.
          </p>
        )}
      </section>
      <details className="method-details">
        <summary>Todos los indicadores del escenario</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>INDICADOR</th>
                <th>RESULTADO GUARDADO</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(indicatorLabels)
                .filter(([key]) => key in c)
                .map(([key, label]) => {
                  const value = (c as unknown as Record<string, unknown>)[key];
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td>
                        {value === null || value === undefined
                          ? "No registrado / no aplica"
                          : typeof value === "number"
                            ? Number(value.toFixed(4))
                            : String(value)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>
      <details className="method-details">
        <summary>Todos los parámetros guardados</summary>
        {p ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PARÁMETRO</th>
                  <th>VALOR AL CALCULAR</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(p)
                  .filter(
                    ([key, value]) =>
                      key !== "origin" &&
                      key !== "registered" &&
                      value !== undefined,
                  )
                  .map(([key, value]) => (
                    <tr key={key}>
                      <td>{parameterLabels[key] || key}</td>
                      <td>{displayParameter(key, value)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Este plan antiguo no guardó un formulario de parámetros.</p>
        )}
      </details>
    </div>
  );
}
