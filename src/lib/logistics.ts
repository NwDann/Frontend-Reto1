import { normalizeLocation } from "./locations.ts";
import { upgradeEnterprise, clientFor } from "./enterprise.ts";
import type { State, Point, Scenario } from "./model";
export type Location = { latitud: number; longitud: number };
export type Warehouse = Location & {
  nombre_cliente: string;
  direccion: string;
};
export type Offer = {
  itemId: string;
  price: number;
  lead: number;
  minOrder: number;
};
export type Plan = {
  origin?: Warehouse;
  externalRateMode?: "km" | "fixed";
  externalTollsIncluded?: boolean;
  registered?: boolean;
  vehicleId?: string;
  externalVehicleId?: string;
  laborHours?: number;
  laborRate?: number;
  extraServiceCosts?: number;
  externalQuotedExtras?: number;
  finishBy?: string;
  mode: "both" | "own" | "external";
  priority: "cost" | "time" | "balanced" | "risk";
  vehicleType: string;
  vehicles: number;
  driversPerVehicle: number;
  fuelPrice: number;
  kmPerGallon: number;
  driverCost: number;
  driverHourly: number;
  food: number;
  tolls: number;
  other: number;
  maintenanceKm: number;
  fixedMonthly: number;
  tripsMonthly: number;
  insuranceTrip: number;
  serviceRevenue: number;
  otherServiceCosts: number;
  targetMargin: number;
  speed: number;
  serviceMinutes: number;
  breakMinutes: number;
  returnToWarehouse: boolean;
  returnLoaded: boolean;
  loadKg: number;
  loadM3: number;
  capacityKg: number;
  capacityM3: number;
  accredited: boolean;
  technicalValid: boolean;
  insuranceValid: boolean;
  maintenanceValid: boolean;
  cargoAllowed: boolean;
  weatherRisk: number;
  roadRisk: number;
  nightRisk: number;
  cargoRisk: number;
  experienceRisk: number;
  co2Factor: number;
  departure: string;
  deadlineMinutes: number;
  externalName: string;
  externalFee: number;
  externalKm: number;
  externalStop: number;
  externalExtras: number;
  externalMinutes: number;
  externalCapacityKg: number;
  externalCapacityM3: number;
  externalOTD: number;
  externalRisk: number;
  externalAccredited: boolean;
  externalTechnical: boolean;
  externalInsurance: boolean;
  externalMaintenance: boolean;
  externalCargo: boolean;
};
export type RoadMatrix = {
  ids: string[];
  coordinates: string;
  distances: number[][];
  durations: number[][];
  source: "OSRM";
  fetchedAt: string;
};
export type LogisticsScenario = Scenario & {
  mode: "own" | "external";
  operator: string;
  drivingMinutes: number;
  waiting: number;
  costKm: number | null;
  costDelivery: number;
  costTon: number | null;
  costKg: number | null;
  fuelGallons: number | null;
  co2: number | null;
  netContribution: number | null;
  margin: number | null;
  minimumServiceRevenue: number;
  utilizationKg: number;
  utilizationM3: number;
  emptyKm: number;
  emptyPercent: number;
  roadRisk: number;
  riskLabel: string;
  warnings: string[];
  onTime: boolean;
  arrival: string;
  components: { label: string; value: number }[];
  dataSource: string;
  externalOTD: number | null;
  inputs: Plan;
  warehouse: Warehouse;
  matrix?: RoadMatrix;
  recommendation: string;
  rank: number;
};
export const DEFAULT_WAREHOUSE: Warehouse = {
  latitud: -0.128,
  longitud: -78.487,
  nombre_cliente: "Bodega central",
  direccion: "Quito, Ecuador",
};
export const warehouseFor = (s: State): Warehouse =>
  s.warehouse || DEFAULT_WAREHOUSE;
export const originFor = (s: State, input?: Partial<Plan>): Warehouse =>
  input?.origin ? normalizeLocation(input.origin) : warehouseFor(s);
