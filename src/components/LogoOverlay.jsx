import React from 'react'
import styles from './LogoOverlay.module.css'

const POS_CLASS = {
  tl: styles.posTl,
  tc: styles.posTc,
  tr: styles.posTr,
  ml: styles.posMl,
  mc: styles.posMc,
  mr: styles.posMr,
  bl: styles.posBl,
  bc: styles.posBc,
  br: styles.posBr,
}

export default function LogoOverlay({ logoUrl, position = 'tr', large = false }) {
  if (!logoUrl) return null

  const pos = POS_CLASS[position] || styles.posTr

  return (
    <div className={`${styles.wrap} ${pos} ${large ? styles.large : ''}`}>
      <img src={logoUrl} alt="" className={styles.logoImg} draggable={false} />
    </div>
  )
}
