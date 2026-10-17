import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ReportSection, Cell, ReportType } from "../lib/report-data.ts";
import { reportSections } from "../lib/report-data.ts";
import type { Snapshot } from "../lib/models.ts";
export function safeCSV(value: Cell) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function buildCSV(sections: ReportSection[]) {
  return (
    "\uFEFF" +
    sections
      .map((s) =>
        [
          safeCSV(s.title),
          s.columns.map(safeCSV).join(","),
          ...s.rows.map((r) => r.map(safeCSV).join(",")),
        ].join("\r\n"),
      )
      .join("\r\n\r\n")
  );
}
export async function buildExcel(
  sections: ReportSection[],
  source = "FastAPI",
) {
  const book = new ExcelJS.Workbook();
  book.creator = "Optilogic · Nexo";
  book.created = new Date();
  const used = new Set<string>();
  for (const section of sections) {
    let name = section.title.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31),
      n = 1;
    while (used.has(name)) name = section.title.slice(0, 27) + " " + n++;
    used.add(name);
    const sheet = book.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    sheet.addRow([section.title]);
    sheet.mergeCells(1, 1, 1, section.columns.length);
    sheet.getRow(1).font = {
      bold: true,
      size: 17,
      color: { argb: "FF0F766E" },
    };
    sheet.addRow([`Origen: ${source} · Generado: ${new Date().toISOString()}`]);
    sheet.mergeCells(2, 1, 2, section.columns.length);
    sheet.addRow([
      section.note ||
        "Datos consultados del backend y cálculos identificados en sus columnas.",
    ]);
    sheet.mergeCells(3, 1, 3, section.columns.length);
    sheet.getRow(3).height = 38;
    sheet.getRow(3).alignment = { wrapText: true };
    const header = sheet.addRow(section.columns);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF142B37" },
    };
    header.height = 25;
    for (const values of section.rows) {
      const row = sheet.addRow(values);
      row.alignment = { wrapText: true, vertical: "top" };
      if (row.number % 2)
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F7F6" },
        };
      row.eachCell((cell, col) => {
        if (typeof cell.value === "number")
          cell.numFmt = /USD/.test(section.columns[col - 1])
            ? '"$"#,##0.00'
            : "#,##0.####";
      });
      if (section.title === "Inventario")
        row.getCell(8).value = {
          formula: `E${row.number}*G${row.number}`,
          result: Number(values[7]),
        };
    }
    sheet.columns.forEach(
      (col, i) =>
        (col.width = Math.min(48, Math.max(17, section.columns[i].length + 2))),
    );
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, sheet.rowCount), column: section.columns.length },
    };
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const pdfText = (value: Cell) =>
  (typeof value === "number"
    ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: 6 }).format(value)
    : String(value ?? "—")
  )
    .replace(/[–—]/g, "-")
    .replace(/→/g, " > ");
export function buildPDF(sections: ReportSection[], source = "FastAPI") {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.setProperties({
    title: "Optilogic · Registros del backend",
    author: "Optilogic · Nexo",
  });
  let first = true;
  for (const section of sections) {
    const groups: number[][] = [];
    if (section.columns.length <= 8)
      groups.push(section.columns.map((_, i) => i));
    else
      for (let i = 1; i < section.columns.length; i += 7)
        groups.push([0, ...section.columns.map((_, j) => j).slice(i, i + 7)]);
    groups.forEach((cols, part) => {
      if (!first) doc.addPage();
      first = false;
      const heading = () => {
        doc.setTextColor(15, 118, 110);
        doc.setFontSize(16);
        doc.text(
          pdfText(section.title) +
            (groups.length > 1 ? ` (${part + 1}/${groups.length})` : ""),
          12,
          14,
        );
        doc.setFontSize(8);
        doc.setTextColor(60);
        doc.text(
          doc
            .splitTextToSize(
              pdfText(`Fuente: ${source} · ${new Date().toISOString()}`),
              273,
            )
            .slice(0, 2),
          12,
          20,
        );
      };
      autoTable(doc, {
        head: [cols.map((i) => section.columns[i])],
        body: section.rows.length
          ? section.rows.map((row) => cols.map((i) => pdfText(row[i])))
          : [cols.map((_, i) => (i ? "" : "Sin registros"))],
        margin: { top: 28, left: 12, right: 12, bottom: 18 },
        tableWidth: 273,
        columnStyles: Object.fromEntries(
          cols.map((_, i) => [i, { cellWidth: 273 / cols.length }]),
        ),
        styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
        headStyles: { fillColor: [20, 43, 55] },
        alternateRowStyles: { fillColor: [240, 247, 246] },
        didDrawPage: heading,
      });
      if (section.note) {
        let y = (doc as any).lastAutoTable.finalY + 5;
        const lines = doc.splitTextToSize(pdfText(section.note), 270);
        if (y + lines.length * 3.4 > 188) {
          doc.addPage();
          heading();
          y = 30;
        }
        doc.setTextColor(65);
        doc.setFontSize(8);
        doc.text(lines, 12, y);
      }
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      "Optilogic · Nexo | USD cuando se indica | Fuentes y supuestos identificados",
      12,
      202,
    );
    doc.text(`${i}/${pages}`, 280, 202, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
export async function exportTables(
  sections: ReportSection[],
  format: "xlsx" | "pdf" | "csv" | "json",
  name = "reporte",
  source = "FastAPI",
) {
  let data: BlobPart, mime: string;
  if (format === "xlsx") {
    data = (await buildExcel(sections, source)).buffer as ArrayBuffer;
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "pdf") {
    data = buildPDF(sections, source).buffer as ArrayBuffer;
    mime = "application/pdf";
  } else if (format === "csv") {
    data = buildCSV(sections);
    mime = "text/csv;charset=utf-8";
  } else {
    data = JSON.stringify(
      { source, generatedAt: new Date().toISOString(), sections },
      null,
      2,
    );
    mime = "application/json";
  }
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([data], { type: mime }));
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export async function exportSnapshot(
  s: Snapshot,
  type: ReportType,
  format: "xlsx" | "pdf" | "csv" | "json",
  source: string,
) {
  const sections = reportSections(s, type);
  sections.unshift({
    title: "Fuentes y actualización",
    columns: ["Recurso", "Consultado ISO", "Error"],
    rows: Object.keys({ ...s.loadedAt, ...s.errors }).map((key) => [
      key,
      s.loadedAt[key as keyof typeof s.loadedAt] || null,
      s.errors[key as keyof typeof s.errors] || null,
    ]),
    note: "Un recurso con error no se considera un catálogo vacío ni se sustituye con datos sintéticos.",
  });
  await exportTables(sections, format, `optilogic-${type}`, source);
}
