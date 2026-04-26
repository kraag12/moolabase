'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, BadgeCheck, Image as ImageIcon, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/errors/isAbortError'

interface Conversation {
  id: string;
  locked?: boolean;
  user_1_id: string;
  user_2_id: string;
  other_user?: { id: string; username: string | null; avatar_url: string | null } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  image_url?: string | null;
}

const MOOLABASE_USER_ID = 'a81a7258-2e86-5309-8714-3358315a6b05';

export default function MessageThreadPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false)
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [otherProfile, setOtherProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMarkedReadAtRef = useRef<number>(0)

  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
  const maxImageBytes = 6 * 1024 * 1024

  const dedupeById = (items: Message[]) => {
    const result: Message[] = []
    const indexById = new Map<string, number>()
    for (const item of items) {
      const id = String((item as any)?.id || '')
      if (!id) continue
      const existingIndex = indexById.get(id)
      if (existingIndex === undefined) {
        indexById.set(id, result.length)
        result.push(item)
      } else {
        // keep the most recent value but preserve ordering
        result[existingIndex] = item
      }
    }
    return result
  }

  // Fetch messages on mount and periodically
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;

    // Wrap these functions to respect `cancelled` flag and abort signal
    const fetchConversationDetails = async () => {
      try {
        const response = await fetch(`/api/conversations?id=${encodeURIComponent(conversationId)}`, {
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'Failed to fetch conversation')
        if (cancelled) return

        const nextUserId = (payload?.user_id ?? null) as string | null
        currentUserIdRef.current = nextUserId
        setCurrentUserId(nextUserId)
        const convo = (payload?.conversation ?? null) as Conversation | null
        setConversation(convo)

        const other = convo?.other_user ?? null
        setOtherProfile(other ? { username: other.username ?? null, avatar_url: other.avatar_url ?? null } : null)
      } catch (err: any) {
        if (cancelled || isAbortError(err)) return
        if (!cancelled) setError(err?.message || 'Failed to load conversation')
      }
    };

    const markConversationRead = async () => {
      try {
        await fetch('/api/conversations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conversationId }),
        })
      } catch (err) {
        if (cancelled || isAbortError(err)) return
      }
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages?conversation_id=${conversationId}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        if (cancelled) return;
        const nextMessages = Array.isArray(data.messages) ? (data.messages as Message[]) : []
        setMessages(dedupeById(nextMessages));
        setError('');

        const last = Array.isArray(nextMessages) && nextMessages.length > 0 ? nextMessages[nextMessages.length - 1] : null
        const viewerId = currentUserIdRef.current
        if (last && viewerId && String(last.sender_id || '') !== viewerId) {
          const lastTs = Date.parse(String(last.created_at || ''))
          if (Number.isFinite(lastTs) && lastTs > lastMarkedReadAtRef.current) {
            lastMarkedReadAtRef.current = lastTs
            void markConversationRead()
          }
        }
      } catch (err: any) {
        if (cancelled || isAbortError(err)) return;
        console.error('Fetch error:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    (async () => {
      await fetchConversationDetails()
      if (cancelled) return
      // mark as read on open (helps clear badges quickly even before the poll loop)
      void markConversationRead()
      await fetchMessages()
      if (!cancelled) interval = setInterval(fetchMessages, 3000)
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!imageFile) {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(imageFile)
    setImagePreviewUrl(nextUrl)
    return () => {
      URL.revokeObjectURL(nextUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile])



  async function sendMessage(text: string) {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: text,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send message')
    }

    const created = data?.message as Message | undefined
    if (created?.id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev
        return prev.concat(created)
      })
    }
  }

  async function uploadImageAndGetUrl(file: File) {
    const userId = currentUserId
    if (!userId) throw new Error('Please log in before sending images.')

    if (!allowedImageTypes.includes(file.type)) {
      throw new Error('Only JPG, PNG, or WebP images are allowed.')
    }
    if (file.size > maxImageBytes) {
      throw new Error('Image is too large (max 6MB).')
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${userId}/message-images/${timestamp}-${safeName}`

    setUploadingImage(true)
    try {
      const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
      if (error) throw new Error(error.message || 'Failed to upload image')

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      if (!publicUrl) throw new Error('Failed to get image URL')
      return publicUrl
    } finally {
      setUploadingImage(false)
    }
  }

  async function sendMessageWithImage(text: string, imageUrl: string) {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: text,
        image_url: imageUrl,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to send message')
    }

    const created = data?.message as Message | undefined
    if (created?.id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev
        return prev.concat(created)
      })
    }
  }


  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (sendingRef.current || sending || conversation?.locked) return;
    const text = content.trim()
    if (!text && !imageFile) return;

    try {
      sendingRef.current = true
      setSending(true);
      setError('');

      if (imageFile) {
        const url = await uploadImageAndGetUrl(imageFile)
        await sendMessageWithImage(text, url)
        setImageFile(null)
      } else {
        await sendMessage(text);
      }

      setContent('');
    } catch (err: any) {
      console.error('Send error:', err);
      setError(err.message);
    } finally {
      setSending(false);
      sendingRef.current = false
    }
  }

  const handlePickImage = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    // allow reselecting the same file
    e.target.value = ''
    if (!file) return
    setImageFile(file)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/messages"
            className="text-neutral-500 hover:text-neutral-800 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            {otherProfile?.avatar_url && (
              <div className="h-9 w-9 rounded-full overflow-hidden border border-neutral-200">
                <img
                  src={otherProfile.avatar_url}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-neutral-900 inline-flex items-center gap-1 truncate">
                {otherProfile?.username ? `@${otherProfile.username}` : 'Conversation'}
                {(otherProfile?.username?.toLowerCase() === 'moolabase' ||
                  (conversation &&
                    (conversation.user_1_id === MOOLABASE_USER_ID || conversation.user_2_id === MOOLABASE_USER_ID))) && (
                  <BadgeCheck size={16} className="text-blue-600" />
                )}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 py-6 pb-40">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
            </div>
            <p className="text-gray-600 mt-4">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="font-medium">No messages yet. Start the conversation!</p>
            <p className="text-sm mt-2">Send a quick hello to get things going.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "Hey! 👋",
                "Hi, when are you available?",
                "Thanks for accepting — let's chat.",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setContent(preset)}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender_id === currentUserId
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                    message.sender_id === currentUserId
                      ? 'bg-black text-white'
                      : 'bg-white text-neutral-900 border border-neutral-200'
                  }`}
                >
                  {message.image_url && (
                    <div className="mb-2">
                      <img
                        src={message.image_url}
                        alt="Sent image"
                        className="max-h-64 w-full rounded-xl object-cover border border-neutral-200"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {message.content ? <p className="text-wrap">{message.content}</p> : null}
                  <p
                    className={`text-xs mt-1 ${
                      message.sender_id === currentUserId
                        ? 'text-neutral-300'
                        : 'text-neutral-500'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-neutral-200 fixed left-0 right-0 bottom-20 z-20">
        {conversation?.locked && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="bg-neutral-100 border border-neutral-200 text-neutral-600 text-sm text-center px-4 py-2 rounded-lg">
              This conversation is read-only.
            </div>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />

          {imagePreviewUrl && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={imagePreviewUrl} alt="Preview" className="h-12 w-12 rounded-lg object-cover border border-neutral-200" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{imageFile?.name || 'Image'}</div>
                  <div className="text-xs text-neutral-600">
                    {uploadingImage ? 'Uploading…' : 'Ready to send'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageFile(null)}
                className="h-9 w-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center"
                aria-label="Remove image"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={handlePickImage}
              disabled={sending || conversation?.locked || uploadingImage}
              className="h-10 w-10 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 flex items-center justify-center"
              aria-label="Attach image"
            >
              <ImageIcon size={20} />
            </button>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={conversation?.locked ? "This conversation is read-only" : "Type a message..."}
              disabled={sending || conversation?.locked || uploadingImage}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!content.trim() && !imageFile) || sending || conversation?.locked || uploadingImage}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

