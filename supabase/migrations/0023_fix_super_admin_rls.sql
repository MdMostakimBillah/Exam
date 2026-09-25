-- ============================================================
-- 0023_fix_super_admin_rls.sql
-- Fix super-admin empty institution list:
--   * is_super_admin() was checking the JWT "role" claim,
--     which is always "authenticated" for Supabase sign-ins
--     and is never written to app_metadata by this app ->
--     every policy using is_super_admin() returned false.
--   * get_user_institution_id() read app_metadata.institution_id
--     even though institution_id is stored in profiles.institution_id.
--   * Re-create the institutions SELECT/WRITE policies explicitly
--     so the fix does not depend on which manual script ran before.
--
-- Run ONCE in the Supabase SQL Editor (as postgres). Idempotent.
-- ============================================================

BEGIN;

-- 1. Fix is_super_admin() -> check the profiles table (authoritative).
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$;

-- 2. Fix get_user_institution_id() -> read profiles.institution_id.
CREATE OR REPLACE FUNCTION public.get_user_institution_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT institution_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- 3. Institutions: ensure the super-admin read/write policy exists.
DROP POLICY IF EXISTS "Super admin full access institutions" ON public.institutions;
CREATE POLICY "Super admin full access institutions" ON public.institutions
  FOR ALL USING (public.is_super_admin());

-- 4. Institution admins: own-institution access (uses fixed helper).
DROP POLICY IF EXISTS "Institution admin own institution" ON public.institutions;
CREATE POLICY "Institution admin own institution" ON public.institutions
  FOR SELECT USING (id = public.get_user_institution_id());

DROP POLICY IF EXISTS "Institution admin update own" ON public.institutions;
CREATE POLICY "Institution admin update own" ON public.institutions
  FOR UPDATE USING (id = public.get_user_institution_id());

-- 5. Keep public registration insert disabled (0021 removed it).
DROP POLICY IF EXISTS "Public insert for registration" ON public.institutions;
DROP POLICY IF EXISTS "Public insert institution" ON public.institutions;

-- Verification hints (results visible when running \i this file):
-- SELECT prosrc FROM pg_proc WHERE proname = 'is_super_admin';
-- SELECT policyname, action, role FROM pg_policies WHERE tablename = 'institutions';

COMMIT;
