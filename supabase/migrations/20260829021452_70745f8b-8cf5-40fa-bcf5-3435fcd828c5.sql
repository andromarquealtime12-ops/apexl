DROP POLICY IF EXISTS "Users upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile photos" ON storage.objects;

CREATE POLICY "Users upload own profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] ~ '(avatar|logo|cover|photo|selfie)'
);

CREATE POLICY "Users update own profile photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] ~ '(avatar|logo|cover|photo|selfie)'
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] ~ '(avatar|logo|cover|photo|selfie)'
);

CREATE POLICY "Users delete own profile photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] ~ '(avatar|logo|cover|photo|selfie)'
);