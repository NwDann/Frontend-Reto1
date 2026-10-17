export const ROLES = [
  "admin",
  "gerencia",
  "logistica",
  "bodega",
  "compras",
  "consulta",
];
const grants = {
  gerencia: ["finance.update", "profile.update", "alert.review"],
  logistica: [
    "route.create",
    "route.status",
    "logistics.update",
    "point.create",
    "point.update",
    "location.contact",
    "warehouse.update",
    "movement.locations",
    "dispatch.create",
    "dispatch.responsibility",
    "vehicle.save",
    "staff.save",
    "fleet.cost",
    "trip.create",
    "toll.save",
    "alert.review",
  ],
  bodega: [
    "item.create",
    "item.update",
    "history.import",
    "purchase.receive",
    "dispatch.create",
    "dispatch.receive",
    "dispatch.responsibility",
    "stock.transfer",
    "movement.locations",
    "alert.review",
  ],
  compras: [
    "purchase.create",
    "purchase.status",
    "supplier.create",
    "supplier.details",
    "supplier.catalog",
    "supplier.evaluate",
    "alert.review",
  ],
};
export function canAct(role, action) {
  return (
    role === "owner" || role === "admin" || !!grants[role]?.includes(action)
  );
}
export function requireAction(role, action) {
  if (!canAct(role, action)) {
    const e = new Error("Tu rol no permite realizar esta operación.");
    e.status = 403;
    throw e;
  }
}
export const canManage = (role) => role === "owner" || role === "admin";
