import crypto from 'node:crypto'
import { getUserFromAuthHeader } from '../lib/supabase/auth.js'
import { applyRateLimit } from '../lib/security/rateLimit.js'

const TURN_CREDENTIAL_TTL_SECONDS = 15 * 60
const CLOUDFLARE_TURN_TTL_SESSION_SECONDS = 86400
const CLOUDFLARE_TURN_TTL_GUEST_SECONDS = 3600
const CLOUDFLARE_TURN_TIMEOUT_MS = 5000

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

// Cloudflare Realtime TURN responde { iceServers: { urls, username,
// credential } } (un objeto, no un array). Se normaliza a la forma que ya
// consume el cliente: { iceServers: [{ urls, username, credential }] }.
// También se acepta que venga como array, por si la API cambia.
export function normalizeCloudflareIceServers(payload) {
  const raw = payload?.iceServers
  const candidates = Array.isArray(raw) ? raw : raw ? [raw] : []
  const servers = candidates.filter(
    (server) =>
      server &&
      (typeof server.urls === 'string' || Array.isArray(server.urls)) &&
      (typeof server.urls === 'string' ? server.urls.length > 0 : server.urls.length > 0),
  )
  return servers.length ? servers : null
}

async function tryCloudflareTurn({ tokenId, apiToken, ttl, fetchFn }) {
  try {
    if (typeof fetchFn !== 'function') return null
    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(tokenId)}/credentials/generate`
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl }),
      signal:
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(CLOUDFLARE_TURN_TIMEOUT_MS)
          : undefined,
    })
    const ok =
      response &&
      (typeof response.ok === 'boolean'
        ? response.ok
        : response.status >= 200 && response.status < 300)
    if (!ok) return null
    const data = await response.json()
    const iceServers = normalizeCloudflareIceServers(data)
    if (!iceServers) return null
    return {
      iceServers,
      expiresAt: Math.floor(Date.now() / 1000) + ttl,
    }
  } catch {
    // Cloudflare caído, sin red o con timeout: nunca es motivo de 500.
    // El llamador cae al comportamiento anterior (coturn o STUN-only).
    return null
  }
}

// Lógica del endpoint, exportada con dependencias inyectables para poder
// probarla en scripts/turn-credentials.test.mjs sin Supabase ni red reales.
// El handler por defecto de Vercel la invoca sin dependencias extra.
export async function handleTurnCredentials(req, res, deps = {}) {
  const env = deps.env || process.env
  const fetchFn = deps.fetchFn || globalThis.fetch
  const getUser = deps.getUserFromAuthHeader || getUserFromAuthHeader
  const rateLimitFn = deps.applyRateLimit || applyRateLimit

  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Vary', 'Origin')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // El rate limit existente se aplica aquí, antes de distinguir sesión o
  // invitado, así que también cubre a los invitados sin sesión que a
  // partir de ahora sí reciben credenciales TURN de Cloudflare.
  if (!rateLimitFn(req, res, { bucket: 'turn-credentials', limit: 30 })) {
    return
  }

  const cloudflareTokenId = env.CLOUDFLARE_TURN_TOKEN_ID
  const cloudflareApiToken = env.CLOUDFLARE_TURN_API_TOKEN
  const hasCloudflare = Boolean(cloudflareTokenId && cloudflareApiToken)

  const urls = (env.TURN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean)
  const sharedSecret = env.TURN_SHARED_SECRET
  const hasCoturn = Boolean(urls.length && sharedSecret)

  if (!hasCloudflare && !hasCoturn) {
    return stunOnly(res)
  }

  // La sesión solo se resuelve si hay algún proveedor TURN configurado:
  // define el TTL de Cloudflare y sigue siendo la compuerta de coturn.
  let user = null
  try {
    user = await getUser(req.headers?.authorization)
  } catch {
    user = null
  }

  // 1) Cloudflare Realtime TURN (proveedor actual en producción).
  //    Con sesión válida: TTL largo. Invitado sin sesión: TTL corto, pero
  //    ya recibe TURN (antes solo recibía STUN, ver informe de remotos).
  if (hasCloudflare) {
    const ttl = user ? CLOUDFLARE_TURN_TTL_SESSION_SECONDS : CLOUDFLARE_TURN_TTL_GUEST_SECONDS
    const cloudflareResult = await tryCloudflareTurn({
      tokenId: cloudflareTokenId,
      apiToken: cloudflareApiToken,
      ttl,
      fetchFn,
    })
    if (cloudflareResult) {
      return res.status(200).json(cloudflareResult)
    }
    // Si Cloudflare falla se cae al comportamiento anterior, sin lanzar.
  }

  // 2) Comportamiento anterior intacto: coturn por HMAC, solo con sesión.
  if (!hasCoturn) {
    return stunOnly(res)
  }

  // Sin sesión se devuelve solo STUN, no un 401: las cámaras remotas
  // (src/pages/RemoteCam.jsx) entran como invitadas con QR/sala, sin
  // cuenta, y su código ya sabe seguir funcionando solo con STUN.
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

export default async function handler(req, res) {
  return handleTurnCredentials(req, res)
}
