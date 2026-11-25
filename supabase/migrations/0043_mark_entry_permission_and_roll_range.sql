-- =====================================================================
-- 0043 — Restrict Institution Mark Entry & Enforce Permitted Roll Range
-- =====================================================================
--
-- WHY
--   Migration 0030 enabled blind mark entry for all institution staff
--   automatically. Mark entry should work like Admit Card downloads (0033):
--     1. Disabled by default across ALL institutions (`allow_mark_entry = false`).
--     2. Super Admin enables `allow_mark_entry` per institution AND optionally
--        configures the numeric exam-roll range (`mark_entry_roll_from`,
--        `mark_entry_roll_to`) that institution is allowed to view and mark.
--     3. Both the permission flag and the permitted roll range are enforced
--        server-side inside `get_marks_sheet_page`, `save_exam_marks`, and
--        `clear_exam_mark` (as well as UI gating on `/i/[slug]/marks`), while
--        preserving blind marking (excluding caller's own institution's students).
--
-- SAFETY
--   - A SECURITY DEFINER trigger prevents any non-super-admin from setting or
--     modifying `allow_mark_entry`, `mark_entry_roll_from`, or `mark_entry_roll_to`
--     through the institution admin's own-row UPDATE policy.
--   - All SQL objects are idempotent and safe to re-run.

-- ── 1. Permission & roll-range columns on public.institutions ──────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS allow_mark_entry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mark_entry_roll_from TEXT,
  ADD COLUMN IF NOT EXISTS mark_entry_roll_to TEXT,
  ADD COLUMN IF NOT EXISTS mark_entry_roll_ranges JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.protect_mark_entry_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
  v_to TEXT;
  v_tmp TEXT;
BEGIN
  -- Only super admins (or service-role operations where auth.uid() IS NULL)
  -- may enable mark entry or modify the permitted roll range.
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.allow_mark_entry := false;
      NEW.mark_entry_roll_from := NULL;
      NEW.mark_entry_roll_to := NULL;
      NEW.mark_entry_roll_ranges := '[]'::jsonb;
    ELSE
      NEW.allow_mark_entry := OLD.allow_mark_entry;
      NEW.mark_entry_roll_from := OLD.mark_entry_roll_from;
      NEW.mark_entry_roll_to := OLD.mark_entry_roll_to;
      NEW.mark_entry_roll_ranges := COALESCE(OLD.mark_entry_roll_ranges, '[]'::jsonb);
    END IF;
  END IF;

  -- Normalise optional bounds to digits-only and guarantee from <= to.
  v_from := NULLIF(regexp_replace(COALESCE(NEW.mark_entry_roll_from, ''), '\D', '', 'g'), '');
  v_to := NULLIF(regexp_replace(COALESCE(NEW.mark_entry_roll_to, ''), '\D', '', 'g'), '');
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from::numeric > v_to::numeric THEN
    v_tmp := v_from;
    v_from := v_to;
    v_to := v_tmp;
  END IF;
  NEW.mark_entry_roll_from := v_from;
  NEW.mark_entry_roll_to := v_to;
  IF NEW.mark_entry_roll_ranges IS NULL OR jsonb_typeof(NEW.mark_entry_roll_ranges) <> 'array' THEN
    NEW.mark_entry_roll_ranges := '[]'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_mark_entry_permission ON public.institutions;
CREATE TRIGGER protect_mark_entry_permission
  BEFORE INSERT OR UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_mark_entry_permission();

