// Tabulation mark-sheet export — one A4-landscape sheet per class, carrying
// the SAME watermark every other ScholarX PDF uses (the shared drawWatermark:
// 130mm seal, 35% opacity, flat, centred behind the content). jsPDF +
// jspdf-autotable are imported on demand so they stay out of the page bundle
// (same code-splitting rule as admit-card-pdf.ts).

import {
  FONT_NAME,
  accentPalette,
  drawWatermark,
  loadFont,
  loadWatermarkImage,
} from "@/lib/utils/generate-pdf";

export interface TabulationSubject {
  id: string;
  name: string;
  fullMarks: number;
}

export interface TabulationRow {
  roll: string;
  registration: string;
  student: string;
  institution: string;
  /** subjectId → obtained mark (null/undefined = not entered). */
  marks: Record<string, number | null>;
  total: number;
  totalFull: number;
  /** Average grade points of the subjects (0–5, 2dp); null when the grade
   *  scale is not configured. */
  gpa: number | null;
  /** Class-wide rank across ALL institutions; 0 = unranked. */
  position: number;
}

export interface TabulationSheet {
  className: string;
  subjects: TabulationSubject[];
  rows: TabulationRow[];
}

/** UI-localized strings — built by the caller with bi() so the PDF follows
 *  the active language exactly like the export modal does. */
export interface TabulationLabels {
  title: string; // "Tabulation Marks Sheet"
  classLabel: string;
  examLabel: string;
  sessionLabel: string;
  candidatesLabel: string;
  subjectsLabel: string;
  roll: string;
  reg: string;
  student: string;
  institution: string;
  total: string;
  gpa: string;
  position: string;
  absent: string;
}

export interface TabulationPdfOptions {
  examName: string;
  sessionName?: string;
  sheets: TabulationSheet[];
  companyName?: string;
  companySubtitle?: string;
  accent?: string;
  watermark?: string;
  watermarkText?: string;
  labels: TabulationLabels;
}

