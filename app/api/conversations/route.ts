import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('GET /api/conversations');
  try {
    const supabase = await createClient();
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
      return NextResponse.json({ conversations: [] });
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
      .order('updated_at', { ascending: false })
      .limit(50);

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

    return NextResponse.json({ conversations: data || [] });
  } catch (error: any) {
    console.error('API error in /api/conversations:', error);
    const msg = String(error?.message || error || 'Server error');
    return NextResponse.json(
      { error: 'Server error', details: msg },
      { status: 500 }
    );
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
