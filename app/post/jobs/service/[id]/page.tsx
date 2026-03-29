'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getListingHref } from '@/lib/listings/url'

export default function ServicePageRedirect() {
  const params = useParams()
  const router = useRouter()
  const rawId = typeof params?.id === 'string' ? params.id : ''
  const id = rawId.trim()

  useEffect(() => {
    if (!id) return
    router.replace(getListingHref(id, 'service'))
  }, [id, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-neutral-500">Loading...</div>
    </div>
  )
}

