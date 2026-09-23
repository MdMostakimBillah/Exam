-- =====================================================
-- 0014: Exam start / end dates
-- =====================================================
-- An exam can span multiple days. The super admin sets an
-- exam WINDOW (start -> end); the exam routine (day-by-day
-- schedule) is built inside this window in a later round.
--
-- The legacy single exam_date column is KEPT and stays
-- synced to the start date, because admit cards
-- (admit_cards.exam_date NOT NULL), list columns and PDF
-- exports already read it.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_start_date DATE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_end_date DATE;

-- One-time backfill: existing single exam_date becomes the start date.
UPDATE exams
   SET exam_start_date = exam_date
 WHERE exam_start_date IS NULL
   AND exam_date IS NOT NULL;

-- Keep legacy exam_date pointing at the first exam day.
UPDATE exams
   SET exam_date = exam_start_date
 WHERE exam_date IS NULL
   AND exam_start_date IS NOT NULL;
