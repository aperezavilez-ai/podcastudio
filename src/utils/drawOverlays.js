function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.rect(x, y, w, h)
}

function getBoxPosition(position, w, h, boxW, boxH) {
  const m = 44
  const bottom = h - boxH - 56
  const map = {
    bl: { x: m, y: bottom },
    bc: { x: (w - boxW) / 2, y: bottom },
    br: { x: w - boxW - m, y: bottom },
    tl: { x: m, y: m },
    tc: { x: (w - boxW) / 2, y: m },
    tr: { x: w - boxW - m, y: m },
    ml: { x: m, y: (h - boxH) / 2 },
    mc: { x: (w - boxW) / 2, y: (h - boxH) / 2 },
    mr: { x: w - boxW - m, y: (h - boxH) / 2 },
  }
  return map[position] || map.bl
}

function getLogoPosition(position, w, h, boxW, boxH) {
  const m = 36
  const map = {
    tl: { x: m, y: m },
    tc: { x: (w - boxW) / 2, y: m },
    tr: { x: w - boxW - m, y: m },
    ml: { x: m, y: (h - boxH) / 2 },
    mc: { x: (w - boxW) / 2, y: (h - boxH) / 2 },
    mr: { x: w - boxW - m, y: (h - boxH) / 2 },
    bl: { x: m, y: h - boxH - m },
    bc: { x: (w - boxW) / 2, y: h - boxH - m },
    br: { x: w - boxW - m, y: h - boxH - m },
  }
  return map[position] || map.tr
}

export function drawCintillo(ctx, w, h, overlay, motion = null) {
  if (!overlay?.active || !overlay.text) return

  const accent = overlay.color || '#e8612a'
  const tag = (overlay.tag || 'INFO').toUpperCase()
  const text = overlay.text.slice(0, 90)
  const position = overlay.position || 'bl'
  const styleId = overlay.styleId || 'classic'

  ctx.save()

  if (motion) {
    ctx.globalAlpha = motion.opacity ?? 1
    const cx = w / 2
    const cy = h / 2
    ctx.translate(cx, cy)
    ctx.scale(motion.scale ?? 1, motion.scale ?? 1)
    ctx.translate(-cx, -cy + (motion.offsetY ?? 0))
  }

  ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif'
  const tagW = ctx.measureText(tag).width + 28
  ctx.font = '600 30px "Segoe UI", system-ui, sans-serif'
  const textW = Math.min(ctx.measureText(text).width + 40, w * 0.7)
  const barW = Math.max(tagW, textW, 280)
  const tagH = 32
  const barH = 52
  const totalH = tagH + barH - 6
  const { x, y } = getBoxPosition(position, w, h, barW, totalH)

  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4

  if (styleId === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    roundRectPath(ctx, x, y, barW, totalH, 10)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = (motion?.tagOpacity ?? 1) * (ctx.globalAlpha || 1)
    ctx.fillStyle = accent
    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(tag, x + 14, y + 18)
    ctx.globalAlpha = (motion?.textOpacity ?? 1) * (motion?.opacity ?? 1)
    ctx.fillStyle = '#fff'
    ctx.font = '600 26px "Segoe UI", system-ui, sans-serif'
    ctx.fillText(text, x + 14, y + tagH + barH / 2 - 2, barW - 28)
    ctx.restore()
    return
  }

  ctx.globalAlpha = (motion?.tagOpacity ?? 1) * (ctx.globalAlpha || 1)
  ctx.fillStyle = accent
  ctx.beginPath()
  roundRectPath(ctx, x, y, Math.min(tagW + 8, barW), tagH, 6)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(tag, x + 14, y + tagH / 2)

  ctx.globalAlpha = (motion?.textOpacity ?? 1) * (motion?.opacity ?? 1)
  ctx.fillStyle = 'rgba(8,8,14,0.94)'
  ctx.beginPath()
  roundRectPath(ctx, x, y + tagH - 6, barW, barH, 6)
  ctx.fill()

  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = accent
  ctx.fillRect(x, y + tagH - 6, 5, barH)

  ctx.fillStyle = '#f4f4f8'
  ctx.font = '600 28px "Segoe UI", system-ui, sans-serif'
  ctx.fillText(text, x + 20, y + tagH + barH / 2 - 4, barW - 28)

  ctx.restore()
}

export function drawLogo(ctx, w, h, overlay) {
  if (!overlay?.podcastName && !overlay?.logoImage?.complete) return

  const name = overlay.podcastName || 'Podcast'
  const position = overlay.position || 'tr'
  const logoSize = 40

  ctx.save()
  ctx.font = '600 22px "Segoe UI", system-ui, sans-serif'
  const textW = ctx.measureText(name).width
  const padX = 12
  const boxW = (overlay.logoImage?.complete ? logoSize + 10 : 0) + textW + padX * 2 + 8
  const boxH = logoSize + 16
  const { x, y } = getLogoPosition(position, w, h, boxW, boxH)

  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  roundRectPath(ctx, x, y, boxW, boxH, 8)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.stroke()

  let textX = x + padX
  if (overlay.logoImage?.complete) {
    const ix = x + padX
    const iy = y + (boxH - logoSize) / 2
    ctx.save()
    ctx.beginPath()
    roundRectPath(ctx, ix, iy, logoSize, logoSize, 6)
    ctx.clip()
    ctx.drawImage(overlay.logoImage, ix, iy, logoSize, logoSize)
    ctx.restore()
    textX = ix + logoSize + 10
  }

  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, textX, y + boxH / 2)
  ctx.restore()
}
