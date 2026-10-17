export const PUBLIC_API =
  "https://backend-reto1-log-stica-env-os-olive.vercel.app";
export const REQUESTED_API =
  "https://backend-reto1-log-stica-env-git-94d7c4-dannys-projects-b34bf7fa.vercel.app";
export const config = {
  apiBase: (import.meta.env.VITE_API_BASE_URL || PUBLIC_API).replace(/\/$/, ""),
  mapProvider:
    import.meta.env.VITE_MAP_PROVIDER === "google" ? "google" : "osm",
  googleKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  googleMapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
  osrmBase: (
    import.meta.env.VITE_OSRM_BASE_URL || "https://router.project-osrm.org"
  ).replace(/\/$/, ""),
  originLat: import.meta.env.VITE_ORIGIN_LAT || "",
  originLng: import.meta.env.VITE_ORIGIN_LNG || "",
  originName: import.meta.env.VITE_ORIGIN_NAME || "Origen de planificación",
};
