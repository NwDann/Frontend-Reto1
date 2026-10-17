import { initialState, applyAction, assistantAnswer } from "../lib/model";
import type { State } from "../lib/model";
import { upgradeState, compareLogistics } from "../lib/logistics";
import { deriveOperationalInputs } from "../lib/enterprise";
// Explicit local mode only; never used as a fallback after a server error.
const openDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("optilogic-demo-v1", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("states");
      r.result.createObjectStore("files");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(Error("No se pudo abrir el almacenamiento local."));
  });
async function read(store: string, key: string) {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(store),
      r = tx.objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(Error("No se pudo leer el almacenamiento local."));
    };
  });
}
async function write(store: string, key: string, value: unknown) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(Error("No se pudo guardar. Revisa el espacio del navegador."));
    };
  });
}
let queue: Promise<unknown> = Promise.resolve();
export function demoRequest(
  company: string,
  path: string,
  body?: any,
): Promise<any> {
  const job = queue.then(() => handle(company, path, body));
  queue = job.catch(() => {});
  return job;
}
async function handle(company: string, path: string, body?: any) {
  let companies = (await read("states", "companies")) || [
    { id: "cleanpro", name: "CleanPro Servicios", role: "owner" },
    { id: "brillo", name: "Brillo Integral", role: "owner" },
  ];
  if (path === "companies") {
    if (!body) return companies;
    const id = crypto.randomUUID(),
      state = upgradeState(
        initialState(id, String(body.name || "").trim(), false),
      );
    if (!state.company.name || state.company.name.length > 100)
      throw Error("Escribe un nombre de hasta 100 caracteres.");
    await write("states", id, state);
    companies = [...companies, { id, name: state.company.name, role: "owner" }];
    await write("states", "companies", companies);
    return state;
  }
  const selected = companies.find((c: any) => c.id === company);
  if (!selected) throw Error("Empresa no encontrada.");
  let state: State = await read("states", company);
  if (!state) {
    state = upgradeState(initialState(company, selected.name, true));
    await write("states", company, state);
  } else state = upgradeState(state);
  if (path === "state") return structuredClone(state);
  if (path === "action") {
    state = applyAction(state, body.action, body.payload);
    await write("states", company, state);
    return structuredClone(state);
  }
  if (path === "logistics/compare") {
    const p = deriveOperationalInputs(
      state,
      body.points,
      body.inputs,
      body.matrix,
    );
    return {
      scenarios: compareLogistics(state, body.points, p.inputs, body.matrix),
      derived: p.derived,
      inputs: p.inputs,
    };
  }
  if (path === "assistant") return assistantAnswer(state, body.query);
  if (path === "members")
    return [{ user_id: "demo", email: "demo@local", role: "owner" }];
  if (path === "legacy/preview" || path === "legacy/import")
    throw Error(
      "La importación del backend requiere modo conectado e inicio de sesión.",
    );
  throw Error("Operación no disponible en demostración.");
}
export async function demoUpload(company: string, file: File) {
  if (file.size === 0 || file.size > 8 * 1024 * 1024)
    throw Error("Usa un archivo de hasta 8 MB.");
  const id = crypto.randomUUID();
  await write("files", `${company}:${id}`, { blob: file, name: file.name });
  return { id, name: file.name };
}
export async function demoFile(company: string, id: string) {
  const file = await read("files", `${company}:${id}`);
  if (!file) throw Error("Documento no encontrado en este navegador.");
  return file;
}
