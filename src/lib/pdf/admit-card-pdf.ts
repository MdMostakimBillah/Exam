import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Admit-card export helpers — LANDSCAPE A4.
 *
 * The card is a fixed 297mm-wide DOM node (AdmitCardTemplate, landscape)
 * with content-driven height (max 210mm). Each capture is measured and drawn
 * at true size centered on its A4 landscape page — exactly what the print
 * window does with page breaks. html2canvas is used so design, photos and
 * Kalpurush/Bangla rasterise identically to preview. Scale 2.5 gives
 * print-sharp (≈300dpi) raster; JPEG 0.92 balances quality vs size.
 */

/** Wait until every <img> in the given roots has loaded (or errored), max 15s. */
export async function waitForImages(roots: Array<ParentNode>): Promise<void> {
  const imgs: HTMLImageElement[] = [];
  for (const root of roots) {
    imgs.push(...Array.from(root.querySelectorAll("img")));
  }
  await Promise.race([
    Promise.all(imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          })
    )),
    new Promise<void>((res) => setTimeout(res, 15000)),
  ]);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Capture each element and download a single multi-page PDF — one card per
 *  A4 landscape page, drawn at true size centered on the page. */
export async function exportAdmitCardsPdf(elements: HTMLElement[], filename: string): Promise<void> {
  if (elements.length === 0) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const PX_TO_MM = 25.4 / 96;
  const PAGE_W = 297;
  const PAGE_H = 210;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const heightPx = el.offsetHeight || el.getBoundingClientRect().height;
    const heightMm = Math.min(heightPx * PX_TO_MM, PAGE_H);
    const y = Math.max((PAGE_H - heightMm) / 2, 0);
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    // Landscape: 297mm wide, height measured, vertically centered.
    pdf.addImage(dataUrl, "JPEG", 0, y, PAGE_W, heightMm, undefined, "FAST");
  }
  pdf.save(filename || `admit-cards-${timestamp()}.pdf`);
}

/** Open the print window synchronously inside the click (popup-gesture safe). */
export function openPrintWindow(): Window | null {
  return window.open("", "_blank");
}

/** Write the card clones into the pre-opened window, then print (A4 landscape, no margin). */
export async function printAdmitCards(win: Window, elements: HTMLElement[]): Promise<void> {
  const body = elements.map((el) => el.outerHTML).join("");
  // Same font stack as globals.css so preview / PDF / print all match.
  const cardEl = elements[0]?.querySelector(".admit-card-page");
  const lang = cardEl?.getAttribute("lang") || "en";
  win.document.write(
    '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="utf-8" />' +
      "<title>Admit Card</title>" +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tiro+Bangla&display=swap" />' +
      "<style>" +
      "@page { size: A4 landscape; margin: 0; }" +
      "html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
      ".admit-card-page { page-break-after: always; break-after: page; }" +
      ".admit-card-page:last-child { page-break-after: auto; break-after: auto; }" +
      ".admit-card-page, .admit-card-page * { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', 'Kalpurush', 'Tiro Bangla', sans-serif !important; }" +
      "</style></head><body>" + body + "</body></html>"
  );
  win.document.close();
  await waitForImages([win.document.body]);
  win.focus();
  win.print();
}
