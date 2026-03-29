import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isListingExpired } from '@/lib/listings/expiration'

/* eslint-disable no-console */
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const NUMERIC_ID_REGEX = /^\d+$/
const isSupportedListingId = (id: string) => UUID_REGEX.test(id) || NUMERIC_ID_REGEX.test(id)

function createCleanupClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!isSupportedListingId(id)) {
      console.warn('GET /api/jobs/[id] called with invalid id:', id);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const supabase = await createClient();
    if (!supabase) {
      console.error('Supabase client is not available');
      return NextResponse.json({ error: 'Supabase client is not available' }, { status: 500 });
    }

    console.log('Fetching job with id', id)
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch error:', error);
      if (error.code === '22P02') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const record = data as any;
    if (isListingExpired(record?.created_at, record?.duration)) {
      const cleanupClient = createCleanupClient()
      if (cleanupClient) {
        const { error: deleteError } = await cleanupClient.from('jobs').delete().eq('id', id)
        if (deleteError) {
          console.warn('Failed to delete expired job:', deleteError.message || deleteError)
        }
      }

      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    const normalized = {
      ...record,
      poster_id: record?.poster_id ?? record?.user_id ?? null,
      user_id: record?.user_id ?? record?.poster_id ?? null,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Unexpected error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
