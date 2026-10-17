import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { authClient } from "../services/supabase";
import { isDemo } from "../services/config";
const AuthContext = createContext<{ session: Session | null; demo: boolean }>({
  session: null,
  demo: isDemo,
});
export const useAuth = () => useContext(AuthContext);
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(isDemo),
    [recovery, setRecovery] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (isDemo || !authClient) return;
    let alive = true;
    authClient.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          setReady(true);
          if (error) setError(error.message);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setReady(true);
        }
      });
    const { data } = authClient.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (!isDemo && !authClient)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Configura la conexión</h1>
          <p>
            Completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env y
            reinicia Vite. Para explorar sin credenciales, usa
            VITE_DATA_MODE=demo.
          </p>
        </div>
      </div>
    );
  if (!ready) return <div className="auth-screen">Comprobando sesión…</div>;
  if (recovery) return <PasswordRecovery done={() => setRecovery(false)} />;
  if (!isDemo && !session) return <AuthForm initialError={error} />;
  return (
    <AuthContext.Provider value={{ session, demo: isDemo }}>
      {children}
    </AuthContext.Provider>
  );
}
function AuthForm({ initialError }: { initialError: string }) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialError);
  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const f = new FormData(e.currentTarget),
            email = String(f.get("email")),
            password = String(f.get("password"));
          try {
            if (mode === "login") {
              const { error } = await authClient!.auth.signInWithPassword({
                email,
                password,
              });
              if (error) throw error;
            } else if (mode === "register") {
              const { data, error } = await authClient!.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin },
              });
              if (error) throw error;
              if (!data.session)
                setMessage("Revisa tu correo para confirmar la cuenta.");
            } else {
              const { error } = await authClient!.auth.resetPasswordForEmail(
                email,
                { redirectTo: location.origin },
              );
              if (error) throw error;
              setMessage(
                "Si la cuenta existe, recibirás un enlace de recuperación.",
              );
            }
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="auth-logo">nexo.</span>
        <p className="eyebrow">OPTILOGIC · TU OPERACIÓN CONECTADA</p>
        <h1>
          {mode === "login"
            ? "Bienvenido de nuevo."
            : mode === "register"
              ? "Crea tu cuenta."
              : "Recupera tu acceso."}
        </h1>
        <label className="form-field">
          Correo electrónico
          <input autoComplete="email" type="email" name="email" required />
        </label>
        {mode !== "reset" && (
          <label className="form-field">
            Contraseña
            <input
              type="password"
              name="password"
              minLength={8}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        )}
        <button disabled={busy} className="btn primary">
          {busy
            ? "Procesando…"
            : mode === "login"
              ? "Iniciar sesión"
              : mode === "register"
                ? "Crear cuenta"
                : "Enviar enlace"}
        </button>
        {message && (
          <p className="api-status" role="status">
            {message}
          </p>
        )}
        <div className="row-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setMessage("");
            }}
          >
            {mode === "register" ? "Ya tengo cuenta" : "Crear cuenta"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setMessage("");
            }}
          >
            {mode === "reset" ? "Volver al inicio" : "Olvidé mi contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
function PasswordRecovery({ done }: { done: () => void }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-screen">
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const { error } = await authClient!.auth.updateUser({
            password: String(f.get("password")),
          });
          setBusy(false);
          if (error) setMessage(error.message);
          else done();
        }}
      >
        <h1>Elige una contraseña nueva</h1>
        <label className="form-field">
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button className="btn primary" disabled={busy}>
          Guardar contraseña
        </button>
        {message && <p role="alert">{message}</p>}
      </form>
    </div>
  );
}
