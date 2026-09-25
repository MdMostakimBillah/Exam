"use server";

import { createClient } from "@supabase/supabase-js";
import { requireRegistrationOpen, requireUser } from "./action-guard";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Upload guard shared by the public register page and the institution
 * settings page: signed-in staff/admins may upload, anonymous callers only
 * while registration is open. Nobody else reaches the service-role client.
 */
async function canUploadBranding(): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireUser();
  if (caller.ok) {
    const allowed = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "STAFF"];
    return allowed.includes(caller.role)
      ? { ok: true }
      : { ok: false, error: "Not allowed to upload branding images" };
  }
  const reg = await requireRegistrationOpen();
  return reg.ok ? { ok: true } : { ok: false, error: reg.error };
}

/** Raster-only, path-safe extension allowlist. SVG is excluded on purpose —
 *  a stored SVG opened directly executes script on the storage origin. */
const ALLOWED_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);
/** Matches system_settings.max_upload_size_mb (5). */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
/** Slug becomes part of the storage object key — keep it strictly slug-safe. */
const SAFE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
/** Institution codes become URL/path fragments elsewhere — keep them tight. */
const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;


export interface RegisterInstitutionResult {
  success: boolean;
  error?: string;
  institutionId?: string;
  userId?: string;
}

export async function registerInstitution(data: {
  name: string;
  nameEnglish: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  logoUrl: string;
  password: string;
}): Promise<RegisterInstitutionResult> {
  try {
    // Public self-registration: allowed only while registration is open.
    const gate = await requireRegistrationOpen();
    if (!gate.ok) return { success: false, error: gate.error };

    // Basic shape validation before anything touches the database.
    if (!data.name?.trim()) return { success: false, error: "Institution name is required" };
    if (data.name.trim().length > 200) return { success: false, error: "Institution name is too long" };
    if (!data.email?.includes("@") || data.email.length > 254) return { success: false, error: "A valid email is required" };
    if ((data.password || "").length < 8) return { success: false, error: "Password must be at least 8 characters" };
    if (!SAFE_SLUG.test(data.slug)) return { success: false, error: "Invalid institution slug" };
    if (!SAFE_CODE.test(data.code || "")) return { success: false, error: "Invalid institution code" };
    if ((data.phone || "").length > 30 || (data.whatsapp || "").length > 30) {
      return { success: false, error: "Phone number is too long" };
    }
    if ((data.logoUrl || "").length > 500) return { success: false, error: "Logo URL is too long" };

    // 1. Create institution
    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .insert({
        name: data.name,
        name_en: data.nameEnglish || null,
        code: data.code,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        address: data.address,
        contact_person_phone: data.whatsapp,
        status: "PENDING",
        logo_url: data.logoUrl,
        total_students: 0,
        total_applications: 0,
      })
      .select("id")
      .single();

    if (instError) {
      return { success: false, error: `Institution error: ${instError.message}` };
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.nameEnglish || data.name,
        role: "institution_admin",
        institution_id: institution.id,
      },
    });

    if (authError) {
      // Rollback institution
      await supabaseAdmin.from("institutions").delete().eq("id", institution.id);
      return { success: false, error: `Auth error: ${authError.message}` };
    }

    // 3. Update profile with institution_id (trigger already created the profile)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ institution_id: institution.id })
      .eq("id", authData.user.id);

    if (profileError) {
      return { success: false, error: `Profile error: ${profileError.message}` };
    }

    // 4. Update institution with admin user id
    await supabaseAdmin
      .from("institutions")
      .update({ admin_user_id: authData.user.id })
      .eq("id", institution.id);

    // 5. Notify super-admins that a new institution awaits approval.
    //    Service role bypasses RLS; fire-and-forget so a notification
    //    failure never blocks the registration itself.
    try {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "super_admin");
      if (admins && admins.length > 0) {
        await supabaseAdmin.from("notifications").insert(admins.map((a) => ({
          user_id: a.id,
          title: "New institution registered",
          message: `${data.name} (${data.code}) is awaiting approval`,
          type: "warning",
          read: false,
          link: "/super-admin/institutions",
        })));
      }
    } catch { /* notification failures never block registration */ }

    return { success: true, institutionId: institution.id, userId: authData.user.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function uploadLogo(slug: string, file: ArrayBuffer, ext: string): Promise<string> {
  try {
    // Who is calling, and are they allowed to write to the public bucket?
    const gate = await canUploadBranding();
    if (!gate.ok) return "";

    // Sanitize every piece that becomes part of the object key.
    const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
    if (!safeSlug) return "";

    const safeExt = String(ext || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!ALLOWED_IMAGE_EXT.has(safeExt)) return "";

    // Enforce the advertised upload cap (settings page shows 5 MB).
    if (!file || file.byteLength > MAX_LOGO_BYTES) return "";

    const path = `institution-logos/${safeSlug}-${Date.now()}.${safeExt}`;
    const { error } = await supabaseAdmin.storage
      .from("public")
      .upload(path, file, { contentType: `image/${safeExt}`, upsert: false });

    if (error) return "";

    const { data } = supabaseAdmin.storage.from("public").getPublicUrl(path);
    return data?.publicUrl || "";
  } catch {
    return "";
  }
}
