import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('notifications').delete().lt('created_at', cutoff)
    if (error) {
      console.error('Cleanup error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Cleanup exception:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
