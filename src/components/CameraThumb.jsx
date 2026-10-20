import React, { useEffect, useRef } from 'react'
import { bindVideoKeepAlive } from '../utils/videoStream.js'

function CameraThumb({
  stream,
  className,
  style,
  onClick,
  cintillo = null,
  cintilloPosition = 'bl',
  logoOverlay = null,
  crop = null,
  directorCrop = null,
}) {
  const videoRef = useRef(null)
  const effectiveCrop = crop || directorCrop

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return

    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true

    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    const tryPlay = () => {
      const p = video.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    tryPlay()

    video.addEventListener('canplay', tryPlay)
    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('loadedmetadata', tryPlay)

    const videoTracks = stream.getVideoTracks() || []
    videoTracks.forEach(t => t.addEventListener('unmute', tryPlay))

    const unbind = bindVideoKeepAlive(video)

    return () => {
      unbind?.()
      video.removeEventListener('canplay', tryPlay)
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('loadedmetadata', tryPlay)
      videoTracks.forEach(t => t.removeEventListener('unmute', tryPlay))
    }
  }, [stream])

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

  const zoom = Math.max(1, Number(effectiveCrop?.zoom) || 1)
  const fx = typeof effectiveCrop?.focusX === 'number' ? effectiveCrop.focusX : 0.5
  const fy = typeof effectiveCrop?.focusY === 'number' ? effectiveCrop.focusY : 0.42
  const filter = (effectiveCrop?.filter && effectiveCrop.filter !== 'none') ? effectiveCrop.filter : undefined

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#07070a',
        borderRadius: style?.borderRadius ?? 7,
        ...style,
      }}
      onClick={onClick}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
          objectPosition: `${Math.round(fx * 100)}% ${Math.round(fy * 100)}%`,
          transform: zoom > 1 ? `scale(${zoom})` : undefined,
          transformOrigin: `${Math.round(fx * 100)}% ${Math.round(fy * 100)}%`,
          filter,
        }}
      />
      {cintillo?.active && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          padding: '2px 6px',
          background: cintillo.color || '#e8612a',
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          borderRadius: 3,
          boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}>
          {cintillo.tag || cintillo.text}
        </div>
      )}
    </div>
  )
}

export default React.memo(CameraThumb)
