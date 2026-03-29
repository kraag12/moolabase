import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveColumn } from '@/lib/supabase/schema'

function normalizeUsername(value: string, userId: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (normalized.length >= 3) return normalized.slice(0, 20)
  return `user_${userId.slice(0, 8)}`
}

async function ensureProfileExists(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return

  const emailColumn = await resolveColumn(supabase as any, 'profiles', 'email', 'id')
  const preferredUsername =
    String(user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`)

  const payload: Record<string, any> = {
    id: user.id,
    username: normalizeUsername(preferredUsername, user.id),
    full_name: user.user_metadata?.full_name || preferredUsername,
  }

  if (emailColumn === 'email' && user.email) {
    payload.email = user.email
  }

  const primary = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
  if (!primary.error) return

  const message = String(primary.error.message || '').toLowerCase()
  const isUsernameConflict =
    message.includes('profiles_username_key') ||
    (message.includes('unique') && message.includes('username'))

  if (!isUsernameConflict) return

  const fallback = { ...payload }
  delete fallback.username
  await supabase.from('profiles').upsert(fallback, { onConflict: 'id' })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    await ensureProfileExists(supabase)
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
