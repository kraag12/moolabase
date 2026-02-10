⚠️ IMPORTANT: Missing SUPABASE_SERVICE_ROLE_KEY

The posting feature requires the service role key from Supabase.

HOW TO FIX:
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy the "service_role key" (NOT the anon key)
4. Add this line to .env.local:

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

5. Restart the dev server (npm run dev)
6. Try posting a job/service again

The service role key allows server-side operations and should NEVER be exposed in the browser.
