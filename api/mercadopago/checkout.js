import { createPreference } from '../../lib/mercadopago/client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const { planId, email, userId } = req.body || {}
  if (!planId) {
    res.status(400).json({ error: 'Falta planId' })
    return
  }
  try {
    const pref = await createPreference({ planId, customerEmail: email, userId })
    const url = pref.init_point || pref.sandbox_init_point
    res.status(200).json({ url, preferenceId: pref.id })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error al crear preferencia' })
  }
}