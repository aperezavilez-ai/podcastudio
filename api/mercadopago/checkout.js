import { createPreference } from '../../lib/mercadopago/client.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { applyRateLimit } from '../../lib/security/rateLimit.js'

// Único catálogo válido: lib/mercadopago/client.js solo tiene precio para
// estos tres planes; cualquier otro planId se cobraba como Starter.
const ALLOWED_PLANS = new Set(['starter', 'pro', 'annual'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Igual que subscription.js y sync.js: la identidad sale del token de
  // Supabase, nunca del body. Antes cualquiera podía mandar el userId y el
  // correo de otra persona y la preferencia (y su webhook) quedaban
  // asociados a esa cuenta.
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  if (!applyRateLimit(req, res, { bucket: 'mercadopago-checkout', limit: 10, key: user.id })) {
    return
  }

  const { planId } = req.body || {}
  if (!planId || !ALLOWED_PLANS.has(planId)) {
    res.status(400).json({ error: 'planId inválido' })
    return
  }

  try {
    const pref = await createPreference({ planId, customerEmail: user.email, userId: user.id })
    const url = pref.init_point || pref.sandbox_init_point
    res.status(200).json({ url, preferenceId: pref.id })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error al crear preferencia' })
  }
}
