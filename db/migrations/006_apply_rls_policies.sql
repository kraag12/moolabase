
CREATE POLICY "Public read profiles"
ON profiles
FOR SELECT
USING (true);

CREATE POLICY "User can create own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "User can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Public read jobs"
ON jobs
FOR SELECT
USING (true);

CREATE POLICY "User can create job"
ON jobs
FOR INSERT
WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Poster can delete job"
ON jobs
FOR DELETE
USING (auth.uid() = poster_id);

CREATE POLICY "Public read services"
ON services
FOR SELECT
USING (true);

CREATE POLICY "User can create service"
ON services
FOR INSERT
WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Poster can delete service"
ON services
FOR DELETE
USING (auth.uid() = poster_id);

CREATE POLICY "User can apply"
ON applications
FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicant read own applications"
ON applications
FOR SELECT
USING (auth.uid() = applicant_id);

CREATE POLICY "Poster read applications"
ON applications
FOR SELECT
USING (
  auth.uid() IN (
    SELECT poster_id FROM jobs WHERE jobs.id = applications.listing_id
  )
);

CREATE POLICY "Poster update application"
ON applications
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT poster_id FROM jobs WHERE jobs.id = applications.listing_id
  )
);

CREATE POLICY "Participants can read conversations"
ON conversations
FOR SELECT
USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

CREATE POLICY "Participants can create conversation"
ON conversations
FOR INSERT
WITH CHECK (auth.uid() = user_1_id OR auth.uid() = user_2_id);

CREATE POLICY "User read own notifications"
ON notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System insert notifications"
ON notifications
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "User upload avatar" ON storage.objects;
CREATE POLICY "User upload avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "User can update their own avatars" ON storage.objects;
CREATE POLICY "User can update their own avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "User can delete their own avatars" ON storage.objects;
CREATE POLICY "User can delete their own avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
