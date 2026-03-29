-- Migration: Add welcome message and notification for new users.
-- This migration is intentionally defensive so it can run on older schemas
-- where conversations/messages/notifications may still be missing.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Create a system user for Moolabase (idempotent).
-- UUID is generated from "moolabase-system-user" using UUID v5.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a81a7258-2e86-5309-8714-3358315a6b05') THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_picture_url'
    ) THEN
      INSERT INTO public.profiles (id, email, username, full_name, bio, profile_picture_url)
      VALUES (
        'a81a7258-2e86-5309-8714-3358315a6b05',
        'moolabaseorg@gmail.com',
        'moolabase',
        'Moolabase (Verified)',
        'Official Moolabase account. Need help? Contact us at moolabaseorg@gmail.com.',
        'https://i.imgur.com/gJt5m3f.png'
      );
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
      INSERT INTO public.profiles (id, email, username, full_name, bio, avatar_url)
      VALUES (
        'a81a7258-2e86-5309-8714-3358315a6b05',
        'moolabaseorg@gmail.com',
        'moolabase',
        'Moolabase (Verified)',
        'Official Moolabase account. Need help? Contact us at moolabaseorg@gmail.com.',
        'https://i.imgur.com/gJt5m3f.png'
      );
    ELSE
      INSERT INTO public.profiles (id, email, username, full_name, bio)
      VALUES (
        'a81a7258-2e86-5309-8714-3358315a6b05',
        'moolabaseorg@gmail.com',
        'moolabase',
        'Moolabase (Verified)',
        'Official Moolabase account. Need help? Contact us at moolabaseorg@gmail.com.'
      );
    END IF;
  END IF;
END $$;

-- 2) Ensure core messaging tables exist (older databases may be missing them).
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_1_id ON public.conversations(user_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_2_id ON public.conversations(user_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- 3) Ensure notifications table exists and matches API expectations.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  message text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.notifications
SET type = 'notification'
WHERE type IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN type SET DEFAULT 'notification';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type'
  ) THEN
    BEGIN
      ALTER TABLE public.notifications
        ALTER COLUMN type SET NOT NULL;
    EXCEPTION
      WHEN others THEN
        -- Keep column nullable if historical data/constraints block enforcement.
        NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_id_fkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- 4) Trigger function to send welcome message and notification to new users.
CREATE OR REPLACE FUNCTION public.send_welcome_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moolabase_user_id uuid := 'a81a7258-2e86-5309-8714-3358315a6b05';
  new_conversation_id uuid;
  welcome_message text := 'Welcome to Moolabase! We are excited to have you on board. You can post jobs, offer services, and apply to opportunities to connect with people nearby.

Here are a few quick tips:
* Complete your profile so others can trust and recognize you.
* Be clear and specific in your posts to get better matches.
* For your safety, keep communication in-app and never share passwords or payment details. If something feels off, you can report it.

We are glad you are here. Good luck with your hustle!';
BEGIN
  INSERT INTO public.conversations (user_1_id, user_2_id, locked)
  VALUES (moolabase_user_id, NEW.id, true)
  RETURNING id INTO new_conversation_id;

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (new_conversation_id, moolabase_user_id, welcome_message);

  INSERT INTO public.notifications (user_id, sender_id, type, title, message)
  VALUES (
    NEW.id,
    moolabase_user_id,
    'welcome',
    'Sign-in successful',
    'Welcome to Moolabase! Your account is ready.'
  );

  RETURN NEW;
END;
$$;

-- 5) Trigger on profiles to call the welcome function for new users.
DROP TRIGGER IF EXISTS on_new_user_welcome ON public.profiles;
CREATE TRIGGER on_new_user_welcome
AFTER INSERT
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.send_welcome_package();

COMMIT;
