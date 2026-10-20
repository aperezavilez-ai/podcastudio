import { useEffect, useRef, useCallback } from 'react'
import { drawCompositorFrame, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import { getCintilloMotion, getTransitionProgress, TRANSITION_DURATION_MS } from '../utils/videoLook.js'

export function getResolutionForFormat(fmt, quality = '1080p') {
  if (quality === '4k') {
    if (fmt === '9:16') return { width: 2160, height: 3840 }
    if (fmt === '1:1') return { width: 2160, height: 2160 }
    return { width: 3840, height: 2160 }
  }
  if (quality === '720p') {
    if (fmt === '9:16') return { width: 720, height: 1280 }
    if (fmt === '1:1') return { width: 720, height: 720 }
    return { width: 1280, height: 720 }
  }
  // Default 1080p (Full HD)
  if (fmt === '9:16') return { width: 1080, height: 1920 }
  if (fmt === '1:1') return { width: 1080, height: 1080 }
  return { width: 1920, height: 1080 }
}

export function useStudioCompositor({
  streams,
  activeCamera,
  format = '16:9',
  quality = '1080p',
  logoUrl = null,
  logoPosition = 'tr',
  podcastName = '',
  cintillo = null,
  cintilloPosition = 'bl',
  cintilloStyle = 'classic',
  cintilloLogoUrl = null,
  animPhase = 'hold',
  animKey = 0,
  directorCrop = null,
  secondaryCrop = null,
  tertiaryCrop = null,
  quaternaryCrop = null,
  pipCrop = null,
  look = null,
  recording = false,
  recordDurationSec = 0,
  compositorActive = false,
  background = null,
  layout = 'full',
  pipCamera = null,
  secondaryCamera = null,
  tertiaryCamera = null,
  quaternaryCamera = null,
}) {
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const videosRef = useRef({})
  const keepAliveRef = useRef([])
  const rafRef = useRef(null)
  const logoImageRef = useRef(null)
  const cintilloLogoImageRef = useRef(null)
  const customBgImageRef = useRef(null)
  const settingsRef = useRef({})

  const prevCameraRef = useRef(activeCamera ?? 0)
  const transitionFromRef = useRef(activeCamera ?? 0)
  const transitionStartRef = useRef(null)
  const recordStartRef = useRef(null)
  const animKeyRef = useRef(animKey)
  const animPhaseStartRef = useRef(performance.now())

  const initialRes = getResolutionForFormat(format, quality)

  if (!canvasRef.current && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = initialRes.width
    canvas.height = initialRes.height
    canvasRef.current = canvas
    try {
      outputStreamRef.current = canvas.captureStream?.(30) || null
      // Fix: Aplicar contentHint='motion' para priorizar fluidez
      if (outputStreamRef.current) {
        const track = outputStreamRef.current.getVideoTracks()[0]
        if (track) {
          try {
            track.contentHint = 'motion'
          } catch { /* Safari no lo soporta */ }
        }
      }
    } catch {
      outputStreamRef.current = null
    }
  }

  // Sincronizar dimensiones del canvas cuando cambia el formato o la calidad (4K, Full HD, HD)
  useEffect(() => {
    const res = getResolutionForFormat(format, quality)
    if (canvasRef.current) {
      if (canvasRef.current.width !== res.width || canvasRef.current.height !== res.height) {
        canvasRef.current.width = res.width
        canvasRef.current.height = res.height
        if (typeof canvasRef.current.captureStream === 'function') {
          outputStreamRef.current = canvasRef.current.captureStream(30)
          // Fix: Aplicar contentHint='motion' al nuevo stream
          if (outputStreamRef.current) {
            const track = outputStreamRef.current.getVideoTracks()[0]
            if (track) {
              try {
                track.contentHint = 'motion'
              } catch { /* Safari no lo soporta */ }
            }
          }
        }
      }
    }
  }, [format, quality])

  if (animKeyRef.current !== animKey) {
    animKeyRef.current = animKey
    animPhaseStartRef.current = performance.now()
  }

  if (recording && !recordStartRef.current) {
    recordStartRef.current = performance.now()
  }
  if (!recording) {
    recordStartRef.current = null
  }

  const prevCam = prevCameraRef.current
  const currentCam = activeCamera ?? 0
  if (prevCam !== currentCam) {
    const mode = look?.transition || 'cut'
    if (mode !== 'cut') {
      transitionFromRef.current = prevCam
      transitionStartRef.current = performance.now()
    } else {
      transitionFromRef.current = currentCam
      transitionStartRef.current = null
    }
    prevCameraRef.current = currentCam
  }

  settingsRef.current = {
    activeCamera: currentCam,
    fromCamera: transitionFromRef.current,
    logoPosition,
    podcastName,
    cintillo,
    cintilloPosition,
    cintilloStyle,
    cintilloLogoUrl,
    animPhase,
    directorCrop,
    secondaryCrop,
    tertiaryCrop,
    quaternaryCrop,
    pipCrop,
    look,
    recording,
    recordStartMs: recordStartRef.current,
    recordDurationSec,
    transitionStartMs: transitionStartRef.current,
    transitionMode: look?.transition || 'cut',
    fromCamera: transitionFromRef.current,
    cintilloMotionEnabled: look?.cintilloMotion !== false,
    background,
    layout,
    pipCamera,
    secondaryCamera,
    tertiaryCamera,
    quaternaryCamera,
  }

  useEffect(() => {
    keepAliveRef.current.forEach((off) => off())
    keepAliveRef.current = []

    let shelf = null
    if (typeof document !== 'undefined') {
      shelf = document.getElementById('podcastudio-compositor-shelf')
      if (!shelf) {
        shelf = document.createElement('div')
        shelf.id = 'podcastudio-compositor-shelf'
        shelf.setAttribute('aria-hidden', 'true')
        shelf.style.cssText = 'position:fixed;bottom:0;right:0;width:320px;height:180px;opacity:0.99;pointer-events:none;overflow:hidden;z-index:-9999;transform:translateZ(0);'
        document.body.appendChild(shelf)
      }
    }

    const videos = videosRef.current
    Object.keys(videos).forEach((key) => {
      const slot = Number(key)
      if (!streams[slot]) {
        try {
          videos[slot]?.pause()
          videos[slot]?.remove()
        } catch {}
        delete videos[slot]
      }
    })

    Object.entries(streams).forEach(([slot, stream]) => {
      const i = Number(slot)
      if (!stream) return
      if (!videos[i]) {
        const v = document.createElement('video')
        v.muted = true
        v.playsInline = true
        v.autoplay = true
        v.setAttribute('playsinline', '')
        v.setAttribute('webkit-playsinline', '')
        v.style.cssText = 'width:320px;height:180px;display:block;'
        if (shelf) shelf.appendChild(v)
        videos[i] = v
      }
      if (videos[i].srcObject !== stream) {
        videos[i].srcObject = stream
      }
      const tryPlay = () => { videos[i].play().catch(() => {}) }
      tryPlay()
      videos[i].addEventListener('canplay', tryPlay)
      videos[i].addEventListener('loadedmetadata', tryPlay)
      try {
        stream.getVideoTracks().forEach(t => t.addEventListener('unmute', tryPlay))
      } catch {}
      keepAliveRef.current.push(bindVideoKeepAlive(videos[i]))
    })

    const resumeAll = () => {
      Object.values(videos).forEach((v) => {
        if (v?.srcObject) v.play().catch(() => {})
      })
    }
    document.addEventListener('visibilitychange', resumeAll)
    window.addEventListener('pageshow', resumeAll)

    return () => {
      document.removeEventListener('visibilitychange', resumeAll)
      window.removeEventListener('pageshow', resumeAll)
      keepAliveRef.current.forEach((off) => off())
      keepAliveRef.current = []
    }
  }, [streams])

  useEffect(() => {
    if (!logoUrl) {
      logoImageRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { logoImageRef.current = img }
    img.src = logoUrl
  }, [logoUrl])

  useEffect(() => {
    if (!cintilloLogoUrl) {
      cintilloLogoImageRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { cintilloLogoImageRef.current = img }
    img.src = cintilloLogoUrl
  }, [cintilloLogoUrl])

  useEffect(() => {
    if (!background?.customUrl) {
      customBgImageRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { customBgImageRef.current = img }
    img.src = background.customUrl
  }, [background?.customUrl])

  useEffect(() => {
    animPhaseStartRef.current = performance.now()
  }, [animPhase, animKey])

  // Actualizar resolución del canvas al cambiar formato (si no está grabando)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || recording) return
    const { width: tw, height: th } = getResolutionForFormat(format)
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw
      canvas.height = th
      try {
        outputStreamRef.current = canvas.captureStream?.(30) || null
      } catch {
        outputStreamRef.current = null
      }
    }
  }, [format, recording])

  const hasStreams = Boolean(streams && Object.values(streams).some(Boolean))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || (!compositorActive && !hasStreams)) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      return undefined
    }

    const ctx = canvas.getContext('2d', { alpha: false })

    // Fix: Throttle a 30fps exactos para sincronizar con captureStream(30)
    const TARGET_FPS = 30
    const FRAME_TIME = 1000 / TARGET_FPS
    let lastFrameTime = 0

    const draw = (timestamp) => {
      const elapsed = timestamp - lastFrameTime

      // Esperar hasta completar el intervalo de 30fps (33.3ms)
      if (elapsed < FRAME_TIME - 1) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // Ajustar lastFrameTime para compensar drift acumulado
      lastFrameTime = timestamp - (elapsed % FRAME_TIME)

      const s = settingsRef.current
      if (s.transitionStartMs && getTransitionProgress(s.transitionStartMs, TRANSITION_DURATION_MS) >= 1) {
        transitionStartRef.current = null
        transitionFromRef.current = s.activeCamera ?? 0
      }
      const slot = s.activeCamera ?? 0
      const fromSlot = s.fromCamera ?? slot
      const video = videosRef.current[slot]
      const videoFrom = fromSlot !== slot ? videosRef.current[fromSlot] : null
      const c = s.cintillo

      const animElapsed = performance.now() - animPhaseStartRef.current
      const cintilloMotion = c?.active
        ? getCintilloMotion(s.animPhase, animElapsed, s.cintilloMotionEnabled)
        : null

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'medium'

      const cw = canvas.width
      const ch = canvas.height

      try {
        drawCompositorFrame(ctx, cw, ch, {
          video,
          videoFrom: videoFrom && s.transitionStartMs ? videoFrom : null,
          transitionMode: s.transitionMode,
          transitionStartMs: s.transitionStartMs,
          logoOverlay: logoImageRef.current ? {
            podcastName: s.podcastName,
            position: s.logoPosition,
            logoImage: logoImageRef.current,
          } : null,
          cintilloOverlay: c?.active ? {
            active: true,
            tag: c.tag,
            text: c.text,
            subtitle: c.subtitle || c.sub || '',
            color: c.color,
            position: s.cintilloPosition || 'bl',
            styleId: s.cintilloStyle || 'broadcast',
            logoImage: cintilloLogoImageRef.current || null,
            socials: c.socials || null,
          } : null,
          cintilloMotion,
          directorCrop: s.directorCrop,
          fromCrop: null,
          secondaryCrop: s.secondaryCrop,
          tertiaryCrop: s.tertiaryCrop,
          quaternaryCrop: s.quaternaryCrop,
          pipCrop: s.pipCrop,
          look: s.look,
          recording: s.recording,
          recordStartMs: s.recordStartMs,
          recordDurationSec: s.recordDurationSec,
          background: s.background ? {
            ...s.background,
            customImage: customBgImageRef.current,
          } : null,
          layout: s.layout || 'full',
          pipVideo: s.pipCamera !== null ? videosRef.current[s.pipCamera] : null,
          secondaryVideo: s.secondaryCamera !== null ? videosRef.current[s.secondaryCamera] : null,
          tertiaryVideo: s.tertiaryCamera !== null ? videosRef.current[s.tertiaryCamera] : null,
          quaternaryVideo: s.quaternaryCamera !== null ? videosRef.current[s.quaternaryCamera] : null,
          allVideos: videosRef.current,
        })
      } catch {
        ctx.fillStyle = '#07070a'
        ctx.fillRect(0, 0, cw, ch)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [compositorActive, hasStreams])

  const getProgramStream = useCallback(() => {
    const s = settingsRef.current
    const needsCompositor = Boolean(
      s.background?.hasVirtualSet ||
      (s.background?.templateId && s.background.templateId !== 'none') ||
      s.background?.customImage ||
      s.background?.customUrl ||
      s.cintillo?.active ||
      s.logoUrl ||
      s.layout !== 'full'
    )

    // Camino directo de ultra baja latencia: si no hay escenario virtual, cintillo,
    // logo ni layout múltiple, devolvemos el stream crudo de la cámara (cero canvas, cero latencia)
    if (!needsCompositor) {
      const slot = s.activeCamera ?? 0
      const raw = streams?.[slot]
      if (raw && raw.getVideoTracks?.().some(t => t.readyState === 'live')) {
        return raw
      }
    }

    // Camino normal (canvas) solo cuando realmente se necesita compositing
    const existing = outputStreamRef.current
    const vt = existing?.getVideoTracks?.()?.[0]
    if (existing && vt && vt.readyState === 'live') {
      return existing
    }
    if (canvasRef.current && typeof canvasRef.current.captureStream === 'function') {
      try {
        const fresh = canvasRef.current.captureStream(30)
        outputStreamRef.current = fresh
        return fresh
      } catch {}
    }
    return existing
  }, [streams])
  const getDisplayCanvas = useCallback(() => canvasRef.current, [])

  return { getProgramStream, getDisplayCanvas, canvasRef }
}
