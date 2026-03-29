-- Migration: Fix email-based auth profile sync
-- Safe to run multiple times.

BEGIN;

-- Ensure profiles.email exists (some deployed schemas are missing it).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill missing emails from auth.users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL
  AND u.email IS NOT NULL;

-- Ensure all existing auth users have a profile row.
INSERT INTO public.profiles (id, email, username, full_name, created_at, updated_at)
SELECT
  u.id,
  u.email,
  (
    LEFT(
      REGEXP_REPLACE(
        LOWER(
          COALESCE(
            NULLIF(u.raw_user_meta_data->>'username', ''),
            NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''),
            'user'
          )
        ),
        '[^a-z0-9_]+',
        '_',
        'g'
      ),
      14
    ) || '_' || LEFT(u.id::text, 6)
  ) AS username,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', '')),
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Keep emails in profiles synced with auth.users email.
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_for_auth_user();

COMMIT;
