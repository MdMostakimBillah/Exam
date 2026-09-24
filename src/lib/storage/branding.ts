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
  /** Watermark image URL for PDFs/admit cards; empty → text watermark. */
  brandWatermark: string;
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
  brandWatermark: "",
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
        .in("key", ["brandLogo", "brandWatermark"]);
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
      await removeBrandingObject(prev.brandWatermark, values.brandWatermark);
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
 */
async function removeBrandingObject(oldUrl?: string, newUrl?: string): Promise<void> {
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
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // A leftover file never breaks the app — ignore cleanup failures.
  }
}

/** Upload a branding image (logo / watermark) to the public bucket. */
export async function uploadBrandingImage(
  file: File,
  kind: "logo" | "watermark"
): Promise<string> {
  const supabase = createClient();
  const ext =
    (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  const path = `branding/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("public")
    .upload(path, file, { contentType: file.type || "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("public").getPublicUrl(path);
  return data?.publicUrl || "";
}
