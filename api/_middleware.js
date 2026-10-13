/**
 * Middleware global para todas las rutas /api/*
 * Implementa rate limiting usando Vercel KV o memoria (desarrollo)
 */

// Rate limiting simple en memoria (desarrollo)
const requestCounts = new Map()
const WINDOW_MS = 60 * 1000 // 1 minuto
const MAX_REQUESTS = {
  default: 60,      // 60 req/min para endpoints normales
  auth: 5,          // 5 req/min para login (prevenir fuerza bruta)
  payment: 10,      // 10 req/min para checkout
  ai: 20,           // 20 req/min para IA (costoso)
  webhook: 100,     // 100 req/min para webhooks externos
}

function cleanupOldEntries() {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > WINDOW_MS) {
      requestCounts.delete(key)
    }
  }
}

function getRateLimitKey(req) {
  // Usar IP real detrás de Vercel proxy
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress
  return `${ip}:${req.url}`
}

function getRateLimitForEndpoint(url) {
  if (url.includes('/api/auth/login')) return MAX_REQUESTS.auth
  if (url.includes('/api/mercadopago/checkout')) return MAX_REQUESTS.payment
  if (url.includes('/api/mercadopago/webhook')) return MAX_REQUESTS.webhook
  if (url.includes('/api/ai')) return MAX_REQUESTS.ai
  return MAX_REQUESTS.default
}

function isRateLimited(req) {
  cleanupOldEntries()

  const key = getRateLimitKey(req)
  const now = Date.now()
  const limit = getRateLimitForEndpoint(req.url)

  const entry = requestCounts.get(key)

  if (!entry) {
    requestCounts.set(key, { count: 1, windowStart: now })
    return { limited: false, remaining: limit - 1, resetAt: now + WINDOW_MS }
  }

  // Nueva ventana
  if (now - entry.windowStart > WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now })
    return { limited: false, remaining: limit - 1, resetAt: now + WINDOW_MS }
  }

  // Dentro de la ventana
  entry.count++

  if (entry.count > limit) {
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.windowStart + WINDOW_MS,
      retryAfter: Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000)
    }
  }

  return {
    limited: false,
    remaining: limit - entry.count,
    resetAt: entry.windowStart + WINDOW_MS
  }
}

export default function middleware(req, res) {
  // CORS headers
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://www.podcastudio.mx',
    'https://podcastudio.mx',
    'http://localhost:3000',
  ]

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Max-Age', '86400')

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Rate limiting
  const rateLimit = isRateLimited(req)

  // Headers de rate limit
  res.setHeader('X-RateLimit-Limit', getRateLimitForEndpoint(req.url))
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining)
  res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString())

  if (rateLimit.limited) {
    res.setHeader('Retry-After', rateLimit.retryAfter)
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
      retryAfter: rateLimit.retryAfter
    })
    return
  }

  // Continuar con el request
}
