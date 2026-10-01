-- ============================================================
-- 0039_student_login_unblock.sql
-- Student portal login is broken on this database and two profile
-- escalation holes from the security audit are still open. This is
-- the *safe subset* of 0021_security_hardening.sql — the RLS half of
-- 0021 is intentionally NOT included here because it has been
-- superseded by 0023/0025/0036 (running it now would clobber newer
-- policy definitions and collide with "Students read own marks").
-- The RLS overhaul needs its own reviewed migration; see the note at
-- the bottom.
--
-- What this fixes:
--   1. Student login: createUser({ user_metadata: { role:'student' } })
--      500s with "Database error creating new user" because the live
--      handle_new_user() (schema.sql/fix-login.sql) trusts metadata
--      role and the profiles.role CHECK still reads
--      ('super_admin','institution_admin','staff','viewer') — no
--      'student'. Verified live: role='student' -> 500, role='staff' -> OK.
--   2. C5a: the live handle_new_user() takes role straight from
--      raw_user_meta_data, so anyone could POST /auth/v1/signup with
--      role=super_admin and receive a privileged profile.
--   3. C5b: "Users update own profile" has no column restriction, so
--      any signed-in user could PATCH their own profile role to
--      super_admin. RLS cannot express that; a trigger can.
--   4. Lockout: the code calls is_account_locked(p_email,p_ip) /
--      get_lockout_seconds(p_email,p_ip) (2-arg) but only the 1-arg
--      forms exist -> PostgREST 202 -> the probe fails open and
--      lockout is silently disabled.
--
-- Run this ONCE in the Supabase SQL Editor (as postgres).
-- Idempotent: safe to re-run. Order vs 0038 does not matter.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1+2. Hardened handle_new_user (0021 version). Same name and
--      signature as the live schema.sql/fix-login.sql function, so
--      CREATE OR REPLACE takes effect on the existing
--      on_auth_user_created trigger — no trigger surgery needed.
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

-- The old check constraint rejected 'student' (so the student portal
-- could never create an account) while happily accepting
-- 'super_admin'. Rebuild it against the real, intended role set.
-- Matches both the inline column CHECK (schema.sql/fix-login.sql) and
-- any named profiles_role_check from an earlier run.
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
-- C5b. Stop signed-in users from changing their own (or anyone's)
--      profile role / institution_id via PATCH.
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
-- Lockout keyed on (email, client IP) — the exact signatures the
-- app already calls. The 1-arg forms from fix-login/fix-rls/schema
-- never match those calls, so lockout fails open today.
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

REVOKE EXECUTE ON FUNCTION public.is_account_locked(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_lockout_seconds(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_lockout_seconds(TEXT, TEXT) TO service_role;

COMMIT;

-- ============================================================
-- Verification (run manually afterwards):
--   * create user with user_metadata role='student'
--     -> profile row role = 'student'   (was: 500)
--   * create user with user_metadata role='super_admin'
--     -> profile row role = 'institution_admin'
--   * PATCH own profile role as a non-super-admin -> 42501
--   * rpc is_account_locked with {p_email,p_ip}     -> boolean, no 202
--
-- STILL OPEN (do NOT run 0021 as-is): the RLS half —
--   * "Public read results" lets anon read every result row,
--   * "Authenticated read students/results/certificates" let any
--     signed-in account dump other tenants' data,
--   * anonymous INSERT policies on institutions/login_attempts.
-- Those need a migration reconciled against 0023/0025/0036.
-- ============================================================
