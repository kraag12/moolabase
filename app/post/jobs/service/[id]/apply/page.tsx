'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { resolveColumn } from '@/lib/supabase/schema'
import { ABORT_REASON } from '@/lib/abort-reason'

export default function ApplyServicePage() {
  const params = useParams()
  const id = params?.id as string | undefined

  const [service, setService] = useState<any | null>(null)
  const [motivation, setMotivation] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [applicationChecked, setApplicationChecked] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const serviceImages = useMemo(() => {
    const value = service?.image_url
    if (!value) return [] as string[]
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 3)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 3)
      } catch {
        // ignore invalid JSON
      }
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    }
    return [] as string[]
  }, [service?.image_url])

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

  useEffect(() => {
    let cancelled = false

    if (!id) return
    if (!userId) {
      setAlreadyApplied(false)
      setApplicationChecked(true)
      return
    }

    setApplicationChecked(false)
    ;(async () => {
      try {
        const applicantColumn = await resolveColumn(supabase as any, 'service_applications', 'user_id', 'applicant_id')
        const { data } = await supabase
          .from('service_applications')
          .select('id')
          .eq('service_id', id)
          .eq(applicantColumn, userId)
          .limit(1)
        if (!cancelled) setAlreadyApplied(!!(data && data.length > 0))
      } catch {
        if (!cancelled) setAlreadyApplied(false)
      } finally {
        if (!cancelled) setApplicationChecked(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, userId])

  // fetch service details from merged listings endpoint
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/listings', { cache: 'no-store', signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        const items = data?.listings || []
        const found = items.find((it: any) => String(it.id) === String(id) && it.type === 'service')
        if (found) setService(found)
      } catch {
        // ignore
      }
    })()

    return () => controller.abort(ABORT_REASON)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (alreadyApplied) {
      setError('You have already applied to this post')
      return
    }

    if (!id) {
      setError('Missing service id')
      return
    }

    if (!motivation.trim()) {
      setError('Please explain why you need this service and what you need it for')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/service_applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: id,
          motivation: motivation.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          res.status === 409 ? 'You have already applied to this post' : data.error || 'Failed to submit application'
        setError(message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setAlreadyApplied(true)
      setMotivation('')
    } catch (e: any) {
      setError('Server error')
    } finally {
      setLoading(false)
    }
  }

  const isOwner = !!userId && !!service?.poster_id && userId === service.poster_id;

  if (authChecked && !userId) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Log in to apply</h1>
            <p className="text-neutral-600 mb-6">
              You need an account to inquire about this service.
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
    );
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
    );
  }

  if (isOwner) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">This is your service</h1>
            <p className="text-neutral-600 mb-6">
              You cannot inquire about a service you posted.
            </p>
            <Link
              href={`/post/jobs/service/${id}`}
              className="inline-flex px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              Back to service
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (authChecked && userId && username && !applicationChecked) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Checking your application</h1>
            <p className="text-neutral-600 mb-6">
              Please wait while we verify your application status.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (authChecked && userId && username && applicationChecked && alreadyApplied && !success) {
    return (
      <main className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Already applied</h1>
            <p className="text-neutral-600 mb-6">
              You have already applied to this post.
            </p>
            <Link
              href={`/post/jobs/service/${id}`}
              className="inline-flex px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              Back to service
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href={`/post/jobs/service/${id}`} className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">
          Back to service
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Inquire About Service</h1>
          <p className="text-neutral-600">Tell the provider what you need and why.</p>
        </div>

        {service && (
          <div className="mb-6 bg-neutral-50 p-4 rounded-lg border border-neutral-200">
            <h3 className="font-semibold text-neutral-900 mb-2">Service details</h3>
            <p className="text-neutral-800 font-medium">{service.title}</p>
            {service.description && <p className="text-neutral-700 mt-2 whitespace-pre-wrap">{service.description}</p>}
            {service.location && <p className="text-neutral-600 mt-2">Location: {service.location}</p>}
            {service.offer && (
              <p className="text-neutral-900 mt-2 font-semibold">Rate: R {Number(service.offer).toLocaleString()}</p>
            )}
            {serviceImages.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-neutral-800 mb-2">Pictures</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {serviceImages.map((src, index) => (
                    <div key={`${src}-${index}`} className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                      <img
                        src={src}
                        alt={`Service image ${index + 1}`}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <label className="font-semibold block mb-2 text-neutral-900">Why do you need this service?</label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              rows={8}
              placeholder="Explain why you need this service and what you need it for"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              Inquiry submitted successfully! The service provider will contact you soon.
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading || alreadyApplied}
            >
              {loading ? 'Submitting...' : 'Submit Inquiry'}
            </button>
            <Link
              href={`/post/jobs/service/${id}`}
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
