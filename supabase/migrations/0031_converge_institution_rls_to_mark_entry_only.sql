-- 0031 — converge institution RLS onto "blind mark entry ONLY"
--
-- WHY
--  0030 was first applied in production in its wider form, which added
--   read-all SELECT policies on public.students / public.registrations
--   (backed by is_institution_staff()) so an institution's Students list
--   could show every institution's students and exam rolls. The scope was
--   then narrowed to:
--     * an institution's Students and Registrations lists show ITS OWN data —
--       the generated exam roll is shown there next to the class roll;
--     * ONLY the Mark Entry page excludes the caller's own students (blind
--       marking: every institution marks other institutions' papers);
--     * marks are written only through save_exam_marks, so the marks table
--       itself stays readable/deletable for own rows (Results views and the
--       delete-student flow) and unreachable for foreign rows.
--   This migration moves a database that ran the wider 0030 onto that end
--   state. Every statement is idempotent: a database that ran the narrowed
--   0030 already matches, so re-running changes nothing.
--
-- WHAT IT DOES
--   1. Drops the cross-institution reads and the helper behind them.
--   2. Recreates the institution marks policies as SELECT + DELETE on own
--      rows only — no INSERT/UPDATE policy, no foreign write policy.

-- =====================================================================
-- 1. Cross-institution reads are out of scope — remove them
-- =====================================================================
DROP POLICY IF EXISTS "Institution staff read all students" ON public.students;
DROP POLICY IF EXISTS "Institution staff read all registrations" ON public.registrations;
DROP FUNCTION IF EXISTS public.is_institution_staff();

-- =====================================================================
-- 2. RLS on marks — own rows readable/deletable, never writable directly
-- =====================================================================
-- An institution keeps SELECT + DELETE on marks of its own registrations
-- (Results views and the delete-student flow). There is deliberately NO
-- INSERT/UPDATE policy for institution staff: every mark has to go through the
-- save_exam_marks RPC, which is what enforces "never mark your own students".
-- Foreign rows are not readable here either — the mark-entry sheet reads them
-- through that same SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Institution admin own marks" ON public.marks;
DROP POLICY IF EXISTS "Institution admin own marks delete" ON public.marks;
DROP POLICY IF EXISTS "Institution admin foreign marks" ON public.marks;
CREATE POLICY "Institution admin own marks"
  ON public.marks
  FOR SELECT
  USING (
    public.get_user_institution_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = public.marks.registration_id
        AND r.institution_id = public.get_user_institution_id()
    )
  );
CREATE POLICY "Institution admin own marks delete"
  ON public.marks
  FOR DELETE
  USING (
    public.get_user_institution_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = public.marks.registration_id
        AND r.institution_id = public.get_user_institution_id()
    )
  );
