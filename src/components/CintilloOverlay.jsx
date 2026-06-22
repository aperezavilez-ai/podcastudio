import React from 'react'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import styles from './CintilloOverlay.module.css'

export default function CintilloOverlay({
  styleId = 'classic',
  tag = 'TEMA',
  text = '',
  subtitle = '',
  accentColor,
  imageUrl,
  position = 'bl',
  preview = false,
  liveOn = false,
  totalViewers = 0,
  onClose,
  className = '',
  animPhase = 'hold',
  animKey = 0,
}) {
  const styleDef = getCintilloStyle(styleId)
  const primary = accentColor || styleDef.colors.primary
  const secondary = styleDef.colors.secondary

  const posClass = {
    tl: styles.posTl,
    tc: styles.posTc,
    tr: styles.posTr,
    ml: styles.posMl,
    mc: styles.posMc,
    mr: styles.posMr,
    bl: styles.posBl,
    bc: styles.posBc,
    br: styles.posBr,
  }[position] || styles.posBl

  const wrapClass = [
    styles.wrap,
    posClass,
    preview ? styles.preview : '',
    styles[`style_${styleId}`],
    !preview && animPhase === 'enter' ? styles.phaseEnter : '',
    !preview && animPhase === 'exit' ? styles.phaseExit : '',
    className,
  ].filter(Boolean).join(' ')

  const extras = (liveOn || totalViewers > 0 || onClose) && !preview ? (
    <div className={styles.extras}>
      {liveOn && <span className={styles.liveBadge}><span className={styles.liveDot} />En vivo</span>}
      {totalViewers > 0 && <span className={styles.viewers}><i className="ti ti-eye" /> {totalViewers.toLocaleString()}</span>}
      {onClose && (
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar cintillo">
          <i className="ti ti-x" />
        </button>
      )}
    </div>
  ) : null

  const p1 = styles.animPart1
  const tagCls = `${styles.tag} ${styles.animPart2}`
  const textCls = `${styles.mainText} ${styles.animPart3}`
  const subCls = `${styles.subText} ${styles.animPart4}`

  const avatar = imageUrl ? (
    <img src={imageUrl} alt="" className={`${styles.avatar} ${p1}`} />
  ) : (
    <div className={`${styles.avatarPlaceholder} ${p1}`} style={{ background: primary }}>
      <i className="ti ti-user" />
    </div>
  )

  const shell = (body) => (
    <div key={preview ? styleId : animKey} className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
      {body}
      {extras}
    </div>
  )

  switch (styleId) {
    case 'angled':
      return shell(
        <>
          <div className={`${styles.angledShape} ${p1}`} />
          <div className={styles.angledBody}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'broadcast':
      return shell(
        <>
          <div className={`${styles.broadcastFlag} ${p1}`} />
          <div className={styles.broadcastBar}>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )

    case 'profile':
      return shell(
        <>
          {avatar}
          <div className={styles.profileBody}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )

    case 'tab':
      return shell(
        <>
          <div className={`${styles.topTab} ${p1}`} style={{ background: secondary, color: '#111' }}>{tag}</div>
          <div className={`${styles.tabBody} ${styles.animPart2}`} style={{ background: primary }}>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )

    case 'news':
      return shell(
        <>
          <div className={`${styles.newsIcon} ${p1}`}><i className="ti ti-news" /></div>
          <div className={styles.newsBody}>
            <span className={`${styles.newsTab} ${styles.animPart2}`} style={{ background: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'elegant':
      return shell(
        <div className={styles.elegantBody}>
          <span className={`${styles.topTabSm} ${p1}`} style={{ background: primary, color: '#fff' }}>{tag}</span>
          <span className={textCls}>{text}</span>
          <div className={`${styles.accentLine} ${styles.animPart4}`} style={{ background: primary }} />
        </div>
      )

    case 'wave':
      return shell(
        <>
          <div className={`${styles.waveBg} ${p1}`} />
          <div className={styles.waveContent}>
            <span className={tagCls}>{tag}</span>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )

    case 'neon':
      return shell(
        <>
          {avatar}
          <div className={styles.neonBody}>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={`${styles.neonSub} ${subCls}`} style={{ background: primary }}>{subtitle}</span>}
          </div>
        </>
      )

    case 'sport':
      return shell(
        <>
          <div className={`${styles.sportVertical} ${p1}`} style={{ background: primary }}>{tag}</div>
          <div className={`${styles.sportArc} ${styles.animPart2}`} style={{ background: secondary }} />
          <div className={styles.sportBar}>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )

    case 'corporate':
      return shell(
        <>
          <div className={`${styles.corpStripes} ${p1}`} />
          <div className={styles.corpBody}>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={`${styles.corpSub} ${subCls}`} style={{ borderColor: primary }}>{subtitle}</span>}
          </div>
        </>
      )

    case 'premium':
      return shell(
        <>
          {avatar}
          <div className={`${styles.premiumMain} ${styles.animPart2}`} style={{ background: primary }}>
            <span className={tagCls}>{tag}</span>
            <span className={textCls}>{text}</span>
          </div>
          {subtitle && <div className={`${styles.premiumSub} ${subCls}`}>{subtitle}</div>}
        </>
      )

    default:
      return shell(
        <>
          <div className={`${styles.classicAccent} ${p1}`} style={{ background: primary }} />
          <div className={styles.classicBody}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
          </div>
        </>
      )
  }
}
