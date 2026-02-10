'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, ImagePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export default function MessageThreadPage() {
  const params = useParams()
  const conversationId = params.id as string

  const allowedImageTypes = ['image/jpeg', 'image/png']
  const storageBucket = 'avatars'

  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch messages on mount and periodically
  useEffect(() => {
    if (!conversationId) return
    let interval: NodeJS.Timeout | null = null
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const userId = data?.user?.id ?? null
      setCurrentUserId(userId)
      if (!userId) {
        setError('Please log in to view this conversation.')
        setLoading(false)
        return
      }
      fetchMessages()
      interval = setInterval(fetchMessages, 3000)
    })()
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [conversationId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [imageFile])

  const isImageContent = (value: string) => {
    const lower = value.toLowerCase()
    return (
      (lower.startsWith('http://') || lower.startsWith('https://')) &&
      (lower.includes('/message-images/') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg'))
    )
  }

  async function fetchMessages() {
    try {
      const response = await fetch(`/api/messages?conversation_id=${conversationId}`)
      if (!response.ok) throw new Error('Failed to fetch messages')
      const data = await response.json()
      setMessages(data.messages || [])
      setError('')
    } catch (err: any) {
      console.error('Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(text: string) {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: text,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to send message')
    }
  }

  async function uploadMessageImage(file: File) {
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id || currentUserId
    if (!userId) {
      throw new Error('Please log in to upload images.')
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${userId}-${Date.now()}.${extension}`
    const filePath = `message-images/${filename}`
    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(filePath, file, { contentType: file.type })

    if (error) {
      throw new Error(error.message || 'Upload failed')
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(storageBucket).getPublicUrl(filePath)

    return publicUrl
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedImageTypes.includes(file.type)) {
      setImageError('Only JPG or PNG images are allowed.')
      setImageFile(null)
      return
    }
    setImageError('')
    setImageFile(file)
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    if (!content.trim() && !imageFile) return

    try {
      setSending(true)
      setError('')
      if (content.trim()) {
        await sendMessage(content.trim())
      }
      if (imageFile) {
        const imageUrl = await uploadMessageImage(imageFile)
        if (imageUrl) {
          await sendMessage(imageUrl)
        }
      }

      setContent('')
      setImageFile(null)
      setImagePreview(null)
      setImageError('')
      await fetchMessages()
    } catch (err: any) {
      console.error('Send error:', err)
      setError(err.message)
    } finally {
      setSending(false)
    }
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
          <h1 className="text-lg font-semibold text-neutral-900">Conversation</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 py-6">
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
          <div className="text-center py-12 text-gray-500">
            <p>No messages yet. Start the conversation!</p>
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
                  {isImageContent(message.content) ? (
                    <img
                      src={message.content}
                      alt="Message attachment"
                      className="rounded-lg max-w-full h-auto"
                    />
                  ) : (
                    <p className="text-wrap">{message.content}</p>
                  )}
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
      <div className="bg-white border-t border-neutral-200 sticky bottom-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {imagePreview && (
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg border border-neutral-200 overflow-hidden">
                <img src={imagePreview} alt="Attachment preview" className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => setImageFile(null)}
                className="text-sm text-neutral-600 hover:text-neutral-900"
              >
                Remove image
              </button>
            </div>
          )}
          {imageError && <p className="text-sm text-red-600">{imageError}</p>}
          <div className="flex gap-2 items-center">
            <label className="inline-flex items-center justify-center h-11 w-11 rounded-lg border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer">
              <ImagePlus size={18} className="text-neutral-700" />
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!content.trim() && !imageFile) || sending}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
