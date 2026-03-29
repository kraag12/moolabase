'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ABORT_REASON } from '@/lib/abort-reason'

type Notification = {
  id: string
  notif_id?: string
  notification_type?: string
  application_id?: string
  listing_type?: 'job' | 'service'
  listing_id?: string
  title: string
  message?: string | null
  applicant_id?: string | null
  applicant_name?: string | null
  applicant_email?: string | null
  motivation?: string | null
  status?: string | null
  action_required?: boolean
  read?: boolean
  created_at: string
  applicant_avatar_url?: string | null
  conversation_id?: string
}

function formatApplicantLabel(name?: string | null) {
  const raw = String(name || '').trim()
  const normalized = raw ? raw.replace(/^@/, '') : ''
  return normalized ? `@${normalized}` : '@unknown'
}

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const [notification, setNotification] = useState<Notification | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      try {
        const res = await fetch('/api/notifications', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          if (!cancelled) setNotification(null)
          return
        }

        const data = await res.json().catch(() => ({}))
        const notifs = Array.isArray(data?.notifications) ? data.notifications : []
        const found = notifs.find((n: any) => String(n?.id) === id)

        if (cancelled) return
        if (!found) {
          setNotification(null)
          return
        }

        setNotification(found)

        if (found.notif_id && !found.read) {
          fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: found.notif_id, read: true }),
            signal: controller.signal,
          }).catch(() => {})
        }
      } catch {
        if (!cancelled) setNotification(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    mountedRef.current = true
    void run()

    return () => {
      cancelled = true
      mountedRef.current = false
      controller.abort(ABORT_REASON)
    }
  }, [id])

  async function handleDecision(nextStatus: 'accepted' | 'rejected') {
    if (processing) return
    if (!notification?.listing_type) return

    const applicationId = String(notification.application_id || notification.id || '').trim()
    if (!applicationId) return

    setProcessing(true)
    const controller = new AbortController()

    try {
      const endpoint =
        notification.listing_type === 'job'
          ? `/api/job_applications/${applicationId}`
          : `/api/service_applications/${applicationId}`

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
        signal: controller.signal,
      })

      if (!res.ok) return

      const data = await res.json().catch(() => ({}))

      if (mountedRef.current) {
        setNotification((prev) =>
          prev
            ? {
                ...prev,
                status: nextStatus,
                action_required: false,
                read: true,
                conversation_id: data.conversation_id || prev.conversation_id,
              }
            : prev
        )
      }

      if (nextStatus === 'accepted' && data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`)
      } else {
        router.push('/notifications')
      }
    } catch (error) {
      // navigation/unmount can abort in-flight requests; ignore those
      const name = (error as any)?.name
      if (name !== 'AbortError') {
        console.error('Failed to update application status:', error)
      }
    } finally {
      if (mountedRef.current) setProcessing(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-neutral-600">Loading...</div>
      </main>
    )
  }

  if (!notification) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-neutral-600">Page not found</div>
      </main>
    )
  }

  const isApplication =
    notification.notification_type === 'job_application' ||
    notification.notification_type === 'service_application' ||
    !!notification.application_id

  if (!isApplication || !notification.listing_type) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-neutral-600">Page not found</div>
      </main>
    )
  }

  const applicantLabel = formatApplicantLabel(notification.applicant_name)
  const motivation = String(notification.motivation || '').trim()
  const rawUsername = String(notification.applicant_name || '').trim().replace(/^@/, '')

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
            {notification.applicant_avatar_url ? (
              <img
                src={notification.applicant_avatar_url}
                alt={applicantLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-lg font-bold text-neutral-600">
                {(rawUsername || 'U').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-neutral-900">{applicantLabel}</div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-800 whitespace-pre-wrap">
            {motivation || 'No motivation provided.'}
          </p>
        </div>

        {/* only show accept/reject for original application notifications */}
        {(notification.notification_type === 'job_application' ||
          notification.notification_type === 'service_application') && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleDecision('accepted')}
              disabled={processing}
              className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleDecision('rejected')}
              disabled={processing}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        )}

        {/* if this notification has a conversation link (e.g. acceptance), show chat button */}
        {notification.conversation_id &&
          !(notification.notification_type === 'job_application' ||
            notification.notification_type === 'service_application') && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => router.push(`/messages/${notification.conversation_id}`)}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Go to chat
              </button>
            </div>
          )}
      </div>
    </main>
  )
}
