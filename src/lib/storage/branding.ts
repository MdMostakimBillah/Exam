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
      const rows = BRANDING_KEYS.map((k) => ({
        key: k,
        value: values[k] ?? "",
        category: "branding",
      }));
      const { error } = await supabase
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      return values;
    },
    onSuccess: () => {
      // Refresh every consumer (landing page, admit cards, sidebar) at once.
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
  });
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
