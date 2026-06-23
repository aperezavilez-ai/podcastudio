import { buildCanvasFilter } from './videoLook.js'

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

export function drawVideoInset(ctx, video, w, h, rectPct, directorCrop, look) {
  if (!video || video.readyState < 2 || !video.videoWidth) return

  const x = (rectPct.left / 100) * w
  const y = (rectPct.top / 100) * h
  const rw = (rectPct.width / 100) * w
  const rh = (rectPct.height / 100) * h

  ctx.save()
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(x, y, rw, rh, Math.min(rw, rh) * 0.02)
  } else {
    ctx.rect(x, y, rw, rh)
  }
  ctx.clip()

  const filter = buildCanvasFilter(look)
  if (filter && filter !== 'none') ctx.filter = filter

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
    ctx.drawImage(video, sx, sy, cropW, cropH, dx, dy, dw, dh)
  } else {
    const scale = Math.max(rw / video.videoWidth, rh / video.videoHeight)
    const dw = video.videoWidth * scale
    const dh = video.videoHeight * scale
    const dx = x + (rw - dw) / 2
    const dy = y + (rh - dh) / 2
    ctx.drawImage(video, dx, dy, dw, dh)
  }

  ctx.filter = 'none'
  ctx.restore()
}
