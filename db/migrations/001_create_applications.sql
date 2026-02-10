-- Migration: Create application tables for Jobs and Services
-- Run this in your Supabase SQL editor or as a migration

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: job_applications
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_job
    FOREIGN KEY(job_id)
    REFERENCES public.jobs(id)
    ON DELETE CASCADE
);

-- Table: service_applications
CREATE TABLE IF NOT EXISTS public.service_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_service
    FOREIGN KEY(service_id)
    REFERENCES public.services(id)
    ON DELETE CASCADE
);

-- Indexes to speed lookups by parent id
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_service_applications_service_id ON public.service_applications(service_id);
