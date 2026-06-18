import Stripe from 'stripe'
import { getStripePlan, getStripePriceId } from './plans.js'

let stripeClient = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!stripeClient) stripeClient = new Stripe(key)
  return stripeClient
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getSiteUrl() {
  return process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://podcastudio-three.vercel.app'
}

export async function createBillingPortalSession(customerId) {
  const stripe = getStripe()
  if (!stripe) throw new Error('Stripe no configurado')
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getSiteUrl()}/plans`,
  })
}

export async function createCheckoutSession({ planId, customerEmail, userId }) {
  const stripe = getStripe()
  if (!stripe) throw new Error('Stripe no configurado')

  const plan = getStripePlan(planId)
  if (!plan) throw new Error('Plan inválido')

  const site = getSiteUrl()
  const isAnnual = plan.interval === 'year'
  const priceId = getStripePriceId(planId)

  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: plan.currency,
          product_data: {
            name: `PodcastStudio ${plan.name}`,
            description: plan.description,
          },
          unit_amount: plan.amountCents,
          recurring: {
            interval: isAnnual ? 'year' : 'month',
          },
        },
        quantity: 1,
      }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: customerEmail || undefined,
    line_items: [lineItem],
    metadata: { planId: plan.id, userId: userId || '' },
    subscription_data: {
      metadata: { planId: plan.id, userId: userId || '' },
    },
    success_url: `${site}/plans?checkout=success&plan=${plan.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/plans?checkout=cancel`,
    allow_promotion_codes: true,
  })

  return session
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe()
  if (!stripe) throw new Error('Stripe no configurado')
  return stripe.checkout.sessions.retrieve(sessionId)
}
