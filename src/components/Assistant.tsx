import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowUpRight, FileText } from "lucide-react";
import type { Snapshot, Modal, AppPage } from "../lib/models";
import { answerRecords } from "../lib/assistant";
import type { Answer } from "../lib/assistant";
import { SectionTitle, Badge } from "./ui";
export default function Assistant({
  s,
  open,
  go,
}: {
  s: Snapshot;
  open: (m: Modal) => void;
  go: (p: AppPage) => void;
}) {
  const [q, setQ] = useState(""),
    [messages, setMessages] = useState<
      { question: string; answer: Answer; at: string }[]
    >([]),
    bottom = useRef<HTMLDivElement>(null);
  const ask = (question: string) => {
    if (!question.trim()) return;
    setMessages((xs) => [
      ...xs,
      {
        question,
        answer: answerRecords(s, question),
        at: new Date().toISOString(),
      },
    ]);
    setQ("");
  };
  useEffect(
    () =>
      bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    [messages],
  );
  return (
    <>
      <SectionTitle
        eyebrow="ASISTENTE NEXO"
        title="Pregunta sobre los registros que sí existen."
        text="Consulta datos del sistema y abre la referencia que respalda la respuesta."
      />
      <section className="card assistant-card">
        <div className="assistant-top">
          <span className="assistant-logo">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>Nexo · búsqueda sobre Fastsistema</strong>
            <span>Fuentes: catálogo, puntos, despachos, rutas y personal</span>
          </div>
          <Badge tone="blue">Consulta estructurada</Badge>
        </div>
        <div className="chat-messages">
          {!messages.length ? (
            <div className="assistant-welcome">
              <Sparkles size={35} />
              <h2>Tu operación, a una pregunta.</h2>
              <div className="suggested-prompts">
                {[
                  "¿Qué insumos están bajo mínimo?",
                  "Muéstrame los despachos pendientes",
                  "¿Qué personal está acreditado?",
                  "Explícame los indicadores OTIF y mermas",
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
              <div key={i}>
                <div className="chat-message user">
                  <p>{m.question}</p>
                </div>
                <div className="chat-message assistant">
                  <span className="assistant-logo">
                    <Sparkles size={15} />
                  </span>
                  <div>
                    <p style={{ whiteSpace: "pre-line" }}>{m.answer.text}</p>
                    <div className="chat-sources">
                      {m.answer.sources.map((src) => (
                        <button
                          type="button"
                          key={src.label}
                          className="text-button"
                          onClick={() =>
                            src.resource === "kpis"
                              ? go("dashboard")
                              : src.resource === "despachos"
                                ? open({ kind: "dispatch-detail", id: src.id! })
                                : src.resource === "rutas"
                                  ? open({ kind: "route-detail", id: src.id! })
                                  : go(
                                      src.resource === "insumos"
                                        ? "inventory"
                                        : src.resource === "personal"
                                          ? "fleet"
                                          : "points",
                                    )
                          }
                        >
                          <FileText size={12} />
                          {src.label}
                        </button>
                      ))}
                    </div>
                    <small>
                      Respuesta basada en la consulta de datos disponible al
                      preguntar.
                    </small>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <input
            aria-label="Pregunta a Nexo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pregunta por un insumo, despacho o ruta…"
            maxLength={1500}
          />
          <button
            className="btn primary"
            disabled={!q.trim()}
            aria-label="Consultar"
          >
            <ArrowUpRight size={18} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Búsqueda guiada, sin LLM. No inventa proveedores, contactos ni
          detalles que la sistema no proporciona.
        </p>
      </section>
    </>
  );
}
