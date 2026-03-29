import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'
import { isListingExpired } from '@/lib/listings/expiration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = (url.searchParams.get('id') || '').trim()
    const type = (url.searchParams.get('type') || '').trim()

    if (!id) {
      return NextResponse.json({ error: 'Listing id is required' }, { status: 400 })
    }

    if (type !== 'job' && type !== 'service') {
      return NextResponse.json({ error: 'Listing type must be job or service' }, { status: 400 })
    }

    const table = type === 'job' ? 'jobs' : 'services'
    const supabase = await createClient()
    const ownerColumn = await resolveColumn(supabase as any, table, 'poster_id', 'user_id')

    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const record = data as any
    if (isListingExpired(record?.created_at, record?.duration)) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        ...record,
        type,
        poster_id: record?.[ownerColumn] ?? record?.poster_id ?? record?.user_id ?? null,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

