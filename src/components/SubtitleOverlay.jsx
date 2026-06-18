import React from 'react'
import styles from './SubtitleOverlay.module.css'

export default function SubtitleOverlay({ text, interim, visible }) {
  if (!visible || !text) return null
  return (
    <div className={styles.preview} aria-live="polite">
      <span className={styles.badge}>Subtítulos IA</span>
      {text}
      {interim && <span className={styles.interim}> {interim}</span>}
    </div>
  )
}
