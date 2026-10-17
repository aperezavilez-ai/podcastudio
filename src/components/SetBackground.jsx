import React from 'react'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import styles from './SetBackground.module.css'

export default function SetBackground({ templateId, customUrl, preview = false, motionEnabled = true }) {
  if (customUrl) {
    const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(customUrl) || customUrl.startsWith('data:video')
    return (
      <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
        {isVideo ? (
          <video
            src={customUrl}
            autoPlay
            loop
            muted
            playsInline
            className={styles.realisticBg}
          />
        ) : (
          <img src={customUrl} alt="Escenario virtual" className={styles.realisticBg} />
        )}
      </div>
    )
  }

  if (!templateId || templateId === 'none') return null

  const template = getBackgroundTemplate(templateId)

  // Si tiene video loop en vivo y motionEnabled
  const hasLiveVideo = Boolean(template.video && motionEnabled && !preview)

  return (
    <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
      {hasLiveVideo ? (
        <video
          src={template.video}
          autoPlay
          loop
          muted
          playsInline
          poster={template.image}
          className={styles.realisticBg}
        />
      ) : template.image ? (
        <img
          src={template.image}
          alt={template.name}
          className={styles.realisticBg}
          loading="eager"
        />
      ) : (
        <div className={`${styles.layerBase} ${styles[templateId] || ''}`} />
      )}

      {/* Capa de atmósfera luminosa dinámica broadcast */}
      {!preview && motionEnabled && (
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
    </div>
  )
}

/** Capa frontal de escritorio / podium (Desk Overlay PNG) */
export function SetForegroundDesk({ templateId, showDesk = true, deskOffset = 0 }) {
  if (!showDesk || !templateId || templateId === 'none') return null
  const template = getBackgroundTemplate(templateId)
  if (!template.desk) return null

  return (
    <div
      className={styles.deskOverlayLayer}
      style={deskOffset ? { transform: `translateY(${deskOffset}px)` } : undefined}
      aria-hidden
    >
      <img src={template.desk} alt="" className={styles.deskOverlayImg} />
    </div>
  )
}
