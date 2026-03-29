-- Migration: Enrich notifications with application/listing data
-- This migration adds fields to the notifications table and a trigger that
-- populates them when application notifications are inserted. The goal is to
-- move enrichment logic into the database so the API can remain simpler and
-- notification data is always available regardless of application code.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS motivation TEXT,
  ADD COLUMN IF NOT EXISTS listing_title TEXT,
  ADD COLUMN IF NOT EXISTS listing_type TEXT,
  ADD COLUMN IF NOT EXISTS listing_id UUID;

-- function used by trigger
CREATE OR REPLACE FUNCTION public.populate_notification_details()
RETURNS trigger AS $$
BEGIN
  -- only care about application notifications
  IF NEW.type = 'job_application' OR NEW.type = 'service_application' THEN
    -- fetch application row and associated listing title/user
    IF NEW.reference_id IS NOT NULL THEN
      IF NEW.type = 'job_application' THEN
        SELECT ja.applicant_name, ja.applicant_email, ja.message,
               j.title, 'job', ja.job_id INTO NEW.applicant_name, NEW.applicant_avatar_url,
               NEW.motivation, NEW.listing_title, NEW.listing_type, NEW.listing_id
        FROM public.job_applications ja
        LEFT JOIN public.jobs j ON j.id = ja.job_id
        WHERE ja.id = NEW.reference_id;
      ELSE
        SELECT sa.applicant_name, sa.applicant_email, sa.message,
               s.title, 'service', sa.service_id INTO NEW.applicant_name, NEW.applicant_avatar_url,
               NEW.motivation, NEW.listing_title, NEW.listing_type, NEW.listing_id
        FROM public.service_applications sa
        LEFT JOIN public.services s ON s.id = sa.service_id
        WHERE sa.id = NEW.reference_id;
      END IF;
    END IF;

    -- try to look up avatar from profiles as well
    IF NEW.applicant_name IS NOT NULL AND NEW.sender_id IS NOT NULL THEN
      SELECT profile.profile_picture_url INTO NEW.applicant_avatar_url
      FROM public.profiles profile
      WHERE profile.username = NEW.applicant_name
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trigger that fires before insert to fill details
CREATE TRIGGER trg_populate_notification_details
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.populate_notification_details();
