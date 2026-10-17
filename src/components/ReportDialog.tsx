import { useState } from "react";
import { X, Download } from "lucide-react";
import type { Snapshot } from "../lib/models";
import { REPORTS } from "../lib/report-data";
import type { ReportType } from "../lib/report-data";
import { config } from "../services/config";
export default function ReportDialog({
  s,
  page,
  close,
}: {
  s: Snapshot;
  page: string;
  close: () => void;
}) {
  const [type, setType] = useState<ReportType>(
      (page in REPORTS ? page : "dashboard") as ReportType,
    ),
    [format, setFormat] = useState<"xlsx" | "pdf" | "csv" | "json">("xlsx"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-overlay">
      <section
        className="live-modal modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <header className="modal-header">
          <h2 id="report-title">Exportar datos consultados</h2>
          <button
            className="icon-button"
            aria-label="Cerrar"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { exportSnapshot } = await import("../services/reports");
              await exportSnapshot(s, type, format, config.apiBase);
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
              {Object.entries(REPORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
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
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </label>
          <p className="live-note">
            Incluye las fechas de consulta y los errores de fuentes. Los
            borradores de compra y los análisis de rutas se exportan desde sus
            propias pantallas.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            <Download size={16} />
            {busy ? "Generando…" : "Descargar archivo"}
          </button>
        </form>
      </section>
    </div>
  );
}
