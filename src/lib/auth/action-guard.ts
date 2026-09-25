import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Server actions run with the caller's Supabase session cookies, but the body
 * of the action may use the SERVICE ROLE client. That combination is only safe
 * if the action first proves who is calling — otherwise any anonymous visitor
 * who can reach the action endpoint gets service-role powers.
 *
 * Every action in this app that touches `supabaseAdmin` MUST start with one of
 * these guards. Never trust a role passed in from the browser.
 */

export type GuardResult =
  | { ok: true; userId: string; role: string; institutionId: string | null }
  | { ok: false; error: string };

/** Requires any signed-in user. */
export async function requireUser(): Promise<GuardResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { ok: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, institution_id")
      .eq("id", user.id)
      .maybeSingle();

    return {
      ok: true,
      userId: user.id,
      role: String(profile?.role ?? "").toUpperCase(),
      institutionId: profile?.institution_id ?? null,
    };
  } catch {
    return { ok: false, error: "Not authenticated" };
  }
}

/** Requires a signed-in SUPER_ADMIN. Use for anything service-role shaped. */
export async function requireSuperAdmin(): Promise<GuardResult> {
  const caller = await requireUser();
  if (!caller.ok) return caller;
  if (caller.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Only a super admin can perform this action" };
  }
  return caller;
}

/**
 * Public self-registration only — accepts anonymous callers, but rate-limits
 * them by rejecting when the platform has closed registration.
 */
export async function requireRegistrationOpen(): Promise<GuardResult | { ok: false; error: string }> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "registration_open")
      .maybeSingle();

    if (data && String(data.value).toLowerCase() === "false") {
      return { ok: false, error: "Registration is currently closed" };
    }
    return { ok: true, userId: "anon", role: "ANON", institutionId: null };
  } catch {
    // Settings unreadable (RLS/missing table) — do not silently open the gate.
    return { ok: false, error: "Registration is currently unavailable" };
  }
}
