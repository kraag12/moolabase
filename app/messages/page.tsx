'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/errors/isAbortError'
import { ABORT_REASON } from '@/lib/abort-reason'

interface Conversation {
  id: string
  user_1_id: string
  user_2_id: string
  created_at: string
  updated_at: string
}

const MOOLABASE_USER_ID = 'a81a7258-2e86-5309-8714-3358315a6b05'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<
    Record<string, { username?: string | null; avatar_url?: string | null }>
  >({})

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        const userId = data?.user?.id ?? null
        setCurrentUserId(userId)
        if (!userId) {
          if (!cancelled) setLoading(false)
          if (!cancelled) setError('Please log in to view your messages.')
          return
        }

        // Fetch conversations with proper cancellation support
        try {
          if (!cancelled) setLoading(true)
          if (!cancelled) setError('')
          const response = await fetch('/api/conversations', { signal: controller.signal })

          if (!response.ok) {
            const data = await response.json()
            console.error('API Error:', data)
            throw new Error(data.error || 'Failed to fetch conversations')
          }

          const data = await response.json()
          if (!cancelled) setConversations(data.conversations || [])
        } catch (err: any) {
          if (cancelled || isAbortError(err)) return
          console.error('Error:', err)
          if (!cancelled) setError(err.message)
        } finally {
          if (!cancelled) setLoading(false)
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return
        if (!cancelled) setLoading(false)
        if (!cancelled) setError('Failed to verify your session. Please refresh and try again.')
      }
    })()

    return () => {
      cancelled = true
      controller.abort(ABORT_REASON)
    }
  }, [])

  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return
    let cancelled = false
    const controller = new AbortController()

    const otherIds = Array.from(
      new Set(
        conversations.map((c) =>
          c.user_1_id === currentUserId ? c.user_2_id : c.user_1_id
        )
      )
    )
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, profile_picture_url')
          .in('id', otherIds)
        if (cancelled) return
        const map: Record<string, { username?: string | null; avatar_url?: string | null }> = {}
        ;(data || []).forEach((profile) => {
          map[profile.id] = {
            username: profile.username,
            avatar_url: profile.avatar_url || profile.profile_picture_url || null,
          }
        })
        if (!cancelled) setProfileMap(map)
      } catch (e) {
        if (!cancelled) {
          // ignore profile lookup errors silently
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort(ABORT_REASON)
    }
  }, [currentUserId, conversations])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-neutral-600 hover:text-neutral-900 transition p-2 hover:bg-neutral-100 rounded-lg"
          >
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Messages</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!currentUserId && !loading && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center shadow-sm">
            <MessageCircle className="mx-auto text-neutral-400 mb-4" size={48} />
            <p className="text-neutral-600 text-lg font-medium mb-2">Log in to see your messages</p>
            <p className="text-neutral-500 mb-6">
              Create an account or log in to start conversations.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition font-medium"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-block px-6 py-2 bg-neutral-200 text-neutral-800 rounded-lg hover:bg-neutral-300 transition font-medium"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {currentUserId && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {currentUserId && !error && (
          loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin">
                <div className="h-8 w-8 border-4 border-neutral-300 border-t-black rounded-full"></div>
              </div>
              <p className="text-neutral-600 mt-4">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center shadow-sm">
              <MessageCircle className="mx-auto text-neutral-400 mb-4" size={48} />
              <p className="text-neutral-900 text-lg font-semibold mb-2">You don't have messages yet</p>
              <p className="text-neutral-500 mb-6">
                Post a job or apply to one to begin chatting.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  href="/post/jobs"
                  className="inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition font-medium"
                >
                  Post a job
                </Link>
                <Link
                  href="/jobs"
                  className="inline-block px-6 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition font-medium"
                >
                  Browse listings
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation) => (
                (() => {
                  const otherId =
                    conversation.user_1_id === currentUserId ? conversation.user_2_id : conversation.user_1_id
                  const otherProfile = profileMap[otherId]
                  const isMoolabase =
                    otherId === MOOLABASE_USER_ID || otherProfile?.username?.toLowerCase() === 'moolabase'
                  return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block group"
                >
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 hover:shadow-md hover:border-neutral-300 transition cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      {currentUserId && (
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                            <img
                              src={
                                profileMap[
                                  conversation.user_1_id === currentUserId
                                    ? conversation.user_2_id
                                    : conversation.user_1_id
                                ]?.avatar_url || '/avatar-placeholder.svg'
                              }
                              alt="Profile"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 truncate inline-flex items-center gap-1">
                              {profileMap[
                                conversation.user_1_id === currentUserId
                                  ? conversation.user_2_id
                                  : conversation.user_1_id
                              ]?.username
                                ? `@${profileMap[
                                    conversation.user_1_id === currentUserId
                                      ? conversation.user_2_id
                                      : conversation.user_1_id
                                  ]?.username}`
                                : `Conversation #${conversation.id.slice(0, 8)}`}
                              {isMoolabase && <BadgeCheck size={16} className="text-blue-600" />}
                            </p>
                            <p className="text-sm text-neutral-500 mt-1">
                              {conversation.user_1_id === currentUserId
                                ? `With ${
                                    profileMap[conversation.user_2_id]?.username
                                      ? `@${profileMap[conversation.user_2_id]?.username}`
                                      : conversation.user_2_id.slice(0, 8)
                                  }`
                                : `With ${
                                    profileMap[conversation.user_1_id]?.username
                                      ? `@${profileMap[conversation.user_1_id]?.username}`
                                      : conversation.user_1_id.slice(0, 8)
                                  }`}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 ml-auto shrink-0">
                        <p className="text-xs text-neutral-500 text-right">
                          Updated {formatDate(conversation.updated_at)}
                        </p>
                        <ArrowLeft size={18} className="text-neutral-400 transform rotate-180" />
                      </div>
                    </div>
                  </div>
                </Link>
                )})()
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
