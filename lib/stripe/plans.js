import { PLANS } from '../../src/config/plans.js'

export { PLANS }

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

const PRICE_ENV_KEYS = {
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
  annual: 'STRIPE_PRICE_ANNUAL',
}

export function getStripePriceId(planId) {
  const envKey = PRICE_ENV_KEYS[planId]
  if (!envKey) return null
  const value = process.env[envKey]?.trim()
  return value || null
}
