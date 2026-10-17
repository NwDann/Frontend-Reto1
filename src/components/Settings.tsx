import { useState } from "react";
import { Check, Database, KeyRound } from "lucide-react";
import type { Preferences, Snapshot } from "../lib/models";
import { validCoords, dateTime } from "../lib/format";
import { config } from "../services/config";
import { api } from "../services/api";
import { SectionTitle, CardTitle, Badge, Field } from "./ui";
import { LABELS } from "../lib/models";
import LiveMap, { CoordinateFields } from "./LiveMap";
export default function Settings({
  s,
  prefs,
  setPrefs,
}: {
  s: Snapshot;
  prefs: Preferences;
  setPrefs: (p: Preferences) => void;
}) {
  const [origin, setOrigin] = useState(prefs.origin),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [testing, setTesting] = useState(false);
  return (
    <>
      <SectionTitle
        eyebrow="PREFERENCIAS DE OPERACIÓN"
        title="Mapa, origen y zona horaria."
        text="Define el punto de partida de tus rutas, el tipo de mapa y cómo se muestran fechas y costos. Los datos de inventario y despachos se actualizan en vivo."
      />
      <div className="live-two-col">
        <section className="card padded">
          <CardTitle title="Estado de la información" icon={Database} />
          <Badge tone="blue">Conexión activa</Badge>
          <div className="row-actions">
            <button
              className="btn secondary"
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setError("");
                setStatus("");
                try {
                  await api.health();
                  setStatus("Conexión correcta. Los datos están disponibles.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? "Comprobando…" : "Probar conexión"}
            </button>
          </div>
          <p className="live-note">
            Si algo no carga, usa el botón de actualizar en la barra superior o
            contacta al administrador del sistema.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ÁREA</th>
                  <th>ÚLTIMA ACTUALIZACIÓN</th>
                  <th>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((key) => (
                  <tr key={key}>
                    <td>{LABELS[key]}</td>
                    <td>{dateTime(s.loadedAt[key], prefs.timezone)}</td>
                    <td>{s.errors[key] || "Disponible"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {status && (
            <p className="api-status" role="status">
              {status}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="card padded">
          <CardTitle
            title="Preferencias de este navegador"
            sub="Se guardan localmente; no modifican puntos ni contratos del servicio."
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                budget = Number(f.get("inventoryBudget")),
                margin = Number(f.get("targetMargin"));
              if (
                (origin && !validCoords(origin.lat, origin.lng)) ||
                !Number.isFinite(budget) ||
                budget < 0 ||
                !Number.isFinite(margin) ||
                margin < 0 ||
                margin >= 100
              ) {
                setError("Revisa origen, presupuesto y margen.");
                return;
              }
              setPrefs({
                origin,
                mapProvider:
                  f.get("mapProvider") === "google" ? "google" : "osm",
                timezone: String(f.get("timezone")),
                inventoryBudget: budget > 0 ? budget : null,
                targetMargin: margin,
              });
              setError("");
              setStatus("Preferencias guardadas en este navegador.");
            }}
          >
            <label className="form-field">
              Mapa
              <select name="mapProvider" defaultValue={prefs.mapProvider}>
                <option value="osm">OpenStreetMap · no requiere clave</option>
                <option value="google">
                  Google Maps · requiere clave configurada
                </option>
              </select>
            </label>
            <label className="form-field">
              Zona horaria
              <select name="timezone" defaultValue={prefs.timezone}>
                <option value="America/Guayaquil">
                  Ecuador continental · UTC−5
                </option>
                <option value="Pacific/Galapagos">Galápagos · UTC−6</option>
              </select>
            </label>
            <Field
              label="Presupuesto de inventario (USD; 0 = sin configurar)"
              name="inventoryBudget"
              type="number"
              min="0"
              step="0.01"
              value={prefs.inventoryBudget ?? 0}
            />
            <Field
              label="Margen objetivo de cotización (%)"
              name="targetMargin"
              type="number"
              min="0"
              max="99.99"
              step="0.01"
              value={prefs.targetMargin}
            />
            <label className="form-field">
              Nombre del origen / bodega
              <input
                value={origin?.name || ""}
                placeholder="Selecciona primero una ubicación"
                onChange={(e) =>
                  origin && setOrigin({ ...origin, name: e.target.value })
                }
              />
            </label>
            <CoordinateFields
              value={origin}
              onChange={(p) =>
                setOrigin({ ...p, name: origin?.name || "Bodega central" })
              }
            />
            <LiveMap
              points={[]}
              origin={origin}
              provider={prefs.mapProvider}
              onPick={(p) =>
                setOrigin({ ...p, name: origin?.name || "Bodega central" })
              }
            />
            <div className="row-actions">
              <button className="btn primary">
                Guardar preferencias <Check size={15} />
              </button>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setOrigin(null)}
              >
                Quitar origen local
              </button>
            </div>
          </form>
        </section>
      </div>
      <div className="live-two-col">
        <section className="card padded">
          <CardTitle
            title="Mapa (Google Maps opcional)"
            icon={KeyRound}
          />
          <Badge tone={config.googleKey ? "green" : "gray"}>
            {config.googleKey
              ? "Google Maps activo"
              : "Mapa abierto (OpenStreetMap)"}
          </Badge>
          <p>
            El mapa funciona sin clave con OpenStreetMap. Si tu administrador
            configura una clave de Google Maps, podrás elegir el mapa de Google
            en las preferencias de esta misma pantalla.
          </p>
          <p className="hint">
            Los tiempos de recorrido se estiman con el servicio de rutas
            configurado. Google Maps, cuando está activo, mejora la
            visualización y los enlaces de navegación; no aporta tráfico en
            vivo en esta versión.
          </p>
        </section>
        <section className="card padded">
          <CardTitle title="Acceso y permisos" />
          <p>
            Esta pantalla está pensada para el equipo de logística. No incluye
            inicio de sesión ni roles de usuario: quien abre la aplicación ve
            la misma información operativa.
          </p>
          <div className="live-note">
            Si en el futuro se habilitan cuentas por persona, el administrador
            del sistema será quien active usuarios y permisos. No es necesario
            configurar nada desde aquí.
          </div>
        </section>
      </div>
    </>
  );
}
