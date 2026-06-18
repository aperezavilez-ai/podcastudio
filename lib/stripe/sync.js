import { getStripe, retrieveCheckoutSession } from './client.js'
import { ALLOWED_PLAN_IDS } from './plans.js'
import { upsertSubscriptionFromStripe } from './subscriptions.js'

export async function syncCheckoutSessionForUser(sessionId, userId) {
  const session = await retrieveCheckoutSession(sessionId)
  const paid = session.payment_status === 'paid' || session.status === 'complete'
  if (!paid) return { ok: false, planId: null }

  const planId = session.metadata?.planId
  if (!planId || !ALLOWED_PLAN_IDS.has(planId)) {
    throw new Error('Plan inválido en la sesión')
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  const stripe = getStripe()
  let sub = null
  if (subscriptionId && stripe) {
    sub = await stripe.subscriptions.retrieve(subscriptionId)
  }

  await upsertSubscriptionFromStripe({
    userId,
    planId,
    status: sub?.status || 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    currentPeriodEnd: sub
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  })

  return { ok: true, planId }
}
