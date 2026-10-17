import type { Snapshot, Origin, Coords } from "./models.ts";
import { validCoords } from "./format.ts";
export type PlanningInputs = {
  priority: "cost" | "time" | "balanced";
  roundTrip: boolean;
  ownEnabled: boolean;
  externalEnabled: boolean;
  externalMode: "km" | "fixed";
  externalRate: number;
  externalExtras: number;
  externalTollsIncluded: boolean;
  fuelPrice: number;
  kmPerGallon: number;
  driverHourly: number;
  fixedPerTrip: number;
  maintenanceKm: number;
  tolls: number;
  unloadingMinutes: number;
  breakMinutes: number;
  fallbackSpeed: number;
  roadFactor: number;
  materials: number;
  labor: number;
  otherService: number;
  margin: number;
  availableMinutes: number;
};
export type Matrix = {
  keys: string[];
  distances: number[][];
  durations: number[][];
  source: string;
  fetchedAt: string;
};
export type PlanScenario = {
  id: string;
  mode: "Propio" | "Externo";
  order: number[];
  distanceKm: number;
  drivingMinutes: number;
  totalMinutes: number;
  speed: number;
  transportCost: number;
  serviceCost: number;
  suggestedPrice: number;
  feasible: boolean;
  onTime: boolean;
  warnings: string[];
  components: { label: string; value: number }[];
};
export type PlanResult = {
  origin: Origin;
  dispatchIds: number[];
  destinationIds: number[];
  matrixSource: string;
  calculatedAt: string;
  inputs: PlanningInputs;
  loadKg: number;
  loadM3: number;
  merchandiseValue: number;
  scenarios: PlanScenario[];
  baselineKm: number;
};
export function coordKey(p: Coords) {
  return `${p.lng},${p.lat}`;
}
function km(a: Coords, b: Coords) {
  const rad = (n: number) => (n * Math.PI) / 180,
    x =
      Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
      Math.cos(rad(a.lat)) *
        Math.cos(rad(b.lat)) *
        Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function perms<T>(xs: T[]): T[][] {
  return xs.length < 2
    ? [xs]
    : xs.flatMap((x, i) =>
        perms(xs.filter((_, j) => i !== j)).map((p) => [x, ...p]),
      );
}
export function validateMatrix(matrix: Matrix, coords: Coords[]) {
  const n = coords.length;
  if (
    matrix.keys.join("|") !== coords.map(coordKey).join("|") ||
    matrix.distances.length !== n ||
    matrix.durations.length !== n ||
    [matrix.distances, matrix.durations].some((g) =>
      g.some(
        (r) =>
          r.length !== n ||
          r.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0),
      ),
    )
  )
    throw Error(
      "La matriz vial no corresponde al origen y los destinos seleccionados.",
    );
}
export function calculatePlan(
  s: Snapshot,
  origin: Origin,
  ids: number[],
  dispatchIds: number[],
  input: PlanningInputs,
  matrix?: Matrix,
  routeId?: number,
): PlanResult {
  if (!validCoords(origin.lat, origin.lng))
    throw Error("Selecciona un origen válido.");
  if (!ids.length || ids.length > 7 || new Set(ids).size !== ids.length)
    throw Error("Selecciona entre uno y siete destinos sin repetir.");
  if (input.ownEnabled && input.fuelPrice <= 0)
    throw Error(
      "Ingresa el precio de combustible para comparar transporte propio.",
    );
  if (input.externalEnabled && input.externalRate <= 0)
    throw Error("Ingresa una tarifa externa mayor que cero.");
  if (!input.ownEnabled && !input.externalEnabled)
    throw Error("Activa al menos una modalidad de transporte.");
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0))
      throw Error(`Revisa el parámetro ${key}.`);
  }
  if (
    input.kmPerGallon <= 0 ||
    input.fallbackSpeed <= 0 ||
    input.roadFactor < 1 ||
    input.margin >= 100 ||
    input.availableMinutes <= 0
  )
    throw Error(
      "Revisa rendimiento, velocidad, factor vial, margen y plazo disponible.",
    );
  const points = ids.map((id) => s.points?.find((p) => p.id === id));
  if (points.some((p) => !p || !validCoords(p.latitud, p.longitud)))
    throw Error("Todos los destinos deben tener coordenadas válidas.");
  const coords: Coords[] = [
    origin,
    ...points.map((p) => ({ lat: p!.latitud!, lng: p!.longitud! })),
  ];
  if (matrix) validateMatrix(matrix, coords);
  if (new Set(dispatchIds).size !== dispatchIds.length)
    throw Error("Hay despachos duplicados.");
  const dispatches = dispatchIds.map((id) =>
    s.dispatches?.find((d) => d.id === id),
  );
  if (dispatches.some((d) => !d || !ids.includes(d.punto_servicio_id)))
    throw Error(
      "Cada despacho seleccionado debe corresponder a uno de los destinos.",
    );
  if (dispatches.some((d) => !!d!.fecha_entrega_real))
    throw Error(
      "La carga de planificación usa únicamente despachos pendientes.",
    );
  let loadKg = 0,
    loadM3 = 0,
    merchandiseValue = 0;
  const warnings: string[] = [];
  if (!dispatchIds.length)
    warnings.push(
      "No se seleccionaron despachos: no hay carga de insumos ni su costo en el presupuesto.",
    );
  for (const d of dispatches)
    for (const line of d!.detalles || []) {
      const item = s.items?.find((i) => i.id === line.insumo_id);
      if (!item)
        throw Error(
          `No se pudo consultar el insumo #${line.insumo_id} para calcular carga.`,
        );
      loadKg += line.cantidad_solicitada * item.peso_unitario_kg;
      loadM3 += line.cantidad_solicitada * item.volumen_unitario_m3;
      merchandiseValue += line.cantidad_solicitada * item.precio_unitario;
      if (item.peso_unitario_kg <= 0 || item.volumen_unitario_m3 <= 0)
        warnings.push(
          `${item.nombre}: peso o volumen no configurado; la ocupación puede estar subestimada.`,
        );
    }
  if (!matrix)
    warnings.push(
      "Sin red vial: distancias geográficas por factor y tiempos aproximados con velocidad de referencia.",
    );
  const route = s.routes?.find((r) => r.id === routeId),
    driver = s.staff?.find((p) => p.id === route?.conductor_id);
  let feasible = true;
  if (route) {
    if (route.capacidad_volumen_max_m3 <= 0)
      warnings.push(
        "Capacidad volumétrica no configurada: ocupación por volumen no verificada.",
      );
    if (route.capacidad_peso_max_kg <= 0)
      warnings.push(
        "Capacidad de peso no configurada: ocupación por peso no verificada.",
      );
    if (
      route.capacidad_peso_max_kg > 0 &&
      loadKg > route.capacidad_peso_max_kg
    ) {
      warnings.push("La carga supera la capacidad de peso de la ruta.");
      feasible = false;
    }
    if (
      route.capacidad_volumen_max_m3 > 0 &&
      loadM3 > route.capacidad_volumen_max_m3
    ) {
      warnings.push("La carga supera la capacidad volumétrica de la ruta.");
      feasible = false;
    }
    if (!driver || !driver.disponible) {
      warnings.push(
        "El conductor de la ruta no está disponible o no está registrado.",
      );
      feasible = false;
    }
    if (
      points.some((p) => p!.requiere_personal_acreditado) &&
      !driver?.acreditado
    ) {
      warnings.push(
        "Hay destinos que requieren personal acreditado y el conductor no cumple esa condición en el registro.",
      );
      feasible = false;
    }
  } else
    warnings.push(
      "Sin ruta seleccionada: capacidad y responsable no verificados.",
    );
  if (points.some((p) => !p!.contrato_validado)) {
    warnings.push("Hay puntos con contrato no validado.");
    feasible = false;
  }
  const segment = (a: number, b: number) =>
    matrix
      ? {
          km: matrix.distances[a][b] / 1000,
          minutes: matrix.durations[a][b] / 60,
        }
      : {
          km: km(coords[a], coords[b]) * input.roadFactor,
          minutes:
            ((km(coords[a], coords[b]) * input.roadFactor) /
              input.fallbackSpeed) *
            60,
        };
  const path = (order: number[]) => {
    const chain = [0, ...order, ...(input.roundTrip ? [0] : [])];
    let distance = 0,
      minutes = 0;
    for (let i = 1; i < chain.length; i++) {
      const seg = segment(chain[i - 1], chain[i]);
      distance += seg.km;
      minutes += seg.minutes;
    }
    return { distance, minutes };
  };
  const candidates = perms(ids.map((_, i) => i + 1)).map((order) => ({
    ...path(order),
    order,
  }));
  const baselineKm = path(ids.map((_, i) => i + 1)).distance,
    scenarios: PlanScenario[] = [];
  for (const mode of ["Propio", "Externo"] as const) {
    if (
      (mode === "Propio" && !input.ownEnabled) ||
      (mode === "Externo" && !input.externalEnabled)
    )
      continue;
    const options = candidates.map((c) => {
      const total =
        c.minutes + ids.length * input.unloadingMinutes + input.breakMinutes;
      const components =
        mode === "Propio"
          ? [
              {
                label: "Combustible",
                value: (c.distance / input.kmPerGallon) * input.fuelPrice,
              },
              {
                label: "Conductor por tiempo total",
                value: (total / 60) * input.driverHourly,
              },
              {
                label: "Fijo asignado a este viaje",
                value: input.fixedPerTrip,
              },
              {
                label: "Reserva de mantenimiento",
                value: c.distance * input.maintenanceKm,
              },
              { label: "Peajes cotizados", value: input.tolls },
            ]
          : [
              {
                label:
                  input.externalMode === "km"
                    ? "Tarifa por km"
                    : "Tarifa fija por viaje",
                value:
                  input.externalMode === "km"
                    ? c.distance * input.externalRate
                    : input.externalRate,
              },
              { label: "Recargos del proveedor", value: input.externalExtras },
              {
                label: "Peajes adicionales",
                value: input.externalTollsIncluded ? 0 : input.tolls,
              },
            ];
      const transportCost = components.reduce((sum, v) => sum + v.value, 0),
        serviceCost =
          transportCost +
          merchandiseValue +
          input.materials +
          input.labor +
          input.otherService;
      return {
        id: mode === "Propio" ? "own" : "external",
        mode,
        order: c.order.map((i) => ids[i - 1]),
        distanceKm: c.distance,
        drivingMinutes: c.minutes,
        totalMinutes: total,
        speed: c.minutes ? (c.distance / c.minutes) * 60 : 0,
        transportCost,
        serviceCost,
        suggestedPrice: serviceCost / (1 - input.margin / 100),
        feasible,
        onTime: total <= input.availableMinutes,
        warnings: [...new Set(warnings)],
        components,
      };
    });
    const maxCost = Math.max(...options.map((o) => o.transportCost), 1),
      maxTime = Math.max(...options.map((o) => o.totalMinutes), 1);
    const score = (o: PlanScenario) =>
      input.priority === "cost"
        ? o.transportCost
        : input.priority === "time"
          ? o.totalMinutes
          : (0.6 * o.transportCost) / maxCost +
            (0.4 * o.totalMinutes) / maxTime;
    options.sort(
      (a, b) => Number(b.onTime) - Number(a.onTime) || score(a) - score(b),
    );
    scenarios.push(options[0]);
  }
  const costMax = Math.max(...scenarios.map((x) => x.transportCost), 1),
    timeMax = Math.max(...scenarios.map((x) => x.totalMinutes), 1);
  const score = (o: PlanScenario) =>
    input.priority === "cost"
      ? o.transportCost
      : input.priority === "time"
        ? o.totalMinutes
        : (0.6 * o.transportCost) / costMax + (0.4 * o.totalMinutes) / timeMax;
  scenarios.sort(
    (a, b) =>
      Number(b.feasible && b.onTime) - Number(a.feasible && a.onTime) ||
      score(a) - score(b),
  );
  return {
    origin,
    dispatchIds,
    destinationIds: ids,
    matrixSource: matrix?.source || "Aproximación geográfica",
    calculatedAt: new Date().toISOString(),
    inputs: input,
    loadKg,
    loadM3,
    merchandiseValue,
    scenarios,
    baselineKm,
  };
}
