import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Admit-card export — deterministic, visually identical to preview.
 *
 * Single source of truth: the same <AdmitCardTemplate> HTML/CSS rendered
 * in the preview is rasterized for the PDF. No duplicate PDF layout is
 * maintained. Fixes ensure fonts, images, dimensions and scaling are
 * deterministic so the downloaded PDF matches the browser preview.
 *
 * - 297×210mm landscape A4 (exact)
 * - explicit px dimensions at 96dpi + controlled scale
 * - document.fonts.ready before capture + cloned-doc font injection
 * - all <img> preloaded and remote sources inlined to data URLs to avoid
 *   CORS taint and dimension recalculation
 * - html2canvas width/height/windowWidth locked to card size so viewport
 *   does not affect the PDF
 */

const PX_PER_MM = 96 / 25.4;
const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const PAGE_W_PX = Math.round(PAGE_W_MM * PX_PER_MM); // 1123
const PAGE_H_PX = Math.round(PAGE_H_MM * PX_PER_MM); // 794
const CAPTURE_SCALE = 2; // sharp, bounded memory — 2× at 96dpi = ~192dpi, JPEG keeps size sane

async function waitForFonts(target: Document = document): Promise<void> {
  const fonts: FontFaceSet | undefined = (target as any).fonts;
  if (!fonts) return;
  try {
    await fonts.ready;
    const checks = [
      '700 14px Inter',
      '600 13px Inter',
      '400 11px Inter',
      '400 14px "Tiro Bangla"',
      '400 14px Kalpurush',
    ];
    await Promise.all(
      checks.map((c) => {
        try { return fonts.load(c); } catch { return Promise.resolve([] as any); }
      })
    );
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
  } catch {}
}

export async function waitForImages(roots: Array<ParentNode>): Promise<void> {
  const imgs: HTMLImageElement[] = [];
  for (const root of roots) imgs.push(...Array.from(root.querySelectorAll("img")));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if ((img as any).decode) await (img as any).decode().catch(() => {});
      } catch {}
    })
  );
  await Promise.race([
    Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              const done = () => res();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            })
      )
    ),
    new Promise<void>((res) => setTimeout(res, 15000)),
  ]);
}

/**
 * Ensure student photos render pixel-identical in PDF by center-cropping
 * to the exact container size (124×156) before capture. html2canvas's
 * object-fit:cover has subtle DPI/scale differences vs the browser;
 * a pre-cropped data URL guarantees the PDF photo matches the preview.
 */
async function prepareStudentPhotos(root: HTMLElement): Promise<void> {
  const PHOTO_W = 124;
  const PHOTO_H = 156;
  const imgs = Array.from(root.querySelectorAll('img[alt="Photo"], img[alt="ছবি"]')) as HTMLImageElement[];
  for (const img of imgs) {
    const src = img.getAttribute("src") || img.src;
    if (!src || src.startsWith("data:")) continue;
    const rect = img.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) continue;
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        image.onload = () => res();
        image.onerror = () => rej(new Error("load"));
        image.src = src;
      });
      const targetAspect = PHOTO_W / PHOTO_H;
      const srcAspect = image.naturalWidth / image.naturalHeight;
      let sw = image.naturalWidth, sh = image.naturalHeight, sx = 0, sy = 0;
      if (srcAspect > targetAspect) {
        sw = sh * targetAspect;
        sx = (image.naturalWidth - sw) / 2;
      } else {
        sh = sw / targetAspect;
        sy = (image.naturalHeight - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      const hires = 2;
      canvas.width = PHOTO_W * hires;
      canvas.height = PHOTO_H * hires;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const cropped = canvas.toDataURL("image/jpeg", 0.92);
      if (cropped.length < src.length * 4) img.src = cropped;
      img.style.width = "100%";
      img.style.height = "100%";
      (img.style as any).objectFit = "cover";
      (img.style as any).objectPosition = "center top";
    } catch {}
  }
  await waitForImages([root]);
}

/**
 * Inline remote images to data URLs so html2canvas does not hit CORS taint
 * and does not recalculate dimensions. Already-data URLs, blob URLs and
 * same-origin are left untouched.
 */
