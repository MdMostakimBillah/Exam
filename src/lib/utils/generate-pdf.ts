interface PdfColumn {
  header: string;
  key: string;
}

export interface GeneratePdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  data: Record<string, string | number>[];
  orientation?: "portrait" | "landscape";
  companyName?: string;
  companySubtitle?: string;
  /** Logo image URL or data URL drawn on the top left of the header. */
  logo?: string;
  /** Short text crest used when logo image is absent (e.g. "BMA"). */
  logoText?: string;
  /** Brand accent color (#hex) from Settings → Branding. Defaults to classic purple. */
  accent?: string;
  /** Branding watermark image URL — drawn big, centred, 35% opacity behind
   *  EVERY page (same asset the admit card uses). Empty → text watermark. */
  watermark?: string;
  /** Short crest text used when there is no watermark image (e.g. "BMA"). */
  watermarkText?: string;
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
  "dob",
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

// Noto Sans Bengali (Google Fonts) — the Bangla family every PDF renders with.
// Hind Siliguri (Google Fonts) — the clean, modern Bangla family every PDF renders with.
// The HTML/print side loads it from Google Fonts (@import in globals.css);
// jsPDF cannot read CSS fonts, so the same family's TTF is embedded from
// /public/fonts instead. Base64 is fetched once, but jsPDF's VFS/font state is
// PER DOCUMENT: every generated doc must re-register the font itself.
let fontBase64: string | null = null;
let fontBoldBase64: string | null = null;
const FONT_FILE = "/fonts/HindSiliguri-Regular.ttf";
const FONT_BOLD_FILE = "/fonts/HindSiliguri-Bold.ttf";
const FONT_VFS = "HindSiliguri-Regular.ttf";
const FONT_BOLD_VFS = "HindSiliguri-Bold.ttf";
/** Embedded Bangla font family — exported so sibling PDF generators
 *  (tabulation sheets) render with the same face. */
export const FONT_NAME = "HindSiliguri";

export async function loadFont(doc: any) {
  // Ensure document fonts (Hind Siliguri) are ready in the browser
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load("400 16px 'Hind Siliguri'"),
        document.fonts.load("700 16px 'Hind Siliguri'"),
      ]);
    } catch {
      // ignore
    }
  }

  if (!fontBase64) {
    const response = await fetch(FONT_FILE);
    const buffer = await response.arrayBuffer();

    const fontBytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < fontBytes.length; i++) {
      binary += String.fromCharCode(fontBytes[i]);
    }
    fontBase64 = btoa(binary);
  }

  if (!fontBoldBase64) {
    try {
      const response = await fetch(FONT_BOLD_FILE);
      const buffer = await response.arrayBuffer();
      const fontBytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < fontBytes.length; i++) {
        binary += String.fromCharCode(fontBytes[i]);
      }
      fontBoldBase64 = btoa(binary);
    } catch {
      fontBoldBase64 = fontBase64;
    }
  }

  doc.addFileToVFS(FONT_VFS, fontBase64);
  doc.addFont(FONT_VFS, FONT_NAME, "normal");
  // Titles and autotable headers request bold — register bold variant
  if (fontBoldBase64) {
    doc.addFileToVFS(FONT_BOLD_VFS, fontBoldBase64);
    doc.addFont(FONT_BOLD_VFS, FONT_NAME, "bold");
  } else {
    doc.addFont(FONT_VFS, FONT_NAME, "bold");
  }
}

// ── Bengali Text Shaping for jsPDF ─────────────────────────────────────────
// jsPDF does not have OpenType GSUB/GPOS complex script shaping (HarfBuzz),
// which causes Bengali characters, vowel marks (kars), and conjuncts to break.
// We render any string containing Bengali characters onto an offscreen canvas
// at 4x resolution (384 DPI) using the browser's native text shaping engine
// with Hind Siliguri, and insert the rasterised image directly into jsPDF.

export interface BengaliRenderResult {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  padXMm: number;
  padYMm: number;
  ascentMm: number;
}

const banglaTextCache = new Map<string, BengaliRenderResult>();

export function hasBengali(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
}

