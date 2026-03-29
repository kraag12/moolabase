import { useCallback, useEffect, useRef } from 'react'
import { ABORT_REASON } from './abort-reason'

/**
 * Hook returning a `fetch` wrapper that automatically attaches a fresh
 * `AbortController` signal to every request and aborts any in-flight requests
 * when the component unmounts.
 *
 * Example:
 *
 * ```tsx
 * const doFetch = useAbortableFetch()
 *
 * useEffect(() => {
 *   let cancelled = false
 *   ;(async () => {
 *     const res = await doFetch('/api/foo')
 *     if (cancelled) return
 *     // ...handle response
 *   })()
 *   return () => {
 *     cancelled = true
 *   }
 * }, [doFetch])
 * ```
 */
export function useAbortableFetch() {
  const controllersRef = useRef<Set<AbortController>>(new Set())
  const mountedRef = useRef(true)

  useEffect(() => {
    const controllers = controllersRef.current

    return () => {
      mountedRef.current = false
      controllers.forEach((controller) => controller.abort(ABORT_REASON))
      controllers.clear()
    }
  }, [])

  return useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      if (!mountedRef.current) {
        throw new DOMException('Component unmounted', 'AbortError')
      }

      const controller = new AbortController()
      controllersRef.current.add(controller)

      const upstreamSignal = init?.signal
      let removeUpstreamAbortListener: (() => void) | null = null

      if (upstreamSignal) {
        if (upstreamSignal.aborted) {
          controller.abort(upstreamSignal.reason ?? ABORT_REASON)
        } else {
          const onUpstreamAbort = () => controller.abort(upstreamSignal.reason ?? ABORT_REASON)
          upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true })
          removeUpstreamAbortListener = () => {
            upstreamSignal.removeEventListener('abort', onUpstreamAbort)
          }
        }
      }

      try {
        return await fetch(input, { ...init, signal: controller.signal })
      } finally {
        removeUpstreamAbortListener?.()
        controllersRef.current.delete(controller)
      }
    },
    []
  )
}
