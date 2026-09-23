-- =====================================================
-- 0015: Exam routine (day-by-day schedule)
-- =====================================================
-- The super admin schedules each class's subjects to days
-- inside the exam window (exams.exam_start_date ->
-- exams.exam_end_date). One JSONB array on the exam, same
-- pattern as exams.subjects:
--
--   [ { id, classId, subjectId, subjectName,
--       date: 'YYYY-MM-DD', startTime: 'HH:MM',
--       endTime: 'HH:MM' }, ... ]
--
-- The admit-card page is built FROM this routine: a card
-- shows the subject/day table for the student's class.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

ALTER TABLE exams ADD COLUMN IF NOT EXISTS routine JSONB DEFAULT '[]';
