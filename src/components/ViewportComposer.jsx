import React, { useEffect, useRef } from 'react'
import { useChromaKeyCanvas } from '../hooks/useChromaKey.js'
import SetBackground from './SetBackground.jsx'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import styles from './ViewportComposer.module.css'

export default function ViewportComposer({
  stream,
  backgroundTemplate = 'none',
  customBackgroundUrl = null,
  chromaEnabled = false,
  chromaColor = '#00b140',
  chromaSimilarity = 45,
  chromaSmoothness = 20,
  cameraScale = 100,
}) {
  const videoRef = useRef(null)
  const canvasRef = useChromaKeyCanvas(videoRef, {
    enabled: chromaEnabled && !!stream,
    keyColor: chromaColor,
    similarity: chromaSimilarity,
    smoothness: chromaSmoothness,
  })

  const hasBackground = backgroundTemplate !== 'none' || !!customBackgroundUrl
  const template = getBackgroundTemplate(backgroundTemplate)
  const cam = template.camera
  const scale = cameraScale / 100

  useEffect(() => {
    const video = videoRef.current
    if (video && stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    }
  }, [stream])

  if (!stream) {
    return (
      <div className={styles.empty}>
        {hasBackground && (
          <SetBackground templateId={backgroundTemplate} customUrl={customBackgroundUrl} />
        )}
        <div className={styles.noSignal}>
          <i className="ti ti-video-off" />
          <span>Sin señal</span>
        </div>
      </div>
    )
  }

  const cameraStyle = hasBackground && !chromaEnabled
    ? {
        top: `${cam.top}%`,
        left: `${cam.left}%`,
        width: `${cam.width}%`,
        height: `${cam.height}%`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }
    : chromaEnabled && hasBackground
      ? {
          inset: 0,
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'center bottom',
        }
      : { inset: 0, width: '100%', height: '100%' }

  return (
    <div className={styles.composer}>
      {hasBackground && (
        <SetBackground templateId={backgroundTemplate} customUrl={customBackgroundUrl} />
      )}

      <div
        className={`${styles.cameraWrap} ${hasBackground && !chromaEnabled ? styles.cameraFramed : ''} ${chromaEnabled ? styles.cameraChroma : ''}`}
        style={cameraStyle}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={chromaEnabled ? styles.hiddenVideo : styles.cameraVideo}
        />
        {chromaEnabled && <canvas ref={canvasRef} className={styles.chromaCanvas} />}
      </div>

      {chromaEnabled && hasBackground && (
        <div className={styles.chromaBadge}>
          <i className="ti ti-background" /> Croma activo
        </div>
      )}
    </div>
  )
}
