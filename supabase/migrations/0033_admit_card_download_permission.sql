-- 0033 — per-institution admit card DOWNLOAD permission
--
-- WHY
--   Admit cards live only on the super-admin page today. Every institution
--   must be able to download the cards of ITS OWN students — but only after
--   the super admin grants the permission on Institutions → [institution] →
--   Permissions. Until then the institution's Admit Cards page shows the
--   "permission required" panel and RLS returns no rows at all.
--
-- WHAT
--   1. admit_cards.institution_id — scope column, backfilled from the
--      registration so "this institution's cards" is one indexed equality
--      instead of a join; the generate flow writes it from now on.
--   2. institutions.allow_admit_card_download — the permission, OFF by
--      default. Institution admins hold an "update own institution" policy,
--      so a trigger stops them from granting it to themselves.
--   3. RLS — the institution's admit_cards policy now requires BOTH own
--      rows AND the flag.
--
-- Idempotent: safe to run more than once in the Supabase SQL Editor.

-- ── 1. Scope column ───────────────────────────────────────────────────
ALTER TABLE public.admit_cards
  ADD COLUMN IF NOT EXISTS institution_id UUID
  REFERENCES public.institutions(id) ON DELETE CASCADE;

UPDATE public.admit_cards a
SET institution_id = r.institution_id
FROM public.registrations r
WHERE r.id = a.registration_id
  AND a.institution_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_admit_cards_institution
  ON public.admit_cards(institution_id);

-- ── 2. Permission flag ────────────────────────────────────────────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS allow_admit_card_download BOOLEAN NOT NULL DEFAULT false;

-- Only a super admin may flip it. (Without this, an institution admin
-- could set the flag through their own "update institution" policy.)
-- auth.uid() IS NULL → service-role/system writes are left alone.
CREATE OR REPLACE FUNCTION public.protect_admit_card_permission()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    NEW.allow_admit_card_download := OLD.allow_admit_card_download;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_admit_card_permission ON public.institutions;
CREATE TRIGGER protect_admit_card_permission
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admit_card_permission();

-- ── 3. RLS — own cards, permission on ─────────────────────────────────
DROP POLICY IF EXISTS "Institution admin own admit_cards" ON public.admit_cards;

CREATE POLICY "Institution admin own admit_cards" ON public.admit_cards
  FOR ALL USING (
    (
      public.admit_cards.institution_id = public.get_user_institution_id()
      OR EXISTS (
        SELECT 1 FROM public.registrations r
        WHERE r.id = public.admit_cards.registration_id
          AND r.institution_id = public.get_user_institution_id()
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = public.get_user_institution_id()
        AND i.allow_admit_card_download = true
    )
  );
