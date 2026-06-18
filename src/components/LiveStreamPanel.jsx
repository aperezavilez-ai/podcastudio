import React, { useEffect, useState } from 'react'
import styles from './LiveStreamPanel.module.css'
import {
  fetchIntegrationStatus,
  fetchRestreamStatus,
  fetchYouTubeStatus,
  getYouTubeAuthUrl,
} from '../lib/integrations.js'

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: 'ti-brand-youtube', color: '#e05050' },
  { id: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook', color: '#4a90d9' },
  { id: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok', color: '#ccc' },
  { id: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram', color: '#d4537e' },
]

export default function LiveStreamPanel({
  liveOn,
  liveStatus,
  liveError,
  activePlats,
  onTogglePlat,
  onGoLive,
  onStopLive,
}) {
  const [integrations, setIntegrations] = useState(null)
  const [restream, setRestream] = useState(null)
  const [youtube, setYoutube] = useState(null)
  const [ytLoading, setYtLoading] = useState(false)

  useEffect(() => {
    fetchIntegrationStatus().then(setIntegrations)
    fetchRestreamStatus().then(setRestream).catch(() => null)
    fetchYouTubeStatus().then(setYoutube).catch(() => null)
  }, [])

  const connectYouTube = async () => {
    setYtLoading(true)
    try {
      const url = await getYouTubeAuthUrl()
      window.location.href = url
    } catch (e) {
      alert(e.message)
      setYtLoading(false)
    }
  }

  const canLiveWithoutObs = integrations?.liveWithoutObs
  const restreamReady = restream?.configured && restream?.ingest?.hasStreamKey

  return (
    <div className={styles.panel}>
      {integrations && (
        <div className={styles.integrationBar}>
          <span className={integrations.restream ? styles.dotOn : styles.dotOff} title="Restream" />
          <span className={integrations.livepeer ? styles.dotOn : styles.dotOff} title="Livepeer" />
          <span className={integrations.youtube ? styles.dotOn : styles.dotOff} title="YouTube API" />
          <span className={styles.integrationLabel}>
            {canLiveWithoutObs ? 'En vivo sin OBS' : 'Configura Restream + Livepeer'}
          </span>
        </div>
      )}

      <div className={styles.platGrid}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            className={`${styles.platBtn} ${activePlats.includes(p.id) ? styles.platActive : ''}`}
            style={activePlats.includes(p.id) ? { borderColor: p.color + '60', color: p.color } : {}}
            onClick={() => onTogglePlat(p.id)}
          >
            <i className={`ti ${p.icon}`} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {restreamReady && restream.channels?.length > 0 && (
        <div className={styles.channelList}>
          <span className={styles.channelTitle}>Canales Restream conectados</span>
          {restream.channels.slice(0, 6).map(ch => (
            <span key={ch.id || ch.platform} className={styles.channelChip}>
              {ch.name || ch.platform}
            </span>
          ))}
        </div>
      )}

      <div className={styles.youtubeRow}>
        <div>
          <strong><i className="ti ti-brand-youtube" /> YouTube VOD</strong>
          <p>{youtube?.connected ? `Conectado: ${youtube.channelTitle}` : 'Conecta para publicar grabaciones automáticamente'}</p>
        </div>
        {!youtube?.connected && integrations?.youtube && (
          <button type="button" className={styles.ytBtn} onClick={connectYouTube} disabled={ytLoading}>
            {ytLoading ? '...' : 'Conectar'}
          </button>
        )}
        {youtube?.connected && <span className={styles.ytOk}><i className="ti ti-check" /></span>}
      </div>

      {liveError && (
        <div className={styles.liveError}><i className="ti ti-alert-circle" /> {liveError}</div>
      )}

      {liveStatus && liveOn && (
        <div className={styles.liveStatus}><i className="ti ti-broadcast" /> {liveStatus}</div>
      )}

      <div className={styles.actions}>
        {!liveOn ? (
          <button
            type="button"
            className={styles.goLiveBtn}
            onClick={onGoLive}
            disabled={activePlats.length === 0}
          >
            <i className="ti ti-broadcast" />
            {canLiveWithoutObs ? 'Ir en vivo (sin OBS)' : 'Ir en vivo (demo)'}
          </button>
        ) : (
          <button type="button" className={styles.stopBtn} onClick={onStopLive}>
            <i className="ti ti-player-stop" /> Detener transmisión
          </button>
        )}
      </div>

      {!canLiveWithoutObs && (
        <div className={styles.obsHelp}>
          <strong><i className="ti ti-info-circle" /> Transmisión real sin OBS</strong>
          <p>Añade en Vercel: <code>RESTREAM_API_TOKEN</code> y <code>LIVEPEER_API_KEY</code>. Restream multistreama a YouTube, Facebook, TikTok e Instagram.</p>
        </div>
      )}

      {liveOn && canLiveWithoutObs && (
        <div className={styles.obsHelp}>
          <strong><i className="ti ti-check" /> Transmitiendo</strong>
          <p>Tu señal sale por WebRTC → Livepeer → Restream → redes seleccionadas. No necesitas OBS.</p>
        </div>
      )}
    </div>
  )
}
