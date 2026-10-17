import {
  LOCATION_TYPES,
  validLocationKind,
  locationLabel,
  normalizeLocation,
  registeredLocation,
} from "./locations.ts";
import type { LocationKind } from "./locations.ts";
import type { State, Point, Item } from "./model.ts";
import type { Plan, RoadMatrix } from "./logistics.ts";

export type Contact = {
  name: string;
  role: string;
  phone: string;
  email: string;
  hours: string;
};
export type Client = {
  kind: LocationKind;
  segment: string;
  frequency: number;
  nextService: string;
  contact: Contact;
};
export type Vehicle = {
  id: string;
  plate: string;
  name: string;
  type: string;
  ownership: "Propio" | "Externo";
  supplierId: string;
  active: boolean;
  capacityKg: number;
  capacityM3: number;
  kmPerGallon: number;
  odometer: number;
  technicalUntil: string;
  insuranceUntil: string;
  policy: string;
  cargoInsuranceUntil: string;
  cargoPremiumMonthly: number;
  chemicalAllowed: boolean;
  maintenanceDate: string;
  maintenanceKm: number;
  maintenanceReserveKm: number;
  fixedMonthly: number;
  driverId: string;
  notes: string;
};
export type Staff = {
  id: string;
  name: string;
  role: string;
  phone: string;
  accreditedUntil: string;
  available: boolean;
  hourly: number;
  experienceYears?: number;
};
export type Trip = {
  id: string;
  vehicleId: string;
  date: string;
  km: number;
  minutes: number;
  tolls: number;
  routeId?: string;
};
export type FleetCost = {
  id: string;
  vehicleId: string;
  date: string;
  category: string;
  amount: number;
  detail: string;
  nextDate?: string;
  nextKm?: number;
};
export type DemandRow = {
  clientId: string;
  itemId: string;
  week: string;
  quantity: number;
  visits: number;
  area: number;
  source: "synthetic" | "real";
};
export type Toll = {
  id: string;
  zone: string;
  vehicleType: string;
  fee: number;
  source: string;
  confirmedAt: string;
  synthetic: boolean;
};
export type Balance = {
  itemId: string;
  locationId: string;
  quantity: number;
  expiry: string;
};
export type Enterprise = {
  version: 1;
  contacts: Record<string, Client>;
  vehicles: Vehicle[];
  staff: Staff[];
  trips: Trip[];
  costs: FleetCost[];
  demand: DemandRow[];
  tolls: Toll[];
  balances: Balance[];
  finance: {
    inventoryBudget: number;
    minCoverageDays: number;
    maxCoverageDays: number;
    targetMargin: number;
    monthlyServiceCosts: number;
    inventoryAccount: string;
    consumptionAccount: string;
    fleetAccount: string;
  };
  profile: {
    name: string;
    email: string;
    position: string;
    locale: string;
    timezone: string;
    digest: boolean;
  };
};
export type OperationalPlan = Partial<Plan> & {
  registered?: boolean;
  vehicleId?: string;
  externalVehicleId?: string;
  laborHours?: number;
  laborRate?: number;
  extraServiceCosts?: number;
  externalQuotedExtras?: number;
  finishBy?: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const date = (days: number) =>
  new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const id = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const num = (v: unknown, min = 0, max = 1e9) => {
  const n = Number(v);
  if (
    v === "" ||
    v === null ||
    v === undefined ||
    !Number.isFinite(n) ||
    n < min ||
    n > max
  )
    throw Error("Revisa los valores numéricos y sus límites.");
  return n;
};
const text = (v: unknown, required = true, max = 250) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw Error("Completa los campos obligatorios.");
  return v.trim();
};
const validDate = (v: unknown, optional = false) => {
  if (optional && !v) return "";
  const x = text(v);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
    !Number.isFinite(new Date(x).getTime()) ||
    new Date(x).toISOString().slice(0, 10) !== x
  )
    throw Error("Revisa la fecha.");
  return x;
};
const emptyContact = (): Contact => ({
  name: "",
  role: "",
  phone: "",
  email: "",
  hours: "",
});
export function clientFor(s: State, pointId: string): Client {
  return (
    s.enterprise?.contacts[pointId] || {
      kind: pointId === "warehouse" ? "warehouse" : "service",
      segment: "General",
      frequency: 1,
      nextService: "",
      contact: emptyContact(),
    }
  );
}
export const kindLabel = locationLabel;
export function upgradeEnterprise(s: State): State {
  if (s.enterprise) return s;
  const e: Enterprise = {
    version: 1,
    contacts: {},
    vehicles: [],
    staff: [],
    trips: [],
    costs: [],
    demand: [],
    tolls: [],
    balances: s.items.map((i) => ({
      itemId: i.id,
      locationId: "warehouse",
      quantity: i.stock_actual,
      expiry: i.vencimiento || "",
    })),
    finance: {
      inventoryBudget: 0,
      minCoverageDays: 0,
      maxCoverageDays: 0,
      targetMargin: 20,
      monthlyServiceCosts: 0,
      inventoryAccount: "Inventarios · insumos de limpieza",
      consumptionAccount: "Costo de servicios · insumos consumidos",
      fleetAccount: "Gasto de transporte",
    },
    profile: {
      name: "",
      email: "",
      position: "Gerencia",
      locale: "es-EC",
      timezone: "America/Guayaquil",
      digest: true,
    },
  };
  s.enterprise = e;
  e.contacts.warehouse = {
    kind: "warehouse",
    segment: "Operación",
    frequency: 0,
    nextService: "",
    contact: emptyContact(),
  };
  s.points.forEach(
    (p, i) =>
      (e.contacts[p.id] = {
        kind: "service",
        segment:
          i === 0 || i === 4 ? "Salud" : i === 2 ? "Comercial" : "Oficinas",
        frequency: i === 0 ? 5 : 2,
        nextService: "",
        contact: emptyContact(),
      }),
  );
  if (!s.company.demo) return s;
  e.finance = {
    ...e.finance,
    inventoryBudget: 15000,
    minCoverageDays: 7,
    maxCoverageDays: 45,
    monthlyServiceCosts: 2400,
  };
  e.profile.name = "Equipo de operaciones";
  e.contacts.warehouse.contact = {
    name: "Coordinación de bodega · demo",
    role: "Despacho",
    phone: "",
    email: "bodega@example.com",
    hours: "Lun–vie 07:00–17:00",
  };
  s.points.forEach((p, i) => {
    e.contacts[p.id].contact = {
      name: `Coordinación ${i + 1} · demo`,
      role: "Administrador del sitio",
      phone: "",
      email: `punto${i + 1}@example.com`,
      hours: "Lun–vie 08:00–17:00",
    };
    e.contacts[p.id].nextService = date(i + 1);
  });
  for (const [suffix, name, lat, lon, kind] of [
    ["007", "Hotel Mirador · oportunidad", -0.158, -78.505, "prospect"],
    ["008", "Centro de distribución · punto de venta", -0.238, -78.512, "sale"],
  ] as const) {
    if (!s.points.some((p) => p.id === `PS-${suffix}`)) {
      s.points.push({
        id: `PS-${suffix}`,
        nombre_cliente: name,
        direccion: "Quito · ubicación de demostración",
        zona_reparto: "Quito",
        latitud: lat,
        longitud: lon,
        metros_cuadrados_atendidos: 1800,
        urgente: false,
        contrato_validado: kind !== "prospect",
        requiere_personal_acreditado: false,
      });
      e.contacts[`PS-${suffix}`] = {
        kind,
        segment: "Comercial",
        frequency: kind === "prospect" ? 0 : 3,
        nextService: date(5),
        contact: {
          ...emptyContact(),
          name: "Contacto comercial · demo",
          email: "contacto@example.com",
        },
      };
    }
  }
  e.staff = [
    {
      id: "PER-001",
      name: "Carlos Andrade · demo",
      role: "Conductor",
      phone: "",
      accreditedUntil: date(120),
      available: true,
      hourly: 5,
      experienceYears: 5,
    },
    {
      id: "PER-002",
      name: "María Torres · demo",
      role: "Conductora",
      phone: "",
      accreditedUntil: date(90),
      available: true,
      hourly: 5.5,
      experienceYears: 3,
    },
    {
      id: "PER-003",
      name: "Luis Pérez · demo",
      role: "Despachador",
      phone: "",
      accreditedUntil: date(180),
      available: true,
      hourly: 4.5,
      experienceYears: 2,
    },
  ];
  const v = (n: number, plate: string, type: string): Vehicle => ({
    id: `VH-00${n}`,
    plate,
    name:
      n === 1
        ? "Reparto Norte"
        : n === 2
          ? "Reparto Centro"
          : "Operador de apoyo · demo",
    type,
    ownership: n === 3 ? "Externo" : "Propio",
    supplierId: n === 3 ? "PR-004" : "",
    active: true,
    capacityKg: n === 1 ? 1200 : 1500,
    capacityM3: 8,
    kmPerGallon: 28,
    odometer: 48000,
    technicalUntil: date(120),
    insuranceUntil: date(210),
    policy: "Póliza registrada de demostración",
    cargoInsuranceUntil: date(150),
    cargoPremiumMonthly: 40,
    chemicalAllowed: true,
    maintenanceDate: date(25),
    maintenanceKm: 50000,
    maintenanceReserveKm: 0.12,
    fixedMonthly: n === 1 ? 180 : 220,
    driverId: n === 2 ? "PER-002" : "PER-001",
    notes:
      "Registro sintético para el concurso. Sustituir documentos y valores antes de operar.",
  });
  e.vehicles = [
    v(1, "PBA-2048", "Furgoneta"),
    v(2, "PBC-3192", "Camión liviano"),
    v(3, "DEMO-EXT", "Camión liviano"),
  ];
  for (let k = 1; k <= 24; k++)
    e.trips.push({
      id: `VIA-DEMO-${k}`,
      vehicleId: k % 2 ? "VH-001" : "VH-002",
      date: date(-k),
      km: 42 + (k % 7) * 3,
      minutes: 95 + (k % 5) * 8,
      tolls: k % 3 === 0 ? 2 : 0,
    });
  e.costs = [
    {
      id: "CF-DEMO-1",
      vehicleId: "VH-001",
      date: date(-10),
      category: "Mantenimiento",
      amount: 145,
      detail: "Cambio de aceite · demo",
    },
    {
      id: "CF-DEMO-2",
      vehicleId: "VH-002",
      date: date(-6),
      category: "Combustible",
      amount: 48,
      detail: "Abastecimiento · demo",
    },
  ];
  // Weekly, client-specific history. Every row is explicitly synthetic.
  for (const [c, p] of s.points.entries()) {
    if (clientFor(s, p.id).kind === "prospect") continue;
    for (const [j, item] of s.items.entries()) {
      for (let k = 0; k < 24; k++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * (24 - k));
        const visits = clientFor(s, p.id).frequency;
        const base =
          (item.monthly / 4 / Math.max(1, s.points.length - 1)) *
          (p.metros_cuadrados_atendidos / 3200);
        const quantity = Math.max(
          0,
          Math.round(
            (base * (1 + k * 0.009) * (1 + [0.12, -0.05, 0.03, -0.1][k % 4]) +
              ((c + j + k) % 3) * 0.3) *
              10,
          ) / 10,
        );
        e.demand.push({
          clientId: p.id,
          itemId: item.id,
          week: d.toISOString().slice(0, 10),
          quantity,
          visits,
          area: p.metros_cuadrados_atendidos,
          source: "synthetic",
        });
      }
    }
  }
  e.tolls = [
    {
      id: "PEA-DEMO",
      zone: "Valle",
      vehicleType: "*",
      fee: 1,
      source:
        "Tarifa sintética de demostración; reemplazar por tarifa del operador",
      confirmedAt: today(),
      synthetic: true,
    },
  ];
  return s;
}
export function reconcileBalances(s: State) {
  const e = s.enterprise!;
  for (const item of s.items) {
    let central = e.balances.find(
      (b) => b.itemId === item.id && b.locationId === "warehouse",
    );
    if (!central) {
      central = {
        itemId: item.id,
        locationId: "warehouse",
        quantity: 0,
        expiry: item.vencimiento,
      };
      e.balances.push(central);
    }
    const all = e.balances
      .filter((b) => b.itemId === item.id)
      .reduce((a, b) => a + b.quantity, 0);
    central.quantity += item.stock_actual - all;
    if (central.quantity < -0.00001)
      throw Error(
        `No hay existencias suficientes en bodega central para ${item.nombre}.`,
      );
    central.quantity = Math.max(0, central.quantity);
    central.expiry = item.vencimiento || "";
  }
}
export function consumptionSeries(s: State, item: Item) {
  const weeks = new Map<string, number>();
  for (const r of s.enterprise?.demand || [])
    if (r.itemId === item.id)
      weeks.set(r.week, (weeks.get(r.week) || 0) + r.quantity);
  return weeks.size >= 4
    ? [...weeks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, n]) => n)
    : item.history;
}
export function inventoryHealth(s: State, item: Item) {
  const history = consumptionSeries(s, item),
    mean = history.length
      ? history.slice(-4).reduce((a, b) => a + b, 0) /
        Math.min(4, history.length)
      : 0,
    days = mean > 0 ? (item.stock_actual / mean) * 7 : null,
    committed = s.dispatches
      .filter((d) => ["Programada", "En tránsito"].includes(d.estado))
      .flatMap((d) => d.lines)
      .filter((l) => l.insumo_id === item.id)
      .reduce((a, l) => a + l.cantidad, 0),
    pending = s.purchases
      .filter(
        (p) =>
          p.item === item.id && !["Rechazada", "Recibida"].includes(p.estado),
      )
      .reduce((a, p) => a + p.cantidad, 0),
    expiry = item.vencimiento
      ? Math.ceil((new Date(item.vencimiento).getTime() - Date.now()) / 864e5)
      : null,
    f = s.enterprise!.finance;
  const state =
    expiry !== null && item.stock_actual > 0 && expiry <= 30
      ? "Vencimiento"
      : item.stock_actual < Math.max(item.stock_minimo, committed)
        ? "Revisar"
        : days !== null && f.maxCoverageDays > 0 && days > f.maxCoverageDays
          ? "Exceso"
          : "Estable";
  const target = Math.max(
      item.stock_minimo,
      committed,
      (mean * (f.minCoverageDays || 7)) / 7,
    ),
    need = Math.max(
      0,
      Math.ceil((target - item.stock_actual - pending) * 100) / 100,
    );
  return {
    state,
    days,
    mean,
    committed,
    pending,
    expiry,
    need,
    target,
    rotation:
      item.opening + item.stock_actual > 0
        ? (history.length ? mean * 4 : item.monthly) /
          ((item.opening + item.stock_actual) / 2)
        : null,
  };
}
export function financialSummary(s: State) {
  const f = s.enterprise!.finance,
    value = s.items.reduce((a, i) => a + i.stock_actual * i.precio_unitario, 0),
    monthlyUsage = s.items.reduce((a, i) => {
      const ys = consumptionSeries(s, i);
      return (
        a +
        (ys.length ? ys.slice(-4).reduce((a, b) => a + b, 0) : i.monthly) *
          i.precio_unitario
      );
    }, 0),
    coverage = monthlyUsage > 0 ? (value / monthlyUsage) * 30 : null,
    active = s.routes.filter((r) => r.estado !== "Completada"),
    cost = active.reduce((a, r) => a + r.scenario.cost, 0),
    late = active.filter((r) => {
      const sc = r.scenario as any;
      return sc.onTime === false || !sc.feasible;
    }).length,
    configured = f.inventoryBudget > 0 && f.maxCoverageDays > 0;
  const month = today().slice(0, 7),
    monthCost = s.routes
      .filter((r) => r.date.startsWith(month))
      .reduce((a, r) => a + r.scenario.cost, 0),
    unchecked = active.filter(
      (r) => !(r.scenario as any).inputs?.registered,
    ).length;
  return {
    value,
    coverage,
    monthlyUsage,
    active,
    cost,
    late,
    monthCost,
    unchecked,
    inventoryStatus: !configured
      ? "Sin parámetros"
      : value > f.inventoryBudget
        ? "Sobre presupuesto"
        : coverage !== null && coverage > f.maxCoverageDays
          ? "Capital inmovilizado"
          : s.items.some((i) => i.stock_actual < i.stock_minimo)
            ? "Cobertura a revisar"
            : "Dentro del objetivo",
    routeStatus: !active.length
      ? "Sin rutas activas"
      : late
        ? "Revisar viabilidad"
        : unchecked
          ? "Validación pendiente"
          : !f.monthlyServiceCosts
            ? "Sin presupuesto"
            : monthCost > f.monthlyServiceCosts
              ? "Revisar costo"
              : "Dentro del presupuesto",
    budgetPercent:
      f.inventoryBudget > 0 ? (value / f.inventoryBudget) * 100 : null,
  };
}
export const vehicleTrips = (
  s: State,
  vehicleId: string,
  month = today().slice(0, 7),
) =>
  s.enterprise!.trips.filter(
    (t) => t.vehicleId === vehicleId && t.date.slice(0, 7) === month,
  );
