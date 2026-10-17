"use client";
import React, { useState } from "react";
import {
  Package,
  Clock3,
  Check,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { packagingLabel, containedQuantity } from "@/lib/units";
import { State, forecast, money } from "@/lib/model";
import { offersFor, Offer } from "@/lib/logistics";
import { Action, Empty, Badge } from "./ui";
export function PurchaseFields({
  s,
  data,
  onAvailability,
}: {
  s: State;
  data?: any;
  onAvailability?: (ok: boolean) => void;
}) {
  const past = [...new Set(s.purchases.map((p) => p.item))],
    defaultItem = data?.item || "";
  const [item, setItem] = useState(defaultItem),
    [filter, setFilter] = useState("all"),
    [supplier, setSupplier] = useState(""),
    [quantity, setQuantity] = useState(data?.cantidad || 0);
  const i = s.items.find((i) => i.id === item),
    offers = offersFor(s, item),
    offer = offers.find((o) => o.supplier.id === supplier) || offers[0],
    suggested = i
      ? Math.max(
          0,
          i.stock_minimo - i.stock_actual,
          forecast(i, 4).total - i.stock_actual,
        )
      : 0,
    cantidad = quantity || Math.max(1, suggested, offer?.minOrder || 1),
    openQty = s.purchases
      .filter(
        (p) => p.item === item && !["Recibida", "Rechazada"].includes(p.estado),
      )
      .reduce((a, p) => a + p.cantidad, 0),
    eligible =
      filter === "requested"
        ? s.items.filter((i) => past.includes(i.id))
        : s.items;
  const changeItem = (id: string) => {
    setItem(id);
    setSupplier("");
    setQuantity(0);
  };
  if (!s.items.length) return <Empty title="Agrega primero un insumo" />;
  return (
    <>
      <div className="purchase-catalog-tabs">
        <button
          type="button"
          className={filter === "requested" ? "active" : ""}
          disabled={!past.length}
          onClick={() => {
            setFilter("requested");
            if (!past.includes(item)) changeItem("");
          }}
        >
          Productos ya solicitados <span>{past.length}</span>
        </button>
        <button
          type="button"
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Catálogo completo
        </button>
      </div>
      <label className="form-field">
        Producto
        <select
          name="item"
          value={item}
          onChange={(e) => changeItem(e.target.value)}
          required
        >
          <option value="">
            Selecciona un producto para esta nueva solicitud
          </option>
          {eligible.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} · {i.id}
            </option>
          ))}
        </select>
      </label>
      {i && packagingLabel(i) && (
        <p className="hint">
          <strong>{packagingLabel(i)}</strong> · La cantidad solicitada se
          expresa en {i.unidad_medida}.
        </p>
      )}
      <div className="purchase-suggestion">
        <Package size={16} />
        <span>
          Disponible <b>{i?.stock_actual ?? "—"}</b> · Mínimo{" "}
          <b>{i?.stock_minimo ?? "—"}</b> · Reposición orientativa{" "}
          <b>
            {suggested} {i?.unidad_medida}
          </b>
        </span>
      </div>
      {openQty > 0 && (
        <p className="pending-quantity">
          <Clock3 size={14} />
          {openQty} {i?.unidad_medida} en solicitudes abiertas para este
          producto. Revísalas antes de duplicar.
        </p>
      )}
      <label className="form-field">
        Proveedor que ofrece este insumo
        <select
          name="supplier"
          value={offer?.supplier.id || ""}
          onChange={(e) => {
            setSupplier(e.target.value);
          }}
          required
          disabled={!offers.length}
        >
          {offers.length ? (
            offers.map((o) => (
              <option key={o.supplier.id} value={o.supplier.id}>
                {o.supplier.nombre} · {money(o.price)} / {i?.unidad_medida} ·{" "}
                {o.lead} días
              </option>
            ))
          ) : (
            <option value="">Sin proveedores asociados al producto</option>
          )}
        </select>
      </label>
      {offers.length > 0 ? (
        <div className="offer-comparison">
          {offers.map((o) => (
            <button
              key={o.supplier.id}
              type="button"
              className={offer?.supplier.id === o.supplier.id ? "selected" : ""}
              onClick={() => setSupplier(o.supplier.id)}
            >
              <span>
                <strong>{o.supplier.nombre}</strong>
                <small>
                  {o.lead} días · mínimo {o.minOrder} {i?.unidad_medida}
                </small>
              </span>
              <strong>{money(o.price)}</strong>
              {offer?.supplier.id === o.supplier.id && <Check size={14} />}
            </button>
          ))}
        </div>
      ) : (
        <p className={item ? "form-error" : "hint"}>
          <TriangleAlert size={15} />
          {item ? "Asocia" : "Selecciona un producto. Después asocia"} este
          insumo al catálogo de un proveedor desde Proveedores. No se puede
          solicitar a un proveedor sin oferta registrada.
        </p>
      )}
      <div className="form-grid">
        <label className="form-field">
          Cantidad ({i?.unidad_medida})
          <input
            name="cantidad"
            type="number"
            value={cantidad}
            min={offer?.minOrder || 1}
            step="any"
            required
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <label className="form-field">
          Prioridad
          <select name="prioridad" defaultValue="Alta">
            <option>Alta</option>
            <option>Normal</option>
          </select>
        </label>
      </div>
      <label className="form-field">
        Motivo
        <input
          name="motivo"
          defaultValue={
            data?.item ? "Reposición por stock y demanda del servicio" : ""
          }
          placeholder="Describe la necesidad del servicio"
          required
        />
      </label>
      <div className="purchase-total">
        <span>
          Total de referencia
          <small>Precio registrado del proveedor × cantidad</small>
        </span>
        <strong>{offer ? money(cantidad * offer.price) : "—"}</strong>
      </div>
      <p className="hint">
        Los proveedores se muestran únicamente si su catálogo incluye este
        producto. Los precios y plazos son referencias registradas; confirma la
        cotización antes de comprar.
      </p>
    </>
  );
}
export function CatalogFields({ s, provider }: { s: State; provider: any }) {
  const [offers, setOffers] = useState<Offer[]>(provider.products || []);
  const toggle = (id: string) =>
    setOffers((xs) =>
      xs.some((o) => o.itemId === id)
        ? xs.filter((o) => o.itemId !== id)
        : [
            ...xs,
            {
              itemId: id,
              price: s.items.find((i) => i.id === id)!.precio_unitario,
              lead: provider.lead,
              minOrder: 1,
            },
          ],
    );
  const set = (id: string, key: keyof Offer, value: number) =>
    setOffers((xs) =>
      xs.map((o) => (o.itemId === id ? { ...o, [key]: value } : o)),
    );
  return (
    <>
      <div className="catalog-provider">
        <span className="soft-icon">
          <ShoppingCart size={20} />
        </span>
        <div>
          <h3>{provider.nombre}</h3>
          <p>Selecciona los insumos que ofrece y registra su cotización.</p>
        </div>
      </div>
      <input type="hidden" name="products" value={JSON.stringify(offers)} />
      <div className="catalog-offers">
        {s.items.map((i) => {
          const o = offers.find((o) => o.itemId === i.id);
          return (
            <div className={`catalog-offer ${o ? "selected" : ""}`} key={i.id}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!o}
                  onChange={() => toggle(i.id)}
                />
                <strong>{i.nombre}</strong>
                <small>{i.unidad_medida}</small>
              </label>
              {o && (
                <div className="form-grid three-columns">
                  <label className="form-field">
                    Precio unitario (USD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={o.price}
                      onChange={(e) =>
                        set(i.id, "price", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="form-field">
                    Entrega (días)
                    <input
                      type="number"
                      min="0"
                      max="365"
                      step="1"
                      required
                      value={o.lead}
                      onChange={(e) =>
                        set(i.id, "lead", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="form-field">
                    Pedido mínimo
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={o.minOrder}
                      onChange={(e) =>
                        set(i.id, "minOrder", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {!s.items.length && (
          <Empty title="Agrega insumos para asociarlos al proveedor" />
        )}
      </div>
    </>
  );
}
