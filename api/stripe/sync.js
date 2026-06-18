import { syncCheckoutSessionForUser } from '../../lib/stripe/sync.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión para activar tu plan' })
    return
  }

  const { sessionId } = req.body || {}
  if (!sessionId) {
    res.status(400).json({ error: 'Falta sessionId' })
    return
  }

  try {
    const result = await syncCheckoutSessionForUser(sessionId, user.id)
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo sincronizar el pago' })
  }
}
