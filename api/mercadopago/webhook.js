import { handleMPWebhook } from '../../lib/mercadopago/webhooks.js'
import { getRawBody } from 'raw-body'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers['x-signature'] || req.headers['x-hub-signature'] || ''
    const result = await handleMPWebhook(rawBody, signature)
    res.status(200).json({ ok: true, result })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error webhook' })
  }
}