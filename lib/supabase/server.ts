import { cookies, headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const parseCookieHeader = () => {
    const raw = headerStore.get('cookie') || ''
    if (!raw) return []

    return raw
      .split(';')
      .map((part: string) => part.trim())
      .filter(Boolean)
      .map((part: string) => {
        const eq = part.indexOf('=')
        if (eq === -1) return { name: part, value: '' }

        const name = part.slice(0, eq).trim()
        const value = part.slice(eq + 1).trim()
        return { name, value: decodeURIComponent(value) }
      })
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof cookieStore.getAll === 'function') {
            return cookieStore.getAll()
          }
          return parseCookieHeader()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            if (typeof cookieStore.set === 'function') {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            }
          } catch {
            // Server Components cannot set cookies; ignore safely.
          }
        },
      },
    }
  )
}
