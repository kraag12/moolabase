'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Application = {
  id: string
  applicant_name?: string | null
  applicant_email?: string | null
  applicant_avatar_url?: string | null
  motivation?: string | null
  message?: string | null
  status?: string | null
  created_at?: string | null
}

export default function ServiceApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string | undefined
  const selectedApplicationId = (searchParams.get('application') || '').trim() || null

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/service_applications?service_id=${id}`)
        if (!res.ok) return
        const data = await res.json()
        setApplications(data.applications || [])
      } catch (e) {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  useEffect(() => {
    if (!selectedApplicationId) return
    const target = document.getElementById(`application-${selectedApplicationId}`)
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [selectedApplicationId, applications.length])

  async function updateStatus(appId: string, status: string) {
    try {
      setUpdatingId(appId)
      const res = await fetch(`/api/service_applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const data = await res.json()
      setApplications(prev => prev.map(a => (a.id === appId ? { ...a, status: data.application?.status || status } : a)))
      if (status === 'accepted') {
        const conversationId = data?.conversation_id
        router.push(conversationId ? `/messages/${conversationId}` : '/messages')
      }
    } catch (e) {
      // ignore
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href={`/post/jobs/service/${id}`} className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">Back to service</Link>
        <h1 className="text-2xl font-bold mb-4">Service Inquiries</h1>

        {loading && <p className="text-neutral-600">Loading...</p>}

        {!loading && applications.length === 0 && (
          <p className="text-neutral-600">No inquiries yet.</p>
        )}

        <div className="grid gap-4">
          {applications.map((app) => {
            const isSelected = !!selectedApplicationId && String(app.id) === String(selectedApplicationId)
            const avatarSrc = app.applicant_avatar_url || '/avatar-placeholder.svg'
            const applicantLabel = (app.applicant_name || '').trim() || (app.applicant_email || '').trim() || 'Applicant'
            const status = (app.status || 'pending').toLowerCase()
            const statusLabel = status === 'accepted' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending'
            const statusClasses =
              status === 'accepted'
                ? 'bg-green-50 text-green-800 border-green-200'
                : status === 'rejected'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
            const motivation = (app.motivation || app.message || '').trim()
            const disabled = updatingId === app.id

            return (
              <div
                key={app.id}
                id={`application-${app.id}`}
                className={`bg-white border rounded-2xl p-5 shadow-sm ${isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-neutral-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                      <img src={avatarSrc} alt={applicantLabel} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-neutral-950 truncate">{applicantLabel}</div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClasses}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {app.created_at && (
                        <div className="text-sm text-neutral-600 mt-0.5">
                          Applied {new Date(app.created_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-neutral-500 font-semibold mb-2">Motivation</div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-neutral-800 whitespace-pre-wrap">
                    {motivation || 'No motivation provided.'}
                  </div>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => updateStatus(app.id, 'accepted')}
                    disabled={disabled}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-60"
                  >
                    {disabled ? 'Updating...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'rejected')}
                    disabled={disabled}
                    className="flex-1 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-semibold border border-red-200 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
