function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof r === 'number') {
    r = { tl: r, tr: r, br: r, bl: r }
  } else {
    r = { tl: r?.tl ?? 8, tr: r?.tr ?? 8, br: r?.br ?? 8, bl: r?.bl ?? 8 }
  }
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, [r.tl, r.tr, r.br, r.bl])
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r.tl, y)
  ctx.lineTo(x + w - r.tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr)
  ctx.lineTo(x + w, y + h - r.br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h)
  ctx.lineTo(x + r.bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl)
  ctx.lineTo(x, y + r.tl)
  ctx.quadraticCurveTo(x, y, x + r.tl, y)
  ctx.closePath()
}

function getBoxPosition(position, w, h, boxW, boxH) {
  const isVertical = h > w
  const isSquare = Math.abs(w - h) < 50

  const mX = isVertical ? 32 : 56
  const bottomMargin = isVertical ? 260 : isSquare ? 80 : 72
  const topMargin = isVertical ? 120 : 56
  const bottom = h - boxH - bottomMargin

  const map = {
    bl: { x: mX, y: bottom },
    bc: { x: (w - boxW) / 2, y: bottom },
    br: { x: w - boxW - mX, y: bottom },
    tl: { x: mX, y: topMargin },
    tc: { x: (w - boxW) / 2, y: topMargin },
    tr: { x: w - boxW - mX, y: topMargin },
    ml: { x: mX, y: (h - boxH) / 2 },
    mc: { x: (w - boxW) / 2, y: (h - boxH) / 2 },
    mr: { x: w - boxW - mX, y: (h - boxH) / 2 },
  }
  return map[position] || map.bl
}

