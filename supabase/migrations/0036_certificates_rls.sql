-- ============================================================ 0036 · Certificates RLS — the table exists but has NO policy ===========
-- Live-DB symptom (probed 2026-09-30):
--   * `certificates` has RLS enabled and zero applicable policies, so every
--     user-JWT query returns 0 rows (content-range: */*):
--       - super-admin Certificates page shows "Total Generated | 0"
--       - institutions cannot generate (INSERT denied)
--   * the policy blocks in schema.sql / fix-rls.sql were never applied to
--     this table in the live database;
--   * the public verify page is unaffected — it reads through the service-
--     role client (src/lib/auth/public-lookup.ts), which bypasses RLS;
--   * helper functions used below are confirmed present:
--       public.is_super_admin()        -> true for super_admin profiles
--       public.get_user_institution_id() -> institution_id of current user
--
-- Grants:
--   * super admin       — full access (list all, preview, revoke, re-issue)
--   * institution admin — full access to OWN institution's rows
--     (list, generate, batch generate, revoke)
-- No wide "authenticated read" policy: one institution must never see another
-- institution's certificates, and public verification is service-role based.

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Idempotent: drop every existing (stale or over-broad) policy so the end
-- state of this file is deterministic.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'certificates'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.certificates', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Super admin full access certificates" ON public.certificates
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Institution admin own certificates" ON public.certificates
  FOR ALL
  USING (institution_id = public.get_user_institution_id())
  WITH CHECK (institution_id = public.get_user_institution_id());
