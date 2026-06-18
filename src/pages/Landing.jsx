import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLANS } from '../config/plans.js'
import { PwaInstallNavButton, PwaLandingInstall } from '../components/PwaInstall.jsx'
import TourPreview from '../components/TourPreview.jsx'
import styles from './Landing.module.css'

const FEATURES = [
  { icon: 'ti-video', title: 'Switcher de 3 cámaras', desc: 'Conecta hasta 3 cámaras USB y cambia entre planos con un clic.' },
  { icon: 'ti-download', title: 'Graba y descarga', desc: 'Exporta tu episodio en WebM o MP4 con cintillos y logo incluidos.' },
  { icon: 'ti-palette', title: 'Look Pro', desc: 'Presets de color, viñeta, LUTs y transiciones cinematográficas en la grabación.' },
  { icon: 'ti-sparkles', title: 'Cintillos con IA', desc: 'La IA genera y anima los cintillos de tu episodio automáticamente.' },
  { icon: 'ti-layout-bottombar', title: 'Logo en pantalla', desc: 'Tu logo en la esquina que elijas, siempre visible en la grabación.' },
  { icon: 'ti-music', title: 'Música sin copyright', desc: 'Biblioteca de música libre para usar como fondo de tus episodios.' },
  { icon: 'ti-hash', title: 'Posts e hashtags con IA', desc: 'Genera textos para tus redes y sube el video donde quieras.' },
]

const FORMATS = [
  { label: '16:9', sub: 'YouTube · Facebook', w: 48, h: 27 },
  { label: '9:16', sub: 'TikTok · Reels', w: 20, h: 36 },
  { label: '1:1', sub: 'Instagram Feed', w: 32, h: 32 },
]

export default function Landing() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [activeFormat, setActiveFormat] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    let raf, t = 0
    let W = canvas.offsetWidth || window.innerWidth
    let H = canvas.offsetHeight || window.innerHeight
    canvas.width = W
    canvas.height = H
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.4 + 0.1
    }))
    function draw() {
      ctx.clearRect(0, 0, W, H)
      t++
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232,97,42,${p.a * (0.5 + 0.5 * Math.sin(t * 0.02 + p.x))})`
        ctx.fill()
      })
      particles.forEach((p, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < 80) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(232,97,42,${0.06 * (1 - d / 80)})`
            ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={styles.page}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <div className={styles.navLogo}><i className="ti ti-microphone" /></div>
          <span>Podcast<strong>Studio</strong></span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">Funciones</a>
          <a href="#pricing">Planes</a>
          <button type="button" className={styles.navTourLink} onClick={() => navigate('/tour')}>
            Cómo funciona
          </button>
          <button type="button" className={styles.navTourLink} onClick={() => navigate('/guia')}>
            Manual de uso
          </button>
        </div>
        <div className={styles.navActions}>
          <PwaInstallNavButton />
          <button className={styles.btnGhost} onClick={() => navigate('/auth')}>Iniciar sesión</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/plans')}>Ver planes</button>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <i className="ti ti-sparkles" style={{ fontSize: 11 }} />
          Estudio profesional con inteligencia artificial
        </div>
        <h1 className={styles.heroTitle}>
          Tu estudio de podcast<br />
          <span className={styles.heroAccent}>en cualquier computadora</span>
        </h1>
        <p className={styles.heroSub}>
          Conecta tus cámaras USB, graba con cintillos y logo,<br />
          descarga tu episodio y publícalo en YouTube, TikTok, Instagram o Facebook.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnHero} onClick={() => navigate('/plans')}>
            <i className="ti ti-credit-card" /> Ver planes desde $39/mes
          </button>
          <button className={styles.btnHeroGhost} onClick={() => navigate('/tour')}>
            <i className="ti ti-route" /> Ver cómo funciona
          </button>
        </div>

        <PwaLandingInstall />

        {/* Preview idéntico al estudio real */}
        <div className={styles.studioPreviewWrap}>
          <TourPreview stepId="export" landing />
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features} id="features">
        <div className={styles.sectionLabel}>Funciones</div>
        <h2 className={styles.sectionTitle}>Todo lo que necesita tu podcast</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}><i className={`ti ${f.icon}`} /></div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FORMAT SHOWCASE */}
      <section className={styles.formatSection}>
        <div className={styles.sectionLabel}>Formatos</div>
        <h2 className={styles.sectionTitle}>Graba en el formato de cada plataforma</h2>
        <div className={styles.formatShowcase}>
          <div className={styles.formatPicker}>
            {FORMATS.map((f, i) => (
              <button key={f.label} className={`${styles.fmtBtn} ${activeFormat === i ? styles.fmtActive : ''}`} onClick={() => setActiveFormat(i)}>
                <div className={styles.fmtBox} style={{ width: f.w * 0.6, height: f.h * 0.6 }} />
                <div>
                  <div className={styles.fmtLabel}>{f.label}</div>
                  <div className={styles.fmtSub}>{f.sub}</div>
                </div>
              </button>
            ))}
          </div>
          <div className={styles.formatDemo}>
            <div className={styles.fmtScreen} style={{
              width: FORMATS[activeFormat].w * 5,
              height: FORMATS[activeFormat].h * 5,
              transition: 'all 0.4s cubic-bezier(.4,0,.2,1)'
            }}>
              <div className={styles.fmtScreenInner}>
                <i className="ti ti-video" style={{ fontSize: 28, color: '#333' }} />
              </div>
              <div className={styles.fmtCintBar}>
                <div className={styles.fmtCintAccent} />
                <span className={styles.fmtCintText}>Carlos Pérez</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionLabel}>Planes</div>
        <h2 className={styles.sectionTitle}>Acceso con suscripción — cancela cuando quieras</h2>
        <div className={styles.plansGrid}>
          {PLANS.map(plan => (
            <div key={plan.id} className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ''}`}>
              {plan.badge && <div className={styles.planBadge}>{plan.badge}</div>}
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPrice}>
                <span className={styles.planCurrency}>$</span>
                {plan.price}
                <span className={styles.planPer}>{plan.intervalLabel}</span>
              </div>
              {plan.save && <div className={styles.planSave}>{plan.save}</div>}
              <ul className={styles.planFeatures}>
                {plan.features.map(f => (
                  <li key={f}><i className="ti ti-check" />{f}</li>
                ))}
              </ul>
              <button
                className={`${styles.planBtn} ${plan.featured ? styles.planBtnPrimary : ''}`}
                onClick={() => navigate(`/auth?plan=${plan.id}`)}
              >
                {plan.featured ? `Elegir ${plan.name}` : 'Elegir plan'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <div className={styles.navLogo} style={{ width: 24, height: 24 }}><i className="ti ti-microphone" style={{ fontSize: 12 }} /></div>
          <span>Podcast<strong>Studio</strong></span>
        </div>
        <p className={styles.footerCopy}>© 2026 PodcastStudio. Todos los derechos reservados.</p>
      </footer>
    </div>
  )
}
