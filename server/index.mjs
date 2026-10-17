import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function permittedRoute(method, pathname) {
  const resource =
    "/api/(?:insumos|puntos-servicio|personal|rutas|despachos|contratos)";
  if (
    method === "GET" &&
    [
      "/api/health",
      "/api/insumos/criticos-y-proyeccion",
      "/api/personal/validar-acreditacion",
      "/api/kpis/resumen",
    ].includes(pathname)
  )
    return true;
  if (method === "POST" && pathname === "/api/inventario/calcular-sugerido")
    return true;
  if (
    method === "PATCH" &&
    /^\/api\/(?:rutas\/\d+\/estado|despachos\/\d+\/apurar-produccion)$/.test(
      pathname,
    )
  )
    return true;
  if (new RegExp("^" + resource + "$").test(pathname))
    return ["GET", "POST"].includes(method);
  if (new RegExp("^" + resource + "/\\d+$").test(pathname))
    return ["GET", "PATCH", "DELETE"].includes(method);
  return false;
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
export function createApp({
  upstream = process.env.API_UPSTREAM_URL ||
    "https://backend-reto1-log-stica-env-os-olive.vercel.app",
  fetcher = fetch,
  root = projectRoot,
} = {}) {
  const origin = new URL(upstream);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password
  )
    throw Error("API_UPSTREAM_URL debe ser una URL HTTP(S) sin credenciales.");
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (!permittedRoute(req.method, url.pathname)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ detail: "Ruta no publicada por este proxy." }),
          );
          return;
        }
        let body;
        if (req.method === "POST" || req.method === "PATCH") {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) {
              res.writeHead(413);
              res.end();
              return;
            }
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        const targetPath =
          url.pathname === "/api/health" ? "/health" : url.pathname;
        const target = new URL(targetPath + url.search, origin.origin);
        const response = await fetcher(target, {
          method: req.method,
          headers: {
            Accept: "application/json",
            ...(body?.length ? { "Content-Type": "application/json" } : {}),
          },
          ...(body?.length ? { body } : {}),
          signal: AbortSignal.timeout(30000),
          redirect: "manual",
        });
        res.writeHead(response.status, {
          "Content-Type":
            response.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        });
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const publicRoot = path.join(root, "dist"),
        file = path.resolve(publicRoot, "." + decodeURIComponent(url.pathname));
      if (file !== publicRoot && !file.startsWith(publicRoot + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let target = file;
      try {
        if (!(await stat(target)).isFile())
          target = path.join(publicRoot, "index.html");
      } catch {
        if (path.extname(url.pathname)) {
          res.writeHead(404);
          res.end();
          return;
        }
        target = path.join(publicRoot, "index.html");
      }
      const data = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": target.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          detail:
            "No se pudo consultar el backend o servir la aplicación. Comprueba la URL y que exista dist/.",
        }),
      );
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  createApp().listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || "127.0.0.1",
    () => console.log("Optilogic: servidor estático y proxy iniciados."),
  );
