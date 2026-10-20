import { drawCintillo, drawLogo } from './drawOverlays.js'
import {
  buildCanvasFilter,
  drawVignette,
  applyLutOverlay,
  getTemporalVignetteExtra,
  getTransitionProgress,
  TRANSITION_DURATION_MS,
} from './videoLook.js'
import { drawSetBackground, drawSetForegroundDesk, drawVideoInset } from './drawSetBackground.js'

const W = 1920
const H = 1080

export function drawVideoContain(ctx, video, x, y, w, h, directorCrop = null) {
  if (!video || video.readyState < 2 || !video.videoWidth) return
  const vw = video.videoWidth
  const vh = video.videoHeight

  let sx = 0
  let sy = 0
  let sw = vw
  let sh = vh

  if (directorCrop && directorCrop.zoom > 1.02) {
    const zoom = directorCrop.zoom
    sw = vw / zoom
    sh = vh / zoom
    sx = directorCrop.focusX * vw - sw / 2
    sy = directorCrop.focusY * vh - sh / 2
    sx = Math.max(0, Math.min(vw - sw, sx))
    sy = Math.max(0, Math.min(vh - sh, sy))
  }

  const videoAspect = sw / sh
  const boxAspect = w / h

  // Fondo oscuro con degradado ambiental acelerado por GPU (cero CPU blur)
  const bgGrad = ctx.createRadialGradient(x + w / 2, y + h / 2, 40, x + w / 2, y + h / 2, Math.max(w, h) / 1.3)
  bgGrad.addColorStop(0, '#12141f')
  bgGrad.addColorStop(1, '#08090e')
  ctx.fillStyle = bgGrad
  ctx.fillRect(x, y, w, h)

  // Calcular encuadre exacto completo sin recortar nada
  let dw, dh, dx, dy
  if (boxAspect > videoAspect) {
    dh = h
    dw = Math.round(h * videoAspect)
    dx = Math.round(x + (w - dw) / 2)
    dy = y
  } else {
    dw = w
    dh = Math.round(w / videoAspect)
    dx = x
    dy = Math.round(y + (h - dh) / 2)
  }

  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
}

