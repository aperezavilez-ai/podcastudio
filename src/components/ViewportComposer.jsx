import React, { useEffect, useRef } from 'react'
import { bindVideoKeepAlive } from '../utils/videoStream.js'
import styles from './ViewportComposer.module.css'

function LiveVideoPreview({ stream, cameraKey }) {
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
  previewStream,
  cameraKey = 0,
}) {
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
      <LiveVideoPreview stream={previewStream} cameraKey={cameraKey} />
    </div>
  )
}
