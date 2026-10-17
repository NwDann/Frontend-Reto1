"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Route,
  Package,
  ShoppingCart,
  MapPin,
  ChartNoAxesCombined,
  Sparkles,
  Building2,
  Truck,
  Settings2,
  ChevronDown,
  Search,
  Bell,
  ArrowUpRight,
  Plus,
  Check,
  Leaf,
  ChevronRight,
  LoaderCircle,
  Menu,
  X,
  CircleHelp,
  ShieldCheck,
  Database,
  TriangleAlert,
} from "lucide-react";
import { State, alerts } from "@/lib/model";
import {
  Page,
  Action,
  Requester,
  Badge,
  download,
  toCSV,
} from "./components/ui";
import {
  Dashboard,
  Fleet,
  Locations,
  Settings,
  Suppliers,
} from "./components/EnterpriseViews";
import Demand from "./components/DemandClient";
import EnterpriseModal, {
  enterpriseModalTypes,
} from "./components/EnterpriseModal";
import LogisticsUI from "./components/LogisticsUI";
import { Inventory, Purchases, Tracking } from "./components/Operations";
import { Assistant, Alerts } from "./components/Intelligence";
import ModalView from "./components/ModalView";
import { request as apiRequest } from "./services/api";
import { isDemo } from "./services/config";
import { authClient } from "./services/supabase";
import { useAuth } from "./auth/AuthProvider";
import SettingsExtras from "./components/SettingsExtras";
import ReportDialog from "./components/ReportDialog";
const names: Record<Page, string> = {
  dashboard: "Vista general",
  routes: "Optimización de rutas",
  inventory: "Inventario",
  purchases: "Solicitudes de compra",
  tracking: "Trazabilidad",
  demand: "Predicción de demanda",
  suppliers: "Proveedores",
  assistant: "Asistente Nexo",
  alerts: "Centro de alertas",
  settings: "Configuración",
  points: "Ubicaciones",
  fleet: "Gestión de flota",
};
const nav = [
  { id: "dashboard", label: "Vista general", icon: LayoutDashboard },
  { id: "routes", label: "Optimización de rutas", icon: Route },
  { id: "inventory", label: "Inventario", icon: Package },
  { id: "purchases", label: "Compras", icon: ShoppingCart },
  { id: "tracking", label: "Trazabilidad", icon: MapPin },
  { id: "points", label: "Ubicaciones", icon: Building2 },
  { id: "fleet", label: "Gestión de flota", icon: Truck },
];
const intelligence = [
  { id: "demand", label: "Predicción de demanda", icon: ChartNoAxesCombined },
  { id: "suppliers", label: "Proveedores", icon: ShieldCheck },
  { id: "assistant", label: "Asistente Nexo", icon: Sparkles },
];
export default function App() {
  const { session } = useAuth();
  const [needsCompany, setNeedsCompany] = useState(false),
    [reports, setReports] = useState(false);

  const [page, setPage] = useState<Page>("dashboard"),
    [s, setS] = useState<State | null>(null),
    [companies, setCompanies] = useState<
      { id: string; name: string; role?: string }[]
    >([]),
    [company, setCompany] = useState("cleanpro"),
    [role, setRole] = useState("Gerencia"),
    [modal, setModal] = useState<{ type: string; data?: any } | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [refreshKey, setRefreshKey] = useState(0);
  const seq = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  };
  const request: Requester = (path, body) => apiRequest(company, path, body);
  useEffect(() => {
    const n = ++seq.current;
    setS(null);
    setError("");
    setNeedsCompany(false);
    (async () => {
      try {
        const cs = await request("companies");
        if (n !== seq.current) return;
        setCompanies(cs);
        if (!cs.length) {
          setNeedsCompany(true);
          return;
        }
        if (!cs.some((c: any) => c.id === company)) {
          setCompany(cs[0].id);
          return;
        }
        const data = await request("state");
        if (n === seq.current) setS(data);
      } catch (e) {
        if (n === seq.current) setError((e as Error).message);
      }
    })();
  }, [company, refreshKey, session?.user.id]);
  const workspaceRole =
    companies.find((c) => c.id === company)?.role || "consulta";
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setModal(null);
        setSearchOpen(false);
        setMobile(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const go = (p: Page) => {
    setPage(p);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const action: Action = async (name, payload) => {
    setBusy(true);
    const n = seq.current;
    try {
      const data = await request("action", { action: name, payload });
      if (n === seq.current) setS(data);
      notify("Cambios guardados");
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const open = (type: string, data?: any) => setModal({ type, data }),
    pending =
      s && s.enterprise?.profile.digest !== false
        ? alerts(s).filter((a) => !s.reviewed.includes(a.id))
        : [];
  const exportData = (type: string) => {
    if (!s) return;
    const rows =
      type === "inventory"
        ? s.items.map((i) => ({
            codigo: i.id,
            insumo: i.nombre,
            categoria: i.categoria,
            unidad: i.unidad_medida,
            ubicaciones: s.enterprise?.balances
              .filter((b) => b.itemId === i.id && b.quantity > 0)
              .map(
                (b) =>
                  `${b.locationId === "warehouse" ? s.warehouse?.nombre_cliente : s.points.find((p) => p.id === b.locationId)?.nombre_cliente}: ${b.quantity} ${i.unidad_medida}`,
              )
              .join(" | "),
            stock: i.stock_actual,
            minimo: i.stock_minimo,
            precio: i.precio_unitario,
          }))
        : s.movements;
    download(`${s.company.id}-${type}.csv`, toCSV(rows));
    notify("Reporte descargado");
  };
  const matches =
    s && query.trim()
      ? [
          ...s.items
            .filter((i) =>
              (i.nombre + " " + i.id)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((i) => ({
              title: i.nombre,
              subtitle: `${i.id} · ${i.stock_actual} ${i.unidad_medida}`,
              page: "inventory" as Page,
            })),
          ...s.points
            .filter((i) =>
              (i.nombre_cliente + " " + i.id)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((i) => ({
              title: i.nombre_cliente,
              subtitle: `${i.id} · ${i.zona_reparto}`,
              page: "points" as Page,
            })),
          ...s.purchases
            .filter((i) => i.id.toLowerCase().includes(query.toLowerCase()))
            .map((i) => ({
              title: i.id,
              subtitle: `Compra · ${i.estado}`,
              page: "purchases" as Page,
            })),
          ...s.dispatches
            .filter((i) => i.id.toLowerCase().includes(query.toLowerCase()))
            .map((i) => ({
              title: i.id,
              subtitle: `Guía · ${i.estado}`,
              page: "tracking" as Page,
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
          className="brand"
          href="#"
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
          <span className="brand-tag">SUPPLY</span>
        </a>
        <div className="company-box">
          <div className="company-avatar">
            <Building2 size={19} />
          </div>
          <div>
            <small>ESPACIO DE TRABAJO</small>
            <select
              aria-label="Cambiar empresa"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setModal(null);
              }}
            >
              {companies.length ? (
                companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              ) : (
                <option value="cleanpro">CleanPro Servicios</option>
              )}
            </select>
          </div>
          <ChevronDown size={14} />
        </div>
        <button className="add-company" onClick={() => open("company")}>
          <Plus size={12} />
          Agregar empresa
        </button>
        <div className="nav-section-label">OPERACIÓN</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "selected" : ""}`}
              onClick={() => go(id as Page)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "inventory" &&
                s &&
                s.items.some((i) => i.stock_actual < i.stock_minimo) && (
                  <span className="nav-counter">
                    {
                      s.items.filter((i) => i.stock_actual < i.stock_minimo)
                        .length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="nav-section-label intelligence-label">INTELIGENCIA</div>
        <nav>
          {intelligence.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "selected" : ""}`}
              onClick={() => go(id as Page)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "assistant" && <span className="new-label">NUEVO</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-insight">
            <span className="insight-icon">
              <Leaf size={18} />
            </span>
            <h4>
              Menos recorridos.
              <br />
              Más posibilidades.
            </h4>
            <p>Conecta cada decisión con una operación más eficiente.</p>
            <button onClick={() => go("routes")}>
              Explorar escenarios <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "selected" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={18} />
            <span>Configuración</span>
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {s?.enterprise?.profile.name
                ?.split(" ")
                .slice(0, 2)
                .map((x) => x[0])
                .join("")
                .toUpperCase() || "NX"}
            </span>
            <div>
              <strong>{s?.enterprise?.profile.name || "Mi perfil"}</strong>
              <span>
                {s?.enterprise?.profile.position || "Vista por perfil"}
              </span>
            </div>
            <select
              aria-label="Perfil de alertas"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {["Gerencia", "Logística", "Bodega", "Compras"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
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
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>Buscar en tu operación</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="btn secondary small"
              disabled={!s}
              onClick={() => setReports(true)}
            >
              Reportes
            </button>
            {!isDemo && (
              <button
                className="text-button"
                onClick={() => authClient?.auth.signOut()}
              >
                Salir
              </button>
            )}
            <span className="top-divider" />
            <button
              className="icon-button notification"
              aria-label={`${pending.length} alertas pendientes`}
              onClick={() => go("alerts")}
            >
              <Bell size={18} />
              {pending.length > 0 && <i />}
            </button>
            <button
              className="icon-button"
              aria-label="Ayuda"
              onClick={() => go("assistant")}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main>
          {error ? (
            <div className="load-error">
              <TriangleAlert size={32} />
              <h1>No pudimos abrir tu espacio</h1>
              <p>{error}</p>
              <button
                className="btn primary"
                onClick={() => setRefreshKey((v) => v + 1)}
              >
                Reintentar
              </button>
            </div>
          ) : needsCompany ? (
            <section className="card padded onboarding">
              <h1>Conecta tu primera empresa.</h1>
              <p>
                Crea un espacio vacío para empezar a registrar o importar tus
                datos.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  try {
                    const data = await request("companies", {
                      name: f.get("name"),
                    });
                    setCompany(data.company.id);
                    setRefreshKey((v) => v + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <input
                  name="name"
                  aria-label="Nombre de empresa"
                  placeholder="Nombre de tu empresa"
                  maxLength={100}
                  required
                />
                <button className="btn primary" disabled={busy}>
                  Crear espacio
                </button>
              </form>
            </section>
          ) : !s ? (
            <div className="loading">
              <span className="brand-symbol">
                <i />
                <i />
                <i />
              </span>
              <LoaderCircle className="spin" size={23} />
              <p>Conectando tu operación…</p>
            </div>
          ) : (
            <>
              <div className="context-line">
                <span>
                  <span className="live-dot" />
                  {isDemo ? "Demostración local" : "Espacio conectado"}{" "}
                  <span className="context-separator">/</span>
                  {s.company.name}
                </span>
                <Badge tone={s.company.demo ? "sand" : "green"}>
                  {s.company.demo
                    ? "Datos sintéticos de demostración"
                    : isDemo
                      ? "Datos locales del navegador"
                      : "Mi empresa"}
                </Badge>
              </div>
              {page === "dashboard" && (
                <Dashboard s={s} go={go} open={open} role={role} />
              )}
              {page === "routes" && (
                <LogisticsUI
                  key={company}
                  s={s}
                  request={request}
                  action={action}
                  open={open}
                  busy={busy}
                />
              )}
              {page === "inventory" && (
                <Inventory s={s} open={open} exportData={exportData} />
              )}
              {page === "purchases" && (
                <Purchases s={s} open={open} action={action} busy={busy} />
              )}
              {page === "tracking" && (
                <Tracking s={s} open={open} exportData={exportData} />
              )}
              {page === "demand" && <Demand key={company} s={s} open={open} />}
              {page === "suppliers" && <Suppliers s={s} open={open} />}
              {page === "fleet" && <Fleet s={s} open={open} />}
              {page === "points" && <Locations s={s} open={open} />}
              {page === "assistant" && (
                <Assistant
                  key={company}
                  request={request}
                  company={s.company.name}
                />
              )}
              {page === "alerts" && (
                <Alerts
                  s={s}
                  role={role}
                  setRole={setRole}
                  action={action}
                  go={go}
                  busy={busy}
                />
              )}
              {page === "settings" && (
                <>
                  <Settings key={company} s={s} action={action} busy={busy} />
                  <SettingsExtras
                    company={company}
                    role={workspaceRole}
                    reload={() => setRefreshKey((v) => v + 1)}
                  />
                </>
              )}
              <footer className="footer">
                <span>
                  <span className="footer-logo">nexo.</span>Cada movimiento
                  cuenta.
                </span>
                <span>
                  <Database size={11} />
                  {isDemo
                    ? "Guardado en este navegador"
                    : "Guardado en Supabase"}{" "}
                  ·{" "}
                  {new Date(s.updatedAt).toLocaleTimeString(
                    s.enterprise?.profile.locale || "es-EC",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone:
                        s.enterprise?.profile.timezone || "America/Guayaquil",
                    },
                  )}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal &&
        s &&
        (enterpriseModalTypes.includes(modal.type) ? (
          <EnterpriseModal
            key={`${company}:${modal.type}:${modal.data?.id || "new"}`}
            modal={modal}
            s={s}
            close={() => setModal(null)}
            action={action}
            busy={busy}
            open={open}
          />
        ) : (
          <ModalView
            key={`${company}:${modal.type}:${modal.data?.id || "new"}`}
            modal={modal}
            s={s}
            close={() => setModal(null)}
            action={action}
            request={request}
            company={company}
            busy={busy}
            notify={notify}
            createCompany={async (name) => {
              try {
                const data = await request("companies", { name });
                setCompanies((c) => [...c, { id: data.company.id, name }]);
                setCompany(data.company.id);
                setModal(null);
                go("dashboard");
                notify("Empresa creada. Ya puedes agregar tus datos.");
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          />
        ))}
      {searchOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSearchOpen(false)
          }
        >
          <div className="search-modal">
            <div className="search-modal-input">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Busca un insumo, cliente, guía o solicitud…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="Cerrar búsqueda"
                onClick={() => setSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="search-results">
              {!query ? (
                <p>Encuentra tus registros por nombre o código.</p>
              ) : matches.length ? (
                matches.slice(0, 12).map((m, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      go(m.page);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>
                      <strong>{m.title}</strong>
                      <small>{m.subtitle}</small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))
              ) : (
                <p>No encontramos registros para “{query}”.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {reports && s && (
        <ReportDialog s={s} page={page} close={() => setReports(false)} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
