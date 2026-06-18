import { createBillingPortalSession } from '../../lib/stripe/client.js'
import { getSubscriptionByUserId } from '../../lib/stripe/subscriptions.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión para gestionar tu suscripción' })
    return
  }

  try {
    const sub = await getSubscriptionByUserId(user.id)
    if (!sub?.stripe_customer_id) {
      res.status(404).json({ error: 'No tienes una suscripción activa en Stripe' })
      return
    }

    const portal = await createBillingPortalSession(sub.stripe_customer_id)
    res.status(200).json({ url: portal.url })
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo abrir el portal' })
  }
}
