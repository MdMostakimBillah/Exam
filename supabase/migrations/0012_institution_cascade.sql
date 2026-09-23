-- =====================================================
-- 0012: Institution hard delete — cascade everything
-- =====================================================
-- When the super admin deletes an institution, ALL of its
-- data must go with it, across every session:
--   marks, admit_cards, certificates, results,
--   registrations, payments, exam_centers, students,
--   notifications (its users), profiles (admin + staff),
--   institutions.
--
-- Storage images (logo / payment proofs / student photos)
-- and auth login accounts are removed by the server action
-- that calls this function — they cannot be reached from SQL.
--
-- Properties:
--   * ONE transaction — if anything fails, NOTHING is deleted.
--   * SECURITY DEFINER — runs as the function owner so table
--     RLS cannot stop the wipe.
--   * Only a SUPER ADMIN can execute it (role check inside,
--     using auth.uid() — the server action must call it with
--     the user's own JWT, not the service-role key).
--   * Returns per-table deleted row counts as JSON.
--   * Idempotent — safe to run multiple times.
--
-- Delete order respects FK direction:
--   children of institutions first, then notifications
--   (child of profiles), then the institution row, and
--   profiles last (institution.admin_user_id may reference
--   profiles, and profiles.institution_id references the
--   institution — cycle broken by removing the institution
--   before its profiles).
-- =====================================================

CREATE OR REPLACE FUNCTION delete_institution_cascade(p_institution_id UUID)
RETURNS JSON AS $$
DECLARE
  v_student_ids UUID[];
  v_reg_ids UUID[];
  v_user_ids UUID[];
  v_admin_ids UUID[];
  v_counts json;
  c_marks int; c_admit int; c_certs int; c_results int;
  c_regs int; c_payments int; c_centers int; c_students int;
  c_notifs int; c_inst int; c_profiles int;
BEGIN
  -- Only a super admin may wipe an institution
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND lower(role) = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only a super admin can delete an institution';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM institutions WHERE id = p_institution_id) THEN
    RAISE EXCEPTION 'Institution % not found', p_institution_id;
  END IF;

  -- Collect child ids first: marks/admit_cards carry no institution_id
  SELECT coalesce(array_agg(id), '{}') INTO v_student_ids
  FROM students WHERE institution_id = p_institution_id;

  SELECT coalesce(array_agg(id), '{}') INTO v_reg_ids
  FROM registrations WHERE institution_id = p_institution_id;

  SELECT coalesce(array_agg(id), '{}') INTO v_user_ids
  FROM profiles WHERE institution_id = p_institution_id;

  SELECT coalesce(array_agg(admin_user_id), '{}') INTO v_admin_ids
  FROM institutions
  WHERE id = p_institution_id AND admin_user_id IS NOT NULL;

  v_user_ids := coalesce(
    (SELECT array_agg(DISTINCT x)
     FROM unnest(v_user_ids || v_admin_ids) x
     WHERE x IS NOT NULL),
    '{}'
  );

  -- ---- children of institutions ----
  DELETE FROM marks
  WHERE student_id = ANY(v_student_ids) OR registration_id = ANY(v_reg_ids);
  GET DIAGNOSTICS c_marks = ROW_COUNT;

  DELETE FROM admit_cards
  WHERE student_id = ANY(v_student_ids) OR registration_id = ANY(v_reg_ids);
  GET DIAGNOSTICS c_admit = ROW_COUNT;

  DELETE FROM certificates WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_certs = ROW_COUNT;

  DELETE FROM results WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_results = ROW_COUNT;

  DELETE FROM registrations WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_regs = ROW_COUNT;

  DELETE FROM payments WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_payments = ROW_COUNT;

  DELETE FROM exam_centers WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_centers = ROW_COUNT;

  DELETE FROM students WHERE institution_id = p_institution_id;
  GET DIAGNOSTICS c_students = ROW_COUNT;

  -- ---- children of the institution's users ----
  DELETE FROM notifications WHERE user_id = ANY(v_user_ids);
  GET DIAGNOSTICS c_notifs = ROW_COUNT;

  -- ---- the institution row (before profiles: admin_user_id may
  --      reference profiles, and profiles reference the institution) ----
  DELETE FROM institutions WHERE id = p_institution_id;
  GET DIAGNOSTICS c_inst = ROW_COUNT;

  DELETE FROM profiles
  WHERE institution_id = p_institution_id OR id = ANY(v_user_ids);
  GET DIAGNOSTICS c_profiles = ROW_COUNT;

  SELECT json_build_object(
    'marks', c_marks,
    'admit_cards', c_admit,
    'certificates', c_certs,
    'results', c_results,
    'registrations', c_regs,
    'payments', c_payments,
    'exam_centers', c_centers,
    'students', c_students,
    'notifications', c_notifs,
    'institutions', c_inst,
    'profiles', c_profiles
  ) INTO v_counts;

  RETURN v_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION delete_institution_cascade(UUID) TO authenticated;
