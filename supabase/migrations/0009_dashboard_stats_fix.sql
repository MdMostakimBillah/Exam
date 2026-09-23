-- =====================================================
-- 0009: Dashboard stats fix (idempotent)
-- =====================================================
-- Corrects get_dashboard_stats() from 0001:
--
--  * payments_due now matches the app's due rule
--      (see computeDue in src/lib/storage/payments.ts):
--        GREATEST(SUM(registration.payment_amount)
--                 - SUM(PAID payments), 0)
--    old (wrong): SUM(amount) of PENDING payments
--
--  * registrations_pending now counts the real approval queue:
--      status NOT IN ('APPROVED','VERIFIED','REJECTED')
--      i.e. PENDING + PAYMENT_PENDING
--    old (wrong): only status = 'PENDING'
--
-- ORDER: run 0001 first if you never ran it (this replaces its
-- function — running 0001 AFTER this would revert the fix).
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'institutions_total', (SELECT count(*) FROM institutions),
    'institutions_pending', (SELECT count(*) FROM institutions WHERE status = 'PENDING'),
    'students_total', (SELECT count(*) FROM students),
    'exams_active', (SELECT count(*) FROM exams WHERE status IN ('OPEN', 'PUBLISHED')),
    'registrations_total', (SELECT count(*) FROM registrations),
    'registrations_pending', (SELECT count(*) FROM registrations
                               WHERE status NOT IN ('APPROVED', 'VERIFIED', 'REJECTED')),
    'registrations_verified_approved', (SELECT count(*) FROM registrations WHERE status IN ('VERIFIED', 'APPROVED')),
    'registrations_approved', (SELECT count(*) FROM registrations WHERE status = 'APPROVED'),
    'results_total', (SELECT count(*) FROM results),
    'payments_total', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PAID'),
    'payments_due', GREATEST(
      (SELECT coalesce(sum(payment_amount), 0) FROM registrations)
      - (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PAID'),
      0
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
