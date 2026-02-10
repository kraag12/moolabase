import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

type NotificationItem = {
  application_id: string
  listing_type: 'job' | 'service'
  listing_id: string
  title: string
  applicant_id?: string | null
  applicant_name?: string | null
  motivation?: string | null
  status?: string | null
  created_at: string
  applicant_avatar_url?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) return NextResponse.json({ notifications: [], count: 0 })

    const summaryOnly = new URL(request.url).searchParams.get('summary') === '1'

    const jobsOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
    const servicesOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')

    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`id,title,${jobsOwnerColumn}`)
      .eq(jobsOwnerColumn, userId)

    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select(`id,title,${servicesOwnerColumn}`)
      .eq(servicesOwnerColumn, userId)

    if (jobsError || servicesError) {
      console.error('Notifications fetch error:', jobsError || servicesError)
      return NextResponse.json({ error: 'Failed to fetch listings for notifications' }, { status: 500 })
    }

    const jobIds = (jobs || []).map((job: any) => job.id)
    const serviceIds = (services || []).map((service: any) => service.id)

    const jobAppsPromise =
      jobIds.length > 0
        ? supabase
            .from('applications')
            .select('id, listing_id, listing_type, applicant_id, motivation, status, created_at')
            .in('listing_id', jobIds)
            .eq('listing_type', 'job')
        : Promise.resolve({ data: [] as any[] })

    const serviceAppsPromise =
      serviceIds.length > 0
        ? supabase
            .from('applications')
            .select('id, listing_id, listing_type, applicant_id, motivation, status, created_at')
            .in('listing_id', serviceIds)
            .eq('listing_type', 'service')
        : Promise.resolve({ data: [] as any[] })

    const [{ data: jobApps }, { data: serviceApps }] = await Promise.all([
      jobAppsPromise,
      serviceAppsPromise,
    ])

    const notifications: NotificationItem[] = [
      ...(jobApps || []).map((app: any) => {
        const listing = (jobs || []).find((j: any) => j.id === app.listing_id)
        return {
          application_id: app.id,
          listing_type: 'job',
          listing_id: app.listing_id,
          title: listing?.title || 'Job application',
          applicant_id: app.applicant_id,
          motivation: app.motivation,
          status: app.status,
          created_at: app.created_at,
        }
      }),
      ...(serviceApps || []).map((app: any) => {
        const listing = (services || []).find((s: any) => s.id === app.listing_id)
        return {
          application_id: app.id,
          listing_type: 'service',
          listing_id: app.listing_id,
          title: listing?.title || 'Service inquiry',
          applicant_id: app.applicant_id,
          motivation: app.motivation,
          status: app.status,
          created_at: app.created_at,
        }
      }),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const applicantIds = Array.from(
      new Set(notifications.map((n) => n.applicant_id).filter(Boolean))
    ) as string[]

    if (applicantIds.length > 0) {
      const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`id, username, ${avatarColumn}`)
        .in('id', applicantIds)

      const profileMap = new Map(
        (profiles || []).map((profile: any) => [
          profile.id,
          {
            username: profile.username,
            avatar_url: profile[avatarColumn],
          },
        ])
      )

      notifications.forEach((item) => {
        if (!item.applicant_id) return
        const profile = profileMap.get(item.applicant_id)
        if (profile?.username) item.applicant_name = profile.username
        if (profile?.avatar_url) item.applicant_avatar_url = profile.avatar_url
      })
    }

    const pendingCount = notifications.filter((n) => (n.status || 'pending') === 'pending').length

    if (summaryOnly) {
      return NextResponse.json({ count: pendingCount })
    }

    return NextResponse.json({ notifications, count: pendingCount })
  } catch (error: any) {
    console.error('Notifications API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
