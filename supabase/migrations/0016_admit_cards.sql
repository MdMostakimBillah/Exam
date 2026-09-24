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

-- =====================================================
-- Data API grants
-- =====================================================
-- From Oct 30, 2026 Supabase no longer auto-grants NEW tables
-- to the Data API roles — without these, supabase-js/PostgREST
-- returns "permission denied" for admit_cards. GRANT is a no-op
-- when already granted, so this stays idempotent.
GRANT SELECT ON public.admit_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admit_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admit_cards TO service_role;

-- =====================================================
-- RLS (self-sufficient: correct no matter which setup
-- SQL — schema.sql / fix-rls.sql / fix-all.sql — ran first)
-- =====================================================
ALTER TABLE public.admit_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access admit_cards" ON public.admit_cards;
CREATE POLICY "Super admin full access admit_cards" ON public.admit_cards
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "Institution admin own admit_cards" ON public.admit_cards;
CREATE POLICY "Institution admin own admit_cards" ON public.admit_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM registrations r
      WHERE r.id = public.admit_cards.registration_id
      AND r.institution_id = get_user_institution_id()
    )
  );

-- Remove fix-all.sql's overly permissive variant (any authenticated
-- user could read every institution's cards). Nothing in the app
-- needs it — admit cards are only queried on the super-admin page.
DROP POLICY IF EXISTS "Authenticated read admit_cards" ON public.admit_cards;
