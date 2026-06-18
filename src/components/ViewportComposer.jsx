import React, { useEffect, useRef, useState } from 'react'
import { preferVideoPreview } from '../lib/device.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import styles from './ViewportComposer.module.css'

function MobileVideoPreview({ stream }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return undefined
    video.srcObject = stream
    video.play().catch(() => {})
    const off = bindVideoKeepAlive(video)
    return () => {
      off()
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      className={styles.previewVideo}
      autoPlay
      muted
      playsInline
    />
  )
}

export default function ViewportComposer({ getDisplayCanvas, hasStream, previewStream }) {
  const containerRef = useRef(null)
  const [useVideoPreview, setUseVideoPreview] = useState(() => preferVideoPreview())

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const update = () => setUseVideoPreview(preferVideoPreview())
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!hasStream || useVideoPreview) return undefined

    let rafId = 0
    const mount = () => {
      const canvas = getDisplayCanvas?.()
      const el = containerRef.current
      if (canvas && el) {
        canvas.className = styles.programCanvas
        if (canvas.parentNode !== el) {
          el.appendChild(canvas)
        }
        return true
      }
      return false
    }

    if (!mount()) {
      const retry = () => {
        if (mount()) return
        rafId = requestAnimationFrame(retry)
      }
      rafId = requestAnimationFrame(retry)
    }

    return () => {
      cancelAnimationFrame(rafId)
      const canvas = getDisplayCanvas?.()
      const el = containerRef.current
      if (canvas && el && canvas.parentNode === el) {
        el.removeChild(canvas)
      }
    }
  }, [getDisplayCanvas, hasStream, useVideoPreview])

  if (!hasStream) {
    return (
      <div className={styles.empty}>
        <div className={styles.noSignal}>
          <i className="ti ti-video-off" />
          <span>Sin señal</span>
        </div>
      </div>
    )
  }

  if (useVideoPreview && previewStream) {
    return (
      <div className={styles.composer}>
        <MobileVideoPreview stream={previewStream} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.composer} />
  )
}
