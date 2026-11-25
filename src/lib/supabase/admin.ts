import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Returns a singleton service-role Supabase client configured for server-side
 * usage with session persistence and auto-refresh disabled.
 *
 * MUST ONLY be called in Server Actions or server-only contexts after
 * verifying caller authorization with `requireSuperAdmin()` or equivalent.
 */
export function getAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}
