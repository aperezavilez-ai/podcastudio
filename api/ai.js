import { callClaude, validateConfig } from '../lib/ai/claude.js'
import { getUserFromAuthHeader } from '../lib/supabase/auth.js'
import { getSupabaseAdmin } from '../lib/supabase/admin.js'
import { AIError, AIConfigError, AIRateLimitError, AITimeoutError, getErrorCode, getErrorStatus } from '../lib/ai/errors.js'

const { rateLimitCount: RATE_LIMIT_COUNT, rateLimitWindowMs: RATE_LIMIT_WINDOW_MS } = await import('../lib/ai/config.js')

async function checkRateLimit(userId) {
  const admin = getSupabaseAdmin()
  if (!admin) return { allowed: true }
  const now = new Date().toISOString()
  const { data } = await admin
    .from('ai_rate_limits')
    .select('count, window_start')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) {
    await admin.from('ai_rate_limits').insert({ user_id: userId, count: 1, window_start: now })
    return { allowed: true }
  }
  const windowStart = new Date(data.window_start).getTime()
  if (Date.now() - windowStart > RATE_LIMIT_WINDOW_MS) {
    await admin.from('ai_rate_limits').update({ count: 1, window_start: now }).eq('user_id', userId)
    return { allowed: true }
  }
  if (data.count >= RATE_LIMIT_COUNT) return { allowed: false }
  await admin.from('ai_rate_limits').update({ count: data.count + 1 }).eq('user_id', userId)
  return { allowed: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const configCheck = validateConfig()
  if (!configCheck.valid) {
    res.status(503).json({ error: 'IA no configurada', code: 'NOT_CONFIGURED', missing: configCheck.missing })
    return
  }

  const apiKey = process.env.MEAI_API_KEY
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    res.status(401).json({ error: 'No autorizado', code: 'UNAUTHORIZED' })
    return
  }

  const { prompt, systemPrompt, task, stream, maxTokens, temperature, responseFormat } = req.body || {}
  if (!prompt?.trim()) {
    res.status(400).json({ error: 'Falta el prompt', code: 'VALIDATION_ERROR', field: 'prompt' })
    return
  }

  const rl = await checkRateLimit(user.id)
  if (!rl.allowed) {
    res.status(429).json({ error: 'Límite de peticiones excedido. Intenta en un minuto.', code: 'RATE_LIMITED', retryAfter: 60 })
    return
  }

  try {
    const result = await callClaude({
      prompt,
      systemPrompt,
      apiKey,
      maxTokens,
      temperature,
      stream,
      responseFormat,
      onChunk: stream ? (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      } : undefined,
    })

    if (stream) {
      res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\n\n`)
      res.end()
      return
    }

    console.log(`[AI] user=${user.id} task=${task || 'unknown'} chars=${prompt.length} ok=true`)
    res.status(200).json({ text: result.text, usage: result.usage })
  } catch (e) {
    console.error(`[AI] user=${user.id} error=${e?.message || 'unknown'} code=${getErrorCode(e)}`)
    const status = getErrorStatus(e)
    const code = getErrorCode(e)
    res.status(status).json({ error: e.message, code, ...(e.details || {}) })
  }
}