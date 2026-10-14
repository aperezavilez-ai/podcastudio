import { drawCintillo, drawLogo } from './drawOverlays.js'
import {
  buildCanvasFilter,
  drawVignette,
  applyLutOverlay,
  getTemporalVignetteExtra,
  getTransitionProgress,
  TRANSITION_DURATION_MS,
} from './videoLook.js'
import { drawSetBackground, drawVideoInset } from './drawSetBackground.js'

const W = 1920
const H = 1080

export function drawVideoCover(ctx, video, x, y, w, h, directorCrop = null) {
  if (!video || video.readyState < 2 || !video.videoWidth) return
  const vw = video.videoWidth
  const vh = video.videoHeight

  if (directorCrop && directorCrop.zoom > 1.02) {
    const zoom = directorCrop.zoom
    const cropW = vw / zoom
    const cropH = vh / zoom
    let sx = directorCrop.focusX * vw - cropW / 2
    let sy = directorCrop.focusY * vh - cropH / 2
    sx = Math.max(0, Math.min(vw - cropW, sx))
    sy = Math.max(0, Math.min(vh - cropH, sy))
    const scale = Math.max(w / cropW, h / cropH)
    const dw = cropW * scale
    const dh = cropH * scale
    const dx = x + (w - dw) / 2
    const dy = y + (h - dh) / 2
    ctx.drawImage(video, sx, sy, cropW, cropH, dx, dy, dw, dh)
    return
  }

  const scale = Math.max(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(video, dx, dy, dw, dh)
}

function drawVideoLayer(ctx, video, w, h, directorCrop, look) {
  if (!video) return
  ctx.save()
  const filter = buildCanvasFilter(look)
  try {
    if (filter && filter !== 'none') ctx.filter = filter
    drawVideoCover(ctx, video, 0, 0, w, h, directorCrop)
  } catch {
    ctx.filter = 'none'
    drawVideoCover(ctx, video, 0, 0, w, h, directorCrop)
  }
  ctx.filter = 'none'
  try {
    applyLutOverlay(ctx, w, h, look?.lutId)
  } catch { /* composite ops no soportados en algunos móviles */ }
  ctx.restore()
}

function drawCameraTransition(ctx, w, h, {
  videoFrom,
  videoTo,
  fromCrop,
  toCrop,
  look,
  mode,
  progress,
}) {
  const p = progress
  if (mode === 'cut' || p >= 1 || !videoFrom || videoFrom === videoTo) {
    drawVideoLayer(ctx, videoTo, w, h, toCrop, look)
    return
  }

  if (mode === 'dip') {
    drawVideoLayer(ctx, p < 0.5 ? videoFrom : videoTo, w, h, p < 0.5 ? fromCrop : toCrop, look)
    const dip = Math.sin(p * Math.PI)
    ctx.fillStyle = `rgba(0,0,0,${dip * 0.92})`
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (mode === 'push') {
    const offset = (1 - p) * w
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    ctx.translate(-offset, 0)
    drawVideoLayer(ctx, videoFrom, w, h, fromCrop, look)
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    ctx.translate(w - offset, 0)
    drawVideoLayer(ctx, videoTo, w, h, toCrop, look)
    ctx.restore()
    return
  }

  // crossfade (default)
  ctx.save()
  ctx.globalAlpha = 1 - p
  drawVideoLayer(ctx, videoFrom, w, h, fromCrop, look)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = p
  drawVideoLayer(ctx, videoTo, w, h, toCrop, look)
  ctx.restore()
}

export function drawCompositorFrame(ctx, w, h, {
  video,
  videoFrom = null,
  transitionMode = 'cut',
  transitionStartMs = null,
  logoOverlay,
  cintilloOverlay,
  cintilloMotion = null,
  directorCrop = null,
  fromCrop = null,
  look = null,
  recording = false,
  recordStartMs = null,
  recordDurationSec = 0,
  background = null,
  layout = 'full',
  pipVideo = null,
  secondaryVideo = null,
  tertiaryVideo = null,
}) {
  const useVirtualSet = background?.hasVirtualSet && background?.cameraRect

  if (useVirtualSet) {
    if (background.customImage) {
      ctx.drawImage(background.customImage, 0, 0, w, h)
    } else if (background.templateId && background.templateId !== 'none') {
      drawSetBackground(ctx, w, h, background.templateId)
    } else {
      ctx.fillStyle = '#07070a'
      ctx.fillRect(0, 0, w, h)
    }
  } else {
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, w, h)
  }

  const progress = transitionMode === 'cut'
    ? 1
    : getTransitionProgress(transitionStartMs, TRANSITION_DURATION_MS)

  const drawMainVideo = (v, crop) => {
    if (!v || v.readyState < 2 || !v.videoWidth) return
    if (useVirtualSet) {
      drawVideoInset(ctx, v, w, h, background.cameraRect, crop, look)
    } else {
      drawVideoLayer(ctx, v, w, h, crop, look)
    }
  }

  if (videoFrom && videoFrom !== video && progress < 1 && !useVirtualSet) {
    drawCameraTransition(ctx, w, h, {
      videoFrom,
      videoTo: video,
      fromCrop,
      toCrop: directorCrop,
      look,
      mode: transitionMode,
      progress,
    })
  } else if (layout === 'split') {
    const isVertical = h > w
    if (isVertical) {
      // Split vertical para 9:16 (uno arriba, otro abajo)
      const halfH = (h - 12) / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, halfH)
      ctx.clip()
      if (video && video.readyState >= 2 && video.videoWidth) {
        drawVideoCover(ctx, video, 0, 0, w, halfH, directorCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, 0, w, halfH)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, halfH + 12, w, halfH)
      ctx.clip()
      if (secondaryVideo && secondaryVideo.readyState >= 2 && secondaryVideo.videoWidth) {
        drawVideoCover(ctx, secondaryVideo, 0, halfH + 12, w, halfH, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, halfH + 12, w, halfH)
      }
      ctx.restore()
    } else {
      // Modo Split 50/50 horizontal (para 16:9 y 1:1)
      const halfW = (w - 12) / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, halfW, h)
      ctx.clip()
      if (video && video.readyState >= 2 && video.videoWidth) {
        drawVideoCover(ctx, video, 0, 0, halfW, h, directorCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, 0, halfW, h)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(halfW + 12, 0, halfW, h)
      ctx.clip()
      if (secondaryVideo && secondaryVideo.readyState >= 2 && secondaryVideo.videoWidth) {
        drawVideoCover(ctx, secondaryVideo, halfW + 12, 0, halfW, h, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(halfW + 12, 0, halfW, h)
      }
      ctx.restore()
    }
  } else if (layout === 'triple') {
    const isVertical = h > w
    if (isVertical) {
      // 9:16 Vertical para móvil: Master arriba (58%), dos secundarias abajo lado a lado (42%)
      const mainH = Math.round(h * 0.58)
      const subY = mainH + 12
      const subH = h - subY
      const subW = Math.round((w - 12) / 2)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, mainH)
      ctx.clip()
      if (video && video.readyState >= 2 && video.videoWidth) {
        drawVideoCover(ctx, video, 0, 0, w, mainH, directorCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, 0, w, mainH)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, subY, subW, subH)
      ctx.clip()
      if (secondaryVideo && secondaryVideo.readyState >= 2 && secondaryVideo.videoWidth) {
        drawVideoCover(ctx, secondaryVideo, 0, subY, subW, subH, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, subY, subW, subH)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(subW + 12, subY, subW, subH)
      ctx.clip()
      if (tertiaryVideo && tertiaryVideo.readyState >= 2 && tertiaryVideo.videoWidth) {
        drawVideoCover(ctx, tertiaryVideo, subW + 12, subY, subW, subH, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(subW + 12, subY, subW, subH)
      }
      ctx.restore()
    } else {
      // Horizontal (16:9 y 1:1): Master a la izquierda (64%), dos secundarias apiladas a la derecha (36%)
      const mainW = Math.round(w * 0.64)
      const sideX = mainW + 12
      const sideW = w - sideX
      const sideH = Math.round((h - 12) / 2)

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, mainW, h)
      ctx.clip()
      if (video && video.readyState >= 2 && video.videoWidth) {
        drawVideoCover(ctx, video, 0, 0, mainW, h, directorCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, 0, mainW, h)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(sideX, 0, sideW, sideH)
      ctx.clip()
      if (secondaryVideo && secondaryVideo.readyState >= 2 && secondaryVideo.videoWidth) {
        drawVideoCover(ctx, secondaryVideo, sideX, 0, sideW, sideH, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(sideX, 0, sideW, sideH)
      }
      ctx.restore()

      ctx.save()
      ctx.beginPath()
      ctx.rect(sideX, sideH + 12, sideW, sideH)
      ctx.clip()
      if (tertiaryVideo && tertiaryVideo.readyState >= 2 && tertiaryVideo.videoWidth) {
        drawVideoCover(ctx, tertiaryVideo, sideX, sideH + 12, sideW, sideH, null)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(sideX, sideH + 12, sideW, sideH)
      }
      ctx.restore()
    }
  } else {
    if (video && video.readyState >= 2 && video.videoWidth) {
      drawMainVideo(video, directorCrop)
    } else {
      ctx.fillStyle = '#07070a'
      ctx.fillRect(0, 0, w, h)
    }

    // Si está en modo PiP y hay pipVideo
    if (layout === 'pip' && pipVideo && pipVideo.readyState >= 2 && pipVideo.videoWidth) {
      const isVertical = h > w
      const pipW = isVertical ? w * 0.38 : w * 0.28
      const pipH = (pipW * 9) / 16
      const pipX = w - pipW - (isVertical ? 20 : 36)
      const pipY = isVertical ? 24 : 36
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 6
      if (ctx.roundRect) {
        ctx.beginPath()
        ctx.roundRect(pipX, pipY, pipW, pipH, 12)
        ctx.clip()
      }
      drawVideoCover(ctx, pipVideo, pipX, pipY, pipW, pipH, null)
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = '#e8612a'
      ctx.lineWidth = 3
      if (ctx.roundRect) {
        ctx.beginPath()
        ctx.roundRect(pipX, pipY, pipW, pipH, 12)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  let vignette = look?.vignette ?? 0
  if (look?.temporalVignette) {
    vignette += getTemporalVignetteExtra(recording, recordStartMs, recordDurationSec, true)
  }
  drawVignette(ctx, w, h, vignette, look?.vignetteSoft ?? 60)

  drawLogo(ctx, w, h, logoOverlay)
  drawCintillo(ctx, w, h, cintilloOverlay, cintilloMotion)
}

export { W as COMPOSITOR_W, H as COMPOSITOR_H }
