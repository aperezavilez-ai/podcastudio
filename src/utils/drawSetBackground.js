import { buildCanvasFilter } from './videoLook.js'
import { applyChromaKey } from '../hooks/useChromaKey.js'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import { segmentPersonFromVideo } from './aiSegmentation.js'

let offscreenCanvas = null
let offscreenCtx = null

const imageCache = new Map()

function getCachedImage(src) {
  if (!src) return null
  if (imageCache.has(src)) return imageCache.get(src)
  if (typeof Image !== 'undefined') {
    const img = new Image()
    img.src = src
    imageCache.set(src, img)
    return img
  }
  return null
}

/** Fondos simplificados para el compositor de grabación (aprox. a los sets CSS). */
const SETS = {
  'broadcast-news': {
    base: ['#1a1a22', '#2d2d38', '#1a1a22'],
    accent: { y: 0, h: 0.18, color: '#c41e1e' },
    footer: { y: 0.88, h: 0.12, color: 'rgba(196,30,30,0.85)' },
  },
  'breaking-news': {
    base: ['#120808', '#2a1010', '#120808'],
    accent: { y: 0, h: 0.22, color: '#e02020' },
  },
  'tech-studio': {
    base: ['#0a1628', '#123456', '#0a1628'],
    accent: { y: 0.82, h: 0.08, color: '#00a8ff' },
  },
  'glam-tv': {
    base: ['#1a0a28', '#3d1a55', '#1a0a28'],
    accent: { y: 0, h: 0.14, color: '#b040ff' },
  },
  'sport-energy': {
    base: ['#0a1a0a', '#1a4020', '#0a1a0a'],
    accent: { y: 0, h: 0.12, color: '#00c853' },
  },
  'podcast-dark': {
    base: ['#0c0c10', '#181820', '#0c0c10'],
    accent: { y: 0.9, h: 0.1, color: '#e8612a' },
  },
  'kids-color': {
    base: ['#ffe082', '#ff8a65', '#81d4fa'],
  },
  'corporate-blue': {
    base: ['#0d1b2a', '#1b3a5c', '#0d1b2a'],
    accent: { y: 0, h: 0.1, color: '#2563eb' },
  },
  'neon-night': {
    base: ['#050510', '#120820', '#050510'],
    accent: { y: 0.85, h: 0.06, color: '#ff00aa' },
  },
  'warm-lounge': {
    base: ['#2a1810', '#4a3020', '#2a1810'],
  },
  'split-news': {
    base: ['#141418', '#222228', '#141418'],
    accent: { y: 0, h: 1, color: 'rgba(30,30,40,0.92)', split: 0.42 },
  },
  'newsroom-prime': {
    base: ['#0f172a', '#1e293b', '#0f172a'],
    accent: { y: 0.08, h: 0.14, color: '#3b82f6' },
    footer: { y: 0.86, h: 0.14, color: 'rgba(30,58,138,0.85)' },
  },
  'late-night': {
    base: ['#050814', '#0d1527', '#03050a'],
    accent: { y: 0, h: 0.45, color: 'rgba(56,189,248,0.18)' },
    footer: { y: 0.78, h: 0.22, color: '#1a1006' },
  },
  'music-acoustic': {
    base: ['#23150d', '#3a2214', '#150a04'],
    accent: { y: 0.05, h: 0.28, color: 'rgba(245,158,11,0.25)' },
    footer: { y: 0.75, h: 0.25, color: '#1a0e07' },
  },
  'music-concert': {
    base: ['#090514', '#1b0c36', '#05020a'],
    accent: { y: 0, h: 0.35, color: 'rgba(236,72,153,0.32)' },
    footer: { y: 0.82, h: 0.18, color: '#0f0520' },
  },
  'music-studio': {
    base: ['#1c1612', '#2f231b', '#120d09'],
    accent: { y: 0.15, h: 0.22, color: 'rgba(217,119,6,0.22)' },
    footer: { y: 0.8, h: 0.2, color: '#18110b' },
  },
  'minimal-dark': {
    base: ['#101014', '#1c1c22', '#101014'],
  },
}

