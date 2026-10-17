export const money = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(n);
export const number = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("es-EC", { maximumFractionDigits: digits }).format(
        n,
      );
export function dateTime(
  value: string | null | undefined,
  timezone = "America/Guayaquil",
) {
  if (!value) return "Sin registrar";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Fecha no válida"
    : d.toLocaleString("es-EC", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      });
}
export function toInputDate(
  value: string | null | undefined,
  timezone = "America/Guayaquil",
) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return parts.replace(" ", "T");
}
// Ecuador's two selectable zones have fixed UTC offsets; never use the host's zone.
export function fromInputDate(value: string, timezone = "America/Guayaquil") {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) throw Error("Revisa la fecha y hora.");
  const [year, month, day, hour, minute, second] = match
      .slice(1)
      .map((v) => Number(v || 0)),
    calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    throw Error("Revisa la fecha y hora.");
  const iso = value + (timezone === "Pacific/Galapagos" ? "-06:00" : "-05:00");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw Error("Revisa la fecha y hora.");
  return d.toISOString();
}
export function validCoords(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
export const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function saveText(
  name: string,
  contents: string,
  mime = "application/json",
) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([contents], { type: mime }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
