'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, User, Bell, List } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/errors/isAbortError'

export default function BottomNav() {
  const pathname = usePathname()

  const [notificationCount, setNotificationCount] = useState(0)
  const [messageCount, setMessageCount] = useState(0)

  const isActive = (path: string) => pathname === path

  useEffect(() => {
    let mounted = true
    let pollingInterval: ReturnType<typeof setInterval> | null = null
    let unsubscribeAuth: (() => void) | null = null

    const fetchCounts = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const userId = data?.user?.id ?? null

        if (!mounted) return

        if (!userId) {
          setNotificationCount(0)
          setMessageCount(0)
          return
        }

        const [notifRes, msgRes] = await Promise.all([
          fetch('/api/notifications?summary=1', { cache: 'no-store' }),
          fetch('/api/conversations?summary=1', { cache: 'no-store' }),
        ])

        const notifPayload = await notifRes.json().catch(() => ({}))
        const msgPayload = await msgRes.json().catch(() => ({}))

        const nextNotificationCount = Number(notifPayload?.count ?? 0)
        const nextMessageCount = Number(msgPayload?.count ?? 0)

        if (!mounted) return

        setNotificationCount(Number.isFinite(nextNotificationCount) ? nextNotificationCount : 0)
        setMessageCount(Number.isFinite(nextMessageCount) ? nextMessageCount : 0)
      } catch (error) {
        if (!mounted || isAbortError(error)) return
        setNotificationCount(0)
        setMessageCount(0)
      }
    }

    void fetchCounts()

    pollingInterval = setInterval(() => {
      void fetchCounts()
    }, 10000)

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void fetchCounts()
    })
    unsubscribeAuth = () => {
      try {
        authListener.subscription.unsubscribe()
      } catch {
        // ignore
      }
    }

    return () => {
      mounted = false
      if (pollingInterval) clearInterval(pollingInterval)
      unsubscribeAuth?.()
    }
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-around">
          {/* Home */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
              isActive('/') 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Home size={24} />
            <span className="text-xs font-medium">Home</span>
          </Link>

          {/* Listings */}
          <Link
            href="/jobs"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
              isActive('/jobs')
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <List size={24} />
            <span className="text-xs font-medium">Listings</span>
          </Link>

          {/* Messages */}
          <Link
            href="/messages"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
              isActive('/messages')
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              <MessageCircle size={24} />
              {messageCount > 0 && (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center px-1">
                  {messageCount > 9 ? '9+' : messageCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Messages</span>
          </Link>

          {/* Notifications */}
          <Link
            href="/notifications"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
              isActive('/notifications')
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              <Bell size={24} />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-2 h-4 min-w-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center px-1">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Notifications</span>
          </Link>

          {/* Profile */}
          <Link
            href="/profile"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
              isActive('/profile')
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <User size={24} />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