function fillGradient(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export function drawSetBackground(ctx, w, h, templateId) {
  if (!templateId || templateId === 'none') {
    ctx.fillStyle = '#0a0a0e'
    ctx.fillRect(0, 0, w, h)
    return
  }

  // Si existe imagen realista 3D para la plantilla, dibujarla en el canvas
  const tmpl = getBackgroundTemplate(templateId)
  if (tmpl?.image) {
    const img = getCachedImage(tmpl.image)
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, w, h)
      return
    }
  }

  const spec = SETS[templateId]
  if (!spec) {
    ctx.fillStyle = '#0a0a0e'
    ctx.fillRect(0, 0, w, h)
    return
  }

  fillGradient(ctx, w, h, spec.base)

  if (spec.accent?.split) {
    ctx.fillStyle = spec.accent.color
    ctx.fillRect(w * spec.accent.split, 0, w * (1 - spec.accent.split), h)
    return
  }

  if (spec.accent) {
    ctx.fillStyle = spec.accent.color
    ctx.fillRect(0, h * spec.accent.y, w, h * spec.accent.h)
  }

  if (spec.footer) {
    ctx.fillStyle = spec.footer.color
    ctx.fillRect(0, h * spec.footer.y, w, h * spec.footer.h)
  }
}

/** Dibuja la capa frontal de escritorio / podium PNG para que el presentador quede detrás */
export function drawSetForegroundDesk(ctx, w, h, templateId, showDesk = true) {
  if (!showDesk || !templateId || templateId === 'none') return
  const tmpl = getBackgroundTemplate(templateId)
  if (!tmpl?.desk) return
  const deskImg = getCachedImage(tmpl.desk)
  if (deskImg && deskImg.complete && deskImg.naturalWidth > 0) {
    ctx.drawImage(deskImg, 0, 0, w, h)
  }
}

