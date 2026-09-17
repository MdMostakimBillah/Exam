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
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  // 1. Check if account is locked
  const { data: isLocked } = await supabase.rpc("is_account_locked", {
    p_email: email.toLowerCase(),
  });

  if (isLocked) {
    const { data: seconds } = await supabase.rpc("get_lockout_seconds", {
      p_email: email.toLowerCase(),
    });
    return {
      success: false,
      error: "Account temporarily locked. Try again in 5 minutes.",
      locked: true,
      retryAfter: seconds || 300,
    };
  }

  // 2. Attempt Supabase Auth sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  // 3. Record attempt
  await supabase.rpc("record_login_attempt", {
    p_email: email.toLowerCase(),
    p_ip: ip,
    p_user_agent: userAgent,
    p_success: !error,
    p_failure_reason: error?.message || null,
  });

  if (error) {
    // Check if this attempt caused lockout
    const { data: nowLocked } = await supabase.rpc("is_account_locked", {
      p_email: email.toLowerCase(),
    });
    const { data: seconds } = await supabase.rpc("get_lockout_seconds", {
      p_email: email.toLowerCase(),
    });

    return {
      success: false,
      error: "Invalid email or password",
      locked: nowLocked,
      retryAfter: nowLocked ? seconds || 300 : 0,
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
      const normalizedRole = profile.role.toUpperCase().replace("SUPER_ADMIN", "SUPER_ADMIN").replace("INSTITUTION_ADMIN", "INSTITUTION_ADMIN");

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
