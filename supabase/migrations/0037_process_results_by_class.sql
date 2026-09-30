-- ============================================================
-- 0037_process_results_by_class.sql
-- Class-wise result processing: the super admin can now process
-- one class (or all classes) at a time, so every class does NOT
-- need complete marks before results can be generated.
--
--   process_exam_results(p_exam_id UUID, p_class_name TEXT)
--     p_class_name NULL / omitted -> whole exam (previous behaviour)
--     p_class_name 'Ten'         -> only that class; other classes'
--                                    stored results are untouched, and
--                                    ranks are computed inside the class
--                                    (partition was already class_name).
--
-- PREREQUISITES -- run BOTH first, in the Supabase SQL Editor:
--   0035_results_unique_index.sql (UNIQUE results(exam_id, student_id)
--                                  required by the ON CONFLICT upsert)
--   0036_certificates_rls.sql     (unrelated, but pending)
-- Run ONCE (as postgres). Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper: does a registration's raw class_name fall under the
-- selected class filter? TRUE when no filter is set. Matches the
-- raw value directly or via the classes table (name / code / id),
-- so the filter works whether registrations store the class name
-- or its code.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_name_matches(p_filter TEXT, p_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT NULLIF(btrim(COALESCE(p_filter, '')), '') IS NULL
      OR p_value = p_filter
      OR EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE (c.name = p_value OR c.code = p_value OR c.id::text = p_value)
          AND (c.name = p_filter OR c.code = p_filter OR c.id::text = p_filter)
      );
$fn$;

