import { isListingExpired } from './expiration'
import { resolveColumn } from '../supabase/schema'
import { isAbortError } from '../errors/isAbortError'
import { ABORT_REASON } from '../abort-reason'

type ListingProfile = {
  username: string | null
  avatar_url: string | null
}

export async function fetchListingsClient(supabase: any) {
  const [{ data: jobs, error: jobsError }, { data: services, error: servicesError }] = await Promise.all([
    supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('services').select('*').order('created_at', { ascending: false }).limit(100),
  ])

  if (jobsError || servicesError) {
    const message = jobsError?.message || servicesError?.message || 'Failed to fetch listings'
    if (isAbortError(jobsError) || isAbortError(servicesError) || isAbortError(message)) {
      // Normalize aborted requests so callers can reliably ignore them.
      throw ABORT_REASON
    }
    throw new Error(message)
  }

  const normalizedJobs = (jobs || [])
    .filter((job: any) => !isListingExpired(job?.created_at, job?.duration))
    .map((job: any) => ({
      ...job,
      type: 'job',
      poster_id: job?.poster_id ?? job?.user_id ?? null,
    }))

  const normalizedServices = (services || [])
    .filter((service: any) => !isListingExpired(service?.created_at, service?.duration))
    .map((service: any) => ({
      ...service,
      type: 'service',
      poster_id: service?.poster_id ?? service?.user_id ?? null,
    }))

  const ownerIds = Array.from(
    new Set(
      [...normalizedJobs, ...normalizedServices]
        .map((item: any) => item.poster_id)
        .filter(Boolean)
        .filter((id: any) => typeof id === 'string' && id.length === 36) // Basic UUID validation
    )
  )

  if (ownerIds.length > 0) {
    try {
      const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`id, username, ${avatarColumn}`)
        .in('id', ownerIds)
      
      if (profilesError) {
        if (!isAbortError(profilesError)) {
          console.error('Failed to fetch profiles in client fallback:', {
            error: profilesError,
            message: profilesError?.message,
            details: profilesError?.details,
            hint: profilesError?.hint,
            code: profilesError?.code,
            ownerIds,
            avatarColumn,
          })
        }
        // Continue without profiles - listings will show without usernames
      } else {
        const profileMap = new Map<string, ListingProfile>(
          (profiles || []).map((profile: any) => [
            profile.id,
            {
              username: (profile.username as string | null) ?? null,
              avatar_url: profile[avatarColumn] || null,
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
      if (!isAbortError(error)) {
        console.error('Exception during profile fetching in client fallback:', error)
      }
      // Continue without profiles - listings will show without usernames
    }
  }

  return [...normalizedJobs, ...normalizedServices]
    .filter((item: any) => item && item.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
