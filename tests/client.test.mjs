import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient } from "../src/services/client.ts";
import { loadSnapshot } from "../src/services/load.ts";
import { snapshot } from "./fixtures.mjs";

test("Client sends exact FastAPI paths, JSON bodies and no synthetic owner/company credentials", async () => {
  const calls = [],
    api = new ApiClient("https://example.invalid/", async (url, options) => {
      calls.push({ url, options });
      return Response.json({ ok: true });
    });
  await api.create("despachos", {
    punto_servicio_id: 1,
    descontar_stock: true,
    detalles: [{ insumo_id: 2, cantidad_solicitada: 3 }],
  });
  await api.routeStatus(5, {
    estado: "En Tránsito",
    tiene_adenda: false,
    notas_imprevisto: null,
  });
  await api.urgent(4);
  assert.equal(calls[0].url, "https://example.invalid/api/despachos");
  assert.equal(JSON.parse(calls[0].options.body).descontar_stock, true);
  assert.equal(calls[1].url, "https://example.invalid/api/rutas/5/estado");
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    estado: "En Tránsito",
    tiene_adenda: false,
    notas_imprevisto: null,
  });
  assert.equal(
    calls[2].url,
    "https://example.invalid/api/despachos/4/apurar-produccion",
  );
  assert.equal(calls[0].options.headers.Authorization, undefined);
});
test("Protected Vercel deployment and validation failures are explicit", async () => {
  const protectedApi = new ApiClient(
    "https://example.invalid",
    async () =>
      new Response("<html>Vercel Authentication Required</html>", {
        status: 401,
      }),
  );
  await assert.rejects(protectedApi.health(), /Vercel.*401/);
  const invalid = new ApiClient("https://example.invalid", async () =>
    Response.json(
      {
        detail: [
          {
            loc: ["body", "detalles", 0, "cantidad_solicitada"],
            msg: "must be positive",
          },
        ],
      },
      { status: 422 },
    ),
  );
  await assert.rejects(
    invalid.create("despachos", {}),
    /detalles.0.cantidad_solicitada/,
  );
});
test("Mutations do not retry after network failure and report an ambiguous result", async () => {
  let count = 0;
  const api = new ApiClient("https://example.invalid", async () => {
    count++;
    throw Error("reset");
  });
  await assert.rejects(
    api.create("despachos", {}),
    (e) => e.ambiguous && /antes de repetir/.test(e.message),
  );
  assert.equal(count, 1);
});
test("Absolute and local proxy base URLs resolve resources and health correctly", async () => {
  const urls = [],
    fetcher = async (url) => {
      urls.push(url);
      return Response.json({ status: "ok" });
    };
  await new ApiClient("https://example.invalid/api", fetcher).health();
  await new ApiClient("/api", fetcher).health();
  await new ApiClient("/api", fetcher).call("kpis/resumen");
  assert.deepEqual(urls, [
    "https://example.invalid/health",
    "/api/health",
    "/api/kpis/resumen",
  ]);
});
test("Loading preserves failed-source errors and never converts them into empty or synthetic records", async () => {
  const s = snapshot(),
    map = {
      insumos: s.items,
      "puntos-servicio": s.points,
      personal: s.staff,
      rutas: s.routes,
      despachos: s.dispatches,
      contratos: s.contracts,
      "insumos/criticos-y-proyeccion": [],
      "kpis/resumen": s.kpis,
    };
  const api = new ApiClient("https://example.invalid", async (url) => {
    const path = url.split("/api/")[1];
    return path === "insumos"
      ? Response.json({ detail: "offline" }, { status: 503 })
      : Response.json(map[path]);
  });
  const data = await loadSnapshot(api);
  assert.equal(data.items, undefined);
  assert.match(data.errors.items, /offline/);
  assert.equal(data.routes.length, 1);
  assert.equal(data.loadedAt.items, undefined);
});
test("Malformed numeric record is rejected rather than valued as zero", async () => {
  const api = new ApiClient("https://example.invalid", async () =>
    Response.json([{ id: 1, nombre: "Sin stock" }]),
  );
  await assert.rejects(api.list("insumos"), /valor numérico/);
});

test("A 200 HTML sign-in page from a Vercel redirect is classified as protected", async () => {
  const api = new ApiClient(
    "https://example.invalid",
    async () =>
      new Response("<html><title>Login - Vercel</title></html>", {
        status: 200,
      }),
  );
  await assert.rejects(
    api.health(),
    (e) => e.status === 401 && /Vercel/.test(e.message),
  );
});
