import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

function isMissingRelationOrColumn(error: unknown, needle: string) {
  const msg = String((error as any)?.message || error || '').toLowerCase()
  return msg.includes('does not exist') || (msg.includes('column') && msg.includes(needle.toLowerCase()))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversation_id')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversation ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const dataClient = (createServiceRoleClient() ?? supabase) as any
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation } = await dataClient
      .from('conversations')
      .select('id, user_1_id, user_2_id')
      .eq('id', conversationId)
      .single()

    if (!conversation || (conversation.user_1_id !== userId && conversation.user_2_id !== userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await dataClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Message fetch error:', error)
      const msg = String(error?.message || error)
      if (msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json(
          {
            error:
              "Database table missing. Run the migrations in /db/migrations (e.g. 002_core_tables.sql) to create 'conversations' and 'messages'",
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages: data || [] })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversation_id, content, image_url } = body

    // Validation
    if (!conversation_id || (!content && !image_url)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (typeof content === 'string' && content.trim().length === 0 && !image_url) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const dataClient = (createServiceRoleClient() ?? supabase) as any
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation } = await dataClient
      .from('conversations')
      .select('id, user_1_id, user_2_id')
      .eq('id', conversation_id)
      .single()

    if (!conversation || (conversation.user_1_id !== userId && conversation.user_2_id !== userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    const trimmedImageUrl = typeof image_url === 'string' ? image_url.trim() : ''

    // Insert message (support optional image_url)
    const insertPayload: any = {
      conversation_id,
      sender_id: userId,
      content: trimmedContent,
      created_at: new Date().toISOString(),
    }
    if (trimmedImageUrl) insertPayload.image_url = trimmedImageUrl

    let data: any[] | null = null
    let error: any = null

    ;({ data, error } = await dataClient.from('messages').insert(insertPayload).select())

    if (error) {
      console.error('Insert error:', error)
      const msg = String(error?.message || error)

      if (trimmedImageUrl && msg.toLowerCase().includes('column') && msg.toLowerCase().includes('image_url')) {
        return NextResponse.json(
          {
            error:
              "Message images are not enabled in the database yet. Run the migrations in /db/migrations to add the 'image_url' column to 'messages'.",
          },
          { status: 500 }
        )
      }

      if (msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json(
          {
            error:
              "Database table missing. Run the migrations in /db/migrations (e.g. 002_core_tables.sql) to create 'conversations' and 'messages'",
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const nowIso = new Date().toISOString()

    // Update conversation updated_at + last message preview fields (best-effort; older schemas may not have columns)
    try {
      const updates: any = {
        updated_at: nowIso,
        last_message_at: nowIso,
        last_message_text: trimmedContent || null,
        last_message_sender_id: userId,
        last_message_has_image: Boolean(trimmedImageUrl),
      }

      const { error: convoError } = await dataClient
        .from('conversations')
        .update(updates)
        .eq('id', conversation_id)

      if (convoError && !isMissingRelationOrColumn(convoError, 'last_message_at')) {
        console.warn('Failed to update conversation last-message fields:', convoError)
      }
    } catch (e) {
      if (!isMissingRelationOrColumn(e, 'last_message_at')) {
        console.warn('Exception updating conversation last-message fields:', e)
      }
    }

    // Mark sender as having read up to "now" (best-effort; table may not exist yet)
    try {
      const { error: readsError } = await dataClient
        .from('conversation_reads')
        .upsert(
          { conversation_id, user_id: userId, last_read_at: nowIso },
          { onConflict: 'conversation_id,user_id' }
        )

      if (readsError && !isMissingRelationOrColumn(readsError, 'conversation_reads')) {
        console.warn('Failed to update conversation_reads:', readsError)
      }
    } catch (e) {
      if (!isMissingRelationOrColumn(e, 'conversation_reads')) {
        console.warn('Exception updating conversation_reads:', e)
      }
    }

    const createdMessage = Array.isArray(data) ? data[0] : null
    return NextResponse.json({ message: createdMessage }, { status: 201 })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
