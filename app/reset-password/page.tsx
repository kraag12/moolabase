'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-center mb-1 text-neutral-900">Reset Your Password</h1>
          <p className="text-center text-neutral-600 mb-6">Enter a new password for your account.</p>
          
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block font-semibold text-neutral-800 mb-1">
                New Password
              </label>
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

            <div>
              <label htmlFor="confirmPassword" className="block font-semibold text-neutral-800 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                placeholder="••••••••"
                className="w-full mt-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black transition"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{error}</p>}
            
            {success && (
              <div>
                <p className="text-green-800 text-sm bg-green-50 border border-green-200 p-3 rounded-lg">
                  Your password has been reset successfully.
                </p>
                <Link href="/login" className="block text-center w-full mt-4 py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition">
                  Go to Login
                </Link>
              </div>
            )}

            {!success && (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-black text-white font-semibold rounded-lg hover:bg-neutral-800 transition disabled:opacity-60"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            )}
          </form>
        </div>
        
        {!success && (
          <div className="border-t border-neutral-200 bg-neutral-50 p-6 rounded-b-2xl">
            <p className="text-center text-sm text-neutral-600">
              <Link href="/login" className="text-black font-semibold hover:underline">
                Back to Log In
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
