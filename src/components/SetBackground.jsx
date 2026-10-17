import React from 'react'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import styles from './SetBackground.module.css'

export default function SetBackground({ templateId, customUrl, preview = false }) {
  if (customUrl) {
    return (
      <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
        <img src={customUrl} alt="Escenario virtual" className={styles.realisticBg} />
      </div>
    )
  }

  if (!templateId || templateId === 'none') return null

  const template = getBackgroundTemplate(templateId)

  return (
    <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
      {template.image ? (
        <>
          <img
            src={template.image}
            alt={template.name}
            className={styles.realisticBg}
            loading="eager"
          />
          {!preview && (
            <div className={styles.ambientMotionLayer} aria-hidden>
              <div className={styles.studioLightGlow} />
              <div className={styles.studioLightRight} />
              {(template.id === 'talkshow-late' || template.id === 'news-prime') && (
                <div className={styles.citySkylineShimmer} />
              )}
              {(template.category === 'noticias' || template.category === 'tech') && (
                <div className={styles.screenScanlines} />
              )}
            </div>
          )}
        </>
      ) : (
        <div className={`${styles.layerBase} ${styles[templateId] || ''}`} />
      )}
    </div>
  )
}

/** Capa frontal de escritorio / podium (Desk Overlay PNG) */
export function SetForegroundDesk({ templateId, showDesk = true }) {
  if (!showDesk || !templateId || templateId === 'none') return null
  const template = getBackgroundTemplate(templateId)
  if (!template.desk) return null

  return (
    <div className={styles.deskOverlayLayer} aria-hidden>
      <img src={template.desk} alt="" className={styles.deskOverlayImg} />
    </div>
  )
}
