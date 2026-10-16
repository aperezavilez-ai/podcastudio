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

function drawSocialIconOnCanvas(ctx, network, x, y, size) {
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2

  if (network === 'youtube') {
    ctx.fillStyle = '#FF0000'
    roundRectPath(ctx, x, y, size, size, 8)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    const triW = size * 0.32
    const triH = size * 0.36
    const triX = x + (size - triW) / 2 + 1.5
    const triY = y + (size - triH) / 2
    ctx.moveTo(triX, triY)
    ctx.lineTo(triX + triW, triY + triH / 2)
    ctx.lineTo(triX, triY + triH)
    ctx.closePath()
    ctx.fill()
  } else if (network === 'instagram') {
    const igGrad = ctx.createLinearGradient(x, y + size, x + size, y)
    igGrad.addColorStop(0, '#f09433')
    igGrad.addColorStop(0.3, '#dc2743')
    igGrad.addColorStop(1, '#bc1888')
    ctx.fillStyle = igGrad
    roundRectPath(ctx, x, y, size, size, 8)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    const m = size * 0.22
    const cSize = size - m * 2
    roundRectPath(ctx, x + m, y + m, cSize, cSize, 5)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, cSize * 0.26, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(x + size - m - 3.5, y + m + 3.5, 1.4, 0, Math.PI * 2)
    ctx.fill()
  } else if (network === 'tiktok') {
    ctx.fillStyle = '#010101'
    roundRectPath(ctx, x, y, size, size, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    roundRectPath(ctx, x, y, size, size, 8)
    ctx.stroke()
    ctx.shadowColor = 'transparent'
    const noteSize = Math.round(size * 0.58)
    ctx.font = `bold ${noteSize}px "Segoe UI", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#25F4EE'
    ctx.fillText('♪', x + size / 2 - 1, y + size / 2)
    ctx.fillStyle = '#FE2C55'
    ctx.fillText('♪', x + size / 2 + 1, y + size / 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('♪', x + size / 2, y + size / 2)
  } else if (network === 'facebook') {
    ctx.fillStyle = '#1877F2'
    roundRectPath(ctx, x, y, size, size, 8)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `bold ${Math.round(size * 0.68)}px "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('f', x + size / 2 + 1, y + size / 2 + 1)
  }
  ctx.restore()
}

/**
 * Dibuja un cintillo profesional moderno Broadcast / Glassmorphism en el canvas.
 * - Fondo traslúcido glassmorphism con specular border
 * - Tag animado con live pulse dot
 * - Tipografía nítida para texto principal y subtítulo
 * - Logotipo del invitado/podcast o icono oficial de red social a un costado
 * - Diseño limpio e independiente para cada red (YouTube, Instagram, TikTok, Facebook)
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

  const socialNetwork = overlay.network || (
    tag === 'YOUTUBE' ? 'youtube' :
    tag === 'INSTAGRAM' ? 'instagram' :
    tag === 'TIKTOK' ? 'tiktok' :
    tag === 'FACEBOOK' ? 'facebook' :
    (overlay.presetId && overlay.presetId.startsWith('social_')) ? overlay.presetId.replace('social_', '') :
    null
  )
  const hasSocialIcon = !hasLogo && Boolean(socialNetwork)

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

  const iconBoxSize = hasLogo ? 64 : (hasSocialIcon ? 44 : 0)
  const iconPadding = (hasLogo || hasSocialIcon) ? 14 : 0
  const maxAllowedW = Math.min(w * 0.88, 860)

  const contentW = Math.max(tagW, mainTextW, subTextW) + iconBoxSize + iconPadding + 44
  const barW = Math.min(Math.max(contentW, 360), maxAllowedW)

  const tagH = 28
  const baseContentH = subtitle ? 66 : 46
  const barH = Math.max(baseContentH, (hasLogo || hasSocialIcon) ? iconBoxSize + 16 : 46)
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

  // 6. Contenido principal (Logo/Icono + Textos a un costado)
  const contentY = y + tagH + 12
  let textStartX = x + 20

  // Dibujar Logotipo flotante o icono oficial de red social a la izquierda
  if (hasLogo) {
    const logoX = x + 18
    const logoY = contentY
    const lSize = iconBoxSize - 8

    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 3
    roundRectPath(ctx, logoX, logoY, lSize, lSize, 8)
    ctx.clip()
    ctx.drawImage(overlay.logoImage, logoX, logoY, lSize, lSize)
    ctx.restore()

    textStartX = logoX + lSize + 14
  } else if (hasSocialIcon) {
    const iconX = x + 18
    const iconY = contentY + 2
    const iSize = 42
    drawSocialIconOnCanvas(ctx, socialNetwork, iconX, iconY, iSize)
    textStartX = iconX + iSize + 14
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
  ctx.fillText(text, textStartX, contentY - 2, textAvailableW)
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
 * Dibuja la mosca / watermark del podcast en el canvas.
 * REGLA ESTRICTA: Solo se dibuja si el usuario subió una imagen de logotipo válida.
 * Si no sube logo, la toma y la grabación salen 100% limpias, sin recuadros ni marcas de agua.
 */
export function drawLogo(ctx, w, h, overlay) {
  if (!overlay?.logoImage?.complete || !overlay.logoImage.naturalWidth || overlay.logoImage.naturalWidth <= 0) {
    return
  }

  const position = overlay.position || 'tr'
  const isVertical = h > w
  const m = isVertical ? 24 : 36

  ctx.save()

  const naturalW = overlay.logoImage.naturalWidth
  const naturalH = overlay.logoImage.naturalHeight
  const targetH = isVertical ? 46 : 56
  const targetW = targetH * (naturalW / naturalH)

  const x = position === 'tl' ? m : (w - targetW - m)
  const y = m

  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.drawImage(overlay.logoImage, x, y, targetW, targetH)
  ctx.restore()
}

