'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { isListingExpired } from '@/lib/listings/expiration'
import { fetchListingsClient } from '@/lib/listings/fetchListingsClient'
import { isAbortError } from '@/lib/errors/isAbortError'

type ListingType = 'job' | 'service'

type Listing = {
  id: string | number
  type: ListingType
  title?: string | null
  description?: string | null
  location?: string | null
  offer?: number | string | null
  work_type?: string | null
  response_time?: string | null
  duration?: string | null
  tools?: string | null
  image_url?: string[] | string | null
  poster_id?: string | null
  user_id?: string | null
}

const formatValue = (value?: string | null) => {
  if (!value) return 'Not specified'
  return value.replace(/_/g, ' ')
}

const normalizeImages = (value: Listing['image_url']) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
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

export default function ListingPage() {
  const searchParams = useSearchParams()
  const id = (searchParams.get('id') || '').trim()
  const type = (searchParams.get('type') || '').trim() as ListingType | ''
  const boostPaymentId = (searchParams.get('boost_payment') || '').trim()
  const boostStatus = (searchParams.get('boost_status') || '').trim().toLowerCase()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [motivation, setMotivation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [boostNotice, setBoostNotice] = useState<string | null>(null)

  const images = useMemo(() => normalizeImages(listing?.image_url).slice(0, 3), [listing?.image_url])
  const ownerId = listing?.poster_id || listing?.user_id || null
  const isOwner = !!userId && !!ownerId && userId === ownerId

  useEffect(() => {
    setLoading(true)
    setError(null)
    setListing(null)

    if (!id || (type !== 'job' && type !== 'service')) {
      setLoading(false)
      setError('Listing not found')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const endpoint = `/api/listing?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`
        const res = await fetch(endpoint, { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as Listing | null
          if (data && !isListingExpired((data as any)?.created_at, (data as any)?.duration)) {
            if (!cancelled) setListing(data)
            return
          }
        }

        // Client fallback: some Supabase setups enforce RLS policies that
        // require an authenticated client session. If the server route cannot
        // see the auth cookies, fall back to querying directly from the browser
        // Supabase client.
        const table = type === 'job' ? 'jobs' : 'services'
        const { data: fallback, error: fallbackError } = await supabase
          .from(table)
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (!fallbackError && fallback) {
          const record = fallback as any
          if (!isListingExpired(record?.created_at, record?.duration)) {
            if (!cancelled) {
              setListing({
                ...(record as any),
                type: type as ListingType,
                poster_id: record?.poster_id ?? record?.user_id ?? null,
              })
            }
            return
          }
        }

        // Final fallback: if the user can see the listing in the feed but the
        // direct lookup fails (schema mismatch, RLS/session, etc.), find it via
        // the merged listings endpoint or the client listings fallback.
        try {
          const mergedRes = await fetch('/api/listings', { cache: 'no-store' })
          if (mergedRes.ok) {
            const merged = await mergedRes.json().catch(() => null)
            const items = (merged as any)?.listings ?? []
            const found = items.find((it: any) => String(it?.id) === String(id) && it?.type === type)
            if (found && !isListingExpired(found?.created_at, found?.duration)) {
              if (!cancelled) setListing(found as Listing)
              return
            }
          }
        } catch {
          // ignore
        }

        try {
          const items = await fetchListingsClient(supabase as any)
          const found = items.find((it: any) => String(it?.id) === String(id) && it?.type === type)
          if (found && !isListingExpired(found?.created_at, found?.duration)) {
            if (!cancelled) setListing(found as Listing)
            return
          }
        } catch {
          // ignore
        }

        if (!cancelled) setError('Listing not found')
      } catch (err) {
        if (cancelled || isAbortError(err)) return
        setError('Listing not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, type])

  useEffect(() => {
    if (!boostPaymentId) return

    if (boostStatus === 'cancelled') {
      setBoostNotice('Boost checkout was cancelled.')
      return
    }
    if (boostStatus !== 'success') return

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/boosts/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_id: boostPaymentId }),
        })
        const data = await response.json().catch(() => ({}))
        if (cancelled) return

        if (response.ok) {
          setBoostNotice('Boost activated successfully.')
          return
        }

        setBoostNotice(data?.error || 'Payment received. Boost activation is pending.')
      } catch {
        if (!cancelled) setBoostNotice('Payment received. Boost activation is pending.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [boostPaymentId, boostStatus])

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

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!id || (type !== 'job' && type !== 'service')) return

    setSubmitError(null)
    setSuccess(false)

    if (!motivation.trim()) {
      setSubmitError('Motivation is required')
      return
    }

    setSubmitting(true)
    try {
      const endpoint = type === 'job' ? '/api/job_applications' : '/api/service_applications'
      const payload =
        type === 'job'
          ? { job_id: id, motivation: motivation.trim() }
          : { service_id: id, motivation: motivation.trim() }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          res.status === 409 ? 'You have already applied to this post' : data.error || 'Failed to submit application'
        setSubmitError(message)
        return
      }

      setSuccess(true)
      setMotivation('')
    } catch {
      setSubmitError('Server error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-500">Loading...</div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-600 text-center px-6">
          <p className="font-semibold mb-2">{error || 'Listing not found'}</p>
          <Link href="/jobs" className="text-sm underline">
            Back to listings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/jobs" className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">
          Back to listings
        </Link>

        {boostNotice && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {boostNotice}
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-8 space-y-8">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold text-neutral-900">
                {listing.title || (listing.type === 'job' ? 'Untitled job' : 'Untitled service')}
              </h1>
              <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-neutral-900 text-white shrink-0">
                {listing.type === 'job' ? 'Job' : 'Service'}
              </span>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
              <p className="text-xs uppercase text-neutral-500 font-semibold mb-2">Description</p>
              <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {listing.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
              <div className="border border-neutral-200 rounded-lg p-4">
                <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Location</p>
                <p className="text-lg font-semibold">{listing.location || 'Not specified'}</p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-4">
                <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">
                  {listing.type === 'service' ? 'Rate' : 'Offer'}
                </p>
                <p className="text-2xl font-bold">
                  {listing.offer !== null && listing.offer !== undefined ? `R ${Number(listing.offer).toLocaleString()}` : 'N/A'}
                </p>
              </div>

              {listing.type === 'job' && (
                <>
                  <div className="border border-neutral-200 rounded-lg p-4">
                    <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Work Type</p>
                    <p className="text-lg font-semibold capitalize">{formatValue(listing.work_type)}</p>
                  </div>
                  <div className="border border-neutral-200 rounded-lg p-4">
                    <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Response Time</p>
                    <p className="text-lg font-semibold capitalize">{formatValue(listing.response_time)}</p>
                  </div>
                  <div className="border border-neutral-200 rounded-lg p-4 sm:col-span-2">
                    <p className="text-xs uppercase text-neutral-500 font-semibold mb-1">Duration</p>
                    <p className="text-lg font-semibold capitalize">{formatValue(listing.duration)}</p>
                  </div>
                </>
              )}
            </div>

            {listing.type === 'service' && listing.tools && (
              <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200">
                <h3 className="font-semibold text-neutral-900 mb-3 uppercase text-xs">Tools</h3>
                <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">{listing.tools}</p>
              </div>
            )}

            {listing.type === 'service' && images.length > 0 && (
              <div>
                <h3 className="font-semibold text-neutral-900 mb-3 uppercase text-xs">Images</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {images.map((src, index) => (
                    <div key={`${src}-${index}`} className="border border-neutral-200 rounded-lg overflow-hidden">
                      <img
                        src={src}
                        alt={`${listing.title || 'Service'} image ${index + 1}`}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <section id="apply" className="mt-10">
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{listing.type === 'job' ? 'Apply' : 'Request'}</h2>

            {!authChecked && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Checking your account status...
              </div>
            )}

            {authChecked && !userId && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Please log in to {listing.type === 'job' ? 'apply for this job' : 'request this service'}.
              </div>
            )}

            {authChecked && userId && isOwner && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                You posted this listing. Applications are only for other users.
              </div>
            )}

            {authChecked && userId && !isOwner && !username && (
              <div className="bg-neutral-50 border border-neutral-200 text-neutral-700 px-4 py-3 rounded-lg">
                Please add a username to your profile before applying.
              </div>
            )}

            {authChecked && userId && !isOwner && username && (
              <form className="space-y-6 mt-6" onSubmit={handleApply}>
                <div>
                  <label className="font-semibold block mb-2 text-neutral-900">
                    {listing.type === 'job' ? 'Why are you a good candidate?' : 'Why do you need this service?'}
                  </label>
                  <textarea
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    rows={6}
                  />
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {submitError}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                    Submitted successfully.
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
                    {submitting ? 'Submitting...' : listing.type === 'job' ? 'Apply' : 'Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
