import React, { useState, useEffect, useMemo } from 'react'
import { getSlotLabel } from '../config/cameraSlots.js'
import { scanWifiCameras } from '../utils/wifiCameraScanner.js'
import styles from './CameraConnectModal.module.css'

const PRESET_WIFI_STREAMS = [
  { name: 'GoPro WiFi Stream (Hero 4/5/6/7)', url: 'http://10.5.5.9:8080/live/amba.m3u8' },
  { name: 'Cámara Acción China (SJCam / Eken)', url: 'http://192.168.1.254:8192' },
  { name: 'Cámara Acción 4K (LiveDV / XDV IP)', url: 'http://192.168.42.1:8080' },
  { name: 'DroidCam (Android / iPhone WiFi)', url: 'http://192.168.1.50:4747/video' },
  { name: 'IP Webcam (Android / SmartCam)', url: 'http://192.168.1.50:8080/video' },
  { name: 'OBS / NDI HLS Stream Local', url: 'http://localhost:8080/hls/stream.m3u8' },
]

function ModalVideoPreview({ stream, label }) {
  const vRef = React.useRef(null)

  React.useEffect(() => {
    if (vRef.current && stream) {
      vRef.current.setAttribute('playsinline', 'true')
      vRef.current.setAttribute('webkit-playsinline', 'true')
      vRef.current.muted = true
      if (vRef.current.srcObject !== stream) {
        vRef.current.srcObject = stream
      }
      vRef.current.play().catch(() => {})
    }
  }, [stream])

  return (
    <div style={{
      width: '100%',
      maxWidth: 380,
      aspectRatio: '16/9',
      backgroundColor: '#05070a',
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid rgba(255,255,255,0.18)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      margin: '12px auto',
    }}>
      <video
        ref={vRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted
        onLoadedMetadata={(e) => { e.target.play().catch(() => {}) }}
      />
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(22,101,52,0.85)',
        border: '1px solid #4ade80',
        color: '#86efac',
        padding: '3px 8px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
        {label || 'SEÑAL EN VIVO'}
      </div>
    </div>
  )
}

export default function CameraConnectModal({
  open,
  onClose,
  initialSlot = 0,
  slotsCount = 4,
  onAddSlot,
  onRemoveSlot,
  devices = { cameras: [] },
  cameraMeta = {},
  streams = {},
  masterCameraSlot = 0,
  onSetMaster,
  onUsbConnect,
  onWifiConnect,
  onDisconnect,
  onRenameSlot,
  getRoomCodeForSlot,
  onListenRemoteSlot,
  remoteStatus = {},
}) {
  const [targetSlot, setTargetSlot] = useState(initialSlot)
  const [activeTab, setActiveTab] = useState('usb')
  const [wifiUrl, setWifiUrl] = useState('')
  const [wifiConnecting, setWifiConnecting] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [copied, setCopied] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [discoveredCameras, setDiscoveredCameras] = useState([])
  const [hasScanned, setHasScanned] = useState(false)

  const handleScanWifi = async () => {
    setIsScanning(true)
    setHasScanned(true)
    setScanMessage('Buscando cámaras y celulares en la red Wi-Fi...')
    try {
      const results = await scanWifiCameras({
        onProgress: (msg) => setScanMessage(msg),
      })
      setDiscoveredCameras(results)
    } catch (err) {
      console.warn('Error en escaneo Wi-Fi:', err)
    } finally {
      setIsScanning(false)
      setScanMessage('')
    }
  }

  useEffect(() => {
    if (open && onListenRemoteSlot) {
      onListenRemoteSlot(targetSlot)
    }
  }, [open, targetSlot, onListenRemoteSlot])

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

  const roomCode = useMemo(() => {
    if (getRoomCodeForSlot) return getRoomCodeForSlot(targetSlot)
    return `pcd_cam_${targetSlot + 1}`
  }, [getRoomCodeForSlot, targetSlot])

  const remoteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/remote-cam?slot=${targetSlot + 1}&room=${roomCode}`
    : `https://podcastudio.mx/remote-cam?slot=${targetSlot + 1}&room=${roomCode}`

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

        {/* BARRA DE ESTADO DEL CANAL SELECCIONADO */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: isConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#666',
              boxShadow: isConnected ? '0 0 8px #22c55e' : 'none',
            }} />
            <span style={{ color: isConnected ? '#fff' : '#aaa' }}>
              CAM {targetSlot + 1}: <strong>{isConnected ? `Activa (${currentMeta?.label || 'Transmitiendo'})` : 'Desactivada (Sin señal)'}</strong>
            </span>
          </div>
          {isConnected && onDisconnect && (
            <button
              type="button"
              onClick={() => onDisconnect(targetSlot)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Apagar y liberar esta cámara"
            >
              <i className="ti ti-power" /> Apagar Cámara
            </button>
          )}
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
                        onClick={() => {
                          if (isCurrent) {
                            if (onDisconnect) onDisconnect(targetSlot)
                          } else {
                            handleConnectUsb(cam.deviceId, cam.label)
                          }
                        }}
                        title={isCurrent ? 'Desactivar / Apagar esta cámara en este canal' : `Asignar a CAM ${targetSlot + 1}`}
                      >
                        {isCurrent ? (
                          <><i className="ti ti-power" style={{ color: '#f87171' }} /> Desactivar</>
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
              {/* BANNER DE ESCÁNER AUTOMÁTICO */}
              <div className={styles.scannerBanner}>
                <div className={styles.scannerInfo}>
                  <div className={styles.scannerTitle}>
                    <i className="ti ti-radar" />
                    <span>Búsqueda Automática en Red Wi-Fi</span>
                  </div>
                  <span className={styles.scannerSub}>
                    {isScanning
                      ? (scanMessage || 'Escaneando la red local en busca de celulares y cámaras...')
                      : 'Detecta celulares iPhone/Android, cámaras DroidCam, GoPro y streams locales'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.scanBtn}
                  onClick={handleScanWifi}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</>
                  ) : (
                    <><i className="ti ti-search" /> Buscar Cámaras</>
                  )}
                </button>
              </div>

              {/* LISTA DE DISPOSITIVOS DETECTADOS */}
              {discoveredCameras.length > 0 && (
                <div className={styles.discoveredList}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#86efac', marginBottom: 2 }}>
                    Cámaras y Celulares detectados en Wi-Fi ({discoveredCameras.length}):
                  </div>
                  {discoveredCameras.map((device) => {
                    const isPhone = device.type === 'remote_phone'
                    return (
                      <div key={device.id} className={styles.discoveredCard}>
                        <div className={styles.discoveredMeta}>
                          <i className={`ti ${isPhone ? 'ti-device-mobile' : 'ti-video'} ${styles.discoveredIcon}`} />
                          <div>
                            <div className={styles.discoveredName}>{device.name}</div>
                            <div className={styles.discoveredSub}>
                              {isPhone ? 'Listo para transmitir en tiempo real' : device.url}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.assignBtn}
                          onClick={() => {
                            if (isPhone) {
                              setActiveTab('remote')
                              if (onListenRemoteSlot) onListenRemoteSlot(targetSlot)
                            } else {
                              setWifiUrl(device.url)
                              handleConnectWifi(device.url)
                            }
                          }}
                        >
                          <i className="ti ti-plug" /> Asignar a CAM {targetSlot + 1}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {hasScanned && discoveredCameras.length === 0 && !isScanning && (
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 14, fontSize: 11, color: '#cbd5e1' }}>
                  <div style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <i className="ti ti-info-circle" /> No se detectaron cámaras automáticas activas en este instante
                  </div>
                  <div>
                    • <strong>Para conectar tu celular:</strong> Abre la pestaña <strong>Móvil / Remota QR</strong> y escanea el código con tu iPhone o Android (¡la forma más rápida, sin instalar nada!).
                  </div>
                  <div style={{ marginTop: 3 }}>
                    • <strong>Si usas DroidCam o IP Webcam:</strong> Asegúrate de que la app esté abierta en tu teléfono en la misma red Wi-Fi e ingresa la URL mostrada abajo.
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>URL de transmisión manual (MJPEG / HLS / RTSP-HTTP):</label>
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

              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: 11, color: '#93c5fd', lineHeight: 1.45 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-bulb" style={{ fontSize: 13, color: '#60a5fa' }} />
                  ¿Cómo conectar GoPro y cámaras de acción chinas?
                </div>
                <div>
                  <strong>Opción 1 (Recomendada, cero lag):</strong> Conecta tu GoPro (Hero 8+) o cámara de acción china (SJCam, Eken, Akaso) con su cable USB a la PC. En la pantallita de la cámara selecciona <em>"Modo PC Cam / Cámara web"</em>. Ve a la pestaña <strong>USB / Capturadora</strong> y aparecerá de inmediato a 1080p sin latencia.
                </div>
                <div style={{ marginTop: 5 }}>
                  <strong>Opción 2 (WiFi directo):</strong> Enciende el Wi-Fi de la cámara, conecta tu computadora a la red Wi-Fi de la cámara e ingresa la URL de stream de arriba.
                </div>
              </div>
            </>
          )}

          {/* TAB REMOTE / QR */}
          {activeTab === 'remote' && (
            <div className={styles.remoteBox}>
              {isConnected && currentMeta?.type === 'remote' ? (
                <div className={styles.remoteConnectedBox}>
                  <div className={styles.remoteLiveBadge}>
                    <i className="ti ti-broadcast" />
                    <span>¡Cámara iPhone Conectada en Vivo!</span>
                  </div>

                  {/* VISOR EN VIVO DE LA CÁMARA REMOTA */}
                  <ModalVideoPreview
                    stream={streams[targetSlot]}
                    label={`iPhone CAM ${targetSlot + 1}`}
                  />

                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                    Transmitiendo señal HD y micrófono en tiempo real a CAM {targetSlot + 1}
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    Verifica aquí el encuadre, enfoque y distancia. Puedes voltear la cámara (trasera/frontal) o encender la linterna directamente desde la pantalla de tu teléfono.
                  </p>
                  <button
                    type="button"
                    className={styles.disconnectAction}
                    onClick={() => {
                      if (onDisconnect) onDisconnect(targetSlot)
                    }}
                  >
                    <i className="ti ti-power" /> Desconectar iPhone de este canal
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.qrWrap}>
                    <img src={qrSrc} alt="Escanear con smartphone" className={styles.qrImage} />
                  </div>
                  <div className={styles.remoteText}>
                    Escanea con la cámara de tu <strong>iPhone o Android</strong>. No necesitas instalar nada; se abrirá automáticamente la cámara de tu teléfono y se conectará en vivo a <strong>CAM {targetSlot + 1}</strong>.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" className={styles.copyUrlBtn} onClick={handleCopyLink}>
                      <i className={copied ? 'ti ti-check' : 'ti ti-copy'} />
                      {copied ? '¡Enlace copiado!' : 'Copiar enlace directo de cámara'}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Hola! Conéctate como cámara remota en vivo para PodcastStudio en CAM ${targetSlot + 1}: ${remoteUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.copyUrlBtn}
                      style={{ textDecoration: 'none', background: '#166534', color: '#fff', borderColor: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      title="Enviar por WhatsApp a otra persona o celular"
                    >
                      <i className="ti ti-brand-whatsapp" style={{ fontSize: 16 }} /> Enviar por WhatsApp
                    </a>
                    <a
                      href={remoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.copyUrlBtn}
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      title="Abrir en otra pestaña para probar en este navegador"
                    >
                      <i className="ti ti-external-link" /> Probar en navegador
                    </a>
                  </div>

                  <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: 11, color: '#86efac', lineHeight: 1.45, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, color: '#4ade80' }}>
                      <i className="ti ti-world" style={{ fontSize: 13 }} />
                      ¿El celular está en otra ubicación o con datos móviles (4G/5G)?
                    </div>
                    <div>
                      <strong>¡Funciona a cualquier distancia!</strong> No necesitan estar en la misma red Wi-Fi. Solo copia el enlace o envíaselo por WhatsApp. La otra persona abre el link en su navegador (Safari en iPhone o Chrome en Android), pulsa <em>"Activar Cámara y Conectar"</em> y listo: su video HD y micrófono entrarán de inmediato en CAM {targetSlot + 1}.
                    </div>
                  </div>
                </>
              )}
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
