-- Migration: Add conversation_id column to notifications so we can link acceptance alerts to chats

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- index for quicker lookups if needed
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON public.notifications(conversation_id);
