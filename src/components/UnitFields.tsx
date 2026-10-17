"use client";
import { useState } from "react";
import type { Item } from "@/lib/model";
import { STOCK_UNITS, isGroupedUnit } from "@/lib/units";

export default function UnitFields({
  item,
  locked = false,
}: {
  item?: Item;
  locked?: boolean;
}) {
  const [unit, setUnit] = useState(item?.unidad_medida || "unidad");
  return (
    <div className="unit-definition">
      <label className="form-field">
        Unidad de inventario
        {locked ? (
          <>
            <input readOnly value={unit} />
          </>
        ) : (
          <select
            name="unidad_medida"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {STOCK_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        )}
      </label>
      {isGroupedUnit(unit) && (
        <div className="pack-definition">
          <h4>Contenido de cada {unit}</h4>
          <div className="form-grid">
            <label className="form-field">
              Cantidad que contiene
              <input
                name="packSize"
                type="number"
                required
                min="0.0001"
                max="100000000"
                step="any"
                defaultValue={item?.packSize ?? ""}
                placeholder="Ej. 12"
              />
            </label>
            <label className="form-field">
              Unidad del contenido
              <select
                name="packUnit"
                required
                defaultValue={item?.packUnit || ""}
              >
                <option value="">Selecciona el contenido</option>
                {[
                  "unidad",
                  "litro",
                  "kilogramo",
                  "par",
                  "caja",
                  "paquete",
                  "rollo",
                  "metro",
                  "metro cuadrado",
                ]
                  .filter((u) => u !== unit)
                  .map((u) => (
                    <option key={u}>{u}</option>
                  ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Ejemplo: 1 caja contiene 12 unidades; 8 cajas equivalen a 96
            unidades. El stock, los pedidos, el precio, el peso y el volumen se
            siguen registrando por {unit}.
          </p>
        </div>
      )}
    </div>
  );
}
