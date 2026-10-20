import React, { useEffect } from 'react'
import { useVirtual3D } from '../hooks/useVirtual3D.js'
import styles from './Virtual3DCanvas.module.css'

/**
 * Componente de canvas 3D para escenarios virtuales profesionales
 */
export default function Virtual3DCanvas({
  templateId,
  presenterStream,
  onReady,
  onError,
  quality = 'auto',
  showStats = false,
  style
}) {
  const {
    canvasRef,
    outputStream,
    ready,
    loading,
    error,
    stats
  } = useVirtual3D({
    templateId,
    presenterStream,
    quality
  })

  // Callback cuando el stream está listo
  useEffect(() => {
    if (ready && outputStream && onReady) {
      onReady(outputStream)
    }
  }, [ready, outputStream, onReady])

  // Callback de error
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  return (
    <div className={styles.container} style={style}>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className={styles.canvas}
      />

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Cargando escenario 3D...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <i className="ti ti-alert-circle" />
          <p>Error: {error}</p>
          <small>Cambiando a modo 2D...</small>
        </div>
      )}

      {showStats && ready && (
        <div className={styles.stats}>
          <div>FPS: {stats.fps}</div>
          <div>Draw Calls: {stats.drawCalls}</div>
        </div>
      )}
    </div>
  )
}
