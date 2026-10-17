import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  initialState,
  applyAction,
  assistantAnswer,
} from "../src/lib/model.ts";
import { upgradeState, compareLogistics } from "../src/lib/logistics.ts";
import { deriveOperationalInputs } from "../src/lib/enterprise.ts";
import { canManage, requireAction, ROLES } from "./permissions.mjs";
import { legacyPreview, importLegacy } from "./legacy.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origins = new Set(
  (process.env.APP_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
);
const legacyBase =
  process.env.LOGISTICS_API_URL ||
  "https://backend-reto1-log-stica-env-os-olive.vercel.app";
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "nexo-documents";
const sb =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : null;
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const checked = ({ data, error }) => {
  if (error) {
    if (error.code === "P0001") {
      const denied = /Access denied|Action denied|Only owner/.test(
        error.message,
      );
      throw fail(
        denied
          ? "Tu rol no permite realizar esta operación."
          : /Owner\/self/.test(error.message)
            ? "No se puede modificar el acceso propio ni el del propietario."
            : /Workspace limit/.test(error.message)
              ? "Se alcanzó el límite de espacios."
              : "No se pudo validar esta operación.",
        denied ? 403 : 400,
      );
    }
    console.error("Database error", error.code);
    throw fail(
      "No se pudo completar la operación en Supabase. Comprueba la migración y los registros del servidor.",
      500,
    );
  }
  return data;
};
const uuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function bytes(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit)
      throw fail("El archivo o solicitud supera el límite permitido.", 413);
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function body(req) {
  try {
    const value = JSON.parse(
      (await bytes(req, 2 * 1024 * 1024)).toString("utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw fail("Envía un objeto JSON válido.");
    return value;
  } catch (e) {
    if (e.status) throw e;
    throw fail("El cuerpo debe ser JSON válido.");
  }
}
async function userFor(req) {
  if (!sb)
    throw fail(
      "Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.",
      503,
    );
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw fail("Inicia sesión para continuar.", 401);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw fail("Sesión no válida o caducada.", 401);
  return data.user;
}
async function membership(company, user) {
  if (!uuid(company)) throw fail("Selecciona una empresa válida.", 400);
  const m = checked(
    await sb
      .from("nexo_memberships")
      .select("role")
      .eq("workspace_id", company)
      .eq("user_id", user)
      .maybeSingle(),
  );
  if (!m) throw fail("No tienes acceso a este espacio.", 403);
  return m.role;
}
async function rowFor(company) {
  const row = checked(
    await sb
      .from("nexo_workspaces")
      .select("id,data,revision")
      .eq("id", company)
      .single(),
  );
  return { ...row, data: upgradeState(row.data) };
}
async function commit(company, user, operation, transform) {
  for (let retry = 0; retry < 4; retry++) {
    const row = await rowFor(company);
    let next;
    try {
      next = transform(row.data);
    } catch (e) {
      throw e.status ? e : fail(e.message, 400);
    }
    next.updatedAt = new Date().toISOString();
    const result = checked(
      await sb.rpc("nexo_commit", {
        p_workspace: company,
        p_actor: user,
        p_revision: row.revision,
        p_data: next,
        p_action: operation,
      }),
    );
    if (result) return next;
  }
  throw fail(
    "Otro usuario guardó cambios al mismo tiempo. Recarga y vuelve a intentar.",
    409,
  );
}
async function routeApi(req, res, url) {
  const user = await userFor(req),
    resource = url.pathname.slice(5).replace(/\/$/, ""),
    company = url.searchParams.get("company");
  if (resource === "companies") {
    if (req.method === "GET") {
      const memberships = checked(
        await sb
          .from("nexo_memberships")
          .select("workspace_id,role,nexo_workspaces(id,name)")
          .eq("user_id", user.id),
      );
      return json(
        res,
        memberships.map((m) => ({
          id: m.workspace_id,
          name: m.nexo_workspaces.name,
          role: m.role,
        })),
      );
    }
    if (req.method === "POST") {
      const b = await body(req);
      if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100)
        throw fail("Escribe un nombre de empresa de hasta 100 caracteres.");
      const id = randomUUID(),
        state = upgradeState(initialState(id, b.name.trim(), false));
      checked(
        await sb.rpc("nexo_create_workspace", {
          p_id: id,
          p_owner: user.id,
          p_name: state.company.name,
          p_data: state,
        }),
      );
      return json(res, state, 201);
    }
  }
  const role = await membership(company, user.id);
  if (resource === "state" && req.method === "GET")
    return json(res, (await rowFor(company)).data);
  if (resource === "members" && req.method === "GET") {
    if (!canManage(role))
      throw fail("Acceso reservado a administradores.", 403);
    return json(
      res,
      checked(await sb.rpc("nexo_list_members", { p_workspace: company })),
    );
  }
  if (resource === "members/save" && req.method === "POST") {
    if (!canManage(role))
      throw fail("Acceso reservado a administradores.", 403);
    const b = await body(req);
    if (
      typeof b.email !== "string" ||
      !ROLES.includes(b.role) ||
      (role !== "owner" && b.role === "admin")
    )
      throw fail("Correo o rol no válido.");
    const users = checked(
        await sb.rpc("nexo_find_user", {
          p_email: b.email.trim().toLowerCase(),
        }),
      ),
      target = users?.[0]?.id;
    if (!target)
      throw fail("La cuenta debe registrarse y confirmar su correo primero.");
    checked(
      await sb.rpc("nexo_set_member", {
        p_workspace: company,
        p_actor: user.id,
        p_target: target,
        p_role: b.role,
      }),
    );
    return json(res, { ok: true });
  }
  if (resource === "members/remove" && req.method === "POST") {
    if (!canManage(role))
      throw fail("Acceso reservado a administradores.", 403);
    const b = await body(req);
    if (!uuid(b.userId)) throw fail("Usuario no válido.");
    checked(
      await sb.rpc("nexo_set_member", {
        p_workspace: company,
        p_actor: user.id,
        p_target: b.userId,
        p_role: null,
      }),
    );
    return json(res, { ok: true });
  }
  if (resource === "action" && req.method === "POST") {
    const b = await body(req);
    requireAction(role, b.action);
    return json(
      res,
      await commit(company, user.id, b.action, (state) =>
        applyAction(state, b.action, b.payload),
      ),
    );
  }
  if (resource === "legacy/preview" && req.method === "GET")
    return json(res, await legacyPreview(legacyBase));
  if (resource === "legacy/import" && req.method === "POST") {
    if (!canManage(role))
      throw fail("La importación requiere un administrador.", 403);
    const b = await body(req),
      data = await legacyPreview(legacyBase);
    if (b.fingerprint !== data.fingerprint)
      throw fail(
        "Los datos del backend cambiaron. Consulta el resumen de nuevo.",
        409,
      );
    return json(
      res,
      await commit(company, user.id, "legacy.import", (state) =>
        importLegacy(state, data),
      ),
    );
  }
  if (resource === "upload" && req.method === "POST") {
    requireAction(role, "dispatch.create");
    const raw = await bytes(req, 8 * 1024 * 1024 + 16384);
    let form;
    try {
      form = await new Response(raw, {
        headers: { "Content-Type": req.headers["content-type"] || "" },
      }).formData();
    } catch {
      throw fail("Archivo no válido.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024)
      throw fail("Selecciona un documento de hasta 8 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase(),
      types = {
        pdf: "application/pdf",
        csv: "text/csv",
        json: "application/json",
        txt: "text/plain",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };
    if (!types[ext])
      throw fail("Formato no permitido. Usa PDF, CSV, JSON, TXT, PNG o JPG.");
    const data = new Uint8Array(await file.arrayBuffer());
    if (
      (ext === "pdf" && Buffer.from(data.slice(0, 5)).toString() !== "%PDF-") ||
      (ext === "png" &&
        Buffer.from(data.slice(0, 8)).toString("hex") !== "89504e470d0a1a0a") ||
      (["jpg", "jpeg"].includes(ext) &&
        Buffer.from(data.slice(0, 3)).toString("hex") !== "ffd8ff")
    )
      throw fail("El contenido del archivo no coincide con su formato.");
    const id = randomUUID(),
      key = `${company}/${id}`,
      name = file.name.slice(0, 250);
    checked(
      await sb.storage
        .from(bucket)
        .upload(key, data, { contentType: types[ext], upsert: false }),
    );
    const { error } = await sb.from("nexo_documents").insert({
      id,
      workspace_id: company,
      object_key: key,
      name,
      content_type: types[ext],
      created_by: user.id,
    });
    if (error) {
      await sb.storage.from(bucket).remove([key]);
      throw fail("No se pudo registrar el documento.", 500);
    }
    return json(res, { id, name }, 201);
  }
  if (resource.startsWith("files/") && req.method === "GET") {
    const id = resource.slice(6);
    if (!uuid(id)) throw fail("Documento no válido.");
    const doc = checked(
      await sb
        .from("nexo_documents")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", company)
        .maybeSingle(),
    );
    if (!doc) throw fail("Documento no encontrado.", 404);
    const file = checked(
      await sb.storage.from(bucket).download(doc.object_key),
    );
    res.writeHead(200, {
      "Content-Type": doc.content_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-File-Name": encodeURIComponent(doc.name),
      "Cache-Control": "private, no-store",
    });
    res.end(Buffer.from(await file.arrayBuffer()));
    return;
  }
  if (
    req.method === "POST" &&
    ["assistant", "logistics/compare"].includes(resource)
  ) {
    const b = await body(req),
      state = (await rowFor(company)).data;
    if (resource === "assistant") {
      if (
        typeof b.query !== "string" ||
        !b.query.trim() ||
        b.query.length > 1500
      )
        throw fail("Escribe una consulta de hasta 1500 caracteres.");
      return json(res, assistantAnswer(state, b.query));
    }
    let prepared;
    try {
      prepared = deriveOperationalInputs(state, b.points, b.inputs, b.matrix);
    } catch (e) {
      throw fail(e.message, 400);
    }
    let scenarios;
    try {
      scenarios = compareLogistics(state, b.points, prepared.inputs, b.matrix);
    } catch (e) {
      throw fail(e.message, 400);
    }
    return json(res, {
      scenarios,
      derived: prepared.derived,
      inputs: prepared.inputs,
    });
  }
  throw fail("Recurso o método no disponible.", 404);
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
export function createApp() {
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Expose-Headers", "X-File-Name");
    }
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "OPTIONS") {
        if (origin && !origins.has(origin))
          throw fail("Origen no autorizado.", 403);
        res.writeHead(204);
        res.end();
        return;
      }
      if (url.pathname === "/health")
        return json(res, { status: "ok", storageConfigured: !!sb });
      if (url.pathname.startsWith("/api/")) {
        if (origin && !origins.has(origin))
          throw fail("Origen no autorizado.", 403);
        return await routeApi(req, res, url);
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        throw fail("Método no permitido.", 405);
      const publicRoot = path.join(root, "dist"),
        requested = path.resolve(
          publicRoot,
          "." + decodeURIComponent(url.pathname),
        );
      if (
        !requested.startsWith(publicRoot + path.sep) &&
        requested !== publicRoot
      )
        throw fail("Ruta no permitida.", 403);
      let target = requested;
      try {
        const info = await stat(target);
        if (!info.isFile()) target = path.join(publicRoot, "index.html");
      } catch {
        if (path.extname(url.pathname))
          throw fail("Archivo no encontrado.", 404);
        target = path.join(publicRoot, "index.html");
      }
      let content;
      try {
        content = await readFile(target);
      } catch {
        throw fail(
          "Ejecuta npm run build antes de iniciar la aplicación.",
          503,
        );
      }
      res.writeHead(200, {
        "Content-Type":
          mime[path.extname(target)] || "application/octet-stream",
        "Cache-Control": target.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (e) {
      if (!res.headersSent)
        json(
          res,
          {
            error: e.status ? e.message : "No se pudo completar la operación.",
          },
          e.status || 500,
        );
      else res.end();
      if (!e.status) console.error("Request failed", e.name, e.message);
    }
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `Optilogic server listening on ${port}. Supabase ${sb ? "configured" : "not configured"}.`,
    ),
  );
}