async function inlineRemoteImages(root: HTMLElement): Promise<Map<string, string>> {
  const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  const cache = new Map<string, string>();
  const conversions: Promise<void>[] = [];

  for (const img of imgs) {
    const src = img.getAttribute("src") || img.src;
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
    try {
      const url = new URL(src, window.location.href);
      if (url.origin === window.location.origin && !src.includes("supabase")) continue;
    } catch {}
    if (cache.has(src)) {
      img.src = cache.get(src)!;
      continue;
    }
    conversions.push(
      (async () => {
        try {
          const res = await fetch(src, { mode: "cors" });
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl: string = await new Promise((res2, rej2) => {
            const fr = new FileReader();
            fr.onload = () => res2(String(fr.result));
            fr.onerror = () => rej2(new Error("read"));
            fr.readAsDataURL(blob);
          });
          cache.set(src, dataUrl);
          img.src = dataUrl;
        } catch {}
      })()
    );
  }
  if (conversions.length) {
    await Promise.all(conversions);
    await waitForImages([root]);
  }
  return cache;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function timestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Clone font-related styles into the html2canvas cloned document so text metrics match preview. */
function injectFontsIntoClone(clonedDoc: Document) {
  // 1) Copy external <link> stylesheets that contain Inter / Tiro Bangla
  Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((orig) => {
    const href = (orig as HTMLLinkElement).href;
    if (!href) return;
    if (href.includes("fonts.googleapis")) {
      const link = clonedDoc.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      clonedDoc.head.appendChild(link);
    }
  });
  // 2) Ensure Kalpurush @font-face is present in clone
  const style = clonedDoc.createElement("style");
  style.textContent =
    "@font-face{font-family:Kalpurush;src:url('/fonts/kalpurush.ttf') format('truetype');font-weight:400 700;font-display:swap}" +
    "@page{size:297mm 210mm;margin:0}" +
    ".admit-card-page{page-break-after:avoid;break-after:avoid}" +
    // Force html2canvas to respect border-box and avoid viewport scaling quirks
    "html,body{margin:0;padding:0;background:#fff}";
  clonedDoc.head.appendChild(style);
}

/**
 * html2canvas derives every glyph's baseline from a 1×1 <img> probe it
 * appends to *this* document (`img.offsetTop - span.offsetTop + 2`).
 *
 * Tailwind's preflight forces `img, svg, … { display: block }`, so that probe
 * drops onto its own line and the formula returns a **line-box offset**
 * (~1.5 × font-size) instead of the font ascent. Every text run is then
 * painted ~6–14px lower than the browser preview puts it — which is exactly
 * why the "Admit Card" ribbon (flex-centred in a 32px band) looked off-centre
 * in the downloaded PDF while the preview was perfect.
 *
 * Measured on the real card: baseline metric 21px instead of 15px → ribbon
 * text 6.7px low; with this shim → 0.7px (sub-pixel). Re-inlining the probe
 * restores html2canvas's intended measurement. Plain CSS on purpose —
 * html2canvas creates and destroys the probe synchronously, so a
 * MutationObserver would always run too late. Selector is scoped to the
 * probe's own inline styles so app markup can never match it.
 */
const FONT_METRICS_SHIM_ID = "h2c-font-metrics-shim";
const FONT_METRICS_SHIM_CSS =
  'body > div[style*="visibility: hidden"] img[style*="vertical-align: baseline"] { display: inline !important; }';

/** Install the shim for the duration of a capture; returns a disposer. */
function applyFontMetricsShim(): () => void {
  if (typeof document === "undefined" || document.getElementById(FONT_METRICS_SHIM_ID)) {
    return () => undefined;
  }
  const style = document.createElement("style");
  style.id = FONT_METRICS_SHIM_ID;
  style.textContent = FONT_METRICS_SHIM_CSS;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

/** Capture each element and download a single multi-page PDF — one card per A4 landscape page. */
export async function exportAdmitCardsPdf(elements: HTMLElement[], filename: string): Promise<void> {
  if (elements.length === 0) return;
  await waitForFonts(document);
  for (const el of elements) await prepareStudentPhotos(el);
  for (const el of elements) await inlineRemoteImages(el);
  await waitForImages(elements);

  const pdf = new jsPDF({ unit: "mm", format: [PAGE_W_MM, PAGE_H_MM], orientation: "landscape" });
  const releaseFontMetricsShim = applyFontMetricsShim();

  try {
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const widthPx = el.offsetWidth || PAGE_W_PX;
      const heightPx = el.offsetHeight || PAGE_H_PX;
      const heightMm = Math.min(heightPx / PX_PER_MM, PAGE_H_MM);
      const y = Math.max((PAGE_H_MM - heightMm) / 2, 0);

      const canvas = await html2canvas(el, {
        scale: CAPTURE_SCALE,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        width: widthPx,
        height: heightPx,
        windowWidth: widthPx,
        windowHeight: heightPx,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          injectFontsIntoClone(clonedDoc as unknown as Document);
        },
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
      if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], "landscape");
      pdf.addImage(dataUrl, "JPEG", 0, y, PAGE_W_MM, heightMm, undefined, "FAST");
    }
  } finally {
    releaseFontMetricsShim();
  }
  pdf.save(filename || `admit-cards-${timestamp()}.pdf`);
}

export function openPrintWindow(): Window | null {
  return window.open("", "_blank");
}

/** Write the card clones into the pre-opened window, then print (A4 landscape, no margin). */
export async function printAdmitCards(win: Window, elements: HTMLElement[]): Promise<void> {
  const body = elements.map((el) => el.outerHTML).join("");
  const cardEl = elements[0]?.querySelector(".admit-card-page");
  const lang = cardEl?.getAttribute("lang") || "en";
  await waitForFonts(document);
  win.document.write(
    '<!DOCTYPE html><html lang="' +
      lang +
      '"><head><meta charset="utf-8" />' +
      "<title>Admit Card</title>" +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Tiro+Bangla&display=swap" />' +
      "<style>" +
      "@font-face{font-family:Kalpurush;src:url('/fonts/kalpurush.ttf') format('truetype');font-weight:400 700;font-display:swap}" +
      "@page{size:297mm 210mm;margin:0}" +
      "html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      ".admit-card-page{page-break-after:always;break-after:page}" +
      ".admit-card-page:last-child{page-break-after:auto;break-after:auto}" +
      ".admit-card-page,.admit-card-page *{font-family:'Inter',system-ui,-apple-system,'Segoe UI','Kalpurush','Tiro Bangla',sans-serif!important}" +
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
