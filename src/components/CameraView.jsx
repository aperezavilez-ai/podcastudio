import React, { useEffect, useRef } from 'react'

export default function CameraView({ stream, className, style, muted = true, onClick }) {
  const videoRef = useRef()

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
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
      style={{ objectFit: 'cover', ...style }}
      onClick={onClick}
    />
  )
}
