import { PLANS } from '../../src/config/plans.js'

export function getStripePlan(planId) {
  const plan = PLANS.find(p => p.id === planId)
  if (!plan) return null

  const amount = plan.interval === 'year'
    ? (plan.billed || plan.price * 12) * 100
    : plan.price * 100

  return {
    ...plan,
    amountCents: amount,
    currency: 'usd',
  }
}

export const ALLOWED_PLAN_IDS = new Set(PLANS.map(p => p.id))
