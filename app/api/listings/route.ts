import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const jobsOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
    const servicesOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')

    const [{ data: jobs, error: jobsError }, { data: services, error: servicesError }] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('services').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    if (jobsError || servicesError) {
      console.error('Listings fetch error:', jobsError || servicesError)
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
    }

    const normalizedJobs = (jobs || []).map((j: any) => ({
      ...j,
      type: 'job',
      poster_id: j?.[jobsOwnerColumn] ?? null,
    }))
    const normalizedServices = (services || []).map((s: any) => ({
      ...s,
      type: 'service',
      poster_id: s?.[servicesOwnerColumn] ?? null,
    }))

    const ownerIds = Array.from(
      new Set(
        [...normalizedJobs, ...normalizedServices]
          .map((item: any) => item.poster_id)
          .filter(Boolean)
      )
    ) as string[]

    if (ownerIds.length > 0) {
      const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`id, username, ${avatarColumn}`)
        .in('id', ownerIds)

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

    const merged = [...normalizedJobs, ...normalizedServices].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({ listings: merged })
  } catch (err: any) {
    // Detect missing table error (relation does not exist)
    const msg = String(err?.message || err)
    if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
      return NextResponse.json({ error: 'Database table missing. Run migrations to create required tables.' }, { status: 500 })
    }

    console.error('Unexpected listings error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
