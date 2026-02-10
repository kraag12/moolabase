'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Notification = {
  application_id: string
  listing_type: 'job' | 'service'
  listing_id: string
  title: string
  applicant_name?: string
  motivation?: string
  status?: string
  created_at: string
  applicant_avatar_url?: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok) {
          setNotifications([])
          setLoading(false)
          return
        }
        const data = await res.json()
        if (mounted) setNotifications(data.notifications || [])
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [])

  async function updateStatus(item: Notification, status: 'accepted' | 'rejected') {
    if (processingId) return
    setProcessingId(item.application_id)
    try {
      const endpoint =
        item.listing_type === 'job'
          ? `/api/job_applications/${item.application_id}`
          : `/api/service_applications/${item.application_id}`

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('Status update failed', data?.error || res.statusText)
        return
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.application_id === item.application_id ? { ...n, status } : n
        )
      )

      if (status === 'accepted') {
        const conversationId = data?.conversation_id
        if (conversationId) {
          window.location.href = `/messages/${conversationId}`
        } else {
          window.location.href = '/messages'
        }
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-neutral-600">
            Review new applications and respond quickly.
          </p>
        </div>

        {loading && <p className="text-neutral-600">Loading...</p>}

        {!loading && notifications.length === 0 && (
          <p className="text-neutral-600">No notifications yet.</p>
        )}

        <div className="grid gap-4">
          {notifications.map((n) => {
            const listingHref =
              n.listing_type === 'job'
                ? `/post/jobs/${n.listing_id}`
                : `/post/jobs/service/${n.listing_id}`
            const status = n.status || 'pending'
            const statusClass =
              status === 'accepted'
                ? 'bg-green-100 text-green-700'
                : status === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-800'

            return (
              <div key={n.application_id} className="bg-white border border-neutral-200 rounded-2xl p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                      {n.applicant_avatar_url ? (
                        <img
                          src={n.applicant_avatar_url}
                          alt={n.applicant_name || 'Applicant'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-neutral-500">
                          {(n.applicant_name || 'NA')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-neutral-500">
                        {n.listing_type === 'job' ? 'Job application' : 'Service inquiry'}
                      </div>
                      <div className="font-semibold text-neutral-900">{n.title}</div>
                      <div className="text-sm text-neutral-600">
                        Applicant: {n.applicant_name || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 shrink-0">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>

                {n.motivation && (
                  <div className="mt-3 text-neutral-700 whitespace-pre-wrap">{n.motivation}</div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusClass}`}>
                    {status}
                  </span>
                  <Link
                    href={listingHref}
                    className="text-sm text-neutral-700 hover:text-black underline"
                  >
                    View listing
                  </Link>
                  {status === 'pending' && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => updateStatus(n, 'accepted')}
                        disabled={processingId === n.application_id}
                        className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 transition text-sm disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => updateStatus(n, 'rejected')}
                        disabled={processingId === n.application_id}
                        className="px-4 py-2 border border-neutral-300 rounded-md text-sm hover:bg-neutral-50 transition disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
