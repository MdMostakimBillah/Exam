-- 0040 — marksheet generation flag
--
-- WHY
--   Publishing results and releasing the TRANSCRIPT are separate acts for
--   the super admin: results can be processed (and even marked PUBLISHED)
--   while the marksheet is still being checked. A student typing
--   roll + registration + date of birth on /marksheet must only get a
--   transcript after the super admin pressed "Generate marksheet".
--
-- WHAT
--   results.marksheet_generated_at — NULL means "not released", a
--   timestamp is the moment the super admin generated it (per exam, or per
--   exam + class; the flag lives on the row so class scoping falls out for
--   free). The public lookup filters `marksheet_generated_at IS NOT NULL`,
--   and the transcript prints it as the publication date.
--
-- Idempotent: safe to run more than once in the Supabase SQL Editor.

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS marksheet_generated_at TIMESTAMPTZ;

-- The generate button updates (exam_id [, class_name]) and the public
-- lookup filters on the flag — a partial index keeps both cheap as the
-- results table grows.
CREATE INDEX IF NOT EXISTS idx_results_marksheet_generated
  ON public.results (exam_id, class_name)
  WHERE marksheet_generated_at IS NOT NULL;
