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
}) {
  const styleDef = getCintilloStyle(styleId)
  const primary = accentColor || styleDef.colors.primary
  const secondary = styleDef.colors.secondary

  const posClass = {
    bl: styles.posBl,
    bc: styles.posBc,
    br: styles.posBr,
  }[position] || styles.posBl

  const wrapClass = [
    styles.wrap,
    posClass,
    preview ? styles.preview : '',
    styles[`style_${styleId}`],
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

  const avatar = imageUrl ? (
    <img src={imageUrl} alt="" className={styles.avatar} />
  ) : (
    <div className={styles.avatarPlaceholder} style={{ background: primary }}>
      <i className="ti ti-user" />
    </div>
  )

  switch (styleId) {
    case 'angled':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.angledShape} />
          <div className={styles.angledBody}>
            <span className={styles.tag} style={{ color: primary }}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
            {subtitle && <span className={styles.subText}>{subtitle}</span>}
          </div>
          {extras}
        </div>
      )

    case 'broadcast':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.broadcastFlag} />
          <div className={styles.broadcastBar}>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )

    case 'profile':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          {avatar}
          <div className={styles.profileBody}>
            <span className={styles.tag} style={{ color: primary }}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )

    case 'tab':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.topTab} style={{ background: secondary, color: '#111' }}>{tag}</div>
          <div className={styles.tabBody} style={{ background: primary }}>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )

    case 'news':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.newsIcon}><i className="ti ti-news" /></div>
          <div className={styles.newsBody}>
            <span className={styles.newsTab} style={{ background: primary }}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
            {subtitle && <span className={styles.subText}>{subtitle}</span>}
          </div>
          {extras}
        </div>
      )

    case 'elegant':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.elegantBody}>
            <span className={styles.topTabSm} style={{ background: primary, color: '#fff' }}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
            <div className={styles.accentLine} style={{ background: primary }} />
          </div>
          {extras}
        </div>
      )

    case 'wave':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.waveBg} />
          <div className={styles.waveContent}>
            <span className={styles.tag}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )

    case 'neon':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          {avatar}
          <div className={styles.neonBody}>
            <span className={styles.mainText}>{text}</span>
            {subtitle && <span className={styles.neonSub} style={{ background: primary }}>{subtitle}</span>}
          </div>
          {extras}
        </div>
      )

    case 'sport':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.sportVertical} style={{ background: primary }}>{tag}</div>
          <div className={styles.sportArc} style={{ background: secondary }} />
          <div className={styles.sportBar}>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )

    case 'corporate':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.corpStripes} />
          <div className={styles.corpBody}>
            <span className={styles.mainText}>{text}</span>
            {subtitle && <span className={styles.corpSub} style={{ borderColor: primary }}>{subtitle}</span>}
          </div>
          {extras}
        </div>
      )

    case 'premium':
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          {avatar}
          <div className={styles.premiumMain} style={{ background: primary }}>
            <span className={styles.tag}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
          </div>
          {subtitle && <div className={styles.premiumSub}>{subtitle}</div>}
          {extras}
        </div>
      )

    default:
      return (
        <div className={wrapClass} style={{ '--cint-primary': primary, '--cint-secondary': secondary }}>
          <div className={styles.classicAccent} style={{ background: primary }} />
          <div className={styles.classicBody}>
            <span className={styles.tag} style={{ color: primary }}>{tag}</span>
            <span className={styles.mainText}>{text}</span>
          </div>
          {extras}
        </div>
      )
  }
}
