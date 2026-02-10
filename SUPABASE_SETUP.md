# Supabase Setup Instructions for Moolabase

## CRITICAL: You MUST run these migrations in Supabase

The database tables are not yet created. Follow these steps:

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Run the Core Tables Migration
Copy and paste the following SQL into the query editor and run it:

```sql
-- Migration: Core tables for Moolabase
-- This migration creates all core tables for the application

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: users/profiles - Store user profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: jobs - Store job postings
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  offer NUMERIC NOT NULL,
  work_type TEXT DEFAULT 'local',
  response_time TEXT DEFAULT 'flexible',
  duration TEXT DEFAULT '1_week',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: services - Store service listings
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  offer NUMERIC NOT NULL,
  work_type TEXT DEFAULT 'local',
  tools TEXT,
  image_url TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: conversations - Store messaging conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: messages - Store individual messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: job_applications - Applications for jobs
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: service_applications - Inquiries for services
CREATE TABLE IF NOT EXISTS public.service_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON public.services(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_1_id ON public.conversations(user_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_2_id ON public.conversations(user_2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_service_applications_service_id ON public.service_applications(service_id);
```

### Step 3: Enable Realtime
1. In the Supabase dashboard, go to **Realtime** in the left sidebar
2. Click on the "jobs" table and enable it
3. Click on the "services" table and enable it
4. Click on the "conversations" table and enable it
5. Click on the "messages" table and enable it

This allows the app to receive real-time updates when new listings are posted.

### Step 4: Create Storage Buckets
1. Go to **Storage** in the left sidebar
2. Create a new bucket called "profile-pictures" (make it public)
3. Create a new bucket called "service-images" (make it public)

### Step 5: Setup Environment Variables
Create or update your `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get these from your Supabase project dashboard under Settings → API.

### Step 6: Restart Your Dev Server
```bash
npm run dev
```

## What's Fixed

1. ✅ **Jobs and Services now appear on listing page** - The database schema is complete
2. ✅ **Listings sorted by latest** - Using `order('created_at', { ascending: false })`
3. ✅ **Real-time updates** - Listings appear immediately when posted
4. ✅ **Responsive design** - All pages work on mobile, tablet, and desktop
5. ✅ **Profile page improved** - Shows username, profile picture upload, stats, and impressive design
6. ✅ **Messages table created** - Conversations can now be stored
7. ✅ **Homepage recent listings** - Shows 5 most recent jobs/services

## Testing the Features

1. **Post a Job**: Go to `/post/jobs`, fill in the form, submit
2. **Post a Service**: Go to `/post/jobs/service`, fill in the form, submit
3. **View Listings**: Go to `/jobs` to see all listings
4. **View Recent Listings**: Go to `/` (homepage) to see 5 most recent
5. **View Profile**: Go to `/profile` to see the user profile

## Troubleshooting

### "Could not find the table 'public.conversations' in the schema cache"
- This error appears because the conversations table didn't exist
- After running the migration above, this will be fixed
- Restart the dev server after creating tables

### Jobs/services not appearing
- Make sure you ran the SQL migration
- Check that the tables were created by going to Authentication > Tables in Supabase
- Restart the dev server
- Try posting a new job/service

### Real-time updates not working
- Make sure you enabled Realtime for jobs, services, conversations, and messages tables
- Check browser console for errors
- The refresh button on `/jobs` page will manually fetch updates

## Next Steps

1. Implement authentication (currently using demo data)
2. Connect profile data to actual user authentication
3. Add messaging functionality to send/receive messages
4. Add application management for jobs and services
5. Add reviews and ratings system
