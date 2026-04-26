import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: 'Direct boost activation is disabled. Use /api/boosts/checkout.' },
    { status: 410 }
  )
}
