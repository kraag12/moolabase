import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { activateBoost } from '@/lib/boosts/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asString(value: unknown) {
  return String(value || '').trim()
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function verifySignature(rawBody: string, signature: string, secret: string) {
  const cleaned = signature.trim().replace(/^sha256=/i, '')
  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64')

  const tryCompare = (expected: string) => {
    const a = Buffer.from(expected)
    const b = Buffer.from(cleaned)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  return tryCompare(expectedHex) || tryCompare(expectedBase64)
}

function extractEventShape(payload: any) {
  const eventType = asString(payload?.type || payload?.event || payload?.name).toLowerCase()
  const data = payload?.data || payload?.payload?.data || payload?.payload || payload
  const paymentId = asString(
    data?.id || data?.paymentId || data?.payment_id || data?.payment?.id
  )
  const checkoutId = asString(
    data?.checkoutId || data?.checkout_id || data?.checkout?.id
  )
  const status = asString(data?.status || data?.paymentStatus || data?.payment?.status).toLowerCase()
  const metadata = (
    data?.metadata ||
    data?.checkout?.metadata ||
    payload?.payload?.metadata ||
    payload?.metadata ||
    {}
  ) as Record<string, unknown>
  const paid =
    status === 'succeeded' ||
    status === 'successful' ||
    status === 'paid' ||
    status === 'completed' ||
    eventType.includes('succeeded') ||
    eventType.includes('paid') ||
    eventType.includes('success')

  return { eventType, paymentId, checkoutId, status, metadata, paid }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const payload = safeJsonParse(rawBody)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const providedSignature = asString(
    request.headers.get('webhook-signature') ||
      request.headers.get('x-yoco-signature') ||
      request.headers.get('yoco-signature') ||
      request.headers.get('x-signature')
  )
  const webhookSecret = asString(process.env.YOCO_WEBHOOK_SECRET)
  if (webhookSecret) {
    if (!providedSignature || !verifySignature(rawBody, providedSignature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
  }

  const supabase = await createClient()
  const dataClient = (createServiceRoleClient() ?? supabase) as any
  const evt = extractEventShape(payload)

  const paymentIdFromMetadata = asString(evt.metadata?.payment_id)
  let paymentRow: any = null

  if (paymentIdFromMetadata) {
    const { data } = await dataClient
      .from('boost_payments')
      .select('*')
      .eq('id', paymentIdFromMetadata)
      .maybeSingle()
    paymentRow = data
  }

  if (!paymentRow && evt.checkoutId) {
    const { data } = await dataClient
      .from('boost_payments')
      .select('*')
      .eq('yoco_checkout_id', evt.checkoutId)
      .maybeSingle()
    paymentRow = data
  }

  if (!paymentRow && evt.paymentId) {
    const { data } = await dataClient
      .from('boost_payments')
      .select('*')
      .eq('yoco_payment_id', evt.paymentId)
      .maybeSingle()
    paymentRow = data
  }

  if (!paymentRow) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'payment_not_found' })
  }

  const updatePayload: Record<string, unknown> = {
    raw_event: payload,
    yoco_checkout_id: evt.checkoutId || paymentRow.yoco_checkout_id || null,
    yoco_payment_id: evt.paymentId || paymentRow.yoco_payment_id || null,
    updated_at: new Date().toISOString(),
  }

  if (evt.paid && String(paymentRow.status || '') !== 'paid') {
    const activation = await activateBoost(dataClient, {
      listingType: paymentRow.listing_type,
      listingId: String(paymentRow.listing_id),
      userId: String(paymentRow.user_id),
      planId: String(paymentRow.plan),
    })

    if (!activation.ok) {
      await dataClient
        .from('boost_payments')
        .update({
          ...updatePayload,
          status: 'failed',
          metadata: {
            ...(paymentRow.metadata || {}),
            activation_error: activation.error,
          },
        })
        .eq('id', paymentRow.id)

      return NextResponse.json({ error: activation.error || 'Failed to activate boost' }, { status: 500 })
    }

    await dataClient
      .from('boost_payments')
      .update({
        ...updatePayload,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', paymentRow.id)

    return NextResponse.json({ ok: true, activated: true })
  }

  if (!evt.paid && String(paymentRow.status || '') === 'pending') {
    const normalizedStatus =
      evt.status === 'cancelled' || evt.status === 'canceled'
        ? 'cancelled'
        : evt.status === 'failed' || evt.status === 'declined'
          ? 'failed'
          : 'pending'

    await dataClient
      .from('boost_payments')
      .update({
        ...updatePayload,
        status: normalizedStatus,
      })
      .eq('id', paymentRow.id)
  }

  return NextResponse.json({ ok: true })
}
