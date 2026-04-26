import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { activateBoost } from '@/lib/boosts/activate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isManualConfirmEnabled() {
  const configuredWebhook = String(process.env.YOCO_WEBHOOK_URL || '').trim()
  if (configuredWebhook) return false

  const explicit = String(process.env.BOOST_ALLOW_MANUAL_CONFIRM || '').trim().toLowerCase()
  if (!explicit) return true
  return explicit === '1' || explicit === 'true' || explicit === 'yes'
}

export async function POST(request: NextRequest) {
  try {
    if (!isManualConfirmEnabled()) {
      return NextResponse.json({ error: 'Manual boost confirmation is disabled' }, { status: 403 })
    }

    const supabase = await createClient()
    const dataClient = (createServiceRoleClient() ?? supabase) as any

    const { data: auth } = await supabase.auth.getUser()
    const userId = auth?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const paymentId = String(body?.payment_id || '').trim()
    if (!paymentId) return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 })

    const { data: payment, error: paymentError } = await dataClient
      .from('boost_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message || 'Failed to load payment' }, { status: 500 })
    }
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (String(payment.user_id || '') !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (String(payment.status || '') === 'paid') {
      return NextResponse.json({ ok: true, already_paid: true })
    }

    const activation = await activateBoost(dataClient, {
      listingType: String(payment.listing_type) as 'job' | 'service',
      listingId: String(payment.listing_id),
      userId: String(payment.user_id),
      planId: String(payment.plan),
    })

    if (!activation.ok) {
      await dataClient
        .from('boost_payments')
        .update({
          status: 'failed',
          metadata: {
            ...(payment.metadata || {}),
            manual_confirm_error: activation.error || 'activation_failed',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)

      return NextResponse.json({ error: activation.error || 'Failed to activate boost' }, { status: 500 })
    }

    await dataClient
      .from('boost_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: {
          ...(payment.metadata || {}),
          manual_confirmed: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    return NextResponse.json({ ok: true, activated: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