export function vehicleChecks(s: State, v: Vehicle, departure = today()) {
  const driver = s.enterprise!.staff.find((d) => d.id === v.driverId);
  return {
    technical: v.technicalUntil >= departure,
    insurance: v.insuranceUntil >= departure && !!v.policy,
    maintenance: v.maintenanceDate >= departure && v.maintenanceKm > v.odometer,
    accredited: !!driver?.available && driver.accreditedUntil >= departure,
    cargo: v.chemicalAllowed,
    driver,
  };
}
export function deriveOperationalInputs(
  s: State,
  ids: string[],
  input: OperationalPlan,
  matrix?: RoadMatrix,
) {
  const e = s.enterprise!,
    v = e.vehicles.find(
      (v) => v.id === input.vehicleId && v.active && v.ownership === "Propio",
    ),
    ext = e.vehicles.find(
      (v) =>
        v.id === input.externalVehicleId &&
        v.active &&
        v.ownership === "Externo",
    );
  if (input.mode !== "external" && !v)
    throw Error("Selecciona un vehículo propio activo de la flota.");
  if (input.mode !== "own" && !ext)
    throw Error(
      "Registra o selecciona el vehículo del operador externo para verificar sus condiciones.",
    );
  const departure = input.departure || "",
    finish = input.finishBy || "",
    start = new Date(departure + "-05:00").getTime(),
    end = new Date(finish + "-05:00").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw Error("La hora límite debe ser posterior a la salida.");
  const on = departure.slice(0, 10),
    trips = v ? vehicleTrips(s, v.id, on.slice(0, 7)) : [],
    history = v
      ? e.trips.filter((t) => t.vehicleId === v.id && t.minutes > 0)
      : [],
    historicalSpeed = history.length
      ? (history.reduce((a, t) => a + t.km, 0) /
          history.reduce((a, t) => a + t.minutes, 0)) *
        60
      : s.settings.speed;
  const zones = [
      ...new Set(
        ids.map((id) => s.points.find((p) => p.id === id)?.zona_reparto),
      ),
    ],
    fees = zones.flatMap((zone) => {
      const matches = e.tolls
        .filter(
          (t) =>
            t.zone === zone &&
            (t.vehicleType === "*" || t.vehicleType === v?.type),
        )
        .sort(
          (a, b) =>
            Number(b.vehicleType === v?.type) -
              Number(a.vehicleType === v?.type) ||
            b.confirmedAt.localeCompare(a.confirmedAt),
        );
      return matches.slice(0, 1);
    }),
    externalFees = zones.flatMap((zone) =>
      e.tolls
        .filter(
          (t) =>
            t.zone === zone &&
            (t.vehicleType === "*" || t.vehicleType === ext?.type),
        )
        .sort(
          (a, b) =>
            Number(b.vehicleType === ext?.type) -
              Number(a.vehicleType === ext?.type) ||
            b.confirmedAt.localeCompare(a.confirmedAt),
        )
        .slice(0, 1),
    ),
    tolls =
      fees.reduce((a, t) => a + t.fee, 0) *
      (input.returnToWarehouse === false ? 1 : 2),
    externalTolls =
      externalFees.reduce((a, t) => a + t.fee, 0) *
      (input.returnToWarehouse === false ? 1 : 2);
  const lines = s.dispatches
      .filter((d) => ids.includes(d.point) && d.estado === "Programada")
      .flatMap((d) => d.lines),
    materials = lines.reduce(
      (a, l) =>
        a +
        l.cantidad *
          (s.items.find((i) => i.id === l.insumo_id)?.precio_unitario || 0),
      0,
    ),
    labor = num(input.laborHours ?? 0) * num(input.laborRate ?? 0),
    extra = num(input.extraServiceCosts ?? 0);
  const check = v ? vehicleChecks(s, v, on) : null,
    external = ext ? vehicleChecks(s, ext, on) : null,
    provider = s.suppliers.find((x) => x.id === ext?.supplierId),
    evaluations = provider?.evaluations || [],
    providerScore = evaluations.length
      ? evaluations.reduce(
          (a, r) =>
            a + (0.4 * r.puntualidad + 0.4 * r.calidad + 0.2 * r.costo) * 20,
          0,
        ) / evaluations.length
      : null;
  const rateMode = input.externalRateMode || "km";
  if (!["km", "fixed"].includes(rateMode))
    throw Error("Selecciona el tipo de tarifa externa.");
  const p: OperationalPlan = {
    ...input,
    externalRateMode: rateMode,
    registered: true,
    vehicles: 1,
    driversPerVehicle: 1,
    deadlineMinutes: (end - start) / 60000,
    speed: Math.max(1, Math.min(120, historicalSpeed)),
    loadKg: 0,
    loadM3: 0,
    externalQuotedExtras: num(
      input.externalQuotedExtras ?? input.externalExtras ?? 0,
    ),
    serviceRevenue: 0,
    otherServiceCosts: materials + labor + extra,
    targetMargin: e.finance.targetMargin,
    cargoRisk: lines.some(
      (l) => s.items.find((i) => i.id === l.insumo_id)?.categoria === "quimico",
    )
      ? 2
      : 0,
    tolls,
    externalFee: rateMode === "fixed" ? num(input.externalFee ?? 0) : 0,
    externalKm: rateMode === "km" ? num(input.externalKm ?? 0) : 0,
    externalStop: 0,
    externalRisk: providerScore === null ? 17.5 : (100 - providerScore) * 0.35,
    externalOTD: evaluations.length
      ? (evaluations.filter((r) => r.puntualidad >= 4).length /
          evaluations.length) *
        100
      : 0,
    experienceRisk:
      check?.driver?.experienceYears === undefined
        ? 3
        : check.driver.experienceYears >= 3
          ? 1
          : check.driver.experienceYears >= 1
            ? 2
            : 4,
    externalName: ext
      ? s.suppliers.find((p) => p.id === ext.supplierId)?.nombre || ext.name
      : "Operador externo",
  };
  if (v && check)
    Object.assign(p, {
      vehicleType: v.type,
      capacityKg: v.capacityKg,
      capacityM3: v.capacityM3,
      kmPerGallon: v.kmPerGallon,
      driverHourly: check.driver?.hourly || 0,
      driverCost: 0,
      maintenanceKm: v.maintenanceReserveKm,
      fixedMonthly: v.fixedMonthly,
      tripsMonthly: trips.length + 1,
      insuranceTrip: v.cargoPremiumMonthly / (trips.length + 1),
      accredited: check.accredited,
      technicalValid: check.technical,
      insuranceValid: check.insurance,
      maintenanceValid: check.maintenance,
      cargoAllowed: check.cargo,
      cargoRisk: lines.some(
        (l) =>
          s.items.find((i) => i.id === l.insumo_id)?.categoria === "quimico",
      )
        ? 2
        : 0,
    });
  if (ext && external)
    Object.assign(p, {
      externalCapacityKg: ext.capacityKg,
      externalCapacityM3: ext.capacityM3,
      externalAccredited: external.accredited,
      externalTechnical: external.technical,
      externalInsurance: external.insurance,
      externalMaintenance: external.maintenance,
      externalCargo: external.cargo,
      externalExtras:
        num(input.externalQuotedExtras ?? input.externalExtras ?? 0) +
        (input.externalTollsIncluded ? 0 : externalTolls),
    });
  return {
    inputs: p,
    derived: {
      vehicle: v,
      external: ext,
      checks: check,
      externalChecks: external,
      completedTrips: trips.length,
      allocationTrips: trips.length + 1,
      materials,
      labor,
      extra,
      tolls,
      externalTolls,
      tollSources: input.mode === "external" ? externalFees : fees,
      tollsConfirmed: fees.length > 0 && !fees.some((f) => f.synthetic),
      historicalSpeed,
      matrixAvailable: !!matrix,
      externalRiskUnknown: providerScore === null,
    },
  };
}
export function eligibleEvaluations(s: State, supplierId: string) {
  const done = new Set(
    s.suppliers
      .find((p) => p.id === supplierId)
      ?.evaluations.map((e) => e.referenceId)
      .filter(Boolean),
  );
  return s.purchases
    .filter(
      (p) =>
        p.supplier === supplierId &&
        ["Recibida", "Rechazada"].includes(p.estado) &&
        !done.has(p.id),
    )
    .map((p) => ({
      id: p.id,
      label: `${p.id} · ${s.items.find((i) => i.id === p.item)?.nombre || p.item} · ${p.estado}`,
      date: p.fecha,
    }))
    .concat(
      s.routes
        .filter(
          (r) =>
            r.estado === "Completada" &&
            (r.scenario as any).inputs?.externalVehicleId &&
            s.enterprise!.vehicles.find(
              (v) => v.id === (r.scenario as any).inputs.externalVehicleId,
            )?.supplierId === supplierId &&
            !done.has(r.id),
        )
        .map((r) => ({
          id: r.id,
          label: `${r.id} · Transporte completado · ${r.nombre}`,
          date: r.date,
        })),
    );
}
export function applyEnterpriseAction(
  s: State,
  action: string,
  p: any,
): boolean {
  const e = s.enterprise!,
    now = new Date().toISOString();
  if (action === "profile.update") {
    e.profile = {
      name: text(p.name),
      email: text(p.email, false),
      position: text(p.position),
      locale: ["es-EC", "es-419"].includes(p.locale) ? p.locale : "es-EC",
      timezone:
        p.timezone === "Pacific/Galapagos"
          ? "Pacific/Galapagos"
          : "America/Guayaquil",
      digest: !!p.digest,
    };
  } else if (action === "finance.update") {
    e.finance = {
      inventoryBudget: num(p.inventoryBudget),
      minCoverageDays: num(p.minCoverageDays, 0, 365),
      maxCoverageDays: num(p.maxCoverageDays, 0.1, 730),
      targetMargin: num(p.targetMargin, 0, 99),
      monthlyServiceCosts: num(p.monthlyServiceCosts),
      inventoryAccount: text(p.inventoryAccount),
      consumptionAccount: text(p.consumptionAccount),
      fleetAccount: text(p.fleetAccount),
    };
    if (e.finance.minCoverageDays > e.finance.maxCoverageDays)
      throw Error("La cobertura mínima debe ser menor que la máxima.");
  } else if (action === "vehicle.save") {
    const old = e.vehicles.find((v) => v.id === p.id),
      plate = text(p.plate).toUpperCase();
    if (e.vehicles.some((v) => v.id !== old?.id && v.plate === plate))
      throw Error("Esta placa ya está registrada.");
    const own = p.ownership === "Externo" ? "Externo" : "Propio";
    if (own === "Externo" && !s.suppliers.some((x) => x.id === p.supplierId))
      throw Error("Selecciona el proveedor del transporte externo.");
    if (!e.staff.some((d) => d.id === p.driverId))
      throw Error("Registra y selecciona al conductor.");
    const vehicle: Vehicle = {
      id: old?.id || id("VH"),
      plate,
      name: text(p.name),
      type: text(p.type),
      ownership: own,
      supplierId: own === "Externo" ? p.supplierId : "",
      active: !!p.active,
      capacityKg: num(p.capacityKg, 0.1),
      capacityM3: num(p.capacityM3, 0.01),
      kmPerGallon: num(p.kmPerGallon, 0.1),
      odometer: num(p.odometer),
      technicalUntil: validDate(p.technicalUntil, true),
      insuranceUntil: validDate(p.insuranceUntil, true),
      policy: text(p.policy || "", false),
      cargoInsuranceUntil: validDate(p.cargoInsuranceUntil, true),
      cargoPremiumMonthly: num(p.cargoPremiumMonthly),
      chemicalAllowed: !!p.chemicalAllowed,
      maintenanceDate: validDate(p.maintenanceDate, true),
      maintenanceKm: num(p.maintenanceKm),
      maintenanceReserveKm: num(p.maintenanceReserveKm),
      fixedMonthly: num(p.fixedMonthly),
      driverId: p.driverId,
      notes: text(p.notes || "", false, 1000),
    };
    if (old) Object.assign(old, vehicle);
    else e.vehicles.push(vehicle);
  } else if (action === "staff.save") {
    const old = e.staff.find((x) => x.id === p.id),
      d: Staff = {
        id: old?.id || id("PER"),
        name: text(p.name),
        role: text(p.role),
        phone: text(p.phone || "", false),
        accreditedUntil: validDate(p.accreditedUntil, true),
        available: !!p.available,
        hourly: num(p.hourly),
        experienceYears: num(p.experienceYears ?? 0, 0, 80),
      };
    if (old) Object.assign(old, d);
    else e.staff.push(d);
  } else if (action === "fleet.cost") {
    const vehicle = e.vehicles.find((v) => v.id === p.vehicleId);
    if (!vehicle) throw Error("Vehículo no encontrado.");
    if (validDate(p.date) > today())
      throw Error("Un gasto real no puede tener fecha futura.");
    const category = text(p.category),
      entry: FleetCost = {
        id: id("CF"),
        vehicleId: vehicle.id,
        date: validDate(p.date),
        category,
        amount: num(p.amount),
        detail: text(p.detail),
        nextDate: validDate(p.nextDate, true),
        nextKm: p.nextKm ? num(p.nextKm) : undefined,
      };
    e.costs.unshift(entry);
    if (category === "Mantenimiento") {
      if (entry.nextDate) vehicle.maintenanceDate = entry.nextDate;
      if (entry.nextKm) vehicle.maintenanceKm = entry.nextKm;
    }
  } else if (action === "trip.create") {
    const v = e.vehicles.find((v) => v.id === p.vehicleId);
    if (!v) throw Error("Vehículo no encontrado.");
    const km = num(p.km, 0.01),
      day = validDate(p.date);
    if (day > today()) throw Error("Solo registra viajes ya realizados.");
    e.trips.unshift({
      id: id("VIA"),
      vehicleId: v.id,
      date: day,
      km,
      minutes: num(p.minutes, 1),
      tolls: num(p.tolls),
    });
  } else if (action === "toll.save") {
    e.tolls = e.tolls.filter(
      (t) => !(t.zone === p.zone && t.vehicleType === p.vehicleType),
    );
    e.tolls.push({
      id: id("PEA"),
      zone: text(p.zone),
      vehicleType: text(p.vehicleType),
      fee: num(p.fee),
      source: text(p.source),
      confirmedAt: validDate(p.confirmedAt),
      synthetic: false,
    });
  } else if (action === "location.contact") {
    if (p.kind !== undefined && !validLocationKind(p.kind))
      throw Error("Tipo de ubicación no válido.");
    if (p.id !== "warehouse" && !s.points.some((x) => x.id === p.id))
      throw Error("Ubicación no encontrada.");
    const old = clientFor(s, p.id),
      kind = validLocationKind(p.kind) ? p.kind : old.kind;
    e.contacts[p.id] = {
      kind,
      segment: text(p.segment || "General"),
      frequency: num(p.frequency, 0, 14),
      nextService: kind === "prospect" ? validDate(p.nextService, true) : "",
      contact: {
        name: text(p.contactName || "", false),
        role: text(p.contactRole || "", false),
        phone: text(p.phone || "", false),
        email: text(p.email || "", false),
        hours: text(p.hours || "", false),
      },
    };
  } else if (action === "supplier.details") {
    const provider = s.suppliers.find((x) => x.id === p.id);
    if (!provider) throw Error("Proveedor no encontrado.");
    if (p.ruc && !/^\d{13}$/.test(p.ruc))
      throw Error("El RUC debe contener 13 dígitos.");
    Object.assign(provider, {
      ruc: text(p.ruc || "", false),
      direccion: text(p.direccion || "", false),
      telefono: text(p.telefono || "", false),
      contacto: text(p.contacto || "", false),
      paymentTerms: text(p.paymentTerms || "", false),
    });
  } else if (action === "purchase.receive") {
    const po = s.purchases.find((x) => x.id === p.id);
    if (!po || po.estado !== "En camino")
      throw Error("Solo puedes recibir una compra en camino.");
    const qty = num(p.quantity, 0, po.cantidad);
    if (qty === 0) throw Error("La cantidad recibida debe ser mayor que cero.");
    const item = s.items.find((i) => i.id === po.item)!;
    const expiry = validDate(p.expiry, item.categoria !== "quimico");
    const unit = po.unitPrice ?? item.precio_unitario,
      oldValue = item.stock_actual * item.precio_unitario;
    item.precio_unitario = (oldValue + qty * unit) / (item.stock_actual + qty);
    item.stock_actual += qty;
    item.opening += qty;
    if (expiry && (!item.vencimiento || expiry < item.vencimiento))
      item.vencimiento = expiry;
    po.estado = "Recibida";
    po.receivedQuantity = qty;
    po.receiptDate = now;
    po.responsibility = {
      vehicle: text(p.vehicle || "", false),
      driver: text(p.driver || "", false),
      dispatcher: text(p.dispatcher || "", false),
      receiver: text(p.receiver),
      contact: text(p.contact || "", false),
    };
    s.movements.unshift({
      id: id("MOV"),
      item: item.id,
      cantidad: qty,
      tipo: "Ingreso",
      destinationId: "warehouse",
      destinationLocation: registeredLocation(s, "warehouse"),
      origen:
        s.suppliers.find((x) => x.id === po.supplier)?.nombre || "Proveedor",
      destino: s.warehouse!.nombre_cliente,
      fecha: now,
      referencia: po.id,
    });
  } else if (action === "dispatch.responsibility") {
    const d = s.dispatches.find((x) => x.id === p.id);
    if (!d) throw Error("Guía no encontrada.");
    d.responsibility = {
      vehicle: text(p.vehicle),
      driver: text(p.driver),
      dispatcher: text(p.dispatcher),
      receiver: text(p.receiver),
      contact: text(p.contact || "", false),
    };
  } else if (action === "movement.locations") {
    const m = s.movements.find((x) => x.id === p.id);
    if (!m) throw Error("Movimiento no encontrado.");
    m.originLocation = normalizeLocation(p.origin);
    m.destinationLocation = normalizeLocation(p.destination);
  } else if (action === "stock.transfer") {
    const item = s.items.find((i) => i.id === p.itemId);
    if (!item) throw Error("Insumo no encontrado.");
    if (
      p.from === p.to ||
      ![p.from, p.to].every(
        (v) => v === "warehouse" || s.points.some((x) => x.id === v),
      )
    )
      throw Error("Selecciona ubicaciones distintas y válidas.");
    const qty = num(p.quantity, 0.001),
      from = e.balances.find(
        (b) => b.itemId === item.id && b.locationId === p.from,
      );
    if (!from || from.quantity < qty)
      throw Error("Stock insuficiente en la ubicación de origen.");
    from.quantity -= qty;
    let to = e.balances.find(
      (b) => b.itemId === item.id && b.locationId === p.to,
    );
    if (!to) {
      to = {
        itemId: item.id,
        locationId: p.to,
        quantity: 0,
        expiry: from.expiry,
      };
      e.balances.push(to);
    }
    to.quantity += qty;
    s.movements.unshift({
      id: id("MOV"),
      item: item.id,
      cantidad: qty,
      tipo: "Traslado interno",
      originId: p.from,
      destinationId: p.to,
      originLocation: registeredLocation(s, p.from),
      destinationLocation: registeredLocation(s, p.to),
      responsibility: {
        vehicle: text(p.vehicle || "", false),
        driver: text(p.driver || "", false),
        dispatcher: text(p.dispatcher || "", false),
        receiver: text(p.receiver || "", false),
        contact: text(p.contact || "", false),
      },
      origen:
        p.from === "warehouse"
          ? s.warehouse!.nombre_cliente
          : s.points.find((x) => x.id === p.from)!.nombre_cliente,
      destino:
        p.to === "warehouse"
          ? s.warehouse!.nombre_cliente
          : s.points.find((x) => x.id === p.to)!.nombre_cliente,
      fecha: now,
      referencia: text(p.reference),
    });
  } else if (action === "demand.import") {
    if (!Array.isArray(p.rows) || p.rows.length < 4 || p.rows.length > 1000)
      throw Error("Importa entre 4 y 1000 registros.");
    const rows: DemandRow[] = p.rows.map((r: any) => {
      if (
        !s.points.some((c) => c.id === r.clientId) ||
        !s.items.some((i) => i.id === r.itemId)
      )
        throw Error("Cliente o insumo no encontrado.");
      const week = validDate(r.week);
      if (week >= today())
        throw Error("Usa semanas cerradas anteriores a hoy.");
      return {
        clientId: r.clientId,
        itemId: r.itemId,
        week,
        quantity: num(r.quantity),
        visits: num(r.visits, 0, 1000),
        area: num(r.area),
        source: "real",
      };
    });
    const keys = rows.map((r) => `${r.clientId}:${r.itemId}:${r.week}`);
    if (new Set(keys).size !== keys.length)
      throw Error("Hay semanas duplicadas para un cliente e insumo.");
    const series = new Set(rows.map((r) => `${r.clientId}:${r.itemId}`));
    e.demand = e.demand.filter((r) => !series.has(`${r.clientId}:${r.itemId}`));
    e.demand.push(...rows);
  } else return false;
  reconcileBalances(s);
  s.updatedAt = now;
  return true;
}
