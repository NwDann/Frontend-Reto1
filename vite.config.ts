import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": {
          target:
            env.API_UPSTREAM_URL ||
            "https://backend-reto1-log-stica-env-os-olive.vercel.app",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => (path === "/api/health" ? "/health" : path),
        },
      },
    },
    build: { target: "es2022", sourcemap: false },
  };
});
