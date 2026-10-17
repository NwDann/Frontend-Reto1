"use client";
import { useState } from "react";
import { State, Movement } from "@/lib/model";
import { movementGeography, registeredLocation } from "@/lib/locations";
import { warehouseFor, Warehouse } from "@/lib/logistics";
import { Open, CardTitle, Badge, Empty, dateLabel } from "./ui";
import GeoMap, { LocationPicker, googleLocation, googleRoute } from "./GeoMap";
export default function MovementMap({
  s,
  movementId,
  setMovementId,
  open,
}: {
  s: State;
  movementId: string;
  setMovementId: (id: string) => void;
  open: Open;
}) {
  const m = s.movements.find((m) => m.id === movementId) || s.movements[0];
  if (!m)
    return (
      <section className="card padded">
        <Empty
          title="Sin movimientos para visualizar"
          text="Las compras recibidas, entregas confirmadas y traslados generan movimientos."
        />
      </section>
    );
  const geo = movementGeography(s, m),
    destination = geo.destination,
    view: State = {
      ...s,
      warehouse: geo.origin || s.warehouse,
      points: destination
        ? [
            {
              ...destination,
              id: "movement-destination",
              zona_reparto: "Destino del movimiento",
              metros_cuadrados_atendidos: 0,
              urgente: false,
              contrato_validado: true,
              requiere_personal_acreditado: false,
            },
          ]
        : [],
      enterprise: s.enterprise
        ? {
            ...s.enterprise,
            contacts: {
              ...s.enterprise.contacts,
              "movement-destination": {
                kind: "client",
                segment: "Movimiento",
                frequency: 0,
                nextService: "",
                contact: {
                  name: "",
                  role: "",
                  phone: "",
                  email: "",
                  hours: "",
                },
              },
            },
          }
        : undefined,
    };
  return (
    <section className="card padded movement-map">
      <CardTitle
        title="Recorrido del movimiento seleccionado"
        sub="El mapa muestra únicamente su origen y destino."
      />
      <label className="form-field">
        Movimiento
        <select value={m.id} onChange={(e) => setMovementId(e.target.value)}>
          {s.movements.map((x) => (
            <option key={x.id} value={x.id}>
              {dateLabel(x.fecha)} · {x.referencia} ·{" "}
              {s.items.find((i) => i.id === x.item)?.nombre} · {x.origen} →{" "}
              {x.destino}
            </option>
          ))}
        </select>
      </label>
      <div className="movement-summary">
        <Badge tone={m.tipo === "Ingreso" ? "green" : "blue"}>{m.tipo}</Badge>
        <strong>
          {m.cantidad} {s.items.find((i) => i.id === m.item)?.unidad_medida} ·{" "}
          {s.items.find((i) => i.id === m.item)?.nombre}
        </strong>
        <span>
          {m.referencia} · {dateLabel(m.fecha)}
        </span>
      </div>
      <div className="two-col movement-endpoints">
        {[
          [m.origen, geo.origin, "Origen"],
          [m.destino, geo.destination, "Destino"],
        ].map(([name, location, label]) => {
          const p = location as Warehouse | undefined;
          return (
            <div className="derived-box" key={String(label)}>
              <span>
                <small>{String(label)}</small>
                <strong>{String(name)}</strong>
                {p ? (
                  <>
                    <p>{p.direccion || p.nombre_cliente}</p>
                    <p>
                      {p.latitud}, {p.longitud}
                    </p>
                    <a
                      className="text-button"
                      href={googleLocation(p)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver ubicación ↗
                    </a>
                  </>
                ) : (
                  <p>Coordenadas pendientes de registrar</p>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {geo.complete && geo.origin ? (
        <>
          <GeoMap
            s={view}
            origin={geo.origin}
            order={["movement-destination"]}
            returnToWarehouse={false}
            large
          />
          <a
            className="text-button"
            href={googleRoute(
              view,
              ["movement-destination"],
              false,
              geo.origin,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Abrir recorrido en Google Maps ↗
          </a>
        </>
      ) : (
        <Empty
          title="Falta la ubicación de un extremo"
          text="Registra las coordenadas del origen y del destino para dibujar este movimiento. No se asigna automáticamente una ubicación al proveedor."
        />
      )}
      <div className="row-actions">
        <button
          className="btn secondary"
          onClick={() => open("movement-detail", m)}
        >
          Ver datos y responsables
        </button>
        <button
          className="btn secondary"
          onClick={() => open("movement-locations", m)}
        >
          {geo.complete ? "Revisar ubicaciones" : "Completar ubicaciones"}
        </button>
      </div>
      <p className="hint">
        {geo.historical
          ? "Se usan las coordenadas guardadas en este movimiento."
          : "Este movimiento antiguo usa las coordenadas actuales de las ubicaciones que pudieron identificarse; no conservó una copia histórica."}{" "}
        El recorrido es una referencia vial entre ambos extremos; no representa
        seguimiento GPS.
      </p>
    </section>
  );
}
export function MovementLocationFields({
  s,
  movement: m,
}: {
  s: State;
  movement: Movement;
}) {
  const geo = movementGeography(s, m),
    [origin, setOrigin] = useState<Warehouse>(
      geo.origin || {
        ...warehouseFor(s),
        nombre_cliente: m.origen,
        direccion: "",
      },
    ),
    [destination, setDestination] = useState<Warehouse>(
      geo.destination || {
        ...warehouseFor(s),
        nombre_cliente: m.destino,
        direccion: "",
      },
    ),
    [originChosen, setOriginChosen] = useState(!!geo.origin),
    [destinationChosen, setDestinationChosen] = useState(!!geo.destination);
  const options = [
    { id: "warehouse", name: warehouseFor(s).nombre_cliente },
    ...s.points.map((p) => ({ id: p.id, name: p.nombre_cliente })),
  ];
  return (
    <>
      <input
        type="hidden"
        name="originSnapshot"
        value={originChosen ? JSON.stringify(origin) : ""}
      />
      <input
        type="hidden"
        name="destinationSnapshot"
        value={destinationChosen ? JSON.stringify(destination) : ""}
      />
      <p className="hint">
        Registra los lugares físicos de esta operación. Elegir coordenadas no
        cambia existencias ni crea nuevas ubicaciones en el directorio.
      </p>
      <div className="two-col movement-location-fields">
        {[
          {
            label: "Origen",
            value: origin,
            set: setOrigin,
            chosen: originChosen,
            choose: setOriginChosen,
          },
          {
            label: "Destino",
            value: destination,
            set: setDestination,
            chosen: destinationChosen,
            choose: setDestinationChosen,
          },
        ].map((side) => (
          <section key={side.label}>
            <h3>{side.label}</h3>
            <label className="form-field">
              Usar una ubicación registrada
              <select
                defaultValue=""
                onChange={(ev) => {
                  const p = registeredLocation(s, ev.target.value);
                  if (p) {
                    side.set(p);
                    side.choose(true);
                  }
                }}
              >
                <option value="">Elegir del directorio…</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Nombre del lugar
              <input
                required
                maxLength={250}
                value={side.value.nombre_cliente}
                onChange={(ev) =>
                  side.set({ ...side.value, nombre_cliente: ev.target.value })
                }
              />
            </label>
            <label className="form-field">
              Dirección o referencia
              <input
                maxLength={500}
                value={side.value.direccion}
                onChange={(ev) =>
                  side.set({ ...side.value, direccion: ev.target.value })
                }
              />
            </label>
            {!side.chosen && (
              <p className="form-error">
                Selecciona este extremo sobre el mapa, pega sus coordenadas o
                usa el directorio. El centro inicial del mapa es solo una
                referencia.
              </p>
            )}
            <LocationPicker
              s={s}
              value={side.value}
              onChange={(p) => {
                side.set({ ...side.value, ...p });
                side.choose(true);
              }}
            />
          </section>
        ))}
      </div>
    </>
  );
}
