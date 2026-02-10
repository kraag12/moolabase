import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, location, offer, work_type, tools, image_url } = body

    // Minimal validation
    if (!title || !description || !location || offer === undefined || offer === '') {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, location, offer' },
        { status: 400 }
      )
    }

    // Server-side Supabase client (uses cookie auth/context)
    const supabase = await createClient()

    // Try to resolve current user (if any) to set ownership
    let userId: string | null = null
    try {
      const { data: userData } = await supabase.auth.getUser()
      userId = userData?.user?.id ?? null
    } catch (e) {
      userId = null
    }

    if (!userId) {
      return NextResponse.json({ error: 'Please log in to post a service.' }, { status: 401 })
    }

    const ownerColumn = await resolveColumn(supabase as any, 'services', 'poster_id', 'user_id')
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { count: todayCount, error: countError } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq(ownerColumn, userId)
      .gte('created_at', startOfDay.toISOString())

    if (countError) {
      console.error('Supabase count error:', countError)
      return NextResponse.json({ error: 'Failed to validate daily limit' }, { status: 500 })
    }

    if ((todayCount || 0) >= 5) {
      return NextResponse.json(
        { error: 'Daily limit reached. You can post up to 5 services per day.' },
        { status: 429 }
      )
    }

    const insertData: any = {
      title: String(title).trim(),
      description: String(description).trim(),
      location: String(location).trim(),
      offer: Number(offer),
      work_type: work_type || 'local',
      tools: tools ? String(tools).trim() : null,
      image_url: Array.isArray(image_url) ? image_url.slice(0, 3) : null,
    }

    insertData[ownerColumn] = userId

    const { data, error } = await supabase
      .from('services')
      .insert([insertData])
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.error('No data returned from insert')
      return NextResponse.json(
        { error: 'Failed to create service' },
        { status: 500 }
      )
    }

    const created = data[0]
    return NextResponse.json({ id: created.id, ...created }, { status: 201 })
  } catch (error: any) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: `Server error: ${error.message || 'Unknown error'}` },
      { status: 500 }
    )
  }
}
