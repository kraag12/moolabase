import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// notifications returned to client are a combination of application-derived
// items (for listing owners) and generic rows from the `notifications` table.
// the union has a fairly flexible shape so the UI can render both kinds.
type NotificationItem = {
  id: string // either the application id or the notification row id
  notif_id?: string // original notification table row id (for app notifications)
  notification_type?: string
  application_id?: string
  listing_type?: 'job' | 'service'
  listing_id?: string
  title: string
  message?: string | null
  applicant_id?: string | null
  applicant_name?: string | null
  applicant_email?: string | null
  motivation?: string | null
  status?: string | null
  action_required?: boolean
  read?: boolean
  created_at: string
  applicant_avatar_url?: string | null
  // new field carried through when the DB row includes it
  conversation_id?: string
}

function isMissingNotificationsTableError(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === 'PGRST205' ||
    message.includes("could not find the table 'public.notifications'") ||
    (message.includes('notifications') && message.includes('schema cache')) ||
    (message.includes('notifications') && message.includes('does not exist')) ||
    (message.includes('relation') && message.includes('notifications'))
  )
}

function isMissingColumnError(error: any, column: string) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('column') && message.includes(column.toLowerCase()) && message.includes('does not exist')
}

async function loadOwnerApplicationNotifications(
  supabase: any,
  userId: string,
  options?: { limit?: number }
): Promise<NotificationItem[]> {
  const rawLimit = options?.limit ?? 50
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50
  const jobsOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
  const servicesOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')

  const [{ data: jobs, error: jobsError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase.from('jobs').select(`id,title,${jobsOwnerColumn}`).eq(jobsOwnerColumn, userId),
      supabase.from('services').select(`id,title,${servicesOwnerColumn}`).eq(servicesOwnerColumn, userId),
    ])

  if (jobsError || servicesError) {
    throw new Error(jobsError?.message || servicesError?.message || 'Failed to fetch owner listings')
  }

  const jobIds = (jobs || []).map((item: any) => item.id).filter(Boolean)
  const serviceIds = (services || []).map((item: any) => item.id).filter(Boolean)
  const jobsById = new Map<string, any>((jobs || []).map((item: any) => [String(item.id), item]))
  const servicesById = new Map<string, any>((services || []).map((item: any) => [String(item.id), item]))

  let jobApplicantColumn = 'applicant_id'
  let serviceApplicantColumn = 'applicant_id'
  let jobApps: any[] = []
  let serviceApps: any[] = []

  if (jobIds.length > 0) {
    jobApplicantColumn = await resolveColumn(supabase as any, 'job_applications', 'user_id', 'applicant_id')
    let selectColumns = `id, job_id, ${jobApplicantColumn}, applicant_name, applicant_email, message, status, created_at`
    let { data, error } = await supabase
      .from('job_applications')
      .select(selectColumns)
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error && isMissingColumnError(error, 'status')) {
      selectColumns = `id, job_id, ${jobApplicantColumn}, applicant_name, applicant_email, message, created_at`
      const fallback = await supabase
        .from('job_applications')
        .select(selectColumns)
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
        .limit(limit)
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.warn('Failed to load job applications for notifications fallback:', error)
    } else if (data) {
      jobApps = data
    }
  }

  if (serviceIds.length > 0) {
    serviceApplicantColumn = await resolveColumn(supabase as any, 'service_applications', 'user_id', 'applicant_id')
    let selectColumns = `id, service_id, ${serviceApplicantColumn}, applicant_name, applicant_email, message, status, created_at`
    let { data, error } = await supabase
      .from('service_applications')
      .select(selectColumns)
      .in('service_id', serviceIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error && isMissingColumnError(error, 'status')) {
      selectColumns = `id, service_id, ${serviceApplicantColumn}, applicant_name, applicant_email, message, created_at`
      const fallback = await supabase
        .from('service_applications')
        .select(selectColumns)
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false })
        .limit(limit)
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.warn('Failed to load service applications for notifications fallback:', error)
    } else if (data) {
      serviceApps = data
    }
  }

  const fallbackNotifications: NotificationItem[] = [
    ...jobApps.map((app: any) => {
      const status = app.status || 'pending'
      return {
        id: `job-${String(app.id)}`,
        notification_type: 'job_application',
        application_id: String(app.id),
        listing_type: 'job' as const,
        listing_id: app.job_id != null ? String(app.job_id) : undefined,
        title: jobsById.get(String(app.job_id))?.title || 'Job application',
        applicant_id: app?.[jobApplicantColumn] ? String(app[jobApplicantColumn]) : null,
        applicant_name: app.applicant_name || null,
        motivation: app.message || null,
        status,
        action_required: status === 'pending',
        // no notifications table means no persisted read flag; treat non-pending as resolved
        read: status !== 'pending',
        created_at: app.created_at,
      }
    }),
    ...serviceApps.map((app: any) => {
      const status = app.status || 'pending'
      return {
        id: `service-${String(app.id)}`,
        notification_type: 'service_application',
        application_id: String(app.id),
        listing_type: 'service' as const,
        listing_id: app.service_id != null ? String(app.service_id) : undefined,
        title: servicesById.get(String(app.service_id))?.title || 'Service inquiry',
        applicant_id: app?.[serviceApplicantColumn] ? String(app[serviceApplicantColumn]) : null,
        applicant_name: app.applicant_name || null,
        motivation: app.message || null,
        status,
        action_required: status === 'pending',
        read: status !== 'pending',
        created_at: app.created_at,
      }
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return fallbackNotifications.slice(0, limit)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id

    if (!userId) return NextResponse.json({ notifications: [], count: 0 })

    const url = new URL(request.url)
    const summaryOnly = url.searchParams.get('summary') === '1'
    const requestedLimit = Number(url.searchParams.get('limit') || '')
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50

    const adminClient = createServiceRoleClient()
    const fallbackClient = (adminClient ?? supabase) as any

    // grab everything from the notifications table for the user
    const { data: rawNotifsData, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    let notificationsTableAvailable = true
    let rawNotifs = rawNotifsData || []
    if (notifError) {
      if (isMissingNotificationsTableError(notifError)) {
        notificationsTableAvailable = false
        rawNotifs = []
        console.warn('Notifications table missing; falling back to application-derived notifications only.')
      } else {
        console.error('Failed to fetch raw notifications:', notifError)
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
      }
    }

    // separate out application-style notifications so we can enrich them if
    // necessary. the database trigger now writes applicant/listing details
    // directly into the notification row, so in the common case we can just
    // use the raw notification values and avoid any extra lookups at all.
    const appRows = (rawNotifs || []).filter(
      (n: any) => n.type === 'job_application' || n.type === 'service_application'
    )
    const otherRows = (rawNotifs || []).filter(
      (n: any) => n.type !== 'job_application' && n.type !== 'service_application'
    )

    console.log('Raw notifications:', rawNotifs?.length || 0, 'application rows:', appRows.length)

    let notifications: NotificationItem[] = []

    if (!notificationsTableAvailable) {
      notifications = await loadOwnerApplicationNotifications(fallbackClient, userId, { limit })
    }

    // If there are no application-style rows in the notifications table, fall
    // back to application-derived notifications so owners still see new
    // applicants even if the `notifications` insert/trigger isn't configured.
    if (notificationsTableAvailable && appRows.length === 0) {
      notifications = await loadOwnerApplicationNotifications(fallbackClient, userId, { limit })
      notifications = notifications.concat(
        otherRows.map((row: any) => ({
          id: row.id,
          title: row.title || '',
          message: row.message || null,
          created_at: row.created_at,
          read: row.read ?? false,
        })) as any
      )
      notifications = notifications
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit)

      const pendingCount = notifications.filter((n) => n.action_required || !n.read).length
      if (summaryOnly) {
        return NextResponse.json({ count: pendingCount })
      }
      return NextResponse.json({ notifications, count: pendingCount })
    }

    // first, try to satisfy everything straight from the notification row
    if (appRows.length > 0) {
      notifications = appRows.map((row: any) => {
        return {
          id: row.reference_id || row.id,
          notif_id: row.id,
          notification_type: row.type,
          application_id: row.reference_id || row.id,
          listing_type: row.listing_type || (row.type === 'service_application' ? 'service' : 'job'),
          listing_id: row.listing_id || undefined,
          title: (row.listing_title as string) || row.title ||
            (row.type === 'service_application' ? 'Service inquiry' : 'Job application'),
          applicant_id: row.sender_id || null,
          applicant_name: row.applicant_name || null,
          applicant_email: row.applicant_email || null,
          motivation: row.motivation || row.message || null,
          status: row.status || 'pending',
          action_required: (row.status || 'pending') === 'pending',
          read: row.read ?? false,
          created_at: row.created_at,
          applicant_avatar_url: row.applicant_avatar_url || null,
          conversation_id: row.conversation_id || undefined,
        }
      })

      // if any notification still lacks a name (older rows before migration),
      // fall back to the old enrichment logic so we don't lose anything.
      const needEnrichment = notifications.some((n) => {
        if (!n.applicant_name) return true
        const isApplication = n.notification_type === 'job_application' || n.notification_type === 'service_application'
        if (isApplication && !n.listing_id) return true
        return false
      })
      if (!needEnrichment) {
        // we already filled everything, skip the heavier queries below
        notifications = notifications.concat(
          otherRows.map((row: any) => ({
            id: row.id,
            title: row.title || '',
            message: row.message || null,
            created_at: row.created_at,
            read: row.read ?? false,
          })) as any
        )
        // jump straight to count/response
        const pendingCount = notifications.filter((n) => n.action_required || !n.read).length
        console.log('Returning notifications:', notifications.map(n => ({ id: n.id, applicant_name: n.applicant_name, motivation: n.motivation, action_required: n.action_required })))
        if (summaryOnly) {
          return NextResponse.json({ count: pendingCount })
        }
        return NextResponse.json({ notifications: notifications, count: pendingCount })
      }
    }

    // --- fallback enrichment (only if some rows lacked data) ---
    if (appRows.length > 0) {
      // fetch listing titles owned by the user (used for display)
      const jobsOwnerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
      const servicesOwnerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')

      const [{ data: jobs, error: jobsError }, { data: services, error: servicesError }] =
        await Promise.all([
          supabase
            .from('jobs')
            .select(`id,title,${jobsOwnerColumn}`)
            .eq(jobsOwnerColumn, userId),
          supabase
            .from('services')
            .select(`id,title,${servicesOwnerColumn}`)
            .eq(servicesOwnerColumn, userId),
        ])

      if (jobsError || servicesError) {
        console.error('Notifications fetch error:', jobsError || servicesError)
        return NextResponse.json({ error: 'Failed to fetch listings for notifications' }, { status: 500 })
      }

      // collect referenced application ids from the notification rows
      const jobAppIds = appRows
        .filter((n: any) => n.type === 'job_application' && n.reference_id)
        .map((n: any) => String(n.reference_id))
      const serviceAppIds = appRows
        .filter((n: any) => n.type === 'service_application' && n.reference_id)
        .map((n: any) => String(n.reference_id))

      let jobApps: any[] = []
      let serviceApps: any[] = []
      let jobApplicantColumn = 'applicant_id'
      let serviceApplicantColumn = 'applicant_id'

      if (jobAppIds.length > 0) {
        jobApplicantColumn = await resolveColumn(supabase as any, 'job_applications', 'user_id', 'applicant_id')
        // Try to select with status first, fall back without if column doesn't exist
        let selectColumns = `id, job_id, ${jobApplicantColumn}, applicant_name, applicant_email, message, status, created_at`
        let { data, error } = await supabase
          .from('job_applications')
          .select(selectColumns)
          .in('id', jobAppIds)
        
        if (error && String(error.message).toLowerCase().includes('column') && String(error.message).toLowerCase().includes('does not exist')) {
          console.warn('Status column not found in job_applications, selecting without it')
          selectColumns = `id, job_id, ${jobApplicantColumn}, applicant_name, applicant_email, message, created_at`
          const fallback = await supabase
            .from('job_applications')
            .select(selectColumns)
            .in('id', jobAppIds)
          data = fallback.data
          error = fallback.error
        }
        
        if (error) {
          console.warn('Failed to load job applications for notifications:', error)
        } else if (data) {
          jobApps = data
        }
      }

      if (serviceAppIds.length > 0) {
        serviceApplicantColumn = await resolveColumn(supabase as any, 'service_applications', 'user_id', 'applicant_id')
        // Try to select with status first, fall back without if column doesn't exist
        let selectColumns = `id, service_id, ${serviceApplicantColumn}, applicant_name, applicant_email, message, status, created_at`
        let { data, error } = await supabase
          .from('service_applications')
          .select(selectColumns)
          .in('id', serviceAppIds)
        
        if (error && String(error.message).toLowerCase().includes('column') && String(error.message).toLowerCase().includes('does not exist')) {
          console.warn('Status column not found in service_applications, selecting without it')
          selectColumns = `id, service_id, ${serviceApplicantColumn}, applicant_name, applicant_email, message, created_at`
          const fallback = await supabase
            .from('service_applications')
            .select(selectColumns)
            .in('id', serviceAppIds)
          data = fallback.data
          error = fallback.error
        }
        
        if (error) {
          console.warn('Failed to load service applications for notifications:', error)
        } else if (data) {
          serviceApps = data
        }
      }

      notifications = [
        ...jobApps.map((app: any) => {
          const listing = ((jobs || []).find((j: any) => j.id === app.job_id) as any)
          const matching = appRows.find((r: any) => String(r.reference_id) === String(app.id))
          console.log('Building notification from job app:', app.id, 'applicant_id:', app[jobApplicantColumn], 'name:', app.applicant_name, 'status:', app.status)
          return {
            id: app.id,
            notification_type: 'job_application',
            application_id: app.id,
            listing_type: 'job' as const,
            listing_id: app.job_id,
            title: listing?.title || 'Job application',
            // we include both the raw applicant name stored on the application
            // row as well as the profile lookup below. this ensures there is
            // always some label available even if the profile fetch fails or the
            // user has no username set.
            applicant_id: app[jobApplicantColumn] || null,
            applicant_name: app.applicant_name || null,
            applicant_email: app.applicant_email || null,
            motivation: app.message || null,
            status: app.status || 'pending',
            action_required: (app.status || 'pending') === 'pending',
            read: matching ? Boolean(matching.read) : false,
            notif_id: matching ? matching.id : undefined,
            created_at: app.created_at,
          }
        }),
        ...serviceApps.map((app: any) => {
          const listing = ((services || []).find((s: any) => s.id === app.service_id) as any)
          const matching = appRows.find((r: any) => String(r.reference_id) === String(app.id))
          console.log('Building notification from service app:', app.id, 'applicant_id:', app[serviceApplicantColumn], 'name:', app.applicant_name, 'status:', app.status)
          return {
            id: app.id,
            notification_type: 'service_application',
            application_id: app.id,
            listing_type: 'service' as const,
            listing_id: app.service_id,
            title: listing?.title || 'Service inquiry',
            applicant_id: app[serviceApplicantColumn] || null,
            applicant_name: app.applicant_name || null,
            applicant_email: app.applicant_email || null,
            motivation: app.message || null,
            status: app.status || 'pending',
            action_required: (app.status || 'pending') === 'pending',
            read: matching ? Boolean(matching.read) : false,
            notif_id: matching ? matching.id : undefined,
            created_at: app.created_at,
          }
        }),
      ]

      // fallback if enrichment returned nothing (possible when listing row
      // was deleted or query failed); build minimal notifications from the
      // raw notification rows so the owner still sees something useful.
      if (notifications.length === 0 && appRows.length > 0) {
        console.warn('No application details retrieved; using raw notification rows as fallback')
        notifications = appRows.map((row: any) => {
          console.log('Building fallback notification from raw row:', row.id, 'sender_id:', row.sender_id)
          return {
            id: row.reference_id || row.id,
            notif_id: row.id,
            notification_type: row.type,
            application_id: row.reference_id || null,
            listing_type: row.type === 'service_application' ? 'service' : 'job',
            listing_id: undefined,
            title: row.title || (row.type === 'service_application' ? 'Service inquiry' : 'Job application'),
            applicant_id: row.sender_id || null,
            applicant_name: null,
            motivation: row.message || null,
            status: 'pending',
            action_required: true,
            read: row.read ?? false,
            created_at: row.created_at,
            conversation_id: row.conversation_id || undefined,
          }
        })
      }
    }

    // enrich applicant profile info for the app-derived notifications
    const applicantIds = Array.from(
      new Set(notifications.map((n) => n.applicant_id).filter(Boolean))
    ) as string[]
    console.log('Applicant IDs for profile enrichment:', applicantIds)

    if (applicantIds.length > 0) {
      const avatarColumn = await resolveColumn(fallbackClient as any, 'profiles', 'avatar_url', 'profile_picture_url')
      const { data: profiles } = await fallbackClient
        .from('profiles')
        .select(`id, username, ${avatarColumn}`)
        .in('id', applicantIds)

      const profileMap = new Map<string, { username: string | null; avatar_url: string | null }>(
        ((profiles as any[]) || []).map((profile: any) => [
          String(profile.id),
          {
            username: (profile.username as string | null) ?? null,
            avatar_url: (profile?.[avatarColumn] as string | null) ?? null,
          },
        ])
      )
      console.log('Profile map created:', Object.fromEntries(profileMap))

      notifications.forEach((item) => {
        if (!item.applicant_id) return
        const profile = profileMap.get(item.applicant_id)
        if (profile?.username) {
          item.applicant_name = profile.username
        }
        if (profile?.avatar_url) {
          item.applicant_avatar_url = profile.avatar_url
        }
        console.log('Enriched notification:', item.id, 'applicant_id:', item.applicant_id, 'name:', item.applicant_name, 'avatar:', item.applicant_avatar_url)
      })

      // log any notifications that still lack a name after enrichment
      notifications.forEach((n) => {
        if (!n.applicant_name) {
          console.warn('Notification missing applicant name after enrichment', n)
        }
      })
    }

    // convert the remaining generic notification rows into our shape
    const genericNotifications: NotificationItem[] = otherRows.map((row: any) => ({
      id: row.id,
      notif_id: row.id,
      notification_type: row.type,
      title: row.title || 'Notification',
      message: row.message,
      read: row.read ?? false,
      created_at: row.created_at,
      conversation_id: row.conversation_id || undefined,
    }))

    // merge and sort all notifications
    const all = [...notifications, ...genericNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const pendingCount = all.filter((n) => n.action_required || !n.read).length

    console.log('Returning notifications:', all.map(n => ({ id: n.id, applicant_name: n.applicant_name, motivation: n.motivation, action_required: n.action_required })))

    if (summaryOnly) {
      return NextResponse.json({ count: pendingCount })
    }

    return NextResponse.json({ notifications: all, count: pendingCount })
  } catch (error: any) {
    console.error('Notifications API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// allow clients to mark a notification as read (or unread)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { id, read } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const updates: any = {}
    updates.read = typeof read === 'boolean' ? read : true

    const { data, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      if (isMissingNotificationsTableError(error)) {
        return NextResponse.json({ notification: null, skipped: true })
      }
      console.error('Failed to update notification read flag:', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ notification: data || null })
  } catch (err: any) {
    console.error('Error in PATCH /api/notifications:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
