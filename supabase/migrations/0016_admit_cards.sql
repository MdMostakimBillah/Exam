-- =====================================================
-- 0016: admit_cards — idempotent table + one-card-per-reg
-- =====================================================
-- The super admin selects Exam -> Class -> Generate. Cards are
-- created for APPROVED registrations; subjects/dates/times are
-- read live from exams.subjects + exams.routine at render time,
-- photo/father/mother from students.
--
-- The UNIQUE index on registration_id makes generation re-run
-- safe: an existing card can never be duplicated.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS admit_cards_registration_id_key
  ON admit_cards (registration_id);

CREATE INDEX IF NOT EXISTS admit_cards_session_id_idx
  ON admit_cards (session_id);
