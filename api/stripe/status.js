import { isStripeConfigured } from '../../lib/stripe/client.js'
import { PLANS } from '../../lib/stripe/plans.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({
    configured: isStripeConfigured(),
    provider: 'stripe',
    currency: 'usd',
    plans: PLANS.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      interval: p.interval,
      billed: p.billed,
    })),
  })
}
