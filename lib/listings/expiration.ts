const DAY_MS = 24 * 60 * 60 * 1000

const DURATION_MS: Record<string, number> = {
  '3_days': 3 * DAY_MS,
  '1_week': 7 * DAY_MS,
  '2_weeks': 14 * DAY_MS,
  '1_month': 30 * DAY_MS,
}

export function getExpirationTimestamp(
  createdAt?: string | null,
  duration?: string | null
): number | null {
  if (!createdAt) return null
  const key = duration || '1_week'
  if (key === 'max') return null
  const offset = DURATION_MS[key] ?? DURATION_MS['1_week']
  const base = new Date(createdAt).getTime()
  if (!Number.isFinite(base)) return null
  return base + offset
}

export function isListingExpired(createdAt?: string | null, duration?: string | null) {
  const expiresAt = getExpirationTimestamp(createdAt, duration)
  if (!expiresAt) return false
  return Date.now() > expiresAt
}
