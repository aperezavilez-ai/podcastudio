import crypto from 'node:crypto'
import { getUserFromAuthHeader } from '../lib/supabase/auth.js'
import { applyRateLimit } from '../lib/security/rateLimit.js'

const TURN_CREDENTIAL_TTL_SECONDS = 15 * 60

// Servidores STUN públicos de Google y Cloudflare: no son un secreto y no
// tienen costo por uso, por eso se pueden entregar sin sesión.
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

function stunOnly(res) {
  return res.status(200).json({
    iceServers: STUN_SERVERS,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Vary', 'Origin')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!applyRateLimit(req, res, { bucket: 'turn-credentials', limit: 30 })) {
    return
  }

  const urls = (process.env.TURN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean)
  const sharedSecret = process.env.TURN_SHARED_SECRET
  if (!urls.length || !sharedSecret) {
    return stunOnly(res)
  }

  // Las credenciales TURN sí cuestan (ancho de banda del servidor TURN) y
  // antes se le entregaban a cualquier visitante anónimo. Ahora solo se
  // emiten con una sesión válida de Supabase.
  //
  // Sin sesión se devuelve solo STUN, no un 401: las cámaras remotas
  // (src/pages/RemoteCam.jsx) entran como invitadas con QR/sala, sin
  // cuenta, y su código ya sabe seguir funcionando solo con STUN.
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    return stunOnly(res)
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS
  const username = `${expiresAt}:${crypto.randomUUID()}`
  const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64')

  return res.status(200).json({
    iceServers: [{ urls, username, credential }],
    expiresAt,
  })
}
