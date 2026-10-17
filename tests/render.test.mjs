import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
import { snapshot, preferences } from "./fixtures.mjs";
test("All eleven screens render with records and missing-source states, without browser side effects", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url)),
    server = await createServer({
      root,
      configFile: path.join(root, "vite.config.ts"),
      server: { middlewareMode: true, hmr: false },
      appType: "custom",
    });
  try {
    const modules = await Promise.all(
        [
          "Overview",
          "Inventory",
          "Tracking",
          "Planner",
          "Demand",
          "Assistant",
          "Settings",
          "Alerts",
          "Directory",
          "Purchases",
        ].map((name) =>
          server.ssrLoadModule("/src/components/" + name + ".tsx"),
        ),
      ),
      s = snapshot();
    const screens = [
      modules[0].default,
      modules[1].default,
      modules[2].default,
      modules[3].default,
      modules[4].default,
      modules[5].default,
      modules[6].default,
      modules[7].default,
      modules[8].Locations,
      modules[8].Fleet,
      modules[9].Purchases,
      modules[9].Suppliers,
    ];
    for (const data of [
      s,
      {
        errors: {
          items: "Sin conexión",
          points: "Sin conexión",
          routes: "Sin conexión",
          dispatches: "Sin conexión",
        },
        loadedAt: {},
      },
    ])
      for (const Component of screens) {
        const html = renderToString(
          React.createElement(Component, {
            s: data,
            prefs: preferences,
            setPrefs: () => {},
            open: () => {},
            go: () => {},
            perform: async () => false,
            drafts: [],
          }),
        );
        assert.ok(html.length > 150);
        assert.ok(!html.includes("NaN"));
      }
    const inventory = renderToString(
      React.createElement(modules[1].default, {
        s,
        prefs: preferences,
        open: () => {},
        perform: async () => false,
      }),
    );
    assert.ok(inventory.includes("Insumo de prueba"));
    assert.ok(inventory.includes("Preparar reposición"));
    const plannerHtml = renderToString(
      React.createElement(modules[3].default, {
        s,
        prefs: preferences,
        setPrefs: () => {},
        open: () => {},
      }),
    );
    assert.ok(
      plannerHtml.includes("Consultar distancias y recorridos viales con OSRM"),
    );
    assert.ok(
      plannerHtml
        .replace(/<!--.*?-->/g, "")
        .includes("Cargar mapa de OpenStreetMap"),
    );
    const roads = await server.ssrLoadModule("/src/services/roads.ts");
    const coords = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
    ];
    const calls = [];
    const matrix = await roads.roadMatrix(coords, async (url) => {
      calls.push(url);
      return Response.json({
        code: "Ok",
        distances: [
          [0, 1000],
          [1000, 0],
        ],
        durations: [
          [0, 60],
          [60, 0],
        ],
      });
    });
    assert.equal(matrix.distances[0][1], 1000);
    assert.ok(calls[0].includes("/0,0;1,0?"));
    await assert.rejects(
      roads.roadMatrix(coords, async () =>
        Response.json({
          code: "Ok",
          distances: [
            [0, null],
            [null, 0],
          ],
          durations: [
            [0, null],
            [null, 0],
          ],
        }),
      ),
      /matriz/,
    );
  } finally {
    await server.close();
  }
});
