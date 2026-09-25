-- ============================================================
-- 0023_marks_entry.sql
-- Marks entry: unique constraint, save & process RPCs, RLS.
-- Run ONCE in the Supabase SQL Editor (as postgres).
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- D1. Marks: one row per (registration, subject)
-- ------------------------------------------------------------
ALTER TABLE marks DROP CONSTRAINT IF EXISTS idx_marks_registration_subject;

-- Remove duplicates, keeping the newest row per pair.
DELETE FROM marks m
WHERE m.created_at < (
  SELECT MAX(m2.created_at)
  FROM marks m2
  WHERE m2.registration_id = m.registration_id
    AND m2.subject_id = m.subject_id
);

CREATE UNIQUE INDEX idx_marks_registration_subject
  ON public.marks(registration_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_marks_exam_subject
  ON public.marks(exam_id, subject_id);

-- ------------------------------------------------------------
-- D2. Results: one row per (exam, student)
-- ------------------------------------------------------------
ALTER TABLE results DROP CONSTRAINT IF EXISTS idx_results_exam_student;

DELETE FROM results r1
WHERE EXISTS (
  SELECT 1 FROM results r2
  WHERE r2.exam_id = r1.exam_id
    AND r2.student_id = r1.student_id
    AND r2.created_at > r1.created_at
);

CREATE UNIQUE INDEX idx_results_exam_student
  ON public.results(exam_id, student_id);

-- ------------------------------------------------------------
-- D3. save_exam_marks(p_exam_id, p_rows jsonb) -> jsonb
--     One transactional upsert. Validates marks against the
--     exam's subject config (0 <= marks <= fullMarks).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_exam_marks(
  p_exam_id uuid,
  p_rows jsonb
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
  v_rejected jsonb := '[]'::jsonb;
  v_row jsonb;
  v_registration_id uuid;
  v_subject_id text;
  v_marks numeric;
  v_full_marks numeric;
  v_student_id uuid;
  v_subject_name text;
  v_is_new boolean;
  v_saved int := 0;
  v_updated int := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN'
  ) INTO v_super_admin;

  IF NOT v_super_admin THEN
    RAISE EXCEPTION 'Only a super admin may enter marks';
  END IF;

  SELECT e.subjects, e.session_id
    INTO v_subjects, v_session_id
    FROM public.exams e WHERE e.id = p_exam_id;

  IF v_subjects IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  -- Tracks which rows landed as inserts vs updates, so we can
  -- report exactly what changed.
  CREATE TEMP TABLE IF NOT EXISTS _marks_batch (
    registration_id uuid,
    subject_id text,
    is_new boolean
  ) ON COMMIT DROP;
  TRUNCATE _marks_batch;

  FOR v_row IN SELECT jsonb_array_elements(p_rows) LOOP
    v_registration_id := (v_row ->> 'registration_id')::uuid;
    v_subject_id := v_row ->> 'subject_id';
    v_marks := (v_row ->> 'marks')::numeric;

    IF v_registration_id IS NULL OR v_subject_id IS NULL OR v_marks IS NULL THEN
      v_rejected := jsonb_build_array(v_rejected, jsonb_build_object(
        'registration_id', v_registration_id, 'subject_id', v_subject_id, 'reason', 'missing fields'));
      CONTINUE;
    END IF;

    -- Does this subject belong to the exam, and is the mark in range?
    SELECT (s ->> 'fullMarks')::numeric, (s ->> 'name')::text
      INTO v_full_marks, v_subject_name
    FROM jsonb_array_elements(v_subjects) s
    WHERE s ->> 'id' = v_subject_id;

    IF v_full_marks IS NULL THEN
      v_rejected := jsonb_build_array(v_rejected, jsonb_build_object(
        'registration_id', v_registration_id, 'subject_id', v_subject_id, 'reason', 'subject not in exam'));
      CONTINUE;
    END IF;

    IF v_marks < 0 OR v_marks > v_full_marks THEN
      v_rejected := jsonb_build_array(v_rejected, jsonb_build_object(
        'registration_id', v_registration_id, 'subject_id', v_subject_id,
        'reason', format('marks must be between 0 and %s', v_full_marks)));
      CONTINUE;
    END IF;

    -- Student behind this registration.
    SELECT r.student_id INTO v_student_id
    FROM public.registrations r WHERE r.id = v_registration_id;

    IF v_student_id IS NULL THEN
      v_rejected := jsonb_build_array(v_rejected, jsonb_build_object(
        'registration_id', v_registration_id, 'subject_id', v_subject_id, 'reason', 'registration not found'));
      CONTINUE;
    END IF;

    INSERT INTO public.marks (session_id, student_id, registration_id, exam_id, subject_id, subject_name, marks, entered_by)
    VALUES (v_session_id, v_student_id, v_registration_id, p_exam_id, v_subject_id, v_subject_name, v_marks, auth.uid()::text)
    ON CONFLICT (registration_id, subject_id)
    DO UPDATE SET
      marks = EXCLUDED.marks,
      entered_by = EXCLUDED.entered_by,
      subject_name = EXCLUDED.subject_name,
      student_id = EXCLUDED.student_id,
      session_id = EXCLUDED.session_id,
      exam_id = EXCLUDED.exam_id,
      subject_id = EXCLUDED.subject_id,
      updated_at = now()
    RETURNING (xmax = 0) INTO v_is_new;

    INSERT INTO _marks_batch (registration_id, subject_id, is_new)
    VALUES (v_registration_id, v_subject_id, v_is_new);
  END LOOP;

  SELECT COUNT(*) FILTER (WHERE is_new), COUNT(*) FILTER (WHERE NOT is_new)
    INTO v_saved, v_updated FROM _marks_batch;

  RETURN jsonb_build_object(
    'saved', v_saved,
    'updated', v_updated,
    'rejected', v_rejected
  );
END;
$$;

-- ------------------------------------------------------------
-- D4. process_exam_results(p_exam_id) -> jsonb
--     Computes totals, percentage, grade, pass, position and
--     scholarship per student from the marks table, then
--     upserts into results (one row per exam + student).
-- ------------------------------------------------------------
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
  v_scholarship_pct numeric := 60;
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
  -- Skip students with no marks (they are counted in v_skipped below).
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
    CASE WHEN r.percentage >= v_scholarship_pct THEN 'ELIGIBLE'::text ELSE 'NOT_ELIGIBLE'::text END,
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

  -- Students that have marks but were not processed (should not happen; safety net).
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

-- ------------------------------------------------------------
-- D5. RLS: marks writable by super admin only
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Institution admin own marks" ON public.marks;

CREATE POLICY "Super admin full access marks"
  ON public.marks FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Students read own marks"
  ON public.marks FOR SELECT
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

COMMIT;
