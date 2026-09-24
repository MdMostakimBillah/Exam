-- =====================================================
-- 0017: system_settings RLS repair
-- =====================================================
-- Symptom: super admin cannot save Settings — Postgres
-- returns "new row violates row-level security policy".
-- Cause: the table only has SELECT policies; the
-- super-admin write policy (INSERT/UPDATE/DELETE) is
-- missing, so every upsert from the app is denied.
--
-- Also settles the read policy in one place:
--   * anon  (public landing page branding) can read
--   * everyone authenticated can read
--   * only super admin can write
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

-- 1) Reads: public landing + signed-in users
DROP POLICY IF EXISTS "Anyone read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated read system_settings" ON public.system_settings;
CREATE POLICY "Anyone read system_settings" ON public.system_settings
  FOR SELECT USING (true);

-- 2) Writes: super admin only (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "Super admin full access system_settings" ON public.system_settings;
CREATE POLICY "Super admin full access system_settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 3) Verify: expect exactly two rows —
--    "Anyone read" (SELECT) and
--    "Super admin full access" (ALL)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'system_settings'
ORDER BY policyname;

-- 4) Optional audit: any public RLS table with ZERO policies
--    (everything is denied there — same class of bug).
--    Expect: empty result.
SELECT c.oid::regclass::text AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY 1;
