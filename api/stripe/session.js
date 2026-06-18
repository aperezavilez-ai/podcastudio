import { retrieveCheckoutSession } from '../../lib/stripe/client.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const sessionId = req.query?.session_id
  if (!sessionId) {
    res.status(400).json({ error: 'Falta session_id' })
    return
  }

  try {
    const session = await retrieveCheckoutSession(sessionId)
    const paid = session.payment_status === 'paid' || session.status === 'complete'
    res.status(200).json({
      ok: paid,
      planId: session.metadata?.planId || null,
      customerEmail: session.customer_details?.email || session.customer_email,
    })
  } catch (e) {
    res.status(500).json({ error: e.message || 'No se pudo verificar el pago' })
  }
}
