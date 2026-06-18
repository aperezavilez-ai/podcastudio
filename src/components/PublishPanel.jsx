import React from 'react'
import styles from './PublishPanel.module.css'
import { fetchYouTubeStatus, getYouTubeAuthUrl } from '../lib/integrations.js'

const NETWORKS = [
  { id: 'youtube', label: 'YouTube', icon: 'ti-brand-youtube', color: '#e05050' },
  { id: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram', color: '#d4537e' },
  { id: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok', color: '#ccc' },
  { id: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook', color: '#4a90d9' },
]

export default function PublishPanel({ onOpenPosts, hasRecordings, youtubeConnected, onYouTubeConnect }) {
  return (
    <div className={styles.panel}>
      <p className={styles.lead}>
        Graba tu episodio, descárgalo y súbelo a tus redes. No necesitas Restream ni OBS.
      </p>

      <ol className={styles.steps}>
        <li><i className="ti ti-circle" /> Pulsa <strong>Grabar</strong> en el estudio</li>
        <li><i className="ti ti-download" /> Descarga en <strong>WebM</strong> o <strong>MP4</strong></li>
        <li><i className="ti ti-sparkles" /> Genera textos con <strong>Posts IA</strong></li>
        <li><i className="ti ti-upload" /> Sube el video en cada red</li>
      </ol>

      <div className={styles.networks}>
        {NETWORKS.map(n => (
          <span key={n.id} className={styles.netChip} style={{ borderColor: `${n.color}40`, color: n.color }}>
            <i className={`ti ${n.icon}`} />
            {n.label}
          </span>
        ))}
      </div>

      {onOpenPosts && (
        <button type="button" className={styles.postsBtn} onClick={onOpenPosts}>
          <i className="ti ti-sparkles" /> Generar posts para redes
        </button>
      )}

      {hasRecordings && (
        <p className={styles.hint}>
          <i className="ti ti-check" /> Tienes grabaciones listas. Ve a la pestaña Grabaciones para descargar.
        </p>
      )}

      {onYouTubeConnect && (
        <div className={styles.youtubeRow}>
          <div>
            <strong><i className="ti ti-brand-youtube" /> YouTube (opcional)</strong>
            <p>{youtubeConnected ? 'Canal conectado — puedes publicar desde Grabaciones' : 'Conecta tu canal para subir el video automáticamente'}</p>
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
