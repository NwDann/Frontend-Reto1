import { useEffect, useState } from "react";
import { request } from "../services/api";
import { isDemo } from "../services/config";
import { authClient } from "../services/supabase";
import { CardTitle, Badge, Field } from "./ui";
export default function SettingsExtras({
  company,
  role,
  reload,
}: {
  company: string;
  role: string;
  reload: () => void;
}) {
  const [members, setMembers] = useState<any[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<any>(null);
  const admin = ["owner", "admin"].includes(role);
  const load = () => {
    if (admin)
      request(company, "members")
        .then(setMembers)
        .catch((e) => setStatus(e.message));
  };
  useEffect(load, [company, admin]);
  const perform = async (fn: () => Promise<any>) => {
    setStatus("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-extra-grid">
      <section className="card padded">
        <CardTitle
          title="Acceso y usuarios"
          sub="Los permisos de escritura se verifican en el servidor."
        />
        <Badge tone={isDemo ? "sand" : "blue"}>
          {isDemo ? "Demostración local" : `Rol: ${role}`}
        </Badge>
        {!isDemo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              perform(async () => {
                const { error } = await authClient!.auth.updateUser({
                  password: String(f.get("password")),
                });
                if (error) throw error;
                setStatus("Contraseña actualizada.");
              });
            }}
          >
            <Field
              label="Nueva contraseña"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
            <button disabled={busy} className="btn secondary">
              Cambiar contraseña
            </button>
          </form>
        )}
        {admin && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>USUARIO</th>
                    <th>ROL</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td>{m.email || m.user_id}</td>
                      <td>{m.role}</td>
                      <td>
                        {m.role !== "owner" &&
                          (role === "owner" || m.role !== "admin") &&
                          !isDemo && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                perform(async () => {
                                  await request(company, "members/remove", {
                                    userId: m.user_id,
                                  });
                                  load();
                                })
                              }
                            >
                              Retirar acceso
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isDemo && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  perform(async () => {
                    await request(
                      company,
                      "members/save",
                      Object.fromEntries(f),
                    );
                    load();
                    setStatus("Acceso actualizado.");
                  });
                }}
              >
                <Field
                  label="Correo de una cuenta ya registrada"
                  name="email"
                  type="email"
                />
                <label className="form-field">
                  Rol
                  <select name="role">
                    {[
                      "admin",
                      "gerencia",
                      "logistica",
                      "bodega",
                      "compras",
                      "consulta",
                    ]
                      .filter((r) => role === "owner" || r !== "admin")
                      .map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                  </select>
                </label>
                <button className="btn primary" disabled={busy}>
                  Agregar / actualizar acceso
                </button>
                <p className="hint">
                  La persona debe crear y confirmar su cuenta primero. Este
                  formulario no envía invitaciones por correo.
                </p>
              </form>
            )}
          </>
        )}
        {!admin && (
          <p className="hint">
            Solicita al administrador cambios en los accesos del equipo.
          </p>
        )}
      </section>
      <section className="card padded">
        <CardTitle
          title="API del reto"
          sub="Conector de lectura e importación inicial a este espacio."
        />
        <p>
          Conserva el stock y las unidades que devuelve el backend. Las
          funciones ampliadas de Nexo se guardan en Supabase mediante el
          servidor complementario.
        </p>
        <button
          className="btn secondary"
          disabled={busy || isDemo}
          onClick={() =>
            perform(async () => {
              setPreview(await request(company, "legacy/preview"));
              setStatus(
                "Conexión comprobada. Revisa el resumen antes de importar.",
              );
            })
          }
        >
          Consultar datos disponibles
        </button>
        {preview && (
          <>
            <div className="derived-box">
              <span>
                Insumos<strong>{preview.items.length}</strong>
              </span>
              <span>
                Ubicaciones<strong>{preview.points.length}</strong>
              </span>
              <span>
                Personal<strong>{preview.staff.length}</strong>
              </span>
            </div>
            <p className="hint">
              Origen: {preview.source}. Se importan catálogo, saldos actuales,
              puntos y personal una sola vez en un espacio vacío. No se importan
              despachos ni rutas para evitar descontar existencias de nuevo. No
              hay sincronización automática.
            </p>
            {admin && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    await request(company, "legacy/import", {
                      fingerprint: preview.fingerprint,
                    });
                    setPreview(null);
                    setStatus("Datos importados.");
                    reload();
                  })
                }
              >
                Importar estos datos al espacio vacío
              </button>
            )}
          </>
        )}
        {isDemo && (
          <p className="hint">
            Activa el modo conectado para consultar o importar la API.
          </p>
        )}
        <p className="hint">
          La API publicada no declara autenticación en OpenAPI. El acceso de la
          aplicación se controla con Supabase y roles del espacio.
        </p>
      </section>
      {status && (
        <p className="api-status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
