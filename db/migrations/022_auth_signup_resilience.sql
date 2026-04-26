-- Make signup resilient even when optional welcome side-effects fail.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure the system profile exists so welcome messages don't fail on FK checks.
DO $$
DECLARE
  v_system_id uuid := 'a81a7258-2e86-5309-8714-3358315a6b05';
  v_username text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_system_id) THEN
    v_username := 'moolabase';
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
      v_username := 'moolabase_official';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) THEN
      v_username := 'moolabase_' || LEFT(REPLACE(v_system_id::text, '-', ''), 8);
    END IF;

    INSERT INTO public.profiles (id, email, username, full_name, bio, created_at, updated_at)
    VALUES (
      v_system_id,
      'moolabaseorg@gmail.com',
      v_username,
      'Moolabase (Verified)',
      'Official Moolabase account.',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Keep auth->profile sync robust and non-breaking.
CREATE OR REPLACE FUNCTION public.sync_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  generated_username text;
BEGIN
  base_username := LOWER(
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username', ''),
      NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
      'user'
    )
  );
  base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]+', '_', 'g');
  base_username := TRIM(BOTH '_' FROM base_username);
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user';
  END IF;

  generated_username := LEFT(base_username, 14) || '_' || LEFT(NEW.id::text, 6);

  BEGIN
    INSERT INTO public.profiles (id, email, username, full_name, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      generated_username,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', '')),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, profiles.email),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      updated_at = NOW();
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.profiles
      SET
        email = COALESCE(NEW.email, public.profiles.email),
        full_name = COALESCE(
          NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
          NULLIF(NEW.raw_user_meta_data->>'name', ''),
          public.profiles.full_name
        ),
        updated_at = NOW()
      WHERE id = NEW.id;
    WHEN others THEN
      -- Never block auth signup on profile-sync side effects.
      RAISE NOTICE 'sync_profile_for_auth_user warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_for_auth_user();

-- Welcome package should never block profile creation or signup.
CREATE OR REPLACE FUNCTION public.send_welcome_package()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moolabase_user_id uuid := 'a81a7258-2e86-5309-8714-3358315a6b05';
  new_conversation_id uuid;
  welcome_message text := 'Welcome to Moolabase! We are excited to have you on board.';
BEGIN
  -- Skip self-welcome or if system user is unavailable.
  IF NEW.id = moolabase_user_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = moolabase_user_id) THEN
    RETURN NEW;
  END IF;

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
      'Welcome to Moolabase',
      'Your account is ready.'
    );
  EXCEPTION
    WHEN others THEN
      -- Never block signup if this optional package fails.
      RAISE NOTICE 'send_welcome_package warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_user_welcome ON public.profiles;
CREATE TRIGGER on_new_user_welcome
AFTER INSERT
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.send_welcome_package();

COMMIT;
