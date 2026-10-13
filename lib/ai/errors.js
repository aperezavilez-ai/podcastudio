class AIError extends Error {
  constructor(message, code, status = 500, details = {}) {
    super(message)
    this.name = 'AIError'
    this.code = code
    this.status = status
    this.details = details
  }

  static fromResponse(res, data) {
    const code = data?.code || 'AI_ERROR'
    const status = res?.status || 500
    return new AIError(data?.error || data?.message || 'Error de IA', code, status, data)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
    }
  }
}

class AIRateLimitError extends AIError {
  constructor(message, retryAfter = 60) {
    super(message, 'RATE_LIMITED', 429, { retryAfter })
    this.name = 'AIRateLimitError'
  }
}

class AITimeoutError extends AIError {
  constructor(message = 'La IA tardó demasiado en responder') {
    super(message, 'TIMEOUT', 504)
    this.name = 'AITimeoutError'
  }
}

class AIValidationError extends AIError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400, { field })
    this.name = 'AIValidationError'
  }
}

class AIConfigError extends AIError {
  constructor(message = 'IA no configurada') {
    super(message, 'NOT_CONFIGURED', 503)
    this.name = 'AIConfigError'
  }
}

class AIAuthError extends AIError {
  constructor(message = 'No autorizado') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'AIAuthError'
  }
}

function isAIError(err) {
  return err instanceof AIError
}

function getErrorCode(err) {
  if (isAIError(err)) return err.code
  if (err?.name === 'AbortError') return 'ABORTED'
  return 'UNKNOWN'
}

function getErrorStatus(err) {
  if (isAIError(err)) return err.status
  return 500
}

export {
  AIError,
  AIRateLimitError,
  AITimeoutError,
  AIValidationError,
  AIConfigError,
  AIAuthError,
  isAIError,
  getErrorCode,
  getErrorStatus,
}