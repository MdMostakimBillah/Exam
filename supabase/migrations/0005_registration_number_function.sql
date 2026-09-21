-- Create a function to get the next global registration number
-- This function uses SECURITY DEFINER to bypass RLS and work across all institutions
-- Format: YYYYNNNNNN (e.g., 2026000001, 2026000002, ...)

CREATE OR REPLACE FUNCTION get_next_registration_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  max_num BIGINT;
  next_num BIGINT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the max sequential number for the current year across ALL institutions
  -- Using SECURITY DEFINER bypasses RLS
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(registration_number FROM 5 FOR 6) AS BIGINT)),
    0
  ) INTO max_num
  FROM registrations
  WHERE registration_number LIKE current_year || '%'
    AND LENGTH(registration_number) = 10;
  
  next_num := max_num + 1;
  
  RETURN current_year || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_registration_number() TO authenticated;
