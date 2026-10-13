import { getSupabaseAdmin } from '../supabase/admin.js'

const ACTIVE_STATUSES = new Set(['approved', 'authorized', 'in_process'])

export function isActivePayment(status) {
  return ACTIVE_STATUSES.has(status)
}

export async function upsertSubscriptionFromMP({ userId, planId, status, mpPreferenceId, mpPaymentId, mpPayerId }) {
  const admin = getSupabaseAdmin()
  if (!admin) throw new Error('Supabase admin no configurado')
  if (!userId) throw new Error('Falta userId')

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    plan_id: planId,
    status,
    mp_preference_id: mpPreferenceId || null,
    mp_payment_id: mpPaymentId || null,
    mp_payer_id: mpPayerId || null,
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

export async function getSubscriptionByMPPreferenceId(preferenceId) {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('mp_preference_id', preferenceId)
    .maybeSingle()
  return data
}

export async function getSubscriptionByMPaymentId(paymentId) {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from('subscriptions')
    .select('*')
    .eq('mp_payment_id', paymentId)
    .maybeSingle()
  return data
}