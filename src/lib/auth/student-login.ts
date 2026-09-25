"use server";

import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { StudentLoginResult, StudentSession } from "./student-auth";

/**
 * Student portal login.
 *
 * Identity is (student id + phone/email), checked against the database by
 * the SERVER — never in the browser. Once verified, a fresh random password
 * is written to the Supabase Auth account and used for the session, so:
 *   * H3 — the old credential was `student_<id>_<phoneOrEmail>`, i.e. fully
 *     predictable from public data, and could be used directly against
 *     /auth/v1/token to skip this endpoint entirely.
 *   * H4 — lockout used to live in a client-side `Map` that reset on every
 *     page load; it is now DB-backed and scoped to (identity, client IP).
 *
 * SERVICE ROLE is used only after the identity check above.
 */
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STUDENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
const MAX_IDENTIFIER = 100;
const MAX_PER_WINDOW = 8;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

function allow(key: string): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
}

async function clientIdentity(): Promise<{ ip: string; userAgent: string }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = (forwarded ? forwarded.split(",")[0].trim() : null) || h.get("x-real-ip") || "unknown";
    return { ip, userAgent: h.get("user-agent") || "unknown" };
  } catch {
    return { ip: "unknown", userAgent: "unknown" };
  }
}

async function lockoutProbe(key: string, ip: string): Promise<{ locked: boolean; retryAfter: number }> {
  try {
    const { data } = await supabaseAdmin.rpc("is_account_locked", { p_email: key, p_ip: ip });
    if (!data) return { locked: false, retryAfter: 0 };
    const { data: seconds } = await supabaseAdmin.rpc("get_lockout_seconds", { p_email: key, p_ip: ip });
    return { locked: true, retryAfter: seconds || 300 };
  } catch {
    // RPC unavailable (migration not applied yet) — fail open for lockout
    // but the identity check below still holds.
    return { locked: false, retryAfter: 0 };
  }
}

async function recordAttempt(key: string, ip: string, ua: string, success: boolean, reason?: string) {
  try {
    await supabaseAdmin.rpc("record_login_attempt", {
      p_email: key,
      p_ip: ip,
      p_user_agent: ua,
      p_success: success,
      p_failure_reason: reason || null,
    });
  } catch {
    /* bookkeeping must never block a login */
  }
}

function newSession(student: Record<string, unknown>, institutionName: string): StudentSession {
  return {
    id: student.id as string,
    studentId: student.student_id as string,
    firstName: student.first_name as string,
    lastName: student.last_name as string,
    email: (student.email as string) || "",
    phone: (student.phone as string) || "",
    institutionId: student.institution_id as string,
    institutionName,
    class: student.class as string,
    section: (student.section as string) || "",
    roll: (student.roll as string) || "",
    photo: (student.photo_url as string) || undefined,
  };
}

export async function loginStudent(studentId: string, phoneOrEmail: string): Promise<StudentLoginResult> {
  const rawId = String(studentId || "").trim();
  const rawIdentifier = String(phoneOrEmail || "").trim().toLowerCase();
  const { ip, userAgent } = await clientIdentity();

  if (!STUDENT_ID.test(rawId) || rawIdentifier.length < 3 || rawIdentifier.length > MAX_IDENTIFIER) {
    return { success: false, error: "Invalid student ID or credentials" };
  }

  if (!allow(ip)) {
    return { success: false, error: "Too many attempts. Please wait a minute and try again." };
  }

  const lockKey = `student:${rawId.toLowerCase()}`;
  const preLock = await lockoutProbe(lockKey, ip);
  if (preLock.locked) {
    return { success: false, error: "Account temporarily locked.", locked: true, retryAfter: preLock.retryAfter };
  }

  const fail = async (reason: string): Promise<StudentLoginResult> => {
    await recordAttempt(lockKey, ip, userAgent, false, reason);
    const post = await lockoutProbe(lockKey, ip);
    return {
      success: false,
      error: "Invalid student ID or credentials",
      locked: post.locked,
      retryAfter: post.locked ? post.retryAfter : 0,
    };
  };

  // 1. Verify the claimed identity against the database (service role).
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select(
      "id,student_id,first_name,last_name,email,phone,institution_id,class,section,roll,photo_url,user_id,institutions(name)"
    )
    .eq("student_id", rawId)
    .maybeSingle();

  if (studentError || !student) return fail("student not found");

  const phoneMatch = String(student.phone || "").trim().toLowerCase() === rawIdentifier;
  const emailMatch = String(student.email || "").trim().toLowerCase() === rawIdentifier;
  if (!phoneMatch && !emailMatch) return fail("identifier mismatch");

  // 2. Ensure there is an auth account, with a password nobody can predict.
  const authEmail = `student_${rawId}@scholarx.local`;
  const freshPassword = `${randomBytes(24).toString("base64url")}!7Kq`;
  let authUserId = (student.user_id as string) || null;

  if (authUserId) {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: freshPassword,
      email_confirm: true,
    });
    if (updErr) authUserId = null;
  }

  if (!authUserId) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: freshPassword,
      email_confirm: true,
      user_metadata: { name: `${student.first_name} ${student.last_name}`, role: "student" },
    });

    if (createErr) {
      // Account already exists but is not linked to this student row (legacy
      // flow): sign in with the legacy derived credential once, then rotate it.
      const legacyPassword = `student_${rawId}_${phoneOrEmail}`;
      const supabase = await createServerClient();
      const { data: legacy, error: legacyErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: legacyPassword,
      });
      if (legacyErr || !legacy.user) return fail("no auth account");
      authUserId = legacy.user.id;
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: freshPassword,
        email_confirm: true,
      });
      const { error: relinkErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: freshPassword,
      });
      if (relinkErr) return fail("re-login after rotation");
      await linkAndFinish(student, authUserId, lockKey, ip, userAgent);
      return {
        success: true,
        student: newSession(
          { ...student, user_id: authUserId },
          (student.institutions as { name?: string } | null)?.name || ""
        ),
      };
    }

    authUserId = created.user.id;
  }

  // 3. Establish the session cookie with the freshly rotated password.
  const supabase = await createServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: freshPassword,
  });
  if (signInErr) return fail("session not established");

  await linkAndFinish(student, authUserId, lockKey, ip, userAgent);

  return {
    success: true,
    student: newSession(student, (student.institutions as { name?: string } | null)?.name || ""),
  };
}

async function linkAndFinish(
  student: Record<string, unknown>,
  authUserId: string,
  lockKey: string,
  ip: string,
  userAgent: string
) {
  if (student.user_id !== authUserId) {
    await supabaseAdmin
      .from("students")
      .update({ user_id: authUserId, updated_at: new Date().toISOString() })
      .eq("id", student.id as string);
  }
  await recordAttempt(lockKey, ip, userAgent, true);
}
