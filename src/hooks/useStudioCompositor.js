import { useEffect, useRef, useCallback } from 'react'
import { drawCompositorFrame, getStudioImageUrl, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { usePersonSegmentation } from './usePersonSegmentation.js'

export function useStudioCompositor({
  streams,
  activeCamera,
  backgroundTemplate = 'none',
  customBackgroundUrl = null,
  chromaEnabled = false,
  aiBackgroundEnabled = false,
  chromaColor = '#00b140',
  chromaSimilarity = 45,
  chromaSmoothness = 20,
  cameraScale = 100,
  logoUrl = null,
  logoPosition = 'tr',
  podcastName = '',
  cintillo = null,
  cintilloPosition = 'bl',
}) {
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const videosRef = useRef({})
  const rafRef = useRef(null)
  const chromaCanvasRef = useRef(null)
  const chromaCtxRef = useRef(null)
  const studioImageRef = useRef(null)
  const customImageRef = useRef(null)
  const logoImageRef = useRef(null)
  const settingsRef = useRef({})
  const lastMaskRef = useRef(null)

  const { processFrame } = usePersonSegmentation(aiBackgroundEnabled)

  settingsRef.current = {
    backgroundTemplate,
    customBackgroundUrl,
    chromaEnabled,
    aiBackgroundEnabled,
    chromaColor,
    chromaSimilarity,
    chromaSmoothness,
    cameraScale,
    activeCamera,
    logoPosition,
    podcastName,
    cintillo,
    cintilloPosition,
  }

  useEffect(() => {
    const videos = videosRef.current
    Object.keys(videos).forEach(key => {
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
        videos[i] = v
      }
      if (videos[i].srcObject !== stream) {
        videos[i].srcObject = stream
        videos[i].play().catch(() => {})
      }
    })
  }, [streams])

  useEffect(() => {
    const url = getStudioImageUrl(backgroundTemplate, null)
    if (!url) {
      studioImageRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { studioImageRef.current = img }
    img.src = url
  }, [backgroundTemplate])

  useEffect(() => {
    if (!customBackgroundUrl) {
      customImageRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { customImageRef.current = img }
    img.src = customBackgroundUrl
  }, [customBackgroundUrl])

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
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = COMPOSITOR_W
      canvas.height = COMPOSITOR_H
      canvasRef.current = canvas
      outputStreamRef.current = canvas.captureStream(30)
    }

    if (!chromaCanvasRef.current) {
      chromaCanvasRef.current = document.createElement('canvas')
      chromaCtxRef.current = chromaCanvasRef.current.getContext('2d', { willReadFrequently: true })
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const s = settingsRef.current
      const slot = s.activeCamera ?? 0
      const video = videosRef.current[slot]
      const c = s.cintillo

      let segmentationMask = null
      if (s.aiBackgroundEnabled && video?.videoWidth) {
        const mask = processFrame(video, performance.now())
        if (mask) lastMaskRef.current = mask
        segmentationMask = mask || lastMaskRef.current
      }

      drawCompositorFrame(ctx, COMPOSITOR_W, COMPOSITOR_H, {
        video,
        backgroundTemplate: s.backgroundTemplate,
        customImage: customImageRef.current,
        studioImage: studioImageRef.current,
        chromaEnabled: s.chromaEnabled,
        aiBackgroundEnabled: s.aiBackgroundEnabled,
        segmentationMask,
        chromaColor: s.chromaColor,
        chromaSimilarity: s.chromaSimilarity,
        chromaSmoothness: s.chromaSmoothness,
        cameraScale: s.cameraScale,
        chromaCanvas: chromaCanvasRef.current,
        chromaCtx: chromaCtxRef.current,
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
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [processFrame])

  const getProgramStream = useCallback(() => outputStreamRef.current, [])

  const getDisplayCanvas = useCallback(() => canvasRef.current, [])

  return { getProgramStream, getDisplayCanvas, canvasRef }
}
