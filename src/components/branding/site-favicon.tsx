"use client";
import { useEffect } from "react";
import { useBranding } from "@/lib/storage/branding";

/**
 * Applies the super-admin favicon (Settings → Branding → Favicon) to the
 * live document.
 *
 * IMPORTANT — never remove React's nodes. Next.js injects
 * `<link rel="icon" href="/favicon.ico?…">` through its metadata tree, so
 * deleting that element behind React's back makes the next commit throw
 * `TypeError: Cannot read properties of null (reading 'removeChild')` from
 * `commitDeletionEffectsOnFiber` — an exception thrown mid-commit aborts the
 * rest of the UI update, which froze/delayed whole pages. Instead we
 * REWRITE THE EXISTING LINK'S `href` in place: React only writes an
 * attribute when its own props change, so a mounted element whose props stay
 * the same keeps our href and can still be deleted safely whenever React
 * wants (the parent is untouched, so `removeChild` works).
 *
 * Only links WE created (`data-brand="created"`) are ever removed, and they
 * are ours alone, so that is safe too.
 */
const DEFAULT_ICON = "/favicon.ico";
const ICON_SELECTOR = 'link[rel~="icon"]';

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

const iconLinks = () =>
  Array.from(document.querySelectorAll<HTMLLinkElement>(ICON_SELECTOR));

/** Point the tab icon at the custom image — mutating in place, never deleting. */
function applyIcon(href: string): void {
  const all = iconLinks();
  // Prefer a link React inserted (mutating it costs React nothing); only
  // create our own when the document has no icon link at all.
  const foreign = all.filter((l) => !l.dataset.brand);
  const owned = all.filter((l) => !!l.dataset.brand);
  let target = foreign[0] ?? owned[0];

  if (!target) {
    target = document.createElement("link");
    target.rel = "icon";
    target.dataset.brand = "created";
    document.head.appendChild(target);
  } else if (!target.dataset.brand) {
    // Remember the original values so the "cleared" pass can put them back.
    target.dataset.brand = "hijacked";
    target.dataset.brandOrig = target.getAttribute("href") || DEFAULT_ICON;
    target.dataset.brandType = target.getAttribute("type") || "";
  }

  // Duplicate icon links are only dropped when WE created them.
  for (const l of owned) if (l !== target) l.remove();

  target.setAttribute("href", href);
  const mime = mimeFor(href);
  if (mime) target.setAttribute("type", mime);
  else target.removeAttribute("type");
}

/** Back to the built-in `/favicon.ico`. */
function restoreIcon(): void {
  for (const l of iconLinks()) {
    if (l.dataset.brand === "created") {
      l.remove();
      continue;
    }
    if (l.dataset.brand === "hijacked") {
      l.setAttribute("href", l.dataset.brandOrig || DEFAULT_ICON);
      const type = l.dataset.brandType;
      if (type) l.setAttribute("type", type);
      else l.removeAttribute("type");
      delete l.dataset.brand;
      delete l.dataset.brandOrig;
      delete l.dataset.brandType;
    }
  }
  // Nothing left (or there never was one) → put the default back.
  if (!document.querySelector(ICON_SELECTOR)) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = DEFAULT_ICON;
    document.head.appendChild(link);
  }
}

export function SiteFavicon() {
  const { data } = useBranding();
  const href = data?.brandFavicon || "";

  useEffect(() => {
    if (href) applyIcon(href);
    else restoreIcon();
  }, [href]);

  return null;
}
