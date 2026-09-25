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
  v_sorted_scholarship_mins NUMERIC[];
  v_sorted_scholarship_maxes NUMERIC[];
  v_pass NUMERIC;
  v_version INTEGER;
  v_updated_at TIMESTAMPTZ;
  i INTEGER;
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
    IF i > 1 AND v_sorted_scholarship_mins[i] <= v_sorted_scholarship_maxes[i - 1] THEN
      RAISE EXCEPTION 'Scholarship ranges overlap';
    END IF;
  END LOOP;

  IF CARDINALITY(v_scholarship_ids) = 0 THEN
    v_normalized_scholarship_categories := '[]'::jsonb;
  ELSE
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', category.id,
      'name', category.name,
      'minPercent', category.min_percent,
      'maxPercent', category.max_percent
    ) ORDER BY category.min_percent)
    INTO v_normalized_scholarship_categories
    FROM unnest(v_scholarship_ids, v_scholarship_names, v_scholarship_mins, v_scholarship_maxes)
      AS category(id, name, min_percent, max_percent);
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

COMMIT;
