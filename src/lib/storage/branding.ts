import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Super-admin editable branding: logo, association names, landing-page copy
 * and the watermark used in every PDF / admit card.
 *
 * Stored in `system_settings` (key/value rows, category "branding") so it
 * needs no new table. Empty string = "not customized" → callers fall back to
 * the built-in i18n defaults.
 */
export interface BrandingSettings {
  /** Association name (English) — landing header/footer, admit cards, PDFs. */
  brandName: string;
  /** Association name (Bangla). */
  brandNameBn: string;
  /** Short crest text, e.g. "BMA" — text watermark + logo fallback box. */
  brandShort: string;
  /** Logo image URL — landing header/footer + admit-card crest fallback. */
  brandLogo: string;
  /** Favicon image URL (browser-tab icon). Empty → the app's built-in
   *  /favicon.ico. Never used on PDFs or admit cards. */
  brandFavicon: string;
  /** Watermark image URL for PDFs/admit cards; empty → text watermark. */
  brandWatermark: string;
  /** Managing Director's signature image — shown on the admit-card footer. */
  mdSignature: string;
  /** Landing hero headline, part 1 (empty → built-in translation). */
  heroTitle1: string;
  heroTitle1Bn: string;
  /** Landing hero headline, part 2 (the muted second line). */
  heroTitle2: string;
  heroTitle2Bn: string;
  /** Landing hero paragraph. */
  heroSubtitle: string;
  heroSubtitleBn: string;
  /** Landing footer tagline (under the logo). */
  footerTagline: string;
  footerTaglineBn: string;
  /** Dashboard accent color (hex, e.g. "#e11d48"). Empty → default
   *  monochrome chrome (white accent in dark, near-black in light). */
  accentColor: string;
}

export const BRANDING_DEFAULTS: BrandingSettings = {
  brandName: "Bangladesh Madrasah Association",
  brandNameBn: "বাংলাদেশ মাদ্রাসা এসোসিয়েশন",
  brandShort: "BMA",
  brandLogo: "",
  brandFavicon: "",
  brandWatermark: "",
  mdSignature: "",
  heroTitle1: "",
  heroTitle1Bn: "",
  heroTitle2: "",
  heroTitle2Bn: "",
  heroSubtitle: "",
  heroSubtitleBn: "",
  footerTagline: "",
  footerTaglineBn: "",
  accentColor: "",
};

const BRANDING_KEYS = Object.keys(BRANDING_DEFAULTS) as Array<keyof BrandingSettings>;

export async function fetchBranding(): Promise<BrandingSettings> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("key,value")
      .in("key", BRANDING_KEYS);
    if (error || !data) return { ...BRANDING_DEFAULTS };
    const map = Object.fromEntries(
      data.map((s: { key: string; value: string }) => [s.key, s.value])
    );
    const out: BrandingSettings = { ...BRANDING_DEFAULTS };
    for (const k of BRANDING_KEYS) {
      // A stored row (even an empty string) wins over the default — clearing
      // a field in settings must stick, not silently revert.
      if (map[k] !== undefined) out[k] = map[k];
    }
    return out;
  } catch {
    // RLS/network issues → public pages just show the built-in defaults.
    return { ...BRANDING_DEFAULTS };
  }
}

export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: fetchBranding,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useSaveBranding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: BrandingSettings) => {
      const supabase = createClient();
      // Snapshot the CURRENT image URLs first — cleanup must only happen
      // after the save succeeds (aborting a save must leave the live
      // branding, and its files, untouched).
      const { data: prevRows } = await supabase
        .from("system_settings")
        .select("key,value")
        .in("key", ["brandLogo", "brandFavicon", "brandWatermark", "mdSignature"]);
      const rows = BRANDING_KEYS.map((k) => ({
        key: k,
        value: values[k] ?? "",
        category: "branding",
      }));
      const { error } = await supabase
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      const prev: Record<string, string> = Object.fromEntries(
        (prevRows || []).map((r: { key: string; value: string }) => [r.key, r.value])
      );
      // Best-effort: drop old storage objects that were replaced or removed.
      await removeBrandingObject(prev.brandLogo, values.brandLogo);
      await removeBrandingObject(prev.brandFavicon, values.brandFavicon, true);
      await removeBrandingObject(prev.brandWatermark, values.brandWatermark);
      await removeBrandingObject(prev.mdSignature, values.mdSignature);
      return values;
    },
    onSuccess: () => {
      // Refresh every consumer (landing page, admit cards, sidebar) at once.
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
  });
}

