-- ============================================
-- FIX: login_attempts RLS + missing functions
-- Run this in Supabase SQL Editor if login is broken
-- ============================================

-- 1. Ensure login_attempts table exists
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
  ON login_attempts(ip_address, created_at DESC);

-- 2. Fix RLS: Allow anonymous INSERT for recording login attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access login_attempts" ON login_attempts;
CREATE POLICY "Super admin full access login_attempts" ON login_attempts
  FOR ALL USING (is_super_admin());

-- Permissive INSERT for anonymous (unauthenticated) users
DROP POLICY IF EXISTS "Allow anonymous insert login_attempts" ON login_attempts;
CREATE POLICY "Allow anonymous insert login_attempts" ON login_attempts
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated SELECT (for admin views)
DROP POLICY IF EXISTS "Allow authenticated read login_attempts" ON login_attempts;
CREATE POLICY "Allow authenticated read login_attempts" ON login_attempts
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Create or replace RPC functions
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_failed_count INT;
BEGIN
  SELECT COUNT(*)
  INTO v_failed_count
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  IF v_failed_count >= 3 THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_lockout_seconds(p_email TEXT)
RETURNS INT AS $$
DECLARE
  v_oldest_fail TIMESTAMPTZ;
  v_remaining INT;
BEGIN
  SELECT MIN(created_at)
  INTO v_oldest_fail
  FROM login_attempts
  WHERE email = p_email
    AND success = false
    AND created_at > now() - INTERVAL '5 minutes';

  IF v_oldest_fail IS NULL THEN
    RETURN 0;
  END IF;

  v_remaining := EXTRACT(EPOCH FROM (v_oldest_fail + INTERVAL '5 minutes' - now()))::INT;
  IF v_remaining < 0 THEN
    RETURN 0;
  END IF;
  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email TEXT,
  p_ip TEXT,
  p_user_agent TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
  VALUES (p_email, p_ip, p_user_agent, p_success, p_failure_reason);

  -- Auto-cleanup: keep only last 20 attempts per email
  DELETE FROM login_attempts
  WHERE email = p_email
    AND id NOT IN (
      SELECT id FROM login_attempts
      WHERE email = p_email
      ORDER BY created_at DESC
      LIMIT 20
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure profiles table exists with avatar column
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'institution_admin', 'staff', 'viewer')),
  username TEXT,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add avatar column if it doesn't exist (safe for existing tables)
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access profiles" ON profiles;
CREATE POLICY "Super admin full access profiles" ON profiles
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Users own profile" ON profiles;
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- 5. Ensure trigger exists for auto-creating profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'institution_admin'),
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
