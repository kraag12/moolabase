-- Enable RLS for all tables
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Public read profiles" ON "profiles" FOR SELECT USING (true);
CREATE POLICY "User can create own profile" ON "profiles" FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "User can update own profile" ON "profiles" FOR UPDATE USING (auth.uid() = id);

-- Jobs
CREATE POLICY "Public read jobs" ON "jobs" FOR SELECT USING (true);
CREATE POLICY "User can create job" ON "jobs" FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "Poster can delete job" ON "jobs" FOR DELETE USING (auth.uid() = poster_id);

-- Services
CREATE POLICY "Public read services" ON "services" FOR SELECT USING (true);
CREATE POLICY "User can create service" ON "services" FOR INSERT WITH CHECK (auth.uid() = poster_id);
CREATE POLICY "Poster can delete service" ON "services" FOR DELETE USING (auth.uid() = poster_id);

-- Job Applications
CREATE POLICY "User can apply to job" ON "job_applications" FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Applicant read own job applications" ON "job_applications" FOR SELECT USING (auth.uid() = applicant_id);
CREATE POLICY "Poster read job applications" ON "job_applications" FOR SELECT USING (auth.uid() IN (SELECT poster_id FROM jobs WHERE jobs.id = job_applications.job_id));
CREATE POLICY "Poster update job application" ON "job_applications" FOR UPDATE USING (auth.uid() IN (SELECT poster_id FROM jobs WHERE jobs.id = job_applications.job_id));

-- Service Applications
CREATE POLICY "User can apply to service" ON "service_applications" FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Applicant read own service applications" ON "service_applications" FOR SELECT USING (auth.uid() = applicant_id);
CREATE POLICY "Poster read service applications" ON "service_applications" FOR SELECT USING (auth.uid() IN (SELECT poster_id FROM services WHERE services.id = service_applications.service_id));
CREATE POLICY "Poster update service application" ON "service_applications" FOR UPDATE USING (auth.uid() IN (SELECT poster_id FROM services WHERE services.id = service_applications.service_id));

-- Conversations
CREATE POLICY "Participants can read conversations" ON "conversations" FOR SELECT USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);
CREATE POLICY "Participants can create conversation" ON "conversations" FOR INSERT WITH CHECK (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Notifications
CREATE POLICY "User read own notifications" ON "notifications" FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System insert notifications" ON "notifications" FOR INSERT WITH CHECK (true);

-- Storage Avatars
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "User upload avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = owner);