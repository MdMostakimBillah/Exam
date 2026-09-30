import type { MetadataRoute } from "next";

/**
 * PWA web app manifest (App Router file convention — Next serves it at
 * /manifest.webmanifest and injects <link rel="manifest"> automatically).
 *
 * Icons are generated from src/app/favicon.ico (the brand mark) and live in
 * public/icons/. name/short_name match the app's bilingual branding defaults
 * (BRANDING_DEFAULTS in src/lib/storage/branding.ts).
 *
 * NOTE: the super-admin custom favicon (Settings → Branding → Favicon) only
 * rewrites the tab icon client-side (SiteFavicon); it does NOT change these
 * install icons — manifest icons must be stable, cacheable same-origin files.
 */
export default function manifest(): MetadataRoute.Manifest {
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
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