export function drawVideoInset(ctx, video, w, h, backgroundOrRect, directorCrop, look, chromaSettings = null) {
  if (!video || video.readyState < 2 || !video.videoWidth) return

  const rectPct = backgroundOrRect?.cameraRect || backgroundOrRect || { left: 15, top: 12, width: 70, height: 76 }
  const actualChroma = chromaSettings || backgroundOrRect?.chromaSettings
  const isChroma = Boolean(actualChroma?.enabled)

  ctx.save()

  const filter = buildCanvasFilter(look)
  if (filter && filter !== 'none') ctx.filter = filter

  let sourceDrawable = video
  if (isChroma && typeof document !== 'undefined') {
    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas')
      offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true })
    }
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (offscreenCanvas.width !== vw || offscreenCanvas.height !== vh) {
      offscreenCanvas.width = vw
      offscreenCanvas.height = vh
    }
    offscreenCtx.drawImage(video, 0, 0)

    const mode = actualChroma.mode || 'ai'
    const crop = actualChroma.crop || { left: 0, right: 0, top: 0, bottom: 0 }
    const smoothness = (actualChroma.edgeSmoothness ?? 30) / 100

    if (mode === 'ai' || mode === 'hybrid') {
      const mask = segmentPersonFromVideo(video, { smoothness })
      if (mask) {
        offscreenCtx.globalCompositeOperation = 'destination-in'
        offscreenCtx.drawImage(mask, 0, 0, vw, vh)
        offscreenCtx.globalCompositeOperation = 'source-over'
      }

      if (mode === 'hybrid') {
        try {
          const frame = offscreenCtx.getImageData(0, 0, vw, vh)
          applyChromaKey(
            frame,
            actualChroma.keyColor || '#00b140',
            actualChroma.similarity ?? 40,
            actualChroma.smoothness ?? 25,
            actualChroma.despill ?? 50,
            crop
          )
          offscreenCtx.putImageData(frame, 0, 0)
        } catch {}
      }
    } else {
      try {
        const frame = offscreenCtx.getImageData(0, 0, vw, vh)
        applyChromaKey(
          frame,
          actualChroma.keyColor || '#00b140',
          actualChroma.similarity ?? 40,
          actualChroma.smoothness ?? 25,
          actualChroma.despill ?? 50,
          crop
        )
        offscreenCtx.putImageData(frame, 0, 0)
      } catch {}
    }

    // Limpieza de bordes fuera de plano
    if (crop.left > 0 || crop.right > 0 || crop.top > 0 || crop.bottom > 0) {
      const cl = (crop.left / 100) * vw
      const cr = (crop.right / 100) * vw
      const ct = (crop.top / 100) * vh
      const cb = (crop.bottom / 100) * vh
      if (cl > 0) offscreenCtx.clearRect(0, 0, cl, vh)
      if (cr > 0) offscreenCtx.clearRect(vw - cr, 0, cr, vh)
      if (ct > 0) offscreenCtx.clearRect(0, 0, vw, ct)
      if (cb > 0) offscreenCtx.clearRect(0, vh - cb, vw, cb)
    }

    sourceDrawable = offscreenCanvas

    // Modo Chroma / IA: Silueta integrada y posicionable libremente sin marcos ni recuadros
    const pScale = ((backgroundOrRect?.presenterScale ?? 92) / 100)
    const pX = (backgroundOrRect?.presenterX ?? 50) / 100
    const pY = (backgroundOrRect?.presenterY ?? 55) / 100

    const baseScale = Math.min(w / vw, h / vh) * pScale
    const dw = vw * baseScale
    const dh = vh * baseScale
    const dx = (pX * w) - (dw / 2)
    const dy = (pY * h) - (dh * 0.78)

    // Filtros de iluminación e integración ambiental (Lighting Match)
    const warmth = backgroundOrRect?.presenterWarmth ?? 0
    const brightness = backgroundOrRect?.presenterBrightness ?? 100
    const contrast = backgroundOrRect?.presenterContrast ?? 100

    let lightingFilter = ''
    if (warmth > 0) {
      lightingFilter += ` sepia(${Math.round(warmth * 0.42)}%) saturate(${100 + Math.round(warmth * 0.2)}%)`
    } else if (warmth < 0) {
      lightingFilter += ` hue-rotate(${Math.round(warmth * 0.5)}deg) saturate(${100 + Math.abs(warmth * 0.15)}%)`
    }
    if (brightness !== 100) lightingFilter += ` brightness(${brightness}%)`
    if (contrast !== 100) lightingFilter += ` contrast(${contrast}%)`

    const finalFilter = [filter, lightingFilter].filter(Boolean).join(' ')
    if (finalFilter && finalFilter !== 'none') ctx.filter = finalFilter

    ctx.drawImage(sourceDrawable, dx, dy, dw, dh)
    ctx.filter = 'none'
    ctx.restore()
    return
  }

  const x = (rectPct.left / 100) * w
  const y = (rectPct.top / 100) * h
  const rw = (rectPct.width / 100) * w
  const rh = (rectPct.height / 100) * h

  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x, y, rw, rh, Math.min(rw, rh) * 0.02)
  } else {
    ctx.rect(x, y, rw, rh)
  }
  ctx.clip()

  if (directorCrop?.zoom > 1.02) {
    const zoom = directorCrop.zoom
    const cropW = video.videoWidth / zoom
    const cropH = video.videoHeight / zoom
    let sx = directorCrop.focusX * video.videoWidth - cropW / 2
    let sy = directorCrop.focusY * video.videoHeight - cropH / 2
    sx = Math.max(0, Math.min(video.videoWidth - cropW, sx))
    sy = Math.max(0, Math.min(video.videoHeight - cropH, sy))
    const scale = Math.max(rw / cropW, rh / cropH)
    const dw = cropW * scale
    const dh = cropH * scale
    const dx = x + (rw - dw) / 2
    const dy = y + (rh - dh) / 2
    ctx.drawImage(sourceDrawable, sx, sy, cropW, cropH, dx, dy, dw, dh)
  } else {
    const scale = Math.max(rw / video.videoWidth, rh / video.videoHeight)
    const dw = video.videoWidth * scale
    const dh = video.videoHeight * scale
    const dx = x + (rw - dw) / 2
    const dy = y + (rh - dh) / 2
    ctx.drawImage(sourceDrawable, dx, dy, dw, dh)
  }

  ctx.filter = 'none'
  ctx.restore()
}