export function defaultPlan(s: State): Plan {
  return {
    mode: "both",
    priority: "balanced",
    vehicleType: "Furgoneta de reparto",
    vehicles: 1,
    driversPerVehicle: 1,
    fuelPrice: 3.2,
    kmPerGallon: 28,
    driverCost: 0,
    driverHourly: 5,
    food: 8,
    tolls: 0,
    other: 0,
    maintenanceKm: 0.12,
    fixedMonthly: 180,
    tripsMonthly: 24,
    insuranceTrip: 2,
    serviceRevenue: 0,
    otherServiceCosts: 0,
    targetMargin: 20,
    speed: s.settings.speed,
    serviceMinutes: 12,
    breakMinutes: 0,
    returnToWarehouse: true,
    returnLoaded: false,
    loadKg: 0,
    loadM3: 0,
    capacityKg: s.settings.capacity,
    capacityM3: s.settings.volume,
    accredited: s.settings.accredited,
    technicalValid: true,
    insuranceValid: true,
    maintenanceValid: true,
    cargoAllowed: true,
    weatherRisk: 0,
    roadRisk: 1,
    nightRisk: 0,
    cargoRisk: 0,
    experienceRisk: 1,
    co2Factor: 10.21,
    departure: new Date().toISOString().slice(0, 10) + "T08:00",
    deadlineMinutes: 240,
    externalName: "Operador externo",
    externalFee: 25,
    externalKm: 0.7,
    externalStop: 2,
    externalExtras: 0,
    externalMinutes: 15,
    externalCapacityKg: 1500,
    externalCapacityM3: 10,
    externalOTD: 95,
    externalRisk: 5,
    externalAccredited: true,
    externalTechnical: true,
    externalInsurance: true,
    externalMaintenance: true,
    externalCargo: true,
  };
}
export function upgradeState(s: State): State {
  s.warehouse ??= { ...DEFAULT_WAREHOUSE };
  s.logistics = { ...defaultPlan(s), ...s.logistics };
  for (const p of s.suppliers)
    if (!p.products) {
      const prior = new Set(
        s.purchases.filter((x) => x.supplier === p.id).map((x) => x.item),
      );
      if (s.company.demo) {
        for (const i of s.items) {
          if (
            (p.id === "PR-001" && i.categoria === "quimico") ||
            (p.id === "PR-002" && i.categoria === "consumible") ||
            (p.id === "PR-003" &&
              ["quimico", "herramienta"].includes(i.categoria)) ||
            (p.id === "PR-004" &&
              ["consumible", "herramienta"].includes(i.categoria))
          )
            prior.add(i.id);
        }
      }
      p.products = [...prior]
        .filter((id) => s.items.some((i) => i.id === id))
        .map((id) => ({
          itemId: id,
          price: s.items.find((i) => i.id === id)!.precio_unitario,
          lead: p.lead,
          minOrder: 1,
        }));
    }
  return upgradeEnterprise(s);
}
export function offersFor(s: State, item: string) {
  return s.suppliers
    .flatMap((p) =>
      (p.products || [])
        .filter((o) => o.itemId === item)
        .map((o) => ({ supplier: p, ...o })),
    )
    .sort((a, b) => a.price - b.price);
}
const number = (v: unknown, min: number, max = 1e8) => {
  if (v === null || v === "" || v === undefined)
    throw Error("Completa todos los parámetros numéricos del formulario.");
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error("Hay un parámetro fuera de su rango permitido.");
  return n;
};
export function normalizePlan(s: State, input: Partial<Plan>): Plan {
  const p = { ...defaultPlan(s), ...input };
  if (
    !["both", "own", "external"].includes(p.mode) ||
    !["cost", "time", "balanced", "risk"].includes(p.priority)
  )
    throw Error("Selecciona una modalidad y prioridad válidas.");
  for (const key of [
    "vehicles",
    "driversPerVehicle",
    "kmPerGallon",
    "tripsMonthly",
    "speed",
    "capacityKg",
    "capacityM3",
    "externalCapacityKg",
    "externalCapacityM3",
  ] as const)
    p[key] = number(p[key], 0.01);
  if (
    !Number.isInteger(p.vehicles) ||
    !Number.isInteger(p.driversPerVehicle) ||
    !Number.isInteger(p.tripsMonthly) ||
    p.vehicles > 20
  )
    throw Error(
      "Vehículos, conductores y viajes deben ser enteros positivos (máximo 20 vehículos).",
    );
  for (const key of [
    "fuelPrice",
    "driverCost",
    "driverHourly",
    "food",
    "tolls",
    "other",
    "maintenanceKm",
    "fixedMonthly",
    "insuranceTrip",
    "serviceRevenue",
    "otherServiceCosts",
    "serviceMinutes",
    "breakMinutes",
    "loadKg",
    "loadM3",
    "co2Factor",
    "deadlineMinutes",
    "externalFee",
    "externalKm",
    "externalStop",
    "externalExtras",
    "externalMinutes",
  ] as const)
    p[key] = number(p[key], 0);
  for (const key of [
    "weatherRisk",
    "roadRisk",
    "nightRisk",
    "cargoRisk",
    "experienceRisk",
  ] as const)
    p[key] = number(p[key], 0, 5);
  p.externalRisk = number(p.externalRisk, 0, 35);
  p.externalOTD = number(p.externalOTD, 0, 100);
  p.targetMargin = number(p.targetMargin, 0, 99.9);
  for (const key of [
    "accredited",
    "technicalValid",
    "insuranceValid",
    "maintenanceValid",
    "cargoAllowed",
    "externalAccredited",
    "externalTechnical",
    "externalInsurance",
    "externalMaintenance",
    "externalCargo",
    "returnToWarehouse",
    "returnLoaded",
  ] as const)
    if (typeof p[key] !== "boolean")
      throw Error("Revisa las condiciones del escenario.");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.departure) ||
    !Number.isFinite(new Date(p.departure + "-05:00").getTime())
  )
    throw Error("Selecciona una fecha y hora de salida válidas.");
  if (
    p.externalTollsIncluded !== undefined &&
    typeof p.externalTollsIncluded !== "boolean"
  )
    throw Error("Confirma si la tarifa incluye peajes.");
  if (p.origin) p.origin = normalizeLocation(p.origin);
  if (
    p.externalRateMode !== undefined &&
    !["km", "fixed"].includes(p.externalRateMode)
  )
    throw Error("Selecciona tarifa por km o tarifa fija por viaje.");
  if (p.externalRateMode === "fixed") {
    p.externalKm = 0;
    p.externalStop = 0;
  } else if (p.externalRateMode === "km") {
    p.externalFee = 0;
    p.externalStop = 0;
  }
  p.vehicleType = String(p.vehicleType).slice(0, 100);
  p.externalName = String(p.externalName).slice(0, 100);
  return p;
}
export const coordinateKey = (locations: Location[]) =>
  locations
    .map((p) => `${p.longitud.toFixed(6)},${p.latitud.toFixed(6)}`)
    .join(";");
