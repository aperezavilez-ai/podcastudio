import { sendNotificationEmail, isResendConfigured } from '../../lib/email/resend.js'
import { verifyEmailRecipient } from '../../lib/email/auth.js'

const ALLOWED_TYPES = new Set(['welcome', 'project_ready', 'recording_ready', 'live_started'])

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isResendConfigured()) {
    res.status(503).json({ error: 'Email no configurado. Añade RESEND_API_KEY en Vercel.' })
    return
  }

  const { type, to, data } = req.body || {}

  if (!type || !ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: 'Tipo de notificación inválido' })
    return
  }

  if (!isValidEmail(to)) {
    res.status(400).json({ error: 'Correo inválido' })
    return
  }

  const auth = await verifyEmailRecipient(req.headers.authorization, to)
  if (!auth.ok) {
    res.status(403).json({ error: auth.error })
    return
  }

  try {
    const result = await sendNotificationEmail({ type, to, data: data || {} })
    res.status(200).json({ ok: true, id: result.id })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error al enviar email' })
  }
}
