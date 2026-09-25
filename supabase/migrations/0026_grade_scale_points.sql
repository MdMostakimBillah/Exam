BEGIN;

ALTER FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC)
  RENAME TO save_exam_mark_setup_legacy;

CREATE OR REPLACE FUNCTION public.save_exam_mark_setup(
  p_exam_id UUID,
  p_subjects JSONB,
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
  v_result JSONB;
  v_grade_bands JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may save Grade Scale';
  END IF;

  IF p_grade_bands IS NULL OR jsonb_typeof(p_grade_bands) <> 'array' THEN
    RAISE EXCEPTION 'p_grade_bands must be a JSON array';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_grade_bands) grade_band
    WHERE jsonb_typeof(grade_band->'points') IS DISTINCT FROM 'number'
      OR CASE
        WHEN jsonb_typeof(grade_band->'points') = 'number'
        THEN (grade_band->>'points')::numeric
        ELSE NULL
      END < 0
      OR CASE
        WHEN jsonb_typeof(grade_band->'points') = 'number'
        THEN (grade_band->>'points')::numeric
        ELSE NULL
      END > 5
      OR CASE
        WHEN jsonb_typeof(grade_band->'points') = 'number'
        THEN (grade_band->>'points')::numeric
        ELSE NULL
      END <> ROUND((grade_band->>'points')::numeric, 2)
  ) THEN
    RAISE EXCEPTION 'Grade Scale points must be between 0 and 5 with at most two decimal places';
  END IF;

  v_result := public.save_exam_mark_setup_legacy(
    p_exam_id,
    p_subjects,
    p_grade_bands,
    p_scholarship_categories,
    p_pass_percent
  );

  UPDATE public.exam_mark_configs config
  SET grade_bands = (
    SELECT COALESCE(
      JSONB_AGG(
        CASE
          WHEN requested.id IS NULL THEN saved_band
          ELSE saved_band || JSONB_BUILD_OBJECT('points', requested.points)
        END
        ORDER BY saved_band->>'minPercent'
      ),
      '[]'::jsonb
    )
    FROM JSONB_ARRAY_ELEMENTS(config.grade_bands) saved_band
    LEFT JOIN LATERAL (
      SELECT requested_band->>'id' AS id, requested_band->'points' AS points
      FROM JSONB_ARRAY_ELEMENTS(p_grade_bands) requested_band
      WHERE requested_band->>'id' = saved_band->>'id'
      LIMIT 1
    ) requested ON true
  )
  WHERE config.exam_id = p_exam_id
  RETURNING config.grade_bands INTO v_grade_bands;

  RETURN JSONB_SET(v_result, '{grade_bands}', COALESCE(v_grade_bands, v_result->'grade_bands', '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) TO authenticated;

COMMIT;
