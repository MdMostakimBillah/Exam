-- ============================================================
-- 0035_results_unique_index.sql
-- process_exam_results upserts with ON CONFLICT (exam_id, student_id),
-- which requires a UNIQUE index on exactly those columns. Some databases
-- were provisioned before that index existed (or carry a NON-unique index
-- of the same name, so "IF NOT EXISTS" silently skipped), and every
-- Process Results run then failed with:
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
-- Run ONCE in the Supabase SQL Editor (as postgres).
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- Drop whatever carries the name (non-unique, wrong columns, or the
-- previous unique version — it is recreated below either way).
DROP INDEX IF EXISTS public.idx_results_exam_student;

-- Remove duplicates, keeping the newest row per (exam, student).
DELETE FROM public.results r1
WHERE EXISTS (
  SELECT 1
  FROM public.results r2
  WHERE r2.exam_id = r1.exam_id
    AND r2.student_id = r1.student_id
    AND (r2.created_at, r2.id) > (r1.created_at, r1.id)
);

CREATE UNIQUE INDEX idx_results_exam_student
  ON public.results (exam_id, student_id);

COMMIT;
