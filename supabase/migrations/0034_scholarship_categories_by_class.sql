-- 0034 — scholarship categories by class
--
-- WHY
--   A scholarship category can now target specific classes: e.g.
--   "80%+ for classes One–Five" and "90%+ for classes Six–Ten" — two
--   categories whose percentage ranges OVERLAP but never for the same
--   class. Two places reject/drop that shape today:
--     1. save_exam_grade_scale rebuilds the JSON from id/name/min/max
--        (classIds stripped) and raises 'Scholarship ranges overlap'
--        for any overlap, ignoring class scope.
--     2. process_exam_results picks a category by percentage only, so
--        every class would see every category.
--
-- WHAT
--   1. save_exam_grade_scale — validates + PRESERVES classIds
--      ([] = every class), and only raises overlap when two categories
--      share at least one class (or one is unscoped).
--   2. process_exam_results — carries registration class_id into the
--      result row and only matches categories whose classIds are empty
--      or contain that class. Unresolvable class => only unscoped
--      categories can match (client mirrors this).
--   3. Backfill — gives existing categories an explicit empty classIds.
--
-- Client mirror (already shipped): ScholarshipCategoryRange.classIds,
-- class-aware calculateScholarshipForSetup + validation, class chips in
-- the Grade Scale editor, class-aware live results.
--
-- Idempotent: safe to run more than once in the Supabase SQL Editor.

BEGIN;


