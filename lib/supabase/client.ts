// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	const msg = 'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
	if (process.env.NODE_ENV === 'production') {
		throw new Error(msg)
	} else {
		// In dev, log a clear warning so it's obvious in terminal
		// (avoids crashing the dev server — the client will still be created but requests will fail)
		// eslint-disable-next-line no-console
		console.error(msg)
	}
}

export const supabase = createBrowserClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
})
