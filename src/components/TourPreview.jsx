import React, { useEffect, useState } from 'react'
import styles from './TourPreview.module.css'

const PLATFORMS = [
  { id: 'yt', label: 'YT', color: '#ff0000' },
  { id: 'fb', label: 'FB', color: '#1877f2' },
  { id: 'tk', label: 'TK', color: '#010101' },
  { id: 'ig', label: 'IG', color: '#e1306c' },
]

export default function TourPreview({ stepId }) {
  const [activeCam, setActiveCam] = useState(0)

  useEffect(() => {
    if (stepId !== 'cameras' && stepId !== 'director') return undefined
    const t = setInterval(() => setActiveCam(c => (c + 1) % 3), 2200)
    return () => clearInterval(t)
  }, [stepId])

  return (
    <div className={styles.frame}>
      <div className={styles.topbar}>
        <span>PodcastStudio · Vista previa</span>
        <span className={styles.rec}><span className={styles.recDot} /> DEMO</span>
      </div>

      <div className={styles.stage}>
        {stepId === 'cameras' && (
          <>
            <div className={styles.person} style={{ opacity: activeCam === 0 ? 1 : 0.35, transform: activeCam === 0 ? 'scale(1)' : 'scale(0.92)' }}>
              <div className={styles.head} /><div className={styles.body} />
            </div>
          </>
        )}

        {stepId === 'director' && (
          <>
            <div className={styles.faceBox} style={{ width: 48, height: 56, top: '28%', left: '38%' }} />
            <div className={styles.directorBadge}>
              <i className="ti ti-wand" /> Director IA · Cam {activeCam + 1}
            </div>
            <div className={styles.person}>
              <div className={styles.head} /><div className={styles.body} />
            </div>
          </>
        )}

        {(stepId === 'cintillos') && (
          <>
            <div className={styles.teleprompter}>
              Bienvenidos al episodio de hoy. Hoy hablaremos de las tendencias en podcasting y cómo la IA está cambiando la producción...
            </div>
            <div className={styles.cintillo}>
              <div className={styles.cintAccent} />
              <div>
                <div className={styles.cintTag}>Invitado</div>
                <div className={styles.cintText}>María López · Experta en medios</div>
              </div>
            </div>
          </>
        )}

        {stepId === 'live' && (
          <>
            <div className={styles.livePills}>
              {PLATFORMS.map(p => (
                <span key={p.id} className={styles.livePill} style={{ background: p.color }}>{p.label} LIVE</span>
              ))}
            </div>
            <div className={styles.person}>
              <div className={styles.head} /><div className={styles.body} />
            </div>
            <div className={styles.cintillo}>
              <div className={styles.cintAccent} />
              <div className={styles.cintText}>Transmitiendo en 4 plataformas</div>
            </div>
          </>
        )}

        {stepId === 'posts' && (
          <div className={styles.posts}>
            <div className={styles.postCard}>
              <strong>Instagram</strong>
              🎙️ Nuevo episodio disponible. 3 claves que aprendimos hoy sobre podcasting con IA. #podcast #creadores
            </div>
            <div className={styles.postCard}>
              <strong>TikTok</strong>
              POV: grabas tu podcast con 3 cámaras sin un equipo enorme. Link en bio 👇
            </div>
          </div>
        )}

        {stepId === 'export' && (
          <div className={styles.exportRow}>
            <div className={styles.badge4k}>4K</div>
            <div className={styles.exportBtns}>
              <span className={`${styles.exportBtn} ${styles.exportBtnPrimary}`}>
                <i className="ti ti-circle-filled" /> Grabar
              </span>
              <span className={styles.exportBtn}><i className="ti ti-download" /> MP4</span>
              <span className={styles.exportBtn}><i className="ti ti-music" /> Música</span>
            </div>
          </div>
        )}
      </div>

      {(stepId === 'cameras' || stepId === 'director') && (
        <div className={styles.camStrip}>
          {[0, 1, 2].map(i => (
            <div key={i} className={`${styles.thumb} ${activeCam === i ? styles.thumbActive : ''}`}>
              Cam {i + 1}
            </div>
          ))}
        </div>
      )}

      {stepId === 'cintillos' && (
        <div className={styles.camStrip}>
          <div className={`${styles.thumb} ${styles.thumbActive}`} style={{ flex: 1 }}>Teleprompter activo</div>
        </div>
      )}

      {(stepId === 'live' || stepId === 'posts' || stepId === 'export') && (
        <div className={styles.camStrip}>
          <div className={styles.thumb} style={{ flex: 1, fontSize: 9 }}>Solo demostración — sin efecto real</div>
        </div>
      )}
    </div>
  )
}
