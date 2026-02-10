import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, location, offer, work_type, response_time, duration } = body

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
      return NextResponse.json({ error: 'Please log in to post a job.' }, { status: 401 })
    }

    const ownerColumn = await resolveColumn(supabase as any, 'jobs', 'poster_id', 'user_id')
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { count: todayCount, error: countError } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq(ownerColumn, userId)
      .gte('created_at', startOfDay.toISOString())

    if (countError) {
      console.error('Supabase count error:', countError)
      return NextResponse.json({ error: 'Failed to validate daily limit' }, { status: 500 })
    }

    if ((todayCount || 0) >= 5) {
      return NextResponse.json(
        { error: 'Daily limit reached. You can post up to 5 jobs per day.' },
        { status: 429 }
      )
    }

    // Work type and response_time are required in the updated schema
    const insertData: any = {
      title: String(title).trim(),
      description: String(description).trim(),
      location: String(location).trim(),
      offer: Number(offer),
      work_type: work_type || 'local',
      response_time: response_time || 'flexible',
      duration: duration || '1_week',
    }

    insertData[ownerColumn] = userId

    const { data, error } = await supabase
      .from('jobs')
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
        { error: 'Failed to create job' },
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
