import { getBoostPlan } from '@/lib/boosts/plans'

type ListingType = 'job' | 'service'

type ActivateBoostInput = {
  listingType: ListingType
  listingId: string
  userId: string
  planId: string
}

export function isMissingRelation(error: unknown) {
  const msg = String((error as any)?.message || error || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('relation')
}

export async function activateBoost(
  dataClient: any,
  input: ActivateBoostInput
) {
  const plan = getBoostPlan(input.planId)
  if (!plan) {
    return { ok: false as const, error: 'Invalid boost plan' }
  }

  const now = new Date()
  const startsAt = now.toISOString()

  const { data: existing, error: existingError } = await dataClient
    .from('boosts')
    .select('id, ends_at')
    .eq('listing_type', input.listingType)
    .eq('listing_id', input.listingId)
    .gte('ends_at', startsAt)
    .order('ends_at', { ascending: false })
    .limit(1)

  if (existingError && !isMissingRelation(existingError)) {
    return { ok: false as const, error: existingError.message || 'Failed to check boosts' }
  }

  if (existing && existing.length > 0) {
    const currentEnd = String(existing[0].ends_at || '')
    const currentTs = Date.parse(currentEnd)
    const nextEnd = Number.isFinite(currentTs) && currentTs > now.getTime() ? new Date(currentTs) : now
    const extendedEnd = new Date(nextEnd.getTime() + plan.durationHours * 60 * 60 * 1000).toISOString()

    const { data, error } = await dataClient
      .from('boosts')
      .update({ ends_at: extendedEnd, plan: plan.id, price_cents: plan.priceCents })
      .eq('id', existing[0].id)
      .select()
      .maybeSingle()

    if (error) {
      return { ok: false as const, error: error.message || 'Failed to extend boost' }
    }

    return { ok: true as const, boost: data, extended: true as const }
  }

  const endsAt = new Date(now.getTime() + plan.durationHours * 60 * 60 * 1000).toISOString()
  const { data, error } = await dataClient
    .from('boosts')
    .insert({
      listing_type: input.listingType,
      listing_id: input.listingId,
      user_id: input.userId,
      plan: plan.id,
      price_cents: plan.priceCents,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select()
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: error.message || 'Failed to create boost' }
  }

  return { ok: true as const, boost: data, extended: false as const }
}
