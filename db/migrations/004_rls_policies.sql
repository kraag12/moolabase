-- Migration: RLS policies and ownership constraints for Moolabase
-- This file does NOT create new tables. It only adds missing columns (if needed) and RLS policies.

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ownership columns (safe to re-run)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS poster_id uuid;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS poster_id uuid;

-- Application columns (safe to re-run)
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.service_applications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.service_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Profile avatar column (safe to re-run)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: readable by everyone, editable only by owner
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Profiles are editable by owner" ON public.profiles;
CREATE POLICY "Profiles are editable by owner"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles can be inserted by owner" ON public.profiles;
CREATE POLICY "Profiles can be inserted by owner"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Jobs: public read, owner write
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON public.jobs;
CREATE POLICY "Jobs are viewable by everyone"
  ON public.jobs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Jobs are insertable by owner" ON public.jobs;
CREATE POLICY "Jobs are insertable by owner"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Jobs are updatable by owner" ON public.jobs;
CREATE POLICY "Jobs are updatable by owner"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Jobs are deletable by owner" ON public.jobs;
CREATE POLICY "Jobs are deletable by owner"
  ON public.jobs FOR DELETE
  USING (auth.uid() = poster_id);

-- Services: public read, owner write
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
CREATE POLICY "Services are viewable by everyone"
  ON public.services FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Services are insertable by owner" ON public.services;
CREATE POLICY "Services are insertable by owner"
  ON public.services FOR INSERT
  WITH CHECK (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Services are updatable by owner" ON public.services;
CREATE POLICY "Services are updatable by owner"
  ON public.services FOR UPDATE
  USING (auth.uid() = poster_id);

DROP POLICY IF EXISTS "Services are deletable by owner" ON public.services;
CREATE POLICY "Services are deletable by owner"
  ON public.services FOR DELETE
  USING (auth.uid() = poster_id);

-- Job applications: applicant + owner access
DROP POLICY IF EXISTS "Job applications are viewable by applicant or owner" ON public.job_applications;
CREATE POLICY "Job applications are viewable by applicant or owner"
  ON public.job_applications FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id
      AND j.poster_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Job applications can be inserted by applicant" ON public.job_applications;
CREATE POLICY "Job applications can be inserted by applicant"
  ON public.job_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Job applications can be updated by owner" ON public.job_applications;
CREATE POLICY "Job applications can be updated by owner"
  ON public.job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_applications.job_id
      AND j.poster_id = auth.uid()
    )
  );

-- Service applications: applicant + owner access
DROP POLICY IF EXISTS "Service applications are viewable by applicant or owner" ON public.service_applications;
CREATE POLICY "Service applications are viewable by applicant or owner"
  ON public.service_applications FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_applications.service_id
      AND s.poster_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service applications can be inserted by applicant" ON public.service_applications;
CREATE POLICY "Service applications can be inserted by applicant"
  ON public.service_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service applications can be updated by owner" ON public.service_applications;
CREATE POLICY "Service applications can be updated by owner"
  ON public.service_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_applications.service_id
      AND s.poster_id = auth.uid()
    )
  );

-- Conversations: participants only
DROP POLICY IF EXISTS "Conversations are viewable by participants" ON public.conversations;
CREATE POLICY "Conversations are viewable by participants"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

DROP POLICY IF EXISTS "Conversations are insertable by participants" ON public.conversations;
CREATE POLICY "Conversations are insertable by participants"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_1_id OR auth.uid() = user_2_id);

DROP POLICY IF EXISTS "Conversations are updatable by participants" ON public.conversations;
CREATE POLICY "Conversations are updatable by participants"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Messages: participants only
DROP POLICY IF EXISTS "Messages are viewable by participants" ON public.messages;
CREATE POLICY "Messages are viewable by participants"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Messages can be inserted by participants" ON public.messages;
CREATE POLICY "Messages can be inserted by participants"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
    )
  );
