type AbortLikeError = {
  name?: string
  message?: string
  code?: string
}

/**
 * Detects various forms of abort/signal errors that may occur during fetch operations.
 * Handles:
 * - Standard AbortError with name 'AbortError'
 * - Errors with 'aborted' in message
 * - 'signal is aborted' variations
 * - DOMException abort errors
 * - Various network abort scenarios
 */
export function isAbortError(error: unknown) {
  if (!error) return false
  
  if (
    typeof error === 'object' &&
    'name' in error &&
    (error as AbortLikeError).name === 'AbortError'
  ) {
    return true
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as AbortLikeError).message || '').toLowerCase()
      : String(error).toLowerCase()
  
  const code = 
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as AbortLikeError).code || '').toLowerCase()
      : ''
  
  return (
    message.includes('signal is aborted') ||
    message.includes('aborterror') ||
    message.includes('aborted') ||
    message.includes('abort signal') ||
    message.includes('controller aborted') ||
    code.includes('abort') ||
    (typeof error === 'object' && error !== null && 'name' in error && 
     (error as AbortLikeError).name?.toLowerCase().includes('abort'))
  )
}
