import React from 'react'
import styles from './PublishPanel.module.css'
import { fetchYouTubeStatus, getYouTubeAuthUrl } from '../lib/integrations.js'

const NETWORKS = [
  { id: 'facebook', label: 'Facebook', format: '16:9 · 9:16', icon: 'ti-brand-facebook', color: '#1877f2', desc: 'Facebook Live · Watch · Reels' },
  { id: 'youtube', label: 'YouTube', format: '16:9', icon: 'ti-brand-youtube', color: '#ef4444', desc: 'YouTube Live · Canal · Full HD' },
  { id: 'tiktok', label: 'TikTok', format: '9:16', icon: 'ti-brand-tiktok', color: '#00f2fe', desc: 'TikTok Live · Vertical Reels' },
  { id: 'instagram', label: 'Instagram', format: '9:16 · 1:1', icon: 'ti-brand-instagram', color: '#e1306c', desc: 'Reels & Feed' },
]

export default function PublishPanel({
  onOpenPosts,
  onOpenPackRedes,
  onOpenLiveStream,
  hasRecordings,
  youtubeConnected,
  onYouTubeConnect,
}) {
  return (
    <div className={styles.panel}>
      <p className={styles.lead}>
        Genera el formato ideal para cada red social, descárgalo o transmite en vivo directamente a Facebook, YouTube y TikTok.
      </p>

      {/* BOTONES DIRECTOS DESTACADOS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0' }}>
        {onOpenLiveStream && (
          <button
            type="button"
            className={styles.liveBtnDirect}
            onClick={onOpenLiveStream}
          >
            <i className="ti ti-broadcast" style={{ fontSize: 13 }} />
            <span>Transmitir En Vivo (Facebook Live, YouTube, TikTok)</span>
          </button>
        )}

        {onOpenPackRedes && (
          <button
            type="button"
            className={styles.packBtnDirect}
            onClick={onOpenPackRedes}
            disabled={!hasRecordings}
            title={hasRecordings ? 'Generar y descargar en 16:9, 9:16 y 1:1' : 'Graba un video primero'}
          >
            <i className="ti ti-package" style={{ fontSize: 13 }} />
            <span>Descargar Pack Redes (16:9, 9:16, 1:1)</span>
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>
        Formatos optimizados por plataforma:
      </div>

      <div className={styles.networksList}>
        {NETWORKS.map(n => (
          <div key={n.id} className={styles.netCard} style={{ borderColor: `${n.color}35` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`ti ${n.icon}`} style={{ color: n.color, fontSize: 15 }} />
              <strong style={{ fontSize: 11, color: '#fff' }}>{n.label}</strong>
              <span className={styles.netFormatBadge}>{n.format}</span>
            </div>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{n.desc}</span>
          </div>
        ))}
      </div>

      {onOpenPosts && (
        <button type="button" className={styles.postsBtn} onClick={onOpenPosts}>
          <i className="ti ti-sparkles" /> Generar copys y hashtags con IA
        </button>
      )}

      {hasRecordings && (
        <p className={styles.hint}>
          <i className="ti ti-check" /> Tienes grabaciones listas para exportar en múltiples formatos.
        </p>
      )}

      {onYouTubeConnect && (
        <div className={styles.youtubeRow}>
          <div>
            <strong><i className="ti ti-brand-youtube" style={{ color: '#ef4444' }} /> YouTube Direct Upload</strong>
            <p>{youtubeConnected ? 'Canal conectado — listo para subir videos' : 'Conecta tu cuenta para publicar directamente'}</p>
          </div>
          {!youtubeConnected && (
            <button type="button" className={styles.ytBtn} onClick={onYouTubeConnect}>
              Conectar
            </button>
          )}
          {youtubeConnected && <span className={styles.ytOk}><i className="ti ti-check" /></span>}
        </div>
      )}
    </div>
  )
}

export async function connectYouTubeChannel() {
  const url = await getYouTubeAuthUrl()
  window.location.href = url
}

export { fetchYouTubeStatus }
