-- Migration: Add image_url to messages for image sharing

ALTER TABLE IF EXISTS public.messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

