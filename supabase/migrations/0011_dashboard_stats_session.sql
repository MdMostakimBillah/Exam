-- =====================================================
-- 0011: Session-scoped dashboard stats
-- =====================================================
-- get_dashboard_stats() counted EVERY session, so dashboard
-- numbers never reset when the super-admin switched to a new
-- (empty) session. Replaces it with get_dashboard_stats(p_session_id):
--   - students / exams / registrations / results / payments
--     are filtered to the given session -> a new empty session
--       shows all zeros while previous rows stay untouched
--   - institutions stay global (they are not session entities)
--
-- DROP first: a different argument list would otherwise create
-- an overload and leave the old global version ambiguous.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

DROP FUNCTION IF EXISTS get_dashboard_stats();

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'institutions_total', (SELECT count(*) FROM institutions),
    'institutions_pending', (SELECT count(*) FROM institutions WHERE status = 'PENDING'),
    'students_total', (SELECT count(*) FROM students
                       WHERE session_id = p_session_id),
    'exams_active', (SELECT count(*) FROM exams
                     WHERE session_id = p_session_id AND status IN ('OPEN', 'PUBLISHED')),
    'registrations_total', (SELECT count(*) FROM registrations
                            WHERE session_id = p_session_id),
    'registrations_pending', (SELECT count(*) FROM registrations
                              WHERE session_id = p_session_id
                                AND status NOT IN ('APPROVED', 'VERIFIED', 'REJECTED')),
    'registrations_verified_approved', (SELECT count(*) FROM registrations
                                         WHERE session_id = p_session_id
                                           AND status IN ('VERIFIED', 'APPROVED')),
    'registrations_approved', (SELECT count(*) FROM registrations
                               WHERE session_id = p_session_id AND status = 'APPROVED'),
    'results_total', (SELECT count(*) FROM results
                      WHERE session_id = p_session_id),
    'payments_total', (SELECT coalesce(sum(amount), 0) FROM payments
                       WHERE session_id = p_session_id AND status = 'PAID'),
    'payments_due', GREATEST(
      (SELECT coalesce(sum(payment_amount), 0) FROM registrations
       WHERE session_id = p_session_id)
      - (SELECT coalesce(sum(amount), 0) FROM payments
         WHERE session_id = p_session_id AND status = 'PAID'),
      0
    )
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID) TO authenticated;