CREATE OR REPLACE FUNCTION public.save_exam_grade_scale(
  p_exam_id UUID,
  p_grade_bands JSONB,
  p_scholarship_categories JSONB,
  p_pass_percent NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range JSONB;
  v_normalized_grade_bands JSONB;
  v_normalized_scholarship_categories JSONB;
  v_subject_id TEXT;
  v_name TEXT;
  v_grade_ids TEXT[] := '{}'::TEXT[];
  v_grade_names TEXT[] := '{}'::TEXT[];
  v_grade_points NUMERIC[] := '{}'::NUMERIC[];
  v_grade_mins NUMERIC[] := '{}'::NUMERIC[];
  v_grade_maxes NUMERIC[] := '{}'::NUMERIC[];
  v_sorted_grade_mins NUMERIC[];
  v_sorted_grade_maxes NUMERIC[];
  v_scholarship_ids TEXT[] := '{}'::TEXT[];
  v_scholarship_names TEXT[] := '{}'::TEXT[];
  v_scholarship_mins NUMERIC[] := '{}'::NUMERIC[];
  v_scholarship_maxes NUMERIC[] := '{}'::NUMERIC[];
  v_scholarship_scopes JSONB[] := '{}'::JSONB[];
  v_scope JSONB;
  v_sorted_scholarship_mins NUMERIC[];
  v_sorted_scholarship_maxes NUMERIC[];
  v_pass NUMERIC;
  v_version INTEGER;
  v_updated_at TIMESTAMPTZ;
  i INTEGER;
  j INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may save Grade Scale';
  END IF;

  PERFORM 1
  FROM public.exams e
  WHERE e.id = p_exam_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF p_grade_bands IS NULL OR jsonb_typeof(p_grade_bands) <> 'array' THEN
    RAISE EXCEPTION 'p_grade_bands must be a JSON array';
  END IF;
  IF p_scholarship_categories IS NULL OR jsonb_typeof(p_scholarship_categories) <> 'array' THEN
    RAISE EXCEPTION 'p_scholarship_categories must be a JSON array';
  END IF;

  FOR v_range IN SELECT value FROM jsonb_array_elements(p_grade_bands) LOOP
    v_subject_id := btrim(COALESCE(v_range->>'id', ''));
    v_name := btrim(COALESCE(v_range->>'grade', ''));
    IF v_subject_id = '' OR length(v_subject_id) > 120 THEN
      RAISE EXCEPTION 'Every grade requires a valid ID';
    END IF;
    IF v_name = '' OR length(v_name) > 40 THEN
      RAISE EXCEPTION 'Grade % requires a grade label', v_subject_id;
    END IF;
    IF jsonb_typeof(v_range->'points') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_range->'minPercent') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_range->'maxPercent') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Grade % requires points and numeric bounds', v_subject_id;
    END IF;
    IF (v_range->>'points')::numeric < 0
      OR (v_range->>'points')::numeric > 5
      OR (v_range->>'points')::numeric <> ROUND((v_range->>'points')::numeric, 2) THEN
      RAISE EXCEPTION 'Grade % has invalid grade points', v_subject_id;
    END IF;

    v_grade_ids := ARRAY_APPEND(v_grade_ids, v_subject_id);
    v_grade_names := ARRAY_APPEND(v_grade_names, v_name);
    v_grade_points := ARRAY_APPEND(v_grade_points, (v_range->>'points')::numeric);
    v_grade_mins := ARRAY_APPEND(v_grade_mins, (v_range->>'minPercent')::numeric);
    v_grade_maxes := ARRAY_APPEND(v_grade_maxes, (v_range->>'maxPercent')::numeric);
  END LOOP;

  IF CARDINALITY(v_grade_ids) = 0 THEN
    RAISE EXCEPTION 'Configure at least one grade';
  END IF;
  IF (
    SELECT COUNT(DISTINCT lower(btrim(item)))
    FROM unnest(v_grade_ids) AS entries(item)
  ) <> CARDINALITY(v_grade_ids) THEN
    RAISE EXCEPTION 'Grade IDs must be unique';
  END IF;

  SELECT ARRAY_AGG(min_percent ORDER BY min_percent),
         ARRAY_AGG(max_percent ORDER BY min_percent)
  INTO v_sorted_grade_mins, v_sorted_grade_maxes
  FROM unnest(v_grade_mins, v_grade_maxes) AS grade(min_percent, max_percent);

  FOR i IN 1..CARDINALITY(v_sorted_grade_mins) LOOP
    IF v_sorted_grade_mins[i] < 0
      OR v_sorted_grade_mins[i] > 100
      OR v_sorted_grade_maxes[i] < 0
      OR v_sorted_grade_maxes[i] > 100
      OR v_sorted_grade_mins[i] > v_sorted_grade_maxes[i]
      OR v_sorted_grade_mins[i] <> ROUND(v_sorted_grade_mins[i], 2)
      OR v_sorted_grade_maxes[i] <> ROUND(v_sorted_grade_maxes[i], 2) THEN
      RAISE EXCEPTION 'Grade ranges must be ordered values between 0 and 100';
    END IF;
    IF i > 1 AND v_sorted_grade_mins[i] <= v_sorted_grade_maxes[i - 1] THEN
      RAISE EXCEPTION 'Grade ranges overlap';
    END IF;
    IF i > 1 AND v_sorted_grade_mins[i] <> v_sorted_grade_maxes[i - 1] + 0.01 THEN
      RAISE EXCEPTION 'Grade ranges must provide continuous 0-100 coverage';
    END IF;
  END LOOP;

  IF v_sorted_grade_mins[1] <> 0 OR v_sorted_grade_maxes[CARDINALITY(v_sorted_grade_maxes)] <> 100 THEN
    RAISE EXCEPTION 'Grade ranges must cover the complete 0-100 range';
  END IF;

  SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
    'id', grade.id,
    'grade', grade.grade,
    'points', grade.points,
    'minPercent', grade.min_percent,
    'maxPercent', grade.max_percent
  ) ORDER BY grade.min_percent)
  INTO v_normalized_grade_bands
  FROM unnest(v_grade_ids, v_grade_names, v_grade_points, v_grade_mins, v_grade_maxes)
    AS grade(id, grade, points, min_percent, max_percent);

  FOR v_range IN SELECT value FROM jsonb_array_elements(p_scholarship_categories) LOOP
    v_subject_id := btrim(COALESCE(v_range->>'id', ''));
    v_name := btrim(COALESCE(v_range->>'name', ''));
    IF v_subject_id = '' OR length(v_subject_id) > 120 THEN
      RAISE EXCEPTION 'Every scholarship category requires a valid ID';
    END IF;
    IF v_name = '' OR length(v_name) > 80 THEN
      RAISE EXCEPTION 'Scholarship category % requires a name', v_subject_id;
    END IF;
    IF upper(v_name) IN ('NOT_ELIGIBLE', 'PENDING') THEN
      RAISE EXCEPTION 'Scholarship name % is reserved', v_name;
    END IF;
    IF jsonb_typeof(v_range->'minPercent') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_range->'maxPercent') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Scholarship category % requires numeric bounds', v_subject_id;
    END IF;

    v_scholarship_ids := ARRAY_APPEND(v_scholarship_ids, v_subject_id);
    v_scholarship_names := ARRAY_APPEND(v_scholarship_names, v_name);
    v_scholarship_mins := ARRAY_APPEND(v_scholarship_mins, (v_range->>'minPercent')::numeric);
    v_scholarship_maxes := ARRAY_APPEND(v_scholarship_maxes, (v_range->>'maxPercent')::numeric);

    -- 0034: classes this category applies to ([] = every class).
    v_scope := v_range->'classIds';
    IF v_scope IS NULL OR jsonb_typeof(v_scope) = 'null' THEN
      v_scope := '[]'::jsonb;
    END IF;
    IF jsonb_typeof(v_scope) <> 'array' THEN
      RAISE EXCEPTION 'Scholarship category % classIds must be an array', v_subject_id;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_scope) entry
      WHERE jsonb_typeof(entry) <> 'string'
         OR length(btrim(entry #>> '{}')) > 120
    ) THEN
      RAISE EXCEPTION 'Scholarship category % classIds must be class IDs (short strings)', v_subject_id;
    END IF;
    SELECT COALESCE(JSONB_AGG(DISTINCT to_jsonb(btrim(entry #>> '{}'))), '[]'::jsonb)
    INTO v_scope
    FROM jsonb_array_elements(v_range->'classIds') entry
    WHERE btrim(entry #>> '{}') <> '';
    v_scholarship_scopes := ARRAY_APPEND(v_scholarship_scopes, v_scope);
  END LOOP;

  IF CARDINALITY(v_scholarship_ids) > 0 THEN
    IF (
      SELECT COUNT(DISTINCT lower(btrim(item)))
      FROM unnest(v_scholarship_ids) AS entries(item)
    ) <> CARDINALITY(v_scholarship_ids) THEN
      RAISE EXCEPTION 'Scholarship category IDs must be unique';
    END IF;
    IF (
      SELECT COUNT(DISTINCT lower(btrim(item)))
      FROM unnest(v_scholarship_names) AS entries(item)
    ) <> CARDINALITY(v_scholarship_names) THEN
      RAISE EXCEPTION 'Scholarship category names must be unique';
    END IF;
  END IF;

  SELECT ARRAY_AGG(min_percent ORDER BY min_percent),
         ARRAY_AGG(max_percent ORDER BY min_percent)
  INTO v_sorted_scholarship_mins, v_sorted_scholarship_maxes
  FROM unnest(v_scholarship_mins, v_scholarship_maxes) AS scholarship(min_percent, max_percent);

  FOR i IN 1..COALESCE(CARDINALITY(v_sorted_scholarship_mins), 0) LOOP
    IF v_sorted_scholarship_mins[i] < 0
      OR v_sorted_scholarship_mins[i] > 100
      OR v_sorted_scholarship_maxes[i] < 0
      OR v_sorted_scholarship_maxes[i] > 100
      OR v_sorted_scholarship_mins[i] > v_sorted_scholarship_maxes[i]
      OR v_sorted_scholarship_mins[i] <> ROUND(v_sorted_scholarship_mins[i], 2)
      OR v_sorted_scholarship_maxes[i] <> ROUND(v_sorted_scholarship_maxes[i], 2) THEN
      RAISE EXCEPTION 'Scholarship ranges must be ordered values between 0 and 100';
    END IF;
  END LOOP;

  -- 0034: ranges may repeat percentages only across disjoint class scopes.
  FOR i IN 1..CARDINALITY(v_scholarship_ids) LOOP
    FOR j IN i + 1..CARDINALITY(v_scholarship_ids) LOOP
      IF v_scholarship_mins[i] <= v_scholarship_maxes[j]
         AND v_scholarship_mins[j] <= v_scholarship_maxes[i]
         AND (
           jsonb_array_length(v_scholarship_scopes[i]) = 0
           OR jsonb_array_length(v_scholarship_scopes[j]) = 0
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(v_scholarship_scopes[i]) shared_scope
             WHERE v_scholarship_scopes[j] @> jsonb_build_array(shared_scope)
           )
         ) THEN
        RAISE EXCEPTION 'Scholarship ranges % and % overlap for the same class(es)',
          v_scholarship_names[i], v_scholarship_names[j];
      END IF;
    END LOOP;
  END LOOP;

  IF CARDINALITY(v_scholarship_ids) = 0 THEN
    v_normalized_scholarship_categories := '[]'::jsonb;
  ELSE
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', category.id,
      'name', category.name,
      'minPercent', category.min_percent,
      'maxPercent', category.max_percent,
      'classIds', category.class_scope
    ) ORDER BY category.min_percent)
    INTO v_normalized_scholarship_categories
    FROM unnest(v_scholarship_ids, v_scholarship_names, v_scholarship_mins, v_scholarship_maxes, v_scholarship_scopes)
      AS category(id, name, min_percent, max_percent, class_scope);
  END IF;

  v_pass := COALESCE(p_pass_percent, 33);
  IF v_pass < 0 OR v_pass > 100 OR v_pass <> ROUND(v_pass, 2) THEN
    RAISE EXCEPTION 'Pass percentage must be between 0 and 100';
  END IF;

  INSERT INTO public.exam_mark_configs (
    exam_id,
    grade_bands,
    scholarship_categories,
    pass_percent,
    version,
    updated_by,
    updated_at
  )
  VALUES (
    p_exam_id,
    v_normalized_grade_bands,
    v_normalized_scholarship_categories,
    v_pass,
    1,
    auth.uid(),
    now()
  )
  ON CONFLICT (exam_id) DO UPDATE SET
    grade_bands = EXCLUDED.grade_bands,
    scholarship_categories = EXCLUDED.scholarship_categories,
    pass_percent = EXCLUDED.pass_percent,
    version = public.exam_mark_configs.version + 1,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at
  RETURNING version, updated_at INTO v_version, v_updated_at;

  RETURN JSONB_BUILD_OBJECT(
    'version', v_version,
    'updated_at', v_updated_at,
    'grade_bands', v_normalized_grade_bands,
    'scholarship_categories', v_normalized_scholarship_categories,
    'pass_percent', v_pass
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_exam_grade_scale(UUID, JSONB, JSONB, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_grade_scale(UUID, JSONB, JSONB, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_exam_grade_scale(UUID, JSONB, JSONB, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_exam_results(
  p_exam_id UUID
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
    JOIN jsonb_array_elements(v_subjects) AS subject(value)
      ON subject.value->>'id' = m.subject_id
    WHERE m.exam_id = p_exam_id
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
    AND status = 'APPROVED';

  WITH approved AS (
    SELECT r.*, s.exam_roll
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    WHERE r.exam_id = p_exam_id
      AND r.status = 'APPROVED'
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
    'setup_version', v_setup_version
  );
END;
$$;

-- 3. Existing saved categories keep working: explicit empty classIds.
UPDATE public.exam_mark_configs
SET scholarship_categories = (
  SELECT COALESCE(
    JSONB_AGG(
      CASE WHEN entry ? 'classIds' THEN entry ELSE entry || '{"classIds": []}'::jsonb END
      ORDER BY (entry->>'minPercent')::numeric
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(scholarship_categories) entry
)
WHERE jsonb_array_length(scholarship_categories) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(scholarship_categories) e
    WHERE NOT (e ? 'classIds')
  );

COMMIT;
