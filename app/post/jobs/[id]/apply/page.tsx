'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function ApplyJobPage() {
  const params = useParams()
  const id = params?.id as string | undefined

  const [motivation, setMotivation] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [jobDetails, setJobDetails] = useState<any | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user) {
          setAuthChecked(true)
          return
        }
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()
        setUsername(profile?.username || null)
      } catch {
        // ignore
      } finally {
        setAuthChecked(true)
      }
    })()
  }, [])

  // fetch job details for context
  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await fetch('/api/listings')
        if (!res.ok) return
        const data = await res.json()
        const items = data?.listings || []
        const found = items.find((it: any) => String(it.id) === String(id) && it.type === 'job')
        if (found) setJobDetails(found)
      } catch {
        // ignore
      }
    })()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!id) {
      setError('Missing job id')
      return
    }

    if (!motivation.trim()) {
      setError('Motivation is required')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/job_applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: id,
          motivation: motivation.trim(),
        }),
      })
      const resp = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(resp.error || 'Failed to submit application')
        setLoading(false)
        return
      }

      setSuccess(true)
      setMotivation('')
    } catch (e) {
      setError('Server error')
    } finally {
      setLoading(false)
    }
  }

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Log in to apply</h1>
            <p className="text-neutral-600 mb-6">
              You need an account to apply for this job.
            </p>
            <Link
              href="/login"
              className="inline-flex px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              Log in
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (authChecked && userId && !username) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Set a username first</h1>
            <p className="text-neutral-600 mb-6">
              Please add a username to your profile before applying.
            </p>
            <Link
              href="/profile"
              className="inline-flex px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              Go to profile
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href={`/post/jobs/${id}`} className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">
          Back to job
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Apply for Job</h1>
          <p className="text-neutral-600">Tell the poster why you're the right candidate.</p>
        </div>

        {jobDetails && (
          <div className="mb-6 bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <h3 className="font-semibold text-neutral-900 mb-2">Job details</h3>
            <p className="text-neutral-800 font-medium">{jobDetails.title}</p>
            {jobDetails.description && <p className="text-neutral-700 mt-2 whitespace-pre-wrap">{jobDetails.description}</p>}
            {jobDetails.location && <p className="text-neutral-600 mt-2">Location: {jobDetails.location}</p>}
            {jobDetails.offer && <p className="text-neutral-900 mt-2 font-semibold">R {Number(jobDetails.offer).toLocaleString()}</p>}
          </div>
        )}

        <form className="space-y-6 bg-white p-8 rounded-lg border border-neutral-200" onSubmit={handleSubmit}>
          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Username</label>
            <input
              value={username || ''}
              disabled
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 bg-neutral-100 text-neutral-700"
            />
          </div>
          <div>
            <label className="font-semibold block mb-2 text-neutral-900">Why are you a good candidate?</label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              rows={6}
              placeholder="Share your experience and why you are a strong fit"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              Application submitted successfully! Good luck!
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
            <Link
              href={`/post/jobs/${id}`}
              className="flex-1 border border-neutral-300 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
