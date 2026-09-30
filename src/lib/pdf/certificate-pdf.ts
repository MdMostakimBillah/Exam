// jspdf + html2canvas are ~600 KB combined and are only needed when the user
// actually downloads a certificate — both are imported on demand inside
// exportCertificatePdf() so they stay out of the initial page bundle.

/**
 * Certificate export — deterministic, visually identical to the preview.
 *
 * Same single-source-of-truth approach as the admit card: the
 * <CertificateTemplate> HTML/CSS shown in the preview modal is rasterized
 * straight into the PDF. A4 **landscape** (297×210 mm), watermark carried
 * over from the preview at its shared 130 mm / 35% / 0° treatment.
 *
 * The font/image waits, clone font injection and html2canvas baseline shim
 * are local copies of the proven admit-card implementations (that module is
 * owned by parallel work — kept deliberately decoupled here).
 */

const PX_PER_MM = 96 / 25.4;
const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const PAGE_W_PX = Math.round(PAGE_W_MM * PX_PER_MM); // 1123
const PAGE_H_PX = Math.round(PAGE_H_MM * PX_PER_MM); // 794
const CAPTURE_SCALE = 2; // sharp, bounded memory — 2× at 96dpi = ~192dpi

async function waitForFonts(target: Document = document): Promise<void> {
  const fonts: FontFaceSet | undefined = (target as any).fonts;
  if (!fonts) return;
  try {
    await fonts.ready;
    const checks = [
      "700 14px Inter",
      "800 42px Inter",
      "400 14px 'Noto Sans Bengali'",
      "700 14px 'Noto Sans Bengali'",
      "700 40px Georgia",
    ];
    await Promise.all(
      checks.map((c) => {
        try {
          return fonts.load(c);
        } catch {
          return Promise.resolve([] as any);
        }
      })
    );
    await new Promise<void>((res) => requestAnimationFrame(() => res()));
  } catch {}
}

async function waitForImages(roots: Array<ParentNode>): Promise<void> {
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

/** Inline remote images (brand seal from Supabase storage) to data URLs so
 *  html2canvas cannot hit CORS taint. Same-origin non-storage paths untouched. */
async function inlineRemoteImages(root: HTMLElement): Promise<void> {
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
}

/** Clone font-related styles into the html2canvas cloned document so text metrics match preview. */
function injectFontsIntoClone(clonedDoc: Document) {
  const seen = new Set<string>();
  const addLink = (href: string) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    const link = clonedDoc.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    clonedDoc.head.appendChild(link);
  };
  Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((orig) => {
    const href = (orig as HTMLLinkElement).href;
    if (href && href.includes("fonts.googleapis")) addLink(href);
  });
  // The app loads Google fonts through globals.css @import (no <link> in
  // <head>), so request the certificate's families explicitly.
  addLink(
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@100..900&display=swap"
  );
  const style = clonedDoc.createElement("style");
  style.textContent =
    "@font-face{font-family:Kalpurush;src:url('/fonts/kalpurush.ttf') format('truetype');font-weight:400 700;font-display:swap}" +
    "@page{size:297mm 210mm;margin:0}" +
    ".certificate-page{page-break-after:avoid;break-after:avoid}" +
    "html,body{margin:0;padding:0;background:#fff}";
  clonedDoc.head.appendChild(style);
}

/**
 * html2canvas derives every glyph's baseline from a 1×1 <img> probe it
 * appends to *this* document (`img.offsetTop - span.offsetTop + 2`). Tailwind's
 * preflight forces `img { display: block }`, so that probe drops onto its own
 * line and every text run is painted ~6–14px lower than the browser preview.
 * Re-inlining the probe restores the intended measurement. See admit-card-pdf
 * for the full write-up.
 */
const FONT_METRICS_SHIM_ID = "h2c-font-metrics-shim";
const FONT_METRICS_SHIM_CSS =
  'body > div[style*="visibility: hidden"] img[style*="vertical-align: baseline"] { display: inline !important; }';

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

/** Capture one certificate element and download it as a single A4-landscape page. */
export async function exportCertificatePdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  await waitForFonts(document);
  await inlineRemoteImages(el);
  await waitForImages([el]);

  const widthPx = el.offsetWidth || PAGE_W_PX;
  const contentPx = Math.max(el.offsetHeight || PAGE_H_PX, el.scrollHeight || 0);

  // Shrink-to-fit, never crop: an over-tall certificate scales down as a
  // whole (uniform) instead of spilling onto a second page.
  const fitH = Math.min(1, PAGE_H_PX / contentPx);
  const fitW = Math.min(1, PAGE_W_PX / widthPx);
  const fit = Math.min(fitH, fitW);
  const drawW = PAGE_W_MM * fit;
  const drawH = (contentPx / PX_PER_MM) * fit;
  const x = Math.max((PAGE_W_MM - drawW) / 2, 0);
  const y = Math.max((PAGE_H_MM - drawH) / 2, 0);

  const releaseFontMetricsShim = applyFontMetricsShim();
  try {
    const canvas = await html2canvas(el, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      width: widthPx,
      height: contentPx,
      windowWidth: widthPx,
      windowHeight: contentPx,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const doc = clonedDoc as unknown as Document;
        injectFontsIntoClone(doc);
        if (fit < 1) {
          doc.querySelectorAll<HTMLElement>(".certificate-page").forEach((page) => {
            page.style.overflow = "visible";
          });
        }
      },
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: [PAGE_W_MM, PAGE_H_MM],
      orientation: "landscape",
    });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", x, y, drawW, drawH, undefined, "FAST");
    pdf.save(filename);
  } finally {
    releaseFontMetricsShim();
  }
}
