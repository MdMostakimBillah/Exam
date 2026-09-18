-- ============================================
-- FIX ALL RLS AND SCHEMA ISSUES
-- Run this AFTER the main schema.sql
-- ============================================

-- 1. Fix get_user_institution_id() - read from profiles table, not JWT
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

-- 2. Fix is_super_admin() - also check profiles table
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop and recreate all policies cleanly

-- PROFILES
DROP POLICY IF EXISTS "Super admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Users own profile" ON profiles;
CREATE POLICY "Super admin full access profiles" ON profiles
  FOR ALL USING (is_super_admin());
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- INSTITUTIONS
DROP POLICY IF EXISTS "Super admin full access institutions" ON institutions;
DROP POLICY IF EXISTS "Public insert for registration" ON institutions;
DROP POLICY IF EXISTS "Institution admin own institution" ON institutions;
DROP POLICY IF EXISTS "Institution admin update own" ON institutions;
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
DROP POLICY IF EXISTS "Super admin full access students" ON students;
DROP POLICY IF EXISTS "Institution admin own students" ON students;
CREATE POLICY "Super admin full access students" ON students
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own students" ON students
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read students" ON students
  FOR SELECT USING (auth.role() = 'authenticated');

-- EXAMS - allow all authenticated users to read
DROP POLICY IF EXISTS "Super admin full access exams" ON exams;
DROP POLICY IF EXISTS "Institution admin own exams" ON exams;
CREATE POLICY "Super admin full access exams" ON exams
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read exams" ON exams
  FOR SELECT USING (auth.role() = 'authenticated');

-- REGISTRATIONS
DROP POLICY IF EXISTS "Super admin full access registrations" ON registrations;
DROP POLICY IF EXISTS "Institution admin own registrations" ON registrations;
CREATE POLICY "Super admin full access registrations" ON registrations
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own registrations" ON registrations
  FOR ALL USING (institution_id = get_user_institution_id());

-- PAYMENTS
DROP POLICY IF EXISTS "Super admin full access payments" ON payments;
DROP POLICY IF EXISTS "Institution admin own payments" ON payments;
CREATE POLICY "Super admin full access payments" ON payments
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own payments" ON payments
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Students read own payments" ON payments
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- RESULTS
DROP POLICY IF EXISTS "Super admin full access results" ON results;
DROP POLICY IF EXISTS "Institution admin own results" ON results;
CREATE POLICY "Super admin full access results" ON results
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own results" ON results
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read results" ON results
  FOR SELECT USING (auth.role() = 'authenticated');

-- CERTIFICATES
DROP POLICY IF EXISTS "Super admin full access certificates" ON certificates;
DROP POLICY IF EXISTS "Institution admin own certificates" ON certificates;
CREATE POLICY "Super admin full access certificates" ON certificates
  FOR ALL USING (is_super_admin());
CREATE POLICY "Institution admin own certificates" ON certificates
  FOR ALL USING (institution_id = get_user_institution_id());
CREATE POLICY "Authenticated read certificates" ON certificates
  FOR SELECT USING (auth.role() = 'authenticated');

-- EXAM CENTERS
DROP POLICY IF EXISTS "Super admin full access exam_centers" ON exam_centers;
DROP POLICY IF EXISTS "Institution admin own exam_centers" ON exam_centers;
CREATE POLICY "Super admin full access exam_centers" ON exam_centers
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read exam_centers" ON exam_centers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ADMIT CARDS
DROP POLICY IF EXISTS "Super admin full access admit_cards" ON admit_cards;
DROP POLICY IF EXISTS "Institution admin own admit_cards" ON admit_cards;
CREATE POLICY "Super admin full access admit_cards" ON admit_cards
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read admit_cards" ON admit_cards
  FOR SELECT USING (auth.role() = 'authenticated');

-- MARKS
DROP POLICY IF EXISTS "Super admin full access marks" ON marks;
DROP POLICY IF EXISTS "Institution admin own marks" ON marks;
CREATE POLICY "Super admin full access marks" ON marks
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read marks" ON marks
  FOR SELECT USING (auth.role() = 'authenticated');

-- ACADEMIC SESSIONS
DROP POLICY IF EXISTS "Super admin full access sessions" ON academic_sessions;
DROP POLICY IF EXISTS "Institution admin read sessions" ON academic_sessions;
CREATE POLICY "Super admin full access sessions" ON academic_sessions
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read sessions" ON academic_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- CLASSES
DROP POLICY IF EXISTS "Anyone read classes" ON classes;
DROP POLICY IF EXISTS "Super admin manage classes" ON classes;
CREATE POLICY "Authenticated read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin manage classes" ON classes
  FOR ALL USING (is_super_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users own notifications" ON notifications;
CREATE POLICY "Users own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- AUDIT LOGS
DROP POLICY IF EXISTS "Super admin full access audit_logs" ON audit_logs;
CREATE POLICY "Super admin full access audit_logs" ON audit_logs
  FOR ALL USING (is_super_admin());

-- SYSTEM SETTINGS
DROP POLICY IF EXISTS "Super admin full access system_settings" ON system_settings;
DROP POLICY IF EXISTS "Anyone read system_settings" ON system_settings;
CREATE POLICY "Super admin full access system_settings" ON system_settings
  FOR ALL USING (is_super_admin());
CREATE POLICY "Authenticated read system_settings" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- LOGIN ATTEMPTS
DROP POLICY IF EXISTS "Super admin full access login_attempts" ON login_attempts;
CREATE POLICY "Super admin full access login_attempts" ON login_attempts
  FOR ALL USING (is_super_admin());
CREATE POLICY "Anyone insert login_attempts" ON login_attempts
  FOR INSERT WITH CHECK (true);

-- 4. Add student_payment_status to registrations (safe to re-run)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_payment_status TEXT DEFAULT 'NOT_SUBMITTED';

-- 7. Add user_id column to students for Supabase Auth linking
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);

-- Students RLS: allow students to read their own data via auth.uid()
DROP POLICY IF EXISTS "Students read own data" ON students;
CREATE POLICY "Students read own data" ON students
  FOR SELECT USING (user_id = auth.uid());

-- 5. Add payment columns (safe to re-run)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_by_student BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_image TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by_super_admin UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 6. Seed data for testing
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

INSERT INTO academic_sessions (name, code, start_date, end_date, is_active, is_current) VALUES
  ('2024-2025', '2024-25', '2024-01-01', '2024-12-31', true, true)
ON CONFLICT (code) DO NOTHING;
