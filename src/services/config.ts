export const config = {
  mode: import.meta.env.VITE_DATA_MODE || "demo",
  apiBase: (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, ""),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  logisticsUrl: (
    import.meta.env.VITE_LOGISTICS_API_URL ||
    "https://backend-reto1-log-stica-env-os-olive.vercel.app"
  ).replace(/\/$/, ""),
};
if (!["demo", "connected"].includes(config.mode))
  throw Error("VITE_DATA_MODE debe ser demo o connected.");
export const isDemo = config.mode === "demo";
