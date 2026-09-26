-- 0028 — Align stored student-name copies with the live student record
--
-- WHY
--   registrations, payments, results, certificates and admit_cards each keep
--   their own `student_name`, written once when the row was created. Editing a
--   student on the Students page only updated `students`, so every page reading
--   those tables kept showing the name from registration time (verified in prod:
--   registrations.student_name = 'Abida Anan Sara' while the student is now
--   'Meftahul Islam Medha').
--
-- WHAT THE APP DOES NOW (no SQL required for new edits)
--   * src/lib/storage/students.ts → syncStudentNameCopies() mirrors the new name
--     into all five tables right after a student edit.
--   * src/lib/storage/registrations.ts reads the live name from the joined
--     student row, falling back to the stored copy.
--
-- WHAT THIS MIGRATION DOES
--   One-time repair of rows that went stale before that fix. The `marks` table
--   has no name column (the marks-sheet RPC reads registrations.student_name,
--   which is repaired first below).
--
-- Idempotent — safe to re-run.

UPDATE public.registrations r
SET student_name = btrim(s.first_name || ' ' || coalesce(s.last_name, ''))
FROM public.students s
WHERE s.id = r.student_id
  AND r.student_name IS DISTINCT FROM btrim(s.first_name || ' ' || coalesce(s.last_name, ''));

UPDATE public.payments p
SET student_name = btrim(s.first_name || ' ' || coalesce(s.last_name, ''))
FROM public.students s
WHERE s.id = p.student_id
  AND p.student_name IS DISTINCT FROM btrim(s.first_name || ' ' || coalesce(s.last_name, ''));

UPDATE public.results r
SET student_name = btrim(s.first_name || ' ' || coalesce(s.last_name, ''))
FROM public.students s
WHERE s.id = r.student_id
  AND r.student_name IS DISTINCT FROM btrim(s.first_name || ' ' || coalesce(s.last_name, ''));

UPDATE public.certificates c
SET student_name = btrim(s.first_name || ' ' || coalesce(s.last_name, ''))
FROM public.students s
WHERE s.id = c.student_id
  AND c.student_name IS DISTINCT FROM btrim(s.first_name || ' ' || coalesce(s.last_name, ''));

UPDATE public.admit_cards a
SET student_name = btrim(s.first_name || ' ' || coalesce(s.last_name, ''))
FROM public.students s
WHERE s.id = a.student_id
  AND a.student_name IS DISTINCT FROM btrim(s.first_name || ' ' || coalesce(s.last_name, ''));
