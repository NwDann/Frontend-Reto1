import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { State } from "../lib/model.ts";
import { reportData, REPORTS } from "./report-data.ts";
import type { ReportType, ReportSection, Cell } from "./report-data.ts";
export function safeCSV(value: Cell) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
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
export async function buildExcel(s: State, type: ReportType) {
  const book = new ExcelJS.Workbook();
  book.creator = "Optilogic · Nexo";
  book.created = new Date();
  book.subject = REPORTS[type];
  const used = new Set<string>();
  for (const section of reportData(s, type)) {
    let name = section.title.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31),
      n = 1;
    while (used.has(name)) {
      name = section.title.slice(0, 27) + " " + n++;
    }
    used.add(name);
    const sheet = book.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    sheet.addRow([section.title]);
    sheet.mergeCells(1, 1, 1, section.columns.length);
    sheet.getRow(1).font = {
      size: 17,
      bold: true,
      color: { argb: "FF0F766E" },
    };
    sheet.addRow([
      `${s.company.name} · Corte ${s.updatedAt} · ${s.company.demo ? "DATOS SINTÉTICOS" : "Datos registrados"}`,
    ]);
    sheet.mergeCells(2, 1, 2, section.columns.length);
    sheet.addRow([
      section.note ||
        "Cantidades y unidades según los registros. Importes en USD.",
    ]);
    sheet.mergeCells(3, 1, 3, section.columns.length);
    sheet.getRow(3).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(3).height = 42;
    const header = sheet.addRow(section.columns);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF142B37" },
    };
    header.height = 24;
    for (const row of section.rows) {
      const r = sheet.addRow(row);
      r.alignment = { vertical: "top", wrapText: true };
      if (r.number % 2 === 1)
        r.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F7F6" },
        };
      r.eachCell((cell, col) => {
        if (typeof cell.value === "number") {
          cell.numFmt = /USD/.test(section.columns[col - 1])
            ? '"$"#,##0.00'
            : "#,##0.00";
        }
      });
      if (section.title === "Inventario") {
        const stock = section.columns.indexOf("Stock") + 1,
          price = section.columns.indexOf("Precio por unidad USD") + 1,
          total = section.columns.indexOf("Valor stock USD") + 1;
        r.getCell(total).value = {
          formula: `${r.getCell(stock).address}*${r.getCell(price).address}`,
          result: Number(row[total - 1]),
        };
      }
    }
    sheet.columns.forEach((col, i) => {
      col.width = Math.min(48, Math.max(17, section.columns[i].length + 2));
    });
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, sheet.rowCount), column: section.columns.length },
    };
    sheet.pageSetup.printTitlesRow = "1:4";
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const pdfText = (v: Cell) =>
  (typeof v === "number"
    ? new Intl.NumberFormat("es-EC", { maximumFractionDigits: 6 }).format(v)
    : String(v ?? "—")
  )
    .replace(/→/g, " > ")
    .replace(/[–—]/g, "-")
    .replace(/·/g, " | ");
export function buildPDF(s: State, type: ReportType) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  doc.setProperties({
    title: `${REPORTS[type]} · ${s.company.name}`,
    author: "Optilogic · Nexo",
    subject: "Reporte operativo",
  });
  let first = true;
  for (const section of reportData(s, type)) {
    const columnGroups: number[][] = [];
    if (section.columns.length <= 8)
      columnGroups.push(section.columns.map((_, i) => i));
    else
      for (let i = 1; i < section.columns.length; i += 7)
        columnGroups.push([
          0,
          ...section.columns.map((_, j) => j).slice(i, i + 7),
        ]);
    for (let part = 0; part < columnGroups.length; part++) {
      if (!first) doc.addPage();
      first = false;
      const cols = columnGroups[part];
      const heading = () => {
        doc.setTextColor(15, 118, 110);
        doc.setFontSize(16);
        doc.text(
          pdfText(section.title) +
            (columnGroups.length > 1
              ? ` (${part + 1}/${columnGroups.length})`
              : ""),
          12,
          14,
        );
        doc.setTextColor(50, 65, 75);
        doc.setFontSize(9);
        doc.text(
          pdfText(
            `${s.company.name} · ${s.company.demo ? "Datos sintéticos · " : ""}Corte: ${s.updatedAt}`,
          ),
          12,
          21,
        );
      };
      autoTable(doc, {
        head: [cols.map((i) => pdfText(section.columns[i]))],
        body: section.rows.length
          ? section.rows.map((r) => cols.map((i) => pdfText(r[i])))
          : [cols.map((_, i) => (i === 0 ? "Sin registros" : ""))],
        margin: { top: 27, left: 12, right: 12, bottom: 18 },
        tableWidth: 273,
        columnStyles: Object.fromEntries(
          cols.map((_, i) => [i, { cellWidth: 273 / cols.length }]),
        ),
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.1,
          overflow: "linebreak",
        },
        headStyles: { fillColor: [20, 43, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [241, 247, 246] },
        didDrawPage: heading,
      });
      if (section.note) {
        let y = (doc as any).lastAutoTable.finalY + 5;
        const lines = doc.splitTextToSize(pdfText(section.note), 270);
        if (y + lines.length * 3.4 > 190) {
          doc.addPage();
          heading();
          y = 30;
        }
        doc.setFontSize(8);
        doc.setTextColor(65, 80, 90);
        doc.text(lines, 12, y);
      }
    }
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text("Optilogic · Nexo | Reporte de gestión | USD", 12, 202);
    doc.text(`${p} / ${pages}`, 280, 202, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
export async function exportReport(
  s: State,
  type: ReportType,
  format: "xlsx" | "pdf" | "csv" | "json",
) {
  let bytes: BlobPart, typeMime: string;
  if (format === "xlsx") {
    bytes = (await buildExcel(s, type)).buffer as ArrayBuffer;
    typeMime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "pdf") {
    bytes = buildPDF(s, type).buffer as ArrayBuffer;
    typeMime = "application/pdf";
  } else if (format === "csv") {
    bytes = buildCSV(reportData(s, type));
    typeMime = "text/csv;charset=utf-8";
  } else {
    bytes = JSON.stringify(
      {
        company: s.company,
        generatedAt: new Date().toISOString(),
        report: type,
        sections: reportData(s, type),
      },
      null,
      2,
    );
    typeMime = "application/json";
  }
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([bytes], { type: typeMime }));
  a.href = url;
  a.download = `optilogic-${s.company.id}-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
