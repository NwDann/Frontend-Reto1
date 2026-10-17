"use client";
import { uploadFile, downloadFile } from "../services/api";
import UnitFields from "./UnitFields";
import { packagingLabel, containedQuantity } from "@/lib/units";
import { LOCATION_TYPES } from "@/lib/locations";
import { LocationPicker, googleLocation } from "./GeoMap";
import { eligibleEvaluations, clientFor } from "@/lib/enterprise";
import { warehouseFor } from "@/lib/logistics";
import { PurchaseFields, CatalogFields } from "./Purchasing";
import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Upload,
  FileText,
  Download,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Package,
  MapPin,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  State,
  Line,
  forecast,
  money,
  dateAfter,
  supplierScore,
} from "@/lib/model";
import {
  Action,
  Requester,
  Field,
  SelectField,
  Badge,
  Empty,
  download,
  toCSV,
  dateLabel,
} from "./ui";
type Props = {
  modal: { type: string; data?: any };
  s: State | null;
  close: () => void;
  action: Action;
  request: Requester;
  company: string;
  busy: boolean;
  notify: (s: string) => void;
  createCompany: (s: string) => Promise<void>;
};
const titles: Record<string, [string, string]> = {
  company: [
    "Un nuevo espacio, listo para conectar.",
    "Los registros de cada empresa permanecen en su propio espacio.",
  ],
  purchase: [
    "Preparar solicitud de compra",
    "Define el insumo, la cantidad y quién lo provee.",
  ],
  item: [
    "Agregar un insumo",
    "Cada referencia es el inicio de una operación más ordenada.",
  ],
  itemdetail: [
    "Detalle del insumo",
    "Consulta la referencia y ajusta sus parámetros de reposición.",
  ],
  history: [
    "Cargar consumo histórico",
    "Una cifra por semana, de la más antigua a la más reciente.",
  ],
  point: [
    "Nueva ubicación",
    "Registra bodegas, oficinas, clientes, puntos de venta y plantas.",
  ],
  pointdetail: ["Punto de servicio", "Información para preparar el despacho."],
  supplier: [
    "Agregar proveedor",
    "Un nuevo aliado para tu red de abastecimiento.",
  ],
  supplierdetail: [
    "Historial del proveedor",
    "Evaluaciones operativas registradas en este espacio.",
  ],
  evaluation: [
    "Evaluar un servicio",
    "Valora de 1 a 5. Un 5 representa el mejor resultado.",
  ],
  route: [
    "Guardar plan de ruta",
    "Conserva el escenario y continúa con la ejecución.",
  ],
  guide: [
    "Cargar guía de remisión",
    "Importa datos estructurados o adjunta un documento de respaldo.",
  ],
  dispatch: [
    "Detalle y confirmación de entrega",
    "Compara lo solicitado con lo entregado y consulta sus responsables.",
  ],
  report: [
    "Resumen de tu operación",
    "Una fotografía de los registros de este espacio.",
  ],
  "settings-help": [
    "Cómo comparamos las rutas",
    "Criterios transparentes para decisiones informadas.",
  ],
};
export default function ModalView({
  modal,
  s,
  close,
  action,
  company,
  busy,
  notify,
  createCompany,
}: Props) {
  const { type, data } = modal,
    [localBusy, setLocalBusy] = useState(false),
    [error, setError] = useState(""),
    [item, setItem] = useState(data?.item || s?.items[0]?.id || ""),
    [lines, setLines] = useState<Line[]>(
      type === "dispatch"
        ? data.lines.map((l: Line) => ({
            ...l,
            recibido: l.recibido ?? l.cantidad,
          }))
        : [{ insumo_id: s?.items[0]?.id || "", cantidad: 1 }],
    ),
    [point, setPoint] = useState(data?.point || s?.points[0]?.id || ""),
    [file, setFile] = useState<File | null>(null),
    [fileInfo, setFileInfo] = useState("");
  const [location, setLocation] = useState({
    latitud:
      data?.latitud ??
      (type === "warehouse" && s ? warehouseFor(s).latitud : -0.18),
    longitud:
      data?.longitud ??
      (type === "warehouse" && s ? warehouseFor(s).longitud : -78.48),
  });
  const [locationKind, setLocationKind] = useState(
    s && data?.id ? clientFor(s, data.id).kind : "service",
  );
  const box = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    [title, subtitle] =
      type === "warehouse"
        ? [
            "Ubicación de la bodega",
            "Elige sobre el mapa el punto de salida de esta empresa.",
          ]
        : type === "catalog"
          ? [
              "Catálogo del proveedor",
              "Los productos asociados aparecerán en las solicitudes de compra.",
            ]
          : titles[type] || ["Detalles", ""];
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const el = box.current;
    const first = el?.querySelector<HTMLElement>(
      "input,select,textarea,button",
    );
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab" && el) {
        const nodes = Array.from(
            el.querySelectorAll<HTMLElement>(
              "button:not([disabled]),input,select,textarea,a[href]",
            ),
          ),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (localBusy || busy) return;
    setLocalBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      p: any = Object.fromEntries(f);
    let a = "";
    try {
      if (type === "company") {
        await createCompany(p.name);
        return;
      }
      if (type === "purchase") {
        a = "purchase.create";
      }
      if (type === "item") a = "item.create";
      if (type === "itemdetail") {
        a = "item.update";
        p.id = data.id;
      }
      if (type === "history") {
        a = "history.import";
        p.id = data.id;
        p.values = String(p.values)
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(Number);
      }
      if (type === "point") {
        a = data?.id ? "point.update" : "point.create";
        p.id = data?.id;
        Object.assign(p, location);
        p.urgente = f.has("urgente");
        p.contrato_validado = f.has("contrato_validado");
        p.requiere_personal_acreditado = f.has("requiere_personal_acreditado");
      }
      if (type === "supplier") a = "supplier.create";
      if (type === "catalog") {
        a = "supplier.catalog";
        p.id = data.id;
        p.products = JSON.parse(p.products);
      }
      if (type === "warehouse") {
        a = "warehouse.update";
        Object.assign(p, location);
      }
      if (type === "evaluation") {
        a = "supplier.evaluate";
        p.id = data.id;
      }
      if (type === "route") {
        a = "route.create";
        p.points = data.points;
        p.scenario = data.scenario.id;
        p.inputs = data.inputs;
        p.matrix = data.matrix;
      }
      if (type === "guide") {
        a = "dispatch.create";
        p.lines = lines;
        p.point = point;
        if (file) {
          const d = await uploadFile(company, file);
          p.document = d.id;
        }
      }
      if (type === "dispatch") {
        a = "dispatch.receive";
        p.id = data.id;
        p.lines = lines;
      }
      if (await action(a, p)) close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocalBusy(false);
    }
  };
  const loadFile = async (f: File) => {
    setError("");
    setFileInfo("");
    if (f.size > 8 * 1024 * 1024) {
      setError("El archivo supera 8 MB.");
      return;
    }
    setFile(f);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext === "csv" || ext === "json") {
        const text = (await f.text()).replace(/^\uFEFF/, "");
        const parsed = ext === "json" ? JSON.parse(text) : parseCSV(text);
        const rows = Array.isArray(parsed)
          ? parsed
          : parsed.detalles || parsed.lines;
        if (!Array.isArray(rows) || !rows.length || rows.length > 50)
          throw Error("La guía debe tener entre 1 y 50 filas de insumos.");
        const ls = rows.map((row: any) => ({
          insumo_id: String(row.insumo_id ?? "").trim(),
          cantidad: Number(row.cantidad ?? row.cantidad_solicitada),
        }));
        if (
          ls.some(
            (l) =>
              !s?.items.some((i) => i.id === l.insumo_id) ||
              !Number.isFinite(l.cantidad) ||
              l.cantidad <= 0,
          )
        )
          throw Error(
            "Revisa los códigos de insumo y las cantidades del archivo.",
          );
        if (new Set(ls.map((l) => l.insumo_id)).size !== ls.length)
          throw Error("El archivo contiene códigos de insumo repetidos.");
        setLines(ls);
        if (
          parsed.punto_servicio_id &&
          s?.points.some((p) => p.id === String(parsed.punto_servicio_id))
        )
          setPoint(String(parsed.punto_servicio_id));
        setFileInfo(
          `${ls.length} referencias importadas. Revisa los datos antes de guardar.`,
        );
      } else
        setFileInfo(
          "Documento adjunto. Completa y revisa los datos de la guía manualmente.",
        );
    } catch (e) {
      setError(
        (e as Error).message +
          " Puedes corregir el archivo o completar las filas manualmente.",
      );
    }
  };
  const formTypes = [
    "warehouse",
    "catalog",
    "company",
    "purchase",
    "item",
    "itemdetail",
    "history",
    "point",
    "supplier",
    "evaluation",
    "route",
    "guide",
  ];
  const isForm =
    formTypes.includes(type) ||
    (type === "dispatch" && data.estado !== "Entregada");
  const itemData = s?.items.find((i) => i.id === item),
    suggested = itemData
      ? Math.max(
          0,
          itemData.stock_minimo - itemData.stock_actual,
          forecast(itemData, 4).total - itemData.stock_actual,
        )
      : 0;
  const content = (
    <>
      {type === "company" && (
        <>
          <Field
            label="Nombre de la empresa"
            name="name"
            placeholder="Ej. Limpieza Integral Andina"
            maxLength={100}
          />
          <div className="info-note">
            <BuildingSymbol />
            <p>
              El nuevo espacio comienza vacío. Puedes registrar proveedores,
              insumos y puntos de servicio sin mezclar datos de las empresas de
              demostración.
            </p>
          </div>
        </>
      )}
      {type === "purchase" && s && <PurchaseFields s={s} data={data} />}
      {type === "item" && (
        <>
          <Field
            label="Nombre del insumo"
            name="nombre"
            placeholder="Ej. Desinfectante concentrado"
          />
          <div className="form-grid">
            <SelectField label="Categoría" name="categoria">
              <option value="quimico">Químico</option>
              <option value="consumible">Consumible</option>
              <option value="herramienta">Herramienta</option>
            </SelectField>
            <UnitFields />
            <Field
              label="Stock inicial"
              name="stock_actual"
              type="number"
              value={0}
              min="0"
              step="any"
            />
            <Field
              label="Stock mínimo"
              name="stock_minimo"
              type="number"
              value={0}
              min="0"
              step="any"
            />
            <Field
              label="Precio unitario (USD)"
              name="precio_unitario"
              type="number"
              value={0}
              min="0"
              step="0.01"
            />
            <Field
              label="Peso unitario (kg)"
              name="peso_unitario_kg"
              type="number"
              value={0}
              min="0"
              step="0.001"
            />
            <Field
              label="Volumen unitario (m³)"
              name="volumen_unitario_m3"
              type="number"
              value={0}
              min="0"
              step="0.0001"
            />
            <Field
              label="Vencimiento del lote inicial"
              name="vencimiento"
              type="date"
              value={dateAfter(180)}
            />
          </div>
          <p className="hint">
            En esta primera versión se registra una fecha de vencimiento por
            referencia. La gestión de múltiples lotes requiere una ampliación.
          </p>
        </>
      )}
      {type === "itemdetail" && (
        <>
          <div className="detail-hero">
            <span className={`item-icon ${data.color}`}>
              <Package size={24} />
            </span>
            <div>
              <h3>{data.nombre}</h3>
              <p>
                {data.id} · {data.unidad_medida}
              </p>
            </div>
            <Badge
              tone={data.stock_actual < data.stock_minimo ? "rose" : "green"}
            >
              {data.stock_actual < data.stock_minimo
                ? "Por reponer"
                : "Disponible"}
            </Badge>
          </div>
          <div className="detail-grid">
            <span>
              <small>Disponible</small>
              <strong>{data.stock_actual}</strong>
            </span>
            <span>
              <small>Valor total</small>
              <strong>{money(data.stock_actual * data.precio_unitario)}</strong>
            </span>
            <span>
              <small>Vencimiento</small>
              <strong>
                {data.stock_actual > 0
                  ? data.vencimiento || "Sin registrar"
                  : "Sin lote"}
              </strong>
            </span>
            <span>
              <small>Peso unitario</small>
              <strong>{data.peso_unitario_kg} kg</strong>
            </span>
          </div>
          <UnitFields item={data} locked />
          <div className="form-grid">
            <Field
              label="Stock mínimo"
              name="stock_minimo"
              type="number"
              value={data.stock_minimo}
              min="0"
              step="any"
            />
            <Field
              label="Precio unitario (USD)"
              name="precio_unitario"
              type="number"
              value={data.precio_unitario}
              min="0"
              step="0.01"
            />
          </div>
          <p className="hint">
            Las recepciones de compras y la confirmación de entregas actualizan
            las existencias.
          </p>
        </>
      )}
      {type === "history" && (
        <>
          <div className="detail-hero">
            <span className="item-icon mint">
              <Package size={21} />
            </span>
            <div>
              <h3>{data.nombre}</h3>
              <p>Consumo en {data.unidad_medida} por semana</p>
            </div>
          </div>
          <label className="form-field">
            Consumos semanales (mínimo 4, máximo 104)
            <textarea
              name="values"
              rows={6}
              defaultValue={data.history.join(", ")}
              placeholder="20, 24, 23, 28, 30, 31, 35, 38"
              required
            />
          </label>
          <p className="hint">
            Usa coma, espacio o salto de línea para separar valores. La primera
            cifra es la semana más antigua. Estos valores reemplazan el
            histórico de esta referencia.
          </p>
        </>
      )}
      {type === "warehouse" && s && (
        <>
          <Field
            label="Nombre de la bodega"
            name="nombre_cliente"
            value={warehouseFor(s).nombre_cliente}
          />
          <Field
            label="Dirección o referencia"
            name="direccion"
            value={warehouseFor(s).direccion}
          />
          <LocationPicker s={s} value={location} onChange={setLocation} />
        </>
      )}
      {type === "point" && s && (
        <>
          <Field
            label="Nombre de la ubicación"
            name="nombre_cliente"
            value={data?.nombre_cliente}
          />
          <Field
            label="Dirección o referencia"
            name="direccion"
            value={data?.direccion}
          />
          <div className="form-grid">
            <Field
              label="Zona de reparto"
              name="zona_reparto"
              value={data?.zona_reparto}
            />
            <Field
              label="Área del punto (m²)"
              name="metros_cuadrados_atendidos"
              type="number"
              min="0"
              step="any"
              value={data?.metros_cuadrados_atendidos ?? 0}
            />
          </div>
          <div className="form-grid">
            <label className="form-field">
              Tipo de ubicación
              <select
                name="kind"
                value={locationKind}
                onChange={(ev) =>
                  setLocationKind(ev.target.value as typeof locationKind)
                }
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Servicios por semana"
              name="frequency"
              type="number"
              min="0"
              max="14"
              value={data ? clientFor(s, data.id).frequency : 1}
            />
            {locationKind === "prospect" && (
              <Field
                label="Próxima atención / visita"
                name="nextService"
                type="date"
                value={data ? clientFor(s, data.id).nextService : ""}
                required={false}
              />
            )}
            <Field
              label="Nombre del contacto"
              name="contactName"
              value={data ? clientFor(s, data.id).contact.name : ""}
              required={false}
            />
            <Field
              label="Teléfono"
              name="phone"
              value={data ? clientFor(s, data.id).contact.phone : ""}
              required={false}
            />
            <Field
              label="Correo"
              name="email"
              type="email"
              value={data ? clientFor(s, data.id).contact.email : ""}
              required={false}
            />
          </div>
          <LocationPicker s={s} value={location} onChange={setLocation} />
          <label className="checkbox-label">
            <input
              name="contrato_validado"
              type="checkbox"
              defaultChecked={data?.contrato_validado ?? true}
            />
            Contrato validado
          </label>
          <label className="checkbox-label">
            <input
              name="requiere_personal_acreditado"
              type="checkbox"
              defaultChecked={data?.requiere_personal_acreditado ?? false}
            />
            Requiere personal acreditado
          </label>
          <label className="checkbox-label">
            <input
              name="urgente"
              type="checkbox"
              defaultChecked={data?.urgente ?? false}
            />
            Priorizar tiempo de atención
          </label>
        </>
      )}
      {type === "catalog" && s && <CatalogFields s={s} provider={data} />}
      {type === "pointdetail" && (
        <>
          <div className="detail-hero">
            <span className="item-icon mint">
              <MapPin size={22} />
            </span>
            <div>
              <h3>{data.nombre_cliente}</h3>
              <p>
                {data.id} · {data.zona_reparto}
              </p>
            </div>
          </div>
          <p>{data.direccion}</p>
          <div className="detail-grid">
            <span>
              <small>Área de servicio</small>
              <strong>
                {data.metros_cuadrados_atendidos.toLocaleString()} m²
              </strong>
            </span>
            <span>
              <small>Coordenadas</small>
              <strong>
                {data.latitud}, {data.longitud}
              </strong>
            </span>
          </div>
          <div className="detail-badges">
            <Badge tone={data.contrato_validado ? "green" : "rose"}>
              {data.contrato_validado
                ? "Contrato validado"
                : "Validación pendiente"}
            </Badge>
            <Badge tone="gray">
              {data.requiere_personal_acreditado
                ? "Requiere acreditación"
                : "Acceso general"}
            </Badge>
            {data.urgente && <Badge tone="sand">Atención prioritaria</Badge>}
          </div>
        </>
      )}
      {type === "supplier" && (
        <>
          <Field
            label="RUC (13 dígitos)"
            name="ruc"
            pattern="[0-9]{13}"
            minLength={13}
            maxLength={13}
          />
          <Field label="Dirección fiscal / comercial" name="direccion" />
          <div className="form-grid">
            <Field label="Persona de contacto" name="contacto" />
            <Field label="Teléfono de contacto" name="telefono" />
          </div>
          <Field
            label="Condiciones de pago"
            name="paymentTerms"
            placeholder="Ej. transferencia, crédito 30 días"
          />
          <Field label="Razón social o nombre comercial" name="nombre" />
          <Field
            label="Categoría de suministro"
            name="categoria"
            placeholder="Ej. Químicos y desinfección"
          />
          <div className="form-grid">
            <Field
              label="Plazo de entrega (días)"
              name="lead"
              type="number"
              min="1"
              max="365"
              value={3}
            />
            <Field
              label="Correo de contacto"
              name="email"
              type="email"
              required={false}
            />
          </div>
        </>
      )}
      {type === "evaluation" && (
        <>
          <div className="detail-hero">
            <span className="item-icon mint">
              <ShieldCheck size={21} />
            </span>
            <div>
              <h3>{data.nombre}</h3>
              <p>{data.id}</p>
            </div>
          </div>
          <label className="form-field">
            Operación existente sin calificar
            <select
              name="referenceId"
              defaultValue={data.referenceId || ""}
              required
            >
              <option value="">Selecciona la compra o transporte</option>
              {s &&
                eligibleEvaluations(s, data.id).map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
            </select>
          </label>
          <div className="evaluation-fields">
            {[
              [
                "puntualidad",
                "Puntualidad",
                "Entrega dentro del plazo acordado.",
              ],
              ["calidad", "Calidad", "Productos y cantidades conformes."],
              ["costo", "Costo", "Relación costo y resultado."],
            ].map(([name, label, text]) => (
              <label key={name}>
                <span>
                  <strong>{label}</strong>
                  <small>{text}</small>
                </span>
                <select name={name} defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="form-field">
            Observaciones
            <textarea
              name="observacion"
              rows={3}
              placeholder="Qué salió bien y qué debe mejorar"
            />
          </label>
        </>
      )}
      {type === "supplierdetail" && (
        <>
          <div className="detail-hero">
            <span className="item-icon mint">
              <ShieldCheck size={21} />
            </span>
            <div>
              <h3>{data.nombre}</h3>
              <p>{data.evaluations.length} evaluaciones</p>
            </div>
            <strong>{supplierScore(data).toFixed(0)}/100</strong>
          </div>
          <div className="evaluation-history">
            {data.evaluations.map((e: any) => (
              <div key={e.id}>
                <strong>{e.service}</strong>
                <small>
                  {dateLabel(e.fecha)} · Puntualidad {e.puntualidad}/5 · Calidad{" "}
                  {e.calidad}/5 · Costo {e.costo}/5
                </small>
                <p>{e.observacion || "Sin observaciones."}</p>
              </div>
            ))}
            {!data.evaluations.length && <Empty title="Aún sin evaluaciones" />}
          </div>
        </>
      )}
      {type === "route" && (
        <>
          <div className="route-modal-summary">
            <Badge tone="green">{data.scenario.nombre}</Badge>
            <strong>{money(data.scenario.cost)}</strong>
            <span>
              {data.scenario.distance.toFixed(1)} km ·{" "}
              {Math.ceil(data.scenario.minutes)} minutos · {data.points.length}{" "}
              paradas
            </span>
          </div>
          <Field
            label="Nombre del recorrido"
            name="nombre"
            value={`Ruta ${new Date().toLocaleDateString("es-EC")} · ${data.scenario.nombre}`}
          />
          <div className="form-grid">
            <Field
              label="Vehículo u operador"
              name="vehicle"
              placeholder="Ej. PBA-2048"
              maxLength={100}
              value={
                s?.enterprise?.vehicles.find(
                  (v) =>
                    v.id ===
                    (data.scenario.mode === "external"
                      ? data.inputs?.externalVehicleId
                      : data.inputs?.vehicleId),
                )?.plate || data.scenario.operator
              }
              readOnly={!!data.inputs?.registered}
            />
            <Field
              label="Fecha de ejecución"
              name="date"
              type="date"
              value={data.inputs?.departure?.slice(0, 10) || dateAfter(0)}
              readOnly={!!data.inputs?.registered}
            />
          </div>
          <p className="hint">
            Este plan conserva el escenario calculado. Las distancias y tiempos
            son estimados y requieren validación antes de una salida real.
          </p>
        </>
      )}
      {type === "guide" && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.csv,.json,.txt,.png,.jpg,.jpeg"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) loadFile(e.target.files[0]);
            }}
          />
          <button
            type="button"
            className="upload-area"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={26} />
            <strong>{file ? file.name : "Seleccionar guía o documento"}</strong>
            <span>
              CSV / JSON para importar · PDF o imagen como respaldo · máx. 8 MB
            </span>
          </button>
          {fileInfo && (
            <p className="file-info">
              <Check size={14} />
              {fileInfo}
            </p>
          )}
          <div className="form-grid">
            <label className="form-field">
              Punto de entrega
              <select value={point} onChange={(e) => setPoint(e.target.value)}>
                {s?.points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_cliente}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Fecha programada"
              name="fecha"
              type="date"
              value={dateAfter(0)}
            />
          </div>
          <label className="field-label">DETALLE DE INSUMOS</label>
          <div className="guide-lines">
            {lines.map((l, n) => (
              <div key={n}>
                <select
                  aria-label={`Insumo ${n + 1}`}
                  value={l.insumo_id}
                  onChange={(e) =>
                    setLines((xs) =>
                      xs.map((x, i) =>
                        i === n ? { ...x, insumo_id: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {s?.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} · {i.unidad_medida}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Cantidad ${n + 1}`}
                  type="number"
                  min="1"
                  step="any"
                  value={l.cantidad}
                  onChange={(e) =>
                    setLines((xs) =>
                      xs.map((x, i) =>
                        i === n
                          ? { ...x, cantidad: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  title="Quitar insumo"
                  disabled={lines.length === 1}
                  onClick={() => setLines((xs) => xs.filter((_, i) => i !== n))}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-button"
            type="button"
            disabled={lines.length >= 50}
            onClick={() =>
              setLines((xs) => [
                ...xs,
                {
                  insumo_id:
                    s?.items.find((i) => !xs.some((l) => l.insumo_id === i.id))
                      ?.id ||
                    s?.items[0]?.id ||
                    "",
                  cantidad: 1,
                },
              ])
            }
          >
            <Plus size={15} />
            Agregar insumo
          </button>
          <GuideResponsibility s={s!} point={point} />
          <label className="form-field">
            Observaciones
            <textarea name="notas" rows={2} />
          </label>
        </>
      )}
      {type === "dispatch" && (
        <>
          <ResponsibilityDetails responsibility={data.responsibility} />
          <div className="detail-hero">
            <span className="item-icon sand">
              <FileText size={22} />
            </span>
            <div>
              <h3>{data.id}</h3>
              <p>
                {s?.points.find((p) => p.id === data.point)?.nombre_cliente}
              </p>
            </div>
            <Badge tone={data.estado === "Entregada" ? "green" : "sand"}>
              {data.estado}
            </Badge>
          </div>
          <div className="receive-table">
            <div className="receive-header">
              <span>INSUMO</span>
              <span>SOLICITADO</span>
              <span>ENTREGADO</span>
            </div>
            {lines.map((l, n) => (
              <div className="receive-line" key={l.insumo_id}>
                <span>
                  <strong>
                    {s?.items.find((i) => i.id === l.insumo_id)?.nombre}
                  </strong>
                  <small>
                    {l.insumo_id} ·{" "}
                    {s?.items.find((i) => i.id === l.insumo_id)?.unidad_medida}
                  </small>
                </span>
                <strong>{l.cantidad}</strong>
                {data.estado === "Entregada" ? (
                  <strong className={l.recibido !== l.cantidad ? "red" : ""}>
                    {l.recibido}
                  </strong>
                ) : (
                  <input
                    aria-label={`Entregado ${l.insumo_id}`}
                    type="number"
                    min="0"
                    max={l.cantidad}
                    step="any"
                    required
                    value={l.recibido}
                    onChange={(e) =>
                      setLines((xs) =>
                        xs.map((x, i) =>
                          n === i
                            ? { ...x, recibido: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {data.estado !== "Entregada" && (
            <>
              <GuideResponsibility
                s={s!}
                point={data.point}
                value={data.responsibility}
              />
              <label className="form-field">
                Observaciones de entrega
                <textarea
                  name="notas"
                  rows={3}
                  defaultValue={data.notas || ""}
                />
              </label>
              <p className="hint">
                La confirmación descuenta del stock la cantidad despachada. Si
                llega menos, la diferencia queda visible en la guía y genera una
                alerta. No se puede confirmar dos veces.
              </p>
            </>
          )}
          {data.document && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                downloadFile(company, data.document).catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Download size={15} />
              Descargar documento adjunto
            </button>
          )}
          {data.notas && data.estado === "Entregada" && (
            <p className="hint">Observaciones: {data.notas}</p>
          )}
        </>
      )}
      {type === "report" && s && (
        <>
          <div className="detail-grid">
            <span>
              <small>Referencias de inventario</small>
              <strong>{s.items.length}</strong>
            </span>
            <span>
              <small>Valor en bodega</small>
              <strong>
                {money(
                  s.items.reduce(
                    (a, i) => a + i.stock_actual * i.precio_unitario,
                    0,
                  ),
                )}
              </strong>
            </span>
            <span>
              <small>Guías registradas</small>
              <strong>{s.dispatches.length}</strong>
            </span>
            <span>
              <small>Solicitudes abiertas</small>
              <strong>
                {
                  s.purchases.filter(
                    (p) => !["Rechazada", "Recibida"].includes(p.estado),
                  ).length
                }
              </strong>
            </span>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              download(
                "resumen-nexo.csv",
                toCSV([
                  {
                    empresa: s.company.name,
                    fecha: new Date().toISOString(),
                    insumos: s.items.length,
                    valor_stock: s.items.reduce(
                      (a, i) => a + i.stock_actual * i.precio_unitario,
                      0,
                    ),
                    rutas: s.routes.length,
                    puntos: s.points.length,
                    guias: s.dispatches.length,
                    compras: s.purchases.length,
                  },
                ]),
              );
              notify("Resumen descargado");
            }}
          >
            <Download size={16} />
            Descargar resumen CSV
          </button>
        </>
      )}
      {type === "settings-help" && (
        <div className="method-explanation">
          <h3>1. Secuencias de paradas</h3>
          <p>
            Se evalúan todas las permutaciones de hasta 7 puntos. Se incluyen
            salida y regreso a la bodega central.
          </p>
          <h3>2. Costo y atención</h3>
          <p>
            Costo: salida de $18 + distancia × tarifa por km + tiempo de
            conductor a $5/h. Tiempo de atención: cada punto urgente pesa 4
            veces en la suma de espera; los otros, 1 vez.
          </p>
          <h3>3. Escenario equilibrado</h3>
          <p>
            60% del costo normalizado + 40% de la espera normalizada. Se
            verifica capacidad de peso, volumen y disponibilidad de
            acreditación.
          </p>
          <h3>4. Alcance de la estimación</h3>
          <p>
            La distancia geográfica se multiplica por un factor de aproximación.
            Los escenarios no usan una red vial real ni tráfico en vivo. Puedes
            cambiar los parámetros en Configuración.
          </p>
        </div>
      )}
    </>
  );
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !localBusy && close()}
    >
      <div
        className={`modal ${["guide", "dispatch", "point", "warehouse", "catalog"].includes(type) ? "wide" : ""}`}
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">NEXO WORKSPACE</div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar ventana"
            onClick={close}
            disabled={localBusy}
          >
            <X size={20} />
          </button>
        </div>
        {isForm ? (
          <form onSubmit={submit}>
            <div className="modal-body">
              {content}
              {error && (
                <p className="form-error">
                  <TriangleAlert size={15} />
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={close}
                disabled={localBusy}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={
                  localBusy ||
                  busy ||
                  (type === "purchase" &&
                    (!s?.items.length || !s?.suppliers.length))
                }
              >
                {localBusy || busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}{" "}
                {type === "dispatch"
                  ? "Confirmar entrega"
                  : type === "company"
                    ? "Crear empresa"
                    : type === "purchase"
                      ? "Crear solicitud"
                      : "Guardar"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal-body">{content}</div>
            <div className="modal-footer">
              <button className="btn primary" onClick={close}>
                Entendido <Check size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function BuildingSymbol() {
  return <ShieldCheck size={18} />;
}
function SparkSymbol() {
  return <ArrowUpRight size={17} />;
}
function parseCSV(text: string) {
  const rows: string[][] = [],
    delimiter = text.split("\n")[0].includes(";") ? ";" : ",";
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (c === '"') {
      if (quoted && text[n + 1] === '"') {
        cell += '"';
        n++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (quoted) throw Error("Hay comillas sin cerrar en el CSV.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw Error("El CSV no tiene filas de datos.");
  const headers = rows.shift()!.map((h) => h.toLowerCase());
  if (
    !headers.includes("insumo_id") ||
    !headers.some((h) => h === "cantidad" || h === "cantidad_solicitada")
  )
    throw Error("El CSV requiere columnas insumo_id y cantidad.");
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

function ResponsibilityDetails({ responsibility: r }: { responsibility: any }) {
  return (
    <div className="detail-grid">
      {[
        ["Vehículo", r?.vehicle],
        ["Conductor", r?.driver],
        ["Despachador", r?.dispatcher],
        ["Receptor", r?.receiver],
      ].map(([label, value]) => (
        <span key={label}>
          <small>{label}</small>
          <strong>{value || "Pendiente de registrar"}</strong>
        </span>
      ))}
    </div>
  );
}
function GuideResponsibility({
  s,
  point,
  value,
}: {
  s: State;
  point: string;
  value?: any;
}) {
  const [vehicleId, setVehicle] = useState(
      s.enterprise?.vehicles.find((v) => v.plate === value?.vehicle)?.id || "",
    ),
    v = s.enterprise?.vehicles.find((v) => v.id === vehicleId),
    driver = s.enterprise?.staff.find((d) => d.id === v?.driverId),
    contact = clientFor(s, point).contact;
  return (
    <div className="guide-responsibility">
      <h3>Vehículo y responsables</h3>
      <div className="form-grid">
        <label className="form-field">
          Vehículo registrado
          <select
            value={vehicleId}
            onChange={(ev) => setVehicle(ev.target.value)}
          >
            <option value="">Registro manual / sin seleccionar</option>
            {s.enterprise?.vehicles
              .filter((v) => v.active)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.name}
                </option>
              ))}
          </select>
        </label>
        <Field
          key={vehicleId + "plate"}
          name="vehicle"
          label="Placa / identificación"
          value={v?.plate || value?.vehicle || ""}
        />
        <Field
          key={vehicleId + "driver"}
          name="driver"
          label="Conductor"
          value={driver?.name || value?.driver || ""}
        />
        <Field
          name="dispatcher"
          label="Despachador"
          value={
            value?.dispatcher ||
            s.enterprise?.staff.find((d) => /despach/i.test(d.role))?.name ||
            ""
          }
        />
        <Field
          key={point}
          name="receiver"
          label="Receptor / responsable en destino"
          value={value?.receiver || contact.name || ""}
        />
        <Field
          name="contact"
          label="Teléfono o correo para seguimiento"
          required={false}
          value={value?.contact || contact.phone || contact.email || ""}
        />
      </div>
    </div>
  );
}
