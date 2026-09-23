"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Service-role client: used ONLY to pre-read rows and to clean up
// storage/auth AFTER the database wipe. The wipe itself runs through the
// cookie-based client so auth.uid() (and the super-admin check inside
// the function) see the real caller.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DeleteInstitutionResult {
  success: boolean;
  error?: string;
  /** Per-table deleted row counts returned by the cascade function. */
  counts?: Record<string, number>;
  /** Non-fatal problems (an image or account that could not be removed). */
  warnings?: string[];
}

/**
 * Permanently deletes an institution AND everything that belongs to it,
 * everywhere:
 *  - DB rows (all sessions): students, registrations, results, certificates,
 *    payments, exam centers, marks, admit cards, the institution's user
 *    notifications, profiles (admin + staff) and the institution row —
 *    removed in ONE transaction by delete_institution_cascade().
 *  - Storage images: logo, payment proofs, student photos (best-effort).
 *  - Auth login accounts of the admin and staff (best-effort).
 *
 * Requires the caller to be a super admin — verified here AND inside the
 * database function.
 */
export async function deleteInstitutionServer(
  institutionId: string
): Promise<DeleteInstitutionResult> {
  const warnings: string[] = [];
  try {
    // 1. Authenticate and verify the caller is a super admin (never trust the browser)
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || String(profile.role).toUpperCase() !== "SUPER_ADMIN") {
      return { success: false, error: "Only a super admin can delete an institution" };
    }

    // 2. Collect everything needed AFTER the rows are gone
    //    (URLs and account ids disappear with the rows)
    const { data: inst } = await supabaseAdmin
      .from("institutions")
      .select("id, logo_url, admin_user_id")
      .eq("id", institutionId)
      .single();
    if (!inst) return { success: false, error: "Institution not found" };

    const [proofs, photos, profiles] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select("proof_image")
        .eq("institution_id", institutionId)
        .not("proof_image", "is", null),
      supabaseAdmin
        .from("students")
        .select("photo_url")
        .eq("institution_id", institutionId)
        .not("photo_url", "is", null),
      supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("institution_id", institutionId),
    ]);

    const imageUrls: string[] = [
      inst.logo_url,
      ...(proofs.data || []).map((r) => r.proof_image as string),
      ...(photos.data || []).map((r) => r.photo_url as string),
    ].filter((u): u is string => !!u);

    const accountIds = [
      ...new Set(
        [
          ...(profiles.data || []).map((r) => r.id as string),
          inst.admin_user_id,
        ].filter((id): id is string => !!id)
      ),
    ];

    // 3. Atomic DB wipe — one transaction inside the RPC.
    //    Called with the USER's JWT (cookie client) so the function's
    //    auth.uid() super-admin check passes.
    const { data: counts, error: rpcError } = await supabase.rpc(
      "delete_institution_cascade",
      { p_institution_id: institutionId }
    );
    if (rpcError) return { success: false, error: rpcError.message };

    // 4. Best-effort: remove every stored image (logo / proofs / photos)
    const buckets = new Map<string, Set<string>>();
    for (const url of imageUrls) {
      const parsed = parseStoragePath(url);
      if (!parsed) continue;
      if (!buckets.has(parsed.bucket)) buckets.set(parsed.bucket, new Set());
      buckets.get(parsed.bucket)!.add(parsed.path);
    }
    for (const [bucket, paths] of buckets) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([...paths]);
      if (error) {
        warnings.push(`storage(${bucket}): ${error.message}`);
      }
    }

    // 5. Best-effort: remove the admin's and staff's login accounts
    for (const accountId of accountIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(accountId);
      if (error && !/not found/i.test(error.message)) {
        warnings.push(`auth(${accountId}): ${error.message}`);
      }
    }

    return {
      success: true,
      counts: (counts as Record<string, number>) || undefined,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Parses a Supabase public object URL
 * (https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path...>)
 * into bucket + path. Returns null for anything else (e.g. external URLs).
 */
function parseStoragePath(url: string): { bucket: string; path: string } | null {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    const objectIdx = parts.indexOf("object");
    if (parts[0] !== "storage" || objectIdx === -1) return null;
    // public URLs: /storage/v1/object/public/<bucket>/<path...>
    if (parts[objectIdx + 1] !== "public") return null;
    const bucket = parts[objectIdx + 2];
    if (!bucket || objectIdx + 3 > parts.length) return null;
    return { bucket, path: parts.slice(objectIdx + 2).join("/") };
  } catch {
    return null;
  }
}
