-- Migration: Add duration column to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '1_week';
