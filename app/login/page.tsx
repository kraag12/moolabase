'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resolveColumn } from '@/lib/supabase/schema'
import type { User } from '@supabase/supabase-js'
import { isAbortError } from '@/lib/errors/isAbortError'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const normalizeUsername = (value: string, userId: string) => {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (normalized.length >= 3) return normalized.slice(0, 20)
    return `user_${userId.slice(0, 8)}`
  }

  const upsertProfileRobust = async (payload: Record<string, any>) => {
    const primary = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (!primary.error) return { error: null as any }

    const message = String(primary.error.message || '').toLowerCase()
    const isUsernameConflict =
      message.includes('profiles_username_key') ||
      (message.includes('unique') && message.includes('username'))

    if (!isUsernameConflict) {
      return { error: primary.error }
    }

    const fallbackPayload = { ...payload }
    delete fallbackPayload.username
    const fallback = await supabase.from('profiles').upsert(fallbackPayload, { onConflict: 'id' })
    return { error: fallback.error }
  }

  async function ensureProfileExists(user: User) {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError && existingProfileError.code !== 'PGRST116') {
      console.warn('Profile existence check failed:', existingProfileError)
      return
    }

    if (existingProfile) return

    const emailColumn = await resolveColumn(supabase as any, 'profiles', 'email', 'id')
    const preferredUsername =
      user.user_metadata?.username ||
      user.email?.split('@')[0] ||
      `user_${user.id.slice(0, 8)}`

    const payload: Record<string, any> = {
      id: user.id,
      username: normalizeUsername(preferredUsername, user.id),
      full_name: user.user_metadata?.full_name || preferredUsername,
    }

    if (emailColumn === 'email' && user.email) {
      payload.email = user.email
    }

    const { error: profileError } = await upsertProfileRobust(payload)
    if (profileError) {
      console.warn('Auto-create profile failed:', profileError)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.replace('/')
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.warn('Session check failed on login page:', error)
        }
      }
    })()
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let loginEmail = identifier.trim()
    if (!loginEmail.includes('@')) {
      const { data: profileData, error: profileLookupError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', loginEmail)
        .maybeSingle()

      if (profileLookupError) {
        setLoading(false)
        setError('Unable to find account. Please use your email.')
        return
      }

      if (!profileData?.email) {
        setLoading(false)
        setError('Username login is unavailable for this account. Please use your email.')
        return
      }

      loginEmail = profileData.email
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          await ensureProfileExists(userData.user)
        }
      } catch (profileHydrationError) {
        console.warn('Profile hydration skipped:', profileHydrationError)
      }

      router.push('/')
      router.refresh() // To re-fetch server-side props and reflect login state
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-1 text-neutral-900">Welcome Back</h1>
          <p className="text-center text-neutral-600 mb-6">Log in to your Moolabase account.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block font-semibold text-neutral-800 mb-1">
                Email or Username
              </label>
              <input
                type="text"
                id="email"
                placeholder="you@example.com or your_username"
                className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <label htmlFor="password" className="block font-semibold text-neutral-800 mb-1">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-neutral-600 hover:text-black hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
        
        <div className="border-t border-neutral-200 bg-neutral-50 p-6 rounded-b-2xl">
          <p className="text-center text-sm text-neutral-600">
            Don't have an account?{' '}
            <Link href="/signup" className="text-black font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
