import { createCheckoutSession } from '../../lib/stripe/client.js'
import { ALLOWED_PLAN_IDS } from '../../lib/stripe/plans.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { planId, email, userId } = req.body || {}
  if (!planId || !ALLOWED_PLAN_IDS.has(planId)) {
    res.status(400).json({ error: 'Plan inválido' })
    return
  }

  try {
    const session = await createCheckoutSession({ planId, customerEmail: email, userId })
    res.status(200).json({ url: session.url, sessionId: session.id })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error al crear pago' })
  }
}