export async function exportTabulationPdf(options: TabulationPdfOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const {
    examName,
    sessionName,
    sheets,
    companyName = "Bangladesh Madrasah Association",
    companySubtitle = "",
    accent,
    watermark,
    watermarkText,
    labels,
  } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth(); // 297
  const pageH = doc.internal.pageSize.getHeight(); // 210

  await loadFont(doc);
  const pal = accentPalette(accent);
  const primary = pal.rgb;
  const textDark: [number, number, number] = [30, 30, 30];
  const textMuted: [number, number, number] = [120, 120, 120];

  const wmImg = watermark ? await loadWatermarkImage(watermark) : null;
  const wmText = wmImg
    ? ""
    : watermarkText ||
      companyName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

  const MARGIN_X = 10;
  const BAND_H = 15;
  const TITLE_Y = 23;
  const INFO_Y = 28.5;
  const TABLE_TOP = 33;

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  /** Watermark → brand band → title block. Drawn BEFORE the table content of
   *  the page it belongs to (willDrawPage fires for page 1 too, so callers
   *  draw this once manually and the hook covers continuation pages). */
  const drawChrome = (sheet: TabulationSheet, candidates: number, subjectsCount: number) => {
    drawWatermark(doc, pageW, pageH, wmImg, wmText);

    doc.setFillColor(...primary);
    doc.rect(0, 0, pageW, BAND_H, "F");
    doc.setTextColor(...pal.onRgb);
    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(13);
    doc.text(companyName, MARGIN_X, 8.5);
    if (companySubtitle) {
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(7.5);
      doc.text(companySubtitle, MARGIN_X, 13);
    }
    doc.setFontSize(7.5);
    doc.text(`Printed: ${dateStr}`, pageW - MARGIN_X, 8.5, { align: "right" });
    doc.text(examName, pageW - MARGIN_X, 13, { align: "right" });

    doc.setTextColor(...textDark);
    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(12);
    doc.text(`${labels.title} — ${sheet.className}`, pageW / 2, TITLE_Y, {
      align: "center",
    });

    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    const info = [
      `${labels.classLabel}: ${sheet.className}`,
      `${labels.examLabel}: ${examName}`,
      sessionName ? `${labels.sessionLabel}: ${sessionName}` : null,
      `${labels.candidatesLabel}: ${candidates}`,
      `${labels.subjectsLabel}: ${subjectsCount}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(info, pageW / 2, INFO_Y, { align: "center" });
    doc.setDrawColor(...pal.lightRgb);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, TABLE_TOP - 3, pageW - MARGIN_X, TABLE_TOP - 3);
  };

  let first = true;
  for (const sheet of sheets) {
    if (sheet.rows.length === 0) continue;
    if (!first) doc.addPage();
    first = false;

    drawChrome(sheet, sheet.rows.length, sheet.subjects.length);

    const subjectStart = 5; // #, roll, reg, student, institution
    const columnStyles: any = {
      0: { halign: "center", cellWidth: 8, valign: "middle" },
      1: { halign: "center", cellWidth: 13, valign: "middle" },
      2: { halign: "center", cellWidth: 24, valign: "middle" },
      3: { halign: "left", valign: "middle" },
      4: { halign: "left", valign: "middle" },
    };
    sheet.subjects.forEach((_, i) => {
      columnStyles[subjectStart + i] = { halign: "center", cellWidth: 15, valign: "middle" };
    });
    const tail = subjectStart + sheet.subjects.length;
    columnStyles[tail] = { halign: "center", cellWidth: 16, valign: "middle" }; // total
    columnStyles[tail + 1] = { halign: "center", cellWidth: 11, valign: "middle" }; // gpa
    // 16mm so the English "Position" header fits on one line (10mm broke it
    // mid-word: "Positi / on"); the narrowed student+institution columns
    // simply wrap to two lines, which reads fine.
    columnStyles[tail + 2] = { halign: "center", cellWidth: 16, valign: "middle" }; // position

    const head = [
      "#",
      labels.roll,
      labels.reg,
      labels.student,
      labels.institution,
      ...sheet.subjects.map((s) => `${s.name}\n${s.fullMarks}`),
      labels.total,
      labels.gpa,
      labels.position,
    ];

    const body = sheet.rows.map((row, index) => [
      String(index + 1),
      row.roll || "—",
      row.registration || "—",
      row.student,
      row.institution,
      ...sheet.subjects.map((s) => {
        const mark = row.marks[s.id];
        return mark === null || mark === undefined ? labels.absent : String(mark);
      }),
      `${row.total}/${row.totalFull}`,
      row.gpa === null ? "—" : row.gpa.toFixed(2),
      row.position > 0 ? String(row.position) : "—",
    ]);

    autoTable(doc, {
      startY: TABLE_TOP,
      head: [head],
      body,
      theme: "grid",
      styles: {
        font: FONT_NAME,
        fontSize: 7.5,
        cellPadding: 1.8,
        textColor: textDark,
        lineColor: pal.lightRgb,
        lineWidth: 0.2,
        // Transparent cells — autotable's opaque white fill would erase the
        // watermark behind the table (same rule as generate-pdf).
        fillColor: false,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: primary,
        textColor: pal.onRgb,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
        valign: "middle",
      },
      columnStyles,
      bodyStyles: { valign: "middle" },
      margin: { left: MARGIN_X, right: MARGIN_X, top: TABLE_TOP, bottom: 14 },
      // Continuation pages: seal first, then band/title, then rows paint over.
      willDrawPage: (data: any) => {
        if (data.pageNumber > 1) drawChrome(sheet, sheet.rows.length, sheet.subjects.length);
      },
    });
  }

  // Footer pass — page numbers need the final page count.
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageH - 8;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, footerY - 4, pageW - MARGIN_X, footerY - 4);
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text("Powered by ScholarX", MARGIN_X, footerY);
    doc.text(`Page ${i} / ${totalPages}`, pageW / 2, footerY, { align: "center" });
  }

  const safeExam = examName.replace(/\s+/g, "_").toLowerCase();
  doc.save(`tabulation_mark_sheets_${safeExam}_${dateStr.replace(/\//g, "-")}.pdf`);
}
