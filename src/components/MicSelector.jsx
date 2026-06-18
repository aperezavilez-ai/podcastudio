import React from 'react'
import { getMicrophoneType } from '../utils/micDevices.js'
import styles from './MicSelector.module.css'

export default function MicSelector({
  microphones,
  selectedMicId,
  micLabel,
  micLevel,
  onSelectMic,
  onRefresh,
}) {
  const active = microphones.find(m => m.deviceId === selectedMicId)
  const type = getMicrophoneType(active?.label || micLabel || '')

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Micrófono</span>
        {onRefresh && (
          <button type="button" className={styles.refreshBtn} onClick={onRefresh} title="Re-detectar micrófonos">
            <i className="ti ti-refresh" />
          </button>
        )}
      </div>

      <select
        className={styles.select}
        value={selectedMicId || ''}
        onChange={e => onSelectMic(e.target.value)}
      >
        {microphones.length === 0
          ? <option value="">Sin micrófonos detectados</option>
          : microphones.map((mic, i) => {
            const t = getMicrophoneType(mic.label)
            return (
              <option key={mic.deviceId} value={mic.deviceId}>
                {t === 'external' ? '🔌 ' : '💻 '}
                {mic.label || `Micrófono ${i + 1}`}
              </option>
            )
          })}
      </select>

      <div className={styles.status}>
        <span className={type === 'external' ? styles.badgeExternal : styles.badgeBuiltin}>
          <i className={`ti ${type === 'external' ? 'ti-plug' : 'ti-device-laptop'}`} />
          {type === 'external' ? 'Micrófono externo activo' : 'Micrófono integrado'}
        </span>
        {micLevel > 0 && (
          <span className={styles.levelOk}><i className="ti ti-volume" /> Señal detectada</span>
        )}
      </div>

      <p className={styles.hint}>
        Al conectar un micrófono USB o externo, el integrado de la PC o móvil se silencia automáticamente.
      </p>
    </div>
  )
}
