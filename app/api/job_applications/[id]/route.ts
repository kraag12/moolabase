import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { insertNotificationRobust } from '@/lib/notifications/insertNotification'

async function getJobDetails(supabase: any, jobId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const record = (data || {}) as any

  return {
    title: (record.title as string | null) ?? null,
    ownerId: (record.poster_id as string | null) ?? (record.user_id as string | null) ?? null,
  }
}

async function getPosterUsername(supabase: any, posterId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', posterId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.username as string | null
}

async function getUsername(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data?.username as string | null) ?? null
}

async function getOrCreateConversation(supabase: any, ownerId: string, applicantId: string) {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .or(
      `and(user_1_id.eq.${ownerId},user_2_id.eq.${applicantId}),and(user_1_id.eq.${applicantId},user_2_id.eq.${ownerId})`
    )
    .limit(1)

  if (findError) throw new Error(findError.message)
  if (existing && existing.length > 0) return existing[0]

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert([
      {
        user_1_id: ownerId,
        user_2_id: applicantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()

  if (createError) throw new Error(createError.message)
  return created?.[0]
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { status } = body
    const resolvedParams = await context.params
    const id = resolvedParams?.id as string | undefined

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 })
    if (!['accepted', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const applicantColumn = await resolveColumn(supabase as any, 'job_applications', 'user_id', 'applicant_id')

    const { data: current, error: fetchError } = await supabase
      .from('job_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const currentApp = current as any
    const { title: jobTitle, ownerId } = await getJobDetails(supabase, currentApp.job_id)
    if (!ownerId || ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let conversationId: string | null = null
    let acceptedApplicantId: string | null = null

    if (status === 'accepted') {
      acceptedApplicantId = (currentApp?.[applicantColumn] as string | null) ?? null
      if (!acceptedApplicantId) {
        return NextResponse.json({ error: 'Application applicant not found' }, { status: 500 })
      }

      const conversation = await getOrCreateConversation(supabase, ownerId, acceptedApplicantId)
      conversationId = conversation?.id ?? null
      if (!conversationId) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }
    }

    const { data, error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const updatedApp = data as any

    if (status === 'accepted') {
      try {
        const applicantId = acceptedApplicantId
        if (!applicantId || !conversationId) return NextResponse.json({ application: updatedApp, conversation_id: null })

        let posterUsername: string | null = null
        let applicantUsername: string | null = null
        try {
          posterUsername = await getPosterUsername(supabase, ownerId)
          applicantUsername = await getUsername(supabase, applicantId)
        } catch (profileError) {
          console.warn('Username lookup failed during acceptance:', profileError)
        }
        const ownerDisplay = posterUsername ? `@${posterUsername}` : 'the listing owner'
        const applicantDisplay = applicantUsername ? `@${applicantUsername}` : 'the applicant'

        const applicantNotification = await insertNotificationRobust(supabase as any, {
          user_id: applicantId,
          sender_id: ownerId,
          type: 'job_application_accepted',
          reference_id: updatedApp.id,
          title: `Application accepted for "${jobTitle}"`,
          message: `Your application has been accepted. You are now connected to ${ownerDisplay}. Start chatting now.`,
          listing_type: 'job',
          listing_id: currentApp.job_id,
          conversation_id: conversationId,
        })
        if (!applicantNotification.ok) {
          console.warn('Failed to insert job acceptance notification:', applicantNotification.error)
        }

        const ownerNotification = await insertNotificationRobust(supabase as any, {
          user_id: ownerId,
          sender_id: applicantId,
          type: 'job_application_connected',
          reference_id: updatedApp.id,
          title: 'Applicant connected',
          message: `You are now connected to ${applicantDisplay}. Start chatting now.`,
          listing_type: 'job',
          listing_id: currentApp.job_id,
          conversation_id: conversationId,
        })
        if (!ownerNotification.ok) {
          console.warn('Failed to insert owner connection notification:', ownerNotification.error)
        }

        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      } catch (e) {
        console.warn('Post-accept actions failed', e)
      }
    }

    return NextResponse.json({ application: updatedApp, conversation_id: conversationId })
  } catch (e: any) {
    console.error('Error in PATCH job_applications:', e)
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 })
  }
}
