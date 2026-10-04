// Marksheet (academic transcript) export: Download (PDF) and Print for the
// public /marksheet page, the student portal and the institution action.
// Both consume the SAME <MarksheetSheet> node — no second layout to maintain.
// jspdf + html2canvas load on demand via exportAdmitCardsPdf (admit-card-pdf).

import {
  exportAdmitCardsPdf,
  openPrintWindow,
  waitForFonts,
  waitForImages,
} from "./admit-card-pdf";
import { MARKSHEET_H_PX } from "@/components/marksheet/marksheet-sheet";

/** A4 portrait capture → single-page PDF (content taller than A4 is shrunk to fit). */
export async function downloadMarksheetPdf(el: HTMLElement, filename: string): Promise<void> {
  await exportAdmitCardsPdf([el], filename);
}

/**
 * Open the print window INSIDE the click gesture (a popup opened later is
 * blocked); then hand it to printMarksheet.
 */
export function openMarksheetPrintWindow(): Window | null {
  return openPrintWindow();
}

/** Write the transcript into the pre-opened window and print (A4, no margin). */
export async function printMarksheet(win: Window, el: HTMLElement): Promise<void> {
  // Same shrink-to-fit rule as the admit card: an overflowing sheet scales
  // down as a whole instead of spilling onto a half-empty second page.
  const contentPx = Math.max(el.offsetHeight || 0, el.scrollHeight || 0);
  const fit = contentPx > MARKSHEET_H_PX ? MARKSHEET_H_PX / contentPx : 1;
  const html = el.outerHTML;
  const body = fit < 0.999 ? `<div style="zoom:${fit.toFixed(4)}">${html}</div>` : html;

  await waitForFonts(document);
  win.document.write(
    '<!DOCTYPE html><html lang="' +
      (el.getAttribute("lang") || "en") +
      '"><head><meta charset="utf-8" />' +
      "<title>Marksheet</title>" +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@100..900&display=swap" />' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400..700&family=Fira+Code:wght@300..700&family=Quantico:wght@400;700&display=swap" />' +
      "<style>" +
      "@font-face{font-family:Kalpurush;src:url('/fonts/kalpurush.ttf') format('truetype');font-weight:400 700;font-display:swap}" +
      "@font-face{font-family:Certificate;src:url('/fonts/Certificate%20400.ttf') format('truetype');font-weight:400;font-display:swap}" +
      "@page{size:210mm 297mm;margin:0}" +
      // Exact color on EVERY node (not just html/body): a printed sheet
      // must keep its fills and borders even when the dialog's "Background
      // graphics" checkbox is off — see the palette note in marksheet-sheet.
      "*,*::before,*::after{-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "html,body{margin:0;padding:0;background:#fff}" +
      "body{display:block}" +
      "</style></head><body>" +
      body +
      "</body></html>"
  );
  win.document.close();
  await waitForImages([win.document.body]);
  await waitForFonts(win.document);
  win.focus();
  win.print();
}
