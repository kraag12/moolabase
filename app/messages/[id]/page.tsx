'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { isAbortError } from '@/lib/errors/isAbortError'
import { ABORT_REASON } from '@/lib/abort-reason'

interface Conversation {
  id: string;
  locked: boolean;
  user_1_id: string;
  user_2_id: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const MOOLABASE_USER_ID = 'a81a7258-2e86-5309-8714-3358315a6b05';

export default function MessageThreadPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [otherProfile, setOtherProfile] = useState<{ username?: string | null; avatar_url?: string | null } | null>(
    null
  );

  // Fetch messages on mount and periodically
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;
    const fetchController = new AbortController();

    // Wrap these functions to respect `cancelled` flag and abort signal
    const fetchConversationDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, locked, user_1_id, user_2_id')
          .eq('id', conversationId)
          .single();
        if (cancelled) return;
        if (error) throw error;
        setConversation(data as Conversation);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Fetch conversation details error:', err);
        }
      }
    };

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages?conversation_id=${conversationId}`, {
          signal: fetchController.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch messages');
        const data = await response.json();
        if (cancelled) return;
        setMessages(data.messages || []);
        setError('');
      } catch (err: any) {
        if (cancelled || isAbortError(err)) return;
        console.error('Fetch error:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const userId = data?.user?.id ?? null;
        setCurrentUserId(userId);
        if (!userId) {
          if (!cancelled) setError('Please log in to view this conversation.');
          if (!cancelled) setLoading(false);
          return;
        }
        await fetchConversationDetails();
        if (!cancelled) {
          await fetchMessages();
          interval = setInterval(fetchMessages, 3000);
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (!cancelled) setError('Failed to verify your session. Please refresh and try again.');
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      fetchController.abort(ABORT_REASON);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversation || !currentUserId) return;
    let cancelled = false;
    const otherId =
      conversation.user_1_id === currentUserId ? conversation.user_2_id : conversation.user_1_id;
    if (!otherId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url, profile_picture_url')
          .eq('id', otherId)
          .maybeSingle();
        if (cancelled) return;
        if (!data) {
          setOtherProfile(null);
          return;
        }
        setOtherProfile({
          username: data.username ?? null,
          avatar_url: data.avatar_url || data.profile_picture_url || null,
        });
      } catch {
        if (!cancelled) {
          setOtherProfile(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation, currentUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  async function sendMessage(text: string) {
    const controller = new AbortController();
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }
     } finally {
       // no-op: request completed
     }
   }


  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (sending || conversation?.locked) return;
    if (!content.trim()) return;

    try {
      setSending(true);
      setError('');
      await sendMessage(content.trim());
      setContent('');
    } catch (err: any) {
      console.error('Send error:', err);
      setError(err.message);
    } finally {
      setSending(false);
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
                  <p className="text-wrap">{message.content}</p>
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
        {conversation?.locked && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="bg-neutral-100 border border-neutral-200 text-neutral-600 text-sm text-center px-4 py-2 rounded-lg">
              This conversation is read-only.
            </div>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={conversation?.locked ? "This conversation is read-only" : "Type a message..."}
              disabled={sending || conversation?.locked}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!content.trim() || sending || conversation?.locked}
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

