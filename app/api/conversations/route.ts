import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

type ProfileSummary = {
  id: string
  username: string | null
  avatar_url: string | null
}

type ConversationRow = {
  id: string
  user_1_id: string
  user_2_id: string
  created_at: string
  updated_at: string
  locked?: boolean
  last_message_at?: string | null
  last_message_text?: string | null
  last_message_sender_id?: string | null
  last_message_has_image?: boolean | null
}

function otherParticipant(conversation: ConversationRow, currentUserId: string) {
  return conversation.user_1_id === currentUserId ? conversation.user_2_id : conversation.user_1_id
}

function isMissingRelation(error: unknown) {
  const msg = String((error as any)?.message || error || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('relation')
}

function isMissingColumn(error: unknown) {
  const msg = String((error as any)?.message || error || '').toLowerCase()
  return msg.includes('column') && msg.includes('does not exist')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const dataClient = (createServiceRoleClient() ?? supabase) as any
    if (!supabase) {
      console.error('Supabase client is not available');
      return NextResponse.json({ error: 'Supabase client is not available' }, { status: 500 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('Supabase auth error:', userError);
      return NextResponse.json({ error: 'Supabase auth error' }, { status: 500 });
    }

    const userId = userData?.user?.id;
    if (!userId) {
      // Not an error, but the user is not logged in.
      return NextResponse.json({ conversations: [], user_id: null });
    }

    const url = new URL(request.url)
    const requestedId = (url.searchParams.get('id') || url.searchParams.get('conversation_id') || '').trim()
    const summaryOnly = url.searchParams.get('summary') === '1'

    const avatarColumn = await resolveColumn(supabase as any, 'profiles', 'avatar_url', 'profile_picture_url')

    const loadProfileSummaries = async (ids: string[]): Promise<Record<string, ProfileSummary>> => {
      if (ids.length === 0) return {}
      const { data, error } = await dataClient
        .from('profiles')
        .select(`id, username, ${avatarColumn}`)
        .in('id', ids)

      if (error || !data) return {}

      const map: Record<string, ProfileSummary> = {}
      data.forEach((row: any) => {
        map[String(row.id)] = {
          id: String(row.id),
          username: (row.username as string | null) ?? null,
          avatar_url: (row?.[avatarColumn] as string | null) ?? null,
        }
      })
      return map
    }

    const fullConversationSelect =
      'id, locked, user_1_id, user_2_id, created_at, updated_at, last_message_at, last_message_text, last_message_sender_id, last_message_has_image'
    const baseConversationSelect = 'id, user_1_id, user_2_id, created_at, updated_at'

    if (requestedId) {
      let data: any = null
      let error: any = null

      ;({ data, error } = await dataClient
        .from('conversations')
        .select(fullConversationSelect)
        .eq('id', requestedId)
        .maybeSingle())

      if (error && isMissingColumn(error)) {
        ;({ data, error } = await dataClient
          .from('conversations')
          .select(baseConversationSelect)
          .eq('id', requestedId)
          .maybeSingle())
      }

      if (error) {
        const msg = String(error.message || '')
        if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
          return NextResponse.json({ conversation: null, user_id: userId }, { status: 200 })
        }
        return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({ conversation: null, user_id: userId }, { status: 404 })
      }

      const convo = data as ConversationRow
      if (convo.user_1_id !== userId && convo.user_2_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const otherId = otherParticipant(convo, userId)
      const profiles = await loadProfileSummaries([otherId])

      return NextResponse.json({
        conversation: {
          ...convo,
          other_user: profiles[otherId] ?? null,
        },
        user_id: userId,
      })
    }

    // summary only: return unread chat count (max 50 conversations)
    if (summaryOnly) {
      const { data, error } = await dataClient
        .from('conversations')
        .select('id, user_1_id, user_2_id, last_message_at, last_message_sender_id')
        .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) {
        if (isMissingColumn(error)) return NextResponse.json({ count: 0 })
        if (isMissingRelation(error)) return NextResponse.json({ count: 0 })
        return NextResponse.json({ count: 0 })
      }

      const rows = (data || []) as ConversationRow[]
      const ids = rows.map((r) => r.id)
      if (ids.length === 0) return NextResponse.json({ count: 0 })

      const { data: reads, error: readsError } = await dataClient
        .from('conversation_reads')
        .select('conversation_id,last_read_at')
        .eq('user_id', userId)
        .in('conversation_id', ids)

      if (readsError && !isMissingRelation(readsError)) {
        // if table missing, treat as 0 unread until migration is applied
        return NextResponse.json({ count: 0 })
      }

      const readMap = new Map<string, number>()
      ;(reads || []).forEach((r: any) => {
        const ts = Date.parse(String(r?.last_read_at || ''))
        if (Number.isFinite(ts)) readMap.set(String(r.conversation_id), ts)
      })

      const unreadCount = rows.reduce((acc, row) => {
        const lastAtRaw = row.last_message_at ? Date.parse(String(row.last_message_at)) : NaN
        if (!Number.isFinite(lastAtRaw)) return acc
        if (String(row.last_message_sender_id || '') === userId) return acc
        const readAt = readMap.get(row.id) ?? 0
        return lastAtRaw > readAt ? acc + 1 : acc
      }, 0)

      return NextResponse.json({ count: unreadCount })
    }

    let data: any[] | null = null
    let error: any = null

    ;({ data, error } = await dataClient
      .from('conversations')
      .select(fullConversationSelect)
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(50))

    if (error && isMissingColumn(error)) {
      ;({ data, error } = await dataClient
        .from('conversations')
        .select(baseConversationSelect)
        .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })
        .limit(50))

      if (error && isMissingColumn(error)) {
        ;({ data, error } = await dataClient
          .from('conversations')
          .select(baseConversationSelect)
          .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(50))
      }
    }

    if (error) {
      console.error('Conversation fetch error:', error);
      const msg = String(error.message || '');
      if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
        return NextResponse.json({ conversations: [] }, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    const rows = (data || []) as ConversationRow[]
    const otherIds = Array.from(new Set(rows.map((row) => otherParticipant(row, userId))))
    const profiles = await loadProfileSummaries(otherIds)

    const ids = rows.map((row) => row.id)
    const { data: reads, error: readsError } = ids.length > 0
      ? await dataClient
          .from('conversation_reads')
          .select('conversation_id,last_read_at')
          .eq('user_id', userId)
          .in('conversation_id', ids)
      : { data: [], error: null }

    const readMap = new Map<string, number>()
    if (!readsError) {
      ;(reads || []).forEach((r: any) => {
        const ts = Date.parse(String(r?.last_read_at || ''))
        if (Number.isFinite(ts)) readMap.set(String(r.conversation_id), ts)
      })
    }

    const conversations = rows.map((row) => {
      const otherId = otherParticipant(row, userId)
      const lastAt = row.last_message_at ? Date.parse(String(row.last_message_at)) : NaN
      const readAt = readMap.get(row.id) ?? 0
      const unread =
        Number.isFinite(lastAt) &&
        String(row.last_message_sender_id || '') !== userId &&
        lastAt > readAt
      return {
        ...row,
        other_user: profiles[otherId] ?? null,
        unread,
      }
    })

    return NextResponse.json({ conversations, user_id: userId });
  } catch (error: any) {
    console.error('API error in /api/conversations:', error);
    const msg = String(error?.message || error || 'Server error');
    return NextResponse.json(
      { error: 'Server error', details: msg },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = (createServiceRoleClient() ?? supabase) as any
    const { conversation_id } = await request.json().catch(() => ({}))
    const conversationId = String(conversation_id || '').trim()
    if (!conversationId) return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: convo, error: convoError } = await dataClient
      .from('conversations')
      .select('id,user_1_id,user_2_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (convoError) {
      if (isMissingRelation(convoError)) return NextResponse.json({ ok: true, skipped: true })
      return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 })
    }

    if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = convo as any
    if (row.user_1_id !== userId && row.user_2_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const nowIso = new Date().toISOString()
    const { error: readsError } = await dataClient
      .from('conversation_reads')
      .upsert(
        { conversation_id: conversationId, user_id: userId, last_read_at: nowIso },
        { onConflict: 'conversation_id,user_id' }
      )

    if (readsError) {
      if (isMissingRelation(readsError)) return NextResponse.json({ ok: true, skipped: true })
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (isMissingRelation(error)) return NextResponse.json({ ok: true, skipped: true })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_1_id, user_2_id } = body

    if (!user_1_id || !user_2_id) {
      return NextResponse.json(
        { error: 'Missing user IDs' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (userId !== user_1_id && userId !== user_2_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('*')
      .or(
        `and(user_1_id.eq.${user_1_id},user_2_id.eq.${user_2_id}),and(user_1_id.eq.${user_2_id},user_2_id.eq.${user_1_id})`
      )
      .limit(1)

    if (existingError) {
      console.error('Lookup error:', existingError)
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({ conversation: existing[0] }, { status: 200 })
    }

    // Create conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_1_id,
        user_2_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ conversation: data[0] }, { status: 201 })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
