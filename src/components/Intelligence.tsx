import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ArrowUpRight,
  Search,
  TriangleAlert,
  Check,
  CheckCheck,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { State, alerts } from "@/lib/model";
import {
  Page,
  Action,
  Requester,
  Badge,
  Empty,
  SectionTitle,
  CardTitle,
} from "./ui";
export function Alerts({
  s,
  role,
  setRole,
  action,
  go,
  busy,
}: {
  s: State;
  role: string;
  setRole: (r: string) => void;
  action: Action;
  go: (p: Page) => void;
  busy: boolean;
}) {
  const [show, setShow] = useState("pending"),
    all = alerts(s).filter((a) => a.roles.includes(role)),
    rows = all.filter(
      (a) =>
        show === "all" ||
        (show === "pending" && !s.reviewed.includes(a.id)) ||
        (show === "reviewed" && s.reviewed.includes(a.id)),
    );
  return (
    <>
      <SectionTitle
        eyebrow="SEÑALES QUE IMPORTAN"
        title="Atención donde hace falta."
        text="Stock, vencimientos y diferencias de entrega, filtrados para cada perfil."
      >
        <select
          className="compact-select"
          aria-label="Perfil de alertas"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {["Gerencia", "Logística", "Bodega", "Compras"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </SectionTitle>
      <div className="tabs">
        {[
          ["pending", "Por revisar"],
          ["reviewed", "Revisadas"],
          ["all", "Todas"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={show === v ? "active" : ""}
            onClick={() => setShow(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <section className="card alert-center">
        {rows.map((a) => (
          <div className="alert-row" key={a.id}>
            <span
              className={`attention-icon ${a.severity === "Crítica" ? "rose" : "sand"}`}
            >
              <TriangleAlert size={20} />
            </span>
            <div className="alert-content">
              <h3>
                {a.title}
                <Badge tone={a.severity === "Crítica" ? "rose" : "sand"}>
                  {a.severity}
                </Badge>
              </h3>
              <p>{a.detail}</p>
              <small>{a.roles.join(" · ")}</small>
            </div>
            <div className="alert-buttons">
              <button
                className="text-button"
                onClick={() => go(a.module as Page)}
              >
                Ver módulo <ArrowUpRight size={14} />
              </button>
              {!s.reviewed.includes(a.id) ? (
                <button
                  className="btn small secondary"
                  disabled={busy}
                  onClick={() => action("alert.review", { id: a.id })}
                >
                  <Check size={14} />
                  Marcar revisada
                </button>
              ) : (
                <span className="reviewed">
                  <CheckCheck size={14} />
                  Revisada
                </span>
              )}
            </div>
          </div>
        ))}
        {!rows.length && (
          <Empty
            title="No hay alertas en esta vista"
            text="Los cambios de inventario y las recepciones actualizan estas señales."
          />
        )}
      </section>
      <p className="method-note">
        El filtro distribuye alertas por área. Los permisos de usuario proceden
        del rol asignado al espacio. Marcar una alerta como revisada no corrige
        su causa.
      </p>
    </>
  );
}
type Message = { role: string; text: string; sources?: string[] };
export function Assistant({
  request,
  company,
}: {
  request: Requester;
  company: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [lastQuery, setLastQuery] = useState(""),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    setQuery("");
    setLastQuery(q);
    setError("");
    setMessages((m) =>
      m[m.length - 1]?.role === "user" && m[m.length - 1]?.text === q
        ? m
        : [...m, { role: "user", text: q }],
    );
    setLoading(true);
    try {
      const a = await request("assistant", { query: q });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: a.text, sources: a.sources },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(
    () =>
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    [messages, loading],
  );
  return (
    <>
      <SectionTitle
        eyebrow="TUS DATOS, MÁS CERCA"
        title="Pregúntale a tu operación."
        text={`Consulta los registros de ${company} y encuentra las referencias detrás de cada respuesta.`}
      />
      <section className="card assistant-card">
        <div className="assistant-top">
          <span className="assistant-logo">
            <Sparkles size={19} />
          </span>
          <div>
            <strong>Asistente Nexo</strong>
            <span>
              <span className="live-dot" />
              Conectado al espacio actual
            </span>
          </div>
          <Badge tone="gray">Consulta de datos</Badge>
        </div>
        <div className="chat-messages">
          {!messages.length ? (
            <div className="assistant-welcome">
              <span className="assistant-welcome-icon">
                <Sparkles size={33} />
              </span>
              <h2>
                Menos buscar.
                <br />
                Más resolver.
              </h2>
              <p>
                Insumos, guías, proveedores y decisiones.
                <br />
                Consulta también flota, clientes y sus contactos.
              </p>
              <div className="suggested-prompts">
                {[
                  "¿Qué insumos tienen stock crítico?",
                  "Muéstrame las diferencias en guías",
                  "¿Qué vehículos requieren mantenimiento?",
                  "¿Cuál es la demanda del Hospital del Norte?",
                ].map((q) => (
                  <button key={q} onClick={() => ask(q)}>
                    {q}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div className={`chat-message ${m.role}`} key={i}>
                {m.role === "assistant" && (
                  <span className="assistant-logo">
                    <Sparkles size={15} />
                  </span>
                )}
                <div>
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="chat-sources">
                      <small>REGISTROS CONSULTADOS</small>
                      {[...new Set(m.sources)].map((src) => (
                        <span key={src}>
                          <FileText size={11} />
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="chat-loading">
              <LoaderCircle className="spin" size={16} />
              Consultando registros…
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              <p>{error}</p>
              <button
                className="btn secondary small"
                type="button"
                disabled={loading}
                onClick={() => ask(lastQuery)}
              >
                Reintentar consulta
              </button>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(query);
          }}
        >
          <input
            aria-label="Pregunta para el asistente"
            placeholder="Pregunta por un insumo, una entrega o un proveedor…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={1500}
          />
          <button
            className="btn primary"
            type="submit"
            disabled={!query.trim() || loading}
            aria-label="Enviar pregunta"
          >
            <ArrowUpRight size={20} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Búsqueda guiada sobre datos guardados. No utiliza un modelo generativo
          ni consulta adjuntos sin estructurar.
        </p>
      </section>
    </>
  );
}
