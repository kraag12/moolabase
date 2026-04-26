import { useCallback } from 'react'

/**
 * Stable `fetch` wrapper for client components.
 * Keeps call-sites simple and avoids manual abort-signal churn.
 */
export function useAbortableFetch() {
  return useCallback(async (input: RequestInfo, init?: RequestInit) => {
    return fetch(input, init)
  }, [])
}
