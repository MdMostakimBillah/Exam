import {
  FONT_NAME,
  accentPalette,
  drawPdfText,
  drawWatermark,
  hasBengali,
  loadFont,
  loadLogoImage,
  loadWatermarkImage,
  renderBengaliText,
} from "@/lib/utils/generate-pdf";

export interface SeatPlanStudent {
  id: string;
  roll: string; // exam roll number
  regNumber: string; // registration number
  name: string; // student full name
  institution: string; // institution name
  photo?: string; // photo URL or data URL
  gender?: string; // MALE | FEMALE | OTHER
  className: string;
  studentId?: string;
  classRoll?: string;
}

export interface SeatPlanPdfOptions {
  students: SeatPlanStudent[];
  className: string;
  sessionName?: string;
  genderFilter?: string; // e.g. "MALE", "FEMALE", or "" for All
  companyName?: string;
  companySubtitle?: string;
  logo?: string;
  logoText?: string;
  accent?: string;
  watermark?: string;
  watermarkText?: string;
  lang?: "en" | "bn";
}

/**
 * Loads an image from a URL or data URL, crops/fits it to portrait proportions (width x height),
 * and returns a JPEG data URL. Returns null on failure without breaking the PDF export.
 */
async function loadPhotoAsDataUrl(src: string, targetW = 160, targetH = 196): Promise<string | null> {
  if (!src || !src.trim()) return null;
  const trimmed = src.trim();
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("photo load failed"));
      img.src = trimmed;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);

    // Center crop to target aspect ratio
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const targetAspect = targetW / targetH;
    let sW = img.naturalWidth;
    let sH = img.naturalHeight;
    let sX = 0;
    let sY = 0;

    if (imgAspect > targetAspect) {
      sW = img.naturalHeight * targetAspect;
      sX = (img.naturalWidth - sW) / 2;
    } else {
      sH = img.naturalWidth / targetAspect;
      sY = (img.naturalHeight - sH) / 2;
    }

    ctx.drawImage(img, sX, sY, sW, sH, 0, 0, targetW, targetH);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

/**
 * Truncates text with an ellipsis if its rendered width exceeds maxMm.
 */
function truncateText(
  doc: any,
  text: string,
  maxMm: number,
  fontSizePt: number,
  fontStyle: "normal" | "bold" = "normal"
): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (hasBengali(trimmed)) {
    let cur = trimmed;
    while (cur.length > 2) {
      const rendered = renderBengaliText(cur, fontSizePt, fontStyle);
      if (rendered.widthMm <= maxMm) return cur;
      cur = cur.slice(0, -1).trim();
      if (cur.length <= 2) return cur;
      const test = cur + "…";
      const testRender = renderBengaliText(test, fontSizePt, fontStyle);
      if (testRender.widthMm <= maxMm) return test;
    }
    return cur;
  }

  doc.setFont(FONT_NAME, fontStyle);
  doc.setFontSize(fontSizePt);
  if (doc.getTextWidth(trimmed) <= maxMm) return trimmed;

  let cur = trimmed;
  while (cur.length > 2) {
    cur = cur.slice(0, -1);
    if (doc.getTextWidth(cur + "…") <= maxMm) return cur + "…";
  }
  return cur;
}

/**
 * Splits text into up to maxLines lines, wrapping words if they exceed maxMm.
 */
function splitTextToFit(
  doc: any,
  text: string,
  maxMm: number,
  fontSizePt: number,
  maxLines = 2
): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    let width = 0;
    if (hasBengali(testLine)) {
      width = renderBengaliText(testLine, fontSizePt, "normal").widthMm;
    } else {
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(fontSizePt);
      width = doc.getTextWidth(testLine);
    }

    if (width <= maxMm) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        lines.push(truncateText(doc, word, maxMm, fontSizePt, "normal"));
        currentLine = "";
      }
      if (lines.length === maxLines) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === maxLines) {
    lines[maxLines - 1] = truncateText(doc, lines[maxLines - 1], maxMm, fontSizePt, "normal");
  }

  return lines;
}

function genderBadgeText(g: string | undefined, isBn: boolean): string {
  if (!g) return isBn ? "শিক্ষার্থী" : "Student";
  const up = g.trim().toUpperCase();
  if (up === "MALE") return isBn ? "ছাত্র (পুরুষ)" : "Male";
  if (up === "FEMALE") return isBn ? "ছাত্রী (মহিলা)" : "Female";
  if (up === "OTHER") return isBn ? "অন্যান্য" : "Other";
  return g;
}

