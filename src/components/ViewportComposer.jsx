import React, { useEffect, useRef, useState } from 'react'
import { preferVideoPreview } from '../lib/device.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import styles from './ViewportComposer.module.css'

function MobileVideoPreview({ stream, cameraKey }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return undefined

    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    video.srcObject = stream

    const play = () => { video.play().catch(() => {}) }
    video.addEventListener('loadedmetadata', play)
    video.addEventListener('canplay', play)
    play()

    const off = bindVideoKeepAlive(video)
    return () => {
      video.removeEventListener('loadedmetadata', play)
      video.removeEventListener('canplay', play)
      off()
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [stream, cameraKey])

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

export default function ViewportComposer({
  getDisplayCanvas,
  hasStream,
  previewStream,
  cameraKey = 0,
}) {
  const containerRef = useRef(null)
  const [useVideoPreview, setUseVideoPreview] = useState(() => preferVideoPreview())

  useEffect(() => {
    const update = () => setUseVideoPreview(preferVideoPreview())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
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
        <MobileVideoPreview stream={previewStream} cameraKey={cameraKey} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className={styles.composer} />
  )
}