export function renderBengaliText(
  text: string,
  fontSizePt: number,
  fontStyle: "normal" | "bold" = "normal",
  textColor: Rgb = [30, 30, 30]
): BengaliRenderResult {
  const cacheKey = `${text}_${fontSizePt}_${fontStyle}_${textColor.join(",")}`;
  const cached = banglaTextCache.get(cacheKey);
  if (cached) return cached;

  if (typeof document === "undefined") {
    return { dataUrl: "", widthMm: 0, heightMm: 0, padXMm: 0, padYMm: 0, ascentMm: 0 };
  }

  const DPI_SCALE = 4;
  const basePx = fontSizePt * (96 / 72);
  const canvasFontSizePx = Math.round(basePx * DPI_SCALE);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: "", widthMm: 0, heightMm: 0, padXMm: 0, padYMm: 0, ascentMm: 0 };
  }

  const weight = fontStyle === "bold" ? "700" : "400";
  const fontDecl = `${weight} ${canvasFontSizePx}px 'Hind Siliguri', 'Noto Sans Bengali', 'Kalpurush', sans-serif`;
  ctx.font = fontDecl;

  const metrics = ctx.measureText(text);
  const textWidthPx = metrics.width;

  const ascent = metrics.actualBoundingBoxAscent || canvasFontSizePx * 0.85;
  const descent = metrics.actualBoundingBoxDescent || canvasFontSizePx * 0.25;

  const padX = 4 * DPI_SCALE;
  const padY = 2 * DPI_SCALE;

  const widthPx = Math.ceil(textWidthPx + padX * 2);
  const heightPx = Math.ceil(ascent + descent + padY * 2);

  canvas.width = Math.max(1, widthPx);
  canvas.height = Math.max(1, heightPx);

  ctx.font = fontDecl;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = `rgb(${textColor[0]}, ${textColor[1]}, ${textColor[2]})`;
  ctx.fillText(text, padX, padY + ascent);

  const mmPerPx = 25.4 / (96 * DPI_SCALE);
  const widthMm = widthPx * mmPerPx;
  const heightMm = heightPx * mmPerPx;
  const padXMm = padX * mmPerPx;
  const padYMm = padY * mmPerPx;
  const ascentMm = ascent * mmPerPx;

  const result: BengaliRenderResult = {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm,
    heightMm,
    padXMm,
    padYMm,
    ascentMm,
  };

  banglaTextCache.set(cacheKey, result);
  return result;
}

export function drawPdfText(
  doc: any,
  text: string,
  x: number,
  y: number,
  options: {
    fontSize: number;
    fontStyle?: "normal" | "bold";
    textColor?: Rgb;
    align?: "left" | "center" | "right";
  }
) {
  if (!text || !String(text).trim()) return;
  const str = String(text);
  const fontStyle = options.fontStyle || "normal";
  const fontSize = options.fontSize;
  const textColor = options.textColor || [30, 30, 30];
  const align = options.align || "left";

  if (!hasBengali(str)) {
    doc.setFont(FONT_NAME, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...textColor);
    doc.text(str, x, y, { align });
    return;
  }

  const rendered = renderBengaliText(str, fontSize, fontStyle, textColor);
  if (!rendered.dataUrl) {
    doc.setFont(FONT_NAME, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...textColor);
    doc.text(str, x, y, { align });
    return;
  }

  let drawX = x;
  if (align === "center") {
    drawX = x - rendered.widthMm / 2;
  } else if (align === "right") {
    drawX = x - rendered.widthMm + rendered.padXMm;
  } else {
    drawX = x - rendered.padXMm;
  }

  const drawY = y - (rendered.padYMm + rendered.ascentMm);

  try {
    doc.addImage(rendered.dataUrl, "PNG", drawX, drawY, rendered.widthMm, rendered.heightMm, undefined, "FAST");
  } catch {
    doc.setFont(FONT_NAME, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...textColor);
    doc.text(str, x, y, { align });
  }
}

// ── Watermark ─────────────────────────────────────────────────────────────
// Same rule as the admit card: BIG, centred, 35% opacity, under the content,
// on every page of every PDF.
const WM_OPACITY = 0.35;
const WM_ANGLE = 0; // degrees — flat/horizontal, matching the card's un-rotated
// watermark (was 30° counter-clockwise). The centring math below works for any
// angle, so only this constant changes if the tilt ever comes back.

// Admit-card parity: the card's seal is a fixed 130mm wide on the 210mm-wide
// A4 page (admit-card-template: `width: "130mm"`). Scale off the page's SHORT
// side so portrait AND landscape A4 print the seal at the identical physical
// size the admit card does — instead of the old fit-to-92%-of-page, which made
// the watermark noticeably bigger than the card's.
const WM_IMAGE_RATIO = 130 / 210; // ≈ 0.619 of the short side → 130mm on A4

