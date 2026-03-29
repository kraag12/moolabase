'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { isAbortError } from '@/lib/errors/isAbortError'

export default function HeaderAuthActions() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  const defaultUsernameFromUser = (user: User) =>
    String(user.user_metadata?.username || user.email?.split('@')[0] || 'member')

  const hydrateUserState = async (user: User | null) => {
    if (!user) {
      setIsAuthenticated(false)
      setUsername(null)
      setResolved(true)
      return
    }

    setIsAuthenticated(true)
    const fallback = defaultUsernameFromUser(user)
    setUsername(fallback)
    setResolved(true)

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      if (profileData?.username) {
        setUsername(profileData.username)
      }
    } catch {
      // Ignore profile lookup issues and keep fallback username.
    }
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!mounted) return
        await hydrateUserState(data.user ?? null)
      } catch (error) {
        if (!mounted || isAbortError(error)) return
        setIsAuthenticated(false)
        setUsername(null)
        setResolved(true)
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      void hydrateUserState(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (resolved && isAuthenticated) {
    return (
      <Link
        href="/profile"
        className="px-3 sm:px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50 transition font-medium text-sm sm:text-base"
      >
        Logged in as @{username || 'member'}
      </Link>
    )
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      <Link
        href="/signup"
        className="px-3 sm:px-4 py-2 border border-black rounded-md hover:bg-neutral-50 transition font-medium text-sm sm:text-base"
      >
        Sign Up
      </Link>
      <Link
        href="/login"
        className="px-3 sm:px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 transition font-medium text-sm sm:text-base"
      >
        Log In
      </Link>
    </div>
  )
}
