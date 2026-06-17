import { useEffect, useRef, useCallback } from 'react'

const W = 1920
const H = 1080

export function useProgramOutput(streams, activeCamera) {
  const canvasRef = useRef(null)
  const outputStreamRef = useRef(null)
  const videosRef = useRef({})
  const rafRef = useRef(null)

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
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      canvasRef.current = canvas
      outputStreamRef.current = canvas.captureStream(30)
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const slot = activeCamera ?? 0
      const video = videosRef.current[slot]
      ctx.fillStyle = '#07070a'
      ctx.fillRect(0, 0, W, H)

      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        const scale = Math.max(W / vw, H / vh)
        const dw = vw * scale
        const dh = vh * scale
        const dx = (W - dw) / 2
        const dy = (H - dh) / 2
        ctx.drawImage(video, dx, dy, dw, dh)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [activeCamera, streams])

  const getProgramStream = useCallback(() => outputStreamRef.current, [])

  return { getProgramStream }
}
