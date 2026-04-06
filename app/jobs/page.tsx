"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, RefreshCw, MapPin, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import HeaderAuthActions from '@/app/components/HeaderAuthActions'
import { fetchListingsClient } from '@/lib/listings/fetchListingsClient'
import { isAbortError } from '@/lib/errors/isAbortError'
import { getListingHref } from '@/lib/listings/url'
import { ABORT_REASON } from '@/lib/abort-reason'

type Listing = {
  id: string | number
  title: string
  location?: string
  offer?: number
  poster_username?: string | null
  poster_avatar_url?: string | null
  type: 'job' | 'service'
  created_at: string
  response_time?: string | null
}

const ITEMS_PER_PAGE = 10

export default function JobsPage() {
  const [allListings, setAllListings] = useState<Listing[]>([])
  const [filteredListings, setFilteredListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const isMountedRef = useRef(true)
  const fetchInFlightRef = useRef(false)
  const lastBackgroundRefreshRef = useRef(0)
  const fetchControllerRef = useRef<AbortController | null>(null)

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

  // Fetch all listings
  const fetchListings = useCallback(async (options?: { resetPage?: boolean; showLoading?: boolean }) => {
    fetchControllerRef.current?.abort(ABORT_REASON)
    const controller = new AbortController()
    fetchControllerRef.current = controller
    fetchInFlightRef.current = true

    const resetPage = options?.resetPage ?? true
    const showLoading = options?.showLoading ?? true

    try {
      if (showLoading && isMountedRef.current) {
        setLoading(true)
      }

      const res = await fetch('/api/listings', {
        cache: 'no-store',
        signal: controller.signal,
      })

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
        const errorDetails = {
          status: Number.isFinite(res.status) ? res.status : null,
          statusText: res.statusText || null,
          url: res.url || '/api/listings',
          ...data,
        }
        console.error('Listings API error:', JSON.stringify(errorDetails))
        try {
          const fallbackListings = await fetchListingsClient(supabase)
          if (isMountedRef.current) {
            setAllListings(fallbackListings)
            setFilteredListings(fallbackListings)
            if (resetPage) setCurrentPage(1)
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
      const listings = data?.listings ?? []
      if (isMountedRef.current) {
        setAllListings(listings)
        setFilteredListings(listings)
        if (resetPage) setCurrentPage(1)
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Fetch error:', err)
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
      void fetchListings({ resetPage: false, showLoading: false })
    }
  }, [fetchListings])

  // Fetch all listings on mount and set up refresh
  useEffect(() => {
    let jobsSubscription: ReturnType<typeof supabase.channel> | null = null
    let servicesSubscription: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    isMountedRef.current = true

    async function init() {
      await fetchListings({ resetPage: true, showLoading: true })
      if (cancelled) return

      // Try to set up realtime subscriptions (optional)
      try {
        jobsSubscription = supabase
          .channel('jobs-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'jobs' },
            () => {
              fetchListingsFromBackground()
            }
          )
          .subscribe()

        servicesSubscription = supabase
          .channel('services-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'services' },
            () => {
              fetchListingsFromBackground()
            }
          )
          .subscribe()
      } catch (e) {
        // If realtime setup fails, polling/manual refresh will still work.
        // eslint-disable-next-line no-console
        console.warn('Realtime disabled:', e)
      }
    }

    init()
    const interval = setInterval(() => {
      fetchListingsFromBackground()
    }, 20000)

    return () => {
      cancelled = true
      isMountedRef.current = false
      clearInterval(interval)
      fetchControllerRef.current?.abort(ABORT_REASON)
      try {
        jobsSubscription?.unsubscribe()
        servicesSubscription?.unsubscribe()
      } catch {}
    }
  }, [fetchListings, fetchListingsFromBackground])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchListings({ resetPage: false, showLoading: false })
    if (isMountedRef.current) setRefreshing(false)
  }

  // Filter based on search query
  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = allListings.filter(
      (listing) =>
        listing.title.toLowerCase().includes(query) ||
        (listing.location ?? '').toLowerCase().includes(query)
    )
    setFilteredListings(filtered)
    setCurrentPage(1)
  }, [searchQuery, allListings])

  // Calculate pagination
  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedListings = filteredListings.slice(startIndex, endIndex)

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl sm:text-4xl font-bold tracking-tight hover:text-neutral-700 transition">
              MOOLABASE
            </Link>
            <HeaderAuthActions />
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 grow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">All Jobs & Services</h1>
            <p className="text-neutral-600">
              {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {/* Search and Refresh */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-80">
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

        {loading && (
          <div className="text-center py-12">
            <p className="text-neutral-600">Loading listings...</p>
          </div>
        )}

        {!loading && filteredListings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600 text-lg">
              {searchQuery ? 'No listings match your search.' : 'No listings yet.'}
            </p>
          </div>
        )}

        {!loading && paginatedListings.length > 0 && (
          <>
            {/* Listings */}
            <div className="border-t border-neutral-200 mt-10 mb-8"></div>
            <div className="flex flex-col gap-4 mb-8">
              {paginatedListings.map((listing) => {
                if (!listing.id) return null
                const idStr = String(listing.id).trim()
                if (!idStr) return null
                const href = getListingHref(idStr, listing.type)

                return (
                  <Link key={`${listing.type}-${idStr}`} href={href} className="block">
                    <div className="bg-gradient-to-br from-white to-neutral-50 border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-xl hover:border-neutral-300 transition cursor-pointer w-full max-w-2xl mx-auto">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                            <img
                              src={listing.poster_avatar_url || '/avatar-placeholder.svg'}
                              alt={listing.poster_username || 'Profile'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900 leading-snug tracking-tight line-clamp-2">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-neutral-200">
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium transition ${
                    currentPage === 1
                      ? 'text-neutral-400 border border-neutral-200 cursor-not-allowed bg-neutral-50'
                      : 'border border-black text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Previous
                </button>

                <span className="text-neutral-600 font-medium text-sm sm:text-base">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium transition ${
                    currentPage === totalPages
                      ? 'text-neutral-400 border border-neutral-200 cursor-not-allowed bg-neutral-50'
                      : 'bg-black text-white hover:bg-neutral-800'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-neutral-600 flex flex-col sm:flex-row gap-6">
          <Link href="/about" className="hover:text-neutral-900 transition">
            About
          </Link>
          <Link href="/contact" className="hover:text-neutral-900 transition">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-neutral-900 transition">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900 transition">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  )
}
