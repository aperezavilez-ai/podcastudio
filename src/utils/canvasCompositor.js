import { drawCintillo, drawLogo } from './drawOverlays.js'

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

export function drawCompositorFrame(ctx, w, h, {
  video,
  logoOverlay,
  cintilloOverlay,
  directorCrop = null,
}) {
  ctx.fillStyle = '#07070a'
  ctx.fillRect(0, 0, w, h)

  if (video && video.readyState >= 2 && video.videoWidth) {
    drawVideoCover(ctx, video, 0, 0, w, h, directorCrop)
  }

  drawLogo(ctx, w, h, logoOverlay)
  drawCintillo(ctx, w, h, cintilloOverlay)
}

export { W as COMPOSITOR_W, H as COMPOSITOR_H }
