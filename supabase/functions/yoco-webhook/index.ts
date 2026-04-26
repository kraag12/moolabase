// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function extractEvent(payload: Record<string, unknown>) {
  const data =
    (payload?.data as Record<string, unknown> | undefined) ||
    ((payload?.payload as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined) ||
    (payload?.payload as Record<string, unknown> | undefined) ||
    payload

  const eventType = asString(payload?.type || payload?.event || payload?.name).toLowerCase()
  const paymentId = asString(
    data?.id ||
      data?.paymentId ||
      data?.payment_id ||
      (data?.payment as Record<string, unknown> | undefined)?.id
  )
  const checkoutId = asString(
    data?.checkoutId ||
      data?.checkout_id ||
      (data?.checkout as Record<string, unknown> | undefined)?.id
  )
  const status = asString(
    data?.status ||
      data?.paymentStatus ||
      (data?.payment as Record<string, unknown> | undefined)?.status
  ).toLowerCase()
  const metadata =
    ((data?.metadata as Record<string, unknown> | undefined) ||
      ((data?.checkout as Record<string, unknown> | undefined)?.metadata as Record<string, unknown> | undefined) ||
      (payload?.metadata as Record<string, unknown> | undefined) ||
      {}) as Record<string, unknown>

  const paid =
    status === 'paid' ||
    status === 'succeeded' ||
    status === 'successful' ||
    status === 'completed' ||
    eventType.includes('paid') ||
    eventType.includes('success')

  return {
    status: paid ? 'paid' : status || 'pending',
    paymentId,
    checkoutId,
    metadata,
    paid,
  }
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

async function verifySignature(rawBody: string, signature: string, secret: string) {
  const cleaned = signature.trim().replace(/^sha256=/i, '')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const digestBytes = new Uint8Array(signed)
  const expectedHex = toHex(digestBytes)
  const expectedBase64 = btoa(String.fromCharCode(...digestBytes))
  return safeEqual(cleaned, expectedHex) || safeEqual(cleaned, expectedBase64)
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawBody = await request.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const webhookSecret = asString(Deno.env.get('YOCO_WEBHOOK_SECRET'))
  if (webhookSecret) {
    const signature = asString(
      request.headers.get('webhook-signature') ||
        request.headers.get('x-yoco-signature') ||
        request.headers.get('yoco-signature') ||
        request.headers.get('x-signature')
    )
    if (!signature || !(await verifySignature(rawBody, signature, webhookSecret))) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabaseUrl = asString(Deno.env.get('SUPABASE_URL'))
  const serviceRoleKey = asString(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase service role credentials are missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const evt = extractEvent(payload)
  const paymentIdFromMetadata = asString(evt.metadata?.payment_id)

  const { data: result, error } = await supabase.rpc('process_boost_payment_webhook', {
    p_payment_id: paymentIdFromMetadata || null,
    p_checkout_id: evt.checkoutId || null,
    p_yoco_payment_id: evt.paymentId || null,
    p_status: evt.status || null,
    p_raw_event: payload,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message || 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
