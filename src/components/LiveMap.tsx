import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, LoaderCircle } from "lucide-react";
import type { Coords, Origin } from "../lib/models";
import { validCoords } from "../lib/format";
import { loadGoogleMaps } from "../services/google-maps";
import { config } from "../services/config";
export type MapPoint = Coords & {
  id: string | number;
  name: string;
  kind?: string;
};
export const googleLocation = (p: Coords) =>
  `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `${p.lat},${p.lng}` })}`;
export function googleRoute(
  origin: Coords,
  points: Coords[],
  roundTrip: boolean,
) {
  if (!points.length) return googleLocation(origin);
  const destination = roundTrip ? origin : points[points.length - 1],
    via = roundTrip ? points : points.slice(0, -1);
  return (
    "https://www.google.com/maps/dir/?" +
    new URLSearchParams({
      api: "1",
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelmode: "driving",
      ...(via.length
        ? { waypoints: via.map((p) => `${p.lat},${p.lng}`).join("|") }
        : {}),
    })
  );
}
export default function LiveMap({
  points,
  origin,
  provider = "osm",
  onPick,
  onSelect,
  line,
  large = false,
}: {
  points: MapPoint[];
  origin?: Origin | null;
  provider?: "osm" | "google";
  onPick?: (p: Coords) => void;
  onSelect?: (id: string | number) => void;
  line?: [number, number][];
  large?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onPick, onSelect }),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [retry, setRetry] = useState(0);
  const [allowedFor, setAllowedFor] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(
        sessionStorage.getItem("optilogic-map-consent-v2") || "[]",
      );
      return Array.isArray(parsed)
        ? parsed.filter((value) => value === "osm" || value === "google")
        : [];
    } catch {
      return [];
    }
  });
  const allowed = allowedFor.includes(provider);
  useEffect(() => {
    const listener = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      setAllowedFor((previous) =>
        previous.includes(value) ? previous : [...previous, value],
      );
    };
    window.addEventListener("optilogic-map-consent", listener);
    return () => window.removeEventListener("optilogic-map-consent", listener);
  }, []);
  const grant = () => {
    const next = [...new Set([...allowedFor, provider])];
    setAllowedFor(next);
    try {
      sessionStorage.setItem("optilogic-map-consent-v2", JSON.stringify(next));
    } catch {}
    window.dispatchEvent(
      new CustomEvent("optilogic-map-consent", { detail: provider }),
    );
  };
  callbacks.current = { onPick, onSelect };
  const signature = JSON.stringify({ points, origin, line });
  useEffect(() => {
    if (!allowed) return;
    let disposed = false,
      cleanup = () => {};
    setError("");
    setReady(false);
    const actual = points.filter((p) => validCoords(p.lat, p.lng)),
      start = origin && validCoords(origin.lat, origin.lng) ? origin : null,
      all = [
        ...(start ? [{ ...start, id: "origin", kind: "origin" }] : []),
        ...actual,
      ],
      center = all[0] || { lat: 0, lng: 0 };
    (async () => {
      if (provider === "google") {
        const g = await loadGoogleMaps();
        if (disposed || !ref.current) return;
        const { Map } = await g.importLibrary("maps"),
          { AdvancedMarkerElement } = await g.importLibrary("marker");
        if (disposed) return;
        const map = new Map(ref.current, {
          center,
          zoom: all.length ? 12 : 2,
          mapId: config.googleMapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const bounds = new g.LatLngBounds(),
          markers: any[] = [];
        all.forEach((p, i) => {
          const node = document.createElement("span");
          node.className =
            "live-map-pin " + (p.id === "origin" ? "is-origin" : "");
          node.textContent =
            p.id === "origin" ? "B" : String(start ? i : i + 1);
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.name,
            content: node,
          });
          marker.addListener("click", () => callbacks.current.onSelect?.(p.id));
          markers.push(marker);
          bounds.extend({ lat: p.lat, lng: p.lng });
        });
        if (all.length > 1) map.fitBounds(bounds, 45);
        if (all.length === 1) map.setZoom(14);
        const click = map.addListener(
          "click",
          (e: any) =>
            e.latLng &&
            callbacks.current.onPick?.({
              lat: Number(e.latLng.lat().toFixed(6)),
              lng: Number(e.latLng.lng().toFixed(6)),
            }),
        );
        const polyline = line?.length
          ? new g.Polyline({
              map,
              path: line.map(([lat, lng]) => ({ lat, lng })),
              strokeColor: "#0f766e",
              strokeWeight: 4,
            })
          : null;
        const auth = () =>
          setError(
            "Google Maps no pudo autorizar la clave. Consulta Configuración y la guía de integración.",
          );
        window.addEventListener("optilogic-map-auth-error", auth);
        cleanup = () => {
          markers.forEach((m) => (m.map = null));
          click.remove();
          polyline?.setMap(null);
          window.removeEventListener("optilogic-map-auth-error", auth);
        };
      } else {
        const mod = await import("leaflet"),
          L = mod.default;
        if (disposed || !ref.current) return;
        const map = L.map(ref.current, {
          center: [center.lat, center.lng],
          zoom: all.length ? 12 : 2,
          scrollWheelZoom: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on(
            "tileerror",
            () =>
              !disposed &&
              setError(
                "Algunas calles no cargaron. Revisa la conexión o abre Google Maps.",
              ),
          )
          .addTo(map);
        const bounds: any[] = [];
        all.forEach((p, i) => {
          bounds.push([p.lat, p.lng]);
          const n = p.id === "origin" ? "B" : String(start ? i : i + 1),
            icon = L.divIcon({
              className: "live-leaflet-pin",
              html: `<span class="live-map-pin ${p.id === "origin" ? "is-origin" : ""}">${n}</span>`,
              iconSize: [28, 34],
              iconAnchor: [14, 30],
            });
          const label = document.createElement("span");
          label.textContent = p.name;
          L.marker([p.lat, p.lng], { icon, title: p.name })
            .addTo(map)
            .bindTooltip(label)
            .on("click", () => callbacks.current.onSelect?.(p.id));
        });
        if (bounds.length > 1)
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
        else if (bounds.length) map.setView(bounds[0], 14);
        if (line?.length)
          L.polyline(line, { color: "#0f766e", weight: 4 }).addTo(map);
        map.on("click", (e: any) =>
          callbacks.current.onPick?.({
            lat: Number(e.latlng.lat.toFixed(6)),
            lng: Number(e.latlng.lng.toFixed(6)),
          }),
        );
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(ref.current);
        cleanup = () => {
          observer.disconnect();
          map.remove();
        };
      }
      if (!disposed) setReady(true);
      else cleanup();
    })().catch((e) => !disposed && setError(e.message));
    return () => {
      disposed = true;
      cleanup();
    };
  }, [provider, signature, retry, allowed]);
  if (!allowed)
    return (
      <div
        className={`real-map live-map-consent ${large ? "real-map-large" : ""}`}
      >
        <MapPin size={32} />
        <h3>
          Mapa de {provider === "google" ? "Google Maps" : "OpenStreetMap"}
        </h3>
        <p>
          Al cargarlo se consulta un proveedor externo para mostrar la zona de
          estos puntos. Puedes usar coordenadas manuales sin cargar el mapa.
        </p>
        <button type="button" className="btn primary" onClick={grant}>
          Cargar mapa de {provider === "google" ? "Google" : "OpenStreetMap"}
        </button>
        <small>
          La elección se conserva durante esta sesión del navegador.
        </small>
      </div>
    );
  const target = origin || points[0];
  return (
    <div className={`real-map ${large ? "real-map-large" : ""}`}>
      <div className="leaflet-host" ref={ref} />
      {!ready && !error && (
        <div className="map-loading">
          <LoaderCircle className="spin" size={18} />
          Abriendo mapa…
        </div>
      )}
      <div className="map-top-label">
        <MapPin size={12} />
        {onPick
          ? "Haz clic para elegir una ubicación"
          : "Puntos consultados en la API"}
      </div>
      {target && (
        <div className="real-map-actions">
          <a href={googleLocation(target)} target="_blank" rel="noreferrer">
            Google Maps <ExternalLink size={12} />
          </a>
        </div>
      )}
      {error && (
        <div className="map-error-note">
          {error}
          <button type="button" onClick={() => setRetry((x) => x + 1)}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
export function CoordinateFields({
  value,
  onChange,
  name = "Ubicación",
}: {
  value: Coords | null;
  onChange: (p: Coords) => void;
  name?: string;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  return (
    <div>
      <div className="map-coordinates">
        <label>
          {name}: latitud
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={value?.lat ?? ""}
            onChange={(e) =>
              onChange({ lat: Number(e.target.value), lng: value?.lng ?? 0 })
            }
          />
        </label>
        <label>
          Longitud
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={value?.lng ?? ""}
            onChange={(e) =>
              onChange({ lat: value?.lat ?? 0, lng: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <div className="paste-location">
        <input
          aria-label="Coordenadas o enlace de Google Maps"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pega latitud,longitud o un enlace completo de Google Maps"
        />
        <button
          type="button"
          className="btn secondary small"
          onClick={() => {
            let decoded = text;
            try {
              decoded = decodeURIComponent(text);
            } catch {}
            const m =
              decoded.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/) ||
              decoded.match(
                /[?&](?:q|query|ll)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
              ) ||
              decoded.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
            if (!m || !validCoords(Number(m[1]), Number(m[2]))) {
              setError(
                "Usa coordenadas válidas o un enlace completo; abre primero los enlaces abreviados.",
              );
              return;
            }
            setError("");
            onChange({ lat: Number(m[1]), lng: Number(m[2]) });
          }}
        >
          Usar ubicación
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
