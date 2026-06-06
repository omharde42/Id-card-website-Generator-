
-- Profile photos: drop overly permissive SELECT policy (bucket remains public via CDN for QR codes,
-- but listing via API is no longer allowed)
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

-- Owner-scoped UPDATE / DELETE on profile-photos
DROP POLICY IF EXISTS "Authenticated users can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile photos" ON storage.objects;

CREATE POLICY "Users can update their own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Tighten INSERT policy too (defense in depth)
DROP POLICY IF EXISTS "Authenticated users can upload profile photos" ON storage.objects;
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- id-cards: add missing UPDATE policy mirroring INSERT
CREATE POLICY "Users can update their own ID cards"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'id-cards'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'id-cards'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Revoke EXECUTE on internal cleanup function from client-callable roles
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM authenticated;
