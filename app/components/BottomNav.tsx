'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, User, Bell, List } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  const [notificationCount, setNotificationCount] = useState(0)

  const isActive = (path: string) => pathname === path

  useEffect(() => {
    let mounted = true

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications?summary=1')
        if (!res.ok) return
        const data = await res.json()
        if (mounted) {
          const count = Number(data?.count || 0)
          setNotificationCount(Number.isNaN(count) ? 0 : count)
        }
      } catch {
        // ignore
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => {
      mounted = false
      clearInterval(interval)
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
            <MessageCircle size={24} />
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
                <span className="absolute -top-1 -right-2 h-4 min-w-[16px] rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center px-1">
                  {notificationCount > 99 ? '99+' : notificationCount}
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
