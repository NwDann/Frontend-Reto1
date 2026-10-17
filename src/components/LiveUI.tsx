import type { Snapshot, DataKey } from "../lib/models";
import { LABELS } from "../lib/models";
import { TriangleAlert } from "lucide-react";
export function SourceError({ s, keys }: { s: Snapshot; keys: DataKey[] }) {
  const missing = keys.filter((k) => s.errors[k]);
  return missing.length ? (
    <div className="live-note warning" role="alert">
      <TriangleAlert size={16} />
      <div>
        {missing.map((k) => (
          <p key={k}>
            <strong>{LABELS[k]}:</strong> {s.errors[k]}
          </p>
        ))}
      </div>
    </div>
  ) : null;
}
export function MissingCapability({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="live-note">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
export const CheckLabel = ({ value }: { value: boolean }) => (
  <span className={value ? "green" : "muted"}>{value ? "Sí" : "No"}</span>
);
