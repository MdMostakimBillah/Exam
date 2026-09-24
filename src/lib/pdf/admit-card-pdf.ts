import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Admit-card export helpers.
 *
 * The card is a fixed 210mm-wide DOM node (AdmitCardTemplate) with
 * CONTENT-DRIVEN height (the reference design), so each capture is measured
 * and drawn at true size at the top of its own A4 page — exactly what the
 * print window does with page breaks. html2canvas is used (instead of
 * drawing with jsPDF primitives) so the design, photos and Bangla text
 * rasterise identically to what's on screen.
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
 *  A4 page, drawn at its measured (content) height from the top of the page. */
export async function exportAdmitCardsPdf(elements: HTMLElement[], filename: string): Promise<void> {
  if (elements.length === 0) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const PX_TO_MM = 25.4 / 96;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    // Content-height card: measure (offsetHeight ignores any CSS transform)
    // and cap at A4 so a too-tall card still lands inside the page.
    const heightPx = el.offsetHeight || el.getBoundingClientRect().height;
    const heightMm = Math.min(heightPx * PX_TO_MM, 297);
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    // Card is 210mm wide → draw at true size, top-left of the A4 page.
    pdf.addImage(dataUrl, "JPEG", 0, 0, 210, heightMm, undefined, "FAST");
  }
  pdf.save(filename || `admit-cards-${timestamp()}.pdf`);
}

/** Open the print window synchronously inside the click (popup-gesture safe). */
export function openPrintWindow(): Window | null {
  return window.open("", "_blank");
}

/** Write the card clones into the pre-opened window, then print (A4, no margin). */
export async function printAdmitCards(win: Window, elements: HTMLElement[]): Promise<void> {
  const body = elements.map((el) => el.outerHTML).join("");
  // Match the main document: same lang attr + font stack so preview/print/PDF
  // all resolve fonts identically (Courier New for Latin, Tiro Bangla for Bangla).
  const cardEl = elements[0]?.querySelector(".admit-card-page");
  const lang = cardEl?.getAttribute("lang") || "en";
  win.document.write(
    '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="utf-8" />' +
      "<title>Admit Card</title>" +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tiro+Bangla&display=swap" />' +
      "<style>" +
      "@page { size: A4; margin: 0; }" +
      "html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
      ".admit-card-page { page-break-after: always; break-after: page; }" +
      ".admit-card-page:last-child { page-break-after: auto; break-after: auto; }" +
      ".admit-card-page, .admit-card-page * { font-family: 'Courier New', Courier, 'Tiro Bangla', monospace !important; }" +
      "</style></head><body>" + body + "</body></html>"
  );
  win.document.close();
  await waitForImages([win.document.body]);
  win.focus();
  win.print();
}
