/** Filtros, viñeta, LUT simulado y utilidades de animación. */

export function buildCanvasFilter(look) {
  if (!look) return 'none'
  const b = (look.brightness ?? 100) / 100
  const c = (look.contrast ?? 100) / 100
  const s = (look.saturation ?? 100) / 100
  const warmth = look.warmth ?? 0
  const sepia = Math.max(0, warmth) * 0.004
  const sepiaCool = Math.max(0, -warmth) * 0.003
  const hue = warmth * 6
  const sharp = (look.sharpness ?? 0) > 0 ? (1 + (look.sharpness / 100) * 0.12) : 1
  const contrastFinal = c * sharp
  return `brightness(${b}) contrast(${contrastFinal}) saturate(${s}) sepia(${sepia + sepiaCool}) hue-rotate(${hue}deg)`
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

export function applyLutOverlay(ctx, w, h, lutId) {
  if (!lutId || lutId === 'none') return
  ctx.save()
  switch (lutId) {
    case 'teal-orange':
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(15,70,110,0.14)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = 'rgba(255,120,40,0.1)'
      ctx.fillRect(0, 0, w, h)
      break
    case 'golden-hour':
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255,180,60,0.16)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = 'rgba(255,200,100,0.06)'
      ctx.fillRect(0, 0, w, h)
      break
    case 'mono-warm':
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = 'rgba(128,128,128,0.55)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255,220,180,0.12)'
      ctx.fillRect(0, 0, w, h)
      break
    case 'vibrant':
      ctx.globalCompositeOperation = 'saturation'
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = 'rgba(255,80,120,0.06)'
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
