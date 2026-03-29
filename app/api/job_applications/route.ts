import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { insertNotificationRobust } from '@/lib/notifications/insertNotification'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

// Helper to get Job owner
async function getJobOwner(supabase: any, jobId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const record = (data || {}) as any
  return {
    ownerId: (record.poster_id as string | null) ?? (record.user_id as string | null) ?? null,
    title: (record.title as string | null) ?? null,
  }
}

// Helper to get applicant details
async function getApplicant(supabase: any, userId: string) {
  const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
  const emailColumn = await resolveColumn(supabase as any, 'profiles', 'email', 'id')
  const selectColumns =
    emailColumn === 'email' ? `username, email, ${avatarColumn}` : `username, ${avatarColumn}`
  const { data, error } = await supabase
    .from('profiles')
    .select(selectColumns)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const profile = (data || {}) as any
  return {
    username: (profile.username as string | null) ?? null,
    email: emailColumn === 'email' ? ((profile.email as string | null) ?? null) : null,
    avatar_url: (profile?.[avatarColumn] as string | null) ?? null,
  }
}

// Helper to enrich applications with profile data
async function enrichWithProfiles(supabase: any, applications: any[], applicantColumn: string) {
  const userIds = Array.from(
    new Set(applications.map((app) => app?.[applicantColumn]).filter(Boolean))
  ) as string[]
  if (userIds.length === 0) return applications

  const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`id, username, ${avatarColumn}`)
    .in('id', userIds)

  const profileMap = new Map<string, { username: string | null; avatar_url: string | null }>(
    (profiles || []).map((p: any) => [
      p.id,
      { username: (p.username as string | null) ?? null, avatar_url: (p?.[avatarColumn] as string | null) ?? null },
    ])
  )

  return applications.map((app) => ({
    ...app,
    applicant_name: profileMap.get(app?.[applicantColumn])?.username || null,
    applicant_avatar_url: profileMap.get(app?.[applicantColumn])?.avatar_url || null,
  }))
}

async function insertApplicationRobust(
  supabase: any,
  payloads: any[]
) {
  let lastError: any = null

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from('job_applications')
      .insert(payload)
      .select()
      .single()

    if (!error) return { data, error: null }
    lastError = error

    const message = String(error.message || '').toLowerCase()
    const isSchemaMismatch =
      message.includes('column') ||
      message.includes('does not exist') ||
      message.includes('schema cache')

    if (!isSchemaMismatch) break
  }

  return { data: null, error: lastError }
}

/* eslint-disable no-console */
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const NUMERIC_ID_REGEX = /^\d+$/
const isSupportedListingId = (id: string) => UUID_REGEX.test(id) || NUMERIC_ID_REGEX.test(id)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')
    if (!jobId) return NextResponse.json({ error: 'Missing job_id' }, { status: 400 })

    if (!isSupportedListingId(jobId)) {
      console.warn('GET /api/job_applications received invalid job_id:', jobId)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ownerId } = await getJobOwner(supabase, jobId)
    if (!ownerId) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const applicantColumn = await resolveColumn(supabase as any, 'job_applications', 'user_id', 'applicant_id')
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const enriched = await enrichWithProfiles(supabase, data || [], applicantColumn)
    return NextResponse.json({ applications: enriched })
  } catch (e: any) {
    console.error(`Error in GET /api/job_applications:`, e)
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, motivation } = body
    if (!job_id) return NextResponse.json({ error: 'Missing job_id' }, { status: 400 })
    if (!isSupportedListingId(String(job_id))) {
      console.warn('POST /api/job_applications received invalid job_id:', job_id)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (!motivation) return NextResponse.json({ error: 'Motivation is required' }, { status: 400 })

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    const userId = user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const applicantColumn = await resolveColumn(supabase as any, 'job_applications', 'user_id', 'applicant_id')
    
    const { data: existing } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', job_id)
      .eq(applicantColumn, userId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'You have already applied' }, { status: 409 })
    }
    
    const { ownerId, title: jobTitle } = await getJobOwner(supabase, job_id)
    if (!ownerId) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (ownerId === userId) {
      return NextResponse.json({ error: 'You cannot apply to your own job' }, { status: 400 })
    }

    const applicant = await getApplicant(supabase, userId)
    const applicantName = applicant.username || user.user_metadata?.full_name || 'Applicant'
    const applicantEmail = applicant.email || user.email || `${userId}@moolabase.local`
    const basePayload = { job_id, [applicantColumn]: userId, message: motivation.trim() }

    const { data, error } = await insertApplicationRobust(supabase, [
      { ...basePayload, applicant_name: applicantName, applicant_email: applicantEmail, status: 'pending' },
      { ...basePayload, applicant_name: applicantName, applicant_email: applicantEmail },
      { ...basePayload, status: 'pending' },
      basePayload,
    ])

    if (error) {
      console.error('Error creating application:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for the job poster
    const listingTitle = jobTitle || 'Job listing'
    const notificationClient = (createServiceRoleClient() ?? supabase) as any
    const notificationResult = await insertNotificationRobust(notificationClient, {
      user_id: ownerId,
      sender_id: userId,
      type: 'job_application',
      reference_id: data.id,
      title: listingTitle,
      message: `${applicantName} applied for your "${listingTitle}" job.`,
      listing_type: 'job',
      listing_id: job_id,
      listing_title: listingTitle,
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      applicant_avatar_url: applicant.avatar_url,
      motivation: motivation.trim(),
      status: 'pending',
    })
    if (!notificationResult.ok) {
      console.warn('Failed to insert job application notification:', notificationResult.error)
    }

    return NextResponse.json({ application: data }, { status: 201 })
  } catch (e: any) {
    console.error(`Error in POST /api/job_applications:`, e)
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 })
  }
}