function getLogoPosition(position, w, h, boxW, boxH) {
  const isVertical = h > w
  const m = isVertical ? 32 : 44
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

/**
 * Dibuja un cintillo profesional moderno Broadcast / Glassmorphism en el canvas.
 * - Fondo traslúcido glassmorphism con specular border
 * - Tag animado con live pulse dot
 * - Tipografía nítida para texto principal y subtítulo
 * - Logotipo del invitado/podcast con reflejo 3D
 * - Badges estilizados cuando es REDES o CONTACTO
 */
export function drawCintillo(ctx, w, h, overlay, motion = null) {
  if (!overlay?.active || !overlay.text) return

  const accent = overlay.color || '#e8612a'
  const tag = (overlay.tag || 'INFO').toUpperCase()
  const text = overlay.text.slice(0, 95)
  const subtitle = (overlay.subtitle || '').slice(0, 110)
  const position = overlay.position || 'bl'
  const styleId = overlay.styleId || 'broadcast'
  const hasLogo = Boolean(overlay.logoImage && overlay.logoImage.complete && overlay.logoImage.naturalWidth > 0)
  const isSocials = tag === 'REDES' || Boolean(overlay.socials)

  ctx.save()

  // Movimiento y transición (animPhase / entrance)
  if (motion) {
    ctx.globalAlpha = motion.opacity ?? 1
    const cx = w / 2
    const cy = h / 2
    ctx.translate(cx, cy)
    ctx.scale(motion.scale ?? 1, motion.scale ?? 1)
    ctx.translate(-cx, -cy + (motion.offsetY ?? 0))
  }

  // Medición de texto y dimensionamiento dinámico
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif'
  const tagTextW = ctx.measureText(tag).width
  const tagW = Math.max(tagTextW + 36, 80)

  ctx.font = '600 26px "Segoe UI", system-ui, sans-serif'
  const mainTextW = ctx.measureText(text).width

  let subTextW = 0
  if (subtitle) {
    ctx.font = '400 17px "Segoe UI", system-ui, sans-serif'
    subTextW = ctx.measureText(subtitle).width
  }

  const logoSize = hasLogo ? 64 : 0
  const logoPadding = hasLogo ? 16 : 0
  const maxAllowedW = Math.min(w * 0.88, 860)

  const contentW = Math.max(tagW, mainTextW, subTextW) + logoSize + logoPadding + 44
  const barW = Math.min(Math.max(contentW, 360), maxAllowedW)

  const tagH = 28
  const baseContentH = subtitle ? 66 : 46
  const barH = Math.max(baseContentH, hasLogo ? logoSize + 16 : 46)
  const totalH = tagH + barH + 4

  const { x, y } = getBoxPosition(position, w, h, barW, totalH)

  // 1. Sombra general broadcast
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8

  // 2. Fondo Glassmorphism translúcido con gradiente
  const bgGrad = ctx.createLinearGradient(x, y, x + barW, y + totalH)
  if (styleId === 'cyber') {
    bgGrad.addColorStop(0, 'rgba(8, 14, 28, 0.92)')
    bgGrad.addColorStop(1, 'rgba(14, 24, 46, 0.85)')
  } else if (styleId === 'news') {
    bgGrad.addColorStop(0, 'rgba(12, 16, 24, 0.95)')
    bgGrad.addColorStop(1, 'rgba(18, 22, 34, 0.90)')
  } else {
    // Glassmorphism broadcast por defecto (traslúcido moderno)
    bgGrad.addColorStop(0, 'rgba(12, 16, 28, 0.84)')
    bgGrad.addColorStop(1, 'rgba(20, 26, 42, 0.76)')
  }

  ctx.fillStyle = bgGrad
  roundRectPath(ctx, x, y, barW, totalH, 14)
  ctx.fill()

  // 3. Borde especular (Glass highlight)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  const borderGrad = ctx.createLinearGradient(x, y, x + barW, y + totalH)
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)')
  borderGrad.addColorStop(1, `${accent}44`)

  ctx.strokeStyle = borderGrad
  ctx.lineWidth = 1.5
  roundRectPath(ctx, x, y, barW, totalH, 14)
  ctx.stroke()

  // 4. Barra de acento sutil en el borde izquierdo
  ctx.fillStyle = accent
  roundRectPath(ctx, x, y + 10, 4, totalH - 20, 2)
  ctx.fill()

  // 5. Pastilla del TAG (con dot pulsante)
  const tagX = x + 18
  const tagY = y + 10

  // Fondo de la pastilla
  ctx.fillStyle = `${accent}28`
  roundRectPath(ctx, tagX, tagY, tagW, tagH, 6)
  ctx.fill()

  ctx.strokeStyle = `${accent}66`
  ctx.lineWidth = 1
  roundRectPath(ctx, tagX, tagY, tagW, tagH, 6)
  ctx.stroke()

  // Dot pulsante en vivo
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(tagX + 12, tagY + tagH / 2, 4, 0, Math.PI * 2)
  ctx.fill()

  // Texto del Tag
  ctx.fillStyle = accent
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(tag, tagX + 22, tagY + tagH / 2)

  // 6. Contenido principal (Logo + Textos)
  const contentY = y + tagH + 12
  let textStartX = x + 20

  // Dibujar Logotipo si está disponible
  if (hasLogo) {
    const logoX = x + 18
    const logoY = contentY
    const lSize = logoSize - 10

    ctx.save()
    // Contenedor 3D con sombra
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 8
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
    roundRectPath(ctx, logoX, logoY, lSize, lSize, 10)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.lineWidth = 1
    roundRectPath(ctx, logoX, logoY, lSize, lSize, 10)
    ctx.stroke()

    // Imagen del logo recortada con bordes redondeados
    roundRectPath(ctx, logoX + 2, logoY + 2, lSize - 4, lSize - 4, 8)
    ctx.clip()
    ctx.drawImage(overlay.logoImage, logoX + 2, logoY + 2, lSize - 4, lSize - 4)
    ctx.restore()

    textStartX = logoX + lSize + 14
  }

  const textAvailableW = barW - (textStartX - x) - 20

  // 7. Texto Principal (Blanco sólido nítido con sombra)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 24px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'top'

  // Si es sección de redes sociales y tiene múltiples redes en formato clave:valor o badges
  if (isSocials && (text.includes('@') || text.includes(' '))) {
    ctx.fillText(text, textStartX, contentY - 2, textAvailableW)
  } else {
    ctx.fillText(text, textStartX, contentY - 2, textAvailableW)
  }
  ctx.restore()

  // 8. Subtítulo (si existe)
  if (subtitle) {
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '500 16px "Segoe UI", system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(subtitle, textStartX, contentY + 28, textAvailableW)
  }

  // 9. Destello especular de cristal en el borde superior (Gleam)
  const gleamGrad = ctx.createLinearGradient(x + 20, y, x + barW * 0.6, y)
  gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gleamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)')
  gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gleamGrad
  ctx.fillRect(x + 20, y, barW * 0.6, 1)

  ctx.restore()
}

/**
 * Dibuja la mosca / watermark del podcast en el canvas
 */
export function drawLogo(ctx, w, h, overlay) {
  if (!overlay?.podcastName && !overlay?.logoImage?.complete) return

  const name = overlay.podcastName || 'Podcast'
  const position = overlay.position || 'tr'
  const logoSize = 42

  ctx.save()
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif'
  const textW = ctx.measureText(name).width
  const padX = 14
  const boxW = (overlay.logoImage?.complete ? logoSize + 12 : 0) + textW + padX * 2 + 4
  const boxH = logoSize + 16
  const { x, y } = getLogoPosition(position, w, h, boxW, boxH)

  // Fondo glassmorphism sutil
  ctx.fillStyle = 'rgba(10, 14, 24, 0.68)'
  roundRectPath(ctx, x, y, boxW, boxH, 10)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = 1
  roundRectPath(ctx, x, y, boxW, boxH, 10)
  ctx.stroke()

  let textX = x + padX
  if (overlay.logoImage?.complete) {
    const ix = x + padX
    const iy = y + (boxH - logoSize) / 2
    ctx.save()
    roundRectPath(ctx, ix, iy, logoSize, logoSize, 8)
    ctx.clip()
    ctx.drawImage(overlay.logoImage, ix, iy, logoSize, logoSize)
    ctx.restore()
    textX = ix + logoSize + 10
  }

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = 4
  ctx.fillText(name, textX, y + boxH / 2)
  ctx.restore()
}
