import React, { useEffect, useRef } from 'react'
import { drawVideoCover, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { drawCintillo, drawLogo } from '../utils/drawOverlays.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'

export default function CameraThumb({
  stream,
  className,
  style,
  onClick,
  cintillo = null,
  cintilloPosition = 'bl',
  logoOverlay = null,
  directorCrop = null,
  maxFps = 12,
}) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    if (!stream || !canvasRef.current) return

    if (!videoRef.current) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.autoplay = true
      videoRef.current = v
    }

    const video = videoRef.current
    if (video.srcObject !== stream) video.srcObject = stream
    video.play().catch(() => {})
    const unbindKeepAlive = bindVideoKeepAlive(video)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let rafId = 0
    let lastFrame = 0
    const minFrameMs = maxFps > 0 ? 1000 / maxFps : 0

    const draw = (ts) => {
      if (minFrameMs && ts - lastFrame < minFrameMs) {
        rafId = requestAnimationFrame(draw)
        return
      }
      lastFrame = ts
      const tw = canvas.clientWidth || 108
      const th = canvas.clientHeight || 62
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(tw * dpr)
      const ph = Math.round(th * dpr)
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'medium'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#07070a'
      ctx.fillRect(0, 0, pw, ph)

      if (video.readyState >= 2 && video.videoWidth) {
        const scale = pw / COMPOSITOR_W
        ctx.save()
        ctx.scale(scale, scale)
        drawVideoCover(ctx, video, 0, 0, COMPOSITOR_W, COMPOSITOR_H, directorCrop)
        if (logoOverlay) drawLogo(ctx, COMPOSITOR_W, COMPOSITOR_H, logoOverlay)
        if (cintillo?.active) {
          drawCintillo(ctx, COMPOSITOR_W, COMPOSITOR_H, {
            active: true,
            tag: cintillo.tag,
            text: cintillo.text,
            color: cintillo.color,
            position: cintilloPosition,
          })
        }
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafId)
      unbindKeepAlive()
    }
  }, [stream, cintillo, cintilloPosition, logoOverlay, directorCrop, maxFps])

  if (!stream) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
          background: '#07070a',
          color: '#333',
        }}
        onClick={onClick}
      >
        <i className="ti ti-video-off" style={{ fontSize: 22 }} />
        <span style={{ fontSize: 10, color: '#2a2a3e' }}>Sin señal</span>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', ...style }}
      onClick={onClick}
    />
  )
}
