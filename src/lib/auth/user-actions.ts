"use server";

import { createClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "./action-guard";

// SERVICE ROLE: every export in this file MUST call requireSuperAdmin() before
// touching this client. Without that check any anonymous caller could mint a
// super-admin account or delete arbitrary users.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Roles a super admin may grant. Blocks privilege-escalation via arbitrary input. */
const ASSIGNABLE_ROLES = new Set(["super_admin", "institution_admin", "staff"]);


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
    // Guard: service-role user creation is super-admin only (C3).
    const caller = await requireSuperAdmin();
    if (!caller.ok) return { success: false, error: caller.error };

    const role = String(data.role || "").toLowerCase();
    if (!ASSIGNABLE_ROLES.has(role)) {
      return { success: false, error: `Unsupported role: ${data.role}` };
    }
    if (!data.email?.includes("@")) return { success: false, error: "A valid email is required" };
    if ((data.password || "").length < 8) return { success: false, error: "Password must be at least 8 characters" };

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        role,
      },
    });

    if (authError) return { success: false, error: authError.message };

    // handle_new_user() has already inserted the profile row (with a
    // normalised role), so upsert rather than insert — otherwise the
    // guaranteed duplicate-key error makes this action unusable.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authData.user.id,
          email: data.email,
          name: data.name,
          role,
          institution_id: data.institutionId || null,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      // Don't leave a half-created account behind.
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
      return { success: false, error: profileError.message };
    }

    return { success: true, userId: authData.user.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface UpdateUserResult {
  success: boolean;
  error?: string;
}

export async function updateUserServer(data: {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  institutionId?: string | null;
  password?: string;
}): Promise<UpdateUserResult> {
  try {
    const caller = await requireSuperAdmin();
    if (!caller.ok) return { success: false, error: caller.error };
    if (!data.userId) return { success: false, error: "User id is required" };

    let role: string | undefined;
    if (data.role !== undefined) {
      role = String(data.role || "").toLowerCase();
      if (!ASSIGNABLE_ROLES.has(role)) return { success: false, error: `Unsupported role: ${data.role}` };
      // The last super admin must not be able to demote themselves out of
      // the only account that can grant roles again.
      if (role !== "super_admin" && data.userId === caller.userId) {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin");
        if ((count ?? 0) <= 1) return { success: false, error: "At least one super admin must remain" };
      }
    }

    if (data.email !== undefined && !data.email.includes("@")) {
      return { success: false, error: "A valid email is required" };
    }
    if (data.password !== undefined && data.password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = String(data.name).slice(0, 200);
    if (data.email !== undefined) patch.email = data.email;
    if (role !== undefined) patch.role = role;
    if (data.institutionId !== undefined) patch.institution_id = data.institutionId;

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) return { success: false, error: error.message };

    if (data.email !== undefined) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.email,
      });
      if (authErr) return { success: false, error: authErr.message };
    }
    if (data.password) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (pwErr) return { success: false, error: pwErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteUserServer(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await requireSuperAdmin();
    if (!caller.ok) return { success: false, error: caller.error };
    // Never allow an action to delete the caller's own account — a locked-out
    // or confused admin would brick their only super-admin session.
    if (userId === caller.userId) {
      return { success: false, error: "You cannot delete your own account" };
    }

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
    const caller = await requireSuperAdmin();
    if (!caller.ok) return { success: false, error: caller.error };
    if (!email?.includes("@")) return { success: false, error: "A valid email is required" };

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
