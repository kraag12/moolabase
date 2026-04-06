'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import HeaderAuthActions from './components/HeaderAuthActions'
import { fetchListingsClient } from '@/lib/listings/fetchListingsClient'
import { getListingHref } from '@/lib/listings/url'
import { isAbortError } from '@/lib/errors/isAbortError'

type Listing = {
  id: string | number
  title: string
  location?: string | null
  offer?: number | string | null
  poster_username?: string | null
  poster_avatar_url?: string | null
  type: 'job' | 'service'
  created_at: string
  response_time?: string
}

type ListingsApiErrorDetails = {
  status: number | null
  statusText: string | null
  url: string
  details?: unknown
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [filteredListings, setFilteredListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isMountedRef = useRef(true)
  const fetchInFlightRef = useRef(false)
  const lastBackgroundRefreshRef = useRef(0)

  const formatTimeAgo = (dateString: string) => {
    const posted = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - posted.getTime()) / 1000)
    if (diffSec < 5) return 'just now'
    if (diffSec < 60) return `${diffSec} ${diffSec === 1 ? 'second' : 'seconds'} ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`
    const diffWeek = Math.floor(diffDay / 7)
    if (diffWeek < 4) return `${diffWeek} ${diffWeek === 1 ? 'week' : 'weeks'} ago`
    const diffMonth = Math.floor(diffDay / 30)
    if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`
    const diffYear = Math.floor(diffDay / 365)
    return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`
  }

  const fetchListings = useCallback(async (showLoading = true) => {
    if (fetchInFlightRef.current) return
    fetchInFlightRef.current = true

    try {
      if (showLoading && isMountedRef.current) setLoading(true)
      const res = await fetch('/api/listings', { cache: 'no-store' })

      if (res.status === 304) {
        return
      }

      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        let data: Record<string, unknown> = {}
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            data = parsed && typeof parsed === 'object' ? parsed : { raw: String(parsed) }
          } catch {
            data = { raw }
          }
        }
        const errorDetails: ListingsApiErrorDetails = {
          status: Number.isFinite(res.status) ? res.status : null,
          statusText: res.statusText || null,
          url: res.url || '/api/listings',
          ...data,
        }
        const detailsMessage =
          typeof errorDetails.details === 'string'
            ? errorDetails.details.toLowerCase()
            : ''
        const isTransientFetchFailure = detailsMessage.includes('fetch failed')
        if (res.status !== 404) {
          if (isTransientFetchFailure) {
            console.warn('Listings API transient error, using client fallback.')
          } else {
            console.error('Listings API error:', JSON.stringify(errorDetails))
          }
        }
        try {
          const fallbackListings = await fetchListingsClient(supabase)
          if (isMountedRef.current) {
            setListings(fallbackListings.slice(0, 5))
            setFilteredListings(fallbackListings.slice(0, 5))
          }
        } catch (fallbackError) {
          const message = String((fallbackError as any)?.message || fallbackError || '').toLowerCase()
          const isTransientNetworkFailure =
            message.includes('failed to fetch') ||
            message.includes('fetch failed') ||
            message.includes('networkerror') ||
            message.includes('supabase.co')
          if (!isAbortError(fallbackError) && !isTransientNetworkFailure) {
            console.error('Listings fallback error:', fallbackError)
          }
        }
        return
      }

      const data = await res.json().catch(() => ({}))
      const merged = data?.listings ?? []
      if (isMountedRef.current) {
        setListings(merged.slice(0, 5))
        setFilteredListings(merged.slice(0, 5))
      }
    } catch (err) {
      // ignore abort errors triggered by navigation/unmount
      if (!isAbortError(err)) {
        console.error('Fetch listings error:', err)
      }
    } finally {
      fetchInFlightRef.current = false
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const fetchListingsFromBackground = useCallback(() => {
    const now = Date.now()
    if (now - lastBackgroundRefreshRef.current < 3000) return
    lastBackgroundRefreshRef.current = now
    if (isMountedRef.current) {
      void fetchListings(false).catch((err) => {
        if (!isAbortError(err)) console.error('Background listings fetch failed:', err)
      })
    }
  }, [fetchListings])

  useEffect(() => {
    let jobsSubscription: ReturnType<typeof supabase.channel> | null = null
    let servicesSubscription: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    isMountedRef.current = true

    ;(async () => {
      await fetchListings()
      if (cancelled) return

      try {
        jobsSubscription = supabase
          .channel('jobs-home')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'jobs' },
            () => {
              fetchListingsFromBackground()
            }
          )
          .subscribe()

        servicesSubscription = supabase
          .channel('services-home')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'services' },
            () => {
              fetchListingsFromBackground()
            }
          )
          .subscribe()
      } catch (e) {
        // Realtime disabled, polling/manual refresh still works.
        console.warn('Realtime disabled for home listings:', e)
      }
    })()

    const interval = setInterval(() => {
      fetchListingsFromBackground()
    }, 20000)

    return () => {
      cancelled = true
      isMountedRef.current = false
      clearInterval(interval)
      try {
        jobsSubscription?.unsubscribe()
        servicesSubscription?.unsubscribe()
      } catch {}
    }
  }, [fetchListings, fetchListingsFromBackground])

  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = listings.filter(
      (listing) =>
        listing.title.toLowerCase().includes(query) ||
        (listing.location ?? '').toLowerCase().includes(query)
    )
    setFilteredListings(filtered)
  }, [searchQuery, listings])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchListings(false)
    if (isMountedRef.current) setRefreshing(false)
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">MOOLABASE</h1>
            <HeaderAuthActions />
          </div>
        </div>
      </header>

      {/* Hero / Actions */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-neutral-700 mb-8 sm:mb-12 font-medium">
          Find jobs. Discover services. Get things done.
        </h2>

        <div className="flex flex-col items-center gap-3 sm:gap-4 mb-12">
          <Link
            href="/post/jobs"
            className="w-full sm:w-80 bg-black text-white py-3 rounded-lg font-semibold hover:bg-neutral-800 transition shadow-sm"
          >
            Post a Job
          </Link>

          <Link
            href="/post/services"
            className="w-full sm:w-80 border border-black py-3 rounded-lg font-semibold hover:bg-black hover:text-white transition bg-white"
          >
            Offer a Service
          </Link>
        </div>

        <hr className="border-neutral-300 mb-8" />
      </section>

      {/* Listings Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-16 sm:pb-20 grow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 sm:gap-6 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">Recent Jobs & Services</h2>

          {/* Search + Refresh */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                placeholder="Search keyword or location"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-green-200 bg-green-100 text-green-800 hover:bg-green-200 transition disabled:opacity-60 font-medium"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {loading && <p className="text-neutral-600 text-center py-8">Loading listings...</p>}

        {!loading && filteredListings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600 text-lg">
              {searchQuery ? 'No listings match your search.' : 'No listings yet. Be the first to post!'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {filteredListings.map((listing) => {
            // ensure we have an id and type before linking
            if (!listing.id) return null
            const idStr = String(listing.id).trim()
            if (!idStr) {
              return null
            }
            // navigate to the public detail page for the listing
            const href = getListingHref(idStr, listing.type)

            return (
              <Link key={`${listing.type}-${idStr}`} href={href} className="block">
                <div className="bg-linear-to-br from-white to-neutral-50 border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-neutral-300 transition cursor-pointer w-full max-w-2xl mx-auto">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                        <Image
                          src={listing.poster_avatar_url || '/avatar-placeholder.svg'}
                          alt={listing.poster_username || 'Profile'}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight line-clamp-2">
                            {listing.title}
                          </h3>
                          {listing.type === 'job' && listing.response_time === 'urgent' && (
                            <div className="flex items-center gap-1 text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={12} />
                              <span className="text-xs font-semibold">URGENT</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500">
                          @{listing.poster_username || 'member'}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-neutral-900 text-white">
                      {listing.type === 'job' ? 'Job' : 'Service'}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-800 mb-1">
                    {listing.type === 'service' ? 'Rate' : 'Offer'}:{' '}
                    {listing.offer !== null && listing.offer !== undefined ? `R ${Number(listing.offer).toLocaleString()}` : 'Not specified'}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-neutral-600 mb-2">
                    <MapPin size={14} className="text-neutral-500" />
                    <span>Location: {listing.location || 'Not specified'}</span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Posted {formatTimeAgo(listing.created_at)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* View More Button */}
        {!loading && filteredListings.length > 0 && !searchQuery && (
          <div className="flex justify-center mt-12">
            <Link
              href="/jobs"
              className="px-8 py-3 bg-black text-white rounded-lg font-semibold hover:bg-neutral-800 transition"
            >
              View More Listings
            </Link>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-sm text-neutral-600 flex justify-between items-center">
          <span>&copy; 2025 MoolaBase.</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/terms" className="hover:underline">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
