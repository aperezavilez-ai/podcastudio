import React, { useState, useEffect } from 'react'
import styles from './LiveStreamPanel.module.css'

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: 'ti-brand-youtube', color: '#e05050', rtmpHint: 'rtmp://a.rtmp.youtube.com/live2' },
  { id: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook', color: '#4a90d9', rtmpHint: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  { id: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok', color: '#ccc', rtmpHint: 'rtmp://push.tiktok.com/live/' },
  { id: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram', color: '#d4537e', rtmpHint: 'rtmps://live-upload.instagram.com:443/rtmp/' },
]

const STORAGE_KEY = 'podcastudio_rtmp_keys'

function loadKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function LiveStreamPanel({ liveOn, activePlats, onTogglePlat, onGoLive, onStopLive }) {
  const [keys, setKeys] = useState(loadKeys)
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  }, [keys])

  const updateKey = (plat, field, value) => {
    setKeys(k => ({ ...k, [plat]: { ...k[plat], [field]: value } }))
  }

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const hasAnyKey = PLATFORMS.some(p => keys[p.id]?.streamKey)

  return (
    <div className={styles.panel}>
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

      <button type="button" className={styles.configToggle} onClick={() => setExpanded(e => e ? null : 'keys')}>
        <i className="ti ti-key" />
        Claves de transmisión (RTMP)
        <i className={`ti ti-chevron-${expanded ? 'up' : 'down'}`} />
      </button>

      {expanded && PLATFORMS.map(p => (
        <div key={p.id} className={styles.keyBlock}>
          <div className={styles.keyTitle} style={{ color: p.color }}>
            <i className={`ti ${p.icon}`} /> {p.label}
          </div>
          <label className={styles.keyLabel}>URL del servidor</label>
          <div className={styles.keyRow}>
            <input
              value={keys[p.id]?.serverUrl || p.rtmpHint}
              onChange={e => updateKey(p.id, 'serverUrl', e.target.value)}
              placeholder={p.rtmpHint}
            />
            <button type="button" onClick={() => copyText(keys[p.id]?.serverUrl || p.rtmpHint, `${p.id}-url`)}>
              <i className={`ti ${copied === `${p.id}-url` ? 'ti-check' : 'ti-copy'}`} />
            </button>
          </div>
          <label className={styles.keyLabel}>Stream key</label>
          <div className={styles.keyRow}>
            <input
              type="password"
              value={keys[p.id]?.streamKey || ''}
              onChange={e => updateKey(p.id, 'streamKey', e.target.value)}
              placeholder="Pega tu stream key aquí"
            />
            <button type="button" onClick={() => copyText(keys[p.id]?.streamKey || '', `${p.id}-key`)}>
              <i className={`ti ${copied === `${p.id}-key` ? 'ti-check' : 'ti-copy'}`} />
            </button>
          </div>
        </div>
      ))}

      <div className={styles.actions}>
        {!liveOn ? (
          <button type="button" className={styles.goLiveBtn} onClick={onGoLive} disabled={activePlats.length === 0}>
            <i className="ti ti-broadcast" />
            {hasAnyKey ? 'Preparar en vivo (OBS)' : 'Ir en vivo (demo)'}
          </button>
        ) : (
          <button type="button" className={styles.stopBtn} onClick={onStopLive}>
            <i className="ti ti-player-stop" /> Detener transmisión
          </button>
        )}
      </div>

      {liveOn && hasAnyKey && (
        <div className={styles.obsHelp}>
          <strong><i className="ti ti-info-circle" /> Conectar con OBS Studio</strong>
          <ol>
            <li>Abre OBS → Configuración → Emisión → Servicio: Personalizado</li>
            <li>Pega la URL y stream key de la plataforma activa</li>
            <li>Fuente: <em>Captura de ventana</em> → selecciona PodcastStudio</li>
            <li>Inicia transmisión en OBS</li>
          </ol>
        </div>
      )}
    </div>
  )
}
