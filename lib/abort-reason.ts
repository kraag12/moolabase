/**
 * Standard abort reason for fetch request cancellations.
 * Used consistently across the app to ensure proper error detection and handling.
 */
export const ABORT_REASON = new DOMException('Request aborted', 'AbortError')
