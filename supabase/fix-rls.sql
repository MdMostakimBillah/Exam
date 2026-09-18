-- ============================================
-- FIX ALL RLS, SCHEMA, AND POLICY ISSUES
-- Consolidated from fix-all.sql + fix-login.sql
-- Run this AFTER the main schema.sql
-- ============================================

-- ============================================
-- 1. HELPER FUNCTIONS (profiles-based, not JWT)
-- ============================================

CREATE OR REPLACE FUNCTION get_user_institution_id()
RETURNS UUID AS $$
DECLARE
  v_inst_id UUID;
BEGIN
  SELECT institution_id INTO v_inst_id
  FROM profiles
  WHERE id = auth.uid();
  RETURN v_inst_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. ADD MISSING COLUMNS
-- ============================================

-- students: user_id for Supabase Auth linking
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

-- students: email column (referenced by student-auth.ts)
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;

-- profiles: avatar column
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- registrations: student_payment_status
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_payment_status TEXT DEFAULT 'NOT_SUBMITTED';

-- payments: student-submitted columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_by_student BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_image TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by_super_admin UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- 3. DROP ALL EXISTING POLICIES (clean slate)
-- ============================================

-- PROFILES
DROP POLICY IF EXISTS "Super admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Users own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;

-- INSTITUTIONS
DROP POLICY IF EXISTS "Super admin full access institutions" ON institutions;
DROP POLICY IF EXISTS "Public insert for registration" ON institutions;
DROP POLICY IF EXISTS "Authenticated read institutions" ON institutions;
DROP POLICY IF EXISTS "Institution admin own institution" ON institutions;
DROP POLICY IF EXISTS "Institution admin update own" ON institutions;

-- STUDENTS
DROP POLICY IF EXISTS "Super admin full access students" ON students;
DROP POLICY IF EXISTS "Institution admin own students" ON students;
DROP POLICY IF EXISTS "Authenticated read students" ON students;
DROP POLICY IF EXISTS "Students read own data" ON students;

-- EXAMS
DROP POLICY IF EXISTS "Super admin full access exams" ON exams;
DROP POLICY IF EXISTS "Authenticated read exams" ON exams;
DROP POLICY IF EXISTS "Institution admin own exams" ON exams;

-- REGISTRATIONS
DROP POLICY IF EXISTS "Super admin full access registrations" ON registrations;
DROP POLICY IF EXISTS "Institution admin own registrations" ON registrations;
DROP POLICY IF EXISTS "Students read own registrations" ON registrations;
DROP POLICY IF EXISTS "Students update own registrations" ON registrations;

-- PAYMENTS
DROP POLICY IF EXISTS "Super admin full access payments" ON payments;
DROP POLICY IF EXISTS "Institution admin own payments" ON payments;
DROP POLICY IF EXISTS "Students read own payments" ON payments;
DROP POLICY IF EXISTS "Students insert own payments" ON payments;

-- RESULTS
DROP POLICY IF EXISTS "Super admin full access results" ON results;
DROP POLICY IF EXISTS "Institution admin own results" ON results;
DROP POLICY IF EXISTS "Authenticated read results" ON results;
DROP POLICY IF EXISTS "Public read results" ON results;

-- CERTIFICATES
DROP POLICY IF EXISTS "Super admin full access certificates" ON certificates;
DROP POLICY IF EXISTS "Institution admin own certificates" ON certificates;
DROP POLICY IF EXISTS "Authenticated read certificates" ON certificates;
DROP POLICY IF EXISTS "Public read certificates" ON certificates;

-- EXAM CENTERS
DROP POLICY IF EXISTS "Super admin full access exam_centers" ON exam_centers;
DROP POLICY IF EXISTS "Authenticated read exam_centers" ON exam_centers;
DROP POLICY IF EXISTS "Institution admin own exam_centers" ON exam_centers;

