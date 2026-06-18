import React, { useEffect, useRef } from 'react'
import { bindVideoKeepAlive } from '../utils/videoStream.js'

export default function CameraView({ stream, className, style, muted = true, onClick }) {
  const videoRef = useRef()

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return

    video.srcObject = stream
    video.play().catch(() => {})

    return bindVideoKeepAlive(video)
  }, [stream])

  if (!stream) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, background: '#07070a', color: '#333' }} onClick={onClick}>
        <i className="ti ti-video-off" style={{ fontSize: 22 }} />
        <span style={{ fontSize: 10, color: '#2a2a3e' }}>Sin señal</span>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      style={{ objectFit: 'cover', width: '100%', height: '100%', ...style }}
      onClick={onClick}
    />
  )
}
