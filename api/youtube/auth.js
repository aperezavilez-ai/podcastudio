import { getYouTubeAuthUrl, isYouTubeConfigured } from '../../lib/youtube/client.js'
import { getUserFromAuthHeader } from '../../lib/supabase/auth.js'
import { randomBytes } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isYouTubeConfigured()) {
    res.status(503).json({ error: 'Añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel' })
    return
  }

  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'Inicia sesión para conectar YouTube' })
    return
  }

  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    nonce: randomBytes(16).toString('hex'),
  })).toString('base64url')

  res.status(200).json({ url: getYouTubeAuthUrl(state) })
}