-- ADMIT CARDS
DROP POLICY IF EXISTS "Super admin full access admit_cards" ON admit_cards;
DROP POLICY IF EXISTS "Authenticated read admit_cards" ON admit_cards;

-- MARKS
DROP POLICY IF EXISTS "Super admin full access marks" ON marks;
DROP POLICY IF EXISTS "Authenticated read marks" ON marks;

-- ACADEMIC SESSIONS
DROP POLICY IF EXISTS "Super admin full access sessions" ON academic_sessions;
DROP POLICY IF EXISTS "Authenticated read sessions" ON academic_sessions;

-- CLASSES
DROP POLICY IF EXISTS "Authenticated read classes" ON classes;
DROP POLICY IF EXISTS "Super admin manage classes" ON classes;

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users own notifications" ON notifications;

-- AUDIT LOGS
DROP POLICY IF EXISTS "Super admin full access audit_logs" ON audit_logs;

-- SYSTEM SETTINGS
DROP POLICY IF EXISTS "Super admin full access system_settings" ON system_settings;
DROP POLICY IF EXISTS "Authenticated read system_settings" ON system_settings;

-- LOGIN ATTEMPTS
DROP POLICY IF EXISTS "Super admin full access login_attempts" ON login_attempts;
DROP POLICY IF EXISTS "Allow anonymous insert login_attempts" ON login_attempts;
DROP POLICY IF EXISTS "Allow authenticated read login_attempts" ON login_attempts;

-- ============================================
-- 4. RECREATE ALL POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Super admin full access profiles" ON profiles
  FOR ALL USING (is_super_admin());
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- INSTITUTIONS
CREATE POLICY "Super admin full access institutions" ON institutions
  FOR ALL USING (is_super_admin());
CREATE POLICY "Public insert for registration" ON institutions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated read institutions" ON institutions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Institution admin own institution" ON institutions
  FOR SELECT USING (id = get_user_institution_id());
CREATE POLICY "Institution admin update own" ON institutions
  FOR UPDATE USING (id = get_user_institution_id());

-- STUDENTS
CREATE POLICY "Super admin full access students" ON students
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own students" ON students
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read students" ON students
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Students read own data" ON students
  FOR SELECT USING (user_id = auth.uid());

-- EXAMS
CREATE POLICY "Super admin full access exams" ON exams
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read exams" ON exams
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Institution admin read own exams" ON exams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.exam_id = exams.id
      AND r.institution_id = get_user_institution_id()
    )
  );

-- REGISTRATIONS
CREATE POLICY "Super admin full access registrations" ON registrations
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own registrations" ON registrations
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Students read own registrations" ON registrations
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
CREATE POLICY "Students update own registrations" ON registrations
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- PAYMENTS
CREATE POLICY "Super admin full access payments" ON payments
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own payments" ON payments
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Students read own payments" ON payments
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
CREATE POLICY "Students insert own payments" ON payments
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- RESULTS
CREATE POLICY "Super admin full access results" ON results
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own results" ON results
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read results" ON results
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read results" ON results
  FOR SELECT USING (true);

-- CERTIFICATES
CREATE POLICY "Super admin full access certificates" ON certificates
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own certificates" ON certificates
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read certificates" ON certificates
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read certificates" ON certificates
  FOR SELECT USING (true);

-- EXAM CENTERS
CREATE POLICY "Super admin full access exam_centers" ON exam_centers
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read exam_centers" ON exam_centers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Institution admin own exam_centers" ON exam_centers
  FOR ALL USING (institution_id = get_user_institution_id());

-- ADMIT CARDS
CREATE POLICY "Super admin full access admit_cards" ON admit_cards
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read admit_cards" ON admit_cards
  FOR SELECT USING (auth.role() = 'authenticated');

-- MARKS
CREATE POLICY "Super admin full access marks" ON marks
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read marks" ON marks
  FOR SELECT USING (auth.role() = 'authenticated');

