"use client";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  MapPin,
  LoaderCircle,
  LocateFixed,
  Layers,
} from "lucide-react";
import { State } from "@/lib/model";
import { clientFor } from "@/lib/enterprise";
import {
  Location,
  Warehouse,
  warehouseFor,
  coordinateKey,
} from "@/lib/logistics";

export const googleLocation = (p: Location) =>
  `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${p.latitud},${p.longitud}` })}`;
export function googleRoute(
  s: State,
  order: string[],
  returnToWarehouse = true,
  start?: Warehouse,
) {
  const wh = start || warehouseFor(s),
    ps = order
      .map((id) => s.points.find((p) => p.id === id))
      .filter(Boolean) as Location[],
    end = returnToWarehouse ? wh : ps[ps.length - 1] || wh,
    waypoints = returnToWarehouse ? ps : ps.slice(0, -1);
  return (
    "https://www.google.com/maps/dir/?" +
    new URLSearchParams({
      api: "1",
      origin: `${wh.latitud},${wh.longitud}`,
      destination: `${end.latitud},${end.longitud}`,
      travelmode: "driving",
      ...(waypoints.length
        ? {
            waypoints: waypoints
              .map((p) => `${p.latitud},${p.longitud}`)
              .join("|"),
          }
        : {}),
    })
  );
}
export default function GeoMap({
  s,
  order,
  pointIds,
  origin,
  active,
  onSelect,
  large = false,
  onMapClick,
  value,
  returnToWarehouse = true,
}: {
  s: State;
  origin?: Warehouse;
  order?: string[];
  pointIds?: string[];
  active?: string;
  onSelect?: (id: string) => void;
  large?: boolean;
  onMapClick?: (p: Location) => void;
  value?: Location;
  returnToWarehouse?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    leaf = useRef<any>(null),
    group = useRef<any>(null),
    routeGroup = useRef<any>(null),
    callbacks = useRef({ onSelect, onMapClick }),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [roadStatus, setRoadStatus] = useState(""),
    [selected, setSelected] = useState(""),
    [reload, setReload] = useState(0);
  callbacks.current = { onSelect, onMapClick };
  const wh = origin || warehouseFor(s),
    points = order
      ? order.map((id) => s.points.find((p) => p.id === id)).filter(Boolean)
      : pointIds
        ? s.points.filter((p) => pointIds.includes(p.id))
        : s.points,
    key = coordinateKey([wh, ...(points as Location[])]),
    orderKey = order?.join("|") || "",
    markerKey = JSON.stringify(
      points.map((p: any) => [p.nombre_cliente, clientFor(s, p.id)]),
    ),
    valueKey = value ? coordinateKey([value]) : "";
  useEffect(() => {
    let alive = true,
      observer: ResizeObserver | undefined;
    setReady(false);
    setError("");
    import("leaflet")
      .then((mod) => {
        if (!alive || !container.current) return;
        const L = mod.default || mod;
        leaf.current = L;
        const m = L.map(container.current, {
          center: [wh.latitud, wh.longitud],
          zoom: 12,
          scrollWheelZoom: false,
          zoomControl: true,
        });
        map.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          crossOrigin: true,
        })
          .on("tileerror", () =>
            setError(
              "No se pudieron cargar algunas calles. Comprueba tu conexión o abre Google Maps.",
            ),
          )
          .addTo(m);
        group.current = L.layerGroup().addTo(m);
        routeGroup.current = L.layerGroup().addTo(m);
        m.on("click", (e: any) =>
          callbacks.current.onMapClick?.({
            latitud: Number(e.latlng.lat.toFixed(6)),
            longitud: Number(e.latlng.lng.toFixed(6)),
          }),
        );
        observer = new ResizeObserver(() => m.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() =>
        setError(
          "No se pudo abrir el mapa. Puedes introducir coordenadas y abrir la ubicación en Google Maps.",
        ),
      );
    return () => {
      alive = false;
      observer?.disconnect();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [reload, s.company.id]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const L = leaf.current,
      g = group.current;
    g.clearLayers();
    const bounds: any[] = [];
    const add = (
      p: Location,
      label: string,
      id: string,
      n: string,
      kind: string,
    ) => {
      bounds.push([p.latitud, p.longitud]);
      const icon = L.divIcon({
        className: "nexo-marker " + kind + (active === id ? " active" : ""),
        html: `<span><b>${n}</b></span>`,
        iconSize: [30, 34],
        iconAnchor: [15, 34],
      });
      const marker = L.marker([p.latitud, p.longitud], {
        icon,
        draggable: kind === "picked" && !!callbacks.current.onMapClick,
        keyboard: true,
        title: label,
      }).addTo(g);
      const text = document.createElement("span");
      text.textContent = label;
      marker.bindTooltip(text, { direction: "top", offset: [0, -24] });
      marker.on("click", () => {
        setSelected(id);
        callbacks.current.onSelect?.(id);
      });
      if (kind === "picked")
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          callbacks.current.onMapClick?.({
            latitud: Number(p.lat.toFixed(6)),
            longitud: Number(p.lng.toFixed(6)),
          });
        });
    };
    add(
      wh,
      wh.nombre_cliente,
      origin ? "route-origin" : "warehouse",
      origin ? "I" : "B",
      "warehouse",
    );
    points.forEach((p: any, i) => {
      const c = clientFor(s, p.id);
      add(
        p,
        p.nombre_cliente,
        p.id,
        order
          ? String(i + 1)
          : c.frequency >= 3
            ? "★"
            : c.kind === "prospect"
              ? "?"
              : c.kind === "sale"
                ? "V"
                : c.kind === "warehouse"
                  ? "B"
                  : c.kind === "office"
                    ? "O"
                    : c.kind === "plant"
                      ? "F"
                      : c.kind === "client"
                        ? "C"
                        : "P",
        "destination " + c.kind,
      );
    });
    if (value) add(value, "Ubicación seleccionada", "picked", "✓", "picked");
    if (value)
      map.current.setView(
        [value.latitud, value.longitud],
        Math.max(14, map.current.getZoom()),
      );
    else if (bounds.length === 1) map.current.setView(bounds[0], 15);
    else
      map.current.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: value ? 16 : 14,
      });
  }, [ready, key, active, valueKey, markerKey, wh.nombre_cliente, !!origin]);
  useEffect(() => {
    if (!ready || !routeGroup.current) return;
    if (!order?.length) {
      routeGroup.current.clearLayers();
      setRoadStatus("");
      return;
    }
    const L = leaf.current,
      g = routeGroup.current;
    g.clearLayers();
    const coords = [
      wh,
      ...(points as Location[]),
      ...(returnToWarehouse ? [wh] : []),
    ];
    const controller = new AbortController();
    setRoadStatus("Calculando recorrido vial…");
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinateKey(coords)}?overview=simplified&geometries=geojson`,
          { signal: controller.signal },
        );
        const d: any = await r.json();
        if (!r.ok || d.code !== "Ok" || !d.routes?.[0]?.geometry) throw Error();
        L.geoJSON(d.routes[0].geometry, {
          style: { color: "#0f766e", weight: 4, opacity: 0.9 },
        }).addTo(g);
        setRoadStatus("Recorrido vial de referencia · sin tráfico en vivo");
      } catch (e) {
        if (controller.signal.aborted) return;
        L.polyline(
          coords.map((p) => [p.latitud, p.longitud]),
          { color: "#9b9265", weight: 3, dashArray: "7 7" },
        ).addTo(g);
        setRoadStatus("Servicio vial no disponible · línea entre puntos");
      }
    }, 1200);
    return () => {
      clearTimeout(timer);
      controller.abort();
      g.clearLayers();
    };
  }, [ready, key, orderKey, returnToWarehouse]);
  const focus = () => {
    const p = value || wh;
    map.current?.setView([p.latitud, p.longitud], 16);
  };
  const target =
    value || s.points.find((p) => p.id === (active || selected)) || wh;
  return (
    <div
      className={`real-map ${large ? "real-map-large" : ""} ${onMapClick ? "picking" : ""}`}
    >
      <div className="leaflet-host" ref={container} />
      {!ready && !error && (
        <div className="map-loading">
          <LoaderCircle size={18} className="spin" />
          Abriendo mapa…
        </div>
      )}
      <div className="map-top-label">
        <MapPin size={12} />
        {onMapClick
          ? "Haz clic para elegir la ubicación"
          : "Red de abastecimiento"}
      </div>
      <div className="real-map-actions">
        <button type="button" title="Centrar ubicación" onClick={focus}>
          <LocateFixed size={17} />
        </button>
        <a
          href={
            order?.length
              ? googleRoute(s, order, returnToWarehouse, origin)
              : googleLocation(target)
          }
          target="_blank"
          rel="noreferrer"
        >
          Google Maps <ExternalLink size={12} />
        </a>
      </div>
      {error && (
        <div className="map-error-note">
          {error}
          <button type="button" onClick={() => setReload((v) => v + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {roadStatus && <div className="road-label">{roadStatus}</div>}
    </div>
  );
}
export function LocationPicker({
  s,
  value,
  onChange,
}: {
  s: State;
  value: Location;
  onChange: (p: Location) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  const useLink = () => {
    setError("");
    let decoded = text;
    try {
      decoded = decodeURIComponent(text);
    } catch {
      setError("El enlace contiene caracteres no válidos.");
      return;
    }
    const match =
      decoded.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
      decoded.match(/[?&](?:q|query|ll)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/) ||
      decoded.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
    if (
      !match ||
      Math.abs(Number(match[1])) > 90 ||
      Math.abs(Number(match[2])) > 180
    ) {
      setError(
        "Pega coordenadas o un enlace completo de Google Maps que incluya latitud y longitud. Los enlaces abreviados requieren abrirse primero.",
      );
      return;
    }
    onChange({ latitud: Number(match[1]), longitud: Number(match[2]) });
  };
  return (
    <div className="location-picker">
      <GeoMap s={s} order={[]} value={value} onMapClick={onChange} />
      <div className="map-coordinates">
        <label>
          Latitud
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={value.latitud}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && Math.abs(n) <= 90)
                onChange({ ...value, latitud: n });
            }}
          />
        </label>
        <label>
          Longitud
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={value.longitud}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && Math.abs(n) <= 180)
                onChange({ ...value, longitud: n });
            }}
          />
        </label>
      </div>
      <div className="paste-location">
        <input
          aria-label="Enlace de Google Maps o coordenadas"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pegar enlace de Google Maps o latitud,longitud"
        />
        <button className="btn secondary small" type="button" onClick={useLink}>
          Usar ubicación
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      <p className="hint">
        Selecciona sobre calles reales o pega coordenadas. La vista usa
        OpenStreetMap y abre la ubicación en Google Maps.
      </p>
    </div>
  );
}
