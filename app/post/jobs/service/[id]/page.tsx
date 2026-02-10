'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Service = {
  id: string
  title?: string | null
  description?: string | null
  location?: string | null
  offer?: number | string | null
  work_type?: string | null
  tools?: string | null
  image_url?: string[] | string | null
  poster_id?: string | null
  user_id?: string | null
}

const formatValue = (value?: string | null) => {
  if (!value) return 'Not specified'
  return value.replace(/_/g, ' ')
}

const normalizeImages = (value: Service['image_url']) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore parse errors
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export default function ServiceIdPage() {
  const { id } = useParams()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [motivation, setMotivation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!id) return

    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/listings')
        if (!res.ok) {
          console.error('Listings API error')
          setNotFound(true)
          setLoading(false)
          return
        }

        const data = await res.json()
        const items = data?.listings || []
        const found = items.find((it: any) => String(it.id) === String(id) && it.type === 'service')

        if (!found) {
          setNotFound(true)
        } else {
          setService(found as Service)
        }
      } catch (err) {
        console.error('Unexpected exception fetching service:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

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

  const ownerId = (service as any)?.poster_id || (service as any)?.user_id || null
  const isOwner = !!userId && !!ownerId && userId === ownerId
  const images = useMemo(() => normalizeImages(service?.image_url).slice(0, 3), [service?.image_url])

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return

    setSubmitError(null)
    setSuccess(false)

    if (!motivation.trim()) {
      setSubmitError('Motivation is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/service_applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: id, motivation: motivation.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to submit inquiry')
        return
      }
      setSuccess(true)
      setMotivation('')
    } catch (e) {
      setSubmitError('Server error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (notFound || !service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-600">Service not found</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-8 space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">{service.title || 'Untitled service'}</h1>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
              <p className="text-xs uppercase text-neutral-500 font-semibold mb-2">Description</p>
              <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {service.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
              <div className="border border-neutral-200 rounded-lg p-4">
                <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Location</p>
                <p className="text-lg font-semibold">{service.location || 'Not specified'}</p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-4">
                <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Offer</p>
                <p className="text-2xl font-bold">
                  {service.offer !== null && service.offer !== undefined ? `R ${Number(service.offer).toLocaleString()}` : 'N/A'}
                </p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-4 sm:col-span-2">
                <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Work Type</p>
                <p className="text-lg font-semibold capitalize">{formatValue(service.work_type)}</p>
              </div>
            </div>

            {service.tools && (
              <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200">
                <h3 className="font-semibold text-neutral-900 mb-3 uppercase text-xs">Tools</h3>
                <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {service.tools}
                </p>
              </div>
            )}

            {images.length > 0 && (
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3 uppercase text-xs">Images</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {images.map((src, index) => (
                    <div key={`${src}-${index}`} className="border border-neutral-200 rounded-lg overflow-hidden">
                      <img src={src} alt={`${service.title || 'Service'} image ${index + 1}`} className="h-40 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <section id="apply" className="mt-10">
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Request this service</h2>
            <p className="text-neutral-600 mb-6">
              Explain what you need and why.
            </p>

            {!authChecked && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Checking your account status...
              </div>
            )}

            {authChecked && !userId && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Please log in to request this service.
              </div>
            )}

            {authChecked && userId && isOwner && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                You posted this service. Requests are only for other users.
              </div>
            )}

            {authChecked && userId && !isOwner && !username && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Please add a username to your profile before requesting this service.
              </div>
            )}

            {authChecked && userId && !isOwner && username && (
              <form className="space-y-6" onSubmit={handleApply}>
                <div>
                  <label className="font-semibold block mb-2 text-neutral-900">Why do you need this service?</label>
                  <textarea
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    rows={6}
                    placeholder="Explain what you need and why it matters"
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {submitError}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    Inquiry submitted successfully.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href="/jobs"
                    className="flex-1 border border-neutral-300 px-6 py-3 rounded-lg hover:bg-neutral-50 transition font-semibold text-center"
                  >
                    Back to listings
                  </Link>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Request Service'}
                  </button>
                </div>
              </form>
            )}

            {!(authChecked && userId && !isOwner && username) && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Link
                  href="/jobs"
                  className="flex-1 border border-neutral-300 px-6 py-3 rounded-lg hover:bg-neutral-50 transition font-semibold text-center"
                >
                  Back to listings
                </Link>
                {!authChecked && (
                  <button
                    type="button"
                    disabled
                    className="flex-1 bg-neutral-200 text-neutral-600 px-6 py-3 rounded-lg font-semibold"
                  >
                    Checking account...
                  </button>
                )}
                {authChecked && !userId && (
                  <Link
                    href="/login"
                    className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-neutral-800 transition font-semibold text-center"
                  >
                    Log in to Apply
                  </Link>
                )}
                {authChecked && userId && isOwner && (
                  <button
                    type="button"
                    disabled
                    className="flex-1 bg-neutral-200 text-neutral-600 px-6 py-3 rounded-lg font-semibold"
                  >
                    You posted this service
                  </button>
                )}
                {authChecked && userId && !isOwner && !username && (
                  <Link
                    href="/profile"
                    className="flex-1 bg-black text-white px-6 py-3 rounded-lg hover:bg-neutral-800 transition font-semibold text-center"
                  >
                    Add a username to apply
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
