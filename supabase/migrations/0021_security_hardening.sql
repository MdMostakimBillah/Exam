-- ============================================================
-- 0021_security_hardening.sql
-- Security audit fixes — privilege escalation, anonymous writes,
-- cross-tenant reads, and brute-force lockout hardening.
--
-- Run this ONCE in the Supabase SQL Editor (as postgres).
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- C5a. signup used to trust raw_user_meta_data->>'role'
--      => anyone could POST /auth/v1/signup with role=super_admin
--         and receive a fully privileged account (verified live).
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- NEVER take an elevated role from browser-controlled metadata.
  v_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'institution_admin'));
  IF v_role NOT IN ('institution_admin', 'staff', 'viewer', 'student') THEN
    v_role := 'institution_admin';
  END IF;

  -- institution_id intentionally NOT taken from metadata: a self-signup
  -- claiming another institution would gain read access to its students.
  INSERT INTO public.profiles (id, email, name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    v_role,
    NEW.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- The old check constraint rejected 'student' (so the student portal could
-- never create an account) while happily accepting 'super_admin'.
-- Rebuild it against the real, intended role set.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'institution_admin', 'staff', 'viewer', 'student'));

-- ------------------------------------------------------------
-- C5b. "Users update own profile" had no column restriction,
--      so any signed-in user could PATCH their own role to
--      'super_admin' (verified live). RLS cannot express
--      "this column may not change", so enforce it in a trigger.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side writes (service role) and super admins stay unrestricted.
  IF COALESCE(auth.role(), 'service_role') = 'service_role'
     OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := CASE
      WHEN lower(COALESCE(NEW.role, '')) IN ('institution_admin', 'staff', 'viewer', 'student')
        THEN lower(NEW.role)
      ELSE 'institution_admin'
    END;
    RETURN NEW;
  END IF;

  -- Identity columns are fixed; everything else is free to change.
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profile role cannot be changed by this account'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'profile institution cannot be changed by this account'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ------------------------------------------------------------
-- C1. Anonymous INSERT on institutions/login_attempts (both
--     accepted arbitrary rows over plain REST — verified live).
-- ------------------------------------------------------------

-- Public self-registration writes through the guarded, service-role
-- registerInstitution() action (src/lib/auth/register-action.ts), so no
-- client-facing INSERT policy is needed on institutions at all.
DROP POLICY IF EXISTS "Public insert for registration" ON public.institutions;
DROP POLICY IF EXISTS "Public insert institution" ON public.institutions;

DROP POLICY IF EXISTS "Allow anonymous insert login_attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Anyone insert login_attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Allow authenticated read login_attempts" ON public.login_attempts;
-- Attempts are written only through record_login_attempt() below, which is
-- service-role only. Reading them needs the same restriction.
DROP POLICY IF EXISTS "Super admin full access login_attempts" ON public.login_attempts;
CREATE POLICY "Super admin full access login_attempts" ON public.login_attempts
  FOR ALL USING (public.is_super_admin());

-- ------------------------------------------------------------
-- H6 / C2. Lockout is now keyed on (email, client IP) so that a
-- hostile caller of the login server action can only lock
-- themselves, never a third party — and the RPCs are no longer
-- reachable from the anon/authenticated role, so nobody can
-- write login_attempts rows directly.
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.is_account_locked(TEXT);
DROP FUNCTION IF EXISTS public.get_lockout_seconds(TEXT);

