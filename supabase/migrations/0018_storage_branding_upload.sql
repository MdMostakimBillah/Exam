-- 0018: allow super-admin branding image uploads (logo / watermark)
--
-- Problem: Settings → Branding → Upload Logo returned HTTP 400 from
-- Supabase Storage. The `public` bucket's INSERT policies only cover the
-- folders payment-proofs / institution-logos / student-photos / certificates.
-- Branding images upload to the `branding/` folder, so Storage RLS denied
-- the insert.
--
-- Idempotent: safe to run repeatedly.

-- 1) Make sure the bucket exists (public URL reads).
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Public read for every file in the bucket (landing header/footer logo).
DROP POLICY IF EXISTS "Public read all public files" ON storage.objects;
CREATE POLICY "Public read all public files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'public');

-- 3) Super-admin insert into the branding/ folder (logo + watermark).
--    upload() uses upsert:true, so INSERT is required; UPDATE covers
--    re-uploading the same timestamped path.
DROP POLICY IF EXISTS "Super admin upload branding images" ON storage.objects;
CREATE POLICY "Super admin upload branding images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'branding'
    AND public.is_super_admin()
  );

DROP POLICY IF EXISTS "Super admin update branding images" ON storage.objects;
CREATE POLICY "Super admin update branding images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'branding'
    AND public.is_super_admin()
  )
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'branding'
    AND public.is_super_admin()
  );

-- 4) Replacement cleanup: branding.ts removes old objects on save.
--    (Existing "Authenticated delete own files" covers DELETE for the whole
--    bucket; this super-admin policy keeps working even if that is removed.)
DROP POLICY IF EXISTS "Super admin delete branding images" ON storage.objects;
CREATE POLICY "Super admin delete branding images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'branding'
    AND public.is_super_admin()
  );
