import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * PWA web app manifest (App Router file convention — Next serves it at
 * /manifest.webmanifest and injects <link rel="manifest"> automatically).
 *
 * Icons FOLLOW the super-admin favicon (Settings → Branding → Favicon): the
 * browser tab (SiteFavicon) and the installed app must show the same logo.
 * `uploadBrandingImage` stores three derived PNG variants next to every
 * favicon upload — `<name>_192.png`, `<name>_512.png`, `<name>_maskable.png`
 * — and this manifest points at them whenever a custom favicon is saved.
 * Without one we fall back to the built-in mark in public/icons/; the raw
 * favicon URL is always listed too, so uploads that predate the variants
 * still install with the right artwork.
 *
 * name/short_name match BRANDING_DEFAULTS in src/lib/storage/branding.ts.
 *
 * `revalidate` (hourly) lets a favicon swap reach clients without a
 * redeploy. public/sw.js deliberately does NOT cache the manifest — it is
 * the one "static" URL whose contents can change at runtime.
 */
export const revalidate = 3600;

const DEFAULT_ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
];

/** Installed-app icons derived from a custom favicon URL. */
function brandIcons(faviconUrl: string): MetadataRoute.Manifest["icons"] {
  const base = faviconUrl.split("?")[0];
  const stem = base.replace(/\.[a-z0-9]+$/i, "");
  const ext = (base.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  const type =
    ext === "jpg"
      ? "image/jpeg"
      : ext === "ico"
        ? "image/x-icon"
        : ext && ext !== "png"
          ? `image/${ext}`
          : "image/png";
  return [
    // Launcher icon + splash screen (purpose "any") — the favicon artwork
    // at the sizes every platform expects.
    { src: `${stem}_192.png`, sizes: "192x192", type: "image/png" },
    { src: `${stem}_512.png`, sizes: "512x512", type: "image/png" },
    // Adaptive-icon layer: artwork inside the launcher-safe inner 80% on
    // the manifest background, so no mask shape ever clips it.
    {
      src: `${stem}_maskable.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
    // The upload itself — fallback for pre-variant files. Its unknown
    // ("any") size loses to the explicit 512 variant above.
    { src: faviconUrl, sizes: "any", type },
  ];
}

/** Custom favicon saved in Settings → Branding ("" = use built-in mark). */
async function fetchBrandFavicon(): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return "";
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "brandFavicon")
      .maybeSingle();
    if (error) return "";
    return typeof data?.value === "string" ? data.value.trim() : "";
  } catch {
    return "";
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brandFavicon = await fetchBrandFavicon();
  return {
    id: "/",
    name: "Bangladesh Madrasah Association — Scholarship Examination Management Platform",
    short_name: "Madrasah Exam",
    description:
      "A complete platform for institutions to manage scholarship examinations, student registrations, results, and certificates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#090909",
    lang: "en",
    categories: ["education", "business"],
    icons: brandFavicon ? brandIcons(brandFavicon) : DEFAULT_ICONS,
  };
}
