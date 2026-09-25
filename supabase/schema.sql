-- ============================================
-- SCHOLARX - SUPABASE DATABASE SCHEMA (FIXED)
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ACADEMIC SESSIONS (NEW - Core for session-based data)
-- ============================================
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to ensure only one current session
CREATE OR REPLACE FUNCTION enforce_single_current_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE academic_sessions SET is_current = false WHERE is_current = true AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_current_session ON academic_sessions;
CREATE TRIGGER trigger_single_current_session
  BEFORE INSERT OR UPDATE ON academic_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_single_current_session();

-- ============================================
-- INSTITUTIONS (GLOBAL - not session-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  contact_person TEXT,
  contact_person_phone TEXT,
  admin_user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
  logo_url TEXT,
  total_students INTEGER DEFAULT 0,
  total_applications INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CLASSES (GLOBAL - shared across sessions) - FIXED: code is now UNIQUE
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- STUDENTS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name_bn TEXT,
  last_name_bn TEXT,
  student_id TEXT NOT NULL,
  class TEXT NOT NULL,
  section TEXT,
  roll TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  father_name TEXT,
  mother_name TEXT,
  phone TEXT,
  address TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(institution_id, session_id, student_id)
);

-- ============================================
-- EXAMS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  description TEXT,
  registration_start_date DATE,
  registration_end_date DATE,
  exam_date DATE,
  registration_fee NUMERIC DEFAULT 0,
  late_fee NUMERIC DEFAULT 0,
  classes TEXT[] DEFAULT '{}',
  subjects JSONB DEFAULT '[]',
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'EXAM_COMPLETED', 'RESULT_PROCESSING', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- REGISTRATIONS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  application_id TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  institution_name TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'PAYMENT_PENDING', 'APPROVED', 'REJECTED')),
  payment_status TEXT DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'CONFIRMED', 'PAID', 'FAILED', 'REFUNDED')),
  student_payment_status TEXT DEFAULT 'NOT_SUBMITTED' CHECK (student_payment_status IN ('NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED')),
  payment_amount NUMERIC DEFAULT 0,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new column to registrations table (safe to re-run)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_payment_status TEXT DEFAULT 'NOT_SUBMITTED';

-- ============================================
-- EXAM CENTERS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS exam_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  capacity INTEGER DEFAULT 0,
  allocated INTEGER DEFAULT 0,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ADMIT CARDS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS admit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  roll TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  exam_date DATE NOT NULL,
  exam_center TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MARKS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  marks NUMERIC NOT NULL,
  entered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RESULTS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  institution_name TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  roll TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  subject_marks JSONB NOT NULL DEFAULT '[]',
  total_marks NUMERIC DEFAULT 0,
  total_full_marks NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  grade TEXT,
  position INTEGER,
  pass BOOLEAN DEFAULT false,
  scholarship_status TEXT DEFAULT 'PENDING' CHECK (scholarship_status IN ('TALENT_POOL', 'GENERAL', 'NOT_ELIGIBLE', 'PENDING')),
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CERTIFICATES (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  institution_name TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  total_marks NUMERIC NOT NULL,
  exam_year TEXT NOT NULL,
  issue_date DATE NOT NULL,
  result_id UUID REFERENCES results(id) ON DELETE SET NULL,
  qr_code TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'VERIFIED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PAYMENTS (SESSION-SCOPED)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE NOT NULL,
  institution_name TEXT NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PAID', 'FAILED', 'REFUNDED')),
  date DATE NOT NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name TEXT,
  reference TEXT,
  payment_date DATE,
  notes TEXT,
  submitted_by_student BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ,
  receipt_number TEXT,
  account_number TEXT,
  proof_image TEXT,
  verified_by_super_admin UUID,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to payments table (safe to re-run)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_by_student BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_image TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by_super_admin UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- NOTIFICATIONS (GLOBAL - user-scoped)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUDIT LOGS (GLOBAL)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LOGIN ATTEMPTS (Brute-force protection)
-- ============================================
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

-- Enable RLS on login_attempts
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access login_attempts" ON login_attempts;
CREATE POLICY "Super admin full access login_attempts" ON login_attempts
  FOR ALL USING (is_super_admin());

-- Helper function: check if account is locked (3 failures in 5 minutes)
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

-- Helper function: get remaining lockout seconds
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

-- Helper function: record login attempt
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

-- ============================================
-- SYSTEM SETTINGS (GLOBAL)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL
);

-- ============================================
-- PROFILES (Linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'institution_admin', 'staff', 'viewer')),
  username TEXT,
  institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access profiles" ON profiles;
