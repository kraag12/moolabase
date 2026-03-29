'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { resolveColumn } from '@/lib/supabase/schema'
import { isAbortError } from '@/lib/errors/isAbortError'

type PendingVerification = {
  email: string
  username: string
  fullName: string
}

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)

  const getAuthRedirectTo = () =>
    typeof window === 'undefined' ? undefined : `${window.location.origin}/auth/callback`

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

  const ensureProfileExists = async (user: User, fallback: PendingVerification) => {
    const emailColumn = await resolveColumn(supabase as any, 'profiles', 'email', 'id')
    const payload: Record<string, any> = {
      id: user.id,
      username: fallback.username,
      full_name: fallback.fullName,
    }

    if (emailColumn === 'email') {
      payload.email = fallback.email
    }

    const { error: profileError } = await upsertProfileRobust(payload)
    if (profileError) {
      console.warn('Profile creation deferred until login:', profileError)
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
          console.warn('Session check failed on signup page:', error)
        }
      }
    })()
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!form.username.match(/^[a-zA-Z0-9_]{3,20}$/)) {
      setError('Username must be 3-20 characters long and can only contain letters, numbers, and underscores.')
      return
    }

    setSubmitting(true)

    try {
      const email = form.email.trim().toLowerCase()

      const { data: existingUser, error: existingUserError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', form.username)
        .maybeSingle()

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        setError(existingUserError.message)
        return
      }

      if (existingUser) {
        setError('Username is already taken. Please choose another one.')
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          emailRedirectTo: getAuthRedirectTo(),
          data: {
            username: form.username,
            full_name: form.fullName,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (!data.user) {
        setError('Unable to create account right now. Please try again.')
        return
      }

      const verificationPayload = {
        email,
        username: form.username,
        fullName: form.fullName,
      }

      if (data.session?.user) {
        await ensureProfileExists(data.session.user, verificationPayload)
        router.replace('/')
        router.refresh()
        return
      }

      setPendingVerification(verificationPayload)
      setVerificationCode('')
      setSuccess('Account created. Enter the 6-digit code from your email to verify and log in.')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingVerification) return

    setError(null)
    setSuccess(null)
    setVerifying(true)

    try {
      const token = verificationCode.trim()
      if (!token) {
        setError('Enter the verification code from your email.')
        return
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingVerification.email,
        token,
        type: 'signup',
      })

      if (verifyError) {
        setError(verifyError.message)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await ensureProfileExists(userData.user, pendingVerification)
      }

      setSuccess('Email verified. Redirecting...')
      router.replace('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    if (!pendingVerification) return
    setError(null)
    setSuccess(null)
    setResending(true)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerification.email,
        options: {
          emailRedirectTo: getAuthRedirectTo(),
        },
      })

      if (resendError) {
        setError(resendError.message)
        return
      }

      setSuccess('Verification code sent again. Check inbox and spam folders.')
    } catch (err: any) {
      setError(err.message || 'Unable to resend code right now.')
    } finally {
      setResending(false)
    }
  }

  const resetToRegistration = () => {
    setPendingVerification(null)
    setVerificationCode('')
    setSuccess(null)
    setError(null)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-1 text-neutral-900">Create Account</h1>
          <p className="text-center text-neutral-600 mb-6">Join Moolabase for free.</p>

          {!pendingVerification && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block font-semibold text-neutral-800 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g., janedoe"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="fullName" className="block font-semibold text-neutral-800 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  id="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="e.g., Jane Doe"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block font-semibold text-neutral-800 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block font-semibold text-neutral-800 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="********"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block font-semibold text-neutral-800 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="********"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {pendingVerification && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
                Verification code sent to <span className="font-semibold">{pendingVerification.email}</span>.
              </div>

              <div>
                <label htmlFor="verificationCode" className="block font-semibold text-neutral-800 mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition disabled:opacity-60"
                disabled={verifying}
              >
                {verifying ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                className="w-full py-3 border border-black text-black font-semibold rounded-lg hover:bg-neutral-100 transition disabled:opacity-60"
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={resetToRegistration}
                className="w-full py-2 text-sm text-neutral-700 hover:underline"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <div className="border-t border-neutral-200 bg-neutral-50 p-6 rounded-b-2xl">
          <p className="text-center text-sm text-neutral-600">
            Already have an account?{' '}
            <Link href="/login" className="text-black font-semibold hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
