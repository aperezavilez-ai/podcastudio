import React, { useEffect, useRef } from 'react'
import { drawVideoCover, COMPOSITOR_W, COMPOSITOR_H } from '../utils/canvasCompositor.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import styles from './ViewportComposer.module.css'

/** Visor principal: mismo motor de pintura que las miniaturas (canvas + video oculto). */
export default function ViewportComposer({
  previewStream,
  cameraKey = 0,
}) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    if (!previewStream || !canvasRef.current) return undefined

    if (!videoRef.current) {
      const v = document.createElement('video')
      v.muted = true
      v.playsInline = true
      v.autoplay = true
      videoRef.current = v
    }

    const video = videoRef.current
    if (video.srcObject !== previewStream) video.srcObject = previewStream
    video.play().catch(() => {})
    const unbindKeepAlive = bindVideoKeepAlive(video)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let rafId = 0

    const draw = () => {
      const tw = canvas.clientWidth || 1280
      const th = canvas.clientHeight || 720
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(tw * dpr)
      const ph = Math.round(th * dpr)
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#07070a'
      ctx.fillRect(0, 0, pw, ph)

      if (video.readyState >= 2 && video.videoWidth) {
        const scale = pw / COMPOSITOR_W
        ctx.save()
        ctx.scale(scale, scale)
        drawVideoCover(ctx, video, 0, 0, COMPOSITOR_W, COMPOSITOR_H)
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(rafId)
      unbindKeepAlive()
    }
  }, [previewStream, cameraKey])

  if (!previewStream) {
    return (
      <div className={styles.empty}>
        <div className={styles.noSignal}>
          <i className="ti ti-video-off" />
          <span>Sin señal — conecta una cámara</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <canvas ref={canvasRef} className={styles.previewCanvas} />
    </div>
  )
}
