'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function RouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const firstRenderRef = useRef(true)

  const routeKey = useMemo(() => pathname, [pathname])

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setActive(true)
    })
    const timeout = setTimeout(() => {
      setActive(false)
    }, 520)

    return () => {
      window.cancelAnimationFrame(frame)
      clearTimeout(timeout)
    }
  }, [routeKey])

  return (
    <div className="route-progress-shell" aria-hidden="true">
      <div className={`route-progress-bar ${active ? 'route-progress-bar-active' : ''}`} />
    </div>
  )
}
