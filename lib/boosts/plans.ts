export type BoostPlanId = '24h' | '3d' | '7d'

export type BoostPlan = {
  id: BoostPlanId
  label: string
  durationHours: number
  priceCents: number
}

export const BOOST_PLANS: BoostPlan[] = [
  { id: '24h', label: '24 hours', durationHours: 24, priceCents: 2000 },
  { id: '3d', label: '3 days', durationHours: 72, priceCents: 4500 },
  { id: '7d', label: '7 days', durationHours: 168, priceCents: 6500 },
]

export function getBoostPlan(id: string | null | undefined) {
  const normalized = String(id || '').trim()
  return BOOST_PLANS.find((plan) => plan.id === normalized) || null
}
