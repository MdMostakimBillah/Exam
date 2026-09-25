BEGIN;

CREATE TABLE IF NOT EXISTS public.exam_mark_configs (
  exam_id UUID PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
  grade_bands JSONB NOT NULL DEFAULT '[]'::jsonb,
  scholarship_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  pass_percent NUMERIC NOT NULL DEFAULT 33,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_mark_configs_grade_bands_array CHECK (jsonb_typeof(grade_bands) = 'array'),
  CONSTRAINT exam_mark_configs_scholarship_categories_array CHECK (jsonb_typeof(scholarship_categories) = 'array'),
  CONSTRAINT exam_mark_configs_pass_percent_range CHECK (pass_percent BETWEEN 0 AND 100),
  CONSTRAINT exam_mark_configs_version_positive CHECK (version > 0)
);

ALTER TABLE public.exam_mark_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access exam mark configs" ON public.exam_mark_configs;
CREATE POLICY "Super admin full access exam mark configs"
  ON public.exam_mark_configs
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated read exam mark configs" ON public.exam_mark_configs;
CREATE POLICY "Authenticated read exam mark configs"
  ON public.exam_mark_configs
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.results ADD COLUMN IF NOT EXISTS mark_setup_version INTEGER;
UPDATE public.results SET scholarship_status = 'PENDING' WHERE scholarship_status IS NULL OR scholarship_status = 'ELIGIBLE';
ALTER TABLE public.results ALTER COLUMN scholarship_status SET DEFAULT 'PENDING';
ALTER TABLE public.results ALTER COLUMN scholarship_status SET NOT NULL;
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_scholarship_status_check;
ALTER TABLE public.results ADD CONSTRAINT results_scholarship_status_check
  CHECK (scholarship_status = btrim(scholarship_status) AND scholarship_status <> '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_marks_registration_subject
  ON public.marks(registration_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_registration_exam_subject
  ON public.marks(registration_id, exam_id, subject_id) INCLUDE (marks, updated_at);
CREATE INDEX IF NOT EXISTS idx_registrations_marks_sheet
  ON public.registrations(exam_id, session_id, class_name, institution_id, created_at, id)
  WHERE status = 'APPROVED';
CREATE INDEX IF NOT EXISTS idx_students_session_class_exam_roll
  ON public.students(session_id, class, exam_roll);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

DROP POLICY IF EXISTS "Institution admin own marks" ON public.marks;
DROP POLICY IF EXISTS "Institution admin manage own marks" ON public.marks;
DROP POLICY IF EXISTS "Super admin full access marks" ON public.marks;
CREATE POLICY "Super admin full access marks"
  ON public.marks
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Students read own marks" ON public.marks;
CREATE POLICY "Students read own marks"
  ON public.marks
  FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

DO $$
DECLARE
  v_exam RECORD;
  v_setting JSONB;
  v_grade_bands JSONB;
  v_scholarship_categories JSONB;
  v_pass_percent NUMERIC := 33;
  v_talent_min NUMERIC := 90;
  v_general_min NUMERIC := 80;
  v_general_max NUMERIC := 89.99;
BEGIN
  FOR v_exam IN SELECT id FROM public.exams LOOP
    v_setting := NULL;
    v_grade_bands := NULL;
    v_scholarship_categories := NULL;
    v_pass_percent := 33;
    v_talent_min := 90;
    v_general_min := 80;
    v_general_max := 89.99;

    BEGIN
      SELECT value::jsonb
      INTO v_setting
      FROM public.system_settings
      WHERE key = 'grading'
        AND category = 'grading'
      LIMIT 1;

      IF v_setting IS NOT NULL AND jsonb_typeof(v_setting) = 'object' THEN
        IF v_setting->>'passPercent' ~ '^-?[0-9]+([.][0-9]+)?$' THEN
          v_pass_percent := (v_setting->>'passPercent')::numeric;
        END IF;

        IF jsonb_typeof(v_setting->'bands') = 'array' THEN
          WITH valid AS (
            SELECT
              btrim(b->>'grade') AS grade,
              (b->>'min')::numeric AS min_percent
            FROM jsonb_array_elements(v_setting->'bands') b
            WHERE jsonb_typeof(b->'min') IN ('number', 'string')
              AND b->>'min' ~ '^-?[0-9]+([.][0-9]+)?$'
              AND (b->>'min')::numeric >= 0
              AND (b->>'min')::numeric <= 100
              AND btrim(COALESCE(b->>'grade', '')) <> ''
          ),
          ordered AS (
            SELECT grade, min_percent,
              LEAD(min_percent) OVER (ORDER BY min_percent) - 0.01 AS next_max
            FROM valid
          ),
          ranged AS (
            SELECT grade, min_percent,
              CASE WHEN next_max IS NULL THEN 100::numeric ELSE next_max END AS max_percent
            FROM ordered
          ),
          with_zero AS (
            SELECT grade, min_percent, max_percent
            FROM ranged
            UNION ALL
            SELECT
              'F'::text,
              0::numeric,
              (SELECT min_percent - 0.01 FROM ranged ORDER BY min_percent LIMIT 1)
            WHERE NOT EXISTS (SELECT 1 FROM ranged WHERE min_percent = 0)
          ),
          checked AS (
            SELECT *,
              LAG(max_percent) OVER (ORDER BY min_percent) AS previous_max,
              ROW_NUMBER() OVER (ORDER BY min_percent) AS ordinality
            FROM with_zero
          )
          SELECT CASE
            WHEN COUNT(*) >= 2
              AND (ARRAY_AGG(min_percent ORDER BY min_percent))[1] = 0
              AND (ARRAY_AGG(max_percent ORDER BY min_percent DESC))[1] = 100
              AND BOOL_AND(min_percent <= max_percent)
              AND COUNT(*) FILTER (
                WHERE previous_max IS NOT NULL
                  AND min_percent <> previous_max + 0.01
              ) = 0
            THEN JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'id', 'legacy_grade_' || ordinality::text,
                'grade', grade,
                'minPercent', min_percent,
                'maxPercent', max_percent
              )
              ORDER BY min_percent
            )
            ELSE NULL
          END
          INTO v_grade_bands
          FROM checked;
        END IF;

        IF v_setting->>'talentpoolPercent' ~ '^-?[0-9]+([.][0-9]+)?$'
          AND v_setting->>'generalScholarshipMin' ~ '^-?[0-9]+([.][0-9]+)?$'
          AND v_setting->>'generalScholarshipMax' ~ '^-?[0-9]+([.][0-9]+)?$' THEN
          v_talent_min := (v_setting->>'talentpoolPercent')::numeric;
          v_general_min := (v_setting->>'generalScholarshipMin')::numeric;
          v_general_max := (v_setting->>'generalScholarshipMax')::numeric;
        END IF;
      END IF;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      v_grade_bands := NULL;
      v_scholarship_categories := NULL;
      v_pass_percent := 33;
      v_talent_min := 90;
      v_general_min := 80;
      v_general_max := 89.99;
    END;

    IF v_grade_bands IS NULL THEN
      v_grade_bands := '[
        {"id":"grade_f","grade":"F","minPercent":0,"maxPercent":32.99},
        {"id":"grade_d","grade":"D","minPercent":33,"maxPercent":39.99},
        {"id":"grade_c","grade":"C","minPercent":40,"maxPercent":49.99},
        {"id":"grade_b","grade":"B","minPercent":50,"maxPercent":59.99},
        {"id":"grade_a_minus","grade":"A-","minPercent":60,"maxPercent":69.99},
        {"id":"grade_a","grade":"A","minPercent":70,"maxPercent":79.99},
        {"id":"grade_a_plus","grade":"A+","minPercent":80,"maxPercent":100}
      ]'::jsonb;
    END IF;

    IF v_pass_percent < 0 OR v_pass_percent > 100 THEN
      v_pass_percent := 33;
    END IF;

    IF v_talent_min BETWEEN 0 AND 100
      AND v_general_min BETWEEN 0 AND 100
      AND v_general_max BETWEEN 0 AND 100
      AND v_general_min <= v_general_max
      AND v_talent_min > v_general_max THEN
      v_scholarship_categories := JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT(
          'id', 'legacy_talent_pool',
          'name', 'TALENT_POOL',
          'minPercent', v_talent_min,
          'maxPercent', 100
        ),
        JSONB_BUILD_OBJECT(
          'id', 'legacy_general',
          'name', 'GENERAL',
          'minPercent', v_general_min,
          'maxPercent', v_general_max
        )
      );
    ELSE
      v_scholarship_categories := '[
        {"id":"scholarship_talent_pool","name":"TALENT_POOL","minPercent":90,"maxPercent":100},
        {"id":"scholarship_general","name":"GENERAL","minPercent":80,"maxPercent":89.99}
      ]'::jsonb;
    END IF;

    INSERT INTO public.exam_mark_configs (
      exam_id,
      grade_bands,
      scholarship_categories,
      pass_percent,
      version
    )
    VALUES (
      v_exam.id,
      v_grade_bands,
      v_scholarship_categories,
      v_pass_percent,
      1
    )
    ON CONFLICT (exam_id) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_marks(
  p_exam_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subjects JSONB;
  v_session_id UUID;
  v_row JSONB;
  v_registration_id UUID;
  v_student_id UUID;
  v_registration_class TEXT;
  v_class_id UUID;
  v_class_code TEXT;
  v_subject_id TEXT;
  v_subject_name TEXT;
  v_full_marks NUMERIC;
  v_marks NUMERIC;
  v_is_new BOOLEAN;
  v_saved INTEGER := 0;
  v_updated INTEGER := 0;
  v_rejected JSONB := '[]'::jsonb;
  v_saved_rows JSONB := '[]'::jsonb;
  v_updated_rows JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may enter marks';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT e.subjects, e.session_id
  INTO v_subjects, v_session_id
  FROM public.exams e
  WHERE e.id = p_exam_id
  FOR SHARE OF e;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_registration_id := NULL;
    v_student_id := NULL;
    v_registration_class := NULL;
    v_class_id := NULL;
    v_class_code := NULL;
    v_subject_id := NULL;
    v_subject_name := NULL;
    v_full_marks := NULL;
    v_marks := NULL;

    IF jsonb_typeof(v_row) <> 'object'
      OR COALESCE(v_row->>'registration_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR btrim(COALESCE(v_row->>'subject_id', '')) = ''
      OR jsonb_typeof(v_row->'marks') <> 'number' THEN
      v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_row->>'registration_id',
        'subject_id', v_row->>'subject_id',
        'reason', 'registration_id, subject_id, and numeric marks are required'
      ));
      CONTINUE;
    END IF;

    v_registration_id := (v_row->>'registration_id')::uuid;
    v_subject_id := btrim(v_row->>'subject_id');

    BEGIN
      v_marks := (v_row->>'marks')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_marks := NULL;
    END;

    IF v_marks IS NULL OR v_marks <> ROUND(v_marks, 2) THEN
      v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_subject_id,
        'reason', 'marks must be a finite number with at most two decimal places'
      ));
      CONTINUE;
    END IF;

    SELECT r.student_id, r.session_id, r.class_name, c.id, c.code
    INTO v_student_id, v_session_id, v_registration_class, v_class_id, v_class_code
    FROM public.registrations r
    LEFT JOIN LATERAL (
      SELECT cl.id, cl.code
      FROM public.classes cl
      WHERE r.class_name = cl.name
        OR r.class_name = cl.code
        OR r.class_name = cl.id::text
      ORDER BY
        CASE
          WHEN r.class_name = cl.name THEN 1
          WHEN r.class_name = cl.id::text THEN 2
          ELSE 3
        END,
        cl.code
      LIMIT 1
    ) c ON true
    WHERE r.id = v_registration_id
      AND r.exam_id = p_exam_id
      AND r.status = 'APPROVED'
      AND r.id = (
        SELECT canonical.id
        FROM public.registrations canonical
        WHERE canonical.exam_id = p_exam_id
          AND canonical.student_id = r.student_id
          AND canonical.status = 'APPROVED'
        ORDER BY canonical.created_at DESC, canonical.id DESC
        LIMIT 1
      )
      AND r.session_id = (
        SELECT e.session_id FROM public.exams e WHERE e.id = p_exam_id
      );

    IF v_student_id IS NULL THEN
      v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_subject_id,
        'reason', 'registration not found, not approved, or not in this exam'
      ));
      CONTINUE;
    END IF;

    SELECT
      s->>'id',
      s->>'name',
      CASE
        WHEN jsonb_typeof(s->'fullMarks') = 'number'
        THEN (s->>'fullMarks')::numeric
        ELSE NULL
      END
    INTO v_subject_id, v_subject_name, v_full_marks
    FROM jsonb_array_elements(v_subjects) s
    WHERE s->>'id' = v_row->>'subject_id'
      AND (
        s->'classId' IS NULL
        OR btrim(COALESCE(s->>'classId', '')) = ''
        OR s->>'classId' IN (v_class_id::text, v_registration_class, v_class_code)
      )
    ORDER BY
      CASE WHEN s->'classId' IS NULL OR btrim(COALESCE(s->>'classId', '')) = '' THEN 0 ELSE 1 END,
      s->>'id'
    LIMIT 1;

    IF v_full_marks IS NULL
      OR v_full_marks <= 0
      OR v_subject_name IS NULL
      OR btrim(v_subject_name) = '' THEN
      v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_row->>'subject_id',
        'reason', 'subject is not configured for this class or has invalid full marks'
      ));
      CONTINUE;
    END IF;

    IF v_marks < 0 OR v_marks > v_full_marks THEN
      v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_subject_id,
        'reason', FORMAT('marks must be between 0 and %s', v_full_marks)
      ));
      CONTINUE;
    END IF;

    INSERT INTO public.marks (
      session_id,
      student_id,
      registration_id,
      exam_id,
      subject_id,
      subject_name,
      marks,
      entered_by
    )
    VALUES (
      v_session_id,
      v_student_id,
      v_registration_id,
      p_exam_id,
      v_subject_id,
      v_subject_name,
      v_marks,
      auth.uid()::text
    )
    ON CONFLICT (registration_id, subject_id)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      student_id = EXCLUDED.student_id,
      exam_id = EXCLUDED.exam_id,
      subject_name = EXCLUDED.subject_name,
      marks = EXCLUDED.marks,
      entered_by = EXCLUDED.entered_by,
      updated_at = now()
    RETURNING (xmax = 0) INTO v_is_new;

    IF v_is_new THEN
      v_saved := v_saved + 1;
      v_saved_rows := v_saved_rows || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_subject_id,
        'marks', v_marks
      ));
    ELSE
      v_updated := v_updated + 1;
      v_updated_rows := v_updated_rows || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'registration_id', v_registration_id,
        'subject_id', v_subject_id,
        'marks', v_marks
      ));
    END IF;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'saved', v_saved,
    'updated', v_updated,
    'saved_rows', v_saved_rows,
    'updated_rows', v_updated_rows,
    'rejected', v_rejected
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_exam_mark(
  p_exam_id UUID,
  p_registration_id UUID,
  p_subject_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleared INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may clear marks';
  END IF;

  PERFORM 1
  FROM public.exams e
  WHERE e.id = p_exam_id;
  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', false, 'cleared', 0, 'reason', 'Exam not found');
  END IF;

  PERFORM 1
  FROM public.registrations r
  WHERE r.id = p_registration_id
    AND r.exam_id = p_exam_id;
  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT(
      'success', false,
      'cleared', 0,
      'reason', 'Registration not found, not approved, or not in this exam'
    );
  END IF;

  DELETE FROM public.marks m
  WHERE m.exam_id = p_exam_id
    AND m.registration_id = p_registration_id
    AND m.subject_id = p_subject_id;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN JSONB_BUILD_OBJECT(
    'success', true,
    'cleared', v_cleared,
    'reason', CASE
      WHEN v_cleared = 0 THEN 'Mark was already empty'
      ELSE 'Mark cleared'
    END
  );
END;
$$;

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
  v_exam_classes TEXT[];
  v_class_ref TEXT;
  v_class_id UUID;
  v_subject JSONB;
  v_range JSONB;
  v_normalized_subjects JSONB := '[]'::jsonb;
  v_normalized_grade_bands JSONB;
  v_normalized_scholarship_categories JSONB;
  v_subject_id TEXT;
  v_class_key TEXT;
  v_name TEXT;
  v_full_marks NUMERIC;
  v_pass_marks NUMERIC;
  v_duration NUMERIC;
  v_negative_marks NUMERIC;
  v_grade_ids TEXT[] := '{}'::TEXT[];
  v_grade_names TEXT[] := '{}'::TEXT[];
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
    RAISE EXCEPTION 'Only a super admin may save mark setup';
  END IF;

  SELECT e.classes
  INTO v_exam_classes
  FROM public.exams e
  WHERE e.id = p_exam_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  IF v_exam_classes IS NULL OR CARDINALITY(v_exam_classes) = 0 THEN
    RAISE EXCEPTION 'Select at least one exam class before saving setup';
  END IF;

  IF p_subjects IS NULL OR jsonb_typeof(p_subjects) <> 'array' THEN
    RAISE EXCEPTION 'p_subjects must be a JSON array';
  END IF;
  IF p_grade_bands IS NULL OR jsonb_typeof(p_grade_bands) <> 'array' THEN
    RAISE EXCEPTION 'p_grade_bands must be a JSON array';
  END IF;
  IF p_scholarship_categories IS NULL OR jsonb_typeof(p_scholarship_categories) <> 'array' THEN
    RAISE EXCEPTION 'p_scholarship_categories must be a JSON array';
  END IF;

  FOR v_class_ref IN SELECT DISTINCT unnest(v_exam_classes) LOOP
    SELECT c.id
    INTO v_class_id
    FROM public.classes c
    WHERE c.id::text = v_class_ref
      OR c.code = v_class_ref
    LIMIT 1;
    IF v_class_id IS NULL THEN
      RAISE EXCEPTION 'Exam class identifier % is not a valid class', v_class_ref;
    END IF;
  END LOOP;

  FOR v_subject IN SELECT value FROM jsonb_array_elements(p_subjects) LOOP
    IF jsonb_typeof(v_subject) <> 'object' THEN
      RAISE EXCEPTION 'Every subject must be a JSON object';
    END IF;

    v_subject_id := btrim(COALESCE(v_subject->>'id', ''));
    v_class_key := NULLIF(btrim(COALESCE(v_subject->>'classId', '')), '');
    v_name := btrim(COALESCE(v_subject->>'name', ''));

    IF v_subject_id = '' OR length(v_subject_id) > 120 THEN
      RAISE EXCEPTION 'Every subject requires a valid stable ID';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_normalized_subjects) existing
      WHERE lower(btrim(existing->>'id')) = lower(v_subject_id)
    ) THEN
      RAISE EXCEPTION 'Subject ID % is duplicated', v_subject_id;
    END IF;
    IF v_name = '' OR length(v_name) > 150 THEN
      RAISE EXCEPTION 'Subject % requires a name', v_subject_id;
    END IF;
    IF jsonb_typeof(v_subject->'fullMarks') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_subject->'passMarks') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_subject->'duration') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_subject->'negativeMarks') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Subject % requires numeric marks, duration, and negative-mark values', v_subject_id;
    END IF;

    v_full_marks := (v_subject->>'fullMarks')::numeric;
    v_pass_marks := (v_subject->>'passMarks')::numeric;
    v_duration := (v_subject->>'duration')::numeric;
    v_negative_marks := (v_subject->>'negativeMarks')::numeric;

    IF v_full_marks <= 0 OR v_full_marks > 10000 OR v_full_marks <> ROUND(v_full_marks, 2) THEN
      RAISE EXCEPTION 'Subject % has invalid full marks', v_subject_id;
    END IF;
    IF v_pass_marks < 0 OR v_pass_marks > v_full_marks OR v_pass_marks <> ROUND(v_pass_marks, 2) THEN
      RAISE EXCEPTION 'Subject % has invalid pass marks', v_subject_id;
    END IF;
    IF v_duration <= 0 OR v_duration > 10000 OR v_duration <> ROUND(v_duration, 2) THEN
      RAISE EXCEPTION 'Subject % has invalid duration', v_subject_id;
    END IF;
    IF v_negative_marks < 0 OR v_negative_marks > v_full_marks OR v_negative_marks <> ROUND(v_negative_marks, 2) THEN
      RAISE EXCEPTION 'Subject % has invalid negative marks', v_subject_id;
    END IF;

    IF v_class_key IS NOT NULL THEN
      SELECT c.id
      INTO v_class_id
      FROM public.classes c
      WHERE c.id::text = v_class_key
        OR c.code = v_class_key
      LIMIT 1;
      IF v_class_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.classes configured
        WHERE configured.id = v_class_id
          AND (configured.id::text = ANY(v_exam_classes) OR configured.code = ANY(v_exam_classes))
      ) THEN
        RAISE EXCEPTION 'Subject % references a class that does not belong to this exam', v_subject_id;
      END IF;
      v_class_key := v_class_id::text;
    END IF;

    v_normalized_subjects := v_normalized_subjects || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
      'id', v_subject_id,
      'classId', v_class_key,
      'name', v_name,
      'fullMarks', v_full_marks,
      'passMarks', v_pass_marks,
      'duration', v_duration,
      'negativeMarks', v_negative_marks
    ));
  END LOOP;

  IF jsonb_array_length(v_normalized_subjects) = 0 THEN
    RAISE EXCEPTION 'Configure at least one subject';
  END IF;

  FOR v_class_ref IN SELECT DISTINCT unnest(v_exam_classes) LOOP
    SELECT c.id INTO v_class_id
    FROM public.classes c
    WHERE c.id::text = v_class_ref OR c.code = v_class_ref
    LIMIT 1;
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_normalized_subjects) subject
      WHERE subject->>'classId' IS NULL
        OR subject->>'classId' = v_class_id::text
    ) THEN
      RAISE EXCEPTION 'Configure at least one subject for exam class %', v_class_ref;
    END IF;
  END LOOP;

  FOR v_range IN SELECT value FROM jsonb_array_elements(p_grade_bands) LOOP
    v_subject_id := btrim(COALESCE(v_range->>'id', ''));
    v_name := btrim(COALESCE(v_range->>'grade', ''));
    IF v_subject_id = '' OR length(v_subject_id) > 120 THEN
      RAISE EXCEPTION 'Every grade band requires a valid ID';
    END IF;
    IF v_name = '' OR length(v_name) > 40 THEN
      RAISE EXCEPTION 'Grade band % requires a grade label', v_subject_id;
    END IF;
    IF jsonb_typeof(v_range->'minPercent') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_range->'maxPercent') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Grade band % requires numeric bounds', v_subject_id;
    END IF;

    v_grade_mins := ARRAY_APPEND(v_grade_mins, (v_range->>'minPercent')::numeric);
    v_grade_maxes := ARRAY_APPEND(v_grade_maxes, (v_range->>'maxPercent')::numeric);
    v_grade_ids := ARRAY_APPEND(v_grade_ids, v_subject_id);
    v_grade_names := ARRAY_APPEND(v_grade_names, v_name);
  END LOOP;

  IF CARDINALITY(v_grade_ids) = 0 THEN
    RAISE EXCEPTION 'Configure at least one grade band';
  END IF;
  IF (
    SELECT COUNT(DISTINCT lower(btrim(item)))
    FROM unnest(v_grade_ids) AS entries(item)
  ) <> CARDINALITY(v_grade_ids) THEN
    RAISE EXCEPTION 'Grade band IDs must be unique';
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
    'minPercent', grade.min_percent,
    'maxPercent', grade.max_percent
  ) ORDER BY grade.min_percent)
  INTO v_normalized_grade_bands
  FROM unnest(v_grade_ids, v_grade_names, v_grade_mins, v_grade_maxes)
    AS grade(id, grade, min_percent, max_percent);

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

    v_scholarship_mins := ARRAY_APPEND(v_scholarship_mins, (v_range->>'minPercent')::numeric);
    v_scholarship_maxes := ARRAY_APPEND(v_scholarship_maxes, (v_range->>'maxPercent')::numeric);
    v_scholarship_ids := ARRAY_APPEND(v_scholarship_ids, v_subject_id);
    v_scholarship_names := ARRAY_APPEND(v_scholarship_names, v_name);
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

  IF EXISTS (
    SELECT 1
    FROM public.marks m
    JOIN jsonb_array_elements(v_normalized_subjects) subject
      ON subject->>'id' = m.subject_id
    WHERE m.exam_id = p_exam_id
      AND (
        m.marks < 0
        OR m.marks > (subject->>'fullMarks')::numeric
        OR m.marks <> ROUND(m.marks, 2)
      )
  ) THEN
    RAISE EXCEPTION 'Existing marks exceed the new subject full-mark limits';
  END IF;

  UPDATE public.exams
  SET subjects = v_normalized_subjects,
      updated_at = now()
  WHERE id = p_exam_id;

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
    'subjects', v_normalized_subjects,
    'grade_bands', v_normalized_grade_bands,
    'scholarship_categories', v_normalized_scholarship_categories,
    'pass_percent', v_pass
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_marks_sheet_page(
  p_exam_id UUID,
  p_class_id UUID,
  p_institution_id UUID,
  p_subject_id TEXT,
  p_search TEXT,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_class_name TEXT;
  v_class_code TEXT;
  v_subject_name TEXT;
  v_full_marks NUMERIC;
  v_search TEXT;
  v_search_pattern TEXT;
  v_page INTEGER;
  v_page_size INTEGER;
  v_total_matching INTEGER;
  v_total_candidates INTEGER;
  v_total_pages INTEGER;
  v_effective_page INTEGER;
  v_rows JSONB;
  v_entered_count INTEGER;
  v_missing_count INTEGER;
  v_institutions_represented INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin may view the marks sheet';
  END IF;

  SELECT e.session_id
  INTO v_session_id
  FROM public.exams e
  WHERE e.id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  SELECT c.name, c.code
  INTO v_class_name, v_class_code
  FROM public.exams e
  JOIN public.classes c
    ON c.id = p_class_id
   AND (
     c.id::text = ANY(e.classes)
     OR c.code = ANY(e.classes)
   )
  WHERE e.id = p_exam_id;

  IF v_class_name IS NULL THEN
    RAISE EXCEPTION 'Class does not belong to this exam';
  END IF;

  IF btrim(COALESCE(p_subject_id, '')) = '' THEN
    RAISE EXCEPTION 'A subject is required';
  END IF;

  SELECT
    s->>'name',
    CASE
      WHEN jsonb_typeof(s->'fullMarks') = 'number'
      THEN (s->>'fullMarks')::numeric
      ELSE NULL
    END
  INTO v_subject_name, v_full_marks
  FROM public.exams e
  CROSS JOIN LATERAL jsonb_array_elements(e.subjects) s
  WHERE e.id = p_exam_id
    AND s->>'id' = p_subject_id
    AND (
      s->'classId' IS NULL
      OR btrim(COALESCE(s->>'classId', '')) = ''
      OR s->>'classId' IN (p_class_id::text, v_class_name, v_class_code)
    )
  ORDER BY
    CASE WHEN s->'classId' IS NULL OR btrim(COALESCE(s->>'classId', '')) = '' THEN 0 ELSE 1 END,
    s->>'id'
  LIMIT 1;

  IF v_full_marks IS NULL OR v_full_marks <= 0 THEN
    RAISE EXCEPTION 'Subject is not configured for this class';
  END IF;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 200);
  v_search := btrim(COALESCE(p_search, ''));
  v_search_pattern := '%' || REPLACE(REPLACE(REPLACE(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  WITH base AS (
    SELECT
      r.id AS registration_id,
      r.student_id,
      r.student_name,
      r.institution_id,
      r.institution_name,
      r.registration_number,
      r.class_name,
      NULLIF(BTRIM(s.exam_roll), '') AS exam_roll,
      m.marks
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    LEFT JOIN public.marks m
      ON m.registration_id = r.id
      AND m.exam_id = p_exam_id
      AND m.subject_id = p_subject_id
    WHERE r.exam_id = p_exam_id
      AND r.session_id = v_session_id
      AND r.status = 'APPROVED'
      AND r.id = (
        SELECT canonical.id
        FROM public.registrations canonical
        WHERE canonical.exam_id = p_exam_id
          AND canonical.student_id = r.student_id
          AND canonical.status = 'APPROVED'
        ORDER BY canonical.created_at DESC, canonical.id DESC
        LIMIT 1
      )
      AND r.class_name IN (v_class_name, v_class_code, p_class_id::text)
      AND (p_institution_id IS NULL OR r.institution_id = p_institution_id)
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE v_search = ''
      OR student_name ILIKE v_search_pattern ESCAPE '\'
      OR registration_number ILIKE v_search_pattern ESCAPE '\'
      OR institution_name ILIKE v_search_pattern ESCAPE '\'
      OR exam_roll ILIKE v_search_pattern ESCAPE '\'
  ),
  totals AS (
    SELECT COUNT(*)::INTEGER AS total_matching
    FROM filtered
  )
  SELECT total_matching INTO v_total_matching
  FROM totals;

  v_total_pages := CEIL(v_total_matching::numeric / v_page_size)::INTEGER;
  v_effective_page := CASE
    WHEN v_total_pages = 0 THEN 1
    ELSE LEAST(v_page, v_total_pages)
  END;

  WITH base AS (
    SELECT
      r.id AS registration_id,
      r.student_id,
      r.student_name,
      r.institution_id,
      r.institution_name,
      r.registration_number,
      r.class_name,
      NULLIF(BTRIM(s.exam_roll), '') AS exam_roll,
      m.marks
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    LEFT JOIN public.marks m
      ON m.registration_id = r.id
      AND m.exam_id = p_exam_id
      AND m.subject_id = p_subject_id
    WHERE r.exam_id = p_exam_id
      AND r.session_id = v_session_id
      AND r.status = 'APPROVED'
      AND r.id = (
        SELECT canonical.id
        FROM public.registrations canonical
        WHERE canonical.exam_id = p_exam_id
          AND canonical.student_id = r.student_id
          AND canonical.status = 'APPROVED'
        ORDER BY canonical.created_at DESC, canonical.id DESC
        LIMIT 1
      )
      AND r.class_name IN (v_class_name, v_class_code, p_class_id::text)
      AND (p_institution_id IS NULL OR r.institution_id = p_institution_id)
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(base.marks)::INTEGER,
    COUNT(DISTINCT base.institution_id)::INTEGER
  INTO v_total_candidates, v_entered_count, v_institutions_represented
  FROM base;

  v_missing_count := v_total_candidates - v_entered_count;

  WITH base AS (
    SELECT
      r.id AS registration_id,
      r.student_id,
      r.student_name,
      r.institution_id,
      r.institution_name,
      r.registration_number,
      r.class_name,
      NULLIF(BTRIM(s.exam_roll), '') AS exam_roll,
      m.marks
    FROM public.registrations r
    JOIN public.students s
      ON s.id = r.student_id
      AND s.session_id = r.session_id
    LEFT JOIN public.marks m
      ON m.registration_id = r.id
      AND m.exam_id = p_exam_id
      AND m.subject_id = p_subject_id
    WHERE r.exam_id = p_exam_id
      AND r.session_id = v_session_id
      AND r.status = 'APPROVED'
      AND r.id = (
        SELECT canonical.id
        FROM public.registrations canonical
        WHERE canonical.exam_id = p_exam_id
          AND canonical.student_id = r.student_id
          AND canonical.status = 'APPROVED'
        ORDER BY canonical.created_at DESC, canonical.id DESC
        LIMIT 1
      )
      AND r.class_name IN (v_class_name, v_class_code, p_class_id::text)
      AND (p_institution_id IS NULL OR r.institution_id = p_institution_id)
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE v_search = ''
      OR student_name ILIKE v_search_pattern ESCAPE '\'
      OR registration_number ILIKE v_search_pattern ESCAPE '\'
      OR institution_name ILIKE v_search_pattern ESCAPE '\'
      OR exam_roll ILIKE v_search_pattern ESCAPE '\'
  ),
  page_rows AS (
    SELECT *, ROW_NUMBER() OVER (
      ORDER BY exam_roll NULLS LAST, registration_number, registration_id
    ) AS result_row
    FROM filtered
    ORDER BY exam_roll NULLS LAST, registration_number, registration_id
    LIMIT v_page_size
    OFFSET (v_effective_page - 1) * v_page_size
  )
  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'registration_id', registration_id,
        'student_id', student_id,
        'student_name', student_name,
        'institution_id', institution_id,
        'institution_name', institution_name,
        'registration_number', registration_number,
        'class_name', class_name,
        'exam_roll', NULLIF(exam_roll, ''),
        'marks', marks,
        'full_marks', v_full_marks,
        'subject_name', v_subject_name
      )
      ORDER BY result_row
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM page_rows;

  RETURN JSONB_BUILD_OBJECT(
    'rows', v_rows,
    'page', v_effective_page,
    'page_size', v_page_size,
    'total_matching', v_total_matching,
    'total_pages', v_total_pages,
    'total_candidates', v_total_candidates,
    'summary', JSONB_BUILD_OBJECT(
      'total_candidates', v_total_candidates,
      'institutions_represented', v_institutions_represented,
      'entered_count', v_entered_count,
      'missing_count', v_missing_count
    )
  );
END;
$$;

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

REVOKE ALL ON FUNCTION public.save_exam_marks(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_marks(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.process_exam_results(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_exam_results(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_exam_marks(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_mark_setup(UUID, JSONB, JSONB, JSONB, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_exam_results(UUID) TO authenticated;

REVOKE ALL ON TABLE public.exam_mark_configs FROM anon;
GRANT SELECT ON TABLE public.exam_mark_configs TO authenticated;

COMMIT;
