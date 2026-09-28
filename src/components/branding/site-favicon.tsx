"use client";
import { useEffect } from "react";
import { useBranding } from "@/lib/storage/branding";

/**
 * Applies the super-admin favicon (Settings → Branding → Favicon) to the
 * live document. Next.js already injects `<link rel="icon" href="/favicon.ico">`
 * for `app/favicon.ico`, so when a custom favicon is saved every icon link is
 * replaced by ONE link tagged `data-brand="1"`; when it is cleared the built-in
 * `/favicon.ico` link is restored. Browsers pick the first icon link they find
 * (and cache by URL), so duplicates with different hrefs must never coexist.
 */
const DEFAULT_ICON = "/favicon.ico";

const MIME_BY_EXT: Record<string, string> = {
  ico: "image/x-icon",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
};

function mimeFor(url: string): string | undefined {
  const clean = url.split("?")[0].split("#")[0];
  const ext = clean.slice(clean.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext];
}

export function SiteFavicon() {
  const { data } = useBranding();
  const href = data?.brandFavicon || "";

  useEffect(() => {
    const icons = () =>
      Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

    if (!href) {
      // Custom favicon cleared → drop ours, make sure the built-in one is back.
      icons()
        .filter((l) => l.dataset.brand === "1")
        .forEach((l) => l.remove());
      if (!icons().some((l) => (l.getAttribute("href") || "").startsWith(DEFAULT_ICON))) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = DEFAULT_ICON;
        document.head.appendChild(link);
      }
      return;
    }

    // One icon link only: remove Next's injected default AND any previous one.
    icons().forEach((l) => l.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    link.dataset.brand = "1";
    const mime = mimeFor(href);
    if (mime) link.type = mime;
    document.head.appendChild(link);
  }, [href]);

  return null;
}
