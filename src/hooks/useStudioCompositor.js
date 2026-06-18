import { useEffect, useRef, useCallback } from 'react'
import { drawCompositorFrame, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'

export function useStudioCompositor({
  streams,
  activeCamera,
  logoUrl = null,
  logoPosition = 'tr',
  podcastName = '',
  cintillo = null,
  cintilloPosition = 'bl',
  directorCrop = null,
}) {
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const videosRef = useRef({})
  const keepAliveRef = useRef([])
  const rafRef = useRef(null)
  const logoImageRef = useRef(null)
  const settingsRef = useRef({})

  if (!canvasRef.current && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = COMPOSITOR_W
    canvas.height = COMPOSITOR_H
    canvasRef.current = canvas
    outputStreamRef.current = canvas.captureStream(30)
  }

  settingsRef.current = {
    activeCamera,
    logoPosition,
    podcastName,
    cintillo,
    cintilloPosition,
    directorCrop,
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
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })

    const draw = () => {
      const s = settingsRef.current
      const slot = s.activeCamera ?? 0
      const video = videosRef.current[slot]
      const c = s.cintillo

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      drawCompositorFrame(ctx, COMPOSITOR_W, COMPOSITOR_H, {
        video,
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
        } : null,
        directorCrop: s.directorCrop,
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
