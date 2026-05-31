import { Suspense } from 'react'
import NotificationsPageClient from './NotificationsPageClient'

export const dynamic = 'force-dynamic'

type NotificationsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

export default function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const accepted = Array.isArray(searchParams?.accepted)
    ? searchParams?.accepted[0] === '1'
    : searchParams?.accepted === '1'

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-50">
          <div className="mx-auto max-w-4xl px-6 py-12 text-neutral-600">Loading notifications...</div>
        </main>
      }
    >
      <NotificationsPageClient initialAccepted={accepted} />
    </Suspense>
  )
}
