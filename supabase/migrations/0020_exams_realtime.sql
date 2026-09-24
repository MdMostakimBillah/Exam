-- 0020: stream exams changes to every connected client (Supabase Realtime)
-- so that when the super admin changes an exam STATUS (DRAFT → OPEN →
-- CLOSED → …) every institution's open dashboard/registrations page shows it
-- immediately, instead of waiting for its next refetch.
--
-- `postgres_changes` events respect RLS: only clients that can SELECT the
-- row receive it — institution admins already have "Authenticated read exams".
--
-- Run this in the Supabase SQL editor. Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'exams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;
  END IF;
END $$;