function distance(a: Location, b: Location) {
  const r = (v: number) => (v * Math.PI) / 180,
    x =
      Math.sin(r(b.latitud - a.latitud) / 2) ** 2 +
      Math.cos(r(a.latitud)) *
        Math.cos(r(b.latitud)) *
        Math.sin(r(b.longitud - a.longitud) / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function permute<T>(xs: T[]): T[][] {
  return xs.length < 2
    ? [xs]
    : xs.flatMap((x, i) =>
        permute(xs.filter((_, j) => i !== j)).map((a) => [x, ...a]),
      );
}
export function validateMatrix(
  s: State,
  ids: string[],
  m?: RoadMatrix,
  start: Warehouse = warehouseFor(s),
): RoadMatrix | undefined {
  if (!m) return;
  const expected = ["warehouse", ...ids],
    coords = coordinateKey([
      start,
      ...ids.map((id) => s.points.find((p) => p.id === id)!),
    ]),
    n = expected.length;
  if (
    m.source !== "OSRM" ||
    JSON.stringify(m.ids) !== JSON.stringify(expected) ||
    m.coordinates !== coords
  )
    throw Error(
      "La matriz vial no corresponde a las ubicaciones seleccionadas.",
    );
  for (const grid of [m.distances, m.durations])
    if (
      !Array.isArray(grid) ||
      grid.length !== n ||
      grid.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== n ||
          row.some(
            (v) =>
              typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e8,
          ),
      )
    )
      throw Error(
        "La matriz vial está incompleta o no tiene rutas para todos los puntos.",
      );
  return m;
}
export function compareLogistics(
  state: State,
  ids: string[],
  input: Partial<Plan>,
  road?: RoadMatrix,
): LogisticsScenario[] {
  const s = upgradeState(structuredClone(state)),
    p = normalizePlan(s, input),
    wh = originFor(s, p);
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 7 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !s.points.some((x) => x.id === id))
  )
    throw Error("Selecciona entre 1 y 7 destinos distintos.");
  const points = ids.map((id) => s.points.find((x) => x.id === id)!),
    matrix = validateMatrix(s, ids, road, wh),
    indexes = new Map(ids.map((id, i) => [id, i + 1]));
  const scheduled = s.dispatches
      .filter((d) => ids.includes(d.point) && d.estado === "Programada")
      .flatMap((d) => d.lines),
    registeredKg = scheduled.reduce(
      (a, l) =>
        a +
        l.cantidad *
          (s.items.find((i) => i.id === l.insumo_id)?.peso_unitario_kg || 0),
      0,
    ),
    registeredM3 = scheduled.reduce(
      (a, l) =>
        a +
        l.cantidad *
          (s.items.find((i) => i.id === l.insumo_id)?.volumen_unitario_m3 || 0),
      0,
    );
  const load = p.loadKg || registeredKg,
    volume = p.loadM3 || registeredM3,
    requiresAccredited = points.some((x) => x.requiere_personal_acreditado),
    contracts = points.every(
      (x) =>
        !["service", "client", "sale"].includes(clientFor(s, x.id).kind) ||
        x.contrato_validado,
    ),
    modes: ("own" | "external")[] =
      p.mode === "both" ? ["own", "external"] : [p.mode];
  const departure = new Date(p.departure + "-05:00").getTime(),
    perms = permute(points);
  const result: LogisticsScenario[] = [];
  for (const mode of modes) {
    const candidates = perms.map((order) => {
      let last: Location = wh,
        prev = 0,
        km = 0,
        driving = 0,
        waiting = 0,
        elapsed = mode === "external" ? p.externalMinutes : 0,
        returnKm = 0;
      for (const dest of order) {
        const index = indexes.get(dest.id)!;
        const d = matrix
          ? matrix.distances[prev][index] / 1000
          : distance(last, dest) * s.settings.roadFactor;
        const minutes = matrix
          ? matrix.durations[prev][index] / 60
          : (d / p.speed) * 60;
        km += d;
        driving += minutes;
        elapsed += minutes;
        waiting += elapsed * (dest.urgente ? 4 : 1);
        elapsed += p.serviceMinutes;
        last = dest;
        prev = index;
      }
      if (p.returnToWarehouse) {
        returnKm = matrix
          ? matrix.distances[prev][0] / 1000
          : distance(last, wh) * s.settings.roadFactor;
        const minutes = matrix
          ? matrix.durations[prev][0] / 60
          : (returnKm / p.speed) * 60;
        km += returnKm;
        driving += minutes;
        elapsed += minutes;
      }
      elapsed += p.breakMinutes;
      const fuel = mode === "own" ? (km / p.kmPerGallon) * p.vehicles : null,
        personCost =
          (p.driverCost + (p.driverHourly * elapsed) / 60) *
          p.driversPerVehicle *
          p.vehicles;
      const components =
        mode === "own"
          ? [
              { label: "Combustible", value: fuel! * p.fuelPrice },
              { label: "Conductores", value: personCost },
              { label: "Alimentación", value: p.food },
              { label: "Peajes", value: p.tolls },
              { label: "Otros costos de viaje", value: p.other },
              {
                label: "Mantenimiento por km",
                value: km * p.maintenanceKm * p.vehicles,
              },
              {
                label: "Fijos asignados al viaje",
                value: (p.fixedMonthly * p.vehicles) / p.tripsMonthly,
              },
              {
                label: "Mercadería en tránsito · prima asignada",
                value: p.insuranceTrip,
              },
            ]
          : [
              {
                label:
                  p.externalRateMode === "fixed"
                    ? "Tarifa fija por viaje"
                    : "Tarifa base cotizada",
                value: p.externalFee,
              },
              { label: "Tarifa por km", value: km * p.externalKm },
              {
                label: "Tarifa por parada",
                value: points.length * p.externalStop,
              },
              { label: "Recargos del operador", value: p.externalExtras },
            ];
      const cost = components.reduce((a, c) => a + c.value, 0),
        risk =
          mode === "own"
            ? p.roadRisk +
              p.weatherRisk +
              p.nightRisk +
              p.cargoRisk +
              p.experienceRisk +
              (p.technicalValid ? 0 : 5) +
              (p.speed > 90 ? 3 : p.speed > 80 ? 1 : 0)
            : p.externalRisk,
        kgCapacity =
          mode === "own" ? p.capacityKg * p.vehicles : p.externalCapacityKg,
        m3Capacity =
          mode === "own" ? p.capacityM3 * p.vehicles : p.externalCapacityM3;
      const warnings: string[] = [];
      if (load > kgCapacity)
        warnings.push("La carga supera la capacidad de peso.");
      if (volume > m3Capacity)
        warnings.push("La carga supera la capacidad volumétrica.");
      if (
        requiresAccredited &&
        !(mode === "own" ? p.accredited : p.externalAccredited)
      )
        warnings.push("Falta personal acreditado para un destino.");
      if (!contracts) warnings.push("Hay destinos sin contrato validado.");
      if (!(mode === "own" ? p.technicalValid : p.externalTechnical))
        warnings.push("Revisión técnica no vigente.");
      if (!(mode === "own" ? p.insuranceValid : p.externalInsurance))
        warnings.push("Cobertura de seguro no confirmada.");
      if (!(mode === "own" ? p.maintenanceValid : p.externalMaintenance))
        warnings.push("Mantenimiento previo pendiente.");
      if (
        p.cargoRisk > 0 &&
        !(mode === "own" ? p.cargoAllowed : p.externalCargo)
      )
        warnings.push(
          "El operador no está habilitado para la carga química seleccionada.",
        );
      const net =
          p.serviceRevenue > 0
            ? p.serviceRevenue - p.otherServiceCosts - cost
            : null,
        margin = net === null ? null : (net / p.serviceRevenue) * 100;
      return {
        id: `${mode}-${p.priority}`,
        nombre:
          mode === "own"
            ? "Flota propia"
            : p.externalName || "Servicio externo",
        description:
          mode === "own"
            ? "Vehículos y personal de tu empresa."
            : "Tarifas y condiciones cotizadas por el operador.",
        mode,
        operator: mode === "own" ? p.vehicleType : p.externalName,
        order: order.map((d) => d.id),
        distance: km,
        minutes: elapsed,
        drivingMinutes: driving,
        cost,
        risk: waiting,
        waiting,
        load,
        volume,
        feasible: warnings.length === 0,
        score: 0,
        savings: 0,
        costKm: km > 0 ? cost / km : null,
        costDelivery: cost / points.length,
        costTon: load > 0 ? cost / (load / 1000) : null,
        costKg: load > 0 ? cost / load : null,
        fuelGallons: fuel,
        co2: fuel === null ? null : fuel * p.co2Factor,
        netContribution: net,
        margin,
        minimumServiceRevenue:
          (cost + p.otherServiceCosts) / (1 - p.targetMargin / 100),
        utilizationKg: (load / kgCapacity) * 100,
        utilizationM3: (volume / m3Capacity) * 100,
        emptyKm: p.returnLoaded ? 0 : returnKm,
        emptyPercent: km > 0 ? ((p.returnLoaded ? 0 : returnKm) / km) * 100 : 0,
        roadRisk: risk,
        riskLabel:
          risk <= 10
            ? "Bajo"
            : risk <= 20
              ? "Moderado"
              : risk <= 30
                ? "Alto"
                : "Muy alto",
        warnings,
        onTime: elapsed <= p.deadlineMinutes,
        arrival: new Date(departure + elapsed * 60000).toISOString(),
        components,
        dataSource: matrix
          ? "Red vial OpenStreetMap / OSRM"
          : "Aproximación geográfica",
        externalOTD: mode === "external" ? p.externalOTD : null,
        inputs: p,
        warehouse: { ...wh },
        matrix,
        recommendation: "",
        rank: 0,
      } satisfies LogisticsScenario;
    });
    const maxCost = Math.max(1, ...candidates.map((c) => c.cost)),
      maxWait = Math.max(1, ...candidates.map((c) => c.waiting));
    const objective = (c: LogisticsScenario) =>
      p.priority === "cost"
        ? c.cost / maxCost
        : p.priority === "time"
          ? c.waiting / maxWait
          : p.priority === "risk"
            ? c.roadRisk / 35 + (c.cost / maxCost) * 0.05
            : (0.55 * c.cost) / maxCost +
              (0.3 * c.waiting) / maxWait +
              (0.15 * c.roadRisk) / 35;
    const onTimeCandidates = candidates.filter((c) => c.feasible && c.onTime),
      pool = onTimeCandidates.length ? onTimeCandidates : candidates;
    const best = pool.reduce((a, b) =>
      Math.abs(objective(a) - objective(b)) < 1e-9
        ? a.waiting <= b.waiting
          ? a
          : b
        : objective(a) < objective(b)
          ? a
          : b,
    );
    best.savings = Math.max(0, candidates[0].cost - best.cost);
    result.push(best);
  }
  const maxCost = Math.max(1, ...result.map((c) => c.cost)),
    maxMinutes = Math.max(1, ...result.map((c) => c.minutes)),
    maxWait = Math.max(1, ...result.map((c) => c.waiting));
  const score = (c: LogisticsScenario) =>
    p.priority === "cost"
      ? c.cost / maxCost
      : p.priority === "time"
        ? c.waiting / maxWait
        : p.priority === "risk"
          ? c.roadRisk / 35 + (0.05 * c.cost) / maxCost
          : (0.55 * c.cost) / maxCost +
            (0.3 * c.minutes) / maxMinutes +
            (0.15 * c.roadRisk) / 35;
  result.sort(
    (a, b) =>
      Number(b.feasible) - Number(a.feasible) ||
      Number(b.onTime) - Number(a.onTime) ||
      score(a) - score(b),
  );
  result.forEach((c, i) => {
    c.rank = i + 1;
    c.score = Math.max(
      0,
      Math.min(100, Math.round((1 - score(c) / 1.05) * 100)),
    );
    c.recommendation = !c.feasible
      ? "No elegible: " + c.warnings.join(" ")
      : !c.onTime
        ? "El tiempo total supera el plazo indicado. Ajusta el plan antes de elegir."
        : i === 0
          ? `Mejor alternativa factible para la prioridad ${p.priority === "cost" ? "costo" : p.priority === "time" ? "tiempo de atención" : p.priority === "risk" ? "riesgo" : "equilibrada"}.`
          : "Alternativa factible para comparar con la recomendada.";
  });
  return result;
}
