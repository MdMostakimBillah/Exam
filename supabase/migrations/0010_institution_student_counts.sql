-- =====================================================
-- 0010: Keep institutions.total_students accurate
-- =====================================================
-- Problem: total_students is a stored counter initialized to 0
-- on institution creation and NEVER updated when students are
-- added — so the super-admin Institutions "Students" column always
-- showed 0 (only seed-data.sql ever wrote real values).
--
-- Fix:
--   1) Trigger on students (INSERT/DELETE/UPDATE of institution_id)
--      that recomputes the owning institution's count.
--   2) One-time backfill so existing rows get correct numbers.
--
-- The trigger function is SECURITY DEFINER: institutions RLS is
-- super-admin-only, so without it an institution admin inserting a
-- student would fail the trigger's UPDATE and the student insert
-- would roll back.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

-- 1) Recompute one institution's student count ------------------
CREATE OR REPLACE FUNCTION refresh_institution_student_count(p_institution_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_institution_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE institutions
  SET total_students = (
    SELECT count(*) FROM students WHERE institution_id = p_institution_id
  )
  WHERE id = p_institution_id;
END;
$$;

-- 2) Trigger function -------------------------------------------
CREATE OR REPLACE FUNCTION trg_refresh_institution_student_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_institution_student_count(NEW.institution_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_institution_student_count(OLD.institution_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    -- student moved between institutions: refresh both
    PERFORM refresh_institution_student_count(OLD.institution_id);
    PERFORM refresh_institution_student_count(NEW.institution_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Attach the trigger -----------------------------------------
DROP TRIGGER IF EXISTS students_refresh_institution_count ON students;
CREATE TRIGGER students_refresh_institution_count
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW
EXECUTE FUNCTION trg_refresh_institution_student_count();

-- 4) One-time backfill for existing data ------------------------
UPDATE institutions i
SET total_students = (
  SELECT count(*) FROM students s WHERE s.institution_id = i.id
);

GRANT EXECUTE ON FUNCTION refresh_institution_student_count(UUID) TO authenticated;
