// Rate limiting compartido para las funciones serverless de /api.
//
// Reemplaza a api/_middleware.js, que nunca se ejecutaba: Vercel no corre
// archivos dentro de /api como middleware global (el middleware de Vercel
// vive en la raíz del proyecto) y ningún endpoint lo importaba. Por eso el
// límite tiene que aplicarse dentro de cada handler, como se hace aquí.
//
// Limitación conocida: el conteo vive en memoria de cada instancia
// serverless, así que es una protección "best effort" (se reinicia con la
// instancia y no se comparte entre instancias). Para un límite distribuido
// haría falta un almacén compartido (Vercel KV / Upstash / Supabase, como
// ya hace api/ai.js con la tabla ai_rate_limits).

const buckets = new Map()
const DEFAULT_WINDOW_MS = 60 * 1000

function sweep(now, windowMs) {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStart > windowMs) buckets.delete(key)
  }
}

export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket?.remoteAddress
  return ip || 'unknown'
}

// Devuelve true si la petición puede continuar.
// Si supera el límite, responde 429 y devuelve false: el handler debe salir.
export function applyRateLimit(req, res, { bucket, limit, windowMs = DEFAULT_WINDOW_MS, key } = {}) {
  const now = Date.now()
  if (buckets.size > 1000) sweep(now, windowMs)

  const bucketKey = `${bucket}:${key || getClientIp(req)}`
  let entry = buckets.get(bucketKey)

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 0, windowStart: now }
    buckets.set(bucketKey, entry)
  }
  entry.count++

  const resetAt = entry.windowStart + windowMs
  res.setHeader('X-RateLimit-Limit', limit)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - entry.count))
  res.setHeader('X-RateLimit-Reset', new Date(resetAt).toISOString())

  if (entry.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000))
    res.setHeader('Retry-After', retryAfter)
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    })
    return false
  }
  return true
}
