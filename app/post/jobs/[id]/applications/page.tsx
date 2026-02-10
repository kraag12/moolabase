'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Application = {
  id: string
  applicant_name?: string
  motivation?: string
  status?: string
  created_at?: string
}

export default function JobApplicationsPage() {
  const params = useParams()
  const id = params?.id as string | undefined

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/job_applications?job_id=${id}`)
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

  async function updateStatus(appId: string, status: string) {
    try {
      const res = await fetch(`/api/job_applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const data = await res.json()
      setApplications(prev => prev.map(a => (a.id === appId ? { ...a, status: data.application?.status || status } : a)))
      if (status === 'accepted') {
        const conversationId = data?.conversation_id
        window.location.href = conversationId ? `/messages/${conversationId}` : '/messages'
      }
    } catch (e) {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href={`/post/jobs/${id}`} className="inline-block text-neutral-600 hover:text-neutral-900 mb-8 text-sm">Back to job</Link>
        <h1 className="text-2xl font-bold mb-4">Applications</h1>

        {loading && <p className="text-neutral-600">Loading...</p>}

        {!loading && applications.length === 0 && (
          <p className="text-neutral-600">No applications yet.</p>
        )}

        <div className="grid gap-4">
          {applications.map((app) => (
            <div key={app.id} className="bg-white border border-neutral-200 rounded-lg p-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-semibold">{app.applicant_name || 'Unknown'}</div>
                  {app.created_at && (
                    <div className="text-sm text-neutral-600">
                      Applied {new Date(app.created_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-sm text-neutral-500">{app.status || 'pending'}</div>
              </div>

              {app.motivation && <div className="mt-3 text-neutral-700">{app.motivation}</div>}

              <div className="mt-4 flex gap-3">
                <button onClick={() => updateStatus(app.id, 'accepted')} className="px-4 py-2 bg-green-600 text-white rounded">Accept</button>
                <button onClick={() => updateStatus(app.id, 'rejected')} className="px-4 py-2 bg-red-100 text-red-700 rounded border">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
