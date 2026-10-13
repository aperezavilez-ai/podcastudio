import { getSubscriptionByUserId } from '../../lib/mercadopago/subscriptions.js'
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
    if (!sub) return res.status(200).json({ active: false })
    const active = ['active', 'approved'].includes(sub.status) || sub.status === 'active'
    res.status(200).json({ active: true, planId: sub.plan_id, status: sub.status, ...sub })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error' })
  }
}