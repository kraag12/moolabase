-- Migration: Unread message tracking + conversation last message preview + notification read updates

BEGIN;

-- 1) Conversations: store last message preview fields (used for chat list + unread counts)
ALTER TABLE IF EXISTS public.conversations
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_text text,
  ADD COLUMN IF NOT EXISTS last_message_sender_id uuid,
  ADD COLUMN IF NOT EXISTS last_message_has_image boolean NOT NULL DEFAULT false;

-- 2) Conversation reads: per-user last read time (used for unread counts)
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user_id ON public.conversation_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_reads_conversation_id ON public.conversation_reads(conversation_id);

-- 3) RLS for conversation_reads (only participants can write/read their own row)
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User read own conversation reads" ON public.conversation_reads;
CREATE POLICY "User read own conversation reads"
ON public.conversation_reads
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User upsert own conversation reads" ON public.conversation_reads;
CREATE POLICY "User upsert own conversation reads"
ON public.conversation_reads
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_reads.conversation_id
      AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "User update own conversation reads" ON public.conversation_reads;
CREATE POLICY "User update own conversation reads"
ON public.conversation_reads
FOR UPDATE
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_reads.conversation_id
      AND (c.user_1_id = auth.uid() OR c.user_2_id = auth.uid())
  )
);

-- 4) Allow users to mark their own notifications as read/unread
DROP POLICY IF EXISTS "User update own notifications" ON public.notifications;
CREATE POLICY "User update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

COMMIT;

