import React, { useEffect, useRef } from 'react'
import styles from './ViewportComposer.module.css'

export default function ViewportComposer({ getDisplayCanvas, hasStream }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = getDisplayCanvas?.()
    const el = containerRef.current
    if (!canvas || !el) return

    canvas.className = styles.programCanvas
    el.appendChild(canvas)

    return () => {
      if (canvas.parentNode === el) el.removeChild(canvas)
    }
  }, [getDisplayCanvas])

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

  return <div ref={containerRef} className={styles.composer} />
}
