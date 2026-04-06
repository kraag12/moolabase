import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { insertNotificationRobust } from '@/lib/notifications/insertNotification'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

async function getServiceDetails(supabase: any, serviceId: string) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
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

    const applicantColumn = await resolveColumn(supabase as any, 'service_applications', 'user_id', 'applicant_id')

    const { data: current, error: fetchError } = await supabase
      .from('service_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const currentApp = current as any
    const { title: serviceTitle, ownerId } = await getServiceDetails(supabase, currentApp.service_id)
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
      .from('service_applications')
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
        try {
          posterUsername = await getPosterUsername(supabase, ownerId)
        } catch (profileError) {
          console.warn('Username lookup failed during acceptance:', profileError)
        }
        const ownerDisplay = posterUsername ? `@${posterUsername}` : 'the listing owner'

        const notificationClient = (createServiceRoleClient() ?? supabase) as any
        const applicantNotification = await insertNotificationRobust(notificationClient, {
          user_id: applicantId,
          sender_id: ownerId,
          type: 'service_application_accepted',
          reference_id: updatedApp.id,
          title: `Your application was accepted by ${ownerDisplay}`,
          message: serviceTitle
            ? `For "${serviceTitle}". Check Messages to start chatting.`
            : 'Check Messages to start chatting.',
          listing_type: 'service',
          listing_id: currentApp.service_id,
          conversation_id: conversationId,
        })
        if (!applicantNotification.ok) {
          console.warn('Failed to insert service acceptance notification:', applicantNotification.error)
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
    console.error('Error in PATCH service_applications:', e)
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 })
  }
}
