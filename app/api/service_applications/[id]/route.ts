import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

async function getServiceOwnerId(supabase: any, serviceId: string) {
  const ownerColumn = await resolveColumn(supabase, 'services', 'poster_id', 'user_id')
  const { data, error } = await supabase
    .from('services')
    .select(`id,${ownerColumn}`)
    .eq('id', serviceId)
    .single()
  if (error) throw new Error(error.message)
  return data?.[ownerColumn] as string | null
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { status } = body
    const { id } = params
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

    const ownerId = await getServiceOwnerId(supabase, current.listing_id)
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
