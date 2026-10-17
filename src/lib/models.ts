import type * as B from "../services/backend.types.ts";
import type { Records, CriticalRecord } from "../services/client.ts";
export type Snapshot = {
  items?: Records["insumos"][];
  points?: B.PuntoServicioResponse[];
  staff?: Records["personal"][];
  routes?: Records["rutas"][];
  dispatches?: B.DespachoResponse[];
  contracts?: B.ContratoResponse[];
  critical?: CriticalRecord[];
  kpis?: B.KPIResumenResponse;
  errors: Partial<Record<DataKey, string>>;
  loadedAt: Partial<Record<DataKey, string>>;
};
export type DataKey =
  | "items"
  | "points"
  | "staff"
  | "routes"
  | "dispatches"
  | "contracts"
  | "critical"
  | "kpis";
export const LABELS: Record<DataKey, string> = {
  items: "Insumos",
  points: "Puntos de servicio",
  staff: "Personal",
  routes: "Rutas",
  dispatches: "Despachos",
  contracts: "Contratos",
  critical: "Insumos críticos",
  kpis: "Indicadores",
};
export type Coords = { lat: number; lng: number };
export type Origin = Coords & { name: string };
export type Preferences = {
  origin: Origin | null;
  mapProvider: "osm" | "google";
  timezone: string;
  inventoryBudget: number | null;
  targetMargin: number;
};
export type Draft = {
  id: string;
  itemId: number;
  quantity: number;
  reason: string;
  provider: string;
  createdAt: string;
};
export type AppPage =
  | "dashboard"
  | "routes"
  | "inventory"
  | "purchases"
  | "tracking"
  | "points"
  | "fleet"
  | "demand"
  | "suppliers"
  | "assistant"
  | "settings"
  | "alerts";
export type EditResource =
  | "insumos"
  | "puntos-servicio"
  | "personal"
  | "rutas"
  | "despachos"
  | "contratos";
export type Modal =
  | { kind: "edit"; resource: EditResource; record?: any; seed?: any }
  | { kind: "dispatch-detail"; id: number }
  | { kind: "route-detail"; id: number }
  | { kind: "status"; route: B.RutaResponse }
  | { kind: "delete"; resource: EditResource; record: any }
  | { kind: "draft"; itemId?: number };
