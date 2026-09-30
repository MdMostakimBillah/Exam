-- 0038 — student-facing download permissions: marksheet + certificate
--
-- WHY
--   The super admin grants each institution two student permissions,
--   mirroring the admit-card flag from migration 0033:
--     allow_marksheet_download  — students of this institution see the
--                                 "Marksheet" portal section (their own
--                                 results) with its download option.
--     allow_certificate_download — students see the "Certificates" section
--                                 and can preview/download their own.
--   Both are OFF by default; an institution admin must not be able to
--   grant them to itself (same protection as the admit-card flag).
--
-- WHAT
--   1. Two boolean columns on institutions (default false).
--   2. Trigger: only a super admin (or the service role) may flip them.
--   3. RLS so the student portal can actually read its own data:
--        · students read their OWN results rows (0021 — the only place
--          "Students read own results" is defined — has never been applied)
--        · students read their OWN certificate rows (0036 adds super-admin
--          and institution policies only)
--        · students read their OWN institution row (needed for the session
--          join that carries the two flags; 0023 only covers institution
--          admins)
--      The download OPTION itself is gated in the UI by the flags — the
--      data behind it is the student's own either way.
--
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
-- Run AFTER 0036 (its DO block drops every certificates policy, including
-- the student one created here — re-running this file restores it).

-- ── 1. Permission flags ───────────────────────────────────────────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS allow_marksheet_download BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_certificate_download BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Super-admin-only flips ─────────────────────────────────────────
-- auth.uid() IS NULL → service-role/system writes are left alone.
CREATE OR REPLACE FUNCTION public.protect_student_download_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    NEW.allow_marksheet_download := OLD.allow_marksheet_download;
    NEW.allow_certificate_download := OLD.allow_certificate_download;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_student_download_permissions ON public.institutions;
CREATE TRIGGER protect_student_download_permissions
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_student_download_permissions();

-- ── 3. RLS — students read their own rows ─────────────────────────────
DROP POLICY IF EXISTS "Students read own results" ON public.results;
CREATE POLICY "Students read own results" ON public.results
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students read own certificates" ON public.certificates;
CREATE POLICY "Students read own certificates" ON public.certificates
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students read own institution" ON public.institutions;
CREATE POLICY "Students read own institution" ON public.institutions
  FOR SELECT USING (
    id IN (
      SELECT institution_id FROM public.students WHERE user_id = auth.uid()
    )
  );
