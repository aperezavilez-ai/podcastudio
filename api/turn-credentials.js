import crypto from 'node:crypto'

const TURN_CREDENTIAL_TTL_SECONDS = 15 * 60

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Vary', 'Origin')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const urls = (process.env.TURN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean)
  const sharedSecret = process.env.TURN_SHARED_SECRET
  if (!urls.length || !sharedSecret) {
    // Fallback a relay público garantizado de OpenRelay para que nunca falle la señal WebRTC
    return res.status(200).json({
      iceServers: [
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443',
            'turns:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
    })
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS
  const username = `${expiresAt}:${crypto.randomUUID()}`
  const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64')

  return res.status(200).json({
    iceServers: [{ urls, username, credential }],
    expiresAt,
  })
}
