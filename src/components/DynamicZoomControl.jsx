import React from 'react'
import styles from './DynamicZoomControl.module.css'
import { ZOOM_PRESETS } from '../hooks/useDynamicZoom.js'

export default function DynamicZoomControl({
  activeCamera = 0,
  crop = { zoom: 1.0, presetId: 'wide', pushIn: false },
  onSetZoom,
  onApplyPreset,
  onTogglePushIn,
  onResetZoom,
  className = '',
  style = {},
}) {
  const currentZoom = crop?.zoom || 1.0
  const isPushIn = Boolean(crop?.pushIn)
  const activePreset = crop?.presetId || (currentZoom <= 1.02 ? 'wide' : 'custom')

  return (
    <div className={`${styles.zoomBar} ${className}`} style={style}>
      <div className={styles.zoomLabel}>
        <i className="ti ti-zoom-in" />
        <span>Zoom Dinámico</span>
      </div>

      <div className={styles.presetGroup}>
        {ZOOM_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.presetBtn} ${activePreset === p.id ? styles.presetActive : ''}`}
            onClick={() => onApplyPreset(activeCamera, p.id)}
            title={p.label}
          >
            {p.id === 'wide' ? '1.0x' : p.id === 'medium' ? '1.35x' : p.id === 'closeup' ? '1.75x' : '2.2x'}
          </button>
        ))}
      </div>

      <div className={styles.sliderContainer}>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={currentZoom}
          onChange={(e) => onSetZoom(activeCamera, parseFloat(e.target.value))}
          className={styles.zoomSlider}
          title={`Zoom: ${currentZoom.toFixed(2)}x`}
        />
        <span className={styles.zoomValue}>{currentZoom.toFixed(1)}x</span>
      </div>

      <button
        type="button"
        className={`${styles.pushInBtn} ${isPushIn ? styles.pushInActive : ''}`}
        onClick={() => onTogglePushIn(activeCamera)}
        title={isPushIn ? 'Detener Dolly / Push-In' : 'Activar Push-In Cinemático (acercamiento continuo)'}
      >
        <i className="ti ti-movie" />
        <span>Push-In</span>
      </button>

      {currentZoom > 1.02 && (
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => onResetZoom(activeCamera)}
          title="Restablecer plano normal"
        >
          <i className="ti ti-rotate" />
        </button>
      )}
    </div>
  )
}