-- =====================================================================
-- 2. save_exam_marks — require permission + permitted roll range
-- =====================================================================
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
  v_exclude_institution_id UUID;
  v_allow_mark_entry BOOLEAN;
  v_allowed_ranges JSONB := '[]'::jsonb;
  v_allowed_from_txt TEXT;
  v_allowed_to_txt TEXT;
  v_allowed_from_num NUMERIC;
  v_allowed_to_num NUMERIC;
  v_tmp_num NUMERIC;
  v_row JSONB;
  v_registration_id UUID;
  v_student_id UUID;
  v_registration_class TEXT;
  v_class_id UUID;
  v_class_code TEXT;
  v_exam_roll TEXT;
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
  IF public.is_super_admin() THEN
    v_exclude_institution_id := NULL;
    v_allowed_from_num := NULL;
    v_allowed_to_num := NULL;
  ELSE
    v_exclude_institution_id := public.get_user_institution_id();
    IF v_exclude_institution_id IS NULL THEN
      RAISE EXCEPTION 'Only a super admin or institution staff may enter marks';
    END IF;

    SELECT i.allow_mark_entry, i.mark_entry_roll_from, i.mark_entry_roll_to, COALESCE(i.mark_entry_roll_ranges, '[]'::jsonb)
    INTO v_allow_mark_entry, v_allowed_from_txt, v_allowed_to_txt, v_allowed_ranges
    FROM public.institutions i
    WHERE i.id = v_exclude_institution_id;

    IF NOT FOUND OR NOT COALESCE(v_allow_mark_entry, false) THEN
      RAISE EXCEPTION 'Mark entry permission is not enabled for your institution';
    END IF;

    v_allowed_from_txt := NULLIF(regexp_replace(COALESCE(v_allowed_from_txt, ''), '\D', '', 'g'), '');
    v_allowed_to_txt := NULLIF(regexp_replace(COALESCE(v_allowed_to_txt, ''), '\D', '', 'g'), '');
    v_allowed_from_num := CASE WHEN v_allowed_from_txt IS NOT NULL THEN v_allowed_from_txt::numeric ELSE NULL END;
    v_allowed_to_num := CASE WHEN v_allowed_to_txt IS NOT NULL THEN v_allowed_to_txt::numeric ELSE NULL END;
    IF v_allowed_from_num IS NOT NULL AND v_allowed_to_num IS NOT NULL AND v_allowed_from_num > v_allowed_to_num THEN
      v_tmp_num := v_allowed_from_num;
      v_allowed_from_num := v_allowed_to_num;
      v_allowed_to_num := v_tmp_num;
    END IF;
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
    v_exam_roll := NULL;
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

    SELECT r.student_id, r.session_id, r.class_name, c.id, c.code, NULLIF(BTRIM(st.exam_roll), '')
    INTO v_student_id, v_session_id, v_registration_class, v_class_id, v_class_code, v_exam_roll
    FROM public.registrations r
    LEFT JOIN public.students st
      ON st.id = r.student_id
      AND st.session_id = r.session_id
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
      AND (v_exclude_institution_id IS NULL OR r.institution_id IS DISTINCT FROM v_exclude_institution_id)
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
        'reason', 'registration not found, not approved, not in this exam, or your own institution (marked by another institution)'
      ));
      CONTINUE;
    END IF;

    IF jsonb_array_length(v_allowed_ranges) > 0 THEN
      IF v_exam_roll IS NULL
        OR v_exam_roll !~ '^[0-9]+$'
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_allowed_ranges) rng
          WHERE (
            rng->>'classId' IS NULL
            OR btrim(COALESCE(rng->>'classId', '')) = ''
            OR rng->>'classId' IN (v_class_id::text, v_registration_class, v_class_code)
            OR rng->>'className' = v_registration_class
          )
          AND (
            NULLIF(regexp_replace(COALESCE(rng->>'from', ''), '\D', '', 'g'), '') IS NULL
            OR v_exam_roll::numeric >= (regexp_replace(COALESCE(rng->>'from', ''), '\D', '', 'g'))::numeric
          )
          AND (
            NULLIF(regexp_replace(COALESCE(rng->>'to', ''), '\D', '', 'g'), '') IS NULL
            OR v_exam_roll::numeric <= (regexp_replace(COALESCE(rng->>'to', ''), '\D', '', 'g'))::numeric
          )
        ) THEN
        v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
          'registration_id', v_registration_id,
          'subject_id', v_subject_id,
          'reason', FORMAT(
            'exam roll %s is outside your institution''s configured permitted roll ranges for this class',
            COALESCE(v_exam_roll, 'unassigned')
          )
        ));
        CONTINUE;
      END IF;
    ELSIF v_allowed_from_num IS NOT NULL OR v_allowed_to_num IS NOT NULL THEN
      IF v_exam_roll IS NULL
        OR v_exam_roll !~ '^[0-9]+$'
        OR (v_allowed_from_num IS NOT NULL AND v_exam_roll::numeric < v_allowed_from_num)
        OR (v_allowed_to_num IS NOT NULL AND v_exam_roll::numeric > v_allowed_to_num) THEN
        v_rejected := v_rejected || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
          'registration_id', v_registration_id,
          'subject_id', v_subject_id,
          'reason', FORMAT(
            'exam roll %s is outside your institution''s permitted mark entry range (%s to %s)',
            COALESCE(v_exam_roll, 'unassigned'),
            COALESCE(v_allowed_from_txt, 'start'),
            COALESCE(v_allowed_to_txt, 'end')
          )
        ));
        CONTINUE;
      END IF;
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

