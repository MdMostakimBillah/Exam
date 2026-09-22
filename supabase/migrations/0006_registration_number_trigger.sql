-- ============================================================
-- Global registration number: authoritative DB-side assignment
-- Format: YYYYNNNNNN (e.g., 2026000001) — global across ALL institutions.
-- Idempotent: safe to run multiple times in Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ensure the RPC the app calls exists (re-runnable)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_registration_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  max_num      BIGINT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Max sequential number for the current year across ALL institutions.
  -- SECURITY DEFINER + owner = table owner => bypasses RLS.
  SELECT COALESCE(
           MAX(CAST(SUBSTRING(registration_number FROM 5 FOR 6) AS BIGINT)),
           0
         )
    INTO max_num
    FROM registrations
   WHERE registration_number LIKE current_year || '%'
     AND LENGTH(registration_number) = 10;

  RETURN current_year || LPAD((max_num + 1)::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_registration_number() TO authenticated;

-- ------------------------------------------------------------
-- 2. BEFORE INSERT trigger: assign a unique global number.
--    Authoritative — runs regardless of what the client sends.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_registration_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  max_num      BIGINT;
BEGIN
  -- Serialize concurrent inserts (lock held until end of transaction),
  -- so two institutions can never compute the same number.
  PERFORM pg_advisory_xact_lock(724001);

  -- Only assign when the incoming number is missing or already taken.
  -- This preserves intentionally-set numbers (e.g. seed data) while
  -- guaranteeing NO duplicates across any institution (bypasses RLS).
  IF NEW.registration_number IS NULL
     OR NEW.registration_number = ''
     OR EXISTS (
          SELECT 1
            FROM registrations r
           WHERE r.registration_number = NEW.registration_number
        )
  THEN
    current_year := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(
             MAX(CAST(SUBSTRING(registration_number FROM 5 FOR 6) AS BIGINT)),
             0
           )
      INTO max_num
      FROM registrations
     WHERE registration_number LIKE current_year || '%'
       AND LENGTH(registration_number) = 10;

    NEW.registration_number := current_year || LPAD((max_num + 1)::TEXT, 6, '0');

    -- Keep application_id in sync when the client did not provide one.
    IF NEW.application_id IS NULL OR NEW.application_id = '' THEN
      NEW.application_id := NEW.registration_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_registration_number() TO authenticated;

-- ------------------------------------------------------------
-- 3. Attach the trigger (re-runnable)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_assign_registration_number ON registrations;
CREATE TRIGGER trg_assign_registration_number
  BEFORE INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION assign_registration_number();
