import { handleStripeWebhook } from '../../lib/stripe/webhooks.js'

export const config = {
  api: { bodyParser: false },
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const signature = req.headers['stripe-signature']
  if (!signature) {
    res.status(400).json({ error: 'Falta firma de Stripe' })
    return
  }

  try {
    const rawBody = await readRawBody(req)
    const event = await handleStripeWebhook(rawBody, signature)
    res.status(200).json({ received: true, type: event.type })
  } catch (e) {
    res.status(400).json({ error: e.message || 'Webhook inválido' })
  }
}
