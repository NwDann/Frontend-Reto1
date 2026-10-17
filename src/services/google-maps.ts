import { config } from "./config";
let pending: Promise<any> | undefined;
export function loadGoogleMaps(): Promise<any> {
  if (window.google?.maps?.importLibrary)
    return Promise.resolve(window.google.maps);
  if (pending) return pending;
  if (!config.googleKey)
    return Promise.reject(
      Error(
        "Configura VITE_GOOGLE_MAPS_API_KEY en .env para activar Google Maps.",
      ),
    );
  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "optilogic-google-maps";
    const fail = (message: string) => {
      delete window.__optilogicGoogleReady;
      script.remove();
      pending = undefined;
      reject(Error(message));
    };
    const timer = setTimeout(
      () =>
        fail(
          "Google Maps no respondió. Revisa la conexión, la clave y la facturación.",
        ),
      20000,
    );
    window.__optilogicGoogleReady = () => {
      clearTimeout(timer);
      delete window.__optilogicGoogleReady;
      resolve(window.google.maps);
    };
    window.gm_authFailure = () => {
      clearTimeout(timer);
      fail(
        "Google Maps rechazó la clave. Revisa API habilitada, facturación y dominios autorizados.",
      );
      window.dispatchEvent(new CustomEvent("optilogic-map-auth-error"));
    };
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      fail("No se pudo descargar Google Maps.");
    };
    script.src =
      "https://maps.googleapis.com/maps/api/js?" +
      new URLSearchParams({
        key: config.googleKey,
        v: "weekly",
        loading: "async",
        libraries: "maps,marker",
        callback: "__optilogicGoogleReady",
        language: "es",
      });
    document.head.append(script);
  });
  return pending;
}
