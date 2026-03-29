'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // The redirect URL should be configured in your Supabase project settings
    // under Auth -> URL Configuration -> Site URL and Additional Redirect URLs
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-1 text-neutral-900">Forgot Password</h1>
          <p className="text-center text-neutral-600 mb-6">Enter your email to get a reset link.</p>
          
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label htmlFor="email" className="block font-semibold text-neutral-800 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{error}</p>}
            
            {success && (
              <p className="text-green-800 text-sm bg-green-50 border border-green-200 p-3 rounded-lg">
                If an account exists for this email, a password reset link has been sent. Please check your inbox.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>
        
        <div className="border-t border-neutral-200 bg-neutral-50 p-6 rounded-b-2xl">
          <p className="text-center text-sm text-neutral-600">
            Remembered your password?{' '}
            <Link href="/login" className="text-black font-semibold hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
