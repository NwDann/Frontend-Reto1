import test from "node:test";
import assert from "node:assert/strict";
import { createApp, permittedRoute } from "../server/index.mjs";
test("Proxy only exposes documented resources and mutations", () => {
  assert.equal(permittedRoute("POST", "/api/despachos"), true);
  assert.equal(permittedRoute("PATCH", "/api/rutas/5/estado"), true);
  assert.equal(permittedRoute("GET", "/api/health"), true);
  assert.equal(permittedRoute("POST", "/api/action"), false);
  assert.equal(permittedRoute("GET", "/api/usuarios"), false);
  assert.equal(permittedRoute("POST", "/api/personal/1"), false);
});
test("Optional same-origin proxy forwards payload once to fixed upstream and preserves 401", async () => {
  const calls = [],
    app = createApp({
      upstream: "https://example.invalid",
      fetcher: async (url, options) => {
        calls.push({ url: String(url), options });
        return url.pathname === "/health"
          ? Response.json({ status: "ok" })
          : new Response("Vercel Authentication Required", {
              status: 401,
              headers: { "Content-Type": "text/html" },
            });
      },
    });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    const response = await fetch(base + "/api/despachos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ punto_servicio_id: 1, descontar_stock: true }),
    });
    assert.equal(response.status, 401);
    assert.equal(calls[0].url, "https://example.invalid/health");
    assert.equal(calls[1].url, "https://example.invalid/api/despachos");
    assert.equal(JSON.parse(calls[1].options.body).descontar_stock, true);
    assert.equal(calls.length, 2);
    assert.equal(
      (await fetch(base + "/api/action", { method: "POST" })).status,
      404,
    );
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});
