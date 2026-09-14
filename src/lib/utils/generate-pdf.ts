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

  // Colors
  const primary: [number, number, number] = [147, 51, 234]; // purple-600
  const primaryLight: [number, number, number] = [243, 232, 255]; // purple-100
  const textDark: [number, number, number] = [30, 30, 30];
  const textMuted: [number, number, number] = [120, 120, 120];

  // Header bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 18, "F");

  // Company name on header
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, 14, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(companySubtitle, 14, 15);

  // Right side info
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.setFontSize(8);
  doc.text(`Printed: ${dateStr}`, pageWidth - 14, 8, { align: "right" });
  doc.text(`Total: ${data.length} records`, pageWidth - 14, 12, { align: "right" });
  doc.text(`A4 · ${orientation}`, pageWidth - 14, 16, { align: "right" });

  // Title
  let yPos = 28;
  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - 28);
  doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
  yPos += titleLines.length * 7;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(subtitle, pageWidth / 2, yPos + 2, { align: "center" });
    yPos += 8;
  }

  // Divider
  yPos += 4;
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  // Table
  const tableHeaders = columns.map((c) => c.header.toUpperCase());
  const tableData = data.map((row, idx) => {
    return [String(idx + 1), ...columns.map((c) => String(row[c.key] ?? ""))];
  });

  const allHeaders = ["#", ...tableHeaders];

  autoTable(doc, {
    startY: yPos,
    head: [allHeaders],
    body: tableData,
    theme: "grid",
    styles: {
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
      // Footer on every page
      const footerY = pageHeight - 10;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.setFont("helvetica", "normal");
      doc.text("Powered by ScholarX", 14, footerY);
      doc.text(`Page ${data.pageNumber}`, pageWidth / 2, footerY, { align: "center" });

      // Principal + Office Seal
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
