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

  const isSocials = tag === 'REDES' || tag.includes('RED') || presetId === 'social' || Boolean(socials)

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

  // Badges oficiales de redes sociales (YouTube, Spotify, Apple Podcasts, Instagram, TikTok, Facebook)
  const socialBadges = isSocials ? (
    <div className={styles.socialBadgesRow}>
      <div className={`${styles.socialBadgeItem} ${styles.badgeYoutube}`} title="YouTube">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <path d="M10 15.5V8.5L16 12L10 15.5Z" fill="#FFFFFF" />
        </svg>
        <span>YouTube</span>
      </div>
      <div className={`${styles.socialBadgeItem} ${styles.badgeSpotify}`} title="Spotify">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle cx="12" cy="12" r="12" fill="#1ED760" />
          <path d="M17.5 15.2C17.2 15.6 16.7 15.7 16.3 15.4C13.8 13.9 10.7 13.5 6.7 14.4C6.2 14.5 5.8 14.2 5.7 13.8C5.6 13.3 5.9 12.9 6.3 12.8C10.7 11.8 14.2 12.3 17 14C17.4 14.2 17.6 14.7 17.5 15.2ZM18.8 12.6C18.4 13.1 17.8 13.2 17.3 12.9C14.4 11.1 10.1 10.6 6.5 11.7C6 11.9 5.4 11.5 5.2 11C5.1 10.5 5.5 9.9 6 9.7C10.2 8.5 15 9.1 18.3 11.1C18.8 11.4 18.9 12.1 18.8 12.6ZM19 9.8C15.6 7.8 9.9 7.6 6.2 8.7C5.6 8.9 5 8.5 4.8 7.9C4.6 7.3 5 6.7 5.6 6.5C9.9 5.2 16.2 5.4 20.1 7.8C20.6 8.1 20.8 8.7 20.5 9.3C20.2 9.8 19.5 10 19 9.8Z" fill="#000000" />
        </svg>
        <span>Spotify</span>
      </div>
      <div className={`${styles.socialBadgeItem} ${styles.badgeApple}`} title="Apple Podcasts">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <rect width="24" height="24" rx="6" fill="#8727FF" />
          <path d="M12 6C8.69 6 6 8.69 6 12C6 13.62 6.64 15.09 7.69 16.18L8.76 15.11C7.99 14.32 7.5 13.22 7.5 12C7.5 9.51 9.51 7.5 12 7.5C14.49 7.5 16.5 9.51 16.5 12C16.5 13.22 16.01 14.32 15.24 15.11L16.31 16.18C17.36 15.09 18 13.62 18 12C18 8.69 15.31 6 12 6ZM12 9C10.34 9 9 10.34 9 12C9 12.92 9.42 13.75 10.07 14.29L10.74 13.62C10.29 13.24 10 12.65 10 12C10 10.9 10.9 10 12 10C13.1 10 14 10.9 14 12C14 12.65 13.71 13.24 13.26 13.62L13.93 14.29C14.58 13.75 15 12.92 15 12C15 10.34 13.66 9 12 9ZM12 13C11.45 13 11 13.45 11 14V17C11 17.55 11.45 18 12 18C12.55 18 13 17.55 13 17V14C13 13.45 12.55 13 12 13Z" fill="#FFFFFF" />
        </svg>
        <span>Apple</span>
      </div>
      <div className={`${styles.socialBadgeItem} ${styles.badgeInstagram}`} title="Instagram">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <defs>
            <radialGradient id="igGradCint" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#igGradCint)" />
          <path d="M12 7.5C9.51 7.5 7.5 9.51 7.5 12C7.5 14.49 9.51 16.5 12 16.5C14.49 16.5 16.5 14.49 16.5 12C16.5 9.51 14.49 7.5 12 7.5ZM12 14.9C10.4 14.9 9.1 13.6 9.1 12C9.1 10.4 10.4 9.1 12 9.1C13.6 9.1 14.9 10.4 14.9 12C14.9 13.6 13.6 14.9 12 14.9ZM16.8 7.9C16.8 8.34 16.44 8.7 16 8.7C15.56 8.7 15.2 8.34 15.2 7.9C15.2 7.46 15.56 7.1 16 7.1C16.44 7.1 16.8 7.46 16.8 7.9ZM18.8 9.2C18.7 7.9 18.4 6.8 17.5 5.9C16.6 5 15.5 4.7 14.2 4.6C12.9 4.5 9.1 4.5 7.8 4.6C6.5 4.7 5.4 5 4.5 5.9C3.6 6.8 3.3 7.9 3.2 9.2C3.1 10.5 3.1 14.3 3.2 15.6C3.3 16.9 3.6 18 4.5 18.9C5.4 19.8 6.5 20.1 7.8 20.2C9.1 20.3 12.9 20.3 14.2 20.2C15.5 20.1 16.6 19.8 17.5 18.9C18.4 18 18.7 16.9 18.8 15.6C18.9 14.3 18.9 10.5 18.8 9.2ZM17.1 17.1C16.8 17.8 16.3 18.3 15.6 18.6C14.6 19 12.1 19 12 19C11.9 19 9.4 19 8.4 18.6C7.7 18.3 7.2 17.8 6.9 17.1C6.5 16.1 6.5 13.6 6.5 12C6.5 10.4 6.5 7.9 6.9 6.9C7.2 6.2 7.7 5.7 8.4 5.4C9.4 5 11.9 5 12 5C12.1 5 14.6 5 15.6 5.4C16.3 5.7 16.8 6.2 17.1 6.9C17.5 7.9 17.5 10.4 17.5 12C17.5 13.6 17.5 16.1 17.1 17.1Z" fill="#FFFFFF" />
        </svg>
        <span>Instagram</span>
      </div>
      <div className={`${styles.socialBadgeItem} ${styles.badgeTiktok}`} title="TikTok">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <rect width="24" height="24" rx="6" fill="#010101" />
          <path d="M16.5 9.2C15.4 9.2 14.4 8.6 13.9 7.7V14.3C13.9 16.6 12 18.5 9.7 18.5C7.4 18.5 5.5 16.6 5.5 14.3C5.5 12 7.4 10.1 9.7 10.1C10 10.1 10.3 10.1 10.6 10.2V12.4C10.3 12.3 10 12.2 9.7 12.2C8.5 12.2 7.6 13.1 7.6 14.3C7.6 15.5 8.5 16.4 9.7 16.4C10.9 16.4 11.8 15.5 11.8 14.3V4.5H13.9C13.9 5.8 14.9 6.9 16.2 7.1V9.2H16.5Z" fill="#25F4EE" />
          <path d="M16.7 8.9C15.6 8.9 14.6 8.3 14.1 7.4V14C14.1 16.3 12.2 18.2 9.9 18.2C7.6 18.2 5.7 16.3 5.7 14C5.7 11.7 7.6 9.8 9.9 9.8C10.2 9.8 10.5 9.8 10.8 9.9V12.1C10.5 12 10.2 11.9 9.9 11.9C8.7 11.9 7.8 12.8 7.8 14C7.8 15.2 8.7 16.1 9.9 16.1C11.1 16.1 12 15.2 12 14V4.2H14.1C14.1 5.5 15.1 6.6 16.4 6.8V8.9H16.7Z" fill="#FE2C55" />
          <path d="M16.6 9C15.5 9 14.5 8.4 14 7.5V14.1C14 16.4 12.1 18.3 9.8 18.3C7.5 18.3 5.6 16.4 5.6 14.1C5.6 11.8 7.5 9.9 9.8 9.9C10.1 9.9 10.4 9.9 10.7 10V12.2C10.4 12.1 10.1 12 9.8 12C8.6 12 7.7 12.9 7.7 14.1C7.7 15.3 8.6 16.2 9.8 16.2C11 16.2 11.9 15.3 11.9 14.1V4.3H14C14 5.6 15 6.7 16.3 6.9V9H16.6Z" fill="#FFFFFF" />
        </svg>
        <span>TikTok</span>
      </div>
      <div className={`${styles.socialBadgeItem} ${styles.badgeFacebook}`} title="Facebook">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path d="M15.4 13.4L15.8 10.5H13V8.6C13 7.8 13.4 7 14.6 7H15.9V4.5C15.9 4.5 14.7 4.3 13.6 4.3C11.3 4.3 9.8 5.7 9.8 8.2V10.5H7.3V13.4H9.8V20.4C10.3 20.5 10.8 20.5 11.4 20.5C12 20.5 12.5 20.5 13 20.4V13.4H15.4Z" fill="#FFFFFF" />
        </svg>
        <span>Facebook</span>
      </div>
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
          {socialBadges}
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
              {isSocials ? 'BÚSCANOS COMO' : tag}
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