-- =====================================================================
-- 3. clear_exam_mark — require permission + permitted roll range
-- =====================================================================
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
  v_exclude_institution_id UUID;
  v_allow_mark_entry BOOLEAN;
  v_allowed_ranges JSONB := '[]'::jsonb;
  v_allowed_from_txt TEXT;
  v_allowed_to_txt TEXT;
  v_allowed_from_num NUMERIC;
  v_allowed_to_num NUMERIC;
  v_tmp_num NUMERIC;
  v_found BOOLEAN;
  v_exam_roll TEXT;
  v_registration_class TEXT;
BEGIN
  IF public.is_super_admin() THEN
    v_exclude_institution_id := NULL;
    v_allowed_from_num := NULL;
    v_allowed_to_num := NULL;
  ELSE
    v_exclude_institution_id := public.get_user_institution_id();
    IF v_exclude_institution_id IS NULL THEN
      RAISE EXCEPTION 'Only a super admin or institution staff may clear marks';
    END IF;

    SELECT i.allow_mark_entry, i.mark_entry_roll_from, i.mark_entry_roll_to, COALESCE(i.mark_entry_roll_ranges, '[]'::jsonb)
    INTO v_allow_mark_entry, v_allowed_from_txt, v_allowed_to_txt, v_allowed_ranges
    FROM public.institutions i
    WHERE i.id = v_exclude_institution_id;

    IF NOT FOUND OR NOT COALESCE(v_allow_mark_entry, false) THEN
      RAISE EXCEPTION 'Mark entry permission is not enabled for your institution';
    END IF;

    v_allowed_from_txt := NULLIF(regexp_replace(COALESCE(v_allowed_from_txt, ''), '\D', '', 'g'), '');
    v_allowed_to_txt := NULLIF(regexp_replace(COALESCE(v_allowed_to_txt, ''), '\D', '', 'g'), '');
    v_allowed_from_num := CASE WHEN v_allowed_from_txt IS NOT NULL THEN v_allowed_from_txt::numeric ELSE NULL END;
    v_allowed_to_num := CASE WHEN v_allowed_to_txt IS NOT NULL THEN v_allowed_to_txt::numeric ELSE NULL END;
    IF v_allowed_from_num IS NOT NULL AND v_allowed_to_num IS NOT NULL AND v_allowed_from_num > v_allowed_to_num THEN
      v_tmp_num := v_allowed_from_num;
      v_allowed_from_num := v_allowed_to_num;
      v_allowed_to_num := v_tmp_num;
    END IF;
  END IF;

  PERFORM 1
  FROM public.exams e
  WHERE e.id = p_exam_id;
  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('success', false, 'cleared', 0, 'reason', 'Exam not found');
  END IF;

  SELECT true, NULLIF(BTRIM(st.exam_roll), ''), r.class_name
  INTO v_found, v_exam_roll, v_registration_class
  FROM public.registrations r
  LEFT JOIN public.students st
    ON st.id = r.student_id
    AND st.session_id = r.session_id
  WHERE r.id = p_registration_id
    AND r.exam_id = p_exam_id
    AND (v_exclude_institution_id IS NULL OR r.institution_id IS DISTINCT FROM v_exclude_institution_id);

  IF NOT COALESCE(v_found, false) THEN
    RETURN JSONB_BUILD_OBJECT(
      'success', false,
      'cleared', 0,
      'reason', 'Registration not found, not approved, not in this exam, or your own institution (marked by another institution)'
    );
  END IF;

  IF jsonb_array_length(v_allowed_ranges) > 0 THEN
    IF v_exam_roll IS NULL
      OR v_exam_roll !~ '^[0-9]+$'
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_allowed_ranges) rng
        WHERE (
          rng->>'classId' IS NULL
          OR btrim(COALESCE(rng->>'classId', '')) = ''
          OR rng->>'classId' = v_registration_class
          OR rng->>'className' = v_registration_class
        )
        AND (
          NULLIF(regexp_replace(COALESCE(rng->>'from', ''), '\D', '', 'g'), '') IS NULL
          OR v_exam_roll::numeric >= (regexp_replace(COALESCE(rng->>'from', ''), '\D', '', 'g'))::numeric
        )
        AND (
          NULLIF(regexp_replace(COALESCE(rng->>'to', ''), '\D', '', 'g'), '') IS NULL
          OR v_exam_roll::numeric <= (regexp_replace(COALESCE(rng->>'to', ''), '\D', '', 'g'))::numeric
        )
      ) THEN
      RETURN JSONB_BUILD_OBJECT(
        'success', false,
        'cleared', 0,
        'reason', FORMAT(
          'Exam roll %s is outside your institution''s configured permitted roll ranges',
          COALESCE(v_exam_roll, 'unassigned')
        )
      );
    END IF;
  ELSIF v_allowed_from_num IS NOT NULL OR v_allowed_to_num IS NOT NULL THEN
    IF v_exam_roll IS NULL
      OR v_exam_roll !~ '^[0-9]+$'
      OR (v_allowed_from_num IS NOT NULL AND v_exam_roll::numeric < v_allowed_from_num)
      OR (v_allowed_to_num IS NOT NULL AND v_exam_roll::numeric > v_allowed_to_num) THEN
      RETURN JSONB_BUILD_OBJECT(
        'success', false,
        'cleared', 0,
        'reason', FORMAT(
          'Exam roll %s is outside your institution''s permitted mark entry range (%s to %s)',
          COALESCE(v_exam_roll, 'unassigned'),
          COALESCE(v_allowed_from_txt, 'start'),
          COALESCE(v_allowed_to_txt, 'end')
        )
      );
    END IF;
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

