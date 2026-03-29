import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { isListingExpired } from '@/lib/listings/expiration'

const LISTINGS_QUERY_RETRIES = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function createCleanupClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function cleanupExpiredListings(
  table: 'jobs' | 'services',
  ids: Array<string | number>
) {
  if (ids.length === 0) return

  const cleanupClient = createCleanupClient()
  if (!cleanupClient) return

  const { error } = await cleanupClient.from(table).delete().in('id', ids)
  if (error) {
    console.warn(`Failed to delete expired ${table}:`, error.message || error)
  }
}

function isRetryableSupabaseError(error: { message?: string | null } | null | undefined) {
  if (!error) return false
  const message = String(error.message || '').toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econn') ||
    message.includes('socket')
  )
}

async function fetchListingsWithRetry(supabase: any) {
  let jobsResult: { data: any[] | null; error: { message?: string | null } | null } = {
    data: null,
    error: null,
  }
  let servicesResult: { data: any[] | null; error: { message?: string | null } | null } = {
    data: null,
    error: null,
  }

  for (let attempt = 1; attempt <= LISTINGS_QUERY_RETRIES; attempt += 1) {
    ;[jobsResult, servicesResult] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('services').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    if (!jobsResult.error && !servicesResult.error) {
      break
    }

    const shouldRetry =
      attempt < LISTINGS_QUERY_RETRIES &&
      (isRetryableSupabaseError(jobsResult.error) || isRetryableSupabaseError(servicesResult.error))

    if (!shouldRetry) {
      break
    }

    await sleep(200 * attempt)
  }

  return {
    jobs: jobsResult.data || [],
    services: servicesResult.data || [],
    jobsError: jobsResult.error,
    servicesError: servicesResult.error,
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    const jobsOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
    const servicesOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')

    const { jobs, services, jobsError, servicesError } = await fetchListingsWithRetry(supabase)

    if (jobsError || servicesError) {
      console.error('Listings fetch error:', jobsError || servicesError)
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: jobsError?.message || servicesError?.message || null },
        { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    const activeJobs = (jobs || []).filter((job: any) => !isListingExpired(job?.created_at, job?.duration))
    const expiredJobIds = (jobs || [])
      .filter((job: any) => isListingExpired(job?.created_at, job?.duration))
      .map((job: any) => job.id)

    const activeServices = (services || []).filter(
      (service: any) => !isListingExpired(service?.created_at, service?.duration)
    )
    const expiredServiceIds = (services || [])
      .filter((service: any) => isListingExpired(service?.created_at, service?.duration))
      .map((service: any) => service.id)

    void Promise.allSettled([
      cleanupExpiredListings('jobs', expiredJobIds),
      cleanupExpiredListings('services', expiredServiceIds),
    ])

    const normalizedJobs = activeJobs
      .map((j: any) => ({
        ...j,
        type: 'job',
        poster_id: j?.[jobsOwnerColumn] ?? j?.user_id ?? null,
      }))

    const normalizedServices = activeServices
      .map((s: any) => ({
        ...s,
        type: 'service',
        poster_id: s?.[servicesOwnerColumn] ?? s?.user_id ?? null,
      }))

    const ownerIds = Array.from(
      new Set(
        [...normalizedJobs, ...normalizedServices]
          .map((item: any) => item.poster_id)
          .filter(Boolean)
          .filter((id: any) => typeof id === 'string' && id.length === 36) // Basic UUID validation
      )
    ) as string[]

    if (ownerIds.length > 0) {
      try {
        const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select(`id, username, ${avatarColumn}`)
          .in('id', ownerIds)
        
        if (profilesError) {
          console.error('Failed to fetch profiles:', profilesError)
          // Continue without profiles - listings will show without usernames
        } else {
          const profileMap = new Map(
            (profiles || []).map((profile: any) => [
              profile.id,
              {
                username: profile.username,
                avatar_url: profile[avatarColumn],
              },
            ])
          )

          normalizedJobs.forEach((item: any) => {
            const profile = profileMap.get(item.poster_id)
            if (profile) {
              item.poster_username = profile.username
              item.poster_avatar_url = profile.avatar_url
            }
          })

          normalizedServices.forEach((item: any) => {
            const profile = profileMap.get(item.poster_id)
            if (profile) {
              item.poster_username = profile.username
              item.poster_avatar_url = profile.avatar_url
            }
          })
        }
      } catch (error) {
        console.error('Exception during profile fetching:', error)
        // Continue without profiles - listings will show without usernames
      }
    }

    const merged = [...normalizedJobs, ...normalizedServices]
      .filter((item: any) => item && item.id)
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

    return NextResponse.json(
      { listings: merged },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err: any) {
    // Detect missing table error (relation does not exist)
    const msg = String(err?.message || err)
    if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
      return NextResponse.json(
        { error: 'Database table missing. Run migrations to create required tables.' },
        { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    console.error('Unexpected listings error:', err)
    return NextResponse.json(
      { error: 'Server error', details: msg || null },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }
}
