import { useState } from "react";
import type { Snapshot, AppPage } from "../lib/models";
import { operationalAlerts } from "../lib/insights";
import { SectionTitle, CardTitle, Badge, Empty } from "./ui";
export default function Alerts({
  s,
  go,
}: {
  s: Snapshot;
  go: (p: AppPage) => void;
}) {
  const [role, setRole] = useState("Todas"),
    alerts = operationalAlerts(s).filter(
      (a) => role === "Todas" || a.roles.includes(role),
    );
  return (
    <>
      <SectionTitle
        eyebrow="CENTRO DE ALERTAS"
        title="Atiende las señales de tus registros."
        text="Stock bajo, programación superada, contratos por validar y responsables de ruta."
      />
      <section className="card padded">
        <CardTitle title="Alertas por área">
          <select
            aria-label="Filtrar alertas por área"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {["Todas", "Gerencia", "Logística", "Bodega", "Compras"].map(
              (r) => (
                <option key={r}>{r}</option>
              ),
            )}
          </select>
        </CardTitle>
        {alerts.map((a) => (
          <button
            key={a.id}
            className="list-row live-alert-row"
            onClick={() => go(a.page as AppPage)}
          >
            <span>
              <strong>{a.title}</strong>
              <small>{a.detail}</small>
              <small>Áreas: {a.roles.join(", ")}</small>
            </span>
            <Badge tone={a.severity === "Crítica" ? "rose" : "sand"}>
              {a.severity}
            </Badge>
          </button>
        ))}
        {!alerts.length && (
          <Empty
            title="No hay alertas calculables para este filtro"
            text="Comprueba también los errores de conexión. Una fuente que no se pudo consultar no certifica ausencia de problemas."
          />
        )}
      </section>
      <p className="live-note">
        Los perfiles son filtros de consulta, no permisos. No se inventan
        alertas por vencimiento, diferencias físicas, seguros o mantenimiento:
        aún no se devuelve esos datos.
      </p>
    </>
  );
}
