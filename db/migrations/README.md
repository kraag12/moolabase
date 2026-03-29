Migration instructions

1) In your Supabase project go to "SQL Editor" → "New query".
2) Run the SQL files in this safe order:
   - `002_core_tables.sql` (creates profiles/jobs/services/conversations/messages + application tables)
   - `003_notifications.sql`
   - `004_rls_policies.sql`
   - `005_fix_rls_policies.sql`
   - `006_apply_rls_policies.sql`
   - `007_fix_auth_email_profile_sync.sql`
   - `008_welcome_feature.sql`
   - `009_fix_storage_rls.sql`
3) `001_create_applications.sql` is a legacy migration and should be skipped on new setups.
4) Ensure the `pgcrypto` extension is enabled (the migrations include `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`).
5) If you see `Could not find the table 'public.notifications' in the schema cache`, run `014_notifications_table_hotfix.sql`.

Environment
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client usage.
- Set `SUPABASE_SERVICE_ROLE_KEY` in your environment for server-side operations (used by `lib/supabase/server.ts`).

If you see errors like "Could not find the table 'public.conversations'", run `002_core_tables.sql` and `008_welcome_feature.sql`.
