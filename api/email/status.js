import { isResendConfigured, getFromAddress } from '../../lib/email/resend.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({
    configured: isResendConfigured(),
    from: isResendConfigured() ? getFromAddress() : null,
    provider: 'resend',
    types: ['welcome', 'project_ready', 'recording_ready', 'live_started'],
  })
}
