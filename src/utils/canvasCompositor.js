import { drawCintillo, drawLogo } from './drawOverlays.js'
import {
  buildCanvasFilter,
  drawVignette,
  applyLutOverlay,
  getTemporalVignetteExtra,
  getTransitionProgress,
  TRANSITION_DURATION_MS,
} from './videoLook.js'

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
}) {
  ctx.fillStyle = '#07070a'
  ctx.fillRect(0, 0, w, h)

  const progress = transitionMode === 'cut'
    ? 1
    : getTransitionProgress(transitionStartMs, TRANSITION_DURATION_MS)

  if (videoFrom && videoFrom !== video && progress < 1) {
    drawCameraTransition(ctx, w, h, {
      videoFrom,
      videoTo: video,
      fromCrop,
      toCrop: directorCrop,
      look,
      mode: transitionMode,
      progress,
    })
  } else if (video && video.readyState >= 2 && video.videoWidth) {
    drawVideoLayer(ctx, video, w, h, directorCrop, look)
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
