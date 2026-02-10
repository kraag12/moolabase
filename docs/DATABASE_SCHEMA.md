# Moolabase Database Schema Setup

## Overview
This document outlines the required Supabase database tables for the Moolabase marketplace application.

## Required Tables

### 1. `jobs` Table
Stores job postings by employers.

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  offer NUMERIC NOT NULL,
  remote TEXT DEFAULT 'local',
  duration TEXT DEFAULT '1_week',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `title`: Job title (required)
- `description`: Job description (required)
- `location`: Job location (required)
- `offer`: Salary/compensation amount (required, numeric)
- `remote`: Work type - 'local', 'remote', or 'hybrid' (default: 'local')
- `duration`: Expected duration - '1_week', '2_weeks', '1_month', etc. (default: '1_week')
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

---

### 2. `services` Table
Stores service listings by service providers.

```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  skills TEXT,
  experience TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `title`: Service title (required)
- `description`: Service description (required)
- `category`: Service category (required)
- `price`: Service hourly rate or fixed price (required, numeric)
- `skills`: Comma-separated list of skills
- `experience`: Years of experience or background info
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

---

### 3. `job_applications` Table
Stores applications from workers to job listings.

```sql
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `job_id`: Reference to the job (foreign key)
- `applicant_name`: Name of applicant (required)
- `applicant_email`: Email of applicant (required)
- `applicant_message`: Optional message from applicant
- `status`: Application status - 'pending', 'accepted', 'rejected' (default: 'pending')
- `created_at`: Timestamp of application

---

### 4. `service_applications` Table
Stores inquiries from clients to service providers.

```sql
CREATE TABLE service_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `service_id`: Reference to the service (foreign key)
- `client_name`: Name of client (required)
- `client_email`: Email of client (required)
- `client_message`: Optional message from client
- `status`: Inquiry status - 'pending', 'accepted', 'rejected' (default: 'pending')
- `created_at`: Timestamp of inquiry

---

### 5. `conversations` Table
Stores messaging conversations between users.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id UUID NOT NULL,
  user_2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `user_1_id`: First user ID (required)
- `user_2_id`: Second user ID (required)
- `created_at`: Timestamp of conversation creation
- `updated_at`: Timestamp of last activity

**Note:** Currently user_id fields are VARCHAR. Will be updated to reference `users` table when authentication is implemented.

---

### 6. `messages` Table
Stores individual messages within conversations.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `conversation_id`: Reference to the conversation (foreign key)
- `sender_id`: ID of the user sending the message (required)
- `content`: Message text (required, non-empty)
- `created_at`: Timestamp of message

**Note:** sender_id is VARCHAR. Will be updated to reference `users` table when authentication is implemented.

---

## Setup Instructions

### In Supabase Dashboard:

1. **Navigate to SQL Editor** in your Supabase dashboard
2. **Run the following SQL script:**

```sql
-- Jobs Table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  offer NUMERIC NOT NULL,
  remote TEXT DEFAULT 'local',
  duration TEXT DEFAULT '1_week',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Services Table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  skills TEXT,
  experience TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Applications Table
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service Applications Table
CREATE TABLE service_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_message TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations Table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id TEXT NOT NULL,
  user_2_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_created_at ON services(created_at);
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_service_applications_service_id ON service_applications(service_id);
CREATE INDEX idx_service_applications_status ON service_applications(status);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversations_users ON conversations(user_1_id, user_2_id);
```

3. **Execute the script** and verify all tables are created

4. **Configure Row Level Security (RLS):**
   - For development: Allow public read access to `jobs` and `services`
   - For applications: Allow insertions with appropriate validation
   - For messages: Implement user-based access control once auth is enabled

### Environment Variables

Ensure your `.env.local` file contains:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- Get these values from **Supabase Dashboard → Settings → API**
- **NEVER** commit `.env.local` to version control

---

## Future Enhancements

### Users Table (When Auth is Implemented)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  rating NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Additional Tables
- `reviews`: Ratings and feedback from transactions
- `transactions`: Payment records
- `notifications`: User notifications
- `favorites`: Bookmarked jobs/services

---

## Testing the Database

Once tables are created, test with:

1. **Add sample data:**
```sql
INSERT INTO jobs (title, description, location, offer, remote, duration) VALUES
('React Developer', 'Build responsive web apps', 'San Francisco, CA', 5000, 'remote', '1_month'),
('UI Designer', 'Design beautiful interfaces', 'New York, NY', 3000, 'hybrid', '2_weeks');
```

2. **Query the data:**
```sql
SELECT * FROM jobs;
```

3. **Test in the app:**
   - Navigate to homepage
   - Should see jobs displayed
   - Try posting a new job
   - Try applying to a job

---

## Troubleshooting

### "Server configuration error" when posting jobs/services
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Restart the Next.js development server after updating env vars
- Verify the key is correct in Supabase dashboard

### "Failed to fetch messages/conversations"
- Ensure `messages` and `conversations` tables are created
- Check that the conversation_id references a valid conversation
- Verify database queries are returning data

### Row Level Security (RLS) errors
- If RLS is enabled, ensure policies allow the operations
- For development, you can disable RLS on tables temporarily
- Production should have proper RLS policies

---

## Support

For issues with Supabase database setup, consult:
- [Supabase Documentation](https://supabase.com/docs)
- [SQL Editor Guide](https://supabase.com/docs/guides/sql-editor)
