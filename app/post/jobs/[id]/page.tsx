'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getListingHref } from '@/lib/listings/url'

export default function JobPageRedirect() {
  const params = useParams()
  const router = useRouter()
  const rawId = typeof params?.id === 'string' ? params.id : ''
  const id = rawId.trim()

  useEffect(() => {
    if (!id) return
    // Defensive: if routing ever resolves `/post/jobs/service` through this dynamic
    // segment (e.g. due to cached redirects), ensure we land on the service form
    // instead of incorrectly treating "service" as a job listing id.
    if (id === 'service' || id === 'services') {
      router.replace('/post/jobs/service')
      return
    }
    router.replace(getListingHref(id, 'job'))
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-neutral-500">Loading...</div>
    </div>
  )
}
