import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAbortError } from '@/lib/errors/isAbortError'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('Skipping Supabase session refresh: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
      }
      return response
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

            response = NextResponse.next({
              request,
            })

            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Refresh session cookies when needed so returning users stay signed in.
    try {
      await supabase.auth.getUser()
    } catch (error: any) {
      const message = String(error?.message || '')
      const aborted = isAbortError(error)

      // Requests can be cancelled or fail transiently (network, auth service hiccups).
      // Keep serving the request and let downstream handlers decide how to respond.
      if (!aborted && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('Supabase session refresh failed, continuing request:', message || String(error))
      }
    }

    return response
  } catch (error) {
    if (isAbortError(error)) {
      return response
    }
    throw error
  }
}
