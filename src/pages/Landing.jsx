import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLANS } from '../config/plans.js'
import { PwaInstallNavButton } from '../components/PwaInstall.jsx'
import styles from './Landing.module.css'

const FEATURES = [
  { icon: 'ti-video', title: 'Switcher de 3 cámaras', desc: 'Conecta hasta 3 cámaras USB y cambia entre ellas en vivo con un clic.' },
  { icon: 'ti-broadcast', title: 'En vivo a 4 plataformas', desc: 'Transmite simultáneamente a YouTube, Facebook, TikTok e Instagram.' },
  { icon: 'ti-sparkles', title: 'Cintillos con IA', desc: 'La IA genera y anima los cintillos de tu episodio automáticamente.' },
  { icon: 'ti-layout-bottombar', title: 'Logo en pantalla', desc: 'Tu logo en la esquina que elijas, siempre visible en transmisión.' },
  { icon: 'ti-music', title: 'Música sin copyright', desc: 'Biblioteca de música libre para usar como fondo de tus episodios.' },
  { icon: 'ti-hash', title: 'Posts e hashtags con IA', desc: 'Genera posts virales para todas tus redes con un clic post-episodio.' },
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
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, t = 0
    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight
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
        </div>
        <div className={styles.navActions}>
          <PwaInstallNavButton />
          <button className={styles.btnGhost} onClick={() => navigate('/auth')}>Iniciar sesión</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/auth')}>Comenzar gratis</button>
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
          Conecta tus cámaras USB, transmite en vivo a YouTube, TikTok y Facebook,<br />
          agrega cintillos con IA y publica tus posts automáticamente.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnHero} onClick={() => navigate('/auth')}>
            <i className="ti ti-player-play" /> Crear estudio gratis
          </button>
          <button className={styles.btnHeroGhost}>
            <i className="ti ti-video" /> Ver demo
          </button>
        </div>

        {/* MINI STUDIO PREVIEW */}
        <div className={styles.studioPreview}>
          <div className={styles.spTopbar}>
            <div className={styles.winBtns}>
              <div className={`${styles.wb} ${styles.wbR}`} />
              <div className={`${styles.wb} ${styles.wbY}`} />
              <div className={`${styles.wb} ${styles.wbG}`} />
            </div>
            <div className={styles.spBrand}>Podcast<span>Studio</span></div>
            <div className={styles.spRec}><div className={styles.recDot} />REC 00:42:17</div>
          </div>
          <div className={styles.spBody}>
            <div className={styles.spViewport}>
              <div className={styles.spPerson} style={{ left: '20%' }}>
                <div className={styles.spHead} />
                <div className={styles.spBody2} />
              </div>
              <div className={styles.spPerson} style={{ left: '52%' }}>
                <div className={styles.spHead} style={{ width: 50, height: 50 }} />
                <div className={styles.spBody2} style={{ width: 100 }} />
              </div>
              <div className={styles.spLogo}>
                <div className={styles.spLogoIcon}><i className="ti ti-microphone" style={{ fontSize: 10, color: '#fff' }} /></div>
                <span>Mi Podcast</span>
              </div>
              <div className={styles.spLiveInds}>
                <span className={styles.spLivePill} style={{ background: '#1565a0' }}>YT</span>
                <span className={styles.spLivePill} style={{ background: '#9b1c1c' }}>FB</span>
                <span className={styles.spLivePill} style={{ background: '#222' }}>TK</span>
              </div>
              <div className={styles.spCintillo}>
                <div className={styles.spCintAccent} />
                <div>
                  <div className={styles.spCintLabel}>Invitado</div>
                  <div className={styles.spCintName}>Carlos Pérez · CEO TechCo</div>
                </div>
                <div className={styles.spViewers}><i className="ti ti-eye" style={{ fontSize: 9 }} /> 1,248</div>
              </div>
            </div>
            <div className={styles.spCamStrip}>
              {[1, 2, 3].map(n => (
                <div key={n} className={`${styles.spCamThumb} ${n === 1 ? styles.spCamActive : ''}`}>
                  <i className="ti ti-video" style={{ fontSize: 12, color: '#444' }} />
                  <span>Cam {n}</span>
                </div>
              ))}
            </div>
          </div>
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
        <h2 className={styles.sectionTitle}>Sin contratos, cancela cuando quieras</h2>
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
                {plan.featured ? `Comenzar ${plan.name}` : 'Comenzar'}
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