-- =====================================================================
-- 4. get_marks_sheet_page — require permission + intersect roll range
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_marks_sheet_page(
  p_exam_id UUID,
  p_class_id UUID,
  p_institution_id UUID,
  p_subject_id TEXT,
  p_search TEXT,
  p_page INTEGER,
  p_page_size INTEGER,
  p_roll_from TEXT DEFAULT NULL,
  p_roll_to TEXT DEFAULT NULL
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
  v_institution_id UUID;
  v_exclude_institution_id UUID;
  v_allow_mark_entry BOOLEAN;
  v_allowed_ranges JSONB := '[]'::jsonb;
  v_allowed_from_txt TEXT;
  v_allowed_to_txt TEXT;
  v_allowed_from_num NUMERIC;
  v_allowed_to_num NUMERIC;
  v_req_from_txt TEXT;
  v_req_to_txt TEXT;
  v_req_from_num NUMERIC;
  v_req_to_num NUMERIC;
  v_tmp_num NUMERIC;
  v_roll_from_num NUMERIC;
  v_roll_to_num NUMERIC;
BEGIN
  IF public.is_super_admin() THEN
    v_institution_id := p_institution_id;
    v_exclude_institution_id := NULL;
    v_allowed_from_num := NULL;
    v_allowed_to_num := NULL;
  ELSE
    v_institution_id := NULL;
    v_exclude_institution_id := public.get_user_institution_id();
    IF v_exclude_institution_id IS NULL THEN
      RAISE EXCEPTION 'Only a super admin or institution staff may view the marks sheet';
    END IF;

    SELECT i.allow_mark_entry, i.mark_entry_roll_from, i.mark_entry_roll_to, COALESCE(i.mark_entry_roll_ranges, '[]'::jsonb)
    INTO v_allow_mark_entry, v_allowed_from_txt, v_allowed_to_txt, v_allowed_ranges
    FROM public.institutions i
    WHERE i.id = v_exclude_institution_id;

    IF NOT FOUND OR NOT COALESCE(v_allow_mark_entry, false) THEN
      RAISE EXCEPTION 'Mark entry permission is not enabled for your institution';
    END IF;

    v_allowed_from_txt := NULLIF(regexp_replace(COALESCE(v_allowed_from_txt, ''), '\D', '', 'g'), '');
    v_allowed_to_txt := NULLIF(regexp_replace(COALESCE(v_allowed_to_txt, ''), '\D', '', 'g'), '');
    v_allowed_from_num := CASE WHEN v_allowed_from_txt IS NOT NULL THEN v_allowed_from_txt::numeric ELSE NULL END;
    v_allowed_to_num := CASE WHEN v_allowed_to_txt IS NOT NULL THEN v_allowed_to_txt::numeric ELSE NULL END;
    IF v_allowed_from_num IS NOT NULL AND v_allowed_to_num IS NOT NULL AND v_allowed_from_num > v_allowed_to_num THEN
      v_tmp_num := v_allowed_from_num;
      v_allowed_from_num := v_allowed_to_num;
      v_allowed_to_num := v_tmp_num;
    END IF;
  END IF;

  -- Normalise caller's requested roll filter independently (from <= to), then
  -- intersect cleanly with the institution's permitted roll bounds.
  v_req_from_txt := NULLIF(regexp_replace(COALESCE(p_roll_from, ''), '\D', '', 'g'), '');
  v_req_to_txt := NULLIF(regexp_replace(COALESCE(p_roll_to, ''), '\D', '', 'g'), '');
  v_req_from_num := CASE WHEN v_req_from_txt IS NOT NULL THEN v_req_from_txt::numeric ELSE NULL END;
  v_req_to_num := CASE WHEN v_req_to_txt IS NOT NULL THEN v_req_to_txt::numeric ELSE NULL END;
  IF v_req_from_num IS NOT NULL AND v_req_to_num IS NOT NULL AND v_req_from_num > v_req_to_num THEN
    v_tmp_num := v_req_from_num;
    v_req_from_num := v_req_to_num;
    v_req_to_num := v_tmp_num;
  END IF;

  v_roll_from_num := CASE
    WHEN v_allowed_from_num IS NOT NULL AND v_req_from_num IS NOT NULL THEN GREATEST(v_allowed_from_num, v_req_from_num)
    ELSE COALESCE(v_allowed_from_num, v_req_from_num)
  END;
  v_roll_to_num := CASE
    WHEN v_allowed_to_num IS NOT NULL AND v_req_to_num IS NOT NULL THEN LEAST(v_allowed_to_num, v_req_to_num)
    ELSE COALESCE(v_allowed_to_num, v_req_to_num)
  END;

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
      CASE WHEN v_exclude_institution_id IS NULL THEN r.institution_name ELSE NULL END AS institution_name,
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
      AND (v_institution_id IS NULL OR r.institution_id = v_institution_id)
      AND (v_exclude_institution_id IS NULL OR r.institution_id IS DISTINCT FROM v_exclude_institution_id)
      AND (
        (v_roll_from_num IS NULL AND v_roll_to_num IS NULL)
        OR (
          s.exam_roll ~ '^[0-9]+$'
          AND (v_roll_from_num IS NULL OR s.exam_roll::numeric >= v_roll_from_num)
          AND (v_roll_to_num IS NULL OR s.exam_roll::numeric <= v_roll_to_num)
        )
      )
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
      CASE WHEN v_exclude_institution_id IS NULL THEN r.institution_name ELSE NULL END AS institution_name,
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
      AND (v_institution_id IS NULL OR r.institution_id = v_institution_id)
      AND (v_exclude_institution_id IS NULL OR r.institution_id IS DISTINCT FROM v_exclude_institution_id)
      AND (
        (v_roll_from_num IS NULL AND v_roll_to_num IS NULL)
        OR (
          s.exam_roll ~ '^[0-9]+$'
          AND (v_roll_from_num IS NULL OR s.exam_roll::numeric >= v_roll_from_num)
          AND (v_roll_to_num IS NULL OR s.exam_roll::numeric <= v_roll_to_num)
        )
      )
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
      CASE WHEN v_exclude_institution_id IS NULL THEN r.institution_name ELSE NULL END AS institution_name,
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
      AND (v_institution_id IS NULL OR r.institution_id = v_institution_id)
      AND (v_exclude_institution_id IS NULL OR r.institution_id IS DISTINCT FROM v_exclude_institution_id)
      AND (
        (v_roll_from_num IS NULL AND v_roll_to_num IS NULL)
        OR (
          s.exam_roll ~ '^[0-9]+$'
          AND (v_roll_from_num IS NULL OR s.exam_roll::numeric >= v_roll_from_num)
          AND (v_roll_to_num IS NULL OR s.exam_roll::numeric <= v_roll_to_num)
        )
      )
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
        'institution_id', CASE WHEN v_exclude_institution_id IS NULL THEN institution_id ELSE NULL END,
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

REVOKE ALL ON FUNCTION public.save_exam_marks(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_exam_marks(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.save_exam_marks(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_exam_mark(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marks_sheet_page(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