/**
 * Draws a subtle student silhouette placeholder when no photo is provided.
 */
function drawPhotoPlaceholder(doc: any, x: number, y: number, w: number, h: number) {
  // Light box
  doc.setFillColor(244, 246, 249);
  doc.setDrawColor(218, 224, 233);
  doc.setLineWidth(0.15);
  doc.rect(x, y, w, h, "FD");

  // Avatar silhouette
  const cx = x + w / 2;
  const headY = y + h * 0.38;
  const headR = Math.min(w, h) * 0.17;
  doc.setFillColor(195, 203, 215);
  doc.circle(cx, headY, headR, "F");

  // Body arc/pill
  const bodyW = w * 0.58;
  const bodyH = h * 0.28;
  const bodyX = cx - bodyW / 2;
  const bodyY = headY + headR + 1;
  doc.roundedRect(bodyX, bodyY, bodyW, bodyH, 1.8, 1.8, "F");

  // Tiny label
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(5);
  doc.setTextColor(150, 160, 175);
  doc.text("PHOTO", cx, y + h - 1.2, { align: "center" });
}

/**
 * Exports Seat Plan as an A4 Portrait PDF.
 * Grid configuration:
 * - 3 columns per page
 * - 7 rows per page
 * - 21 student cards per page (>= 20 students per page)
 * - Sorted sequentially according to exam roll
 */
