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

/** Pick black or white text for maximum contrast on the given color
 *  (WCAG relative luminance; crossover vs black/white is L ≈ 0.179). */
export function accentFg(hex: string): string {
  if (!HEX_RE.test(hex)) return "#000000";
  const [r, g, b] = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.179 ? "#000000" : "#ffffff";
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
