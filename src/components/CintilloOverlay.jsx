import React from 'react'
import { Eye, X } from 'lucide-react'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import styles from './CintilloOverlay.module.css'

function renderSocialIcon(presetId = '', tag = '') {
  const key = `${presetId} ${tag}`.toLowerCase()
  if (key.includes('youtube') || key.includes('yt')) {
    return (
      <svg viewBox="0 0 28 28" width="34" height="34" fill="none">
        <rect width="28" height="28" rx="8" fill="#FF0000" />
        <path d="M11.5 18V10L18.5 14L11.5 18Z" fill="#FFFFFF" />
      </svg>
    )
  }
  if (key.includes('instagram') || key.includes('ig')) {
    return (
      <svg viewBox="0 0 28 28" width="34" height="34" fill="none">
        <defs>
          <radialGradient id="igCintGrad" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="28" height="28" rx="8" fill="url(#igCintGrad)" />
        <path d="M14 8.75C11.1 8.75 8.75 11.1 8.75 14C8.75 16.9 11.1 19.25 14 19.25C16.9 19.25 19.25 16.9 19.25 14C19.25 11.1 16.9 8.75 14 8.75ZM14 17.38C12.13 17.38 10.62 15.87 10.62 14C10.62 12.13 12.13 10.62 14 10.62C15.87 10.62 17.38 12.13 17.38 14C17.38 15.87 15.87 17.38 14 17.38ZM19.6 9.22C19.6 9.73 19.18 10.15 18.67 10.15C18.16 10.15 17.74 9.73 17.74 9.22C17.74 8.71 18.16 8.29 18.67 8.29C19.18 8.29 19.6 8.71 19.6 9.22ZM21.93 10.74C21.82 9.22 21.47 7.94 20.42 6.89C19.37 5.84 18.09 5.49 16.57 5.38C15.05 5.27 10.62 5.27 9.1 5.38C7.58 5.49 6.3 5.84 5.25 6.89C4.2 7.94 3.85 9.22 3.74 10.74C3.63 12.26 3.63 16.69 3.74 18.21C3.85 19.73 4.2 21.01 5.25 22.06C6.3 23.11 7.58 23.46 9.1 23.57C10.62 23.68 15.05 23.68 16.57 23.57C18.09 23.46 19.37 23.11 20.42 22.06C21.47 21.01 21.82 19.73 21.93 18.21C22.04 16.69 22.04 12.26 21.93 10.74Z" fill="#FFFFFF" />
      </svg>
    )
  }
  if (key.includes('tiktok') || key.includes('tk')) {
    return (
      <svg viewBox="0 0 28 28" width="34" height="34" fill="none">
        <rect width="28" height="28" rx="8" fill="#010101" />
        <path d="M19.25 10.73C17.97 10.73 16.8 10.03 16.22 8.98V16.68C16.22 19.37 14 21.58 11.32 21.58C8.63 21.58 6.42 19.37 6.42 16.68C6.42 14 8.63 11.78 11.32 11.78C11.67 11.78 12.02 11.78 12.37 11.9V14.47C12.02 14.35 11.67 14.23 11.32 14.23C9.92 14.23 8.87 15.28 8.87 16.68C8.87 18.08 9.92 19.13 11.32 19.13C12.72 19.13 13.77 18.08 13.77 16.68V5.25H16.22C16.22 6.77 17.38 8.05 18.9 8.28V10.73H19.25Z" fill="#25F4EE" />
        <path d="M19.48 10.38C18.2 10.38 17.03 9.68 16.45 8.63V16.33C16.45 19.02 14.23 21.23 11.55 21.23C8.87 21.23 6.65 19.02 6.65 16.33C6.65 13.65 8.87 11.43 11.55 11.43C11.9 11.43 12.25 11.43 12.6 11.55V14.12C12.25 14 11.9 13.88 11.55 13.88C10.15 13.88 9.1 14.93 9.1 16.33C9.1 17.73 10.15 18.78 11.55 18.78C12.95 18.78 14 17.73 14 16.33V4.9H16.45C16.45 6.42 17.62 7.7 19.13 7.93V10.38H19.48Z" fill="#FE2C55" />
        <path d="M19.37 10.5C18.08 10.5 16.92 9.8 16.33 8.75V16.45C16.33 19.13 14.12 21.35 11.43 21.35C8.75 21.35 6.53 19.13 6.53 16.45C6.53 13.77 8.75 11.55 11.43 11.55C11.78 11.55 12.13 11.55 12.48 11.67V14.23C12.13 14.12 11.78 14 11.43 14C10.03 14 8.98 15.05 8.98 16.45C8.98 17.85 10.03 18.9 11.43 18.9C12.83 18.9 13.88 17.85 13.88 16.45V5.02H16.33C16.33 6.53 17.5 7.82 19.02 8.05V10.5H19.37Z" fill="#FFFFFF" />
      </svg>
    )
  }
  if (key.includes('facebook') || key.includes('fb')) {
    return (
      <svg viewBox="0 0 28 28" width="34" height="34" fill="none">
        <circle cx="14" cy="14" r="14" fill="#1877F2" />
        <path d="M17.97 15.63L18.44 12.25H15.17V10.03C15.17 9.1 15.63 8.17 17.03 8.17H18.55V5.25C18.55 5.25 17.15 5.02 15.87 5.02C13.18 5.02 11.43 6.65 11.43 9.57V12.25H8.52V15.63H11.43V23.8C12.02 23.92 12.6 23.92 13.3 23.92C14 23.92 14.58 23.92 15.17 23.8V15.63H17.97Z" fill="#FFFFFF" />
      </svg>
    )
  }
  return null
}

export default function CintilloOverlay({
  styleId = 'glass',
  tag = 'TEMA',
  text = '',
  subtitle = '',
  accentColor,
  imageUrl,
  logoUrl,
  presetId = null,
  socials = null,
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
      {totalViewers > 0 && <span className={styles.viewers}><Eye size={12} style={{ marginRight: 4 }} /> {totalViewers.toLocaleString()}</span>}
      {onClose && (
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar cintillo">
          <X size={14} />
        </button>
      )}
    </div>
  ) : null

  const p1 = styles.animPart1
  const tagCls = `${styles.tag} ${styles.animPart2}`
  const textCls = `${styles.mainText} ${styles.animPart3}`
  const subCls = `${styles.subText} ${styles.animPart4}`

  const socialSvg = renderSocialIcon(presetId, tag)
  const effectiveLogo = socialSvg ? null : (logoUrl || imageUrl || null)

  const logoElement = (socialSvg || effectiveLogo) ? (
    <div className={`${styles.cintLogoBox} ${styles.logo3dFloat} ${p1}`}>
      {socialSvg ? (
        socialSvg
      ) : (
        <img src={effectiveLogo} alt="Logo" className={styles.cintLogoImg} />
      )}
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
