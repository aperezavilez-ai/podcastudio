import { applyChromaKey } from '../hooks/useChromaKey.js'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import { STUDIO_BACKGROUND_URLS } from '../config/studioImages.js'

const W = 1920
const H = 1080

function clipRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
  ctx.clip()
}

function strokeRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

export function drawImageCover(ctx, img, w, h) {
  const ir = img.width / img.height
  const cr = w / h
  let dw, dh, dx, dy
  if (ir > cr) {
    dh = h
    dw = h * ir
    dx = (w - dw) / 2
    dy = 0
  } else {
    dw = w
    dh = w / ir
    dx = 0
    dy = (h - dh) / 2
  }
  ctx.drawImage(img, dx, dy, dw, dh)
}

export function drawVideoCover(ctx, video, x, y, w, h) {
  if (!video || video.readyState < 2 || !video.videoWidth) return
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.max(w / vw, h / vh)
  const dw = vw * scale
  const dh = vh * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(video, dx, dy, dw, dh)
}

function drawStudioVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawProceduralFallback(ctx, w, h, templateId) {
  const gradients = {
    'broadcast-news': ['#1a1a22', '#8b0000', '#1a1a22'],
    'podcast-dark': ['#0a0a0e', '#1a1520', '#0a0a0e'],
    'tech-studio': ['#0f0f12', '#2a2a30', '#0f0f12'],
    'glam-tv': ['#0d0a10', '#3d1f35', '#0d0a10'],
    'warm-lounge': ['#1a1410', '#2a2018', '#1a1410'],
  }
  const colors = gradients[templateId] || ['#07070a', '#121218', '#07070a']
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, colors[0])
  g.addColorStop(0.5, colors[1])
  g.addColorStop(1, colors[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export function drawBackground(ctx, w, h, { backgroundTemplate, customImage, studioImage }) {
  const hasBg = backgroundTemplate !== 'none' || customImage

  if (!hasBg) {
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, w, h)
    return
  }

  const img = customImage?.complete ? customImage : studioImage?.complete ? studioImage : null
  if (img) {
    drawImageCover(ctx, img, w, h)
    drawStudioVignette(ctx, w, h)
    return
  }

  drawProceduralFallback(ctx, w, h, backgroundTemplate)
}

function processChromaFrame(chromaCtx, chromaCanvas, video, keyColor, similarity, smoothness) {
  if (chromaCanvas.width !== video.videoWidth || chromaCanvas.height !== video.videoHeight) {
    chromaCanvas.width = video.videoWidth
    chromaCanvas.height = video.videoHeight
  }
  chromaCtx.drawImage(video, 0, 0)
  const frame = chromaCtx.getImageData(0, 0, chromaCanvas.width, chromaCanvas.height)
  applyChromaKey(frame, keyColor, similarity, smoothness)
  chromaCtx.putImageData(frame, 0, 0)
  return chromaCanvas
}

export function drawCompositorFrame(ctx, w, h, {
  video,
  backgroundTemplate,
  customImage,
  studioImage,
  chromaEnabled,
  chromaColor = '#00b140',
  chromaSimilarity = 45,
  chromaSmoothness = 20,
  cameraScale = 100,
  chromaCanvas,
  chromaCtx,
}) {
  const hasBg = backgroundTemplate !== 'none' || !!customImage
  const template = getBackgroundTemplate(backgroundTemplate)
  const scale = cameraScale / 100

  drawBackground(ctx, w, h, { backgroundTemplate, customImage, studioImage })

  if (!video || video.readyState < 2 || !video.videoWidth) return

  if (chromaEnabled && hasBg) {
    const keyed = processChromaFrame(chromaCtx, chromaCanvas, video, chromaColor, chromaSimilarity, chromaSmoothness)
    ctx.save()
    ctx.translate(w / 2, h)
    ctx.scale(scale, scale)
    ctx.translate(-w / 2, -h)
    drawImageCover(ctx, keyed, w, h)
    ctx.restore()
    return
  }

  if (hasBg) {
    const cam = template.camera
    const rectW = (cam.width / 100) * w
    const rectH = (cam.height / 100) * h
    const rectX = (cam.left / 100) * w
    const rectY = (cam.top / 100) * h

    ctx.save()
    clipRoundRect(ctx, rectX, rectY, rectW, rectH, 8)
    const cx = rectX + rectW / 2
    const cy = rectY + rectH / 2
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    drawVideoCover(ctx, video, rectX, rectY, rectW, rectH)
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    strokeRoundRect(ctx, rectX, rectY, rectW, rectH, 8)
    ctx.stroke()
    return
  }

  drawVideoCover(ctx, video, 0, 0, w, h)
}

export function getStudioImageUrl(templateId, customUrl) {
  if (customUrl) return customUrl
  if (!templateId || templateId === 'none') return null
  return STUDIO_BACKGROUND_URLS[templateId] || null
}

export { W as COMPOSITOR_W, H as COMPOSITOR_H }
