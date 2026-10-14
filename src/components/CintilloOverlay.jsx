import React from 'react'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import styles from './CintilloOverlay.module.css'

export default function CintilloOverlay({
  styleId = 'glass',
  tag = 'TEMA',
  text = '',
  subtitle = '',
  accentColor,
  imageUrl,
  logoUrl,
  position = 'bl',
  preview = false,
  size = 'normal',
  format = '16:9',
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

  const formatClass = format === '9:16'
    ? styles.format_9_16
    : format === '1:1'
      ? styles.format_1_1
      : styles.format_16_9

  const wrapClass = [
    styles.wrap,
    posClass,
    formatClass,
    preview ? styles.preview : '',
    size === 'large' ? styles.wrapLarge : '',
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

  const effectiveLogo = logoUrl || imageUrl || null
  const logoElement = effectiveLogo ? (
    <div className={`${styles.cintLogoBox} ${styles.logo3dFloat} ${p1}`}>
      <img src={effectiveLogo} alt="Logo" className={styles.cintLogoImg} />
      <span className={styles.logoReflection} />
    </div>
  ) : null

  const shell = (body) => (
    <div
      key={preview ? styleId : animKey}
      className={wrapClass}
      style={{ '--cint-primary': primary, '--cint-secondary': secondary }}
    >
      <div className={styles.cintInner3D}>
        {logoElement}
        <div className={styles.cintMainBlock}>
          {body}
        </div>
      </div>
      {extras}
    </div>
  )

  switch (styleId) {
    case 'glass':
      return shell(
        <div className={styles.glassBody}>
          <div className={styles.glassTopBar}>
            <span className={tagCls} style={{ color: primary, background: `${primary}22`, borderColor: `${primary}55` }}>
              <span className={styles.livePulseDot} style={{ background: primary }} />
              {tag}
            </span>
          </div>
          <span className={textCls}>{text}</span>
          {subtitle && <span className={subCls}>{subtitle}</span>}
        </div>
      )

    case 'cyber':
      return shell(
        <div className={styles.cyberBody} style={{ '--cyber-glow': primary }}>
          <div className={styles.cyberTopLine} style={{ background: primary }} />
          <div className={styles.cyberContent}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </div>
      )

    case 'news':
      return shell(
        <div className={styles.newsContainer}>
          <div className={styles.newsHeaderBar} style={{ background: primary }}>
            <span className={styles.newsTagText}>{tag}</span>
            <span className={styles.newsLiveTicker}>● EN VIVO</span>
          </div>
          <div className={styles.newsBody}>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </div>
      )

    case 'metallic':
      return shell(
        <div className={styles.metallicBody}>
          <div className={styles.metallicAccentBar} style={{ background: primary }} />
          <div className={styles.metallicContent}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </div>
      )

    case 'minimal':
      return shell(
        <div className={styles.minimalBody}>
          <div className={styles.minimalLine} style={{ background: primary }} />
          <div className={styles.minimalContent}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </div>
      )

    case 'angled':
      return shell(
        <>
          <div className={`${styles.angledShape} ${p1}`} style={{ background: primary }} />
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
          <div className={`${styles.broadcastFlag} ${p1}`} style={{ background: primary }} />
          <div className={styles.broadcastBar}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'profile':
      return shell(
        <div className={styles.profileBody}>
          <span className={tagCls} style={{ color: primary }}>{tag}</span>
          <span className={textCls}>{text}</span>
          {subtitle && <span className={subCls}>{subtitle}</span>}
        </div>
      )

    case 'tab':
      return shell(
        <>
          <div className={`${styles.topTab} ${p1}`} style={{ background: primary, color: '#fff' }}>{tag}</div>
          <div className={`${styles.tabBody} ${styles.animPart2}`}>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'neon':
      return shell(
        <div className={styles.neonBody} style={{ borderColor: primary, boxShadow: `0 0 16px ${primary}40` }}>
          <span className={tagCls} style={{ color: primary }}>{tag}</span>
          <span className={textCls}>{text}</span>
          {subtitle && <span className={subCls}>{subtitle}</span>}
        </div>
      )

    case 'sport':
      return shell(
        <>
          <div className={`${styles.sportVertical} ${p1}`} style={{ background: primary }}>{tag}</div>
          <div className={styles.sportBar}>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'corporate':
      return shell(
        <>
          <div className={`${styles.corpStripes} ${p1}`} style={{ background: primary }} />
          <div className={styles.corpBody}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )

    case 'premium':
      return shell(
        <div className={styles.premiumMain}>
          <div className={styles.premiumTopRow}>
            <span className={tagCls} style={{ background: primary, color: '#fff' }}>{tag}</span>
          </div>
          <span className={textCls}>{text}</span>
          {subtitle && <span className={subCls}>{subtitle}</span>}
        </div>
      )

    default: // classic pro
      return shell(
        <>
          <div className={`${styles.classicAccent} ${p1}`} style={{ background: primary }} />
          <div className={styles.classicBody}>
            <span className={tagCls} style={{ color: primary }}>{tag}</span>
            <span className={textCls}>{text}</span>
            {subtitle && <span className={subCls}>{subtitle}</span>}
          </div>
        </>
      )
  }
}
