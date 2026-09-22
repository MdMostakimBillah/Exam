-- =====================================================
-- 0008: Notification click-to-redirect + cross-user creation
-- =====================================================
-- Adds a nullable `link` column (target route) and two
-- SECURITY DEFINER functions so any signed-in user can
-- create notifications for themselves / for super-admins.
-- RLS only allows user_id = auth.uid(), hence the functions.
--
-- IDEMPOTENT: safe to run multiple times in the
-- Supabase SQL Editor.
-- =====================================================

-- 1) Link column ------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- 2) Create a notification for a specific user -------------------
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, read, link)
  VALUES (p_user_id, p_title, p_message, p_type, false, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 3) Create a notification for every super-admin ------------------
CREATE OR REPLACE FUNCTION create_notification_for_super_admins(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_profile RECORD;
BEGIN
  FOR v_profile IN SELECT id FROM profiles WHERE lower(role) = 'super_admin' LOOP
    INSERT INTO notifications (user_id, title, message, type, read, link)
    VALUES (v_profile.id, p_title, p_message, p_type, false, p_link);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_for_super_admins(TEXT, TEXT, TEXT, TEXT) TO authenticated;
