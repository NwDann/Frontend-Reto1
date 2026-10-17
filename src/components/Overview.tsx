import { useState } from "react";
import {
  Package,
  Truck,
  ShieldCheck,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import type { Snapshot, Preferences, Modal, AppPage } from "../lib/models";
import { inventoryValue, operationalAlerts } from "../lib/insights";
import { money, number, validCoords, dateTime } from "../lib/format";
import { SectionTitle, Metric, CardTitle, Badge, Empty } from "./ui";
import { SourceError } from "./LiveUI";
import LiveMap from "./LiveMap";
export default function Overview({
  s,
  prefs,
  go,
  open,
}: {
  s: Snapshot;
  prefs: Preferences;
  go: (p: AppPage) => void;
  open: (m: Modal) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    k = s.kpis,
    value = inventoryValue(s),
    alerts = operationalAlerts(s),
    point = s.points?.find((p) => p.id === selected),
    routeRule = k?.rentabilidad_por_ruta as any,
    merma = k?.mermas_detalle as any;
  const markers = (s.points || [])
    .filter((p) => validCoords(p.latitud, p.longitud))
    .map((p) => ({
      id: p.id,
      name: p.nombre_cliente,
      lat: p.latitud!,
      lng: p.longitud!,
    }));
  return (
    <>
      <SectionTitle
        eyebrow="RESUMEN OPERATIVO"
        title="Tu operación, al día."
        text="Inventario, entregas, contratos y rutas con la última información disponible para decidir con seguridad."
      >
        <button className="btn primary" onClick={() => go("routes")}>
          Planificar recorrido <ArrowUpRight size={15} />
        </button>
      </SectionTitle>
      <SourceError
        s={s}
        keys={["items", "kpis", "routes", "points", "dispatches"]}
      />
      <div className="metrics-grid">
        <Metric
          label="Valor del inventario"
          value={money(value)}
          icon={Package}
          detail={
            prefs.inventoryBudget && value !== null
              ? `${number((value / prefs.inventoryBudget) * 100)}% del presupuesto local · ${value > prefs.inventoryBudget ? "Revisar inversión en stock" : "Dentro del límite configurado"}`
              : "Stock actual × precio unitario. Configura un presupuesto para contextualizarlo."
          }
        />
        <Metric
          label="Entregas OTIF"
          value={k ? `${number(k.otif_porcentaje)}%` : "—"}
          icon={Clock3}
          detail={
            k
              ? `${(k.otif_detalle as any).on_time_in_full ?? "—"} de ${(k.otif_detalle as any).entregas_totales ?? "—"} entregas a tiempo y completas.`
              : "Aún no hay indicadores de entregas disponibles."
          }
        />
        <Metric
          label="Rutas activas"
          value={
            s.routes
              ? s.routes.filter((r) => r.estado !== "Completada").length
              : "—"
          }
          icon={Truck}
          detail={
            s.routes
              ? `${s.routes.filter((r) => r.estado === "Planificada").length} planificadas · ${s.routes.filter((r) => r.estado === "En Tránsito").length} en tránsito. Revisa carga y responsables.`
              : "No se pudo consultar el estado de las rutas."
          }
        />
        <Metric
          label="Cumplimiento de contratos"
          value={k ? `${number(k.cumplimiento_contratos_porcentaje)}%` : "—"}
          icon={ShieldCheck}
          detail={
            k
              ? `${(k.cumplimiento_contratos_detalle as any).contratos_cumplidos ?? "—"} de ${k.total_contratos} contratos vigentes y cumplidos.`
              : "Aún no hay información de contratos."
          }
        />
      </div>
      <div className="live-two-col">
        <section className="card padded">
          <CardTitle
            title="Red de puntos de servicio"
            sub="Ubicaciones de clientes en el mapa. Puedes definir el origen de la bodega en Configuración."
          />
          <LiveMap
            points={markers}
            origin={prefs.origin}
            provider={prefs.mapProvider}
            onSelect={(id) => typeof id === "number" && setSelected(id)}
            large
          />
          {point ? (
            <div className="live-note">
              <strong>{point.nombre_cliente}</strong>
              <p>
                {point.direccion || "Sin dirección"} ·{" "}
                {point.zona_reparto || "Sin zona"}
              </p>
              <p>
                {number(point.metros_cuadrados_atendidos)} m² ·{" "}
                {point.contrato_validado
                  ? "Contrato validado"
                  : "Contrato pendiente de validar"}
              </p>
              <button
                className="text-button"
                onClick={() =>
                  open({
                    kind: "edit",
                    resource: "puntos-servicio",
                    record: point,
                  })
                }
              >
                Ver ficha del punto ↗
              </button>
            </div>
          ) : (
            <p className="hint">
              Selecciona un marcador para consultar su ficha. El backend no
              clasifica clientes frecuentes o futuros ni almacena contactos.
            </p>
          )}
          {s.points?.filter((p) => !validCoords(p.latitud, p.longitud))
            .length! > 0 && (
            <p className="live-note warning">
              Hay puntos sin coordenadas. Completa sus fichas para mostrarlos en
              el mapa.
            </p>
          )}
        </section>
        <section className="card padded">
          <CardTitle
            title="Acciones que requieren revisión"
            sub="Alertas derivadas de los registros consultados."
          />
          {alerts.slice(0, 6).map((a) => (
            <button
              key={a.id}
              className="list-row live-alert-row"
              onClick={() => go(a.page as AppPage)}
            >
              <span>
                <strong>{a.title}</strong>
                <small>{a.detail}</small>
              </span>
              <Badge tone={a.severity === "Crítica" ? "rose" : "sand"}>
                {a.severity}
              </Badge>
            </button>
          ))}
          {!alerts.length && (
            <Empty
              title="Sin alertas por ahora"
              text="Cuando haya stock bajo, contratos por validar o rutas sobrecargadas aparecerán aquí."
            />
          )}
          <button className="text-button" onClick={() => go("alerts")}>
            Abrir centro de alertas ↗
          </button>
        </section>
      </div>
      <section className="card padded">
        <CardTitle title="Cómo leer estos indicadores" />
        <div className="live-scenario-grid">
          <div className="live-note">
            <strong>Valor por ruta, sin confundirlo con utilidad</strong>
            <p>
              {k
                ? `${routeRule?.rutas_con_valor_gte_1000 ?? "—"} de ${k.total_rutas} rutas superan el umbral de ${money(routeRule?.umbral_usd ?? 1000)}.`
                : "Indicador no disponible."}{" "}
              Compara el valor de la carga transportada frente a un umbral; no
              resta costos de viaje ni representa una ganancia neta.
            </p>
          </div>
          <div className="live-note">
            <strong>«Mermas» es un proxy de stock bajo</strong>
            <p>
              {k
                ? `${number(k.tasa_mermas)}% · ${merma?.insumos_bajo_minimo ?? "—"} insumos bajo mínimo.`
                : "Indicador no disponible."}{" "}
              Se basa en insumos con stock por debajo del mínimo; no mide
              pérdidas físicas ni diferencias de inventario.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