CREATE OR REPLACE FUNCTION public.is_account_locked(p_email TEXT, p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_fails INT;
  v_ip_fails INT;
BEGIN
  SELECT COUNT(*) INTO v_email_fails
  FROM login_attempts
  WHERE lower(email) = lower(COALESCE(p_email, ''))
    AND COALESCE(ip_address, '') = COALESCE(p_ip, '')
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  -- Same source IP hammering many accounts: lock the IP too.
  SELECT COUNT(*) INTO v_ip_fails
  FROM login_attempts
  WHERE COALESCE(ip_address, '') = COALESCE(p_ip, '')
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  RETURN v_email_fails >= 3 OR v_ip_fails >= 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lockout_seconds(p_email TEXT, p_ip TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oldest TIMESTAMPTZ;
  v_remaining INT;
BEGIN
  SELECT MIN(created_at) INTO v_oldest
  FROM login_attempts
  WHERE lower(email) = lower(COALESCE(p_email, ''))
    AND COALESCE(ip_address, '') = COALESCE(p_ip, '')
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  SELECT LEAST(COALESCE(v_oldest, now()), MIN(created_at)) INTO v_oldest
  FROM login_attempts
  WHERE COALESCE(ip_address, '') = COALESCE(p_ip, '')
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  IF v_oldest IS NULL THEN
    RETURN 0;
  END IF;

  v_remaining := EXTRACT(EPOCH FROM (v_oldest + INTERVAL '5 minutes' - now()))::INT;
  RETURN GREATEST(v_remaining, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip TEXT,
  p_user_agent TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
  VALUES (lower(COALESCE(p_email, '')), p_ip, left(COALESCE(p_user_agent, ''), 300),
          COALESCE(p_success, false), left(p_failure_reason, 300));

  DELETE FROM login_attempts
  WHERE lower(email) = lower(COALESCE(p_email, ''))
    AND id NOT IN (
      SELECT id FROM login_attempts
      WHERE lower(email) = lower(COALESCE(p_email, ''))
      ORDER BY created_at DESC
      LIMIT 20
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_account_locked(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_lockout_seconds(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, TEXT, BOOLEAN, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_lockout_seconds(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, TEXT, BOOLEAN, TEXT)
  TO service_role;

-- ------------------------------------------------------------
-- H1. "Authenticated read X" meant any logged-in account could
--     dump every institution's students, results, certificates,
--     admit cards and marks. Replace with tenant-scoped policies.
-- ------------------------------------------------------------

-- STUDENTS
DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
DROP POLICY IF EXISTS "Super admin full access students" ON public.students;
DROP POLICY IF EXISTS "Institution admin own students" ON public.students;
DROP POLICY IF EXISTS "Students read own data" ON public.students;
CREATE POLICY "Super admin full access students" ON public.students
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Institution admin own students" ON public.students
  FOR ALL USING (institution_id = public.get_user_institution_id());
CREATE POLICY "Students read own data" ON public.students
  FOR SELECT USING (user_id = auth.uid());

-- RESULTS (drop the public scrape vector — see H2 below)
DROP POLICY IF EXISTS "Authenticated read results" ON public.results;
DROP POLICY IF EXISTS "Public read results" ON public.results;
DROP POLICY IF EXISTS "Super admin full access results" ON public.results;
DROP POLICY IF EXISTS "Institution admin own results" ON public.results;
CREATE POLICY "Super admin full access results" ON public.results
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Institution admin own results" ON public.results
  FOR ALL USING (institution_id = public.get_user_institution_id());
CREATE POLICY "Students read own results" ON public.results
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- CERTIFICATES
DROP POLICY IF EXISTS "Authenticated read certificates" ON public.certificates;
DROP POLICY IF EXISTS "Public read certificates" ON public.certificates;
DROP POLICY IF EXISTS "Super admin full access certificates" ON public.certificates;
DROP POLICY IF EXISTS "Institution admin own certificates" ON public.certificates;
CREATE POLICY "Super admin full access certificates" ON public.certificates
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Institution admin own certificates" ON public.certificates
  FOR ALL USING (institution_id = public.get_user_institution_id());
CREATE POLICY "Students read own certificates" ON public.certificates
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- ADMIT CARDS
DROP POLICY IF EXISTS "Authenticated read admit_cards" ON public.admit_cards;
DROP POLICY IF EXISTS "Super admin full access admit_cards" ON public.admit_cards;
DROP POLICY IF EXISTS "Institution admin own admit_cards" ON public.admit_cards;
CREATE POLICY "Super admin full access admit_cards" ON public.admit_cards
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Institution admin own admit_cards" ON public.admit_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = public.admit_cards.registration_id
        AND r.institution_id = public.get_user_institution_id()
    )
  );
CREATE POLICY "Students read own admit_cards" ON public.admit_cards
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- MARKS
DROP POLICY IF EXISTS "Authenticated read marks" ON public.marks;
DROP POLICY IF EXISTS "Super admin full access marks" ON public.marks;
DROP POLICY IF EXISTS "Institution admin own marks" ON public.marks;
CREATE POLICY "Super admin full access marks" ON public.marks
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Institution admin own marks" ON public.marks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = public.marks.registration_id
        AND r.institution_id = public.get_user_institution_id()
    )
  );
CREATE POLICY "Students read own marks" ON public.marks
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- H2. The public /result and /verify-certificate pages now go
--     through rate-limited server actions
--     (src/lib/auth/public-lookup.ts) that do exact-match,
--     single-row lookups. The blanket anonymous table reads are
--     removed so the tables can no longer be scraped in bulk.
-- ------------------------------------------------------------
-- (policies dropped above)

-- ------------------------------------------------------------
-- STORAGE
-- ------------------------------------------------------------

-- Logo uploads during public registration now go through the
-- service-role uploadLogo() action, so anonymous writes to the
-- bucket are no longer needed.
DROP POLICY IF EXISTS "Public insert institution logos" ON storage.objects;

-- Any signed-in account could previously delete EVERY file in the
-- public bucket (logos, student photos, certificates).
DROP POLICY IF EXISTS "Authenticated delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete public files" ON storage.objects;
CREATE POLICY "Staff delete public files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] IN
        ('payment-proofs', 'institution-logos', 'student-photos', 'certificates')
    AND COALESCE(
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
      ''
    ) IN ('super_admin', 'institution_admin', 'staff')
  );

COMMIT;

-- ============================================================
-- Verification (run manually afterwards):
--   * signup with data.role='super_admin'  -> profile.role = institution_admin
--   * PATCH own profile role               -> 42501
--   * INSERT into institutions as anon     -> permission denied
--   * REST read of students/results/certificates as anon -> 0 rows
--   * rpc record_login_attempt as anon     -> function not found
-- ============================================================
