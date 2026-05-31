// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

let cachedClient: ReturnType<typeof createBrowserClient> | null = null

function createNoopProxy(): any {
  const noopTarget = () => undefined
  return new Proxy(noopTarget as any, {
    get(target, property) {
      if (property === 'then') return undefined
      if (property === Symbol.toPrimitive) return () => ''
      if (property === 'toString') return () => '[SupabaseUnavailable]'
      if (property === 'valueOf') return () => null
      return createNoopProxy()
    },
    apply() {
      return createNoopProxy()
    },
    construct() {
      return createNoopProxy()
    },
  })
}

const noopSupabase = createNoopProxy()

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('Supabase client env vars are missing in the browser bundle.')
    }
    return null
  }

  if (!cachedClient) {
    cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return cachedClient
}

export const supabase = new Proxy({} as any, {
  get(_target, property) {
    const client = getSupabaseClient()
    if (!client) return (noopSupabase as any)[property]
    return (client as any)[property]
  },
  apply(_target, _thisArg, argumentsList) {
    const client = getSupabaseClient()
    if (!client) return noopSupabase
    return (client as any)(...argumentsList)
  },
}) as any
