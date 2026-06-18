import { getStripe } from './client.js'
import { ALLOWED_PLAN_IDS } from './plans.js'
import {
  getSubscriptionByStripeCustomer,
  getSubscriptionByStripeSubscriptionId,
  upsertSubscriptionFromStripe,
} from './subscriptions.js'

function resolvePlanId(subscription, fallback) {
  const planId = subscription.metadata?.planId
  if (planId && ALLOWED_PLAN_IDS.has(planId)) return planId
  return fallback
}

async function handleCheckoutCompleted(session) {
  const planId = session.metadata?.planId
  let userId = session.metadata?.userId || null
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id

  if (!planId || !ALLOWED_PLAN_IDS.has(planId)) return

  if (!userId && customerId) {
    const existing = await getSubscriptionByStripeCustomer(customerId)
    userId = existing?.user_id || null
  }

  if (!userId) return

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
}

async function handleSubscriptionChange(subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id

  let existing = await getSubscriptionByStripeSubscriptionId(subscription.id)
  if (!existing && customerId) {
    existing = await getSubscriptionByStripeCustomer(customerId)
  }
  if (!existing?.user_id) return

  const planId = resolvePlanId(subscription, existing.plan_id)

  await upsertSubscriptionFromStripe({
    userId: existing.user_id,
    planId,
    status: subscription.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  })
}

export async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) throw new Error('Stripe webhook no configurado')

  const event = stripe.webhooks.constructEvent(rawBody, signature, secret)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object)
      break
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event.data.object)
      break
    default:
      break
  }

  return event
}
