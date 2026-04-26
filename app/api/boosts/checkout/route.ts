import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { resolveColumn } from '@/lib/supabase/schema'
import { getBoostPlan } from '@/lib/boosts/plans'
import { getListingHref } from '@/lib/listings/url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ListingType = 'job' | 'service'

function getBaseUrl(request: NextRequest) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

function getYocoApiBase() {
  return String(process.env.YOCO_API_BASE_URL || 'https://payments.yoco.com/api').replace(/\/+$/, '')
}

function getWebhookUrl(baseUrl: string) {
  const configured = String(process.env.YOCO_WEBHOOK_URL || '').trim()
  if (configured) return configured
  return ''
}

function withQueryParams(urlPath: string, params: Record<string, string>) {
  const separator = urlPath.includes('?') ? '&' : '?'
  const query = new URLSearchParams(params).toString()
  return `${urlPath}${separator}${query}`
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = (createServiceRoleClient() ?? supabase) as any

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const yocoSecret = String(process.env.YOCO_SECRET_KEY || '').trim()
    if (!yocoSecret) {
      return NextResponse.json(
        {
          error: 'Boost payments are not configured yet.',
          code: 'payments_not_configured',
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const listingType = String(body?.listing_type || '').trim() as ListingType
    const listingId = String(body?.listing_id || '').trim()
    const planId = String(body?.plan || '').trim()

    if (listingType !== 'job' && listingType !== 'service') {
      return NextResponse.json({ error: 'Invalid listing_type' }, { status: 400 })
    }
    if (!listingId) return NextResponse.json({ error: 'Missing listing_id' }, { status: 400 })

    const plan = getBoostPlan(planId)
    if (!plan) return NextResponse.json({ error: 'Invalid boost plan' }, { status: 400 })

    const table = listingType === 'job' ? 'jobs' : 'services'
    const ownerColumn = await resolveColumn(supabase as any, table, 'poster_id', 'user_id')
    const { data: listing, error: listingError } = await supabase
      .from(table)
      .select(`id, ${ownerColumn}`)
      .eq('id', listingId)
      .maybeSingle()

    if (listingError) return NextResponse.json({ error: listingError.message || 'Failed to verify listing' }, { status: 500 })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (String((listing as any)?.[ownerColumn] || '') !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: paymentRow, error: paymentInsertError } = await dataClient
      .from('boost_payments')
      .insert({
        user_id: userId,
        listing_type: listingType,
        listing_id: listingId,
        plan: plan.id,
        amount_cents: plan.priceCents,
        currency: 'ZAR',
        status: 'pending',
        metadata: { source: 'boost_checkout' },
      })
      .select('id')
      .maybeSingle()

    if (paymentInsertError || !paymentRow?.id) {
      return NextResponse.json({ error: paymentInsertError?.message || 'Failed to create payment record' }, { status: 500 })
    }

    const baseUrl = getBaseUrl(request)
    const listingHref = getListingHref(listingId, listingType)
    const successUrl = `${baseUrl}${withQueryParams(listingHref, {
      boost_payment: String(paymentRow.id),
      boost_status: 'success',
    })}`
    const cancelUrl = `${baseUrl}${withQueryParams(listingHref, {
      boost_payment: String(paymentRow.id),
      boost_status: 'cancelled',
    })}`
    const webhookUrl = getWebhookUrl(baseUrl)

    const payload = {
      amount: plan.priceCents,
      currency: 'ZAR',
      successUrl,
      cancelUrl,
      metadata: {
        payment_id: String(paymentRow.id),
        listing_type: listingType,
        listing_id: listingId,
        plan: plan.id,
        user_id: userId,
      },
      description: `Boost ${listingType} ${listingId} (${plan.label})`,
      ...(webhookUrl ? { webhookUrl } : {}),
    }

    const yocoResponse = await fetch(`${getYocoApiBase()}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${yocoSecret}`,
      },
      body: JSON.stringify(payload),
    })

    const yocoData = await yocoResponse.json().catch(() => ({}))
    if (!yocoResponse.ok) {
      await dataClient
        .from('boost_payments')
        .update({
          status: 'failed',
          metadata: {
            source: 'boost_checkout',
            yoco_error: yocoData,
          },
        })
        .eq('id', paymentRow.id)

      return NextResponse.json({ error: yocoData?.message || yocoData?.error || 'Failed to create Yoco checkout' }, { status: 502 })
    }

    const yocoCheckoutId = String(yocoData?.id || yocoData?.checkoutId || '').trim()
    const checkoutUrl = String(yocoData?.redirectUrl || yocoData?.url || yocoData?.checkoutUrl || '').trim()
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Yoco checkout URL missing' }, { status: 502 })
    }

    await dataClient
      .from('boost_payments')
      .update({
        yoco_checkout_id: yocoCheckoutId || null,
        checkout_url: checkoutUrl,
      })
      .eq('id', paymentRow.id)

    return NextResponse.json({
      payment_id: paymentRow.id,
      checkout_id: yocoCheckoutId || null,
      checkout_url: checkoutUrl,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
