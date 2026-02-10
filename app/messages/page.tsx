'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Conversation {
  id: string
  user_1_id: string
  user_2_id: string
  created_at: string
  updated_at: string
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<
    Record<string, { username?: string | null; avatar_url?: string | null }>
  >({})

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const userId = data?.user?.id ?? null
      setCurrentUserId(userId)
      if (!userId) {
        setLoading(false)
        setError('Please log in to view your messages.')
        return
      }
      fetchConversations()
    })()
  }, [])

  async function fetchConversations() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/conversations')

      if (!response.ok) {
        const data = await response.json()
        console.error('API Error:', data)
        throw new Error(data.error || 'Failed to fetch conversations')
      }

      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return
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
        const map: Record<string, { username?: string | null; avatar_url?: string | null }> = {}
        ;(data || []).forEach((profile) => {
          map[profile.id] = {
            username: profile.username,
            avatar_url: profile.avatar_url || profile.profile_picture_url || null,
          }
        })
        setProfileMap(map)
      } catch (e) {
        // ignore profile lookup errors
      }
    })()
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium mb-2">Unable to load conversations</p>
            <p className="text-sm mb-4">{error}</p>
            <p className="text-xs text-red-600">
              Note: If this is a new installation, the database tables may not be set up yet. Please see SUPABASE_SETUP.md
              for setup instructions.
            </p>
            <button
              onClick={() => fetchConversations()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-neutral-300 border-t-black rounded-full"></div>
            </div>
            <p className="text-neutral-600 mt-4">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center shadow-sm">
            <MessageCircle className="mx-auto text-neutral-400 mb-4" size={48} />
            <p className="text-neutral-600 text-lg font-medium mb-2">No conversations yet</p>
            <p className="text-neutral-500 mb-6">Start messaging after you connect with someone</p>
            <Link
              href="/jobs"
              className="inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition font-medium"
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
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
                          <p className="font-semibold text-neutral-900 truncate">
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
