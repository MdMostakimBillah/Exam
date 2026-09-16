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
}

let fontLoaded = false;

async function loadFont(doc: any) {
  if (fontLoaded) return;

  const response = await fetch("/fonts/NotoSansBengali-Regular.ttf");
  const buffer = await response.arrayBuffer();

  const fontBytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < fontBytes.length; i++) {
    binary += String.fromCharCode(fontBytes[i]);
  }

  doc.addFileToVFS("NotoSansBengali-Regular.ttf", btoa(binary));
  doc.addFont("NotoSansBengali-Regular.ttf", "NotoSans", "normal");
  fontLoaded = true;
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
  } = options;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  await loadFont(doc);

  const FONT = "NotoSans";

  const primary: [number, number, number] = [147, 51, 234];
  const primaryLight: [number, number, number] = [243, 232, 255];
  const textDark: [number, number, number] = [30, 30, 30];
  const textMuted: [number, number, number] = [120, 120, 120];

  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 18, "F");

  doc.setTextColor(255, 255, 255);
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

  const tableHeaders = columns.map((c) => c.header.toUpperCase());
  const tableData = data.map((row, idx) => {
    return [String(idx + 1), ...columns.map((c) => String(row[c.key] ?? ""))];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["#", ...tableHeaders]],
    body: tableData,
    theme: "grid",
    styles: {
      font: FONT,
      fontSize: 8,
      cellPadding: 3,
      textColor: textDark,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: primaryLight,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
    },
    margin: { left: 14, right: 14 },
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
