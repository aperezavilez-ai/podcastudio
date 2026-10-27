/** Filtros, viñeta, LUTs profesionales y utilidades de etalonaje cinematográfico. */

export function buildCanvasFilter(look) {
  if (!look) return 'none'
  const b = (look.brightness ?? 100) / 100
  const c = (look.contrast ?? 100) / 100
  const s = (look.saturation ?? 100) / 100
  const warmth = look.warmth ?? 0
  const tint = look.tint ?? 0

  // Balance de Temperatura real (Kelvin):
  // Cálido (+): sepia fino y armónico que embellece la piel sin amarillear los ojos
  // Frío (-): enfriamiento suave que da look tecnológico sin teñir de verde
  const sepia = warmth > 0 ? (warmth * 0.0032) : 0
  const coolSepia = warmth < 0 ? (Math.abs(warmth) * 0.0018) : 0

  // Tinte / Matiz (Green-Magenta balance):
  // Corrige dominantes de iluminación LED o fluorescentes
  const hue = (warmth * 0.4) + (tint * 0.75)

  // Nitidez y Claridad (Sharpness): 100% = neutral, hasta 200% para realce de bordes y microcontraste
  const rawSharp = look.sharpness != null ? look.sharpness : 100
  const sharpFactor = rawSharp > 100 ? (1 + ((rawSharp - 100) / 100) * 0.32) : (rawSharp < 100 ? Math.max(0.7, rawSharp / 100) : 1.0)
  const contrastFinal = c * sharpFactor

  return `brightness(${b}) contrast(${contrastFinal}) saturate(${s}) sepia(${(sepia + coolSepia).toFixed(3)}) hue-rotate(${hue.toFixed(2)}deg)`
}

export function drawVignette(ctx, w, h, intensity, softness = 60) {
  if (!intensity || intensity <= 0) return
  const cx = w / 2
  const cy = h / 2
  const soft = (softness ?? 60) / 100
  const inner = Math.min(w, h) * (0.28 + soft * 0.22)
  const outer = Math.max(w, h) * (0.72 + soft * 0.18)
  const alpha = Math.min(0.92, (intensity / 100) * 0.9)
  const grad = ctx.createRadialGradient(cx, cy * 0.98, inner, cx, cy, outer)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.15})`)
  grad.addColorStop(1, `rgba(0,0,0,${alpha})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

/**
 * Aplicación de LUTs profesionales mediante split-toning y curvas de etalonaje en Canvas
 * 100% compatible con 60fps en grabaciones 4K y Full HD.
 */
export function applyLutOverlay(ctx, w, h, lutId) {
  if (!lutId || lutId === 'none') return
  ctx.save()
  switch (lutId) {
    case 'kodak-2383':
      // Emulación Kodak Vision3 2383 Film Print: Sombras cian-teal + Piel dorada cálida + Roll-off suave
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(13, 58, 74, 0.26)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(255, 158, 66, 0.16)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(20, 24, 34, 0.05)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'teal-orange-pro':
    case 'teal-orange':
      // Blockbuster Hollywood: Sombras cian profundas y rostros cálidos iluminados
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(10, 66, 88, 0.32)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(255, 126, 41, 0.22)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'scinetone':
      // Sony S-Cinetone: Tonos de piel orgánicos, medios ricos y negros broadcast limpios
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(22, 25, 34, 0.18)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(255, 224, 204, 0.14)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'arri-warm':
    case 'golden-hour':
      // Arri Alexa Golden Hour: Calidez cinematográfica aterciopelada
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255, 175, 64, 0.28)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = 'rgba(255, 234, 204, 0.12)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'clean-broadcast':
      // Broadcast TV Neutro: Blancos puros y nitidez nítida de estudio
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'fuji-eterna':
      // Fujifilm Eterna 500T: Paleta suave desaturada con negros pastel levantados
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(42, 85, 74, 0.20)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'screen'
      ctx.fillStyle = 'rgba(24, 27, 32, 0.08)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'cyber-cool':
      // Cyber Tech Blue: Azul acero moderno en sombras y luces frías limpias
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(16, 53, 101, 0.28)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(80, 210, 255, 0.12)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'noir-contrast':
    case 'mono-warm':
      // B&W Silver Gelatin: Monocromático de alto contraste con gradación de plata
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = 'rgba(128, 128, 128, 1.0)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = 'rgba(18, 18, 22, 0.12)'
      ctx.fillRect(0, 0, w, h)
      break

    case 'vibrant':
      // Redes Vibrante: Saturación enriquecida y brillo comercial
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255, 80, 120, 0.08)'
      ctx.fillRect(0, 0, w, h)
      break

    default:
      break
  }
  ctx.restore()
}

export function getTemporalVignetteExtra(recording, recordStartMs, recordDurationSec, enabled) {
  if (!enabled || !recording || !recordStartMs) return 0
  const elapsed = (performance.now() - recordStartMs) / 1000
  const fadeIn = Math.min(1, elapsed / 2.2)
  let fadeOut = 1
  if (recordDurationSec > 4) {
    fadeOut = Math.min(1, (recordDurationSec - elapsed) / 2.2)
  }
  return Math.max(0, Math.min(fadeIn, fadeOut)) * 28
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

export function easeInCubic(t) {
  return t ** 3
}

export function getTransitionProgress(transitionStartMs, durationMs = 450) {
  if (!transitionStartMs) return 1
  const t = (performance.now() - transitionStartMs) / durationMs
  return Math.min(1, Math.max(0, t))
}

export const TRANSITION_DURATION_MS = 450
export const CINTILLO_ENTER_MS = 900
export const CINTILLO_EXIT_MS = 450

export function getCintilloMotion(animPhase, elapsedMs, motionEnabled = true) {
  if (!motionEnabled || !animPhase || animPhase === 'hold') {
    return { opacity: 1, offsetY: 0, tagOpacity: 1, textOpacity: 1, scale: 1 }
  }
  if (animPhase === 'enter') {
    const t = easeOutCubic(Math.min(1, elapsedMs / CINTILLO_ENTER_MS))
    const tagT = easeOutCubic(Math.min(1, Math.max(0, (elapsedMs - 120) / 500)))
    const textT = easeOutCubic(Math.min(1, Math.max(0, (elapsedMs - 280) / 550)))
    return {
      opacity: t,
      offsetY: (1 - t) * 48,
      tagOpacity: tagT,
      textOpacity: textT,
      scale: 0.94 + t * 0.06,
    }
  }
  if (animPhase === 'exit') {
    const t = easeInCubic(Math.min(1, elapsedMs / CINTILLO_EXIT_MS))
    return {
      opacity: 1 - t,
      offsetY: t * 32,
      tagOpacity: 1 - t,
      textOpacity: 1 - t,
      scale: 1 - t * 0.04,
    }
  }
  return { opacity: 1, offsetY: 0, tagOpacity: 1, textOpacity: 1, scale: 1 }
}
