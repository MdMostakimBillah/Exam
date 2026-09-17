"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

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
  let ip = "unknown";
  let userAgent = "unknown";

  try {
    const headersList = await headers();
    ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    userAgent = headersList.get("user-agent") || "unknown";
  } catch {}

  // 1. Check if account is locked (graceful fallback if RPC fails)
  let isLocked = false;
  let lockoutSeconds = 300;
  try {
    const { data } = await supabase.rpc("is_account_locked", { p_email: email.toLowerCase() });
    isLocked = !!data;
    if (isLocked) {
      const { data: seconds } = await supabase.rpc("get_lockout_seconds", { p_email: email.toLowerCase() });
      lockoutSeconds = seconds || 300;
    }
  } catch {}

  if (isLocked) {
    return {
      success: false,
      error: "Account temporarily locked. Try again in 5 minutes.",
      locked: true,
      retryAfter: lockoutSeconds,
    };
  }

  // 2. Attempt Supabase Auth sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  // 3. Record attempt (graceful failure)
  try {
    await supabase.rpc("record_login_attempt", {
      p_email: email.toLowerCase(),
      p_ip: ip,
      p_user_agent: userAgent,
      p_success: !error,
      p_failure_reason: error?.message || null,
    });
  } catch {}

  if (error) {
    // Check lockout after failed attempt (graceful fallback)
    let nowLocked = false;
    let seconds = 300;
    try {
      const { data: locked } = await supabase.rpc("is_account_locked", { p_email: email.toLowerCase() });
      nowLocked = !!locked;
      const { data: s } = await supabase.rpc("get_lockout_seconds", { p_email: email.toLowerCase() });
      seconds = s || 300;
    } catch {}

    return {
      success: false,
      error: "Invalid email or password",
      locked: nowLocked,
      retryAfter: nowLocked ? seconds : 0,
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

export async function logoutServer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
