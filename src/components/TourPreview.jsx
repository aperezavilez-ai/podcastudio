import React, { useEffect, useState } from 'react'
import CintilloOverlay from './CintilloOverlay.jsx'
import styles from './TourPreview.module.css'

const PLATFORMS = [
  { id: 'yt', label: 'YT', color: '#ff0000' },
  { id: 'fb', label: 'FB', color: '#1877f2' },
  { id: 'tk', label: 'TK', color: '#010101' },
  { id: 'ig', label: 'IG', color: '#e1306c' },
]

/** Planos de estudio realistas (Unsplash) — simulan 3 cámaras */
const CAM_SCENES = [
  {
    src: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1280&q=82&auto=format&fit=crop',
    pos: '50% 40%',
    scale: 1.05,
    label: 'Plano general',
  },
  {
    src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1280&q=82&auto=format&fit=crop',
    pos: '55% 35%',
    scale: 1.15,
    label: 'Plano medio',
  },
  {
    src: 'https://images.unsplash.com/photo-1516280440614-37979bbacd81?w=1280&q=82&auto=format&fit=crop',
    pos: '48% 30%',
    scale: 1.2,
    label: 'Plano cerrado',
  },
]

const SIDEBAR = [
  { icon: 'ti-video', active: true },
  { icon: 'ti-files' },
  { icon: 'ti-hash' },
]

function VideoFeed({ sceneIndex, showScanlines = true }) {
  const scene = CAM_SCENES[sceneIndex] || CAM_SCENES[0]
  return (
    <div className={styles.videoFeed}>
      {CAM_SCENES.map((s, i) => (
        <img
          key={s.src}
          src={s.src}
          alt=""
          className={styles.videoImg}
          style={{
            objectPosition: s.pos,
            transform: `scale(${s.scale})`,
            opacity: i === sceneIndex ? 1 : 0,
          }}
          loading="lazy"
        />
      ))}
      {showScanlines && <div className={styles.scanlines} />}
      <div className={styles.vignette} />
    </div>
  )
}

function RightPanel({ stepId }) {
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
      {stepId === 'live' && (
        <>
          <div className={styles.prTitle}>En vivo</div>
          <div className={styles.prItem}><i className="ti ti-broadcast" /> Restream activo</div>
          <div className={styles.liveMiniPills}>
            {PLATFORMS.map(p => (
              <span key={p.id} style={{ background: p.color }}>{p.label}</span>
            ))}
          </div>
        </>
      )}
      {stepId === 'posts' && (
        <>
          <div className={styles.prTitle}>Posts IA</div>
          <div className={styles.prPost}>Instagram · listo</div>
          <div className={styles.prPost}>TikTok · listo</div>
        </>
      )}
      {stepId === 'export' && (
        <>
          <div className={styles.prTitle}>Grabación</div>
          <div className={styles.prItem}><i className="ti ti-circle-filled" style={{ color: 'var(--red)' }} /> HD 1080p</div>
          <div className={styles.prItem}><i className="ti ti-music" /> Música fondo</div>
        </>
      )}
    </div>
  )
}

export default function TourPreview({ stepId }) {
  const [activeCam, setActiveCam] = useState(0)

  useEffect(() => {
    if (stepId !== 'cameras' && stepId !== 'director') return undefined
    const t = setInterval(() => setActiveCam(c => (c + 1) % 3), 2800)
    return () => clearInterval(t)
  }, [stepId])

  const showCamStrip = stepId === 'cameras' || stepId === 'director' || stepId === 'live' || stepId === 'export'
  const showCintillo = stepId === 'cintillos' || stepId === 'live'
  const showDirector = stepId === 'director'
  const showLive = stepId === 'live'
  const showPosts = stepId === 'posts'
  const showExport = stepId === 'export'

  return (
    <div className={styles.app}>
      {/* Topbar como Studio */}
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
        {/* Sidebar izquierdo */}
        <div className={styles.sidebarLeft}>
          {SIDEBAR.map((s, i) => (
            <div key={i} className={`${styles.slBtn} ${s.active ? styles.slBtnActive : ''}`}>
              <i className={`ti ${s.icon}`} />
            </div>
          ))}
        </div>

        {/* Escenario principal */}
        <div className={styles.stageCol}>
          <div className={styles.viewport}>
            <VideoFeed sceneIndex={activeCam} />

            {showLive && (
              <div className={styles.liveInds}>
                {PLATFORMS.map(p => (
                  <span key={p.id} className={styles.liveInd} style={{ background: `${p.color}cc` }}>
                    {p.label} LIVE
                  </span>
                ))}
              </div>
            )}

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

          {/* Tira de cámaras + controles como Studio */}
          {showCamStrip && (
            <div className={styles.bottomBar}>
              <div className={styles.camStrip}>
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
              {showExport && (
                <div className={styles.rcRow}>
                  <span className={`${styles.rcBtn} ${styles.rcRec}`}><i className="ti ti-circle-filled" /> Grabar</span>
                  <span className={`${styles.rcBtn} ${styles.rcLive}`}><i className="ti ti-broadcast" /> Ir en vivo</span>
                </div>
              )}
            </div>
          )}
        </div>

        <RightPanel stepId={stepId} />
      </div>
    </div>
  )
}
