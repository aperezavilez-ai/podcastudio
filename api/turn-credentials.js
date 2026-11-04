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
    // Servidores STUN globales de alta velocidad y latencia ultra-baja (Google + Cloudflare)
    return res.status(200).json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
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
