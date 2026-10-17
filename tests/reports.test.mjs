import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { snapshot } from "./fixtures.mjs";
import { reportSections } from "../src/lib/report-data.ts";
import { buildExcel, buildPDF, buildCSV } from "../src/services/reports.ts";
test("Excel writes actual numeric inventory and a valuation formula without invented locations", async () => {
  const s = snapshot(),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(
    Buffer.from(
      await buildExcel(reportSections(s, "inventory"), "API de prueba"),
    ),
  );
  const sheet = book.getWorksheet("Inventario");
  assert.equal(sheet.getCell("E5").value, 12);
  assert.deepEqual(sheet.getCell("H5").value, {
    formula: "E5*G5",
    result: 180,
  });
  assert.equal(
    book.worksheets.some((s) => s.name.includes("bodega")),
    false,
  );
});
test("PDF output is real and report cells preserve all schema columns", () => {
  const sections = reportSections(snapshot(), "all");
  for (const section of sections)
    for (const row of section.rows)
      assert.equal(row.length, section.columns.length, section.title);
  const pdf = Buffer.from(buildPDF(sections));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.match(pdf.toString("latin1"), /\/Type \/Page\b/);
});
test("CSV protects formula-like text while numeric negatives remain numbers", () => {
  const csv = buildCSV([
    {
      title: "Ejemplo",
      columns: ["Texto", "Número"],
      rows: [['=HYPERLINK("x")', -1]],
    },
  ]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"-1"/);
});
