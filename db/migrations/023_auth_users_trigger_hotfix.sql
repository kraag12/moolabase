-- Hotfix: prevent auth signup failures caused by broken custom triggers on auth.users.
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Remove any non-internal custom triggers on auth.users, then re-create one safe trigger.
DO $$
DECLARE
  trigger_row record;
BEGIN
  FOR trigger_row IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trigger_row.tgname);
  END LOOP;
END $$;

-- Ensure email column exists if historical schema missed it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Robust sync function that NEVER throws (to avoid blocking auth signup).
CREATE OR REPLACE FUNCTION public.sync_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix text := LEFT(REPLACE(NEW.id::text, '-', ''), 8);
  candidate_index integer := 0;
BEGIN
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

    -- Find a unique username candidate.
    LOOP
      IF candidate_index = 0 THEN
        final_username := LEFT(base_username, 20);
      ELSE
        final_username := LEFT(base_username, GREATEST(3, 20 - LENGTH(candidate_index::text) - 1))
          || '_' || candidate_index::text;
      END IF;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.username = final_username
          AND p.id <> NEW.id
      );

      candidate_index := candidate_index + 1;
      IF candidate_index > 1000 THEN
        final_username := LEFT(base_username, 10) || '_' || suffix;
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.profiles (id, email, username, full_name, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      final_username,
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
    WHEN others THEN
      -- Never block auth signup.
      RAISE NOTICE 'sync_profile_for_auth_user (hotfix) warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_for_auth_user();

COMMIT;
