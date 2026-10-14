import React, { useState, useEffect, useMemo } from 'react'
import { getSlotLabel } from '../config/cameraSlots.js'
import styles from './CameraConnectModal.module.css'

const PRESET_WIFI_STREAMS = [
  { name: 'DroidCam (Android/iOS)', url: 'http://192.168.1.50:4747/video' },
  { name: 'IP Webcam (Android)', url: 'http://192.168.1.50:8080/video' },
  { name: 'GoPro Live Stream', url: 'http://10.5.5.9:8080/live/amba.m3u8' },
  { name: 'OBS / RTSP HLS Local', url: 'http://localhost:8080/hls/stream.m3u8' },
]

export default function CameraConnectModal({
  open,
  onClose,
  initialSlot = 0,
  slotsCount = 3,
  onAddSlot,
  devices = { cameras: [] },
  cameraMeta = {},
  streams = {},
  masterCameraSlot = 1,
  onSetMaster,
  onUsbConnect,
  onWifiConnect,
  onDisconnect,
  onRenameSlot,
}) {
  const [targetSlot, setTargetSlot] = useState(initialSlot)
  const [activeTab, setActiveTab] = useState('usb')
  const [wifiUrl, setWifiUrl] = useState('')
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setTargetSlot(initialSlot)
      const currentLabel = cameraMeta[initialSlot]?.customLabel || ''
      setCustomLabel(currentLabel)
      setWifiUrl(cameraMeta[initialSlot]?.url || '')
    }
  }, [open, initialSlot, cameraMeta])

  useEffect(() => {
    const meta = cameraMeta[targetSlot]
    setCustomLabel(meta?.customLabel || '')
    setWifiUrl(meta?.url || '')
  }, [targetSlot, cameraMeta])

  // ESC to close
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const currentMeta = cameraMeta[targetSlot]
  const isConnected = Boolean(streams[targetSlot])
  const isMaster = targetSlot === masterCameraSlot

  const slotTitle = useMemo(() => {
    return getSlotLabel(targetSlot, currentMeta?.customLabel, isMaster)
  }, [targetSlot, currentMeta, isMaster])

  const remoteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/remote-cam?slot=${targetSlot + 1}`
    : `https://podcastudio.mx/remote-cam?slot=${targetSlot + 1}`

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(remoteUrl)}`

  const handleConnectUsb = async (deviceId, label) => {
    if (!onUsbConnect) return
    await onUsbConnect(deviceId, targetSlot, customLabel.trim() || label)
  }

  const handleConnectWifi = async (urlToConnect) => {
    const url = (urlToConnect || wifiUrl)?.trim()
    if (!url || !onWifiConnect) return
    setWifiConnecting(true)
    try {
      await onWifiConnect(url, targetSlot, customLabel.trim() || `WiFi Cam ${targetSlot + 1}`)
    } finally {
      setWifiConnecting(false)
    }
  }

  const handleSaveLabel = (e) => {
    e.preventDefault()
    if (onRenameSlot) {
      onRenameSlot(targetSlot, customLabel)
    }
  }

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(remoteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
      >
        <header className={styles.head}>
          <div className={styles.headTitle}>
            <i className="ti ti-video" />
            <h2 id="camera-modal-title">Configurar Entrada de Video</h2>
            <span className={styles.slotBadge}>CAM {targetSlot + 1}</span>
            {isMaster && <span className={styles.slotBadge} style={{ background: 'rgba(232, 97, 42, 0.3)', color: '#fff' }}>★ MASTER</span>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <i className="ti ti-x" />
          </button>
        </header>

        {/* SELECTOR DE SLOT */}
        <div className={styles.slotSelectorRow}>
          <span className={styles.slotSelectorLabel}>Canal:</span>
          <div className={styles.slotPills}>
            {Array.from({ length: slotsCount }).map((_, i) => {
              const hasStream = Boolean(streams[i])
              const active = targetSlot === i
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.slotPill} ${active ? styles.slotPillActive : ''} ${hasStream ? styles.slotPillConnected : ''}`}
                  onClick={() => setTargetSlot(i)}
                >
                  <span>{i + 1}</span>
                  {hasStream && <span className={styles.slotConnectedDot} />}
                </button>
              )
            })}
            {slotsCount < 15 && onAddSlot && (
              <button
                type="button"
                className={styles.slotPill}
                style={{ borderStyle: 'dashed' }}
                onClick={() => {
                  onAddSlot()
                  setTargetSlot(slotsCount)
                }}
                title="Añadir nuevo slot (hasta 15)"
              >
                <i className="ti ti-plus" style={{ fontSize: 9 }} />
              </button>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'usb' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('usb')}
          >
            <i className="ti ti-plug" /> USB / Capturadora
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'wifi' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('wifi')}
          >
            <i className="ti ti-wifi" /> WiFi / IP Stream
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'remote' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('remote')}
          >
            <i className="ti ti-qrcode" /> Móvil / Remota QR
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="ti ti-adjustments" /> Ajustes de Canal
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          {/* TAB USB */}
          {activeTab === 'usb' && (
            <div className={styles.deviceList}>
              {devices.cameras.length === 0 ? (
                <div className={styles.emptyMsg}>
                  <i className="ti ti-alert-circle" style={{ fontSize: 24, display: 'block', marginBottom: 6 }} />
                  No se detectaron cámaras USB o capturadoras HDMI conectadas.
                </div>
              ) : (
                devices.cameras.map((cam, idx) => {
                  const isCurrent = currentMeta?.deviceId === cam.deviceId && isConnected
                  return (
                    <div
                      key={cam.deviceId || idx}
                      className={`${styles.deviceItem} ${isCurrent ? styles.deviceItemActive : ''}`}
                    >
                      <div className={styles.deviceInfo}>
                        <i className={`ti ti-video ${styles.deviceIcon}`} />
                        <div>
                          <div className={styles.deviceLabel}>{cam.label || `Cámara USB ${idx + 1}`}</div>
                          <div className={styles.deviceSub}>{cam.deviceId ? `ID: ${cam.deviceId.slice(0, 12)}…` : 'Dispositivo predeterminado'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`${styles.connectBtn} ${isCurrent ? styles.connectBtnConnected : ''}`}
                        onClick={() => handleConnectUsb(cam.deviceId, cam.label)}
                        disabled={isCurrent}
                      >
                        {isCurrent ? (
                          <><i className="ti ti-check" /> Conectada</>
                        ) : (
                          <><i className="ti ti-plug" /> Asignar a CAM {targetSlot + 1}</>
                        )}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB WIFI */}
          {activeTab === 'wifi' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>URL de transmisión (MJPEG / HLS / RTSP-HTTP):</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    placeholder="http://192.168.1.100:8080/video"
                    value={wifiUrl}
                    onChange={(e) => setWifiUrl(e.target.value)}
                    className={styles.formInput}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className={styles.connectBtn}
                    onClick={() => handleConnectWifi()}
                    disabled={wifiConnecting || !wifiUrl.trim()}
                  >
                    {wifiConnecting ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> : <i className="ti ti-antenna" />}
                    Conectar
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Presets comunes de red local:</label>
                <div className={styles.presetGrid}>
                  {PRESET_WIFI_STREAMS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={styles.presetCard}
                      onClick={() => {
                        setWifiUrl(preset.url)
                        handleConnectWifi(preset.url)
                      }}
                    >
                      <span className={styles.presetCardName}>{preset.name}</span>
                      <span className={styles.presetCardUrl}>{preset.url}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB REMOTE / QR */}
          {activeTab === 'remote' && (
            <div className={styles.remoteBox}>
              <div className={styles.qrWrap}>
                <img src={qrSrc} alt="Escanear con smartphone" className={styles.qrImage} />
              </div>
              <div className={styles.remoteText}>
                Escanea con la cámara de tu <strong>iPhone o Android</strong> conectado a la misma red Wi-Fi para usarlo como cámara inalámbrica en tiempo real.
              </div>
              <button type="button" className={styles.copyUrlBtn} onClick={handleCopyLink}>
                <i className={copied ? 'ti ti-check' : 'ti ti-copy'} />
                {copied ? '¡Enlace copiado!' : 'Copiar enlace directo de cámara'}
              </button>
            </div>
          )}

          {/* TAB SETTINGS */}
          {activeTab === 'settings' && (
            <>
              <form onSubmit={handleSaveLabel} className={styles.formGroup}>
                <label className={styles.formLabel}>Etiqueta o nombre del tiro (ej. Conductor, Invitado, Cenital):</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={`CAM ${targetSlot + 1}`}
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    className={styles.formInput}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className={styles.connectBtn}>
                    <i className="ti ti-device-floppy" /> Guardar
                  </button>
                </div>
              </form>

              <div className={styles.formGroup} style={{ marginTop: 6 }}>
                <label className={styles.formLabel}>Rol en el Switcher:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className={`${styles.connectBtn} ${isMaster ? styles.connectBtnConnected : ''}`}
                    onClick={() => onSetMaster && onSetMaster(targetSlot)}
                  >
                    <i className="ti ti-star" />
                    {isMaster ? '★ Cámara Master Actual' : 'Designar como Cámara Master'}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    (La cámara master es el plano general de referencia)
                  </span>
                </div>
              </div>
            </>
          )}

          {/* FOOTER ACTIONS */}
          <div className={styles.actionsRow}>
            <div style={{ fontSize: 11, color: '#aaa' }}>
              Estado: <strong style={{ color: isConnected ? '#22c55e' : '#888' }}>
                {isConnected ? `Conectada (${currentMeta?.type || 'USB'})` : 'Sin señal'}
              </strong>
            </div>
            {isConnected && onDisconnect && (
              <button
                type="button"
                className={styles.disconnectAction}
                onClick={() => onDisconnect(targetSlot)}
              >
                <i className="ti ti-plug-off" /> Desconectar señal de CAM {targetSlot + 1}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
