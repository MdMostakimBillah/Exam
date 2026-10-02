"use client";
import { useEffect } from "react";
import { useBranding } from "@/lib/storage/branding";

/**
 * Applies the super-admin accent color (Settings → Branding) as CSS
 * custom properties on <html>.
 *
 * Only the per-theme SLOTS are written — never `--brand-accent` itself —
 * so the mapping rules in globals.css keep control of the value the page
 * actually uses. That lets the same saved hue be tuned per surface:
 *
 *   --brand-accent[-dark|light]       the FILL (buttons, switches, chips,
 *                                     progress bars). Hue is untouched;
 *                                     only its relative luminance is
 *                                     clamped so the always-white label on
 *                                     it stays ≥4.5:1, and so the control
 *                                     is distinguishable from the page
 *                                     (WCAG 1.4.11 needs 3:1).
 *   --brand-accent-text[-dark|light]  the TEXT variant (links, labels,
 *                                     active "soft" chips). Retuned hard:
 *                                     ≥0.33 luminance in dark so it reads
 *                                     on #0a0a0b and on a 14%-soft chip,
 *                                     ≤0.14 in light so it clears 4.5:1 on
 *                                     #f4f4f5 and on white.
 *
 * When the saved accent is empty or invalid every slot is removed and the
 * stylesheet defaults (theme-aware monochrome) apply.
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

type RGB = [number, number, number];

/** Expand #rgb → #rrggbb and parse to [r, g, b] (0-255). */
function hexToRgb(hex: string): RGB {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  const part = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** WCAG relative luminance (0 = black, 1 = white). */
function relLum([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Drive the color's relative luminance to `target` while keeping hue and
 * saturation. HSL lightness is monotonic in relative luminance, so a plain
 * bisection converges in a few dozen steps.
 */
function toLuminance(rgb: RGB, target: number): RGB {
  const [h, s] = rgbToHsl(rgb);
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (relLum(hslToRgb([h, s, mid])) < target) lo = mid;
    else hi = mid;
  }
  return hslToRgb([h, s, (lo + hi) / 2]);
}

/**
 * Nudge luminance only when it violates the bound — passing colors come
 * through byte-identical, so an already-legible accent isn't disturbed.
 * The retry compensates for 8-bit rounding at the boundary.
 */
function clampLuminance(rgb: RGB, target: number, dir: "min" | "max"): RGB {
  const cur = relLum(rgb);
  if (dir === "min" ? cur >= target : cur <= target) return rgb;
  let out = toLuminance(rgb, target);
  if (dir === "min" ? relLum(out) < target : relLum(out) > target) {
    out = toLuminance(rgb, dir === "min" ? target * 1.04 : target * 0.96);
  }
  return out;
}

/* White label on the fill: needs the fill's luminance ≤0.183 (4.5:1).
   Dark fill also needs a floor of 0.115 so the control itself is ≥3:1
   against the near-black page (WCAG 1.4.11). Light pages only need the
   cap — dark fills already clear 3:1 on white. */
const FILL_CAP = 0.183;
const FILL_FLOOR_DARK = 0.115;
const TEXT_FLOOR_DARK = 0.33;
const TEXT_CEIL_LIGHT = 0.14;

/** Text color for anything drawn ON the accent fill. By design the text
 *  inside the branding color is always white — no black-on-bright auto-pick. */
export function accentFg(_hex: string): string {
  return "#ffffff";
}

/** Accent at a given alpha — used for soft chips / icon backgrounds. */
export function accentRgba(hex: string, alpha: number): string {
  if (!HEX_RE.test(hex)) return `rgba(255, 255, 255, ${alpha})`;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ACCENT_VARS = [
  "--brand-accent-dark",
  "--brand-accent-light",
  "--brand-accent-fg-dark",
  "--brand-accent-fg-light",
  "--brand-accent-text-dark",
  "--brand-accent-text-light",
  "--brand-accent-soft-dark",
  "--brand-accent-soft-light",
  "--brand-accent-strong-dark",
  "--brand-accent-strong-light",
];

/** Set by earlier versions as raw inline values on <html>/<body>; removing
 *  them hands control of `--brand-accent` back to the stylesheet mapping. */
const LEGACY_INLINE_VARS = [
  "--brand-accent",
  "--brand-accent-fg",
  "--brand-accent-soft",
  "--brand-accent-strong",
];

export function AccentColor() {
  const { data } = useBranding();
  const accent = (data?.accentColor || "").trim();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const targets = [root, body];

    const clear = () => {
      for (const el of targets) {
        for (const name of [...ACCENT_VARS, ...LEGACY_INLINE_VARS]) {
          el.style.removeProperty(name);
        }
      }
    };

    if (!HEX_RE.test(accent)) {
      clear();
      return;
    }

    const rgb = hexToRgb(accent);
    const fillLight = rgbToHex(clampLuminance(rgb, FILL_CAP, "max"));
    const fillDark = rgbToHex(clampLuminance(hexToRgb(fillLight), FILL_FLOOR_DARK, "min"));
    const textDark = rgbToHex(clampLuminance(rgb, TEXT_FLOOR_DARK, "min"));
    const textLight = rgbToHex(clampLuminance(rgb, TEXT_CEIL_LIGHT, "max"));

    clear();
    // Slots live on <html> only — the html.light / html.dark mapping rules
    // resolve them there, and every descendant inherits the mapped value.
    root.style.setProperty("--brand-accent-dark", fillDark);
    root.style.setProperty("--brand-accent-light", fillLight);
    root.style.setProperty("--brand-accent-fg-dark", accentFg(fillDark));
    root.style.setProperty("--brand-accent-fg-light", accentFg(fillLight));
    root.style.setProperty("--brand-accent-text-dark", textDark);
    root.style.setProperty("--brand-accent-text-light", textLight);
    root.style.setProperty("--brand-accent-soft-dark", accentRgba(fillDark, 0.14));
    root.style.setProperty("--brand-accent-soft-light", accentRgba(fillLight, 0.14));
    root.style.setProperty("--brand-accent-strong-dark", accentRgba(fillDark, 0.45));
    root.style.setProperty("--brand-accent-strong-light", accentRgba(fillLight, 0.45));
  }, [accent]);

  return null;
}
