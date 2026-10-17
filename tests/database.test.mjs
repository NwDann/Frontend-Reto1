import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { canAct } from "../server/permissions.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  buyer = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("PostgreSQL migration enforces atomic revisions, roles, isolation and audit", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email varchar,email_confirmed_at timestamptz);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610170001_nexo.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "insert into auth.users values($1,$2,now()),($3,$4,now()),($5,$6,now())",
      [
        owner,
        "owner@example.test",
        buyer,
        "buyer@example.test",
        other,
        "other@example.test",
      ],
    );
    const data = { company: { id: workspace, name: "Prueba", demo: false } };
    await db.query("select nexo_create_workspace($1,$2,$3,$4)", [
      workspace,
      owner,
      "Prueba",
      data,
    ]);
    await db.query("select nexo_set_member($1,$2,$3,$4)", [
      workspace,
      owner,
      buyer,
      "compras",
    ]);
    let result = await db.query("select nexo_commit($1,$2,0,$3,$4) as ok", [
      workspace,
      buyer,
      data,
      "purchase.create",
    ]);
    assert.equal(result.rows[0].ok, true);
    result = await db.query("select nexo_commit($1,$2,0,$3,$4) as ok", [
      workspace,
      buyer,
      data,
      "purchase.create",
    ]);
    assert.equal(result.rows[0].ok, false);
    await assert.rejects(
      db.query("select nexo_commit($1,$2,1,$3,$4)", [
        workspace,
        other,
        data,
        "purchase.create",
      ]),
      /Access denied/,
    );
    await assert.rejects(
      db.query("select nexo_commit($1,$2,1,$3,$4)", [
        workspace,
        buyer,
        data,
        "dispatch.receive",
      ]),
      /Action denied/,
    );
    await assert.rejects(
      db.query("select nexo_set_member($1,$2,$3,$4)", [
        workspace,
        buyer,
        owner,
        "consulta",
      ]),
      /Access denied/,
    );
    await assert.rejects(
      db.query("select nexo_set_member($1,$2,$3,$4)", [
        workspace,
        owner,
        owner,
        null,
      ]),
      /Owner\/self/,
    );
    const count = await db.query(
      "select count(*)::int as n from nexo_audit where action='purchase.create'",
    );
    assert.equal(count.rows[0].n, 1);
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select data from public.nexo_workspaces"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select nexo_commit($1,$2,1,$3,$4)", [
        workspace,
        owner,
        data,
        "item.create",
      ]),
      /permission denied/,
    );
    await db.exec("reset role");
    for (const role of [
      "gerencia",
      "logistica",
      "bodega",
      "compras",
      "consulta",
    ]) {
      await db.query("select nexo_set_member($1,$2,$3,$4)", [
        workspace,
        owner,
        buyer,
        role,
      ]);
      for (const action of [
        "item.create",
        "purchase.create",
        "purchase.receive",
        "dispatch.receive",
        "route.create",
        "finance.update",
        "profile.update",
        "alert.review",
        "legacy.import",
      ]) {
        const row = await db.query(
          "select revision from nexo_workspaces where id=$1",
          [workspace],
        );
        const revision = row.rows[0].revision;
        if (canAct(role, action)) {
          const r = await db.query("select nexo_commit($1,$2,$3,$4,$5) as ok", [
            workspace,
            buyer,
            revision,
            data,
            action,
          ]);
          assert.equal(r.rows[0].ok, true);
        } else
          await assert.rejects(
            db.query("select nexo_commit($1,$2,$3,$4,$5)", [
              workspace,
              buyer,
              revision,
              data,
              action,
            ]),
            /Action denied/,
          );
      }
    }
  } finally {
    await db.close();
  }
});
