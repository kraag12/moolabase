'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ApplyServicePageLegacy() {
  const { id } = useParams()
  const router = useRouter()

  useEffect(() => {
    if (id) {
      router.replace(`/post/jobs/service/${id}`)
    }
  }, [id, router])

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-2">Service applications have moved</h1>
          <p className="text-neutral-600 mb-4">
            You can now request services directly on the service detail page.
          </p>
          <Link
            href={id ? `/post/jobs/service/${id}` : '/jobs'}
            className="inline-flex px-4 py-2 bg-black text-white rounded-md font-semibold hover:bg-neutral-800 transition"
          >
            Go to service listing
          </Link>
        </div>
      </section>
    </main>
  )
}
