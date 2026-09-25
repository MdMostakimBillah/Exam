"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

// Lockout bookkeeping runs on the SERVICE ROLE client. These RPCs write to
// login_attempts and read it back, so they must NOT be reachable through the
// anon/authenticated role (a direct PostgREST call to record_login_attempt
// would let anyone lock out any email address). Migration 0021 revokes EXECUTE
// from anon/authenticated and grants it to service_role only.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Client IP for lockout scoping. First hop of x-forwarded-for is the real
 *  client when a trusted proxy (Vercel/Next) sets it; fall back to x-real-ip. */
async function getClientIdentity(): Promise<{ ip: string; userAgent: string }> {
  let ip = "unknown";
  let userAgent = "unknown";
  try {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    ip = (forwarded ? forwarded.split(",")[0].trim() : null)
      || headersList.get("x-real-ip")
      || "unknown";
    userAgent = headersList.get("user-agent") || "unknown";
  } catch {}
  return { ip, userAgent };
}

export interface LoginResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  retryAfter?: number;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    institutionId?: string;
    avatar?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export async function loginWithLockout(email: string, password: string): Promise<LoginResult> {
  const supabase = await createClient();
  const { ip, userAgent } = await getClientIdentity();
  const emailLc = String(email || "").trim().toLowerCase();
  if (!emailLc || !password) {
    return { success: false, error: "Invalid email or password" };
  }

  // 1. Check if this email+IP pair is locked (service role, IP-scoped).
  //    Scoping by IP means a third party cannot lock a victim out of their
  //    own account by hammering this server action — they only lock
  //    themselves. See migration 0021.
  const lockout = await probeLockout(emailLc, ip);
  if (lockout.locked) {
    return {
      success: false,
      error: "Account temporarily locked. Try again in 5 minutes.",
      locked: true,
      retryAfter: lockout.retryAfter,
    };
  }

  // 2. Attempt Supabase Auth sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailLc,
    password,
  });

  // 3. Record the attempt (service role — anon has no INSERT on login_attempts
  //    anymore, see migration 0021). Failure here must never block the response.
  try {
    await supabaseAdmin.rpc("record_login_attempt", {
      p_email: emailLc,
      p_ip: ip,
      p_user_agent: userAgent,
      p_success: !error,
      p_failure_reason: error?.message || null,
    });
  } catch {}

  if (error) {
    // Re-check the lockout for this email+IP after the failure.
    const after = await probeLockout(emailLc, ip);

    return {
      success: false,
      error: "Invalid email or password",
      locked: after.locked,
      retryAfter: after.locked ? after.retryAfter : 0,
    };
  }

  // 4. Fetch profile
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profile) {
      const normalizedRole = profile.role.toUpperCase();

      return {
        success: true,
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: normalizedRole,
          institutionId: profile.institution_id,
          avatar: profile.avatar,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      };
    }
  }

  return { success: false, error: "Authentication failed" };
}

export interface LockoutResult {
  locked: boolean;
  retryAfter: number;
}

/** Shared lockout probe — service role, scoped to email+IP so a hostile
 *  caller can only ever lock themselves, never a third party. */
async function probeLockout(emailLc: string, ip: string): Promise<LockoutResult> {
  let locked = false;
  let retryAfter = 300;
  try {
    const { data } = await supabaseAdmin.rpc("is_account_locked", {
      p_email: emailLc,
      p_ip: ip,
    });
    locked = !!data;
    if (locked) {
      const { data: seconds } = await supabaseAdmin.rpc("get_lockout_seconds", {
        p_email: emailLc,
        p_ip: ip,
      });
      retryAfter = seconds || 300;
    }
  } catch {}
  return { locked, retryAfter };
}

export async function checkAccountLockout(email: string): Promise<LockoutResult> {
  const { ip } = await getClientIdentity();
  return probeLockout(String(email || "").trim().toLowerCase(), ip);
}

export async function logoutServer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Verify current password by re-authenticating
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();
  if (getUserError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // Sign in with current password to verify it
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (verifyError) {
    return { success: false, error: "Current password is incorrect" };
  }

  // Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
