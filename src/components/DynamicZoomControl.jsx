import React from 'react'
import styles from './DynamicZoomControl.module.css'
import { ZOOM_PRESETS } from '../hooks/useDynamicZoom.js'

export default function DynamicZoomControl({
  activeCamera = 0,
  crop = null,
  zoom = null,
  activePreset: activePresetProp = null,
  pushIn: pushInProp = null,
  onSetZoom,
  onZoomChange,
  onApplyPreset,
  onPresetChange,
  onTogglePushIn,
  onPushInToggle,
  onResetZoom,
  onReset,
  className = '',
  style = {},
}) {
  const currentZoom = crop?.zoom ?? (typeof zoom === 'number' ? zoom : 1.0)
  const isPushIn = Boolean(crop?.pushIn ?? pushInProp)
  const activePreset = crop?.presetId ?? activePresetProp ?? (currentZoom <= 1.02 ? 'wide' : 'custom')

  const applyPresetFn = onApplyPreset || onPresetChange
  const setZoomFn = onSetZoom || onZoomChange
  const togglePushInFn = onTogglePushIn || onPushInToggle
  const resetZoomFn = onResetZoom || onReset

  const handleApplyPreset = (presetId) => {
    if (applyPresetFn) applyPresetFn(activeCamera, presetId)
  }

  const handleSetZoom = (val) => {
    if (setZoomFn) setZoomFn(activeCamera, val)
  }

  const handleTogglePushIn = () => {
    if (togglePushInFn) togglePushInFn(activeCamera)
  }

  const handleReset = () => {
    if (resetZoomFn) resetZoomFn(activeCamera)
  }

  return (
    <div className={`${styles.zoomBar} ${className}`} style={style} onClick={(e) => e.stopPropagation()}>
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
            onClick={(e) => {
              e.stopPropagation()
              handleApplyPreset(p.id)
            }}
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
          onChange={(e) => {
            e.stopPropagation()
            handleSetZoom(parseFloat(e.target.value))
          }}
          className={styles.zoomSlider}
          title={`Zoom: ${currentZoom.toFixed(2)}x`}
        />
        <span className={styles.zoomValue}>{currentZoom.toFixed(1)}x</span>
      </div>

      <button
        type="button"
        className={`${styles.pushInBtn} ${isPushIn ? styles.pushInActive : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          handleTogglePushIn()
        }}
        title={isPushIn ? 'Detener Dolly / Push-In' : 'Activar Push-In Cinemático (acercamiento continuo)'}
      >
        <i className="ti ti-movie" />
        <span>Push-In</span>
      </button>

      {currentZoom > 1.02 && (
        <button
          type="button"
          className={styles.resetBtn}
          onClick={(e) => {
            e.stopPropagation()
            handleReset()
          }}
          title="Restablecer plano normal"
        >
          <i className="ti ti-rotate" />
        </button>
      )}
    </div>
  )
}
