-- ============================================================
-- Institution-level payments: one payment submission covers the
-- institution's whole batch of due student fees (partial allowed).
-- Such rows have no exam_id/exam_name and no registration_id.
-- Idempotent: safe to run multiple times in Supabase SQL Editor.
-- ============================================================

-- 1. Institution-level payments span exams => exam columns become nullable.
ALTER TABLE payments ALTER COLUMN exam_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN exam_name DROP NOT NULL;

-- 2. Guard columns used by the submit-payment form (all may already exist).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Faster due/lookup queries: institution payments within a session.
CREATE INDEX IF NOT EXISTS idx_payments_institution_status
  ON payments(institution_id, session_id, status);
