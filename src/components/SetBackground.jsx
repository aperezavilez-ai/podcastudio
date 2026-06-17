import React from 'react'
import styles from './SetBackground.module.css'

export default function SetBackground({ templateId, customUrl, preview = false }) {
  if (customUrl) {
    return (
      <div className={`${styles.set} ${preview ? styles.preview : ''}`}>
        <img src={customUrl} alt="" className={styles.customBg} />
        <div className={styles.customOverlay} />
      </div>
    )
  }

  if (!templateId || templateId === 'none') return null

  return (
    <div className={`${styles.set} ${styles[templateId] || ''} ${preview ? styles.preview : ''}`}>
      <div className={styles.layerBase} />
      <div className={styles.layerAccent} />
      <div className={styles.layerFrame} />
      <div className={styles.layerDecor} />
      {templateId === 'breaking-news' && <span className={styles.breakingLabel}>BREAKING</span>}
      {templateId === 'split-news' && <div className={styles.splitPane} />}
      {templateId === 'sport-energy' && <div className={styles.sportStripe} />}
      {templateId === 'kids-color' && (
        <>
          <div className={styles.kidsCircle1} />
          <div className={styles.kidsCircle2} />
        </>
      )}
    </div>
  )
}
