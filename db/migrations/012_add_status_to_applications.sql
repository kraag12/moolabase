-- Migration: Add status column to application tables
-- This migration adds the status column to job_applications and service_applications tables

-- Add status column to job_applications
ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Add status column to service_applications
ALTER TABLE public.service_applications
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'));

-- Add user_id column to job_applications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_applications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.job_applications
    ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id column to service_applications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_applications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.service_applications
    ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for the new user_id columns
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_service_applications_user_id ON public.service_applications(user_id);