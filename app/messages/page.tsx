'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, BadgeCheck, Search } from 'lucide-react'
import { isAbortError } from '@/lib/errors/isAbortError'
import { ABORT_REASON } from '@/lib/abort-reason'
import { supabase } from '@/lib/supabase/client'

interface Conversation {
  id: string
  user_1_id: string
  user_2_id: string
  created_at: string
  updated_at: string
  last_message_at?: string | null
  last_message_text?: string | null
  last_message_sender_id?: string | null
  last_message_has_image?: boolean | null
  unread?: boolean
  other_user?: { id: string; username: string | null; avatar_url: string | null } | null
}

const MOOLABASE_USER_ID = 'a81a7258-2e86-5309-8714-3358315a6b05'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [clientUserId, setClientUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!active) return
        setClientUserId(data?.user?.id ?? null)
      } catch {
        if (!active) return
        setClientUserId(null)
      } finally {
        if (active) setAuthChecked(true)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    let interval: ReturnType<typeof setInterval> | null = null

    const load = async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false
      try {
        if (!cancelled && showLoading) setLoading(true)
        if (!cancelled) setError('')

        const response = await fetch('/api/conversations', { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to fetch conversations')
        }

        if (cancelled) return
        setCurrentUserId(payload?.user_id ?? clientUserId ?? null)
        setConversations(Array.isArray(payload?.conversations) ? payload.conversations : [])
      } catch (error) {
        if (cancelled || isAbortError(error)) return
        if (!cancelled) setError((error as any)?.message || 'Failed to load messages. Please refresh and try again.')
      } finally {
        if (!cancelled && showLoading) setLoading(false)
      }
    }

    void load({ showLoading: true })
    interval = setInterval(() => {
      void load({ showLoading: false })
    }, 5000)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      controller.abort(ABORT_REASON)
    }
  }, [clientUserId])

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

  const normalizedQuery = query.trim().toLowerCase()
  const visibleConversations = normalizedQuery
    ? conversations.filter((conversation) => {
        const other = conversation.other_user
        const username = String(other?.username || '').toLowerCase()
        return username.includes(normalizedQuery)
      })
    : conversations

  const isLoggedIn = Boolean(clientUserId || currentUserId)

  const summarizeLastMessage = (conversation: Conversation) => {
    const hasImage = Boolean(conversation.last_message_has_image)
    const rawText = String(conversation.last_message_text || '').trim()
    const hasText = Boolean(rawText)

    if (!hasImage && !hasText) return 'No messages yet — tap to start'

    const base = hasImage ? 'image' : rawText
    const prefix =
      conversation.last_message_sender_id && conversation.last_message_sender_id === currentUserId ? 'You: ' : ''

    const combined = `${prefix}${base}`.trim()
    return combined.length > 72 ? `${combined.slice(0, 72).trimEnd()}â€¦` : combined
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
        {isLoggedIn && !error && (
          <div className="mb-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chatsâ€¦"
                className="w-full rounded-xl border border-neutral-200 bg-white px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        )}

        {authChecked && !isLoggedIn && !loading && (
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

        {isLoggedIn && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {isLoggedIn && !error && (
          loading ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin">
                <div className="h-8 w-8 border-4 border-neutral-300 border-t-black rounded-full"></div>
              </div>
              <p className="text-neutral-600 mt-4">Loading conversations...</p>
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center shadow-sm">
              <MessageCircle className="mx-auto text-neutral-400 mb-4" size={48} />
              <p className="text-neutral-900 text-lg font-semibold mb-2">No messages yet.</p>
              <p className="text-neutral-500 mb-6">
                You currently do not have any messages. Post a listing or apply to begin chatting.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link
                  href="/post/jobs"
                  className="inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition font-medium"
                >
                  Post a job
                </Link>
                <Link
                  href="/post/jobs/service"
                  className="inline-block px-6 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition font-medium"
                >
                  Offer a service
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
              {visibleConversations.map((conversation) => (
                (() => {
                  const otherId = conversation.user_1_id === currentUserId ? conversation.user_2_id : conversation.user_1_id
                  const otherProfile = conversation.other_user
                  const isMoolabase =
                    otherId === MOOLABASE_USER_ID || otherProfile?.username?.toLowerCase() === 'moolabase'
                  return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="block group"
                >
                  <div
                    className={`border rounded-2xl p-4 sm:p-5 hover:shadow-md transition cursor-pointer ${
                      conversation.unread
                        ? 'bg-blue-50/50 border-blue-200 hover:border-blue-300'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {currentUserId && (
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                            <img
                              src={otherProfile?.avatar_url || '/avatar-placeholder.svg'}
                              alt="Profile"
                              className="h-full w-full object-cover"
                            />
                            {conversation.unread && (
                              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={`truncate inline-flex items-center gap-1 ${
                                conversation.unread ? 'font-bold text-neutral-950' : 'font-semibold text-neutral-900'
                              }`}
                            >
                              {otherProfile?.username
                                ? `@${otherProfile.username}`
                                : `Conversation #${conversation.id.slice(0, 8)}`}
                              {isMoolabase && <BadgeCheck size={16} className="text-blue-600" />}
                            </p>
                            <p
                              className={`text-sm mt-1 truncate ${
                                conversation.unread ? 'text-neutral-900 font-medium' : 'text-neutral-500'
                              }`}
                            >
                              {otherProfile?.username ? summarizeLastMessage(conversation) : `User ${otherId.slice(0, 8)}`}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 ml-auto shrink-0">
                        <p className="text-xs text-neutral-500 text-right">
                          Updated {formatDate(conversation.last_message_at || conversation.updated_at)}
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
