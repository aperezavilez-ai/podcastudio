import React, { useEffect, useRef } from 'react'
import CameraView from './CameraView.jsx'
import styles from './ViewportComposer.module.css'

export default function ViewportComposer({ getDisplayCanvas, hasStream, previewStream }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!hasStream) return

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
  }, [getDisplayCanvas, hasStream])

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

  return (
    <div ref={containerRef} className={styles.composer}>
      {previewStream && (
        <CameraView
          stream={previewStream}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
        />
      )}
    </div>
  )
}
