-- Migration 0041: Add gender support to generate_class_exam_rolls
-- Allows generating exam rolls for a class filtered by gender (e.g. MALE, then FEMALE),
-- continuing sequentially from the maximum existing sequence for that class prefix.

DROP FUNCTION IF EXISTS generate_class_exam_rolls(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_class_exam_rolls(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION generate_class_exam_rolls(
  p_session_id UUID,
  p_class TEXT,
  p_gender TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_n INT;
  v_prefix TEXT;
  v_total INT;
  v_already INT;
  v_max INT := 0;
  v_assigned INT := 0;
  v_start TEXT := NULL;
  v_end TEXT := NULL;
  v_seq INT;
  rec RECORD;
  v_clean_gender TEXT := NULL;
BEGIN
  -- Only a super admin may generate roll numbers
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND lower(role) = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only a super admin can generate roll numbers';
  END IF;

  IF p_session_id IS NULL OR p_class IS NULL OR btrim(p_class) = '' THEN
    RAISE EXCEPTION 'Session and class are required';
  END IF;

  IF p_gender IS NOT NULL AND btrim(p_gender) <> '' AND upper(btrim(p_gender)) <> 'ALL' THEN
    v_clean_gender := upper(btrim(p_gender));
  END IF;

  -- Resolve the class number from the label. Class names are free-form:
  --   1) digits, including Bangla digits ('Class 5' / '5' / 'শ্রেণী ৫' -> 5)
  --   2) English number words ('Five' / 'Class Five' / 'Fifth' -> 5)
  --   3) Bangla number words ('পাঁচ' / 'পঞ্চম' -> 5)
  --   4) classes table lookup by name -> digits in code ('CLS-05' -> 5)
  v_n := substring(translate(p_class, '০১২৩৪৫৬৭৮৯', '0123456789') FROM '\d+')::INT;

  IF v_n IS NULL THEN
    v_n := CASE lower(substring(lower(p_class)
             from '\y(one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\y'))
      WHEN 'one' THEN 1    WHEN 'first' THEN 1
      WHEN 'two' THEN 2    WHEN 'second' THEN 2
      WHEN 'three' THEN 3  WHEN 'third' THEN 3
      WHEN 'four' THEN 4   WHEN 'fourth' THEN 4
      WHEN 'five' THEN 5   WHEN 'fifth' THEN 5
      WHEN 'six' THEN 6    WHEN 'sixth' THEN 6
      WHEN 'seven' THEN 7  WHEN 'seventh' THEN 7
      WHEN 'eight' THEN 8  WHEN 'eighth' THEN 8
      WHEN 'nine' THEN 9   WHEN 'ninth' THEN 9
      WHEN 'ten' THEN 10   WHEN 'tenth' THEN 10
    END;
  END IF;

  IF v_n IS NULL THEN
    v_n := CASE substring(p_class from '(এক|দুই|তিন|চার|পঞ্চম|পাঁচ|ছয়|সাত|আট|নয়|দশ)')
      WHEN 'এক' THEN 1    WHEN 'দুই' THEN 2
      WHEN 'তিন' THEN 3   WHEN 'চার' THEN 4
      WHEN 'পঞ্চম' THEN 5 WHEN 'পাঁচ' THEN 5
      WHEN 'ছয়' THEN 6   WHEN 'সাত' THEN 7
      WHEN 'আট' THEN 8    WHEN 'নয়' THEN 9
      WHEN 'দশ' THEN 10
    END;
  END IF;

  IF v_n IS NULL THEN
    SELECT substring(c.code FROM '\d+')::INT
      INTO v_n
      FROM classes c
     WHERE lower(btrim(c.name)) = lower(btrim(p_class))
       AND c.code ~ '\d'
     LIMIT 1;
  END IF;

  IF v_n IS NULL THEN
    RAISE EXCEPTION 'Cannot determine a class number from "%"', p_class;
  END IF;

  IF v_n BETWEEN 1 AND 9 THEN
    v_prefix := v_n::TEXT || v_n::TEXT;   -- 1 -> '11', 2 -> '22', ... 9 -> '99'
  ELSIF v_n = 10 THEN
    v_prefix := '10';                     -- 10 -> '10'
  ELSE
    RAISE EXCEPTION 'Roll prefixes support Class 1-10 only (got "%")', p_class;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE exam_roll IS NOT NULL AND exam_roll <> '')
    INTO v_total, v_already
    FROM students
   WHERE session_id = p_session_id
     AND class = p_class
     AND (v_clean_gender IS NULL OR upper(gender) = v_clean_gender);

  IF v_total = 0 THEN
    IF v_clean_gender IS NOT NULL THEN
      RAISE EXCEPTION 'No % students found for "%" in this session', v_clean_gender, p_class;
    ELSE
      RAISE EXCEPTION 'No students found for "%" in this session', p_class;
    END IF;
  END IF;

  -- Serialize concurrent generation (two admins clicking at once)
  PERFORM pg_advisory_xact_lock(724113);

  -- Continue after the highest roll of this prefix already used in this session across ALL students of this class
  SELECT COALESCE(MAX(substring(exam_roll FROM 3)::INT), 0)
    INTO v_max
    FROM students
   WHERE session_id = p_session_id
     AND exam_roll IS NOT NULL
     AND exam_roll ~ ('^' || v_prefix || '[0-9]{4}$');

  -- ASSIGNMENT ORDER = REGISTRATION ORDER.
  -- Only students without a roll are touched -> re-running is safe.
  FOR rec IN
    SELECT s.id
      FROM students s
      LEFT JOIN LATERAL (
        SELECT MIN(r.created_at) AS first_reg
          FROM registrations r
         WHERE r.student_id = s.id
           AND r.session_id = p_session_id
      ) reg ON TRUE
     WHERE s.session_id = p_session_id
       AND s.class = p_class
       AND (s.exam_roll IS NULL OR s.exam_roll = '')
       AND (v_clean_gender IS NULL OR upper(s.gender) = v_clean_gender)
     ORDER BY (reg.first_reg IS NULL),   -- registered students first
              reg.first_reg NULLS LAST,  -- ... earliest registration first
              s.created_at,              -- unregistered: by creation date
              s.id
  LOOP
    v_seq := v_max + 1;
    IF v_seq > 9999 THEN
      RAISE EXCEPTION 'Roll numbers exhausted for prefix % (9999 max per class)', v_prefix;
    END IF;

    UPDATE students
       SET exam_roll = v_prefix || LPAD(v_seq::TEXT, 4, '0'),
           updated_at = now()
     WHERE id = rec.id;

    IF v_assigned = 0 THEN
      v_start := v_prefix || LPAD(v_seq::TEXT, 4, '0');
    END IF;
    v_end := v_prefix || LPAD(v_seq::TEXT, 4, '0');
    v_max := v_seq;
    v_assigned := v_assigned + 1;
  END LOOP;

  RETURN json_build_object(
    'assigned', v_assigned,
    'already', v_already,
    'total', v_total,
    'prefix', v_prefix,
    'start', v_start,
    'end', v_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION generate_class_exam_rolls(UUID, TEXT, TEXT) TO authenticated;