REVOKE ALL ON FUNCTION public.class_name_matches(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.class_name_matches(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.class_name_matches(TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Replace the single-argument process_exam_results with the
-- class-aware signature (PostgREST resolves the RPC by the exact
-- argument names the client sends, so the old overload must go).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_exam_results(UUID);

CREATE OR REPLACE FUNCTION public.process_exam_results(
  p_exam_id UUID,
  p_class_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subjects JSONB;
  v_session_id UUID;
  v_exam_name TEXT;
  v_grade_bands JSONB;
  v_scholarship_categories JSONB;
  v_pass_percent NUMERIC;
  v_setup_version INTEGER;
  v_processed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_missing_incomplete INTEGER := 0;
  v_without_required_subjects INTEGER := 0;
  v_total_registrations INTEGER := 0;
  v_unique_students INTEGER := 0;
BEGIN
  p_class_name := NULLIF(btrim(COALESCE(p_class_name, '')), '');

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may process results';
  END IF;

  PERFORM 1
  FROM public.exams e
  WHERE e.id = p_exam_id
  FOR SHARE OF e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  LOCK TABLE public.exam_mark_configs IN SHARE MODE;
  LOCK TABLE public.registrations IN SHARE MODE;
  LOCK TABLE public.marks IN SHARE MODE;

  SELECT
    e.subjects,
    e.session_id,
    e.name,
    COALESCE(config.grade_bands, '[]'::jsonb),
    COALESCE(config.scholarship_categories, '[]'::jsonb),
    COALESCE(config.pass_percent, 33),
    COALESCE(config.version, 1)
  INTO
    v_subjects,
    v_session_id,
    v_exam_name,
    v_grade_bands,
    v_scholarship_categories,
    v_pass_percent,
    v_setup_version
  FROM public.exams e
  LEFT JOIN public.exam_mark_configs config ON config.exam_id = e.id
  WHERE e.id = p_exam_id;

  IF jsonb_array_length(v_grade_bands) = 0 THEN
    RAISE EXCEPTION 'Exam mark setup has no grade bands';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_subjects) AS subject(value)
    WHERE btrim(COALESCE(subject.value->>'id', '')) <> ''
    GROUP BY lower(btrim(subject.value->>'id'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Exam subject configuration contains duplicate subject IDs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.marks m
    LEFT JOIN public.registrations mr
      ON mr.id = m.registration_id
     AND mr.exam_id = p_exam_id
    JOIN jsonb_array_elements(v_subjects) AS subject(value)
      ON subject.value->>'id' = m.subject_id
    WHERE m.exam_id = p_exam_id
      AND (
        p_class_name IS NULL
        OR (
          mr.id IS NOT NULL
          AND public.class_name_matches(p_class_name, mr.class_name)
        )
      )
      AND (
        m.marks < 0
        OR m.marks <> ROUND(m.marks, 2)
        OR m.marks > (subject.value->>'fullMarks')::numeric
      )
  ) THEN
    RAISE EXCEPTION 'Existing marks are invalid under the current subject setup';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total_registrations
  FROM public.registrations
  WHERE exam_id = p_exam_id
    AND status = 'APPROVED'
    AND public.class_name_matches(p_class_name, class_name);

  WITH approved AS (
    SELECT r.*, s.exam_roll
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    WHERE r.exam_id = p_exam_id
      AND r.status = 'APPROVED'
      AND public.class_name_matches(p_class_name, r.class_name)
  ),
  deduplicated AS (
    SELECT approved.*,
      ROW_NUMBER() OVER (
        PARTITION BY student_id
        ORDER BY created_at DESC, id DESC
      ) AS student_row
    FROM approved
  ),
  registration_base AS (
    SELECT
      d.*,
      class_lookup.class_id,
      class_lookup.class_code
    FROM deduplicated d
    LEFT JOIN LATERAL (
      SELECT c.id AS class_id, c.code AS class_code
      FROM public.classes c
      WHERE d.class_name = c.name
        OR d.class_name = c.code
        OR d.class_name = c.id::text
      ORDER BY
        CASE
          WHEN d.class_name = c.name THEN 1
          WHEN d.class_name = c.id::text THEN 2
          ELSE 3
        END,
        c.code
      LIMIT 1
    ) class_lookup ON true
    WHERE d.student_row = 1
  ),
  registration_subjects AS (
    SELECT
      r.id AS registration_id,
      r.student_id,
      r.student_name,
      r.institution_id,
      r.institution_name,
      r.exam_name,
      r.class_name,
      r.exam_roll,
      r.registration_number,
      r.class_id,
      r.class_code,
      subject->>'id' AS subject_id,
      subject->>'name' AS subject_name,
      (subject->>'fullMarks')::numeric AS full_marks,
      m.id AS mark_id,
      m.marks
    FROM registration_base r
    CROSS JOIN LATERAL (
      SELECT configured_subject.value AS subject
      FROM jsonb_array_elements(v_subjects) AS configured_subject(value)
      WHERE jsonb_typeof(configured_subject.value->'fullMarks') = 'number'
        AND btrim(COALESCE(configured_subject.value->>'id', '')) <> ''
        AND (configured_subject.value->>'fullMarks')::numeric > 0
        AND (
          configured_subject.value->'classId' IS NULL
          OR btrim(COALESCE(configured_subject.value->>'classId', '')) = ''
          OR configured_subject.value->>'classId' IN (r.class_id::text, r.class_name, r.class_code)
        )
    ) subject
    LEFT JOIN public.marks m
      ON m.registration_id = r.id
      AND m.exam_id = p_exam_id
      AND m.subject_id = subject->>'id'
  ),
  totals AS (
    SELECT
      registration_id,
      COUNT(*)::INTEGER AS required_count,
      COUNT(mark_id)::INTEGER AS entered_count,
      SUM(full_marks) AS total_full_marks,
      COALESCE(SUM(marks), 0) AS total_marks
    FROM registration_subjects
    GROUP BY registration_id
  ),
  complete AS (
    SELECT
      r.id AS registration_id,
      r.student_id,
      r.student_name,
      r.institution_id,
      r.institution_name,
      r.class_name,
      r.class_id,
      r.exam_roll,
      r.registration_number,
      t.total_full_marks,
      t.total_marks,
      (t.total_marks / NULLIF(t.total_full_marks, 0)) * 100 AS calculated_percentage,
      ROUND((t.total_marks / NULLIF(t.total_full_marks, 0)) * 100, 1) AS percentage
    FROM registration_base r
    JOIN totals t ON t.registration_id = r.id
    WHERE t.required_count > 0
      AND t.entered_count = t.required_count
  ),
  ranked AS (
    SELECT
      complete.*,
      RANK() OVER (
        PARTITION BY class_name
        ORDER BY total_marks DESC
      )::INTEGER AS result_position
    FROM complete
  )
  INSERT INTO public.results (
    session_id,
    student_id,
    student_name,
    institution_id,
    institution_name,
    exam_id,
    exam_name,
    class_name,
    roll,
    registration_number,
    subject_marks,
    total_marks,
    total_full_marks,
    percentage,
    grade,
    position,
    pass,
    scholarship_status,
    status,
    mark_setup_version,
    updated_at
  )
  SELECT
    v_session_id,
    r.student_id,
    r.student_name,
    r.institution_id,
    r.institution_name,
    p_exam_id,
    v_exam_name,
    r.class_name,
    COALESCE(r.exam_roll, r.registration_number, ''),
    r.registration_number,
    COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'subjectId', subject_marks.subject_id,
          'subjectName', subject_marks.subject_name,
          'marks', subject_marks.marks,
          'fullMarks', subject_marks.full_marks
        )
        ORDER BY subject_marks.subject_name, subject_marks.subject_id
      )
      FROM registration_subjects subject_marks
      JOIN public.marks subject_mark
        ON subject_mark.id = subject_marks.mark_id
      WHERE subject_marks.registration_id = r.registration_id
    ), '[]'::jsonb),
    r.total_marks,
    r.total_full_marks,
    r.percentage,
    COALESCE((
      SELECT grade_band->>'grade'
      FROM jsonb_array_elements(v_grade_bands) grade_band
      WHERE r.calculated_percentage BETWEEN (grade_band->>'minPercent')::numeric AND (grade_band->>'maxPercent')::numeric
      ORDER BY (grade_band->>'minPercent')::numeric DESC
      LIMIT 1
    ), 'F'),
    r.result_position,
    r.calculated_percentage >= v_pass_percent,
    COALESCE((
      SELECT scholarship_category->>'name'
      FROM jsonb_array_elements(v_scholarship_categories) scholarship_category
      WHERE r.calculated_percentage BETWEEN (scholarship_category->>'minPercent')::numeric AND (scholarship_category->>'maxPercent')::numeric
        AND CASE
          WHEN scholarship_category->'classIds' IS NULL THEN TRUE
          WHEN jsonb_typeof(scholarship_category->'classIds') = 'null' THEN TRUE
          WHEN jsonb_typeof(scholarship_category->'classIds') = 'array'
               AND jsonb_array_length(scholarship_category->'classIds') = 0 THEN TRUE
          WHEN jsonb_typeof(scholarship_category->'classIds') = 'array'
               AND r.class_id IS NOT NULL
               AND scholarship_category->'classIds' @> to_jsonb(r.class_id::text) THEN TRUE
          ELSE FALSE
        END
      ORDER BY (scholarship_category->>'minPercent')::numeric DESC
      LIMIT 1
    ), 'NOT_ELIGIBLE'),
    'DRAFT',
    v_setup_version,
    now()
  FROM ranked r
  ON CONFLICT (exam_id, student_id)
  DO UPDATE SET
    session_id = EXCLUDED.session_id,
    student_name = EXCLUDED.student_name,
    institution_id = EXCLUDED.institution_id,
    institution_name = EXCLUDED.institution_name,
    exam_name = EXCLUDED.exam_name,
    class_name = EXCLUDED.class_name,
    roll = EXCLUDED.roll,
    registration_number = EXCLUDED.registration_number,
    subject_marks = EXCLUDED.subject_marks,
    total_marks = EXCLUDED.total_marks,
    total_full_marks = EXCLUDED.total_full_marks,
    percentage = EXCLUDED.percentage,
    grade = EXCLUDED.grade,
    position = EXCLUDED.position,
    pass = EXCLUDED.pass,
    scholarship_status = EXCLUDED.scholarship_status,
    status = 'DRAFT',
    mark_setup_version = EXCLUDED.mark_setup_version,
    updated_at = now();

  WITH approved AS (
    SELECT r.*, s.exam_roll
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    WHERE r.exam_id = p_exam_id
      AND r.status = 'APPROVED'
      AND public.class_name_matches(p_class_name, r.class_name)
  ),
  deduplicated AS (
    SELECT approved.*,
      ROW_NUMBER() OVER (
        PARTITION BY student_id
        ORDER BY created_at DESC, id DESC
      ) AS student_row
    FROM approved
  ),
  registration_base AS (
    SELECT d.*, class_lookup.class_id, class_lookup.class_code
    FROM deduplicated d
    LEFT JOIN LATERAL (
      SELECT c.id AS class_id, c.code AS class_code
      FROM public.classes c
      WHERE d.class_name = c.name
        OR d.class_name = c.code
        OR d.class_name = c.id::text
      ORDER BY
        CASE
          WHEN d.class_name = c.name THEN 1
          WHEN d.class_name = c.id::text THEN 2
          ELSE 3
        END,
        c.code
      LIMIT 1
    ) class_lookup ON true
    WHERE d.student_row = 1
  ),
  registration_subjects AS (
    SELECT
      r.id AS registration_id,
      subject->>'id' AS subject_id,
      m.id AS mark_id
    FROM registration_base r
    CROSS JOIN LATERAL (
      SELECT configured_subject.value AS subject
      FROM jsonb_array_elements(v_subjects) AS configured_subject(value)
      WHERE jsonb_typeof(configured_subject.value->'fullMarks') = 'number'
        AND btrim(COALESCE(configured_subject.value->>'id', '')) <> ''
        AND (configured_subject.value->>'fullMarks')::numeric > 0
        AND (
          configured_subject.value->'classId' IS NULL
          OR btrim(COALESCE(configured_subject.value->>'classId', '')) = ''
          OR configured_subject.value->>'classId' IN (r.class_id::text, r.class_name, r.class_code)
        )
    ) subject
    LEFT JOIN public.marks m
      ON m.registration_id = r.id
      AND m.exam_id = p_exam_id
      AND m.subject_id = subject->>'id'
  ),
  totals AS (
    SELECT
      registration_id,
      COUNT(*)::INTEGER AS required_count,
      COUNT(mark_id)::INTEGER AS entered_count
    FROM registration_subjects
    GROUP BY registration_id
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE COALESCE(t.required_count, 0) = 0
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE COALESCE(t.required_count, 0) > 0
        AND COALESCE(t.entered_count, 0) < t.required_count
    )::INTEGER
  INTO v_unique_students, v_without_required_subjects, v_missing_incomplete
  FROM registration_base r
  LEFT JOIN totals t ON t.registration_id = r.id;

  v_processed := v_unique_students - v_without_required_subjects - v_missing_incomplete;
  v_skipped := v_without_required_subjects + v_missing_incomplete;

  RETURN JSONB_BUILD_OBJECT(
    'processed', v_processed,
    'skipped', v_skipped,
    'missing_incomplete', v_missing_incomplete,
    'without_required_subjects', v_without_required_subjects,
    'total_registrations', v_total_registrations,
    'total_unique_students', v_unique_students,
    'setup_version', v_setup_version,
    'class_name', p_class_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_exam_results(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_exam_results(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_exam_results(UUID, TEXT) TO authenticated;

COMMIT;