-- ACADEMIC SESSIONS
CREATE POLICY "Super admin full access sessions" ON academic_sessions
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read sessions" ON academic_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- CLASSES
CREATE POLICY "Authenticated read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin manage classes" ON classes
  FOR ALL USING (is_super_admin());

-- NOTIFICATIONS
CREATE POLICY "Users own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- AUDIT LOGS
CREATE POLICY "Super admin full access audit_logs" ON audit_logs
  FOR ALL USING (is_super_admin());

-- SYSTEM SETTINGS
CREATE POLICY "Super admin full access system_settings" ON system_settings
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read system_settings" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- LOGIN ATTEMPTS
CREATE POLICY "Super admin full access login_attempts" ON login_attempts
  FOR ALL USING (is_super_admin());
CREATE POLICY "Allow anonymous insert login_attempts" ON login_attempts
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated read login_attempts" ON login_attempts
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- 5. STORAGE BUCKET + POLICIES
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('public', 'public', true)
  ON CONFLICT (id) DO NOTHING;

-- Public read for all files in public bucket
DROP POLICY IF EXISTS "Public read all public files" ON storage.objects;
CREATE POLICY "Public read all public files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'public');

-- Authenticated upload to payment-proofs
DROP POLICY IF EXISTS "Authenticated upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated upload payment proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'payment-proofs');

-- Authenticated upload to institution-logos
DROP POLICY IF EXISTS "Authenticated upload institution logos" ON storage.objects;
CREATE POLICY "Authenticated upload institution logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'institution-logos');

-- Public insert for institution registration (logo upload during register)
DROP POLICY IF EXISTS "Public insert institution logos" ON storage.objects;
CREATE POLICY "Public insert institution logos" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'institution-logos');

-- Authenticated upload to student-photos
DROP POLICY IF EXISTS "Authenticated upload student photos" ON storage.objects;
CREATE POLICY "Authenticated upload student photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'student-photos');

-- Authenticated upload to certificates
DROP POLICY IF EXISTS "Authenticated upload certificates" ON storage.objects;
CREATE POLICY "Authenticated upload certificates" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'certificates');

-- Authenticated delete own files
DROP POLICY IF EXISTS "Authenticated delete own files" ON storage.objects;
CREATE POLICY "Authenticated delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'public');

-- ============================================
-- 6. LOGIN ATTEMPT FUNCTIONS
-- ============================================

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

-- ============================================
-- 7. SEED DATA (safe to re-run)
-- ============================================

-- Classes
INSERT INTO classes (name, code, description) VALUES
  ('Class 1', '1', 'First Grade'),
  ('Class 2', '2', 'Second Grade'),
  ('Class 3', '3', 'Third Grade'),
  ('Class 4', '4', 'Fourth Grade'),
  ('Class 5', '5', 'Fifth Grade'),
  ('Class 6', '6', 'Sixth Grade'),
  ('Class 7', '7', 'Seventh Grade'),
  ('Class 8', '8', 'Eighth Grade'),
  ('Class 9', '9', 'Ninth Grade'),
  ('Class 10', '10', 'Tenth Grade')
ON CONFLICT (code) DO NOTHING;

-- Academic session
INSERT INTO academic_sessions (name, code, start_date, end_date, is_active, is_current) VALUES
  ('2024-2025', '2024-25', '2024-01-01', '2024-12-31', true, true)
ON CONFLICT (code) DO NOTHING;

-- System settings
INSERT INTO system_settings (key, value, category) VALUES
  ('site_name', 'ScholarX - Bangladesh Education Society', 'general'),
  ('site_url', 'https://scholarx.example.com', 'general'),
  ('maintenance_mode', 'false', 'general'),
  ('registration_open', 'true', 'general'),
  ('max_upload_size_mb', '5', 'general'),
  ('supported_languages', 'en,bn', 'general')
ON CONFLICT (key) DO NOTHING;
