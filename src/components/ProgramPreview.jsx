import React, { useEffect, useRef, useMemo } from 'react'
import { buildCanvasFilter } from '../utils/videoLook.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import SetBackground from './SetBackground.jsx'
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

function LookOverlays({ look }) {
  const lut = lutClass(look?.lutId)
  const vignette = vignetteStyle(look)
  return (
    <>
      {lut && <div className={`${styles.lut} ${lut}`} aria-hidden />}
      {vignette && <div className={styles.vignette} style={vignette} aria-hidden />}
    </>
  )
}

/** Visor principal: video HTML directo (fluido) + filtros CSS del LOOK PRO + Layouts Multi-cámara (Solo, PiP, Split, Triple). */
export default function ProgramPreview({
  stream,
  cameraKey = 0,
  look = null,
  directorCrop = null,
  virtualSet = null,
  layout = 'full', // 'full' | 'pip' | 'split' | 'triple'
  pipStream = null,
  pipLabel = '',
  onClosePip = null,
  secondaryStream = null,
  secondaryLabel = '',
  tertiaryStream = null,
  tertiaryLabel = '',
  primaryLabel = '',
}) {
  const videoRef = useRef(null)
  const pipVideoRef = useRef(null)
  const secondaryVideoRef = useRef(null)
  const tertiaryVideoRef = useRef(null)
  const hasSet = virtualSet?.enabled

  // Video principal
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

  // Video PiP (Picture in Picture)
  useEffect(() => {
    const video = pipVideoRef.current
    if (!video || !pipStream) return undefined

    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    if (video.srcObject !== pipStream) video.srcObject = pipStream
    video.play().catch(() => {})

    const off = bindVideoKeepAlive(video)
    return () => {
      off()
      if (video.srcObject === pipStream) video.srcObject = null
    }
  }, [pipStream, layout])

  // Video secundario (Split / Triple)
  useEffect(() => {
    const video = secondaryVideoRef.current
    if (!video || !secondaryStream) return undefined

    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    if (video.srcObject !== secondaryStream) video.srcObject = secondaryStream
    video.play().catch(() => {})

    const off = bindVideoKeepAlive(video)
    return () => {
      off()
      if (video.srcObject === secondaryStream) video.srcObject = null
    }
  }, [secondaryStream, layout])

  // Video terciario (Triple)
  useEffect(() => {
    const video = tertiaryVideoRef.current
    if (!video || !tertiaryStream) return undefined

    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.muted = true
    if (video.srcObject !== tertiaryStream) video.srcObject = tertiaryStream
    video.play().catch(() => {})

    const off = bindVideoKeepAlive(video)
    return () => {
      off()
      if (video.srcObject === tertiaryStream) video.srcObject = null
    }
  }, [tertiaryStream, layout])

  const cssFilter = useMemo(() => {
    const f = buildCanvasFilter(look)
    return f && f !== 'none' ? f : undefined
  }, [look])

  const zoom = directorCrop?.zoom > 1.02 ? directorCrop.zoom : 1
  const originX = `${(directorCrop?.focusX ?? 0.5) * 100}%`
  const originY = `${(directorCrop?.focusY ?? 0.42) * 100}%`

  if (!stream) {
    return (
      <div className={styles.empty}>
        <i className="ti ti-video-off" />
        <span>Sin señal — conecta una cámara</span>
      </div>
    )
  }

  if (hasSet && virtualSet.cameraRect) {
    const { top, left, width, height } = virtualSet.cameraRect
    return (
      <div className={styles.preview}>
        <SetBackground templateId={virtualSet.templateId} customUrl={virtualSet.customUrl} />
        <video
          ref={videoRef}
          className={styles.videoInset}
          autoPlay
          muted
          playsInline
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}%`,
            height: `${height}%`,
            filter: cssFilter,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: `${originX} ${originY}`,
            transition: directorCrop?.pushIn ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), transform-origin 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        />
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO SPLIT (50/50 Lado a lado)
  if (layout === 'split' && secondaryStream) {
    return (
      <div className={styles.preview}>
        <div className={styles.splitContainer}>
          <div className={styles.splitPane}>
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
            {primaryLabel && <div className={styles.splitBadge}>{primaryLabel}</div>}
          </div>
          <div className={styles.splitPane}>
            <video
              ref={secondaryVideoRef}
              className={styles.video}
              autoPlay
              muted
              playsInline
            />
            {secondaryLabel && <div className={styles.splitBadge}>{secondaryLabel}</div>}
          </div>
        </div>
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO TRIPLE (1 Master + 2 Secundarias)
  if (layout === 'triple' && (secondaryStream || tertiaryStream)) {
    return (
      <div className={styles.preview}>
        <div className={styles.tripleContainer}>
          <div className={styles.tripleMainPane}>
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
            {primaryLabel && <div className={styles.splitBadge}>{primaryLabel}</div>}
          </div>
          <div className={styles.tripleSidePane}>
            <div className={styles.tripleSubPane}>
              <video
                ref={secondaryVideoRef}
                className={styles.video}
                autoPlay
                muted
                playsInline
              />
              {secondaryLabel && <div className={styles.splitBadge}>{secondaryLabel}</div>}
            </div>
            <div className={styles.tripleSubPane}>
              <video
                ref={tertiaryVideoRef}
                className={styles.video}
                autoPlay
                muted
                playsInline
              />
              {tertiaryLabel && <div className={styles.splitBadge}>{tertiaryLabel}</div>}
            </div>
          </div>
        </div>
        <LookOverlays look={look} />
      </div>
    )
  }

  // MODO NORMAL (FULL) con o sin PiP
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
          transition: directorCrop?.pushIn ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), transform-origin 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      />

      {/* Recuadro PiP (Picture in Picture) */}
      {layout === 'pip' && pipStream && (
        <div className={styles.pipContainer}>
          <video
            ref={pipVideoRef}
            className={styles.pipVideo}
            autoPlay
            muted
            playsInline
          />
          {pipLabel && <div className={styles.pipBadge}>{pipLabel}</div>}
          {onClosePip && (
            <button
              type="button"
              className={styles.pipCloseBtn}
              onClick={onClosePip}
              title="Cerrar recuadro PiP"
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      )}

      <LookOverlays look={look} />
    </div>
  )
}
