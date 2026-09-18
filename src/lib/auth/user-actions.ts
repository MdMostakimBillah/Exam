"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CreateUserResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export async function createUserServer(data: {
  email: string;
  password: string;
  name: string;
  role: string;
  institutionId?: string;
}): Promise<CreateUserResult> {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        role: data.role.toLowerCase(),
      },
    });

    if (authError) return { success: false, error: authError.message };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role.toLowerCase(),
        institution_id: data.institutionId || null,
      });

    if (profileError) return { success: false, error: profileError.message };

    return { success: true, userId: authData.user.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteUserServer(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function resetPasswordServer(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
