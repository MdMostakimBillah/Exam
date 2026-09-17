"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // 1. Create institution
    const { data: institution, error: instError } = await supabaseAdmin
      .from("institutions")
      .insert({
        name: data.name,
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
        role: "INSTITUTION_ADMIN",
        institution_id: institution.id,
      },
    });

    if (authError) {
      // Rollback institution
      await supabaseAdmin.from("institutions").delete().eq("id", institution.id);
      return { success: false, error: `Auth error: ${authError.message}` };
    }

    // 3. Create profile with institution_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email: data.email,
        name: data.nameEnglish || data.name,
        role: "INSTITUTION_ADMIN",
        institution_id: institution.id,
      });

    if (profileError) {
      return { success: false, error: `Profile error: ${profileError.message}` };
    }

    // 4. Update institution with admin user id
    await supabaseAdmin
      .from("institutions")
      .update({ admin_user_id: authData.user.id })
      .eq("id", institution.id);

    return { success: true, institutionId: institution.id, userId: authData.user.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function uploadLogo(slug: string, file: ArrayBuffer, ext: string): Promise<string> {
  try {
    const path = `institution-logos/${slug}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("public")
      .upload(path, file, { contentType: `image/${ext}`, upsert: true });

    if (error) return "";

    const { data } = supabaseAdmin.storage.from("public").getPublicUrl(path);
    return data?.publicUrl || "";
  } catch {
    return "";
  }
}
