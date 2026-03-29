// helper utilities for working with listing URLs

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const NUMERIC_ID_REGEX = /^\d+$/

/**
 * A very loose sanity check used throughout the codebase.  We don't want to
 * bounce the user to a 404 simply because an id contained a trailing space or
 * some other innocuous character, so this is intentionally permissive.  It
 * originally existed to stop the app from trying to fetch records with
 * obviously-bad ids such as `""` or `"../../"`.
 */
export function isSupportedListingId(id?: string | null) {
  if (!id || typeof id !== 'string') return false
  const trimmed = id.trim()
  return UUID_REGEX.test(trimmed) || NUMERIC_ID_REGEX.test(trimmed)
}

/**
 * Build a canonical href for a job/service listing.  Always returns an absolute
 * path (falls back to `/` if an empty/invalid id is supplied).
 */
export function getListingHref(
  id: string | number | undefined | null,
  type: 'job' | 'service'
) {
  const str = String(id || '').trim()
  if (!str) return '/'
  const encodedId = encodeURIComponent(str)
  return `/listing?type=${type}&id=${encodedId}`
}
