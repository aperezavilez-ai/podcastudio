export function drawSegmentedVideo(ctx, video, maskCanvas, x, y, w, h, scale = 1) {
  if (!video?.videoWidth || !maskCanvas) return

  const vw = video.videoWidth
  const vh = video.videoHeight
  const coverScale = Math.max(w / vw, h / vh) * scale
  const dw = vw * coverScale
  const dh = vh * coverScale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2

  const tmp = document.createElement('canvas')
  tmp.width = vw
  tmp.height = vh
  const tctx = tmp.getContext('2d')
  tctx.drawImage(video, 0, 0)

  const masked = document.createElement('canvas')
  masked.width = vw
  masked.height = vh
  const mctx = masked.getContext('2d')
  mctx.drawImage(tmp, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(maskCanvas, 0, 0, vw, vh)

  ctx.drawImage(masked, dx, dy, dw, dh)
}
