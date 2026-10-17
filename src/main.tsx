import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthProvider from "./auth/AuthProvider";
import "leaflet/dist/leaflet.css";
import "./index.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <div className="auth-screen">
          <div className="auth-card">
            <h1>No pudimos abrir esta vista</h1>
            <p>{this.state.error}</p>
            <button className="btn primary" onClick={() => location.reload()}>
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
