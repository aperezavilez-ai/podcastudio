/**
 * Validación de firma de webhooks de Mercado Pago
 * Implementa HMAC-SHA256 para verificar autenticidad
 */

const crypto = require('crypto')

/**
 * Verifica la firma de un webhook de Mercado Pago
 * @param {Buffer} rawBody - Cuerpo crudo del request
 * @param {string} signature - Header X-Signature de Mercado Pago
 * @param {string} secret - MERCADO_PAGO_WEBHOOK_SECRET
 * @returns {boolean} - true si la firma es válida
 */
function verifyMercadoPagoSignature(rawBody, signature, secret) {
  if (!signature || !secret) {
    throw new Error('Signature o secret faltante')
  }

  try {
    // Mercado Pago puede enviar múltiples firmas separadas por coma
    // Formato: ts=1234567890,v1=abc123,v2=def456
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.trim().split('=')
      acc[key] = value
      return acc
    }, {})

    const timestamp = parts.ts
    const receivedSignature = parts.v1 || parts.v2

    if (!timestamp || !receivedSignature) {
      throw new Error('Formato de firma inválido')
    }

    // Construir payload: ts.rawBody
    const payload = `${timestamp}.${rawBody.toString()}`

    // Calcular HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Comparación segura contra timing attacks
    const receivedBuffer = Buffer.from(receivedSignature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  } catch (error) {
    console.error('[MP Signature] Error validando firma:', error)
    return false
  }
}

/**
 * Verifica que el timestamp del webhook no sea muy antiguo
 * Previene replay attacks
 * @param {string} signature - Header X-Signature
 * @param {number} maxAgeSeconds - Edad máxima permitida (default 5 minutos)
 * @returns {boolean}
 */
function verifyTimestamp(signature, maxAgeSeconds = 300) {
  try {
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.trim().split('=')
      acc[key] = value
      return acc
    }, {})

    const timestamp = parseInt(parts.ts, 10)
    if (isNaN(timestamp)) return false

    const now = Math.floor(Date.now() / 1000)
    const age = now - timestamp

    return age >= 0 && age <= maxAgeSeconds
  } catch (error) {
    console.error('[MP Signature] Error verificando timestamp:', error)
    return false
  }
}

module.exports = {
  verifyMercadoPagoSignature,
  verifyTimestamp,
}
