import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

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
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, user_1_id, user_2_id')
      .eq('id', conversationId)
      .single()

    if (!conversation || (conversation.user_1_id !== userId && conversation.user_2_id !== userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
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
    const { conversation_id, content } = body

    // Validation
    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, user_1_id, user_2_id')
      .eq('id', conversation_id)
      .single()

    if (!conversation || (conversation.user_1_id !== userId && conversation.user_2_id !== userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Insert message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id: userId,
        content: content.trim(),
        created_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error('Insert error:', error)
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

      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Update conversation updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id)

    return NextResponse.json({ message: data[0] }, { status: 201 })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