// Text-crest fallback (no uploaded seal): the admit card's bordered initials
// box is ~70mm wide on A4 (90px glyphs + letter-spacing + padding), so size
// the plain text to roughly that rather than stretching it across the page.
const WM_TEXT_RATIO = 0.3; // ≈ 63mm of the 210mm short side

interface WmImage {
  dataUrl: string;
  /** height / width of the loaded bitmap. */
  aspect: number;
}
/** Exported for sibling PDF generators (tabulation sheets). */
export type { WmImage };

/** jsPDF graphics-state alpha (works for text and images alike). */
function setOpacity(doc: any, opacity: number) {
  doc.setGState(new (doc as any).GState({ opacity }));
}

/** Load the branding watermark at full size as a PNG data URL (no crop —
 *  a seal must keep its shape). CORS failure → null → text fallback.
 *  Exported for sibling PDF generators (tabulation sheets). */
export async function loadWatermarkImage(src: string): Promise<WmImage | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("watermark load failed"));
      img.src = src;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    // jsPDF embeds PNG losslessly (alpha preserved) — cap size to keep PDFs small.
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL("image/png"), aspect: h / w };
  } catch {
    return null;
  }
}

interface LogoImage {
  dataUrl: string;
  aspect: number;
}

export async function loadLogoImage(src: string): Promise<LogoImage | null> {
  if (!src || !src.trim()) return null;
  const trimmed = src.trim();
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo load failed"));
      img.src = trimmed;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), aspect: img.naturalHeight / img.naturalWidth };
  } catch {
    try {
      const res = await fetch(trimmed);
      const blob = await res.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight) return null;
      return { dataUrl, aspect: img.naturalHeight / img.naturalWidth };
    } catch {
      return null;
    }
  }
}

/**
 * Draw the watermark — centred on the page, un-rotated, 35% opacity.
 * Must be called BEFORE the page's content so the seal sits behind it.
 *
 * jsPDF's rotated addImage anchors the rotation at the rect's bottom-left
 * corner (x, y+h in PDF space), so x/y are solved for the rotated rect's
 * centre to land exactly on the page centre:
 *   centre = A + Rot(θ)·(w/2, h/2),  A = (x, H − y − h)
 */
