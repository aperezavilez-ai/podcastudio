import React, { useEffect, useRef, useMemo } from 'react'
import { buildCanvasFilter } from '../utils/videoLook.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import styles from './ProgramPreview.module.css'

function lutClass(lutId) {
  if (!lutId || lutId === 'none') return null
  return styles[`lut_${lutId.replace(/-/g, '_')}`] || null
}

function vignetteStyle(look) {
  const intensity = look?.vignette ?? 0
  if (intensity <= 0) return null
  const alpha = Math.min(0.88, (intensity / 100) * 0.82)
  return {
    background: `radial-gradient(ellipse 85% 78% at 50% 46%, transparent 32%, rgba(0,0,0,${alpha * 0.2}) 58%, rgba(0,0,0,${alpha}) 100%)`,
  }
}

/** Visor principal: video HTML directo (fluido) + filtros CSS del LOOK PRO. */
export default function ProgramPreview({
  stream,
  cameraKey = 0,
  look = null,
  directorCrop = null,
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return undefined

    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    if (video.srcObject !== stream) video.srcObject = stream
    video.play().catch(() => {})

    const off = bindVideoKeepAlive(video)
    return () => {
      off()
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [stream, cameraKey])

  const cssFilter = useMemo(() => {
    const f = buildCanvasFilter(look)
    return f && f !== 'none' ? f : undefined
  }, [look])

  const zoom = directorCrop?.zoom > 1.02 ? directorCrop.zoom : 1
  const originX = `${(directorCrop?.focusX ?? 0.5) * 100}%`
  const originY = `${(directorCrop?.focusY ?? 0.42) * 100}%`
  const lut = lutClass(look?.lutId)
  const vignette = vignetteStyle(look)

  if (!stream) {
    return (
      <div className={styles.empty}>
        <i className="ti ti-video-off" />
        <span>Sin señal — conecta una cámara</span>
      </div>
    )
  }

  return (
    <div className={styles.preview}>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        muted
        playsInline
        style={{
          filter: cssFilter,
          transform: zoom > 1 ? `scale(${zoom})` : undefined,
          transformOrigin: `${originX} ${originY}`,
        }}
      />
      {lut && <div className={`${styles.lut} ${lut}`} aria-hidden />}
      {vignette && <div className={styles.vignette} style={vignette} aria-hidden />}
    </div>
  )
}
