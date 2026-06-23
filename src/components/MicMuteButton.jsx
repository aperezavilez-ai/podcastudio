import React from 'react'
import styles from './MicMuteButton.module.css'

export default function MicMuteButton({ muted, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${muted ? styles.muted : styles.active} ${className}`.trim()}
      title={muted ? 'Activar micrófono' : 'Silenciar micrófono'}
      aria-label={muted ? 'Activar micrófono' : 'Silenciar micrófono'}
      aria-pressed={muted}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {muted ? (
          <>
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M12 19v3M8 22h8" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2M19 12v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </>
        ) : (
          <>
            <path d="M12 19v3M8 22h8" />
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          </>
        )}
      </svg>
      <span className={styles.label}>{muted ? 'OFF' : 'MIC'}</span>
    </button>
  )
}
