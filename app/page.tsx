'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, MapPin, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Listing = {
  id: string | number
  title: string
  location?: string | null
  offer?: number | string | null
  poster_username?: string | null
  poster_avatar_url?: string | null
  type: 'job' | 'service'
  created_at: string
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [filteredListings, setFilteredListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
    try {
      if (showLoading) setLoading(true)
      const res = await fetch('/api/listings')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Listings API error:', data)
        setLoading(false)
        return
      }

      const data = await res.json()
      const merged = data?.listings ?? []
      setListings(merged.slice(0, 5))
      setFilteredListings(merged.slice(0, 5))
    } catch (err) {
      console.error('Fetch listings error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initListings() {
      await fetchListings()

      // Try to set up realtime subscriptions (best-effort)
      try {
        const jobsSubscription = supabase
          .channel('jobs-home')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'jobs' },
            () => {
              fetchListings(false)
            }
          )
          .subscribe()

        const servicesSubscription = supabase
          .channel('services-home')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'services' },
            () => {
              fetchListings(false)
            }
          )
          .subscribe()

        return () => {
          try {
            jobsSubscription.unsubscribe()
            servicesSubscription.unsubscribe()
          } catch {}
        }
      } catch (e) {
        // Realtime disabled — continue using server fetch
        // eslint-disable-next-line no-console
        console.warn('Realtime disabled for home listings:', e)
      }
    }

    initListings()
  }, [fetchListings])

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
    setRefreshing(false)
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">MOOLABASE</h1>
            <div className="flex gap-2 sm:gap-3">
              <Link
                href="/signup"
                className="px-3 sm:px-4 py-2 border border-black rounded-md hover:bg-neutral-50 transition font-medium text-sm sm:text-base"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="px-3 sm:px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 transition font-medium text-sm sm:text-base"
              >
                Log In
              </Link>
            </div>
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
            href="/post/jobs/service"
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
            const href = listing.type === 'service' ? `/post/jobs/service/${listing.id}` : `/post/jobs/${listing.id}`

            return (
              <Link key={`${listing.type}-${String(listing.id)}`} href={href} className="block">
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
                        <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight line-clamp-2">
                          {listing.title}
                        </h3>
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
                    Offer: {listing.offer !== null && listing.offer !== undefined ? `R ${Number(listing.offer).toLocaleString()}` : 'Not specified'}
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

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <div className="mt-12 border-t border-neutral-200"></div>
      </div>

      {/* Info Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-10 pb-10 sm:pt-12 sm:pb-12">
        <div className="max-w-3xl mx-auto space-y-4">
          <details className="bg-white border border-neutral-200 rounded-xl p-5">
            <summary className="cursor-pointer text-lg font-semibold text-neutral-900">About</summary>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mt-3">
              Moolabase is a free community-driven platform that connects people who need jobs done with individuals offering local or remote services.

              Users can post jobs, offer services, apply to opportunities, and connect directly, without fees, middlemen, or commissions.

              The goal is simple: make it easier for people to find work and get things done.
            </p>
          </details>
          <details className="bg-white border border-neutral-200 rounded-xl p-5">
            <summary className="cursor-pointer text-lg font-semibold text-neutral-900">Contact</summary>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mt-3">
              For questions, support, or general enquiries, contact us at:

              moolabaseorg@gmail.com
            </p>
          </details>
          <details className="bg-white border border-neutral-200 rounded-xl p-5">
            <summary className="cursor-pointer text-lg font-semibold text-neutral-900">Privacy Policy</summary>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mt-3">
              Moolabase respects your privacy.

              We only collect information necessary to operate the platform, such as profile details, job listings, service listings, and messages between users.

              We do not sell personal data to third parties. Uploaded content and profile information are visible only as required for platform functionality.

              By using the platform, you consent to the collection and use of information as described above.
            </p>
          </details>
          <details className="bg-white border border-neutral-200 rounded-xl p-5">
            <summary className="cursor-pointer text-lg font-semibold text-neutral-900">Terms of Use</summary>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap mt-3">
              Moolabase is provided as a free platform for connecting job posters and service providers.

              Users are responsible for the accuracy of the information they post and for any interactions they engage in.

              Moolabase does not guarantee job outcomes, service quality, or user conduct.

              Misuse of the platform, including fraud or harassment, may result in account suspension or removal.
            </p>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-sm text-neutral-600 text-transparent relative">
          <span className="text-neutral-600">&copy; 2025 MoolaBase.</span>
          © 2025 MoolaBase.
        </div>
      </footer>
    </main>
  )
}



