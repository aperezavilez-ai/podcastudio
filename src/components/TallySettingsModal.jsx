import React, { useState, useEffect } from 'react'
import {
  Radio,
  Wifi,
  Cpu,
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Send,
  Zap,
  Sliders,
  Tv,
  Eye,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

export default function TallySettingsModal({
  open,
  onClose,
  activeCam = 1,
  pvwCam = 2,
  dualMode = false,
  totalSlots = 4,
  onSelectCam,
  onSelectPvw
}) {
  const [tallyUrl, setTallyUrl] = useState('')
  const [copiedCam, setCopiedCam] = useState(null)
  const [serialPorts, setSerialPorts] = useState([])
  const [selectedPort, setSelectedPort] = useState('')
  const [baudRate, setBaudRate] = useState(9600)
  const [scanningPorts, setScanningPorts] = useState(false)
  const [serialStatus, setSerialStatus] = useState(null)
  const [autoSerialSync, setAutoSerialSync] = useState(() => {
    return localStorage.getItem('podcastudio_tally_auto_serial') === 'true'
  })

  // Obtener URL de Tally LAN
  useEffect(() => {
    if (open && window.api?.getTallyUrl) {
      window.api.getTallyUrl().then((url) => {
        if (url) setTallyUrl(url)
      }).catch(() => {})
    }
  }, [open])

  // Escanear puertos COM al abrir
  const scanPorts = async () => {
    if (!window.api?.listSerialPorts) return
    setScanningPorts(true)
    setSerialStatus(null)
    try {
      const ports = await window.api.listSerialPorts()
      setSerialPorts(ports || [])
      if (ports && ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].port)
      }
    } catch (err) {
      console.warn('[Tally] Error escaneando puertos COM:', err)
    } finally {
      setScanningPorts(false)
    }
  }

  useEffect(() => {
    if (open) {
      scanPorts()
    }
  }, [open])

  // Envío serial automático si está activado
  useEffect(() => {
    if (!autoSerialSync || !selectedPort || !window.api?.sendTallySerial) return
    const pgm = activeCam || 1
    const pvw = pvwCam || 2
    const dataString = `TALLY:PGM=${pgm},PVW=${dualMode ? pvw : 0}\n`
    window.api.sendTallySerial({ port: selectedPort, baudRate, data: dataString }).catch(() => {})
  }, [activeCam, pvwCam, dualMode, autoSerialSync, selectedPort, baudRate])

  const handleCopyLink = (camNum) => {
    const url = tallyUrl ? `${tallyUrl}?cam=${camNum}` : `http://localhost:3001/tally?cam=${camNum}`
    navigator.clipboard.writeText(url)
    setCopiedCam(camNum)
    setTimeout(() => setCopiedCam(null), 2000)
  }

  const handleOpenLink = (camNum) => {
    const url = tallyUrl ? `${tallyUrl}?cam=${camNum}` : `http://localhost:3001/tally?cam=${camNum}`
    if (window.api?.openExternal) {
      window.api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleSendTestSerial = async (action) => {
    if (!selectedPort || !window.api?.sendTallySerial) {
      setSerialStatus({ type: 'error', text: 'Selecciona un puerto COM primero' })
      return
    }
    setSerialStatus({ type: 'info', text: 'Enviando...' })
    let data = ''
    if (action === 'pgm') data = `TALLY:PGM=${activeCam || 1},PVW=0\n`
    else if (action === 'pvw') data = `TALLY:PGM=0,PVW=${pvwCam || 2}\n`
    else data = `TALLY:PGM=0,PVW=0\n`

    try {
      const res = await window.api.sendTallySerial({ port: selectedPort, baudRate, data })
      if (res.success) {
        setSerialStatus({ type: 'success', text: `Enviado con éxito a ${selectedPort}: ${data.trim()}` })
      } else {
        setSerialStatus({ type: 'error', text: `Error: ${res.error}` })
      }
    } catch (err) {
      setSerialStatus({ type: 'error', text: err.message })
    }
  }

  const toggleAutoSerial = (val) => {
    setAutoSerialSync(val)
    localStorage.setItem('podcastudio_tally_auto_serial', val ? 'true' : 'false')
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 5, 8, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          backgroundColor: '#101116',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.15)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.15), rgba(22, 163, 74, 0.08), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(220, 38, 38, 0.5)'
              }}
            >
              <Radio size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Sistema Tally Light Broadcast (P2.4)
              </h2>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                Indicadores luminosos de cámara en vivo (🔴 PGM / 🟢 PVW) vía Red Local Wi-Fi y Puertos Seriales USB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. Matriz de Estado Tally en Vivo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tv size={15} color="#ff6b00" /> Matriz de Cámaras Activas en Estudio
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                🔴 PGM = Al Aire &nbsp;|&nbsp; 🟢 PVW = Próxima &nbsp;|&nbsp; ⚫ Standby
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {Array.from({ length: Math.max(4, totalSlots) }).map((_, idx) => {
                const camNum = idx + 1
                const isPgm = activeCam === camNum
                const isPvw = dualMode && pvwCam === camNum
                const state = isPgm ? 'pgm' : (isPvw ? 'pvw' : 'off')

                return (
                  <div
                    key={camNum}
                    style={{
                      padding: '12px 10px',
                      borderRadius: 10,
                      border: isPgm
                        ? '2px solid #dc2626'
                        : (isPvw ? '2px solid #16a34a' : '1px solid rgba(255, 255, 255, 0.08)'),
                      background: isPgm
                        ? 'rgba(220, 38, 38, 0.18)'
                        : (isPvw ? 'rgba(22, 163, 74, 0.18)' : '#16171d'),
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isPgm ? '#dc2626' : (isPvw ? '#16a34a' : '#475569'),
                          boxShadow: isPgm ? '0 0 8px #dc2626' : (isPvw ? '0 0 8px #16a34a' : 'none')
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                        CAM {camNum}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isPgm ? '#dc2626' : (isPvw ? '#16a34a' : 'rgba(255,255,255,0.06)'),
                        color: '#fff'
                      }}
                    >
                      {isPgm ? '● AL AIRE' : (isPvw ? '★ PREVIEW' : 'STANDBY')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. Tally Inalámbrico Web para Celulares */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wifi size={15} /> Tally Móvil Inalámbrico LAN (Sin Instalar Apps)
                </span>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Abre el enlace en el navegador de cualquier celular colocado sobre la cámara. La pantalla cambiará de color en vivo y nunca se apagará (Screen WakeLock).
                </p>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8'
                }}
              >
                Zero Latency WebSocket
              </span>
            </div>

            {/* Lista de enlaces directos por cámara */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {Array.from({ length: Math.min(6, totalSlots) }).map((_, idx) => {
                const camNum = idx + 1
                const isCopied = copiedCam === camNum

                return (
                  <div
                    key={camNum}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: '#181920',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                      CAM {camNum}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleCopyLink(camNum)}
                        style={{
                          background: isCopied ? '#16a34a' : 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={`Copiar enlace para Tally CAM ${camNum}`}
                      >
                        {isCopied ? <Check size={11} /> : <Copy size={11} />}
                        <span>{isCopied ? 'Copiado' : 'Link'}</span>
                      </button>
                      <button
                        onClick={() => handleOpenLink(camNum)}
                        style={{
                          background: 'rgba(255, 107, 0, 0.15)',
                          border: '1px solid rgba(255, 107, 0, 0.3)',
                          color: '#ff6b00',
                          borderRadius: 6,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={`Abrir visor Tally CAM ${camNum}`}
                      >
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3. Tally por Hardware USB / Serial (ESP32, Arduino, Relays) */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu size={15} /> Integración Hardware Serial / USB (Arduino, ESP32, TallyArdu)
                </span>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Envía cadenas broadcast como <code style={{ color: '#4ade80' }}>TALLY:PGM=1,PVW=2</code> directo por el puerto COM.
                </p>
              </div>
              <button
                onClick={scanPorts}
                disabled={scanningPorts}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RefreshCw size={12} className={scanningPorts ? 'animate-spin' : ''} />
                <span>Escanear COM</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Selector de puerto */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Puerto COM:
                </label>
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  style={{
                    background: '#1a1b23',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    minWidth: 150
                  }}
                >
                  {serialPorts.length === 0 ? (
                    <option value="">Sin puertos COM detectados</option>
                  ) : (
                    serialPorts.map((p) => (
                      <option key={p.port} value={p.port}>
                        {p.port} - {p.description || 'Serial'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selector de Baud Rate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Velocidad (Baudios):
                </label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(parseInt(e.target.value) || 9600)}
                  style={{
                    background: '#1a1b23',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={57600}>57600 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>

              {/* Checkbox auto sync */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
                <input
                  type="checkbox"
                  id="autoSerialCheck"
                  checked={autoSerialSync}
                  onChange={(e) => toggleAutoSerial(e.target.checked)}
                  style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#4ade80' }}
                />
                <label htmlFor="autoSerialCheck" style={{ fontSize: 12, color: '#e2e8f0', cursor: 'pointer', fontWeight: 600 }}>
                  Auto-enviar al conmutar (CUT / AUTO / T-Bar)
                </label>
              </div>
            </div>

            {/* Botones de prueba manual */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Prueba física:</span>
              <button
                onClick={() => handleSendTestSerial('pgm')}
                style={{
                  background: 'rgba(220, 38, 38, 0.2)',
                  border: '1px solid #dc2626',
                  color: '#f87171',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔴 Enviar Tally PGM
              </button>
              <button
                onClick={() => handleSendTestSerial('pvw')}
                style={{
                  background: 'rgba(22, 163, 74, 0.2)',
                  border: '1px solid #16a34a',
                  color: '#86efac',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🟢 Enviar Tally PVW
              </button>
              <button
                onClick={() => handleSendTestSerial('clear')}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚪ Apagar LEDs
              </button>
            </div>

            {serialStatus && (
              <div
                style={{
                  fontSize: 11,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: serialStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                  color: serialStatus.type === 'error' ? '#f87171' : '#86efac',
                  border: `1px solid ${serialStatus.type === 'error' ? '#ef4444' : '#4ade80'}`
                }}
              >
                {serialStatus.text}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Sistema Tally Broadcast v1.1.4 Oficial</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ff6b00',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 107, 0, 0.4)'
            }}
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
