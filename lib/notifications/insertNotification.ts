type SupabaseLike = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>
  }
}

export type NotificationInsertPayload = {
  user_id: string
  sender_id?: string | null
  type?: string | null
  reference_id?: string | null
  title?: string | null
  message?: string | null
  listing_type?: 'job' | 'service' | string | null
  listing_id?: string | number | null
  listing_title?: string | null
  applicant_name?: string | null
  applicant_email?: string | null
  applicant_avatar_url?: string | null
  motivation?: string | null
  status?: string | null
  // new field added when we want to link a notification directly to a conversation
  conversation_id?: string | null
}

function isSchemaMismatch(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('column') ||
    normalized.includes('schema cache') ||
    normalized.includes('does not exist') ||
    normalized.includes('could not find the table')
  )
}

function extractMissingColumn(message: string) {
  const msg = String(message || '')
  const quoted = msg.match(/column\s+"([^"]+)"/i)?.[1]
  if (quoted) return quoted
  const singleQuoted = msg.match(/column\s+'([^']+)'/i)?.[1]
  if (singleQuoted) return singleQuoted
  return null
}

export async function insertNotificationRobust(
  supabase: SupabaseLike,
  payload: NotificationInsertPayload
) {
  const title = (payload.title || 'Notification').trim() || 'Notification'
  const message = (payload.message || 'You have a new update.').trim() || 'You have a new update.'
  const type = (payload.type || 'notification').trim() || 'notification'

  const expandedCandidate: Record<string, unknown> = {
    user_id: payload.user_id,
    sender_id: payload.sender_id ?? null,
    type,
    reference_id: payload.reference_id ?? null,
    title,
    message,
    read: false,
  }

  if (payload.listing_type) expandedCandidate.listing_type = payload.listing_type
  if (payload.listing_id !== null && payload.listing_id !== undefined) {
    expandedCandidate.listing_id = String(payload.listing_id)
  }
  if (payload.listing_title) expandedCandidate.listing_title = payload.listing_title
  if (payload.applicant_name) expandedCandidate.applicant_name = payload.applicant_name
  if (payload.applicant_email) expandedCandidate.applicant_email = payload.applicant_email
  if (payload.applicant_avatar_url) expandedCandidate.applicant_avatar_url = payload.applicant_avatar_url
  if (payload.motivation) expandedCandidate.motivation = payload.motivation
  if (payload.status) expandedCandidate.status = payload.status
  if (payload.conversation_id) expandedCandidate.conversation_id = payload.conversation_id

  const candidates: Record<string, unknown>[] = [
    expandedCandidate,
    {
      user_id: payload.user_id,
      sender_id: payload.sender_id ?? null,
      type,
      reference_id: payload.reference_id ?? null,
      title,
      message,
      read: false,
    },
    {
      user_id: payload.user_id,
      type,
      reference_id: payload.reference_id ?? null,
      title,
      message,
      read: false,
    },
    {
      user_id: payload.user_id,
      type,
      title,
      message,
      read: false,
    },
    {
      user_id: payload.user_id,
      title,
      message,
      read: false,
    },
  ]

  let lastMessage = ''
  for (const candidate of candidates) {
    const working: Record<string, unknown> = { ...candidate }

    for (let stripAttempt = 0; stripAttempt < 12; stripAttempt += 1) {
      const { error } = await supabase.from('notifications').insert(working)
      if (!error) return { ok: true as const, error: null }

      const msg = String(error.message || '')
      lastMessage = msg
      if (!isSchemaMismatch(msg)) {
        return { ok: false as const, error: msg }
      }

      const missing = extractMissingColumn(msg)
      if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
        delete working[missing]
        continue
      }

      break
    }
  }

  return { ok: false as const, error: lastMessage || 'Failed to insert notification' }
}
