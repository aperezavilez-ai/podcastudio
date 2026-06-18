import React, { useEffect, useState } from 'react'
import CintilloOverlay from './CintilloOverlay.jsx'
import styles from './TourPreview.module.css'

/** Planos de estudio realistas — URLs verificadas */
const CAM_SCENES = [
  {
    src: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=1280&q=85&auto=format&fit=crop',
    pos: '50% 20%',
    scale: 1.1,
    label: 'Plano general',
  },
  {
    src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1280&q=85&auto=format&fit=crop',
    pos: '50% 18%',
    scale: 1.12,
    label: 'Plano medio',
  },
  {
    src: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1280&q=85&auto=format&fit=crop',
    pos: '50% 40%',
    scale: 1.05,
    label: 'Plano cerrado',
  },
]

const SIDEBAR = [
  { icon: 'ti-video', active: true },
  { icon: 'ti-files' },
  { icon: 'ti-hash' },
]

const NETWORKS = [
  { label: 'YT', icon: 'ti-brand-youtube', color: '#e05050' },
  { label: 'IG', icon: 'ti-brand-instagram', color: '#d4537e' },
  { label: 'TK', icon: 'ti-brand-tiktok', color: '#ccc' },
  { label: 'FB', icon: 'ti-brand-facebook', color: '#4a90d9' },
]

function VideoFeed({ sceneIndex, showScanlines = true }) {
  const scene = CAM_SCENES[sceneIndex] || CAM_SCENES[0]
  return (
    <div
      className={styles.videoFeed}
      style={{ backgroundImage: `url(${scene.src})`, backgroundPosition: scene.pos, backgroundSize: 'cover' }}
    >
      <img
        src={scene.src}
        alt=""
        className={styles.videoImg}
        style={{ objectPosition: scene.pos, transform: `scale(${scene.scale})` }}
        loading="eager"
        decoding="async"
      />
      {showScanlines && <div className={styles.scanlines} />}
      <div className={styles.vignette} />
    </div>
  )
}

function RightPanel({ stepId }) {
  if (stepId === 'export' || stepId === 'posts' || stepId === 'look') {
    return (
      <div className={styles.panelRight}>
        <div className={styles.panelScroll}>
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Publicar</div>
            <div className={styles.prItem}><i className="ti ti-circle" /> Grabar episodio</div>
            <div className={styles.prItem}><i className="ti ti-download" /> Descargar MP4</div>
            <div className={styles.prItem}><i className="ti ti-sparkles" /> Posts IA</div>
            <div className={styles.prItem}><i className="ti ti-upload" /> Subir a redes</div>
          </div>
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Redes</div>
            <div className={styles.platGrid}>
              {NETWORKS.map(n => (
                <span key={n.label} className={styles.platBtn}>
                  <i className={`ti ${n.icon}`} style={{ color: n.color }} />
                  {n.label}
                </span>
              ))}
            </div>
          </div>
          {stepId === 'posts' && (
            <div className={styles.prSection}>
              <div className={styles.prTitle}>Posts IA</div>
              <div className={styles.prPost}>Instagram · listo</div>
              <div className={styles.prPost}>TikTok · listo</div>
            </div>
          )}
          {stepId === 'look' && (
            <div className={styles.prSection}>
              <div className={styles.prTitle}>Look Pro</div>
              <div className={styles.prItem}><i className="ti ti-palette" /> Estudio cálido</div>
              <div className={styles.prItem}><i className="ti ti-circle" /> Viñeta 32%</div>
              <div className={styles.prItem}><i className="ti ti-switch-horizontal" /> Crossfade</div>
            </div>
          )}
        </div>
        <div className={styles.recControls}>
          <span className={`${styles.rcBtn} ${styles.rcRec}`}><i className="ti ti-circle" /> Grabar</span>
          <span className={styles.rcBtn}><i className="ti ti-download" /> Descargar</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panelRight}>
      {stepId === 'cameras' && (
        <>
          <div className={styles.prTitle}>Cámaras</div>
          <div className={styles.prItem}><i className="ti ti-plug-connected" /> 1 cámara USB</div>
          <div className={styles.prItemMuted}>Cam 2 · Conectar</div>
          <div className={styles.prItemMuted}>Cam 3 · Conectar</div>
        </>
      )}
      {stepId === 'director' && (
        <>
          <div className={styles.prTitle}>Director IA</div>
          <div className={styles.prToggleOn}><span /> AUTO</div>
          <div className={styles.prItem}><i className="ti ti-check" /> Detección de voz</div>
          <div className={styles.prItem}><i className="ti ti-check" /> Cambio de plano</div>
        </>
      )}
      {stepId === 'cintillos' && (
        <>
          <div className={styles.prTitle}>Cintillos</div>
          <div className={styles.prItem}><i className="ti ti-layout-bottombar" /> Invitado</div>
          <div className={styles.prItem}><i className="ti ti-script" /> Teleprompter</div>
        </>
      )}
    </div>
  )
}

