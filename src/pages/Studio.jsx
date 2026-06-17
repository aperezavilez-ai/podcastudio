import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebcam } from '../hooks/useWebcam.js'
import { useRecorder } from '../hooks/useRecorder.js'
import { useAI } from '../hooks/useAI.js'
import CameraView from '../components/CameraView.jsx'
import CameraConnectPanel from '../components/CameraConnectPanel.jsx'
import CintilloOverlay from '../components/CintilloOverlay.jsx'
import VUMeter from '../components/VUMeter.jsx'
import PostsPanel from '../components/PostsPanel.jsx'
import styles from './Studio.module.css'

const MUSIC_TRACKS = [
  { name: 'Lo-fi Focus 01', sub: 'Sin copyright' },
  { name: 'Ambient Jazz 03', sub: 'Sin copyright' },
  { name: 'Cinematic Calm 07', sub: 'Sin copyright' },
  { name: 'Upbeat News 02', sub: 'Sin copyright' },
]

const CINTILLO_PRESETS = [
  { id: 'guest', label: 'Nombre invitado', color: '#1D9E75', tag: 'INVITADO' },
  { id: 'topic', label: 'Tema del episodio', color: '#4a90d9', tag: 'TEMA' },
  { id: 'promo', label: 'Promoción', color: '#e8612a', tag: 'PROMO' },
  { id: 'social', label: 'Redes sociales', color: '#9d8ce8', tag: 'REDES' },
]

const POS_MAP = {
  tl: { top: 10, left: 10 }, tc: { top: 10, left: '50%', transform: 'translateX(-50%)' },
  tr: { top: 10, right: 10 }, ml: { top: '50%', left: 10, transform: 'translateY(-50%)' },
  mc: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
  mr: { top: '50%', right: 10, transform: 'translateY(-50%)' },
  bl: { bottom: 50, left: 10 }, bc: { bottom: 50, left: '50%', transform: 'translateX(-50%)' },
  br: { bottom: 50, right: 10 },
}

