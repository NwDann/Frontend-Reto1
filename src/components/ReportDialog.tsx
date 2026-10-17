import { useState } from "react";
import { X, Download } from "lucide-react";
import type { State } from "../lib/model";
import { REPORTS } from "../services/report-data";
import type { ReportType } from "../services/report-data";
export default function ReportDialog({
  s,
  page,
  close,
}: {
  s: State;
  page: string;
  close: () => void;
}) {
  const [type, setType] = useState<ReportType>(
      (page in REPORTS ? page : "summary") as ReportType,
    ),
    [format, setFormat] = useState<"xlsx" | "pdf" | "csv" | "json">("xlsx"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}
    >
      <section
        className="modal-box report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="report-title">Exportar reporte</h2>
            <p>{s.company.name} · Datos actuales del espacio</p>
          </div>
          <button className="icon-button" aria-label="Cerrar" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <form
          className="modal-body"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { exportReport } = await import("../services/reports");
              await exportReport(s, type, format);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="form-field">
            Contenido
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
            >
              {Object.entries(REPORTS).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Formato
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="xlsx">
                Excel (.xlsx) · hojas, filtros y cifras numéricas
              </option>
              <option value="pdf">PDF (.pdf) · tablas paginadas</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </label>
          <p className="hint">
            Las exportaciones respetan las unidades registradas e identifican
            los datos sintéticos. El plan completo conserva además su descarga
            JSON desde sus detalles.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button autoFocus className="btn primary" disabled={busy}>
            <Download size={16} />
            {busy ? "Generando archivo…" : "Descargar reporte"}
          </button>
        </form>
      </section>
    </div>
  );
}
