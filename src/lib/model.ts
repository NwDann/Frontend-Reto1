import {
  applyEnterpriseAction,
  reconcileBalances,
  deriveOperationalInputs,
  eligibleEvaluations,
  clientFor,
} from "./enterprise.ts";
import { normalizePackaging } from "./units.ts";
import { registeredLocation } from "./locations.ts";
import type { Enterprise, Vehicle, Staff, Client } from "./enterprise.ts";
import { answerRecords } from "./advisor.ts";
import {
  upgradeState,
  warehouseFor,
  compareLogistics,
  offersFor,
  normalizePlan,
} from "./logistics.ts";
import type { Warehouse, Plan, Offer } from "./logistics.ts";
export type Item = {
  id: string;
  nombre: string;
  categoria: string;
  unidad_medida: string;
  packSize?: number;
  packUnit?: string;
  stock_actual: number;
  stock_minimo: number;
  precio_unitario: number;
  peso_unitario_kg: number;
  volumen_unitario_m3: number;
  vencimiento: string;
  history: number[];
  opening: number;
  monthly: number;
  color: string;
};
export type Point = {
  id: string;
  nombre_cliente: string;
  direccion: string;
  zona_reparto: string;
  latitud: number;
  longitud: number;
  metros_cuadrados_atendidos: number;
  urgente: boolean;
  contrato_validado: boolean;
  requiere_personal_acreditado: boolean;
};
export type Line = {
  insumo_id: string;
  cantidad: number;
  recibido?: number;
  entregado?: number;
};
export type Purchase = {
  id: string;
  item: string;
  cantidad: number;
  supplier: string;
  prioridad: string;
  motivo: string;
  estado: string;
  fecha: string;
  unitPrice?: number;
  receivedQuantity?: number;
  receiptDate?: string;
  responsibility?: Responsibility;
};
export type Dispatch = {
  id: string;
  point: string;
  lines: Line[];
  estado: string;
  fecha: string;
  entregado?: string;
  aTiempo?: boolean;
  document?: string;
  notas?: string;
  responsibility?: Responsibility;
};
export type Responsibility = {
  vehicle: string;
  driver: string;
  dispatcher: string;
  receiver: string;
  contact: string;
};
export type Evaluation = {
  id: string;
  service: string;
  puntualidad: number;
  calidad: number;
  costo: number;
  observacion: string;
  fecha: string;
  referenceId?: string;
};
export type Supplier = {
  id: string;
  nombre: string;
  categoria: string;
  lead: number;
  email: string;
  evaluations: Evaluation[];
  products?: Offer[];
  ruc?: string;
  direccion?: string;
  telefono?: string;
  contacto?: string;
  paymentTerms?: string;
};
export type Scenario = {
  id: string;
  nombre: string;
  description: string;
  order: string[];
  distance: number;
  minutes: number;
  cost: number;
  risk: number;
  load: number;
  volume: number;
  feasible: boolean;
  score: number;
  savings: number;
};
export type RouteSnapshot = {
  createdAt: string;
  origin: Warehouse;
  destinations: Point[];
  contacts: Record<string, Client>;
  vehicle?: Vehicle;
  driver?: Staff;
  dispatches: Dispatch[];
  items: Item[];
  serviceCosts?: { materials: number; labor: number; extra: number };
};
export type Route = {
  snapshot?: RouteSnapshot;
  id: string;
  nombre: string;
  vehicle: string;
  estado: string;
  date: string;
  scenario: Scenario;
  dispatches: string[];
};
export type Movement = {
  originId?: string;
  destinationId?: string;
  originLocation?: Warehouse;
  destinationLocation?: Warehouse;
  responsibility?: Responsibility;
  id: string;
  item: string;
  cantidad: number;
  tipo: string;
  origen: string;
  destino: string;
  fecha: string;
  referencia: string;
};
export type State = {
  enterprise?: Enterprise;
  warehouse?: Warehouse;
  logistics?: Plan;
  company: { id: string; name: string; demo: boolean };
  items: Item[];
  points: Point[];
  purchases: Purchase[];
  dispatches: Dispatch[];
  suppliers: Supplier[];
  routes: Route[];
  movements: Movement[];
  reviewed: string[];
  settings: {
    costKm: number;
    speed: number;
    roadFactor: number;
    capacity: number;
    volume: number;
    accredited: boolean;
  };
  updatedAt: string;
};
export const origin = {
  latitud: -0.128,
  longitud: -78.487,
  nombre_cliente: "Bodega central",
};
export const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export const dateAfter = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
export const money = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
export function initialState(
  id = "cleanpro",
  name = "CleanPro Servicios",
  demo = true,
): State {
  const stock = [42, 180, 28, 320, 65, 94, 18, 145];
  const names = [
    "Desinfectante multiusos",
    "Papel higiénico industrial",
    "Desengrasante concentrado",
    "Guantes de nitrilo",
    "Jabón líquido antibacterial",
    "Fundas de basura industrial",
    "Cloro al 5%",
    "Paños de microfibra",
  ];
  const s: State = {
    company: { id, name, demo },
    items: [],
    points: [],
    purchases: [],
    dispatches: [],
    suppliers: [],
    routes: [],
    movements: [],
    reviewed: [],
    settings: {
      costKm: 1.15,
      speed: 26,
      roadFactor: 1.25,
      capacity: 1200,
      volume: 8,
      accredited: true,
    },
    updatedAt: new Date().toISOString(),
  };
  if (!demo) return s;
  s.items = names.map((nombre, i) => ({
    id: `INS-${String(i + 1).padStart(3, "0")}`,
    nombre,
    categoria:
      i === 7
        ? "herramienta"
        : [1, 3, 5].includes(i)
          ? "consumible"
          : "quimico",
    unidad_medida: [
      "caneca",
      "caja",
      "caneca",
      "caja",
      "litro",
      "caja",
      "caneca",
      "unidad",
    ][i],
    stock_actual: stock[i] * (id === "brillo" ? 2 : 1),
    stock_minimo: [60, 100, 45, 150, 40, 60, 35, 80][i],
    precio_unitario: [18.5, 24.8, 32, 8.5, 3.75, 12.9, 14.2, 2.4][i],
    peso_unitario_kg: [20, 8, 20, 1, 1, 4, 20, 0.2][i],
    volumen_unitario_m3: [0.025, 0.12, 0.025, 0.006, 0.001, 0.03, 0.025, 0.001][
      i
    ],
    vencimiento: dateAfter([14, 210, 95, 360, 180, 365, 8, 400][i]),
    history: Array.from({ length: 12 }, (_, j) =>
      Math.round(
        ([18, 30, 14, 42, 22, 18, 12, 24][i] +
          j * 1.4 +
          ((j * 7 + i * 3) % 9)) *
          (id === "brillo" ? 0.7 : 1),
      ),
    ),
    opening: stock[i] + [70, 120, 55, 168, 90, 72, 48, 96][i],
    monthly: [70, 120, 55, 168, 90, 72, 48, 96][i],
    color: ["mint", "sand", "blue", "rose", "mint", "sand", "blue", "rose"][i],
  }));
  s.points = [
    {
      id: "PS-001",
      nombre_cliente: "Hospital del Norte",
      direccion: "Av. de la Prensa · Quito",
      zona_reparto: "Norte",
      latitud: -0.108,
      longitud: -78.483,
      metros_cuadrados_atendidos: 4800,
      urgente: true,
      contrato_validado: true,
      requiere_personal_acreditado: true,
    },
    {
      id: "PS-002",
      nombre_cliente: "Centro Corporativo Andino",
      direccion: "Av. Amazonas · Quito",
      zona_reparto: "Norte",
      latitud: -0.176,
      longitud: -78.483,
      metros_cuadrados_atendidos: 3200,
      urgente: false,
      contrato_validado: true,
      requiere_personal_acreditado: false,
    },
    {
      id: "PS-003",
      nombre_cliente: "Plaza La Carolina",
      direccion: "Av. Naciones Unidas · Quito",
      zona_reparto: "Centro norte",
      latitud: -0.184,
      longitud: -78.477,
      metros_cuadrados_atendidos: 6500,
      urgente: false,
      contrato_validado: true,
      requiere_personal_acreditado: false,
    },
    {
      id: "PS-004",
      nombre_cliente: "Edificio Cumbayá",
      direccion: "Vía Interoceánica · Cumbayá",
      zona_reparto: "Valle",
      latitud: -0.204,
      longitud: -78.43,
      metros_cuadrados_atendidos: 2100,
      urgente: true,
      contrato_validado: true,
      requiere_personal_acreditado: false,
    },
    {
      id: "PS-005",
      nombre_cliente: "Clínica del Centro",
      direccion: "Av. 12 de Octubre · Quito",
      zona_reparto: "Centro",
      latitud: -0.212,
      longitud: -78.496,
      metros_cuadrados_atendidos: 3800,
      urgente: false,
      contrato_validado: true,
      requiere_personal_acreditado: true,
    },
    {
      id: "PS-006",
      nombre_cliente: "Conjunto Los Jardines",
      direccion: "Av. Maldonado · Quito",
      zona_reparto: "Sur",
      latitud: -0.263,
      longitud: -78.524,
      metros_cuadrados_atendidos: 1700,
      urgente: false,
      contrato_validado: true,
      requiere_personal_acreditado: false,
    },
  ];
  const evals = (i: number): Evaluation[] =>
    Array.from({ length: 4 }, (_, j) => ({
      id: `EV-${i}-${j}`,
      service: `Entrega ${j + 1}`,
      puntualidad: [5, 4, 3, 5][(i + j) % 4],
      calidad: [5, 5, 4, 4][(i + j) % 4],
      costo: [4, 4, 3, 5][(i + j) % 4],
      observacion: "Evaluación de demostración",
      fecha: dateAfter(-7 * (j + 1)),
    }));
  s.suppliers = [
    {
      id: "PR-001",
      nombre: "Química Integral",
      categoria: "Químicos y desinfección",
      lead: 3,
      email: "ventas@example.com",
      evaluations: evals(0),
    },
    {
      id: "PR-002",
      nombre: "Distribuciones Andinas",
      categoria: "Papel y consumibles",
      lead: 5,
      email: "pedidos@example.com",
      evaluations: evals(1),
    },
    {
      id: "PR-003",
      nombre: "EcoInsumos",
      categoria: "Limpieza sostenible",
      lead: 4,
      email: "contacto@example.com",
      evaluations: evals(2),
    },
    {
      id: "PR-004",
      nombre: "Suministros del Pacífico",
      categoria: "Protección y herramientas",
      lead: 7,
      email: "ventas@example.com",
      evaluations: evals(3),
    },
  ];
  s.purchases = [
    {
      id: "SC-0024",
      item: "INS-001",
      cantidad: 80,
      supplier: "PR-001",
      prioridad: "Alta",
      motivo: "Reposición por stock mínimo",
      estado: "Pendiente",
      fecha: dateAfter(-1),
    },
    {
      id: "SC-0023",
      item: "INS-003",
      cantidad: 40,
      supplier: "PR-003",
      prioridad: "Alta",
      motivo: "Servicios programados",
      estado: "Aprobada",
      fecha: dateAfter(-2),
    },
    {
      id: "SC-0022",
      item: "INS-002",
      cantidad: 60,
      supplier: "PR-002",
      prioridad: "Normal",
      motivo: "Abastecimiento mensual",
      estado: "En camino",
      fecha: dateAfter(-3),
    },
  ];
  s.dispatches = s.points.map((p, i) => ({
    id: `GR-2026-${String(124 + i).padStart(4, "0")}`,
    point: p.id,
    lines: [
      {
        insumo_id: s.items[i % 8].id,
        cantidad: 8 + i,
        recibido: i < 3 ? (i === 1 ? 8 : 8 + i) : undefined,
      },
      { insumo_id: "INS-008", cantidad: 10, recibido: i < 3 ? 10 : undefined },
    ],
    estado: i < 3 ? "Entregada" : i === 3 ? "En tránsito" : "Programada",
    fecha: dateAfter(i < 3 ? -1 : 0),
    entregado: i < 3 ? dateAfter(-1) : undefined,
    aTiempo: i < 3 ? true : undefined,
  }));
  const scenarios = optimize(
    s,
    s.points.slice(0, 4).map((p) => p.id),
  );
  s.routes = [
    {
      id: "RT-0018",
      nombre: "Ruta Norte · Ronda 01",
      vehicle: "PBA-2048",
      estado: "En tránsito",
      date: dateAfter(0),
      scenario: scenarios[2],
      dispatches: [s.dispatches[3].id],
    },
    {
      id: "RT-0017",
      nombre: "Ruta Centro · Ronda 02",
      vehicle: "PBC-3192",
      estado: "Planificada",
      date: dateAfter(0),
      scenario: scenarios[0],
      dispatches: [s.dispatches[4].id, s.dispatches[5].id],
    },
  ];
  s.purchases.push(
    {
      id: "SC-DEMO-REC",
      item: "INS-001",
      cantidad: 30,
      supplier: "PR-001",
      prioridad: "Normal",
      motivo: "Compra histórica sintética; incluida en saldo de apertura",
      estado: "Recibida",
      fecha: dateAfter(-14),
      unitPrice: 18.5,
    },
    {
      id: "SC-DEMO-RECH",
      item: "INS-003",
      cantidad: 12,
      supplier: "PR-003",
      prioridad: "Normal",
      motivo: "Oferta rechazada · demostración",
      estado: "Rechazada",
      fecha: dateAfter(-8),
      unitPrice: 32,
    },
  );
  s.movements = s.dispatches
    .filter((d) => d.estado === "Entregada")
    .flatMap((d) =>
      d.lines.map((l, j) => ({
        id: `MOV-${d.id}-${j}`,
        item: l.insumo_id,
        cantidad: l.recibido ?? 0,
        tipo: "Entrega",
        origen: warehouseFor(s).nombre_cliente,
        destino: s.points.find((p) => p.id === d.point)!.nombre_cliente,
        fecha: d.fecha,
        referencia: d.id,
      })),
    );
  return s;
}
export function km(
  a: { latitud: number; longitud: number },
  b: { latitud: number; longitud: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.latitud - a.latitud) / 2) ** 2 +
    Math.cos(rad(a.latitud)) *
      Math.cos(rad(b.latitud)) *
      Math.sin(rad(b.longitud - a.longitud) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function permutations<T>(xs: T[]): T[][] {
  if (xs.length < 2) return [xs];
  return xs.flatMap((x, i) =>
    permutations(xs.filter((_, j) => i !== j)).map((p) => [x, ...p]),
  );
}
export function optimize(s: State, ids: string[]): Scenario[] {
  const points = ids
    .map((id) => s.points.find((p) => p.id === id))
    .filter((p): p is Point => !!p);
  if (points.length !== ids.length || new Set(ids).size !== ids.length)
    throw Error("La selección contiene puntos no válidos o repetidos.");
  if (!points.length || points.length > 7)
    throw Error("Selecciona entre 1 y 7 puntos de servicio.");
  if (
    points.some(
      (p) =>
        ["service", "client", "sale"].includes(clientFor(s, p.id).kind) &&
        !p.contrato_validado,
    )
  )
    throw Error("Hay un punto sin contrato validado.");
  const related = s.dispatches.filter(
    (d) => ids.includes(d.point) && d.estado === "Programada",
  );
  const load = related.reduce(
    (sum, d) =>
      sum +
      d.lines.reduce(
        (a, l) =>
          a +
          l.cantidad *
            (s.items.find((i) => i.id === l.insumo_id)?.peso_unitario_kg ?? 0),
        0,
      ),
    0,
  );
  const volume = related.reduce(
    (sum, d) =>
      sum +
      d.lines.reduce(
        (a, l) =>
          a +
          l.cantidad *
            (s.items.find((i) => i.id === l.insumo_id)?.volumen_unitario_m3 ??
              0),
        0,
      ),
    0,
  );
  const feasible =
    load <= s.settings.capacity &&
    volume <= s.settings.volume &&
    (!points.some((p) => p.requiere_personal_acreditado) ||
      s.settings.accredited);
  const wh = warehouseFor(s);
  const calc = (order: Point[]) => {
    let last = wh,
      distance = 0,
      time = 0,
      wait = 0;
    for (const p of order) {
      const leg = km(last, p) * s.settings.roadFactor;
      distance += leg;
      time += (leg / s.settings.speed) * 60;
      wait += time * (p.urgente ? 4 : 1);
      time += 12;
      last = p;
    }
    const back = km(last, wh) * s.settings.roadFactor;
    distance += back;
    time += (back / s.settings.speed) * 60;
    return {
      order: order.map((p) => p.id),
      distance,
      minutes: time,
      cost: 18 + distance * s.settings.costKm + (time / 60) * 5,
      risk: wait,
      load,
      volume,
      feasible,
    };
  };
  const candidates = permutations(points).map(calc);
  const maxC = Math.max(1, ...candidates.map((c) => c.cost)),
    maxR = Math.max(1, ...candidates.map((c) => c.risk));
  const baseline = calc(points);
  return [
    ["cost", "Menor costo", "Minimiza el costo estimado de transporte."],
    [
      "time",
      "Atención prioritaria",
      "Reduce la espera, priorizando los puntos urgentes.",
    ],
    [
      "balanced",
      "Equilibrado",
      "Combina costo (60%) y espera ponderada (40%).",
    ],
  ].map(([id, nombre, description]) => {
    const score = (c: typeof baseline) =>
      id === "cost"
        ? c.cost / maxC
        : id === "time"
          ? c.risk / maxR
          : (0.6 * c.cost) / maxC + (0.4 * c.risk) / maxR;
    const best = candidates.reduce((a, b) => (score(a) < score(b) ? a : b));
    return {
      ...best,
      id,
      nombre,
      description,
      score: Math.round((1 - score(best)) * 100 + 60),
      savings: Math.max(0, baseline.cost - best.cost),
    };
  });
}
export function forecast(item: Item, weeks: number) {
  const ys = item.history,
    n = ys.length;
  if (n < 4)
    return {
      values: [] as number[],
      total: 0,
      low: 0,
      high: 0,
      slope: 0,
      mae: 0,
      method: "Datos insuficientes: se requieren 4 semanas.",
    };
  const fit = (values: number[]) => {
    const m = values.length,
      avg = values.reduce((a, b) => a + b, 0) / m,
      x = (m - 1) / 2,
      denom = values.reduce((a, _, i) => a + (i - x) ** 2, 0);
    const b = denom
      ? values.reduce((a, y, i) => a + (i - x) * (y - avg), 0) / denom
      : 0;
    return { a: avg - b * x, b };
  };
  const f = fit(ys),
    values = Array.from({ length: weeks }, (_, i) =>
      Math.ceil(Math.max(0, f.a + f.b * (n + i))),
    );
  const residual = Math.sqrt(
    ys.reduce((a, y, i) => a + (y - f.a - f.b * i) ** 2, 0) /
      Math.max(1, n - 2),
  );
  const holdout = n >= 7 ? 3 : 1,
    validation = ys.slice(0, -holdout),
    train = fit(validation);
  const mae =
    ys
      .slice(-holdout)
      .reduce(
        (a, y, i) =>
          a + Math.abs(y - (train.a + train.b * (validation.length + i))),
        0,
      ) / holdout;
  const total = values.reduce((a, b) => a + b, 0),
    margin = 1.96 * residual * Math.sqrt(weeks);
  return {
    values,
    total,
    low: Math.max(0, Math.floor(total - margin)),
    high: Math.ceil(total + margin),
    slope: f.b,
    mae,
    method: `Regresión lineal · validación con ${holdout} semana(s)`,
  };
}
export function supplierScore(p: Supplier) {
  if (!p.evaluations.length) return 0;
  return (
    p.evaluations.reduce(
      (a, e) =>
        a + (0.4 * e.puntualidad + 0.4 * e.calidad + 0.2 * e.costo) * 20,
      0,
    ) / p.evaluations.length
  );
}
export function alerts(s: State) {
  const result: {
    id: string;
    title: string;
    detail: string;
    severity: string;
    roles: string[];
    module: string;
  }[] = [];
  for (const i of s.items) {
    if (i.stock_actual < i.stock_minimo)
      result.push({
        id: `stock-${i.id}`,
        title: `Stock bajo · ${i.nombre}`,
        detail: `${i.stock_actual} ${i.unidad_medida} disponibles. Mínimo: ${i.stock_minimo}.`,
        severity: "Crítica",
        roles: ["Compras", "Bodega", "Gerencia"],
        module: "inventory",
      });
    const days = Math.ceil(
      (new Date(i.vencimiento).getTime() - Date.now()) / 86400000,
    );
    if (i.stock_actual > 0 && days <= 30)
      result.push({
        id: `expiry-${i.id}`,
        title: `${days < 0 ? "Vencido" : "Próximo a vencer"} · ${i.nombre}`,
        detail: `${s.company.demo ? "Lote de demostración" : "Vencimiento registrado"} · ${i.vencimiento}. Aplicar FEFO y revisar el lote.`,
        severity: days <= 10 ? "Crítica" : "Media",
        roles: ["Bodega", "Gerencia"],
        module: "inventory",
      });
    const needed = s.dispatches
      .filter((d) => ["Programada", "En tránsito"].includes(d.estado))
      .flatMap((d) => d.lines)
      .filter((l) => l.insumo_id === i.id)
      .reduce((a, l) => a + l.cantidad, 0);
    const central =
      s.enterprise?.balances.find(
        (b) => b.itemId === i.id && b.locationId === "warehouse",
      )?.quantity ?? i.stock_actual;
    if (needed > central && needed <= i.stock_actual)
      result.push({
        id: `central-${i.id}`,
        title: `Reasignar a bodega central · ${i.nombre}`,
        detail: `Guías pendientes: ${needed} ${i.unidad_medida}; central: ${central}; total en otras ubicaciones: ${i.stock_actual - central}. Registra un traslado antes de despachar.`,
        severity: "Media",
        roles: ["Bodega", "Logística", "Gerencia"],
        module: "inventory",
      });
    if (needed > i.stock_actual)
      result.push({
        id: `demand-${i.id}`,
        title: `Servicio sin cobertura · ${i.nombre}`,
        detail: `Demanda programada: ${needed}; stock: ${i.stock_actual}. Faltan ${needed - i.stock_actual}.`,
        severity: "Crítica",
        roles: ["Compras", "Logística", "Gerencia"],
        module: "purchases",
      });
  }
  for (const d of s.dispatches)
    if (
      d.estado === "Entregada" &&
      d.lines.some((l) => l.recibido !== l.cantidad)
    )
      result.push({
        id: `diff-${d.id}`,
        title: `Diferencia en guía ${d.id}`,
        detail: d.lines
          .filter((l) => l.recibido !== l.cantidad)
          .map(
            (l) =>
              `${s.items.find((i) => i.id === l.insumo_id)?.nombre}: solicitado ${l.cantidad}, entregado ${l.entregado ?? l.recibido ?? 0}`,
          )
          .join(". "),
        severity: "Crítica",
        roles: ["Logística", "Bodega", "Gerencia"],
        module: "tracking",
      });
  for (const p of s.purchases)
    if (
      p.estado === "Recibida" &&
      p.receivedQuantity !== undefined &&
      p.receivedQuantity !== p.cantidad
    )
      result.push({
        id: `purchase-diff-${p.id}`,
        title: `Diferencia en compra ${p.id}`,
        detail: `Solicitado ${p.cantidad}; recibido ${p.receivedQuantity}. Responsable: ${p.responsibility?.receiver || "sin registrar"}.`,
        severity: "Crítica",
        roles: ["Compras", "Bodega", "Gerencia"],
        module: "purchases",
      });
  for (const v of s.enterprise?.vehicles || []) {
    const due = [
      ["revisión técnica", v.technicalUntil],
      ["póliza vehicular", v.insuranceUntil],
      ["mantenimiento", v.maintenanceDate],
    ]
      .filter(
        ([, date]) =>
          !date ||
          Math.ceil((new Date(date).getTime() - Date.now()) / 864e5) <= 30,
      )
      .map(([label]) => label);
    if (due.length || v.maintenanceKm <= v.odometer)
      result.push({
        id: `fleet-${v.id}`,
        title: `Obligaciones de ${v.plate}`,
        detail: `Revisar ${due.join(", ")}${v.maintenanceKm <= v.odometer ? " y kilometraje de mantenimiento" : ""}.`,
        severity: "Media",
        roles: ["Logística", "Gerencia"],
        module: "fleet",
      });
  }
  return result;
}
const finite = (v: unknown, min = 0, max = 1e8) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error("Introduce un valor numérico válido.");
  return n;
};
const str = (v: unknown, max = 250) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("Completa los campos obligatorios.");
  return v.trim();
};
export function applyAction(s: State, action: string, p: any): State {
  s = upgradeState(structuredClone(s));
  const now = new Date().toISOString();
  if (applyEnterpriseAction(s, action, p)) return s;
  if (action === "purchase.create") {
    const item = s.items.find((i) => i.id === p.item);
    if (!item) throw Error("Insumo no encontrado.");
    const offer = offersFor(s, item.id).find(
      (o) => o.supplier.id === p.supplier,
    );
    if (!offer)
      throw Error(
        "Este proveedor no tiene registrado el insumo seleccionado. Actualiza su catálogo.",
      );
    if (Number(p.cantidad) < offer.minOrder)
      throw Error("La cantidad no cumple el pedido mínimo del proveedor.");
    s.purchases.unshift({
      id: uid("SC"),
      item: item.id,
      cantidad: finite(p.cantidad, 1),
      supplier: p.supplier,
      prioridad: p.prioridad === "Alta" ? "Alta" : "Normal",
      motivo: str(p.motivo),
      estado: "Pendiente",
      fecha: now,
      unitPrice: offer.price,
    });
  } else if (action === "purchase.status") {
    const po = s.purchases.find((x) => x.id === p.id);
    if (!po) throw Error("Solicitud no encontrada.");
    const next: Record<string, string[]> = {
      Pendiente: ["Aprobada", "Rechazada"],
      Aprobada: ["En camino"],
      "En camino": ["Recibida"],
    };
    if (!next[po.estado]?.includes(p.estado))
      throw Error("Este cambio de estado no está permitido.");
    po.estado = p.estado;
    if (po.estado === "Recibida") {
      const item = s.items.find((i) => i.id === po.item)!;
      item.stock_actual += po.cantidad;
      s.movements.unshift({
        id: uid("MOV"),
        item: item.id,
        cantidad: po.cantidad,
        tipo: "Ingreso",
        destinationId: "warehouse",
        destinationLocation: registeredLocation(s, "warehouse"),
        origen: s.suppliers.find((x) => x.id === po.supplier)!.nombre,
        destino: warehouseFor(s).nombre_cliente,
        fecha: now,
        referencia: po.id,
      });
    }
  } else if (action === "item.create") {
    const categoria = ["quimico", "consumible", "herramienta"].includes(
      p.categoria,
    )
      ? p.categoria
      : "consumible";
    const nombre = str(p.nombre);
    if (
      s.items.some(
        (i) => i.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase(),
      )
    )
      throw Error("Este insumo ya existe. Selecciónalo en el buscador.");
    s.items.push({
      id: uid("INS"),
      nombre,
      categoria,
      unidad_medida: str(p.unidad_medida, 30),
      ...normalizePackaging(str(p.unidad_medida, 30), p),
      stock_actual: 0,
      stock_minimo: finite(p.stock_minimo),
      precio_unitario: finite(p.precio_unitario),
      peso_unitario_kg: finite(p.peso_unitario_kg),
      volumen_unitario_m3: finite(p.volumen_unitario_m3),
      vencimiento: "",
      history: [],
      opening: 0,
      monthly: 0,
      color: "mint",
    });
  } else if (action === "item.update") {
    const i = s.items.find((i) => i.id === p.id);
    if (!i) throw Error("Insumo no encontrado.");
    i.stock_minimo = finite(p.stock_minimo);
    i.precio_unitario = finite(p.precio_unitario);
    if (p.packSize !== undefined || p.packUnit !== undefined)
      Object.assign(i, normalizePackaging(i.unidad_medida, p));
  } else if (action === "history.import") {
    const i = s.items.find((i) => i.id === p.id);
    if (!i) throw Error("Insumo no encontrado.");
    if (
      !Array.isArray(p.values) ||
      p.values.length < 4 ||
      p.values.length > 104
    )
      throw Error("Se requieren entre 4 y 104 semanas.");
    i.history = p.values.map((v: unknown) => finite(v));
  } else if (action === "point.create") {
    s.points.push({
      id: uid("PS"),
      nombre_cliente: str(p.nombre_cliente),
      direccion: str(p.direccion),
      zona_reparto: str(p.zona_reparto, 50),
      latitud: finite(p.latitud, -90, 90),
      longitud: finite(p.longitud, -180, 180),
      metros_cuadrados_atendidos: finite(p.metros_cuadrados_atendidos),
      urgente: !!p.urgente,
      contrato_validado: !!p.contrato_validado,
      requiere_personal_acreditado: !!p.requiere_personal_acreditado,
    });
    const pointId = s.points[s.points.length - 1].id;
    applyEnterpriseAction(s, "location.contact", {
      ...p,
      id: pointId,
      frequency: p.frequency ?? 1,
    });
  } else if (action === "warehouse.update") {
    s.warehouse = {
      nombre_cliente: str(p.nombre_cliente),
      direccion: str(p.direccion),
      latitud: finite(p.latitud, -90, 90),
      longitud: finite(p.longitud, -180, 180),
    };
  } else if (action === "point.update") {
    const point = s.points.find((x) => x.id === p.id);
    if (!point) throw Error("Punto no encontrado.");
    Object.assign(point, {
      nombre_cliente: str(p.nombre_cliente),
      direccion: str(p.direccion),
      zona_reparto: str(p.zona_reparto, 50),
      latitud: finite(p.latitud, -90, 90),
      longitud: finite(p.longitud, -180, 180),
      metros_cuadrados_atendidos: finite(p.metros_cuadrados_atendidos),
      urgente: !!p.urgente,
      contrato_validado: !!p.contrato_validado,
      requiere_personal_acreditado: !!p.requiere_personal_acreditado,
    });
    if (p.kind)
      applyEnterpriseAction(s, "location.contact", {
        ...p,
        id: point.id,
        frequency: p.frequency ?? 1,
      });
  } else if (action === "logistics.update") {
    s.logistics = normalizePlan(s, p);
  } else if (action === "supplier.catalog") {
    const provider = s.suppliers.find((x) => x.id === p.id);
    if (!provider) throw Error("Proveedor no encontrado.");
    if (!Array.isArray(p.products) || p.products.length > 1000)
      throw Error("Catálogo no válido.");
    if (
      new Set(p.products.map((o: any) => o.itemId)).size !== p.products.length
    )
      throw Error("No repitas insumos en el catálogo.");
    provider.products = p.products.map((o: any) => {
      if (!s.items.some((i) => i.id === o.itemId))
        throw Error("Insumo no encontrado.");
      return {
        itemId: o.itemId,
        price: finite(o.price),
        lead: finite(o.lead, 0, 365),
        minOrder: finite(o.minOrder, 1),
      };
    });
  } else if (action === "route.create") {
    const prepared = p.inputs?.registered
        ? deriveOperationalInputs(s, p.points, p.inputs, p.matrix)
        : undefined,
      routeInput = prepared?.inputs || p.inputs;
    const scenarios = routeInput
      ? compareLogistics(s, p.points, routeInput, p.matrix)
      : optimize(s, p.points);
    const scenario = scenarios.find((x) => x.id === p.scenario);
    if (!scenario || !scenario.feasible)
      throw Error(
        "El escenario no es factible: revisa capacidad y acreditación.",
      );
    if (p.inputs && "onTime" in scenario && !scenario.onTime)
      throw Error("El escenario supera el plazo disponible.");
    if (routeInput?.registered && p.date !== routeInput.departure?.slice(0, 10))
      throw Error("La fecha del plan debe coincidir con la salida calculada.");
    const vehicle = s.enterprise!.vehicles.find(
        (v) =>
          v.id ===
          (p.scenario.startsWith("own")
            ? routeInput?.vehicleId
            : routeInput?.externalVehicleId),
      ),
      assigned = s.dispatches.filter(
        (d) =>
          d.estado === "Programada" &&
          p.points.includes(d.point) &&
          !s.routes.some(
            (r) => r.estado !== "Completada" && r.dispatches.includes(d.id),
          ),
      ),
      destinations = scenario.order.map((id) =>
        s.points.find((x) => x.id === id)!,
      ),
      contacts = Object.fromEntries(
        destinations
          .map((x) => [x.id, s.enterprise!.contacts[x.id]])
          .filter(([, c]) => !!c),
      );
    const calculationGuides = s.dispatches.filter(
      (d) => d.estado === "Programada" && p.points.includes(d.point),
    );
    const snapshot: RouteSnapshot = structuredClone({
      createdAt: now,
      origin:
        "warehouse" in scenario
          ? (scenario.warehouse as Warehouse)
          : warehouseFor(s),
      destinations,
      contacts,
      vehicle,
      driver: s.enterprise!.staff.find((d) => d.id === vehicle?.driverId),
      dispatches: calculationGuides,
      items: s.items.filter((i) =>
        calculationGuides.some((d) =>
          d.lines.some((l) => l.insumo_id === i.id),
        ),
      ),
      serviceCosts: prepared
        ? {
            materials: prepared.derived.materials,
            labor: prepared.derived.labor,
            extra: prepared.derived.extra,
          }
        : undefined,
    });
    s.routes.unshift({
      id: uid("RT"),
      nombre: str(p.nombre),
      vehicle: routeInput?.registered
        ? vehicle?.plate || str(p.vehicle, 100)
        : str(p.vehicle, 100),
      estado: "Planificada",
      date: str(p.date, 30),
      scenario,
      dispatches: assigned.map((d) => d.id),
      snapshot,
    });
  } else if (action === "route.status") {
    const r = s.routes.find((r) => r.id === p.id);
    if (!r) throw Error("Ruta no encontrada.");
    if (r.estado === "Planificada" && p.estado === "En tránsito")
      r.estado = p.estado;
    else if (r.estado === "En tránsito" && p.estado === "Completada") {
      if (
        r.dispatches.some(
          (id) => s.dispatches.find((d) => d.id === id)?.estado !== "Entregada",
        )
      )
        throw Error("Confirma las entregas de esta ruta antes de completarla.");
      r.estado = p.estado;
      const plan = (r.scenario as any).inputs;
      const vehicle = s.enterprise!.vehicles.find(
        (v) =>
          v.id ===
            ((r.scenario as any).mode === "external"
              ? plan?.externalVehicleId
              : plan?.vehicleId) || v.plate === r.vehicle,
      );
      if (vehicle && !s.enterprise!.trips.some((t) => t.routeId === r.id)) {
        s.enterprise!.trips.push({
          id: uid("VIA"),
          vehicleId: vehicle.id,
          date: now.slice(0, 10),
          km: r.scenario.distance,
          minutes: (r.scenario as any).drivingMinutes || r.scenario.minutes,
          tolls: plan?.tolls || 0,
          routeId: r.id,
        });
        vehicle.odometer += r.scenario.distance;
      }
    } else throw Error("Cambio de estado no permitido.");
  } else if (action === "dispatch.create") {
    if (!s.points.some((x) => x.id === p.point))
      throw Error("Punto de servicio no encontrado.");
    if (!Array.isArray(p.lines) || !p.lines.length || p.lines.length > 50)
      throw Error("Agrega al menos un insumo.");
    const lines: Line[] = p.lines.map((l: any) => {
      if (!s.items.some((i) => i.id === l.insumo_id))
        throw Error("Insumo no encontrado.");
      return { insumo_id: l.insumo_id, cantidad: finite(l.cantidad, 1) };
    });
    if (new Set(lines.map((l) => l.insumo_id)).size !== lines.length)
      throw Error("No repitas el mismo insumo en una guía.");
    s.dispatches.unshift({
      id: uid("GR"),
      point: p.point,
      lines,
      estado: "Programada",
      fecha: str(p.fecha, 30),
      responsibility: {
        vehicle: typeof p.vehicle === "string" ? p.vehicle : "",
        driver: typeof p.driver === "string" ? p.driver : "",
        dispatcher: typeof p.dispatcher === "string" ? p.dispatcher : "",
        receiver: typeof p.receiver === "string" ? p.receiver : "",
        contact: typeof p.contact === "string" ? p.contact : "",
      },
      document: typeof p.document === "string" ? p.document : undefined,
      notas: typeof p.notas === "string" ? p.notas.slice(0, 1000) : undefined,
    });
  } else if (action === "dispatch.receive") {
    const d = s.dispatches.find((d) => d.id === p.id);
    if (!d || d.estado === "Entregada")
      throw Error("La guía ya fue confirmada o no existe.");
    if (!Array.isArray(p.lines) || p.lines.length !== d.lines.length)
      throw Error("Confirma todas las cantidades.");
    for (const l of d.lines) {
      const input = p.lines.find((x: any) => x.insumo_id === l.insumo_id);
      if (!input) throw Error("Falta un insumo en la recepción.");
      const received = finite(input.recibido, 0, l.cantidad);
      const item = s.items.find((i) => i.id === l.insumo_id)!;
      if (item.stock_actual < l.cantidad)
        throw Error(`Stock insuficiente de ${item.nombre}.`);
      item.stock_actual -= l.cantidad;
      l.recibido = received;
      l.entregado = received;
      s.movements.unshift({
        id: uid("MOV"),
        item: l.insumo_id,
        cantidad: l.cantidad,
        tipo: "Salida",
        originId: "warehouse",
        destinationId: d.point,
        originLocation: registeredLocation(s, "warehouse"),
        destinationLocation: registeredLocation(s, d.point),
        origen: warehouseFor(s).nombre_cliente,
        destino: s.points.find((x) => x.id === d.point)!.nombre_cliente,
        fecha: now,
        referencia: d.id,
      });
    }
    if (p.receiver)
      d.responsibility = {
        vehicle: str(p.vehicle, 200),
        driver: str(p.driver, 200),
        dispatcher: str(p.dispatcher, 200),
        receiver: str(p.receiver, 200),
        contact: typeof p.contact === "string" ? p.contact : "",
      };
    d.estado = "Entregada";
    d.entregado = now;
    d.aTiempo = now.slice(0, 10) <= d.fecha.slice(0, 10);
    d.notas = typeof p.notas === "string" ? p.notas.slice(0, 1000) : d.notas;
  } else if (action === "supplier.create") {
    if (p.ruc && !/^\d{13}$/.test(p.ruc))
      throw Error("El RUC debe contener 13 dígitos.");
    s.suppliers.push({
      id: uid("PR"),
      nombre: str(p.nombre),
      categoria: str(p.categoria),
      lead: finite(p.lead, 1, 365),
      email: typeof p.email === "string" ? p.email.slice(0, 200) : "",
      evaluations: [],
      products: [],
      ruc: typeof p.ruc === "string" ? p.ruc : "",
      direccion: typeof p.direccion === "string" ? p.direccion : "",
      telefono: typeof p.telefono === "string" ? p.telefono : "",
      contacto: typeof p.contacto === "string" ? p.contacto : "",
      paymentTerms: typeof p.paymentTerms === "string" ? p.paymentTerms : "",
    });
  } else if (action === "supplier.evaluate") {
    const provider = s.suppliers.find((x) => x.id === p.id);
    if (!provider) throw Error("Proveedor no encontrado.");
    const operation = eligibleEvaluations(s, provider.id).find(
      (x) => x.id === p.referenceId,
    );
    if (!operation)
      throw Error(
        "Selecciona una compra recibida, rechazada o transporte completado sin evaluar.",
      );
    provider.evaluations.unshift({
      id: uid("EV"),
      service: operation.label,
      referenceId: operation.id,
      puntualidad: finite(p.puntualidad, 1, 5),
      calidad: finite(p.calidad, 1, 5),
      costo: finite(p.costo, 1, 5),
      observacion:
        typeof p.observacion === "string" ? p.observacion.slice(0, 1000) : "",
      fecha: now,
    });
  } else if (action === "alert.review") {
    if (!alerts(s).some((a) => a.id === p.id))
      throw Error("Alerta no encontrada.");
    if (!s.reviewed.includes(p.id)) s.reviewed.push(p.id);
  } else if (action === "settings.update") {
    s.settings = {
      costKm: finite(p.costKm, 0.01, 100),
      speed: finite(p.speed, 1, 120),
      roadFactor: finite(p.roadFactor, 1, 3),
      capacity: finite(p.capacity, 1, 100000),
      volume: finite(p.volume, 0.1, 1000),
      accredited: !!p.accredited,
    };
  } else throw Error("Acción no reconocida.");
  reconcileBalances(s);
  s.updatedAt = now;
  return s;
}
export function assistantAnswer(s: State, q: string) {
  return answerRecords(upgradeState(structuredClone(s)), q);
}
