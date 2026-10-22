const DEFAULTS = {
  // Modelo y endpoint
  model: process.env.MEAI_MODEL || 'claude-haiku-4-5',
  apiUrl: process.env.MEAI_API || 'https://api.meai.cloud/v1/chat/completions',

  // Timeouts y reintentos
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 60_000,
  maxRetries: Number(process.env.AI_MAX_RETRIES) || 2,
  retryDelayMs: Number(process.env.AI_RETRY_DELAY_MS) || 1_000,

  // Límites de tokens
  maxPromptChars: Number(process.env.AI_MAX_PROMPT_CHARS) || 100_000,
  maxSystemChars: Number(process.env.AI_MAX_SYSTEM_CHARS) || 20_000,
  defaultMaxTokens: Number(process.env.AI_DEFAULT_MAX_TOKENS) || 4_000,

  // Rate limiting (por usuario)
  rateLimitCount: Number(process.env.AI_RATE_LIMIT_COUNT) || 30,
  rateLimitWindowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60_000,

  // Cliente (frontend)
  clientTimeoutMs: Number(process.env.AI_CLIENT_TIMEOUT_MS) || 45_000,
}

const AI_CONFIG = Object.freeze({ ...DEFAULTS })

function getConfig(key) {
  return AI_CONFIG[key]
}

function validateConfig() {
  const missing = []
  if (!process.env.MEAI_API_KEY) missing.push('MEAI_API_KEY')
  return { valid: missing.length === 0, missing }
}

export {
  AI_CONFIG,
  getConfig,
  validateConfig,
}