export function drawWatermark(
  doc: any,
  pageW: number,
  pageH: number,
  img: WmImage | null,
  text: string
) {
  setOpacity(doc, WM_OPACITY);
  try {
    if (img) {
      const rad = (WM_ANGLE * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      const a = img.aspect; // h / w
      // Fixed seal size — exactly the admit card's 130mm on A4 (a square
      // seal is 130×130mm, comfortably inside both portrait 297mm and
      // landscape 210mm page heights). Centring below works for any angle.
      const w = Math.min(pageW, pageH) * WM_IMAGE_RATIO;
      const h = w * a;
      const x = pageW / 2 - (w * c - h * s) / 2;
      const y = pageH / 2 + (w * s + h * c) / 2 - h;
      try {
        doc.addImage(img.dataUrl, "PNG", x, y, w, h, undefined, "FAST", WM_ANGLE);
      } catch {
        // a broken bitmap never breaks the export
      }
    } else if (text) {
      doc.setFont(FONT_NAME, "bold");
      doc.setTextColor(0, 0, 0);
      // Measure → scale so the crest matches the admit card's ~70mm box
      // (WM_TEXT_RATIO of the short side) instead of spanning the page.
      doc.setFontSize(60);
      const measured = doc.getTextWidth(text); // mm at 60pt
      if (measured > 0)
        doc.setFontSize((60 * (WM_TEXT_RATIO * Math.min(pageW, pageH))) / measured);
      const sizePt = doc.getFontSize();
      const sizeMm = (sizePt * 25.4) / 72;
      const textW = doc.getTextWidth(text); // mm at the final size
      const cap = 0.7 * sizeMm; // cap height — glyph body sits above the baseline
      const c = Math.cos((WM_ANGLE * Math.PI) / 180);
      const s = Math.sin((WM_ANGLE * Math.PI) / 180);
      // jsPDF rotates around the anchor we pass (y-down doc units) and does NOT
      // centre for us when `angle` is set, so solve the anchor from the rotated
      // glyph box: centre = anchor + Rot(θ)·(w/2, cap/2) in PDF space (y-up).
      const ax = pageW / 2 - (c * (textW / 2) - s * (cap / 2));
      const ay = pageH / 2 - (s * (textW / 2) + c * (cap / 2));
      doc.text(text, ax, pageH - ay, { angle: WM_ANGLE });
    }
  } finally {
    setOpacity(doc, 1);
  }
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
    logo,
    logoText,
    accent,
    watermark,
    watermarkText,
    imageKey,
    imageHeader = "Photo",
  } = options;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await loadFont(doc);

  const FONT = FONT_NAME;

  const pal = accentPalette(accent);
  const primary = pal.rgb;
  const textDark: Rgb = [30, 30, 30];
  const textMuted: Rgb = [110, 110, 115];

  // Watermark FIRST, so header band / title / table all paint on top of it.
  // (Page 1 only — pages 2+ are drawn from the autotable willDrawPage hook.)
  const wmImg = watermark ? await loadWatermarkImage(watermark) : null;
  const wmText = wmImg ? "" : (watermarkText || companyName.split(/\s+/).map((w) => w[0]).join("").toUpperCase());
  drawWatermark(doc, pageWidth, pageHeight, wmImg, wmText);

  // Top header: Clean, uncolored header with association logo & name on left
  const startX = 14;
  const startY = 7;
  const logoImg = logo ? await loadLogoImage(logo) : null;

  let textX = startX;
  if (logoImg) {
    const maxLogoW = 14;
    const maxLogoH = 12;
    let logoW = maxLogoW;
    let logoH = logoW * logoImg.aspect;
    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = logoH / logoImg.aspect;
    }
    const logoX = startX;
    const logoY = startY + (12 - logoH) / 2;
    try {
      doc.addImage(logoImg.dataUrl, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch {
      // fallback if addImage encounters unexpected error
    }
    textX = startX + logoW + 3.5;
  } else {
    // Subtle fallback crest badge with initials (e.g. "BMA")
    const crestSize = 11;
    const crestX = startX;
    const crestY = startY + 0.5;
    doc.setDrawColor(215, 218, 224);
    doc.setFillColor(245, 247, 250);
    doc.setLineWidth(0.3);
    doc.roundedRect(crestX, crestY, crestSize, crestSize, 1.5, 1.5, "FD");
    doc.setFont(FONT, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(logoText || "BMA", crestX + crestSize / 2, crestY + crestSize / 2 + 1.2, { align: "center" });
    textX = startX + crestSize + 3.5;
  }

  // Association Name (and optional Subtitle)
  if (companySubtitle) {
    drawPdfText(doc, companyName, textX, startY + 5.5, {
      fontSize: 13,
      fontStyle: "bold",
      textColor: textDark,
      align: "left",
    });
    drawPdfText(doc, companySubtitle, textX, startY + 10.5, {
      fontSize: 8,
      fontStyle: "normal",
      textColor: textMuted,
      align: "left",
    });
  } else {
    drawPdfText(doc, companyName, textX, startY + 7.5, {
      fontSize: 13,
      fontStyle: "bold",
      textColor: textDark,
      align: "left",
    });
  }

  // Printed metadata on right side
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text(`Printed: ${dateStr}`, pageWidth - 14, startY + 3.5, { align: "right" });
  doc.text(`Total: ${data.length} records`, pageWidth - 14, startY + 7.5, { align: "right" });
  doc.text(`A4 · ${orientation}`, pageWidth - 14, startY + 11.5, { align: "right" });

  // Subtle neutral divider line under header
  const dividerY = startY + 14;
  doc.setDrawColor(226, 230, 236);
  doc.setLineWidth(0.4);
  doc.line(14, dividerY, pageWidth - 14, dividerY);

  let yPos = dividerY + 8;
  if (hasBengali(title)) {
    drawPdfText(doc, title, pageWidth / 2, yPos, {
      fontSize: 14,
      fontStyle: "bold",
      textColor: textDark,
      align: "center",
    });
    yPos += 7;
  } else {
    doc.setTextColor(...textDark);
    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - 28);
    doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
    yPos += titleLines.length * 6.5;
  }

  if (subtitle) {
    if (hasBengali(subtitle)) {
      drawPdfText(doc, subtitle, pageWidth / 2, yPos + 1, {
        fontSize: 9,
        fontStyle: "normal",
        textColor: textMuted,
        align: "center",
      });
      yPos += 7;
    } else {
      doc.setFontSize(9);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...textMuted);
      doc.text(subtitle, pageWidth / 2, yPos + 1, { align: "center" });
      yPos += 7;
    }
  }

  yPos += 3;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 5;

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

  // ── Cell padding: keep every column on a single line ────────────────────
  // The table's natural width is Σ(widest header/body text + padding) over
  // the columns, plus the fixed # (and photo) columns. autotable scales all
  // columns down when that exceeds the page — which wraps text and doubles
  // row heights. A list sized EXACTLY to the page (the student list, before
  // the Date of Birth column) therefore broke as soon as one column was
  // added. Measure and pick the widest padding that still fits: tables that
  // fit at the default 3mm keep the previous design byte-for-byte, and only
  // over-full tables tighten up instead of wrapping.
  const measuredNatural = columns.map((c) => {
    doc.setFont(FONT, "bold");
    doc.setFontSize(7);
    const headerW = doc.getTextWidth(c.header.toUpperCase());
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    const bodyW = data.reduce(
      (max, row) => Math.max(max, doc.getTextWidth(String(row[c.key] ?? ""))),
      0
    );
    return Math.max(headerW, bodyW);
  });
  const fixedWidth = 10 + (withImage ? 16 : 0); // # column (+ photo column)
  const availableWidth = pageWidth - 28 - fixedWidth;
  const PADDING_STEPS = [3, 2.5, 2, 1.5, 1];
  const cellPadding =
    PADDING_STEPS.find((p) =>
      measuredNatural.reduce((sum, w) => sum + w + 2 * p, 0) <= availableWidth
    ) ?? PADDING_STEPS[PADDING_STEPS.length - 1];

  autoTable(doc, {
    startY: yPos,
    head: [["#", ...(withImage ? [imageHeader.toUpperCase()] : []), ...tableHeaders]],
    body: tableData,
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: 8,
      cellPadding,
      textColor: textDark,
      lineColor: pal.lightRgb,
      lineWidth: 0.2,
      // Transparent cells — autotable defaults to OPAQUE WHITE fills, which
      // would erase the watermark behind the table. The page is white anyway;
      // grid rules carry the rows.
      fillColor: false,
    },
    headStyles: {
      fillColor: primary,
      textColor: pal.onRgb,
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      valign: "middle",
    },
    // No zebra fill on purpose: an opaque alternating fill would slice the
    // 35%-opacity watermark into horizontal bands. Grid rules carry the rows.
    columnStyles,
    bodyStyles: { valign: "middle", ...(withImage ? { minCellHeight: 16 } : {}) },
    margin: { left: 14, right: 14 },
    // Every new page: seal watermark first, then head/body rows paint over it.
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) drawWatermark(doc, pageWidth, pageHeight, wmImg, wmText);
    },
    willDrawCell: (hookData: any) => {
      const cellText = Array.isArray(hookData.cell.text)
        ? hookData.cell.text.join(" ")
        : String(hookData.cell.text ?? "");
      if (hasBengali(cellText)) {
        hookData.cell._bengaliRawText = cellText;
        hookData.cell.text = [];
      }
    },
    didDrawCell: (data: any) => {
      if (withImage && data.section === "body" && data.column.index === 1) {
        const png = imgSrcs.get(data.row.index);
        if (png) {
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
        }
      }

      // Bengali text rendering for any table cell
      const rawText = data.cell._bengaliRawText;
      if (rawText && hasBengali(rawText)) {
        const cell = data.cell;
        const isHead = data.section === "head";
        const fontStyle = (cell.styles.fontStyle === "bold" || isHead) ? "bold" : "normal";
        const fontSize = cell.styles.fontSize || (isHead ? 7 : 8);
        const halign = cell.styles.halign || "left";
        const textColor: Rgb = isHead
          ? pal.onRgb
          : (Array.isArray(cell.styles.textColor) ? cell.styles.textColor : [30, 30, 30]);

        const rendered = renderBengaliText(rawText, fontSize, fontStyle, textColor);
        if (rendered.dataUrl) {
          let drawX = cell.x + 2;
          if (halign === "center") {
            drawX = cell.x + (cell.width - rendered.widthMm) / 2;
          } else if (halign === "right") {
            drawX = cell.x + cell.width - rendered.widthMm - 2;
          } else {
            drawX = cell.x + 2 - rendered.padXMm;
          }
          const drawY = cell.y + (cell.height - rendered.heightMm) / 2;
          try {
            doc.addImage(rendered.dataUrl, "PNG", drawX, drawY, rendered.widthMm, rendered.heightMm, undefined, "FAST");
          } catch {
            // skip
          }
        }
      }
    },
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
