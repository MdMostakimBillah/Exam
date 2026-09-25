-- ------------------------------------------------------------
-- 0024_scholarship_categories.sql
--
-- Two-category scholarship:
--   TALENT_POOL  — overall percentage >= talentpoolPercent  (default 90)
--   GENERAL      — overall percentage >= generalScholarshipMin && <= generalScholarshipMax (default 80-89)
--   NOT_ELIGIBLE — otherwise
--
-- Also wires `passPercent` from the saved grading scale into
-- process_exam_results (previously hard-coded to 33).
-- ------------------------------------------------------------
BEGIN;

-- Widen the results scholarship_status check to the new categories.
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_scholarship_status_check;
ALTER TABLE public.results ADD CONSTRAINT results_scholarship_status_check
  CHECK (scholarship_status IN ('TALENT_POOL', 'GENERAL', 'NOT_ELIGIBLE', 'PENDING'));

-- ----------------------------------------------------------------
-- D4b. process_exam_results(p_exam_id) -> jsonb
--
-- Updated version of the D4 function.  Computes totals, percentage,
-- grade, pass, position and the two-category scholarship per student
-- from the marks table, then upserts into results (one row per
-- exam + student).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_exam_results(
  p_exam_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_super_admin boolean;
  v_subjects jsonb;
  v_session_id uuid;
  v_processed int;
  v_skipped int;
  v_grade_scale jsonb;
  v_pass_pct numeric := 33;
  v_talentpool_pct numeric := 90;
  v_general_min numeric := 80;
  v_general_max numeric := 89;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN'
  ) INTO v_super_admin;

  IF NOT v_super_admin THEN
    RAISE EXCEPTION 'Only a super admin may process results';
  END IF;

  SELECT subjects, session_id INTO v_subjects, v_session_id
    FROM public.exams e WHERE e.id = p_exam_id;
  IF v_subjects IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  SELECT COALESCE(
    (SELECT value::jsonb FROM public.system_settings s WHERE s.key = 'grading' AND s.category = 'grading'),
    '[{"min":80,"grade":"A+"},{"min":70,"grade":"A"},{"min":60,"grade":"A-"},{"min":50,"grade":"B"},{"min":40,"grade":"C"},{"min":33,"grade":"D"}]'::jsonb
  ) INTO v_grade_scale;

  -- All thresholds come from the saved grading scale, with safe defaults.
  v_pass_pct := COALESCE((v_grade_scale ->> 'passPercent')::numeric, 33);
  v_talentpool_pct := COALESCE((v_grade_scale ->> 'talentpoolPercent')::numeric, 90);
  v_general_min := COALESCE((v_grade_scale ->> 'generalScholarshipMin')::numeric, 80);
  v_general_max := COALESCE((v_grade_scale ->> 'generalScholarshipMax')::numeric, 89);

  WITH reg_with_class AS (
    SELECT r.*, r.registration_number,
           (SELECT c.id FROM public.classes c WHERE c.name = r.class_name) AS class_id
    FROM public.registrations r
    WHERE r.exam_id = p_exam_id AND r.status = 'APPROVED'
  ),
  totals AS (
    SELECT
      rwc.id AS registration_id,
      rwc.student_id,
      rwc.student_name,
      rwc.class_name,
      rwc.exam_id,
      rwc.exam_name,
      rwc.registration_number,
      s.exam_roll,
      COALESCE((
        SELECT COALESCE(SUM(m.marks), 0)
        FROM public.marks m
        WHERE m.registration_id = rwc.id
          AND m.subject_id IN (
            SELECT sj.id FROM jsonb_array_elements(v_subjects) sj
            WHERE sj.classId IS NULL OR sj.classId = rwc.class_id
          )
      ), 0)::numeric AS total_marks,
      COALESCE((
        SELECT COALESCE(SUM((sj ->> 'fullMarks')::numeric), 0)
        FROM jsonb_array_elements(v_subjects) sj
        WHERE sj.classId IS NULL OR sj.classId = rwc.class_id
      ), 0)::numeric AS total_full_marks
    FROM reg_with_class rwc
    LEFT JOIN public.students s ON s.id = rwc.student_id
    WHERE EXISTS (SELECT 1 FROM public.marks m WHERE m.registration_id = rwc.id)
  ),
  ranked AS (
    SELECT t.*,
      CASE WHEN t.total_full_marks > 0
        THEN round((t.total_marks / t.total_full_marks) * 1000) / 10
        ELSE 0 END AS percentage,
      RANK() OVER (PARTITION BY t.class_name ORDER BY t.total_marks DESC, t.student_name ASC) AS position
    FROM totals t
  )
  INSERT INTO public.results (
    session_id, student_id, student_name, institution_id, institution_name,
    exam_id, exam_name, class_name, roll, registration_number,
    subject_marks, total_marks, total_full_marks, percentage, grade,
    position, pass, scholarship_status, status
  )
  SELECT
    v_session_id,
    r.student_id,
    r.student_name,
    NULL,
    NULL,
    r.exam_id,
    r.exam_name,
    r.class_name,
    COALESCE(r.exam_roll, '')::text,
    COALESCE(r.registration_number, '')::text,
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('subjectId', m.subject_id, 'subjectName', m.subject_name, 'marks', m.marks, 'fullMarks', sf.full_mark),
        '[]'::jsonb ORDER BY m.subject_name
      ), '[]'::jsonb)
      FROM public.marks m
      LEFT JOIN LATERAL (SELECT (sj ->> 'fullMarks')::numeric AS full_mark
                           FROM jsonb_array_elements(v_subjects) sj
                           WHERE sj.id = m.subject_id) sf ON true
      WHERE m.registration_id = r.registration_id
    ),
    r.total_marks,
    r.total_full_marks,
    r.percentage,
    (
      SELECT COALESCE(g.grade, 'F')
      FROM jsonb_array_elements(v_grade_scale) g
      WHERE r.percentage >= (g ->> 'min')::numeric
      ORDER BY (g ->> 'min')::numeric DESC
      LIMIT 1
    ),
    r.position::int,
    r.percentage >= v_pass_pct,
    CASE
      WHEN r.percentage >= v_talentpool_pct THEN 'TALENT_POOL'::text
      WHEN r.percentage >= v_general_min AND r.percentage <= v_general_max THEN 'GENERAL'::text
      ELSE 'NOT_ELIGIBLE'::text
    END,
    'DRAFT'::text
  ON CONFLICT (exam_id, student_id)
  DO UPDATE SET
    total_marks = EXCLUDED.total_marks,
    total_full_marks = EXCLUDED.total_full_marks,
    percentage = EXCLUDED.percentage,
    grade = EXCLUDED.grade,
    position = EXCLUDED.position,
    pass = EXCLUDED.pass,
    scholarship_status = EXCLUDED.scholarship_status,
    status = 'DRAFT',
    updated_at = now(),
    subject_marks = EXCLUDED.subject_marks,
    roll = EXCLUDED.roll,
    registration_number = EXCLUDED.registration_number
  ;

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  -- Students that have marks but were not processed (safety net).
  SELECT COUNT(*)::int INTO v_skipped
  FROM reg_with_class r
  WHERE r.id NOT IN (SELECT registration_id FROM ranked);

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped', v_skipped,
    'total_registrations', (SELECT COUNT(*)::int FROM reg_with_class),
    'total_with_marks', (SELECT COUNT(*)::int FROM ranked)
  );
END;
$$;

COMMIT;
