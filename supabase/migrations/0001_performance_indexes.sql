-- ============================================
-- ScholarX Performance Optimization Migration
-- ============================================
-- Adds missing indexes and dashboard stats function
-- Run AFTER schema.sql and fix-rls.sql
-- ============================================

-- ============================================
-- 1. DATABASE INDEXES (B.2 Index Summary)
-- ============================================

-- Enable pg_trgm for trigram search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Covering index for session-scoped student queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_students_session_created ON students(session_id, created_at DESC);

-- Results indexes
CREATE INDEX IF NOT EXISTS idx_results_session_created ON results(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_exam_session ON results(exam_id, session_id);
CREATE INDEX IF NOT EXISTS idx_results_institution_session ON results(institution_id, session_id);

-- Trigram index for fuzzy search on registration student names
CREATE INDEX IF NOT EXISTS idx_registrations_student_name_trgm ON registrations USING gin(student_name gin_trgm_ops);

-- Audit log indexes (B.1 #6)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- Status filter indexes (B.2)
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(status, date DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);

-- Additional covering index for students list with institution filter
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- ============================================
-- 2. DASHBOARD STATS AGGREGATE FUNCTION (B.1 #4)
-- ============================================
-- Reduces 6 separate roundtrips to 1 function call on super-admin dashboard

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'institutions', (SELECT count(*) FROM institutions),
    'students', (SELECT count(*) FROM students),
    'exams', (SELECT count(*) FROM exams WHERE status IN ('OPEN', 'PUBLISHED')),
    'results', (SELECT count(*) FROM results),
    'payments_total', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PAID'),
    'payments_due', (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'PENDING'),
    'registrations', (SELECT count(*) FROM registrations)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- ============================================
-- 3. REGISTRATION COUNT BY EXAM (B.1 #3)
-- ============================================
-- Server-side count for exam registration counts, avoids full fetch + client-side count

CREATE OR REPLACE FUNCTION get_exam_registration_counts(p_session_id UUID)
RETURNS TABLE(exam_id UUID, registration_count BIGINT) AS $$
BEGIN
  RETURN QUERY
    SELECT r.exam_id, count(*)::BIGINT
    FROM registrations r
    WHERE r.session_id = p_session_id
    GROUP BY r.exam_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_exam_registration_counts(UUID) TO authenticated;
