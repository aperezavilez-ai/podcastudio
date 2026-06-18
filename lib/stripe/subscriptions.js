import { getSupabaseAdmin } from '../supabase/admin.js'

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function isActiveSubscription(status) {
  return ACTIVE_STATUSES.has(status)
}

export async function upsertSubscriptionFromStripe({
  userId,
  planId,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
}) {
  const admin = getSupabaseAdmin()
  if (!admin) throw new Error('Supabase admin no configurado')
  if (!userId) throw new Error('Falta userId')

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    plan_id: planId,
    status,
    stripe_customer_id: stripeCustomerId || null,
    stripe_subscription_id: stripeSubscriptionId || null,
    current_period_end: currentPeriodEnd || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw error
}

export async function getSubscriptionByUserId(userId) {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function getSubscriptionByStripeCustomer(customerId) {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data
}

export async function getSubscriptionByStripeSubscriptionId(subscriptionId) {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  return data
}
