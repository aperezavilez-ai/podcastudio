import { useEffect, useRef, useCallback } from 'react'
import { drawCompositorFrame, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import { getCintilloMotion, getTransitionProgress, TRANSITION_DURATION_MS } from '../utils/videoLook.js'

export function useStudioCompositor({
  streams,
  activeCamera,
  logoUrl = null,
  logoPosition = 'tr',
  podcastName = '',
  cintillo = null,
  cintilloPosition = 'bl',
  cintilloStyle = 'classic',
  animPhase = 'hold',
  animKey = 0,
  directorCrop = null,
  look = null,
  recording = false,
  recordDurationSec = 0,
}) {
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const videosRef = useRef({})
  const keepAliveRef = useRef([])
  const rafRef = useRef(null)
  const logoImageRef = useRef(null)
  const settingsRef = useRef({})

  const prevCameraRef = useRef(activeCamera ?? 0)
  const transitionFromRef = useRef(activeCamera ?? 0)
  const transitionStartRef = useRef(null)
  const recordStartRef = useRef(null)
  const animKeyRef = useRef(animKey)
  const animPhaseStartRef = useRef(performance.now())

  if (!canvasRef.current && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = COMPOSITOR_W
    canvas.height = COMPOSITOR_H
    canvasRef.current = canvas
    outputStreamRef.current = canvas.captureStream(30)
  }

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
    const mode = look?.transition || 'crossfade'
    transitionFromRef.current = prevCam
    if (mode !== 'cut') {
      transitionStartRef.current = performance.now()
    } else {
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
    animPhase,
    directorCrop,
    look,
    recording,
    recordStartMs: recordStartRef.current,
    recordDurationSec,
    transitionStartMs: transitionStartRef.current,
    transitionMode: look?.transition || 'crossfade',
    fromCamera: transitionFromRef.current,
    cintilloMotionEnabled: look?.cintilloMotion !== false,
  }

  useEffect(() => {
    keepAliveRef.current.forEach((off) => off())
    keepAliveRef.current = []

    const videos = videosRef.current
    Object.keys(videos).forEach((key) => {
      const slot = Number(key)
      if (!streams[slot]) {
        videos[slot]?.pause()
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
        videos[i] = v
      }
      if (videos[i].srcObject !== stream) {
        videos[i].srcObject = stream
      }
      videos[i].play().catch(() => {})
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
    animPhaseStartRef.current = performance.now()
  }, [animPhase, animKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })

    const draw = () => {
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
      ctx.imageSmoothingQuality = 'high'

      drawCompositorFrame(ctx, COMPOSITOR_W, COMPOSITOR_H, {
        video,
        videoFrom: videoFrom && s.transitionStartMs ? videoFrom : null,
        transitionMode: s.transitionMode,
        transitionStartMs: s.transitionStartMs,
        logoOverlay: {
          podcastName: s.podcastName,
          position: s.logoPosition,
          logoImage: logoImageRef.current,
        },
        cintilloOverlay: c?.active ? {
          active: true,
          tag: c.tag,
          text: c.text,
          color: c.color,
          position: s.cintilloPosition,
          styleId: s.cintilloStyle,
        } : null,
        cintilloMotion,
        directorCrop: s.directorCrop,
        fromCrop: null,
        look: s.look,
        recording: s.recording,
        recordStartMs: s.recordStartMs,
        recordDurationSec: s.recordDurationSec,
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const getProgramStream = useCallback(() => outputStreamRef.current, [])
  const getDisplayCanvas = useCallback(() => canvasRef.current, [])

  return { getProgramStream, getDisplayCanvas, canvasRef }
}
