type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => Promise<{ error: { message?: string } | null }>
    }
  }
}

const columnCache = new Map<string, string>()

function isMissingColumnError(message: string, column: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('does not exist') ||
    normalized.includes('schema cache') ||
    (normalized.includes('column') && normalized.includes(column.toLowerCase()))
  )
}

export async function resolveColumn(
  supabase: SupabaseLike,
  table: string,
  preferred: string,
  fallback: string
) {
  const key = `${table}:${preferred}:${fallback}`
  const cached = columnCache.get(key)
  if (cached) return cached

  const { error } = await supabase.from(table).select(preferred).limit(1)
  if (!error) {
    columnCache.set(key, preferred)
    return preferred
  }

  const message = String(error.message || '')
  if (isMissingColumnError(message, preferred)) {
    columnCache.set(key, fallback)
    return fallback
  }

  // Default to preferred if error isn't about a missing column
  columnCache.set(key, preferred)
  return preferred
}
