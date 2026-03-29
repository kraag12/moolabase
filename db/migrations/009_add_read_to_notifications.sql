-- Migration: Add read column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
