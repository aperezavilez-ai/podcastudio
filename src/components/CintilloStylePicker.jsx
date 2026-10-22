import React from 'react'
import { CINTILLO_STYLES } from '../config/cintilloStyles.js'
import CintilloOverlay from './CintilloOverlay.jsx'
import styles from './CintilloStylePicker.module.css'

export default function CintilloStylePicker({
  value,
  onChange,
  previewTag = 'INVITADO',
  previewText = 'Nombre del invitado',
  compact = false,
}) {
  return (
    <div className={`${styles.picker} ${compact ? styles.pickerCompact : ''}`}>
      <div className={styles.grid}>
        {CINTILLO_STYLES.map(style => (
          <button
            key={style.id}
            type="button"
            className={`${styles.card} ${value === style.id ? styles.cardActive : ''}`}
            onClick={() => onChange(style.id)}
            title={style.desc}
          >
            <div className={styles.previewBox}>
              <CintilloOverlay
                styleId={style.id}
                tag={previewTag}
                text={previewText}
                subtitle={style.id === 'premium' ? 'Info' : ''}
                preview
              />
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>{style.name}</span>
              {!compact && <span className={styles.cardDesc}>{style.desc}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
