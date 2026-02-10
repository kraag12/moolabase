import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

async function getServiceWithOwner(supabase: any, serviceId: string) {
  const ownerColumn = await resolveColumn(supabase, 'services', 'poster_id', 'user_id')
  const { data, error } = await supabase
    .from('services')
    .select(`id,title,${ownerColumn}`)
    .eq('id', serviceId)
    .single()

  if (error) throw new Error(error.message)
  return { service: data, ownerId: data?.[ownerColumn] as string | null }
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

async function enrichWithProfiles(supabase: any, applications: any[]) {
  const applicantIds = Array.from(
    new Set(applications.map((app) => app.applicant_id).filter(Boolean))
  ) as string[]

  if (applicantIds.length === 0) return applications

  const avatarColumn = await resolveColumn(
    supabase as any,
    'profiles',
    'avatar_url',
    'profile_picture_url'
  )

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

  return applications.map((app) => {
    const profile = profileMap.get(app.applicant_id)
    return {
      ...app,
      applicant_name: profile?.username || null,
      applicant_avatar_url: profile?.avatar_url || null,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('service_id')
    if (!serviceId) return NextResponse.json({ error: 'Missing service_id' }, { status: 400 })

    const supabase = await createClient()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ownerId } = await getServiceWithOwner(supabase, serviceId)
    if (!ownerId || ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('applications')
      .select('id, listing_id, listing_type, applicant_id, motivation, status, created_at')
      .eq('listing_id', serviceId)
      .eq('listing_type', 'service')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = await enrichWithProfiles(supabase, data || [])
    return NextResponse.json({ applications: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { service_id, motivation, message } = body
    const finalMotivation = String(motivation ?? message ?? '').trim()

    if (!service_id) {
      return NextResponse.json({ error: 'Missing service_id' }, { status: 400 })
    }

    if (!finalMotivation) {
      return NextResponse.json({ error: 'Motivation is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ownerId } = await getServiceWithOwner(supabase, service_id)
    if (ownerId && ownerId === userId) {
      return NextResponse.json({ error: 'You cannot apply to your own service' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('listing_id', service_id)
      .eq('listing_type', 'service')
      .eq('applicant_id', userId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'You already applied to this service' }, { status: 409 })
    }

    const insertPayload: any = {
      listing_id: service_id,
      listing_type: 'service',
      applicant_id: userId,
      motivation: finalMotivation,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('applications')
      .insert([insertPayload])
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const application = data?.[0]
    return NextResponse.json({ application }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params?: { id?: string } }) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const id = params?.id || body?.id
    const { status } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 })
    if (!['accepted', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: current, error: fetchError } = await supabase
      .from('applications')
      .select('id, listing_id, listing_type, applicant_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (current.listing_type !== 'service') {
      return NextResponse.json({ error: 'Invalid application type' }, { status: 400 })
    }

    const { ownerId } = await getServiceWithOwner(supabase, current.listing_id)
    if (!ownerId || ownerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', id)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const updatedApp = data?.[0]
    let conversationId: string | null = null

    if (status === 'accepted') {
      try {
        const applicantId = updatedApp?.applicant_id
        if (applicantId && ownerId) {
          const conversation = await getOrCreateConversation(supabase, ownerId, applicantId)
          conversationId = conversation?.id ?? null
        }
      } catch (e) {
        console.warn('Post-accept actions failed', e)
      }
    }

    return NextResponse.json({ application: updatedApp, conversation_id: conversationId })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
