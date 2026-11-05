"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "./action-guard";

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
 * Super admin: create an institution TOGETHER WITH its login account.
 *
 * The account is created with `email_confirm: true`, so NO verification
 * email/code is ever sent — the email + password entered here work as the
 * institution's login immediately. (The public /register flow asks for a
 * 6-digit code because it is anonymous; this one is guarded by the
 * super-admin check above.)
 *
 * Mirrors registerInstitution's account wiring: the handle_new_user trigger
 * creates the profile, we attach institution_id afterwards (the trigger
 * deliberately ignores metadata institution_id), then back-reference
 * admin_user_id on the institution row. Every failure rolls back what was
 * already written so no half-created institution is left behind.
 */
export interface CreateInstitutionResult {
  success: boolean;
  error?: string;
  institutionId?: string;
  userId?: string;
}

export async function createInstitutionWithAccountServer(data: {
  name: string;
  code: string;
  slug?: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  contactPerson?: string;
  contactPersonPhone?: string;
  status?: string;
}): Promise<CreateInstitutionResult> {
  try {
    const caller = await requireSuperAdmin();
    if (!caller.ok) return { success: false, error: caller.error };

    const name = String(data.name || "").trim();
    const code = String(data.code || "").trim();
    const email = String(data.email || "").trim();
    if (!name) return { success: false, error: "Institution name is required" };
    if (!code) return { success: false, error: "Institution code is required" };
    if (!email.includes("@") || email.length > 254) {
      return { success: false, error: "A valid email is required" };
    }
    if ((data.password || "").length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }
    const status = ["PENDING", "ACTIVE", "SUSPENDED"].includes(String(data.status))
      ? String(data.status)
      : "PENDING";

    // Slug feeds the /i/<slug> URL: keep it slug-safe, fall back to the code
    // (a Bangla name auto-generates an empty slug).
    const rawSlug = String(data.slug || "").toLowerCase().trim();
    const slug = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(rawSlug)
      ? rawSlug
      : `inst-${
          code
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || Date.now().toString(36)
        }`;

    // 1. Institution row (service role — caller already proven super admin)
    const { data: inst, error: instError } = await supabaseAdmin
      .from("institutions")
      .insert({
        name,
        code,
        slug,
        email,
        phone: data.phone || "",
        address: data.address || "",
        city: data.city || "",
        district: data.district || "",
        contact_person: data.contactPerson || "",
        contact_person_phone: data.contactPersonPhone || "",
        status,
        total_students: 0,
        total_applications: 0,
      })
      .select("id")
      .single();
    if (instError) {
      if (instError.code === "23505") {
        return { success: false, error: "Institution code or slug already exists" };
      }
      return { success: false, error: instError.message };
    }

    // 2. Login account — email pre-confirmed: NO verification email/code.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name, role: "institution_admin", institution_id: inst.id },
    });
    if (authError) {
      await supabaseAdmin.from("institutions").delete().eq("id", inst.id);
      return { success: false, error: `Login account: ${authError.message}` };
    }

    // 3. handle_new_user() already created the profile — attach it.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ institution_id: inst.id })
      .eq("id", authData.user.id);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
      await supabaseAdmin.from("institutions").delete().eq("id", inst.id);
      return { success: false, error: profileError.message };
    }

    // 4. Back-reference used by the dashboard's fallback lookup.
    await supabaseAdmin
      .from("institutions")
      .update({ admin_user_id: authData.user.id })
      .eq("id", inst.id);

    return { success: true, institutionId: inst.id, userId: authData.user.id };
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
