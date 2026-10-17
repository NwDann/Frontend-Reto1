import test from "node:test";
import assert from "node:assert/strict";
import { legacyPreview, importLegacy } from "../server/legacy.mjs";
import { canAct, requireAction } from "../server/permissions.mjs";
import { initialState } from "../src/lib/model.ts";
import { upgradeState } from "../src/lib/logistics.ts";
import { createApp } from "../server/index.mjs";
const source = {
  insumos: [
    {
      id: 1,
      nombre: "Limpiador",
      categoria: "quimico",
      unidad_medida: "caneca",
      stock_actual: 6,
      stock_minimo: 2,
      precio_unitario: 20,
      peso_unitario_kg: 20,
      volumen_unitario_m3: 0.02,
    },
  ],
  "puntos-servicio": [
    {
      id: 1,
      nombre_cliente: "Cliente",
      latitud: -0.2,
      longitud: -78.5,
      contrato_validado: true,
    },
  ],
  personal: [
    {
      id: 1,
      nombre: "Ana",
      especialidad: "general",
      acreditado: true,
      disponible: true,
    },
  ],
};
test("Legacy connector reads documented endpoints and fingerprints the exact preview", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return Response.json(source[url.split("/").at(-1)]);
  };
  const p = await legacyPreview("https://example.invalid", fetcher);
  assert.deepEqual(
    calls.sort(),
    ["insumos", "personal", "puntos-servicio"]
      .map((x) => "https://example.invalid/api/" + x)
      .sort(),
  );
  assert.equal(p.fingerprint.length, 64);
  const state = importLegacy(
    upgradeState(initialState("id", "Mi empresa", false)),
    p,
  );
  assert.equal(state.items[0].stock_actual, 6);
  assert.equal(state.enterprise.balances[0].quantity, 6);
  assert.equal(state.enterprise.staff[0].accreditedUntil, "");
  assert.equal(state.dispatches.length, 0);
  assert.throws(() => importLegacy(state, p), /espacio vacío/);
});
test("Legacy failure is explicit and cannot create fake data", async () => {
  await assert.rejects(
    legacyPreview(
      "https://example.invalid",
      async () => new Response("offline", { status: 503 }),
    ),
    /503/,
  );
});
test("Roles distinguish reading from stock, buying and user administration", () => {
  assert.equal(canAct("consulta", "purchase.create"), false);
  assert.equal(canAct("compras", "purchase.create"), true);
  assert.equal(canAct("compras", "purchase.receive"), false);
  assert.equal(canAct("bodega", "purchase.receive"), true);
  assert.equal(canAct("logistica", "route.create"), true);
  assert.equal(canAct("gerencia", "finance.update"), true);
  assert.throws(() => requireAction("consulta", "item.create"), {
    status: 403,
  });
});
test("Server health is public, API requires authentication/config, and rejects other origins", async () => {
  const app = createApp();
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    assert.equal((await fetch(base + "/health")).status, 200);
    const api = await fetch(base + "/api/companies");
    assert.ok([401, 503].includes(api.status));
    const forbidden = await fetch(base + "/api/companies", {
      headers: { Origin: "https://untrusted.invalid" },
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await new Promise((r) => app.close(r));
  }
});
