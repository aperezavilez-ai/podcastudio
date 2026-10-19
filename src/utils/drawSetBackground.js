import { buildCanvasFilter } from './videoLook.js'
import { applyChromaKey } from '../hooks/useChromaKey.js'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'

let offscreenCanvas = null
let offscreenCtx = null

const imageCache = new Map()
const videoCache = new Map()

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

function getCachedVideo(src) {
  if (!src || typeof document === 'undefined') return null
  if (videoCache.has(src)) return videoCache.get(src)
  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.autoplay = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.style.position = 'fixed'
  video.style.top = '-9999px'
  video.style.left = '-9999px'
  video.style.width = '160px'
  video.style.height = '90px'
  video.style.opacity = '0.001'
  video.style.pointerEvents = 'none'
  document.body.appendChild(video)
  video.src = src
  video.load()
  const tryPlay = () => {
    video.play().catch(() => {})
  }
  tryPlay()
  video.addEventListener('canplay', tryPlay)
  videoCache.set(src, video)
  return video
}

export function drawSetBackground(ctx, w, h, templateId, cameraAngle = 'mid', preferVideo = true) {
  if (!templateId || templateId === 'none') {
    ctx.fillStyle = '#0a0a0e'
    ctx.fillRect(0, 0, w, h)
    return
  }

  const tmpl = getBackgroundTemplate(templateId)

  // Prioridad: Video Loop Broadcast en tiempo real (100% realista con movimiento)
  if (preferVideo && tmpl?.video) {
    const vid = getCachedVideo(tmpl.video)
    if (vid) {
      if (vid.paused) {
        vid.play().catch(() => {})
      }
      if (vid.videoWidth > 0) {
        ctx.save()
        if (cameraAngle === 'mid') {
          ctx.translate(w / 2, h / 2)
          ctx.scale(1.22, 1.22)
          ctx.translate(-w / 2, -h / 2 + (h * 0.025))
        } else if (cameraAngle === 'screen') {
          ctx.translate(w * 0.4, h / 2)
          ctx.scale(1.18, 1.18)
          ctx.translate(-w * 0.4 + (w * 0.06), -h / 2)
        }
        ctx.drawImage(vid, 0, 0, w, h)
        ctx.restore()
        return
      }
    }
  }

  // Fallback si el video aún se está cargando
  if (tmpl?.image) {
    const img = getCachedImage(tmpl.image)
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save()
      if (cameraAngle === 'mid') {
        ctx.translate(w / 2, h / 2)
        ctx.scale(1.22, 1.22)
        ctx.translate(-w / 2, -h / 2 + (h * 0.025))
      } else if (cameraAngle === 'screen') {
        ctx.translate(w * 0.4, h / 2)
        ctx.scale(1.18, 1.18)
        ctx.translate(-w * 0.4 + (w * 0.06), -h / 2)
      }
      ctx.drawImage(img, 0, 0, w, h)
      ctx.restore()
      return
    }
  }

  ctx.fillStyle = '#0a0a0e'
  ctx.fillRect(0, 0, w, h)
}

/** Dibuja la capa frontal de escritorio / podium PNG para que el presentador quede detrás */
export function drawSetForegroundDesk(ctx, w, h, templateId, showDesk = true, deskOffset = 0, cameraAngle = 'mid') {
  if (!showDesk || !templateId || templateId === 'none') return
  const tmpl = getBackgroundTemplate(templateId)
  if (!tmpl?.desk) return
  const deskImg = getCachedImage(tmpl.desk)
  if (deskImg && deskImg.complete && deskImg.naturalWidth > 0) {
    ctx.save()
    if (cameraAngle === 'mid') {
      ctx.translate(w / 2, h)
      ctx.scale(1.22, 1.22)
      ctx.translate(-w / 2, -h + deskOffset + 4)
    } else if (cameraAngle === 'screen') {
      ctx.translate(w * 0.4, h)
      ctx.scale(1.18, 1.18)
      ctx.translate(-w * 0.4 + (w * 0.06), -h + deskOffset + 2)
    } else if (deskOffset) {
      ctx.translate(0, deskOffset)
    }
    ctx.drawImage(deskImg, 0, 0, w, h)
    ctx.restore()
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

    const crop = actualChroma.crop || { left: 0, right: 0, top: 0, bottom: 0 }

    // Croma Key físico por color verde/azul directo en tiempo real
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

    // Modo Chroma / IA: Silueta integrada y posicionable libremente sin marcos ni recuadros (anclaje broadcast profundo)
    const pScale = ((backgroundOrRect?.presenterScale ?? 105) / 100)
    const pX = (backgroundOrRect?.presenterX ?? 50) / 100
    const pY = (backgroundOrRect?.presenterY ?? 66) / 100

    const baseScale = Math.min(w / vw, h / vh) * pScale
    const dw = vw * baseScale
    const dh = vh * baseScale
    const dx = (pX * w) - (dw / 2)
    const dy = (pY * h) - (dh * 0.66)

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

    // --- Mejoras de integración realista ---
    // 1. Sombra de contacto suave bajo la persona
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.filter = 'blur(18px)'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    const shadowW = dw * 0.55
    const shadowH = dh * 0.08
    const shadowX = dx + (dw - shadowW) / 2
    const shadowY = dy + dh - shadowH * 0.3
    ctx.beginPath()
    ctx.ellipse(shadowX + shadowW / 2, shadowY + shadowH / 2, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 2. Light wrap simple (luz del entorno en los bordes)
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 0.18
    ctx.filter = 'blur(6px) brightness(1.4)'
    ctx.drawImage(sourceDrawable, dx - 2, dy - 2, dw + 4, dh + 4)
    ctx.restore()

    // Dibujar persona
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

