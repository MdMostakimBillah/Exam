-- ============================================================
-- 0022 — Institution principal signature (admit-card footer)
-- ============================================================
-- The super-admin's MD signature lives in system_settings (branding);
-- each institution uploads its own principal signature from
-- Settings → Profile. Stored on the institution row so super-admin
-- admit-card generation reads it with the rest of the card data.
--
-- The image goes to the public bucket's institution-signatures/ folder
-- (same pattern as branding/ in 0018): public READ, INSERT only for
-- signed-in staff / institution admins / super admins.
--
-- Idempotent: safe to run repeatedly.
-- ============================================================

-- 1) Column: signature image URL on the institution row.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS principal_signature_url TEXT;

COMMENT ON COLUMN public.institutions.principal_signature_url IS
  'Public URL of the principal''s signature image (public bucket, institution-signatures/…) shown on admit cards.';

-- 2) Make sure the bucket exists (public URL reads).
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Signed-in staff may upload a principal signature.
DROP POLICY IF EXISTS "Staff upload principal signatures" ON storage.objects;
CREATE POLICY "Staff upload principal signatures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'institution-signatures'
    AND COALESCE(
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
      ''
    ) IN ('super_admin', 'institution_admin', 'staff')
  );

-- ============================================================
-- Verification (run afterwards):
--   * ALTER + policy are idempotent — re-running changes nothing.
--   * Settings → Profile → upload signature  -> 200 from Storage.
--   * REST read of institutions.principal_signature_url as
--     super admin / institution admin  -> column present.
-- ============================================================
