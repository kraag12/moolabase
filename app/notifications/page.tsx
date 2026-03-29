'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ABORT_REASON } from '@/lib/abort-reason'

type Notification = {
  id: string
  notif_id?: string
  notification_type?: string
  application_id?: string
  listing_type?: 'job' | 'service'
  listing_id?: string
  conversation_id?: string | null
  title: string
  message?: string | null
  applicant_name?: string | null
  applicant_email?: string | null
  motivation?: string | null
  status?: string | null
  action_required?: boolean
  read?: boolean
  created_at: string
  applicant_avatar_url?: string | null
}

function formatTimeAgo(dateString: string) {
  const posted = new Date(dateString)
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - posted.getTime()) / 1000)

  if (!Number.isFinite(diffSec) || diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec} ${diffSec === 1 ? 'second' : 'seconds'} ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hr${diffHour === 1 ? '' : 's'} ago`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`

  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 4) return `${diffWeek} ${diffWeek === 1 ? 'week' : 'weeks'} ago`

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`

  const diffYear = Math.floor(diffDay / 365)
  return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`
}

function normalizeListingTitle(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 'your listing'

  const prefixed = trimmed.match(/new\s+(?:application|inquiry)\s+for\s+["“”'](.+?)["“”']/i)
  if (prefixed?.[1]) return prefixed[1].trim()

  const quoted = trimmed.match(/["“”'](.+?)["“”']/)
  if (quoted?.[1]) return quoted[1].trim()

  const dequoted = trimmed.replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim()
  return dequoted || trimmed
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const loadNotifications = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/notifications', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setNotifications([])
          return
        }

        const data = await res.json().catch(() => ({}))
        const items = Array.isArray(data?.notifications) ? data.notifications : []
        setNotifications(items)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          setNotifications([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadNotifications()

    return () => controller.abort(ABORT_REASON)
  }, [])

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Notifications</h1>
          <p className="mt-2 text-neutral-600">When someone applies to one of your posts, it will appear here.</p>
        </div>

        {loading && <p className="text-neutral-600">Loading notifications...</p>}

        {!loading && notifications.length === 0 && (
          <p className="text-neutral-600">No notifications yet.</p>
        )}

        <div className="grid gap-4">
          {notifications.map((notification) => {
            const rawUsername = String(notification.applicant_name || '').trim()
            const applicantUsername = rawUsername ? rawUsername.replace(/^@/, '') : ''
            const applicantLabel = applicantUsername || String(notification.applicant_email || '').trim() || 'Someone'
            const avatarSrc = notification.applicant_avatar_url || '/avatar-placeholder.svg'
            const listingType = notification.listing_type === 'service' ? 'service' : 'job'
            const isApplication =
              notification.notification_type === 'job_application' ||
              notification.notification_type === 'service_application' ||
              (!!notification.application_id && !!notification.listing_type)
            const timeAgo = formatTimeAgo(notification.created_at)
            const listingTitle = normalizeListingTitle(notification.title)
            const actionRequired = Boolean(notification.action_required) || Boolean(!notification.read)
            const status = String(notification.status || 'pending').toLowerCase()
            const statusLabel = status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending'
            const statusClasses =
              status === 'accepted'
                ? 'bg-green-50 text-green-800 border-green-200'
                : status === 'rejected'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'

            const listingId = String(notification.listing_id || '').trim()
            // if the backend provided a conversation id we want to go straight to chat
            const conversationId = String(notification.conversation_id || '').trim()
            const convoHref = conversationId ? `/messages/${encodeURIComponent(conversationId)}` : ''
            const applicationsHref =
              convoHref || (isApplication && listingId
                ? listingType === 'service'
                  ? `/post/jobs/service/${encodeURIComponent(listingId)}/applications?application=${encodeURIComponent(String(notification.application_id || notification.id))}`
                  : `/post/jobs/${encodeURIComponent(listingId)}/applications?application=${encodeURIComponent(String(notification.application_id || notification.id))}`
                : `/notifications/${encodeURIComponent(notification.id)}`)

            return (
              <Link
                key={notification.id}
                href={applicationsHref}
                className="group block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-neutral-300"
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                    <img src={avatarSrc} alt={applicantLabel} className="h-full w-full object-cover" />
                    {actionRequired && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-sm sm:text-base text-neutral-900 leading-snug">
                        {isApplication ? (
                          <>
                            <span className="font-semibold text-neutral-950">{applicantLabel}</span>{' '}
                            applied for your{' '}
                            <span className="font-semibold text-neutral-950">
                              &quot;{listingTitle}&quot;
                            </span>{' '}
                            {listingType}.
                          </>
                        ) : (
                          <span className="font-semibold text-neutral-950">{normalizeListingTitle(notification.title)}</span>
                        )}
                      </p>

                      <span className="shrink-0 text-xs text-neutral-500">{timeAgo}</span>
                    </div>

                    {isApplication && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-800">
                          {listingType === 'service' ? 'Service' : 'Job'}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses}`}>
                          {statusLabel}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {notification.conversation_id ? 'Tap to chat' : 'Tap to view applications'}
                        </span>
                      </div>
                    )}                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
