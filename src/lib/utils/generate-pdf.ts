interface PdfColumn {
  header: string;
  key: string;
}

interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  data: Record<string, string | number>[];
  orientation?: "portrait" | "landscape";
  companyName?: string;
  companySubtitle?: string;
  /** Brand accent color (#hex) from Settings → Branding. Defaults to classic purple. */
  accent?: string;
  /** Row-data key holding an image (data URL or URL) — rendered as a photo column. */
  imageKey?: string;
  /** Header label for the photo column. */
  imageHeader?: string;
}

const DEFAULT_ACCENT = "#9333ea";
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Column keys whose values are centred horizontally in exported PDF tables
 * (SN, codes, phone, class, roll, status…). Everything else — names,
 * institution, father, mother — stays left-aligned. Shared with the
 * in-modal HTML preview so preview and downloaded PDF agree.
 */
export const PDF_CENTER_KEYS = new Set<string>([
  "sn",
  "regNumber",
  "registrationNumber",
  "phone",
  "gender",
  "class",
  "roll",
  "status",
  "amount",
  "marks",
  "score",
  "gpa",
  "grade",
  "total",
]);

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const rgbStr = (c: Rgb) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

export interface AccentPalette {
  hex: string;
  rgb: Rgb;
  /** Darkened accent — header cell borders. */
  dark: string;
  darkRgb: Rgb;
  /** Accent mixed with white (35%) — body cell borders. */
  light: string;
  lightRgb: Rgb;
  /** Accent mixed with white (10%) — alternate row fill. */
  tint: string;
  tintRgb: Rgb;
  /** Text drawn ON the accent fill (dark text only for very light accents). */
  onHex: string;
  onRgb: Rgb;
}

/** Accent palette shared by the PDF generator and the in-app preview so they match. */
export function accentPalette(accent?: string): AccentPalette {
  const hex = accent && HEX_RE.test(accent.trim()) ? accent.trim() : DEFAULT_ACCENT;
  const [r, g, b] = hexToRgb(hex);
  const mix = (v: number, amount: number) => Math.round(v * amount + 255 * (1 - amount));
  const darkRgb: Rgb = [Math.round(r * 0.72), Math.round(g * 0.72), Math.round(b * 0.72)];
  const lightRgb: Rgb = [mix(r, 0.35), mix(g, 0.35), mix(b, 0.35)];
  const tintRgb: Rgb = [mix(r, 0.1), mix(g, 0.1), mix(b, 0.1)];
  // Perceived luminance — near-white accents need dark text on top.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const onRgb: Rgb = lum > 0.8 ? [30, 30, 30] : [255, 255, 255];
  return {
    hex,
    rgb: [r, g, b],
    dark: rgbStr(darkRgb),
    darkRgb,
    light: rgbStr(lightRgb),
    lightRgb,
    tint: rgbStr(tintRgb),
    tintRgb,
    onHex: rgbStr(onRgb),
    onRgb,
  };
}

/** Load any image (data URL or remote URL), center-crop to a square PNG thumbnail. */
async function imageToPng(src: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
    const S = 160;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - min) / 2,
      (img.naturalHeight - min) / 2,
      min,
      min,
      0,
      0,
      S,
      S
    );
    return canvas.toDataURL("image/png");
  } catch {
    return null; // a broken photo never breaks the export
  }
}

// Kalpurush (Bangla) — base64 fetched once, but jsPDF's VFS/font state is PER
// DOCUMENT: every generated doc must re-register the font itself. The old
// module-level "loaded" flag left the 2nd+ PDF with no font at all, which came
// out as garbage (¬¾¼…) after download.
let fontBase64: string | null = null;

async function loadFont(doc: any) {
  if (!fontBase64) {
    const response = await fetch("/fonts/kalpurush.ttf");
    const buffer = await response.arrayBuffer();

    const fontBytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < fontBytes.length; i++) {
      binary += String.fromCharCode(fontBytes[i]);
    }
    fontBase64 = btoa(binary);
  }

  doc.addFileToVFS("kalpurush.ttf", fontBase64);
  doc.addFont("kalpurush.ttf", "Kalpurush", "normal");
  // Titles and autotable headers request bold — register it too, otherwise
  // jsPDF silently falls back to Helvetica, which has no Bengali glyphs.
  doc.addFont("kalpurush.ttf", "Kalpurush", "bold");
}

