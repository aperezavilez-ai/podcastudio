import { syncPaymentForUser } from '../../lib/mercadopago/sync.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  const { paymentId } = req.body || {}
  if (!paymentId) {
    res.status(400).json({ error: 'Falta paymentId' })
    return
  }
  try {
    const result = await syncPaymentForUser(paymentId, user.id)
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error al sincronizar' })
  }
}