import { getSubscriptionByUserId, isActiveSubscription } from '../../lib/stripe/subscriptions.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  try {
    const sub = await getSubscriptionByUserId(user.id)
    res.status(200).json({
      planId: sub?.plan_id || null,
      status: sub?.status || null,
      active: sub ? isActiveSubscription(sub.status) : false,
      currentPeriodEnd: sub?.current_period_end || null,
      hasStripeCustomer: !!sub?.stripe_customer_id,
    })
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo cargar la suscripción' })
  }
}
