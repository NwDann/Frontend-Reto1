import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { initialState } from "../src/lib/model.ts";
import { upgradeState } from "../src/lib/logistics.ts";
import { reportData } from "../src/services/report-data.ts";
import { buildExcel, buildPDF, buildCSV } from "../src/services/reports.ts";
const s = upgradeState(initialState());
test("Excel is a real workbook with numeric quantities, formulas and every location balance", async () => {
  const bytes = await buildExcel(s, "inventory");
  assert.equal(Buffer.from(bytes.slice(0, 2)).toString(), "PK");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes));
  const inventory = book.getWorksheet("Inventario");
  assert.equal(inventory.rowCount, s.items.length + 4);
  assert.equal(inventory.getCell("F5").value, s.items[0].stock_actual);
  assert.equal(inventory.getCell("J5").value.formula, "F5*I5");
  assert.equal(
    book.getWorksheet("Stock por ubicación").rowCount,
    s.enterprise.balances.length + 4,
  );
});
test("PDF contains a valid signature and summary report pages", () => {
  const bytes = buildPDF(s, "all"),
    text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-"));
  assert.match(text, /\/Type \/Page\b/);
  assert.ok(bytes.length > 5000);
});
test("CSV escapes formula-like text and does not change numeric negatives", () => {
  const text = buildCSV([
    {
      title: "Prueba",
      columns: ["Texto", "Número"],
      rows: [
        ['=IMPORTXML("x")', -12],
        ["@SUM(1)", 2],
      ],
    },
  ]);
  assert.ok(text.includes("\"'=IMPORTXML"));
  assert.ok(text.includes('"-12"'));
});
test("All report columns have corresponding cells and real companies have no synthetic forecasts", () => {
  for (const section of reportData(s, "all")) {
    assert.ok(section.columns.length > 0);
    for (const row of section.rows)
      assert.equal(row.length, section.columns.length, section.title);
  }
  const empty = upgradeState(initialState("real", "Real", false));
  assert.equal(reportData(empty, "demand")[0].rows.length, 0);
});
