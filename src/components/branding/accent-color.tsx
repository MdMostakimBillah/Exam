"use client";
import { useEffect } from "react";
import { useBranding } from "@/lib/storage/branding";

/**
 * Applies the super-admin accent color (Settings → Branding) as CSS
 * custom properties on <html> (and <body>, for safety). When the saved
 * accent is empty or invalid the inline vars are removed so the
 * stylesheet defaults in globals.css (theme-aware monochrome) apply.
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Expand #rgb → #rrggbb and parse to [r, g, b] (0-255). */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Text color for anything drawn ON the accent fill. By design the text
 *  inside the branding color is always white — no black-on-bright auto-pick. */
export function accentFg(hex: string): string {
  return "#ffffff";
}

/** Accent at a given alpha — used for soft chips / icon backgrounds. */
export function accentRgba(hex: string, alpha: number): string {
  if (!HEX_RE.test(hex)) return `rgba(255, 255, 255, ${alpha})`;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ACCENT_VARS = [
  "--brand-accent",
  "--brand-accent-fg",
  "--brand-accent-soft",
  "--brand-accent-strong",
];

export function AccentColor() {
  const { data } = useBranding();
  const accent = (data?.accentColor || "").trim();

  useEffect(() => {
    const targets = [document.documentElement, document.body];
    if (!HEX_RE.test(accent)) {
      for (const el of targets) {
        for (const name of ACCENT_VARS) el.style.removeProperty(name);
      }
      return;
    }
    const fg = accentFg(accent);
    const soft = accentRgba(accent, 0.14);
    const strong = accentRgba(accent, 0.45);
    for (const el of targets) {
      el.style.setProperty("--brand-accent", accent);
      el.style.setProperty("--brand-accent-fg", fg);
      el.style.setProperty("--brand-accent-soft", soft);
      el.style.setProperty("--brand-accent-strong", strong);
    }
  }, [accent]);

  return null;
}
