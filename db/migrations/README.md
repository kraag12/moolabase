Migration instructions

1) In your Supabase project go to "SQL Editor" → "New query".
2) Run the SQL files in this folder in order (e.g. `001_create_applications.sql`, then `002_core_tables.sql`).
3) Ensure the `pgcrypto` extension is enabled (the migrations include `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`).

Environment
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client usage.
- Set `SUPABASE_SERVICE_ROLE_KEY` in your environment for server-side operations (used by `lib/supabase/server.ts`).

If you see errors like "Could not find the table 'public.conversations'", run the migrations to create the missing tables.
