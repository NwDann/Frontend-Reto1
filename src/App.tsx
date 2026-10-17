import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Route,
  Package,
  MapPin,
  ChartNoAxesCombined,
  Sparkles,
  Building2,
  Truck,
  Settings2,
  Search,
  Bell,
  ChevronRight,
  LoaderCircle,
  Menu,
  X,
  Database,
  RefreshCw,
  TriangleAlert,
  Check,
  Leaf,
} from "lucide-react";
import type {
  Snapshot,
  Preferences,
  Modal,
  Draft,
  AppPage,
} from "./lib/models";
import { loadSnapshot } from "./services/load";
import { api } from "./services/api";
import { config } from "./services/config";
import { dateTime, validCoords } from "./lib/format";
import { operationalAlerts } from "./lib/insights";
import { Badge } from "./components/ui";
import Overview from "./components/Overview";
import Inventory from "./components/Inventory";
import Tracking from "./components/Tracking";
import Planner from "./components/Planner";
import Demand from "./components/Demand";
import Assistant from "./components/Assistant";
import Settings from "./components/Settings";
import Alerts from "./components/Alerts";
import { Fleet, Locations } from "./components/Directory";
import { DraftEditor } from "./components/Purchases";
import RecordEditor from "./components/RecordEditor";
import ReportDialog from "./components/ReportDialog";
const names: Record<AppPage, string> = {
  dashboard: "Vista general",
  routes: "Optimización de rutas",
  inventory: "Inventario",
  purchases: "Compras",
  tracking: "Trazabilidad",
  points: "Clientes y ubicaciones",
  fleet: "Personal y vehículos",
  demand: "Predicción de demanda",
  suppliers: "Proveedores",
  assistant: "Asistente",
  settings: "Configuración",
  alerts: "Centro de alertas",
};
const nav = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "routes", icon: Route },
  { id: "inventory", icon: Package },
  { id: "tracking", icon: MapPin },
  { id: "points", icon: Building2 },
  { id: "fleet", icon: Truck },
] as const;
const intelligence = [
  { id: "demand", icon: ChartNoAxesCombined },
  { id: "assistant", icon: Sparkles },
] as const;
const empty: Snapshot = { errors: {}, loadedAt: {} };
function initialPreferences(): Preferences {
  const defaults: Preferences = {
    origin:
      config.originLat !== "" &&
      config.originLng !== "" &&
      validCoords(Number(config.originLat), Number(config.originLng))
        ? {
            lat: Number(config.originLat),
            lng: Number(config.originLng),
            name: config.originName,
          }
        : null,
    mapProvider: config.mapProvider as "osm" | "google",
    timezone: "America/Guayaquil",
    inventoryBudget: null,
    targetMargin: 20,
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem(`optilogic-api-preferences-v2:${config.apiBase}`) ||
        "null",
    );
    if (!saved) return defaults;
    return {
      origin:
        saved.origin && validCoords(saved.origin.lat, saved.origin.lng)
          ? {
              ...saved.origin,
              name: String(saved.origin.name || "Origen configurado"),
            }
          : defaults.origin,
      mapProvider: saved.mapProvider === "google" ? "google" : "osm",
      timezone:
        saved.timezone === "Pacific/Galapagos"
          ? "Pacific/Galapagos"
          : "America/Guayaquil",
      inventoryBudget:
        typeof saved.inventoryBudget === "number" && saved.inventoryBudget > 0
          ? saved.inventoryBudget
          : null,
      targetMargin:
        typeof saved.targetMargin === "number" &&
        saved.targetMargin >= 0 &&
        saved.targetMargin < 100
          ? saved.targetMargin
          : 20,
    };
  } catch {
    return defaults;
  }
}
export default function App() {
  const [page, setPage] = useState<AppPage>("dashboard"),
    [s, setS] = useState<Snapshot>(empty),
    [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [prefs, setPreferences] = useState(initialPreferences),
    [modal, setModal] = useState<Modal | null>(null),
    [reports, setReports] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState("");
  const seq = useRef(0),
    writing = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 7000);
  }, []);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const data = await loadSnapshot(api);
      if (n === seq.current) {
        setS(data);
        setLoaded(true);
      }
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
    return () => {
      seq.current++;
    };
  }, [reload]);
  const setPrefs = (next: Preferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(
        `optilogic-api-preferences-v2:${config.apiBase}`,
        JSON.stringify(next),
      );
    } catch {
      notify(
        "No se pudieron guardar las preferencias del navegador. Se conservarán durante esta sesión.",
        true,
      );
    }
  };
  const go = (p: AppPage) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saved = async () => {
    notify("Cambio guardado. Actualizando la información…");
    await reload();
  };
  const perform = async (fn: () => Promise<unknown>) => {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true);
    try {
      await fn();
      await saved();
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setReports(false);
        setMobile(false);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  const alertCount = operationalAlerts(s).length,
    errors = Object.entries(s.errors),
    allFailed = loaded && !Object.keys(s.loadedAt).length,
    last = Object.values(s.loadedAt).sort().at(-1);
  const matches = query.trim()
    ? [
        ...(s.items || [])
          .filter((i) =>
            (i.nombre + " " + i.id).toLowerCase().includes(query.toLowerCase()),
          )
          .map((i) => ({
            title: i.nombre,
            text: `Insumo #${i.id} · ${i.stock_actual} ${i.unidad_medida}`,
            page: "inventory" as AppPage,
          })),
        ...(s.points || [])
          .filter((p) =>
            (p.nombre_cliente + " " + p.id)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((p) => ({
            title: p.nombre_cliente,
            text: `Punto #${p.id} · ${p.zona_reparto || "Sin zona"}`,
            page: "points" as AppPage,
          })),
        ...(s.routes || [])
          .filter((r) =>
            (r.codigo_vehiculo + " " + r.id)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((r) => ({
            title: `Ruta #${r.id}`,
            text: `${r.codigo_vehiculo} · ${r.estado}`,
            page: "routes" as AppPage,
          })),
      ]
    : [];
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-shade" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            nexo<span className="brand-period">.</span>
          </span>
          <span className="brand-tag">OPTILOGIC</span>
        </a>
        <div className="company-box">
          <div className="company-avatar">
            <Database size={19} />
          </div>
          <div>
            <small>OPERACIÓN EN VIVO</small>
            <strong>Inventario y rutas</strong>
          </div>
          <Badge tone="green">En línea</Badge>
        </div>
        <div className="nav-section-label">OPERACIÓN</div>
        <nav>
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "selected" : ""}`}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              <span>{names[id]}</span>
            </button>
          ))}
        </nav>
        <div className="nav-section-label intelligence-label">ANÁLISIS</div>
        <nav>
          {intelligence.map(({ id, icon: Icon }) => (
            <button
              className={`nav-item ${page === id ? "selected" : ""}`}
              key={id}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              <span>{names[id]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-insight">
            <span className="insight-icon">
              <Leaf size={18} />
            </span>
            <h4>Decisiones con respaldo.</h4>
            <p>
              Información actualizada de stock, clientes, personal y rutas para
              planificar el día.
            </p>
            <button onClick={() => go("routes")}>Comparar recorridos ↗</button>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "selected" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={18} />
            <span>Configuración</span>
          </button>
          <div className="profile">
            <span className="profile-avatar">NX</span>
            <div>
              <strong>Vista operativa</strong>
              <span>Logística y despachos</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegación"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Optilogic</span>
            <ChevronRight size={13} />
            <strong>{names[page]}</strong>
          </div>
          <div className="topbar-right">
            <button className="global-search" onClick={() => setSearch(true)}>
              <Search size={15} />
              <span>Buscar en los registros</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="btn secondary small"
              disabled={!loaded || allFailed}
              onClick={() => setReports(true)}
            >
              Reportes
            </button>
            <button
              className="icon-button"
              disabled={loading || busy}
              aria-label="Actualizar información"
              onClick={reload}
            >
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
            <button
              className="icon-button notification"
              aria-label={`${alertCount} alertas calculadas`}
              onClick={() => go("alerts")}
            >
              <Bell size={19} />
              {alertCount > 0 && <i />}
            </button>
          </div>
        </header>
        <main>
          <div className="context-line">
            <span>
              <span
                className={`live-dot ${errors.length ? "has-error" : ""}`}
              />
              {loading
                ? "Actualizando información…"
                : errors.length
                  ? "Algunos datos no se pudieron cargar"
                  : "Información actualizada"}
              <span className="context-separator">/</span>
              {last ? dateTime(last, prefs.timezone) : "Primera consulta"}
            </span>
            <Badge tone={errors.length ? "sand" : "blue"}>
              {Object.keys(s.loadedAt).length}/8 áreas disponibles
            </Badge>
          </div>
          {busy && <p className="live-note">Guardando cambios…</p>}
          {allFailed && page !== "settings" ? (
            <section className="card padded live-connection-error">
              <TriangleAlert size={34} />
              <h1>No pudimos cargar la información operativa.</h1>
              <p>
                {errors[0]?.[1] ||
                  "Revisa tu conexión a internet e intenta de nuevo."}
              </p>
              <div className="row-actions">
                <button className="btn primary" onClick={reload}>
                  Reintentar
                </button>
                <button
                  className="btn secondary"
                  onClick={() => go("settings")}
                >
                  Ver configuración
                </button>
              </div>
              <p className="hint">
                Mientras no haya conexión no se muestran datos inventados: la
                pantalla espera a que el servicio responda.
              </p>
            </section>
          ) : !loaded ? (
            <div className="loading">
              <LoaderCircle className="spin" size={24} />
              <p>Consultando catálogo, rutas y despachos…</p>
            </div>
          ) : (
            <div className={loading ? "live-refreshing" : ""}>
              {page === "dashboard" && (
                <Overview s={s} prefs={prefs} go={go} open={setModal} />
              )}{" "}
              {page === "inventory" && (
                <Inventory s={s} open={setModal} perform={perform} />
              )}{" "}
              {page === "routes" && (
                <Planner
                  s={s}
                  prefs={prefs}
                  setPrefs={setPrefs}
                  open={setModal}
                />
              )}{" "}
              {page === "tracking" && (
                <Tracking
                  s={s}
                  prefs={prefs}
                  open={setModal}
                  perform={perform}
                />
              )}{" "}
              {page === "points" && (
                <Locations s={s} prefs={prefs} open={setModal} />
              )}{" "}
              {page === "fleet" && <Fleet s={s} open={setModal} />}{" "}
              {page === "demand" && (
                <Demand s={s} prefs={prefs} open={setModal} />
              )}{" "}
              {page === "assistant" && (
                <Assistant s={s} open={setModal} go={go} />
              )}{" "}
              {page === "settings" && (
                <Settings s={s} prefs={prefs} setPrefs={setPrefs} />
              )}{" "}
              {page === "alerts" && <Alerts s={s} go={go} />}
            </div>
          )}
          <footer className="footer">
            <span>
              <span className="footer-logo">nexo.</span>
              Inventario, rutas y trazabilidad en tiempo real.
            </span>
            <span>
              <Database size={12} />
              Datos operativos actualizados
            </span>
          </footer>
        </main>
      </div>
      {modal &&
        (modal.kind === "draft" ? (
          <DraftEditor
            s={s}
            itemId={modal.itemId}
            close={() => setModal(null)}
            save={(d) => {
              setDrafts((xs) => [d, ...xs]);
              notify(
                "Borrador preparado en esta sesión; descárgalo antes de recargar.",
              );
            }}
          />
        ) : (
          <RecordEditor
            key={JSON.stringify(modal)}
            modal={modal}
            s={s}
            prefs={prefs}
            close={() => setModal(null)}
            saved={saved}
          />
        ))}
      {reports && (
        <ReportDialog s={s} page={page} close={() => setReports(false)} />
      )}{" "}
      {search && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setSearch(false)}
        >
          <div className="search-modal">
            <div className="search-modal-input">
              <Search size={20} />
              <input
                autoFocus
                aria-label="Buscar registros"
                placeholder="Insumo, cliente, vehículo o ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="Cerrar búsqueda"
                onClick={() => setSearch(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="search-results">
              {!query ? (
                <p>Busca en las fuentes consultadas.</p>
              ) : matches.length ? (
                matches.slice(0, 15).map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      go(m.page);
                      setSearch(false);
                      setQuery("");
                    }}
                  >
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.text}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <p>No encontramos registros con ese texto.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "live-toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          <button aria-label="Cerrar aviso" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
