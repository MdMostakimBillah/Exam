-- =====================================================================
-- 0044 — Multiple Roll Ranges per Institution & Class-based Auto-Fill
-- =====================================================================
--
-- Adds mark_entry_roll_ranges (JSONB) to public.institutions allowing Super Admin
-- to configure multiple roll ranges per class (or general).
-- Automatically enforces these ranges in save_exam_marks and clear_exam_mark.

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS mark_entry_roll_ranges JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Trigger update to protect mark_entry_roll_ranges from non-super-admins
CREATE OR REPLACE FUNCTION public.protect_mark_entry_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TEXT;
  v_to TEXT;
  v_tmp TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.allow_mark_entry := false;
      NEW.mark_entry_roll_from := NULL;
      NEW.mark_entry_roll_to := NULL;
      NEW.mark_entry_roll_ranges := '[]'::jsonb;
    ELSE
      NEW.allow_mark_entry := OLD.allow_mark_entry;
      NEW.mark_entry_roll_from := OLD.mark_entry_roll_from;
      NEW.mark_entry_roll_to := OLD.mark_entry_roll_to;
      NEW.mark_entry_roll_ranges := COALESCE(OLD.mark_entry_roll_ranges, '[]'::jsonb);
    END IF;
  END IF;

  v_from := NULLIF(regexp_replace(COALESCE(NEW.mark_entry_roll_from, ''), '\D', '', 'g'), '');
  v_to := NULLIF(regexp_replace(COALESCE(NEW.mark_entry_roll_to, ''), '\D', '', 'g'), '');
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_from::numeric > v_to::numeric THEN
    v_tmp := v_from;
    v_from := v_to;
    v_to := v_tmp;
  END IF;
  NEW.mark_entry_roll_from := v_from;
  NEW.mark_entry_roll_to := v_to;
  IF NEW.mark_entry_roll_ranges IS NULL OR jsonb_typeof(NEW.mark_entry_roll_ranges) <> 'array' THEN
    NEW.mark_entry_roll_ranges := '[]'::jsonb;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_mark_entry_permission ON public.institutions;
CREATE TRIGGER protect_mark_entry_permission
  BEFORE INSERT OR UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_mark_entry_permission();