export async function generatePdf(options: GeneratePdfOptions) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const {
    title,
    subtitle,
    columns,
    data,
    orientation = "portrait",
    companyName = "Bangladesh Madrasah Association",
    companySubtitle = "বাংলাদেশ মাদ্রাসা এসোসিয়েশন",
    accent,
    imageKey,
    imageHeader = "Photo",
  } = options;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await loadFont(doc);

  const FONT = "Kalpurush";

  const pal = accentPalette(accent);
  const primary = pal.rgb;
  const textDark: Rgb = [30, 30, 30];
  const textMuted: Rgb = [120, 120, 120];

  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 18, "F");

  doc.setTextColor(...pal.onRgb);
  doc.setFont(FONT, "bold");
  doc.setFontSize(14);
  doc.text(companyName, 14, 10);
  doc.setFontSize(8);
  doc.setFont(FONT, "normal");
  doc.text(companySubtitle, 14, 15);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFontSize(8);
  doc.text(`Printed: ${dateStr}`, pageWidth - 14, 8, { align: "right" });
  doc.text(`Total: ${data.length} records`, pageWidth - 14, 12, { align: "right" });
  doc.text(`A4 · ${orientation}`, pageWidth - 14, 16, { align: "right" });

  let yPos = 28;
  doc.setTextColor(...textDark);
  doc.setFont(FONT, "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - 28);
  doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
  yPos += titleLines.length * 7;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.setTextColor(...textMuted);
    doc.text(subtitle, pageWidth / 2, yPos + 2, { align: "center" });
    yPos += 8;
  }

  yPos += 4;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  // Photo column — only when at least one row actually has an image.
  const withImage = Boolean(imageKey && data.some((row) => String(row[imageKey] ?? "").trim()));
  const imgSrcs = new Map<number, string>();
  if (withImage && imageKey) {
    const cache = new Map<string, string | null>();
    for (let i = 0; i < data.length; i++) {
      const raw = String(data[i][imageKey] ?? "").trim();
      if (!raw) continue;
      let png = cache.get(raw);
      if (png === undefined) {
        png = await imageToPng(raw);
        cache.set(raw, png);
      }
      if (png) imgSrcs.set(i, png);
    }
  }

  const tableHeaders = columns.map((c) => c.header.toUpperCase());
  const tableData = data.map((row, idx) => {
    return [
      String(idx + 1),
      ...(withImage ? [""] : []),
      ...columns.map((c) => String(row[c.key] ?? "")),
    ];
  });

  // ── Cell alignment — same formula as the admit-card PDF ───────────────
  // Every cell centres its content vertically (admit card = flex
  // alignItems:center). Horizontally: code/short values sit centred,
  // long text (name, institution, father, mother) stays left-aligned so
  // rows read cleanly.
  const columnStyles: any = {
    0: { halign: "center", cellWidth: 10, valign: "middle" },
  };
  if (withImage) columnStyles[1] = { halign: "center", cellWidth: 16, valign: "middle" };
  const firstDataCol = withImage ? 2 : 1;
  columns.forEach((c, i) => {
    columnStyles[firstDataCol + i] = {
      halign: PDF_CENTER_KEYS.has(c.key) ? "center" : "left",
      valign: "middle",
    };
  });

  autoTable(doc, {
    startY: yPos,
    head: [["#", ...(withImage ? [imageHeader.toUpperCase()] : []), ...tableHeaders]],
    body: tableData,
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: 8,
      cellPadding: 3,
      textColor: textDark,
      lineColor: pal.lightRgb,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: primary,
      textColor: pal.onRgb,
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: pal.tintRgb,
    },
    columnStyles,
    bodyStyles: { valign: "middle", ...(withImage ? { minCellHeight: 16 } : {}) },
    margin: { left: 14, right: 14 },
    ...(withImage
      ? {
          didDrawCell: (data: any) => {
            if (data.section !== "body" || data.column.index !== 1) return;
            const png = imgSrcs.get(data.row.index);
            if (!png) return;
            try {
              const props = doc.getImageProperties(png);
              const maxW = data.cell.width - 4;
              const maxH = data.cell.height - 4;
              let w = maxW;
              let h = (maxW * props.height) / props.width;
              if (h > maxH) {
                h = maxH;
                w = (maxH * props.width) / props.height;
              }
              doc.addImage(
                png,
                "PNG",
                data.cell.x + (data.cell.width - w) / 2,
                data.cell.y + (data.cell.height - h) / 2,
                w,
                h
              );
            } catch {
              // skip broken image
            }
          },
        }
      : {}),
    didDrawPage: (data) => {
      const footerY = pageHeight - 10;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.setFont(FONT, "normal");
      doc.text("Powered by ScholarX", 14, footerY);
      doc.text(`Page ${data.pageNumber}`, pageWidth / 2, footerY, { align: "center" });

      const sigY = footerY;
      const mid = pageWidth / 2;
      doc.text("Principal", mid - 20, sigY + 6);
      doc.line(mid - 35, sigY + 4, mid - 5, sigY + 4);
      doc.text("Office Seal", mid + 30, sigY + 6);
      doc.line(mid + 15, sigY + 4, mid + 50, sigY + 4);
    },
  });

  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}_${dateStr.replace(/\//g, "-")}.pdf`);
}