export async function exportSeatPlanPdf(options: SeatPlanPdfOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const {
    students,
    className,
    sessionName,
    genderFilter = "",
    companyName = "Bangladesh Madrasah Association",
    companySubtitle = "",
    logo,
    logoText = "BMA",
    accent,
    watermark,
    watermarkText = "BMA",
    lang = "bn",
  } = options;

  const isBn = lang === "bn";

  // Filter students who have an exam roll and match gender filter if provided
  let filtered = students.filter((s) => Boolean(s.roll && s.roll.trim()));

  if (genderFilter) {
    const upFilter = genderFilter.trim().toUpperCase();
    if (upFilter === "UNASSIGNED") {
      filtered = filtered.filter(
        (s) => !s.gender || !["MALE", "FEMALE", "OTHER"].includes(s.gender.trim().toUpperCase())
      );
    } else {
      filtered = filtered.filter((s) => (s.gender || "").trim().toUpperCase() === upFilter);
    }
  }

  // Sort strictly according to exam roll (numerical order)
  const sorted = [...filtered].sort((a, b) =>
    (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true })
  );

  // Pre-load watermark and logo in parallel
  const [wmImg, logoImg] = await Promise.all([
    watermark ? loadWatermarkImage(watermark) : Promise.resolve(null),
    logo ? loadLogoImage(logo) : Promise.resolve(null),
  ]);

  // Preload unique student photos in batches
  const photoCache = new Map<string, string | null>();
  const uniquePhotos = Array.from(
    new Set(sorted.map((s) => s.photo).filter((p): p is string => Boolean(p && p.trim())))
  );

  const BATCH_SIZE = 12;
  for (let i = 0; i < uniquePhotos.length; i += BATCH_SIZE) {
    const batch = uniquePhotos.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        const dataUrl = await loadPhotoAsDataUrl(url, 160, 196);
        photoCache.set(url, dataUrl);
      })
    );
  }

  // Page setup: A4 Portrait (210mm x 297mm)
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadFont(doc);

  const pal = accentPalette(accent);
  const primaryRgb = pal.rgb;

  // Geometry: 3 columns x 7 rows = 21 cards per page
  const COLS = 3;
  const ROWS = 7;
  const CARDS_PER_PAGE = COLS * ROWS; // 21
  const totalPages = Math.max(1, Math.ceil(sorted.length / CARDS_PER_PAGE));

  const CARD_W = 63;
  const CARD_H = 36;
  const GAP_X = 3.5;
  const GAP_Y = 2.4;
  const MARGIN_LEFT = 7; // (210 - (3 * 63 + 2 * 3.5)) / 2 = 7mm
  const GRID_START_Y = 19;

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage("a4", "portrait");

    // 1. Watermark behind content
    drawWatermark(doc, 210, 297, wmImg, watermarkText);

    // 2. Top Header (Clean, professional, not colorful - association name & logo on left)
    // Left: Logo and Association Name
    let headerTextX = MARGIN_LEFT;
    if (logoImg) {
      const logoH = 9.5;
      const logoW = logoH / logoImg.aspect;
      try {
        doc.addImage(logoImg.dataUrl, "PNG", MARGIN_LEFT, 5.5, logoW, logoH, undefined, "FAST");
        headerTextX = MARGIN_LEFT + logoW + 2.5;
      } catch {
        headerTextX = MARGIN_LEFT;
      }
    } else if (logoText) {
      doc.setFillColor(245, 247, 250);
      doc.setDrawColor(210, 215, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(MARGIN_LEFT, 5.5, 9.5, 9.5, 1, 1, "FD");
      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(logoText.slice(0, 4), MARGIN_LEFT + 4.75, 11.5, { align: "center" });
      headerTextX = MARGIN_LEFT + 12;
    }

    // Association Title
    drawPdfText(doc, companyName, headerTextX, 9.5, {
      fontSize: 9.5,
      fontStyle: "bold",
      textColor: [15, 23, 42],
    });

    if (companySubtitle) {
      drawPdfText(doc, companySubtitle, headerTextX, 13.5, {
        fontSize: 7,
        fontStyle: "normal",
        textColor: [100, 116, 139],
      });
    }

    // Right: Seat Plan Title & Meta
    const rightMargin = 210 - MARGIN_LEFT;
    const titleText = isBn ? "পরীক্ষার আসন বিন্যাস (SEAT PLAN)" : "EXAM SEAT PLAN";
    drawPdfText(doc, titleText, rightMargin, 9, {
      fontSize: 10,
      fontStyle: "bold",
      textColor: [15, 23, 42],
      align: "right",
    });

    const gLabel = genderFilter ? genderBadgeText(genderFilter, isBn) : isBn ? "সকল শিক্ষার্থী" : "All Students";
    const subMeta = `${isBn ? "শ্রেণী:" : "Class:"} ${className} · ${isBn ? "লিঙ্গ:" : "Gender:"} ${gLabel}${sessionName ? ` · ${sessionName}` : ""}`;
    drawPdfText(doc, subMeta, rightMargin, 13.5, {
      fontSize: 7,
      fontStyle: "normal",
      textColor: [71, 85, 105],
      align: "right",
    });

    // Header divider line (clean, subtle line)
    doc.setDrawColor(218, 224, 233);
    doc.setLineWidth(0.25);
    doc.line(MARGIN_LEFT, 16.5, rightMargin, 16.5);

    // 3. Render 3x7 Grid of Cards
    const pageStudents = sorted.slice(pageIdx * CARDS_PER_PAGE, (pageIdx + 1) * CARDS_PER_PAGE);

    for (let cIdx = 0; cIdx < pageStudents.length; cIdx++) {
      const student = pageStudents[cIdx];
      const col = cIdx % COLS;
      const row = Math.floor(cIdx / COLS);

      const cardX = MARGIN_LEFT + col * (CARD_W + GAP_X);
      const cardY = GRID_START_Y + row * (CARD_H + GAP_Y);

      // Card Background
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX, cardY, CARD_W, CARD_H, 1, 1, "F");

      // Top Strip inside Card (Class and Gender badge)
      doc.setFillColor(248, 250, 252);
      doc.rect(cardX, cardY, CARD_W, 5, "F");

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.18);
      doc.line(cardX, cardY + 5, cardX + CARD_W, cardY + 5);

      // Class badge (top-left)
      const classDisplay = `${isBn ? "শ্রেণী:" : "Class:"} ${student.className}`;
      drawPdfText(doc, classDisplay, cardX + 2.5, cardY + 3.7, {
        fontSize: 6.5,
        fontStyle: "bold",
        textColor: [71, 85, 105],
      });

      // Gender badge (top-right)
      const gBadge = genderBadgeText(student.gender, isBn);
      drawPdfText(doc, gBadge, cardX + CARD_W - 2.5, cardY + 3.7, {
        fontSize: 6,
        fontStyle: "normal",
        textColor: [100, 116, 139],
        align: "right",
      });

      // Photo on Left (width: 18mm, height: 22mm)
      const photoX = cardX + 2.5;
      const photoY = cardY + 6.5;
      const photoW = 18;
      const photoH = 22;

      let photoDrawn = false;
      if (student.photo && photoCache.has(student.photo)) {
        const photoData = photoCache.get(student.photo);
        if (photoData) {
          try {
            doc.addImage(photoData, "JPEG", photoX, photoY, photoW, photoH, undefined, "FAST");
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.15);
            doc.rect(photoX, photoY, photoW, photoH, "S");
            photoDrawn = true;
          } catch {
            photoDrawn = false;
          }
        }
      }

      if (!photoDrawn) {
        drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
      }

      // Small Student ID below photo if available
      if (student.studentId) {
        doc.setFont(FONT_NAME, "normal");
        doc.setFontSize(5);
        doc.setTextColor(148, 163, 184);
        const tid = truncateText(doc, student.studentId, photoW, 5, "normal");
        doc.text(tid, photoX + photoW / 2, cardY + 32, { align: "center" });
      }

      // Right Column Content (X: cardX + 22.5 to cardX + CARD_W - 2.5, width: 38mm)
      const textX = cardX + 22.5;
      const maxTextW = 38;

      // 1. Roll Number (Prominent!)
      const rollLabel = isBn ? "রোল:" : "ROLL:";
      drawPdfText(doc, rollLabel, textX, cardY + 10.8, {
        fontSize: 6.5,
        fontStyle: "bold",
        textColor: [100, 116, 139],
      });

      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(6.5);
      const rollLabelW = doc.getTextWidth(rollLabel + " ");

      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(student.roll, textX + rollLabelW, cardY + 10.8);

      // 2. Registration Number
      const regLabel = isBn ? "রেজি:" : "Reg:";
      drawPdfText(doc, regLabel, textX, cardY + 15.2, {
        fontSize: 6.5,
        fontStyle: "normal",
        textColor: [100, 116, 139],
      });

      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(6.5);
      const regLabelW = doc.getTextWidth(regLabel + " ");

      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text(student.regNumber || "-", textX + regLabelW, cardY + 15.2);

      // 3. Student Name (with HarfBuzz Bengali shaper)
      const studentName = student.name.trim();
      const safeName = truncateText(doc, studentName, maxTextW, 7.5, "bold");
      drawPdfText(doc, safeName, textX, cardY + 19.8, {
        fontSize: 7.5,
        fontStyle: "bold",
        textColor: [15, 23, 42],
      });

      // 4. Institution Name (up to 2 wrapped lines)
      const instName = student.institution || "—";
      const instLines = splitTextToFit(doc, instName, maxTextW, 6, 2);
      for (let lIdx = 0; lIdx < instLines.length; lIdx++) {
        drawPdfText(doc, instLines[lIdx], textX, cardY + 24.2 + lIdx * 3.4, {
          fontSize: 6,
          fontStyle: "normal",
          textColor: [71, 85, 105],
        });
      }

      // Card Outer Border (clean cut-ready line)
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, cardY, CARD_W, CARD_H, 1, 1, "S");
    }

    // 4. Footer
    const footerY = 292;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, footerY - 3, rightMargin, footerY - 3);

    // Footer Left: Date
    const todayStr = new Date().toLocaleDateString(isBn ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${isBn ? "মুদ্রণের তারিখ:" : "Printed:"} ${todayStr}`, MARGIN_LEFT, footerY);

    // Footer Center: Total Count
    doc.text(
      `${isBn ? "মোট শিক্ষার্থী:" : "Total Students:"} ${sorted.length} · (21 ${isBn ? "প্রতি পৃষ্ঠায়" : "/ page"})`,
      105,
      footerY,
      { align: "center" }
    );

    // Footer Right: Page Number
    doc.text(
      `${isBn ? "পৃষ্ঠা" : "Page"} ${pageIdx + 1} / ${totalPages}`,
      rightMargin,
      footerY,
      { align: "right" }
    );
  }

  // Save PDF
  const cleanClass = className.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, "_");
  const cleanGender = genderFilter ? `_${genderFilter}` : "";
  const filename = `SeatPlan_${cleanClass}${cleanGender}.pdf`;
  doc.save(filename);
}