/**
 * Best-effort delete of a previously stored branding object once it has
 * been replaced or removed. Only ever touches files we own
 * (`<bucket>/branding/…`) — never any other storage path.
 * `faviconVariants` also drops the manifest icon variants derived from a
 * favicon upload (they are never referenced from settings rows themselves).
 */
async function removeBrandingObject(
  oldUrl?: string,
  newUrl?: string,
  faviconVariants = false
): Promise<void> {
  if (!oldUrl || oldUrl === newUrl) return;
  try {
    const clean = oldUrl.split("?")[0];
    const marker = "/storage/v1/object/public/";
    const idx = clean.indexOf(marker);
    if (idx === -1) return; // not a public-object URL we recognize
    const rest = decodeURIComponent(clean.slice(idx + marker.length)); // "<bucket>/<path>"
    const slash = rest.indexOf("/");
    if (slash === -1) return;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (!path.startsWith("branding/")) return;
    const supabase = createClient();
    const paths = faviconVariants ? [path, ...faviconVariantPaths(path)] : [path];
    await supabase.storage.from(bucket).remove(paths);
  } catch {
    // A leftover file never breaks the app — ignore cleanup failures.
  }
}

/** Upload a branding image (logo / favicon / watermark / MD signature) to the public bucket. */
export async function uploadBrandingImage(
  file: File,
  kind: "logo" | "favicon" | "watermark" | "md-signature"
): Promise<string> {
  const supabase = createClient();
  const ext =
    (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  const path = `branding/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("public")
    .upload(path, file, { contentType: file.type || "image/png", upsert: true });
  if (error) throw error;
  // The installed-PWA icons must show the favicon too: render the fixed-size
  // manifest variants alongside the upload (see faviconVariantPaths).
  if (kind === "favicon") await uploadFaviconVariants(path, file);
  const { data } = supabase.storage.from("public").getPublicUrl(path);
  return data?.publicUrl || "";
}

/**
 * Storage paths of the manifest icons derived from a favicon upload:
 * `<name>_192.png`, `<name>_512.png`, `<name>_maskable.png` next to the
 * original — exactly what src/app/manifest.ts lists for the installed app.
 */
function faviconVariantPaths(path: string): string[] {
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash + 1);
  const stem = path.slice(slash + 1).replace(/\.[^.]+$/, "");
  return [`${dir}${stem}_192.png`, `${dir}${stem}_512.png`, `${dir}${stem}_maskable.png`];
}

/**
 * Render one PWA icon variant of a favicon upload: a square `size`-px PNG
 * with the image scaled to fit. `maskable` adds the manifest background and
 * keeps the artwork inside the launcher-safe inner 80% box. Returns null
 * when the browser cannot decode the file (some engines refuse .ico in
 * <img>) — callers treat that as "no variant", never as an error.
 */
async function renderFaviconVariant(
  file: File,
  size: number,
  maskable: boolean
): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (maskable) {
      // manifest background_color — full-bleed behind the artwork.
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, size, size);
    }
    const box = maskable ? size * 0.8 : size;
    const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Best-effort upload of the manifest variants for a favicon. Failures never
 * break the favicon upload itself — src/app/manifest.ts also lists the raw
 * favicon URL, so the installed app still gets the right artwork.
 */
async function uploadFaviconVariants(path: string, file: File): Promise<void> {
  const specs: Array<[size: number, maskable: boolean]> = [
    [192, false],
    [512, false],
    [512, true],
  ];
  const paths = faviconVariantPaths(path);
  const supabase = createClient();
  for (let i = 0; i < specs.length; i++) {
    try {
      const [size, maskable] = specs[i];
      const blob = await renderFaviconVariant(file, size, maskable);
      if (!blob) continue;
      await supabase.storage
        .from("public")
        .upload(paths[i], blob, { contentType: "image/png", upsert: true });
    } catch {
      // skip — fallback entry in the manifest covers us
    }
  }
}
