import { strToU8, zipSync } from "fflate";

export interface ExcelColumn {
  /** Column heading shown in row 1. */
  header: string;
  /** Key into each row object. */
  key: string;
  /** Optional fixed width (Excel character units). Auto-sized when omitted. */
  width?: number;
}

export type ExcelRow = Record<string, string | number | null | undefined>;

/** XML 1.0 forbids most control characters — strip them, then escape. */
function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0-based column index -> A, B … Z, AA, AB … */
function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function safeSheetName(name: string): string {
  const cleaned = String(name || "Sheet1").replace(/[\\/?*[\]:]/g, "-").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

/**
 * Build a real .xlsx workbook (Office Open XML) with no external library.
 * One sheet, a bold frozen header row and an auto-filter. Values are written
 * as inline strings so codes such as registration numbers keep leading zeros.
 */
export function buildExcelFile({
  sheetName,
  columns,
  rows,
}: {
  sheetName: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
}): Uint8Array {
  if (columns.length === 0) throw new Error("Excel export needs at least one column");

  const headerCells = columns.map((col, ci) => {
    const ref = `${columnName(ci)}1`;
    return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(col.header)}</t></is></c>`;
  }).join("");

  const bodyRows = rows.map((row, ri) => {
    const cells = columns.map((col, ci) => {
      const ref = `${columnName(ci)}${ri + 2}`;
      const value = row[col.key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return `<c r="${ref}"><v>${value}</v></c>`;
      }
      const text = value === null || value === undefined ? "" : String(value);
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 2}">${cells}</row>`;
  }).join("");

  const widths = columns.map((col, ci) => {
    const sample = rows.reduce((max, row) => {
      const v = row[col.key];
      return Math.max(max, v === null || v === undefined ? 0 : String(v).length);
    }, 0);
    const width = col.width ?? Math.max(10, Math.min(45, Math.max(col.header.length, sample) + 2));
    return `<col min="${ci + 1}" max="${ci + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const lastRef = `${columnName(columns.length - 1)}${rows.length + 1}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<cols>${widths}</cols>
<sheetData><row r="1">${headerCells}</row>${bodyRows}</sheetData>
<autoFilter ref="A1:${lastRef}"/>
</worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rootRels),
      "xl/workbook.xml": strToU8(workbook),
      "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
      "xl/styles.xml": strToU8(styles),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    },
    { level: 6 }
  );
}

/** Build and download an .xlsx file in the browser. */
export function downloadExcel({
  filename,
  sheetName,
  columns,
  rows,
}: {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
}): void {
  const bytes = buildExcelFile({ sheetName, columns, rows });
  // Copy into a plain ArrayBuffer — a Uint8Array typed over a possibly
  // SharedArrayBuffer is not accepted as a BlobPart.
  const buffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
