import React, { useState } from 'react'
import styles from './LiveStreamModal.module.css'

export default function LiveStreamModal({
  open,
  onClose,
  destinations,
  onUpdateDestination,
  isLive,
  liveDuration,
  formatLiveDuration,
  liveStats,
  liveError,
  onStartLive,
  onStopLive,
}) {
  const [activeTab, setActiveTab] = useState('facebook')
  const [showKeys, setShowKeys] = useState({})

  if (!open) return null

  const toggleShowKey = (id) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const currentDest = destinations[activeTab] || destinations.facebook || destinations.youtube
  const enabledCount = Object.values(destinations).filter(d => d.enabled && d.streamKey?.trim()).length

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={`${styles.livePulse} ${isLive ? styles.livePulseOn : ''}`}>
              <i className="ti ti-broadcast" />
            </div>
            <div>
              <h2 className={styles.title}>
                Transmisión En Vivo Multi-Streaming
              </h2>
              <p className={styles.subtitle}>
                Emite tu señal Master (cámaras, cortes, cintillos y audio limpio) simultáneamente en YouTube, Facebook y TikTok.
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {liveError && (
          <div className={styles.errorAlert}>
            <i className="ti ti-alert-triangle" />
            <span>{liveError}</span>
          </div>
        )}

        {/* ESTADO EN VIVO EN TIEMPO REAL */}
        {isLive && (
          <div className={styles.liveStatusBar}>
            <div className={styles.liveStatusLeft}>
              <span className={styles.onAirBadge}>● EN VIVO</span>
              <span className={styles.liveTimer}>{formatLiveDuration(liveDuration)}</span>
              <span className={styles.destCountBadge}>{enabledCount} Destinos Activos</span>
            </div>
            <div className={styles.liveStatusRight}>
              <span>FPS: <strong>{liveStats.fps}</strong></span>
              <span>Bitrate: <strong>{liveStats.bitrateKbps} kbps</strong></span>
            </div>
          </div>
        )}

        {/* TABS DE REDES SOCIALES */}
        <div className={styles.tabsRow}>
          {Object.values(destinations).map((dest) => (
            <button
              key={dest.id}
              type="button"
              className={`${styles.tabBtn} ${activeTab === dest.id ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(dest.id)}
            >
              <i className={`ti ${dest.icon}`} style={{ color: dest.color }} />
              <span>{dest.name}</span>
              {dest.enabled && (
                <span className={styles.tabBadgeActive}>Activo</span>
              )}
            </button>
          ))}
        </div>

        {/* PANEL DEL DESTINO SELECCIONADO */}
        <div className={styles.destPanel}>
          <div className={styles.destHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className={`ti ${currentDest.icon}`} style={{ color: currentDest.color, fontSize: 20 }} />
              <strong>{currentDest.name}</strong>
            </div>

            <label className={styles.switchWrap}>
              <input
                type="checkbox"
                checked={currentDest.enabled}
                onChange={(e) => onUpdateDestination(currentDest.id, { enabled: e.target.checked })}
              />
              <span className={styles.switchSlider} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>
                {currentDest.enabled ? 'Destino Habilitado' : 'Deshabilitado'}
              </span>
            </label>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>URL del Servidor RTMP / RTMPS:</label>
            <input
              type="text"
              className={styles.fieldInput}
              value={currentDest.serverUrl || ''}
              placeholder={currentDest.id === 'tiktok' ? 'rtmp://live.tiktok.com/live/' : 'rtmp://...'}
              onChange={(e) => onUpdateDestination(currentDest.id, { serverUrl: e.target.value })}
            />
          </div>

          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.fieldLabel}>Clave de Transmisión (Stream Key):</label>
              <button
                type="button"
                className={styles.showKeyBtn}
                onClick={() => toggleShowKey(currentDest.id)}
              >
                <i className={`ti ti-eye${showKeys[currentDest.id] ? '-off' : ''}`} />
                {showKeys[currentDest.id] ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <input
              type={showKeys[currentDest.id] ? 'text' : 'password'}
              className={styles.fieldInput}
              value={currentDest.streamKey || ''}
              placeholder="Pega aquí tu Stream Key secreta..."
              onChange={(e) => onUpdateDestination(currentDest.id, { streamKey: e.target.value })}
            />
          </div>

          {/* GUÍAS PASO A PASO POR RED */}
          <div className={styles.guideBox}>
            <i className="ti ti-help" style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 11, lineHeight: 1.45, color: '#9499ad' }}>
              {currentDest.id === 'youtube' && (
                <>
                  <strong>Dónde encontrar tu clave de YouTube Live:</strong> Entra a <em>YouTube Studio &gt; Crear &gt; Emitir en directo</em>. En la pestaña &quot;Emisión&quot; copia tu <strong>Clave de emisión</strong> y pégala arriba.
                </>
              )}
              {currentDest.id === 'facebook' && (
                <>
                  <strong>Dónde encontrar tu clave de Facebook Live:</strong> Ve a <em>Meta Business Suite &gt; Live Producer</em>. Selecciona &quot;Usar clave de transmisión&quot; y copia tu URL y Clave de stream permanente.
                </>
              )}
              {currentDest.id === 'tiktok' && (
                <>
                  <strong>Dónde encontrar tu clave de TikTok Live:</strong> Disponible en <em>TikTok Live Studio</em> o para cuentas con acceso a <em>RTMP Streaming</em> en el Centro de Creadores Live de TikTok.
                </>
              )}
              {currentDest.id === 'custom' && (
                <>
                  <strong>Servidor RTMP Personalizado:</strong> Compatible con Twitch (<code>rtmp://live.twitch.tv/app/</code>), Kick, Twitter/X o retransmisores locales como OBS Studio.
                </>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className={styles.footer}>
          <div className={styles.activeSummary}>
            <i className="ti ti-network" style={{ color: enabledCount > 0 ? '#10b981' : '#64748b' }} />
            <span>
              {enabledCount > 0
                ? `${enabledCount} destino(s) configurado(s) para emitir a la vez`
                : 'Configura al menos 1 red para transmitir'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {isLive ? (
              <button
                type="button"
                className={styles.stopLiveBtn}
                onClick={onStopLive}
              >
                <i className="ti ti-player-stop" />
                Finalizar Transmisión
              </button>
            ) : (
              <button
                type="button"
                className={styles.startLiveBtn}
                onClick={onStartLive}
                disabled={enabledCount === 0}
              >
                <i className="ti ti-broadcast" />
                Iniciar Transmisión En Vivo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