export default function TourPreview({ stepId, landing = false }) {
  const [activeCam, setActiveCam] = useState(0)

  useEffect(() => {
    if (!['cameras', 'director', 'export', 'posts', 'look'].includes(stepId)) return undefined
    const t = setInterval(() => setActiveCam(c => (c + 1) % 3), 3200)
    return () => clearInterval(t)
  }, [stepId])

  const showCamStrip = ['cameras', 'director', 'export', 'posts', 'look'].includes(stepId)
  const showCintillo = stepId === 'cintillos' || stepId === 'export' || stepId === 'look'
  const showDirector = stepId === 'director'
  const showPosts = stepId === 'posts'

  return (
    <div className={`${styles.app} ${landing ? styles.appLanding : ''}`}>
      <div className={styles.topbar}>
        <div className={styles.topLeft}>
          <div className={styles.winBtns}>
            <span className={`${styles.wb} ${styles.wbR}`} />
            <span className={`${styles.wb} ${styles.wbY}`} />
            <span className={`${styles.wb} ${styles.wbG}`} />
          </div>
          <span className={styles.brand}>Podcast<span>Studio</span></span>
        </div>
        <div className={styles.topCenter}>
          <span className={styles.projectTag}><i className="ti ti-microphone" /> Mi Podcast · Episodio demo</span>
          {showDirector && (
            <span className={styles.producerChip}><i className="ti ti-wand" /> Director IA · Cam {activeCam + 1}</span>
          )}
        </div>
        <div className={styles.topRight}>
          <span className={styles.aiChip}><i className="ti ti-sparkles" /> IA activa</span>
          <span className={styles.demoPill}><span className={styles.demoDot} /> DEMO</span>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebarLeft}>
          {SIDEBAR.map((s, i) => (
            <div key={i} className={`${styles.slBtn} ${s.active ? styles.slBtnActive : ''}`}>
              <i className={`ti ${s.icon}`} />
            </div>
          ))}
        </div>

        <div className={styles.stageCol}>
          <div className={styles.viewport}>
            <VideoFeed sceneIndex={activeCam} />

            <div className={styles.logoOverlay}>
              <div className={styles.logoIcon}><i className="ti ti-microphone" /></div>
              <span className={styles.logoText}>Mi Podcast</span>
            </div>

            {showDirector && (
              <div className={styles.faceBox} style={{ left: `${32 + activeCam * 8}%`, top: '22%' }} />
            )}

            {stepId === 'cintillos' && (
              <div className={styles.teleprompter}>
                Bienvenidos al episodio de hoy. Hoy hablaremos de podcasting profesional y cómo la IA acelera tu producción...
              </div>
            )}

            {showCintillo && (
              <div className={styles.cintilloWrap}>
                <CintilloOverlay
                  styleId="angled"
                  tag="INVITADO"
                  text="María López · Experta en medios"
                  position="bl"
                  preview
                />
              </div>
            )}

            {showPosts && (
              <div className={styles.postsOverlay}>
                <div className={styles.postCard}>
                  <strong>Instagram</strong>
                  🎙️ Nuevo episodio. 3 claves sobre podcasting con IA. #podcast
                </div>
                <div className={styles.postCard}>
                  <strong>TikTok</strong>
                  POV: grabas con 3 cámaras sin equipo enorme 👇
                </div>
              </div>
            )}

            {stepId === 'cintillos' && (
              <div className={styles.subtitlePill}>En espera de voz…</div>
            )}
          </div>

          {showCamStrip && (
            <div className={styles.bottomBar}>
              <div className={styles.camStrip}>
                <div className={styles.camStripLeft}>
                  {CAM_SCENES.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.thumb} ${activeCam === i ? styles.thumbActive : ''}`}
                      onClick={() => setActiveCam(i)}
                    >
                      <img src={s.src} alt="" style={{ objectPosition: s.pos }} />
                      <span>{activeCam === i && <span className={styles.camDot} />} Cam {i + 1}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.switcherControls}>
                  <i className="ti ti-switch-horizontal" />
                  <span className={styles.switchLabel}>Director IA</span>
                  <span className={styles.switchIntervalVal}>8s</span>
                </div>
                <div className={styles.fmtSelector}>
                  {[{ f: '16:9', w: 14, h: 8 }, { f: '9:16', w: 7, h: 12 }, { f: '1:1', w: 10, h: 10 }].map(({ f, w, h }, i) => (
                    <div key={f} className={`${styles.fmtOpt} ${i === 0 ? styles.fmtActive : ''}`}>
                      <div style={{ width: w, height: h, border: `1px solid ${i === 0 ? 'var(--purple)' : 'var(--border-3)'}`, borderRadius: 2 }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <RightPanel stepId={stepId} />
      </div>
    </div>
  )
}