CREATE POLICY "Super admin full access profiles" ON profiles
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Users own profile" ON profiles;
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Trigger to auto-create profile on signup
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_students_institution_session ON students(institution_id, session_id);
CREATE INDEX IF NOT EXISTS idx_students_session ON students(session_id);
CREATE INDEX IF NOT EXISTS idx_exams_session ON exams(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_institution_session ON registrations(institution_id, session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_exam_session ON registrations(exam_id, session_id);
CREATE INDEX IF NOT EXISTS idx_exam_centers_session ON exam_centers(session_id);
CREATE INDEX IF NOT EXISTS idx_admit_cards_session ON admit_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_marks_session ON marks(session_id);
CREATE INDEX IF NOT EXISTS idx_results_session ON results(session_id);
CREATE INDEX IF NOT EXISTS idx_certificates_session ON certificates(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_institution_session ON payments(institution_id, session_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_submitted ON payments(student_id, submitted_by_student, status);
CREATE INDEX IF NOT EXISTS idx_registrations_student_payment ON registrations(student_id, student_payment_status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role') = 'super_admin' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's institution
CREATE OR REPLACE FUNCTION get_user_institution_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'institution_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ACADEMIC SESSIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access sessions" ON academic_sessions;
CREATE POLICY "Super admin full access sessions" ON academic_sessions
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin read sessions" ON academic_sessions;
CREATE POLICY "Institution admin read sessions" ON academic_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- INSTITUTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access institutions" ON institutions;
CREATE POLICY "Super admin full access institutions" ON institutions
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Public insert for registration" ON institutions;
CREATE POLICY "Public insert for registration" ON institutions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Institution admin own institution" ON institutions;
CREATE POLICY "Institution admin own institution" ON institutions
  FOR SELECT USING (id = get_user_institution_id());

DROP POLICY IF EXISTS "Institution admin update own" ON institutions;
CREATE POLICY "Institution admin update own" ON institutions
  FOR UPDATE USING (id = get_user_institution_id());

-- ============================================
-- CLASSES POLICIES (Global read)
-- ============================================
DROP POLICY IF EXISTS "Anyone read classes" ON classes;
CREATE POLICY "Anyone read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admin manage classes" ON classes;
CREATE POLICY "Super admin manage classes" ON classes
  FOR ALL USING (is_super_admin());

-- ============================================
-- STUDENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access students" ON students;
CREATE POLICY "Super admin full access students" ON students
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own students" ON students;
CREATE POLICY "Institution admin own students" ON students
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- EXAMS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access exams" ON exams;
CREATE POLICY "Super admin full access exams" ON exams
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own exams" ON exams;
CREATE POLICY "Institution admin own exams" ON exams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.exam_id = exams.id
      AND r.institution_id = get_user_institution_id()
    )
  );

-- ============================================
-- REGISTRATIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access registrations" ON registrations;
CREATE POLICY "Super admin full access registrations" ON registrations
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own registrations" ON registrations;
CREATE POLICY "Institution admin own registrations" ON registrations
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- EXAM CENTERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access exam_centers" ON exam_centers;
CREATE POLICY "Super admin full access exam_centers" ON exam_centers
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own exam_centers" ON exam_centers;
CREATE POLICY "Institution admin own exam_centers" ON exam_centers
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- ADMIT CARDS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access admit_cards" ON admit_cards;
CREATE POLICY "Super admin full access admit_cards" ON admit_cards
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own admit_cards" ON admit_cards;
CREATE POLICY "Institution admin own admit_cards" ON admit_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = admit_cards.registration_id
      AND r.institution_id = get_user_institution_id()
    )
  );

-- ============================================
-- MARKS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access marks" ON marks;
CREATE POLICY "Super admin full access marks" ON marks
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own marks" ON marks;
CREATE POLICY "Institution admin own marks" ON marks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = marks.registration_id
      AND r.institution_id = get_user_institution_id()
    )
  );

-- ============================================
-- RESULTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access results" ON results;
CREATE POLICY "Super admin full access results" ON results
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own results" ON results;
CREATE POLICY "Institution admin own results" ON results
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- CERTIFICATES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access certificates" ON certificates;
CREATE POLICY "Super admin full access certificates" ON certificates
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own certificates" ON certificates;
CREATE POLICY "Institution admin own certificates" ON certificates
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access payments" ON payments;
CREATE POLICY "Super admin full access payments" ON payments
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own payments" ON payments;
CREATE POLICY "Institution admin own payments" ON payments
  FOR ALL USING (institution_id = get_user_institution_id());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users own notifications" ON notifications;
CREATE POLICY "Users own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access audit_logs" ON audit_logs;
CREATE POLICY "Super admin full access audit_logs" ON audit_logs
  FOR ALL USING (is_super_admin());

-- ============================================
-- SYSTEM SETTINGS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Super admin full access system_settings" ON system_settings;
CREATE POLICY "Super admin full access system_settings" ON system_settings
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Anyone read system_settings" ON system_settings;
CREATE POLICY "Anyone read system_settings" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- SEED DATA (Run AFTER all tables exist)
-- ============================================
-- Insert default classes (UNIQUE on code prevents duplicates)
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

-- Insert a default academic session
INSERT INTO academic_sessions (name, code, start_date, end_date, is_active, is_current) VALUES
  ('2024-2025', '2024-25', '2024-01-01', '2024-12-31', true, true)
ON CONFLICT (code) DO NOTHING;