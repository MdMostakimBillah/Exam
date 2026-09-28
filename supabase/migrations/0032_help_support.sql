-- =====================================================
-- 0032: Help & Support — problem reports from institutions
-- =====================================================
-- The public /help page shows a hotline number that ONLY the
-- super admin can set (system_settings, category "helpdesk"),
-- and lets a signed-in institution report a website/functional
-- problem. Those reports land in support_reports, which only
-- the super admin can read (the reporter can read their own).
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) support_reports
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Set from auth.uid() by the app; NULL only if the reporter's
  -- account is later deleted (report is kept for the record).
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  -- Denormalised so the super admin's inbox stays readable even
  -- without joining (and after the institution row changes).
  institution_name TEXT,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT,
  reporter_phone TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('login','registration','payment','exam','results','certificates','other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved')),
  -- Super admin's reply / internal note, shown back to the reporter.
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_reports_created_at_idx
  ON public.support_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS support_reports_status_idx
  ON public.support_reports (status);
CREATE INDEX IF NOT EXISTS support_reports_user_id_idx
  ON public.support_reports (user_id);

-- ------------------------------------------------------------
-- 2) Data API grants
--    (PostgREST does not see table privileges for NEW tables
--     unless they are granted explicitly — same as 0016.)
-- ------------------------------------------------------------
GRANT SELECT ON public.support_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_reports TO service_role;

-- ------------------------------------------------------------
-- 3) RLS
-- ------------------------------------------------------------
ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;

-- Super admin: everything (list all, change status, reply, delete).
DROP POLICY IF EXISTS "Super admin full access support_reports" ON public.support_reports;
CREATE POLICY "Super admin full access support_reports" ON public.support_reports
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Reporter: may only add a report for themselves …
DROP POLICY IF EXISTS "Authenticated insert own support_reports" ON public.support_reports;
CREATE POLICY "Authenticated insert own support_reports" ON public.support_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- … and read back only their own (status + admin reply).
DROP POLICY IF EXISTS "Authenticated read own support_reports" ON public.support_reports;
CREATE POLICY "Authenticated read own support_reports" ON public.support_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4) Help desk contact shown on /help (super admin editable)
--    Seeded empty so the settings form always finds a row;
--    upserts from the app are keyed on `key`.
-- ------------------------------------------------------------
INSERT INTO public.system_settings (key, value, category) VALUES
  ('helpdeskPhone', '', 'helpdesk'),
  ('helpdeskEmail', '', 'helpdesk'),
  ('helpdeskHours', '', 'helpdesk')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Verify: expect 3 policies on support_reports and 3 helpdesk keys.
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'support_reports'
ORDER BY policyname;

SELECT key, value, category FROM public.system_settings
WHERE category = 'helpdesk' ORDER BY key;
