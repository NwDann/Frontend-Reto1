"use client";
import React from "react";
import { Boxes } from "lucide-react";
export type Page =
  | "dashboard"
  | "routes"
  | "inventory"
  | "purchases"
  | "tracking"
  | "demand"
  | "suppliers"
  | "assistant"
  | "alerts"
  | "settings"
  | "points"
  | "fleet";
export type Action = (action: string, payload: any) => Promise<boolean>;
export type Open = (type: string, data?: any) => void;
export type Requester = (path: string, body?: unknown) => Promise<any>;
export const dateLabel = (date: string) =>
  new Date(date.includes("T") ? date : date + "T12:00:00").toLocaleDateString(
    "es-EC",
    { day: "2-digit", month: "short" },
  );
export function Badge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Empty({
  title = "Todavía no hay registros",
  text = "Agrega el primero para empezar a conectar tu operación.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Boxes size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function CardTitle({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon?: any;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card-title">
      <div>
        <h2>
          {Icon && <Icon size={17} />}
          {title}
        </h2>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
export function Sparkline({
  data,
  color = "#849b50",
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data),
    min = Math.min(...data),
    points = data
      .map(
        (d, i) =>
          `${(i / (data.length - 1)) * 90},${27 - ((d - min) / Math.max(1, max - min)) * 22}`,
      )
      .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 94 32"
      aria-label="Tendencia de consumo semanal"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Metric({
  label,
  value,
  icon: Icon,
  detail,
  accent = false,
  children,
}: {
  label: string;
  value: string | number;
  icon: any;
  detail: React.ReactNode;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`metric ${accent ? "accent" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <div className="metric-value">
        {value}
        {children}
      </div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  [key: string]: any;
}) {
  return (
    <label className="form-field">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...rest}
      />
    </label>
  );
}
export function SelectField({
  label,
  name,
  children,
  value,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  value?: string;
}) {
  return (
    <label className="form-field">
      {label}
      <select name={name} defaultValue={value} required>
        {children}
      </select>
    </label>
  );
}
export function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]),
    cell = (v: any) => {
      let text = String(v ?? "");
      if (typeof v === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    };
  return (
    "\uFEFF" +
    [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function download(name: string, text: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([text], {
        type: name.endsWith(".json")
          ? "application/json"
          : "text/csv;charset=utf-8",
      }),
    );
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
