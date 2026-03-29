-- Migration: Fix storage RLS policies for avatars

BEGIN;

-- Drop the old insert policy for avatars
DROP POLICY IF EXISTS "User upload avatar" ON storage.objects;

-- Allow users to upload to their own folder in the 'avatars' bucket
CREATE POLICY "User can upload avatar" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatars
CREATE POLICY "User can update own avatar" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- The read policy is already public, which is fine for avatars.
-- If we wanted to restrict it, we could do:
-- DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
-- CREATE POLICY "User can read own avatar" ON storage.objects
-- FOR SELECT
-- USING (
--   bucket_id = 'avatars' AND
--   (storage.foldername(name))[1] = auth.uid()::text
-- );
-- CREATE POLICY "Public can read avatars" ON storage.objects
-- FOR SELECT
-- USING ( bucket_id = 'avatars' );


COMMIT;
