import { Suspense } from 'react'
import ListingPageClient from './ListingPageClient'

export const dynamic = 'force-dynamic'

type ListingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function ListingPage({ searchParams }: ListingPageProps) {
  const getFirst = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0] || ''
    return value || ''
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-50 px-4 py-10">
          <div className="mx-auto max-w-5xl rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600 shadow-sm">
            Loading listing...
          </div>
        </main>
      }
    >
      <ListingPageClient
        initialId={getFirst(searchParams?.id)}
        initialType={(getFirst(searchParams?.type) as 'job' | 'service' | '') || ''}
        initialBoostPaymentId={getFirst(searchParams?.boost_payment)}
        initialBoostStatus={getFirst(searchParams?.boost_status)}
      />
    </Suspense>
  )
}