export function drawVideoCover(ctx, video, x, y, w, h, directorCrop = null) {
  if (!video || video.readyState < 2 || !video.videoWidth) return
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh || !w || !h) return

  const zoom = Math.max(1, Number(directorCrop?.zoom) || 1)
  const fx = typeof directorCrop?.focusX === 'number' ? directorCrop.focusX : 0.5
  const fy = typeof directorCrop?.focusY === 'number' ? directorCrop.focusY : 0.42

  // Escala base que asegura cobertura total sin espacios negros (cover)
  const baseScale = Math.max(w / vw, h / vh)
  const totalScale = baseScale * zoom
  const dw = vw * totalScale
  const dh = vh * totalScale

  // Centrado en el punto focal calibrado de la toma
  let dx = x + (w / 2) - (fx * dw)
  let dy = y + (h / 2) - (fy * dh)

  // Clamping para garantizar que la imagen cubre completamente el rectángulo asignado
  if (dw >= w) {
    dx = Math.min(x, Math.max(x + w - dw, dx))
  } else {
    dx = x + (w - dw) / 2
  }
  if (dh >= h) {
    dy = Math.min(y, Math.max(y + h - dh, dy))
  } else {
    dy = y + (h - dh) / 2
  }

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(video, dx, dy, dw, dh)
  ctx.restore()
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
  secondaryCrop = null,
  tertiaryCrop = null,
  quaternaryCrop = null,
  pipCrop = null,
  look = null,
  recording = false,
  recordStartMs = null,
  recordDurationSec = 0,
  background = null,
  layout = 'full',
  pipVideo = null,
  secondaryVideo = null,
  tertiaryVideo = null,
  quaternaryVideo = null,
  allVideos = null,
}) {
  // ✅ FIX CRÍTICO #5: Limpiar canvas COMPLETO al inicio de cada frame
  ctx.clearRect(0, 0, w, h)

  const useVirtualSet = Boolean(background?.hasVirtualSet || (background?.templateId && background.templateId !== 'none') || background?.customImage || background?.customUrl)

  if (useVirtualSet) {
    if (background.customImage) {
      ctx.drawImage(background.customImage, 0, 0, w, h)
    } else if (background.templateId && background.templateId !== 'none') {
      drawSetBackground(ctx, w, h, background.templateId, background.cameraAngle || 'mid', background.liveMotionEnabled !== false)
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
      drawVideoInset(ctx, v, w, h, background, crop, look, background?.chromaSettings)
      if (background?.chromaSettings?.enabled) {
        drawSetForegroundDesk(
          ctx,
          w,
          h,
          background.templateId,
          background.showDesk !== false,
          background.deskOffset || 0,
          background.cameraAngle || 'mid'
        )
      }
    } else {
      drawVideoLayer(ctx, v, w, h, crop, look)
    }
  }

  if (videoFrom && videoFrom !== video && progress < 1 && !useVirtualSet && transitionMode !== 'cut') {
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
        drawVideoCover(ctx, secondaryVideo, 0, halfH + 12, w, halfH, secondaryCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(0, halfH + 12, w, halfH)
      }
      ctx.restore()
    } else {
      // Modo Split 50/50 horizontal (para 16:9 y 1:1) - Cobertura total sin bordes negros con encuadre calibrado
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
        drawVideoCover(ctx, secondaryVideo, halfW + 12, 0, halfW, h, secondaryCrop)
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
        drawVideoCover(ctx, secondaryVideo, 0, subY, subW, subH, secondaryCrop)
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
        drawVideoCover(ctx, tertiaryVideo, subW + 12, subY, subW, subH, tertiaryCrop)
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
        drawVideoCover(ctx, secondaryVideo, sideX, 0, sideW, sideH, secondaryCrop)
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
        drawVideoCover(ctx, tertiaryVideo, sideX, sideH + 12, sideW, sideH, tertiaryCrop)
      } else {
        ctx.fillStyle = '#0d0d12'
        ctx.fillRect(sideX, sideH + 12, sideW, sideH)
      }
      ctx.restore()
    }
  } else if (layout === 'quad') {
    const halfW = Math.round((w - 12) / 2)
    const halfH = Math.round((h - 12) / 2)

    // Cam 1 (Master) - Top Left con encuadre y zoom individual
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, halfW, halfH)
    ctx.clip()
    if (video && video.readyState >= 2 && video.videoWidth) {
      drawVideoCover(ctx, video, 0, 0, halfW, halfH, directorCrop)
    } else {
      ctx.fillStyle = '#0d0d12'
      ctx.fillRect(0, 0, halfW, halfH)
    }
    ctx.restore()

    // Cam 2 - Top Right con encuadre y zoom individual
    ctx.save()
    ctx.beginPath()
    ctx.rect(halfW + 12, 0, halfW, halfH)
    ctx.clip()
    if (secondaryVideo && secondaryVideo.readyState >= 2 && secondaryVideo.videoWidth) {
      drawVideoCover(ctx, secondaryVideo, halfW + 12, 0, halfW, halfH, secondaryCrop)
    } else {
      ctx.fillStyle = '#0d0d12'
      ctx.fillRect(halfW + 12, 0, halfW, halfH)
    }
    ctx.restore()

    // Cam 3 - Bottom Left con encuadre y zoom individual
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, halfH + 12, halfW, halfH)
    ctx.clip()
    if (tertiaryVideo && tertiaryVideo.readyState >= 2 && tertiaryVideo.videoWidth) {
      drawVideoCover(ctx, tertiaryVideo, 0, halfH + 12, halfW, halfH, tertiaryCrop)
    } else {
      ctx.fillStyle = '#0d0d12'
      ctx.fillRect(0, halfH + 12, halfW, halfH)
    }
    ctx.restore()

    // Cam 4 - Bottom Right con encuadre y zoom individual
    ctx.save()
    ctx.beginPath()
    ctx.rect(halfW + 12, halfH + 12, halfW, halfH)
    ctx.clip()
    if (quaternaryVideo && quaternaryVideo.readyState >= 2 && quaternaryVideo.videoWidth) {
      drawVideoCover(ctx, quaternaryVideo, halfW + 12, halfH + 12, halfW, halfH, quaternaryCrop)
    } else {
      ctx.fillStyle = '#0d0d12'
      ctx.fillRect(halfW + 12, halfH + 12, halfW, halfH)
    }
    ctx.restore()
  } else if (layout === 'classroom') {
    // Modo Aula Virtual: Master centrado arriba (Profesor/Presentación) y tira de alumnos abajo
    const isVertical = h > w
    const masterH = Math.round(isVertical ? h * 0.62 : h * 0.70)
    const masterW = isVertical ? w : Math.round(w * 0.82)
    const masterX = Math.round((w - masterW) / 2)
    const masterY = 0

    // Fondo del aula
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, w, h)

    // Master / Profesor
    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(masterX, masterY, masterW, masterH, [0, 0, 16, 16])
    } else {
      ctx.rect(masterX, masterY, masterW, masterH)
    }
    ctx.clip()
    if (video && video.readyState >= 2 && video.videoWidth) {
      drawVideoCover(ctx, video, masterX, masterY, masterW, masterH, directorCrop)
    } else {
      ctx.fillStyle = '#12121a'
      ctx.fillRect(masterX, masterY, masterW, masterH)
    }
    ctx.restore()

    // Borde elegante para Master
    ctx.save()
    ctx.strokeStyle = '#e8612a'
    ctx.lineWidth = 2
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(masterX, masterY, masterW, masterH, [0, 0, 16, 16])
      ctx.stroke()
    }
    ctx.restore()

    // Etiqueta Profesor / Master
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    const tagH = 26
    const tagW = 140
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(masterX + 16, masterY + 16, tagW, tagH, 6)
      ctx.fill()
    } else {
      ctx.fillRect(masterX + 16, masterY + 16, tagW, tagH)
    }
    ctx.fillStyle = '#f3f4f6'
    ctx.font = 'bold 12px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎓 MASTER / AULA', masterX + 16 + (tagW / 2), masterY + 16 + (tagH / 2))
    ctx.restore()

    // Tira de Alumnos / Cámaras secundarias abajo
    const stripY = masterH + 10
    const stripH = h - stripY - 10
    const rawStudents = (allVideos ? Object.values(allVideos) : [secondaryVideo, tertiaryVideo, quaternaryVideo])
      .filter(v => v && v !== video && v.readyState >= 2 && v.videoWidth)
    
    const studentList = rawStudents.length > 0 ? rawStudents : [secondaryVideo, tertiaryVideo, quaternaryVideo].filter(Boolean)
    const count = Math.max(studentList.length, 1)
    const maxVisible = 6
    const visibleCount = Math.min(count, maxVisible)
    const gap = 8
    const totalGaps = (visibleCount + 1) * gap
    const cardW = Math.min(Math.round((w - totalGaps) / visibleCount), Math.round(stripH * 1.5))
    const totalRowW = visibleCount * cardW + (visibleCount - 1) * gap
    const startX = Math.max(gap, Math.round((w - totalRowW) / 2))

    for (let i = 0; i < visibleCount; i++) {
      const sv = studentList[i]
      const cx = startX + i * (cardW + gap)
      ctx.save()
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(cx, stripY, cardW, stripH, 8)
      } else {
        ctx.rect(cx, stripY, cardW, stripH)
      }
      ctx.clip()
      if (sv && sv.readyState >= 2 && sv.videoWidth) {
        drawVideoCover(ctx, sv, cx, stripY, cardW, stripH, null)
      } else {
        ctx.fillStyle = '#161622'
        ctx.fillRect(cx, stripY, cardW, stripH)
        ctx.fillStyle = '#6b7280'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Alumno ${i + 1}`, cx + cardW / 2, stripY + stripH / 2)
      }
      ctx.restore()

      // Borde del alumno
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1.5
      if (ctx.roundRect) {
        ctx.beginPath()
        ctx.roundRect(cx, stripY, cardW, stripH, 8)
        ctx.stroke()
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
      drawVideoCover(ctx, pipVideo, pipX, pipY, pipW, pipH, pipCrop)
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