export default function Studio({ project, user }) {
  const navigate = useNavigate()
  const {
    devices, streams, cameraMeta, activeCamera, setActiveCamera, error: camError, setError: setCamError,
    micLevel, bluetoothSupported, wifiConnecting, btScanning, wifiPresets,
    enumerateDevices, startCamera, stopCamera, connectWifiCamera,
    scanBluetoothCamera, connectBluetoothWifiStream, startMic,
  } = useWebcam()
  const { recording, duration, recordings, startRecording, stopRecording, downloadRecording, formatDuration } = useRecorder()
  const { generateCintillo, loadingCintillo } = useAI()

  const [tab, setTab] = useState('studio')
  const [liveOn, setLiveOn] = useState(false)
  const [activePlats, setActivePlats] = useState([])
  const [cintillo, setCintillo] = useState({ tag: 'TEMA', text: project?.episodeTitle || 'Bienvenidos al episodio', active: true })
  const [musicTrack, setMusicTrack] = useState(0)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicVol, setMusicVol] = useState(30)
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState('')
  const [viewers, setViewers] = useState({ facebook: 0, youtube: 0, tiktok: 0, instagram: 0 })
  const [camSlot, setCamSlot] = useState(0)
  const [showCintForm, setShowCintForm] = useState(false)
  const [cintFormText, setCintFormText] = useState('')
  const [cintFormTag, setCintFormTag] = useState('CUSTOM')
  const canvasRef = useRef()
  const compositeStreamRef = useRef()

  const proj = project || {
    name: 'Mi Podcast', episodeTitle: 'Episodio', guestName: 'Invitado', guestRole: '',
    logoPosition: 'tr', logoUrl: null, format: '16:9', cintillos: {},
    cintilloStyle: 'classic', cintilloPosition: 'bl',
  }

  // Initialize cameras and mic on mount
  useEffect(() => {
    async function init() {
      const devs = await enumerateDevices()
      if (devs.cameras.length > 0) {
        await startCamera(devs.cameras[0]?.deviceId, 0)
        if (devs.cameras[1]) await startCamera(devs.cameras[1]?.deviceId, 1)
        if (devs.cameras[2]) await startCamera(devs.cameras[2]?.deviceId, 2)
      }
      if (devs.microphones.length > 0) await startMic(devs.microphones[0]?.deviceId)
      setInitialized(true)
    }
    init()
  }, [])

  // Simulate viewer counts when live
  useEffect(() => {
    if (!liveOn) { setViewers({ facebook: 0, youtube: 0, tiktok: 0, instagram: 0 }); return }
    const int = setInterval(() => {
      setViewers(v => ({
        facebook: activePlats.includes('facebook') ? Math.max(0, v.facebook + Math.floor(Math.random() * 10 - 3)) : 0,
        youtube: activePlats.includes('youtube') ? Math.max(0, v.youtube + Math.floor(Math.random() * 8 - 2)) : 0,
        tiktok: activePlats.includes('tiktok') ? Math.max(0, v.tiktok + Math.floor(Math.random() * 15 - 4)) : 0,
        instagram: activePlats.includes('instagram') ? Math.max(0, v.instagram + Math.floor(Math.random() * 6 - 1)) : 0,
      }))
    }, 3000)
    return () => clearInterval(int)
  }, [liveOn, activePlats])

  const togglePlat = (p) => setActivePlats(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const handleRecord = () => {
    if (recording) { stopRecording(); return }
    const activeStream = streams[activeCamera ?? 0]
    if (activeStream) startRecording(activeStream)
  }

  const handleLive = () => {
    if (liveOn) { setLiveOn(false); return }
    if (activePlats.length === 0) { setActivePlats(['youtube', 'facebook']); }
    setLiveOn(true)
  }

  const showCintillo = (preset) => {
    const text = proj.cintillos?.[preset.id] || { guest: proj.guestName + (proj.guestRole ? ` · ${proj.guestRole}` : ''), topic: proj.episodeTitle, promo: 'Código: PODCAST24', social: `@${(proj.name || 'mipodcast').toLowerCase().replace(/\s/g, '')}` }[preset.id] || preset.label
    setCintillo({ tag: preset.tag, text, color: preset.color, active: true })
  }

  const handleAICintillo = async () => {
    const text = await generateCintillo({ topic: proj.episodeTitle, guest: proj.guestName, role: proj.guestRole, type: 'guest' })
    if (text) setCintillo({ tag: 'IA', text, active: true })
  }

  const submitCustomCint = () => {
    if (!cintFormText.trim()) return
    setCintillo({ tag: cintFormTag, text: cintFormText.trim(), active: true })
    setShowCintForm(false); setCintFormText(''); setCintFormTag('CUSTOM')
  }

  const totalViewers = Object.values(viewers).reduce((a, b) => a + b, 0)

  const PLAT_CONFIG = [
    { id: 'facebook', label: 'Facebook', icon: 'ti-brand-facebook', color: '#4a90d9' },
    { id: 'youtube', label: 'YouTube', icon: 'ti-brand-youtube', color: '#e05050' },
    { id: 'tiktok', label: 'TikTok', icon: 'ti-brand-tiktok', color: '#ccccdd' },
    { id: 'instagram', label: 'Instagram', icon: 'ti-brand-instagram', color: '#d4537e' },
  ]

  return (
    <div className={styles.app}>
      {/* TOPBAR */}
      <div className={styles.topbar}>
        <div className={styles.topLeft}>
          <div className={styles.winBtns}>
            <div className={`${styles.wb} ${styles.wbR}`} onClick={() => navigate('/')} title="Salir" />
            <div className={`${styles.wb} ${styles.wbY}`} />
            <div className={`${styles.wb} ${styles.wbG}`} />
          </div>
          <div className={styles.brand}>Podcast<span>Studio</span></div>
        </div>
        <div className={styles.topCenter}>
          <div className={styles.projectTag}>
            <i className="ti ti-folder" style={{ fontSize: 11 }} />
            {proj.name || 'Sin título'} {proj.episodeTitle ? `— ${proj.episodeTitle}` : ''}
          </div>
          {recording && (
            <div className={styles.recPill}>
              <div className={styles.recDot} />
              REC &nbsp;<span className={styles.recTimer}>{formatDuration(duration)}</span>
            </div>
          )}
          {liveOn && totalViewers > 0 && (
            <div className={styles.liveViewers}>
              <i className="ti ti-eye" style={{ fontSize: 10 }} />
              {totalViewers.toLocaleString()} en vivo
            </div>
          )}
        </div>
        <div className={styles.topRight}>
          {initialized && <div className={styles.aiChip}><i className="ti ti-sparkles" style={{ fontSize: 9 }} /> IA activa</div>}
          <button className={styles.iconBtn} title="Ayuda"><i className="ti ti-help" style={{ fontSize: 13 }} /></button>
          <button className={styles.iconBtn} title="Configuración"><i className="ti ti-settings" style={{ fontSize: 13 }} /></button>
        </div>
      </div>

      {/* LAYOUT */}
      <div className={styles.layout}>
        {/* LEFT SIDEBAR */}
        <div className={styles.sidebarLeft}>
          {[
            { id: 'studio', icon: 'ti-video', label: 'Estudio' },
            { id: 'posts', icon: 'ti-sparkles', label: 'Posts IA' },
            { id: 'recordings', icon: 'ti-files', label: 'Grabaciones' },
          ].map(item => (
            <button key={item.id} className={`${styles.slBtn} ${tab === item.id ? styles.slBtnActive : ''}`} onClick={() => setTab(item.id)} title={item.label}>
              <i className={`ti ${item.icon}`} />
            </button>
          ))}
          <div className={styles.slDivider} />
          <div style={{ flex: 1 }} />
          <button className={styles.slBtn} title="Mi cuenta" onClick={() => navigate('/')}>
            <i className="ti ti-user-circle" />
          </button>
        </div>

        {/* STAGE — shown when tab === studio */}
        {tab === 'studio' && (
          <div className={styles.stage}>
            {/* MAIN VIEWPORT */}
            <div className={styles.viewport}>
              <div className={styles.viewportInner} style={{ aspectRatio: proj.format === '9:16' ? '9/16' : proj.format === '1:1' ? '1/1' : '16/9' }}>
                {/* ACTIVE CAMERA */}
                <CameraView
                  stream={streams[activeCamera ?? 0]}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
                {/* SCANLINES OVERLAY */}
                <div className={styles.scanlines} />
                {/* LIVE INDICATORS */}
                {liveOn && (
                  <div className={styles.liveInds}>
                    {PLAT_CONFIG.filter(p => activePlats.includes(p.id)).map(p => (
                      <span key={p.id} className={styles.liveInd} style={{ background: p.color === '#ccccdd' ? '#1a1a22' : p.color + 'cc', border: p.color === '#ccccdd' ? '1px solid #333' : 'none' }}>
                        <i className={`ti ${p.icon}`} style={{ fontSize: 9 }} />
                        {viewers[p.id] > 0 && <span>{viewers[p.id]}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {/* LOGO OVERLAY */}
                <div className={styles.logoOverlay} style={{ position: 'absolute', ...POS_MAP[proj.logoPosition || 'tr'] }}>
                  {proj.logoUrl
                    ? <img src={proj.logoUrl} alt="Logo" style={{ height: 22, borderRadius: 4 }} />
                    : <div className={styles.logoIcon}><i className="ti ti-microphone" style={{ fontSize: 11, color: '#fff' }} /></div>
                  }
                  <span className={styles.logoText}>{proj.name || 'Mi Podcast'}</span>
                </div>
                {/* CINTILLO */}
                {cintillo.active && (
                  <CintilloOverlay
                    styleId={proj.cintilloStyle || 'classic'}
                    tag={cintillo.tag}
                    text={cintillo.text}
                    subtitle={proj.guestRole || ''}
                    accentColor={cintillo.color}
                    imageUrl={proj.logoUrl}
                    position={proj.cintilloPosition || 'bl'}
                    liveOn={liveOn}
                    totalViewers={totalViewers}
                    onClose={() => setCintillo(c => ({ ...c, active: false }))}
                  />
                )}
              </div>
            </div>

            {/* CAM STRIP */}
            <div className={styles.camStrip}>
              {[0, 1, 2].map(i => {
                const meta = cameraMeta[i]
                const typeIcon = meta?.type === 'wifi' ? 'ti-wifi' : meta?.type === 'bluetooth' ? 'ti-bluetooth' : meta?.type === 'usb' ? 'ti-plug' : null
                return (
                  <div
                    key={i}
                    className={`${styles.camThumb} ${activeCamera === i ? styles.camActive : ''}`}
                    onClick={() => { setActiveCamera(i); setCamSlot(i) }}
                  >
                    <CameraView stream={streams[i]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 7 }} />
                    {typeIcon && (
                      <div className={styles.camTypeBadge} title={meta?.label}>
                        <i className={`ti ${typeIcon}`} />
                      </div>
                    )}
                    <div className={styles.camLabel}>
                      {streams[i]
                        ? <><div className={styles.camLiveDot} />{meta?.label?.slice(0, 12) || `Cam ${i + 1}`}</>
                        : `Cam ${i + 1}`}
                    </div>
                  </div>
                )
              })}
              {/* FORMAT SELECTOR */}
              <div className={styles.fmtSelector}>
                {[{ f: '16:9', w: 26, h: 15 }, { f: '9:16', w: 12, h: 22 }, { f: '1:1', w: 18, h: 18 }].map(({ f, w, h }) => (
                  <div key={f} className={`${styles.fmtOpt} ${proj.format === f ? styles.fmtActive : ''}`} title={f}>
                    <div style={{ width: w * 0.65, height: h * 0.65, border: `1.5px solid ${proj.format === f ? 'var(--purple)' : 'var(--border-3)'}`, borderRadius: 2 }} />
                    <span style={{ fontSize: 8, color: proj.format === f ? 'var(--purple)' : 'var(--text-muted)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* POSTS TAB */}
        {tab === 'posts' && (
          <div className={styles.stage} style={{ overflow: 'hidden' }}>
            <PostsPanel project={proj} />
          </div>
        )}

        {/* RECORDINGS TAB */}
        {tab === 'recordings' && (
          <div className={styles.stage} style={{ padding: 24, overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Grabaciones</div>
            {recordings.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <i className="ti ti-video" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                  Aún no hay grabaciones. Usa el botón Grabar en el estudio.
                </div>
              : recordings.map((r, i) => (
                <div key={i} className={styles.recItem}>
                  <i className="ti ti-file-video" style={{ fontSize: 20, color: 'var(--accent)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(r.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <button className={styles.dlBtn} onClick={() => downloadRecording(r)}>
                    <i className="ti ti-download" /> Descargar
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {/* RIGHT PANEL */}
        <div className={styles.panelRight}>
          {/* CAMERAS */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Cámaras</div>
            <CameraConnectPanel
              slotIndex={camSlot}
              devices={devices}
              cameraMeta={cameraMeta}
              bluetoothSupported={bluetoothSupported}
              wifiConnecting={wifiConnecting}
              btScanning={btScanning}
              wifiPresets={wifiPresets}
              onSelectSlot={setCamSlot}
              onUsbConnect={startCamera}
              onWifiConnect={connectWifiCamera}
              onBluetoothScan={scanBluetoothCamera}
              onBluetoothWifiConnect={connectBluetoothWifiStream}
              onDisconnect={stopCamera}
            />
            {camError && (
              <div className={styles.camError}>
                <i className="ti ti-alert-circle" />
                <span>{camError}</span>
                <button type="button" onClick={() => setCamError(null)}><i className="ti ti-x" /></button>
              </div>
            )}
          </div>

          {/* AUDIO */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Audio</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-microphone" style={{ fontSize: 13, color: 'var(--text-muted)' }} />
              <VUMeter level={micLevel} bars={14} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 32 }}>
                {micLevel > 0 ? `-${Math.round(40 - micLevel * 0.32)} dB` : '–∞'}
              </span>
            </div>
          </div>

          {/* LIVE PLATFORMS */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Transmisión en vivo</div>
            <div className={styles.platGrid}>
              {PLAT_CONFIG.map(p => (
                <button key={p.id}
                  className={`${styles.platBtn} ${activePlats.includes(p.id) ? styles.platActive : ''}`}
                  style={activePlats.includes(p.id) ? { borderColor: p.color + '60', color: p.color, background: p.color + '10' } : {}}
                  onClick={() => togglePlat(p.id)}>
                  <i className={`ti ${p.icon}`} style={{ fontSize: 12 }} />
                  <span>{p.label}</span>
                  {liveOn && activePlats.includes(p.id) && viewers[p.id] > 0 && (
                    <span className={styles.platViewers}>{viewers[p.id]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* CINTILLOS */}
          <div className={styles.prSection} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div className={styles.prTitle} style={{ margin: 0 }}>Cintillos</div>
              <div className={styles.aiChipSm} style={{ marginLeft: 'auto' }}><i className="ti ti-sparkles" style={{ fontSize: 8 }} /> IA</div>
            </div>
            {CINTILLO_PRESETS.map(preset => (
              <button key={preset.id} className={styles.cintItem} onClick={() => showCintillo(preset)}>
                <div className={styles.cintDot} style={{ background: preset.color }} />
                <span className={styles.cintItemLabel}>{preset.label}</span>
                <i className="ti ti-player-play" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }} />
              </button>
            ))}
            <button className={styles.cintItem} onClick={handleAICintillo} disabled={loadingCintillo}>
              <div className={styles.cintDot} style={{ background: 'var(--purple)' }} />
              <span className={styles.cintItemLabel} style={{ color: 'var(--purple)' }}>
                {loadingCintillo ? 'Generando...' : 'Generar con IA'}
              </span>
              <i className="ti ti-sparkles" style={{ fontSize: 10, color: 'var(--purple)', marginLeft: 'auto' }} />
            </button>
            <button className={styles.cintItem} style={{ borderStyle: 'dashed' }} onClick={() => setShowCintForm(true)}>
              <div className={styles.cintDot} style={{ background: 'var(--border-3)' }} />
              <span className={styles.cintItemLabel} style={{ color: 'var(--text-muted)' }}>Agregar cintillo...</span>
              <i className="ti ti-plus" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }} />
            </button>
            {showCintForm && (
              <div className={styles.cintForm}>
                <select value={cintFormTag} onChange={e => setCintFormTag(e.target.value)} className={styles.cintSelect}>
                  {['INVITADO', 'TEMA', 'PROMO', 'REDES', 'CUSTOM'].map(t => <option key={t}>{t}</option>)}
                </select>
                <input className={styles.cintInput} value={cintFormText} onChange={e => setCintFormText(e.target.value)} placeholder="Texto del cintillo..." onKeyDown={e => e.key === 'Enter' && submitCustomCint()} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={styles.cintFormBtn} onClick={submitCustomCint}><i className="ti ti-check" /></button>
                  <button className={styles.cintFormBtn} onClick={() => setShowCintForm(false)}><i className="ti ti-x" /></button>
                </div>
              </div>
            )}
          </div>

          {/* MUSIC */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Música sin copyright</div>
            <div className={styles.musicRow}>
              <div className={styles.musicThumb}><i className="ti ti-music" style={{ fontSize: 13 }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.musicTitle}>{MUSIC_TRACKS[musicTrack].name}</div>
                <div className={styles.musicSub}>{MUSIC_TRACKS[musicTrack].sub}</div>
              </div>
              <button className={styles.musicBtn} onClick={() => setMusicPlaying(p => !p)}>
                <i className={`ti ${musicPlaying ? 'ti-player-pause' : 'ti-player-play'}`} style={{ fontSize: 13 }} />
              </button>
              <button className={styles.musicBtn} onClick={() => setMusicTrack(t => (t + 1) % MUSIC_TRACKS.length)}>
                <i className="ti ti-arrow-shuffle" style={{ fontSize: 12 }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <i className="ti ti-volume" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
              <input type="range" min={0} max={100} step={1} value={musicVol} onChange={e => setMusicVol(+e.target.value)} style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28 }}>{musicVol}%</span>
            </div>
          </div>

          {/* RECORD CONTROLS */}
          <div className={styles.recControls}>
            <button className={`${styles.rcBtn} ${styles.rcRec} ${recording ? styles.rcRecOn : ''}`} onClick={handleRecord}>
              <i className={`ti ${recording ? 'ti-player-stop' : 'ti-circle'}`} style={{ fontSize: 13 }} />
              {recording ? 'Detener' : 'Grabar'}
            </button>
            <button className={`${styles.rcBtn} ${styles.rcLive} ${liveOn ? styles.rcLiveOn : ''}`} onClick={handleLive}>
              <i className="ti ti-broadcast" style={{ fontSize: 12 }} />
              {liveOn ? 'En vivo' : 'Ir en vivo'}
            </button>
            <button className={styles.rcBtn} onClick={() => { if (recordings.length > 0) downloadRecording(recordings[recordings.length - 1]) }}>
              <i className="ti ti-download" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>
      </div>

      {/* DEVICE INIT OVERLAY */}
      {!initialized && (
        <div className={styles.initOverlay}>
          <div className={styles.initCard}>
            <i className="ti ti-loader" style={{ fontSize: 32, color: 'var(--accent)', animation: 'spin 1s linear infinite', display: 'block', marginBottom: 14 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Detectando dispositivos...</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Autoriza el acceso a cámaras y micrófono cuando el navegador lo solicite.</div>
            {initError && <div className={styles.initError}><i className="ti ti-alert-circle" /> {initError}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
