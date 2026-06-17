import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebcam } from '../hooks/useWebcam.js'
import { useRecorder } from '../hooks/useRecorder.js'
import { useAI } from '../hooks/useAI.js'
import ViewportComposer from '../components/ViewportComposer.jsx'
import BackgroundPicker from '../components/BackgroundPicker.jsx'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'
import CameraView from '../components/CameraView.jsx'
import CameraConnectPanel from '../components/CameraConnectPanel.jsx'
import CintilloStylePicker from '../components/CintilloStylePicker.jsx'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import { CINTILLO_PRESETS } from '../config/cintilloPresets.js'
import { useCintilloRotation } from '../hooks/useCintilloRotation.js'
import { MUSIC_TRACKS } from '../config/musicTracks.js'
import { useBackgroundMusic } from '../hooks/useBackgroundMusic.js'
import { useAutoSwitcher } from '../hooks/useAutoSwitcher.js'
import { useStudioCompositor } from '../hooks/useStudioCompositor.js'
import { useAudioMix } from '../hooks/useAudioMix.js'
import VUMeter from '../components/VUMeter.jsx'
import PostsPanel from '../components/PostsPanel.jsx'
import styles from './Studio.module.css'

const ROTATION_PRESETS = CINTILLO_PRESETS.filter(p => ['topic', 'guest', 'social', 'contact'].includes(p.id))

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
    autoConnecting, connectedCount,
    enumerateDevices, startCamera, autoConnectAll, connectNextCameraToSlot, stopCamera, connectWifiCamera,
    scanBluetoothCamera, connectBluetoothWifiStream, startMic, getMicStream,
  } = useWebcam()
  const { recording, duration, recordings, converting, convertProgress, startRecording, stopRecording, downloadRecording, downloadRecordingMp4, formatDuration } = useRecorder()
  const { generateCintillo, loadingCintillo, aiConfigured, checkAIStatus } = useAI()

  const [tab, setTab] = useState('studio')
  const [liveOn, setLiveOn] = useState(false)
  const [activePlats, setActivePlats] = useState([])
  const [autoCintillos, setAutoCintillos] = useState(true)
  const [cintDisplaySec, setCintDisplaySec] = useState(6)
  const {
    trackIndex: musicTrack, playing: musicPlaying, toggle: toggleMusic,
    nextTrack: nextMusicTrack, volume: musicVol, setVolume: setMusicVol,
    loading: musicLoading, error: musicError, currentTrack: currentMusic,
    getAudioElement,
  } = useBackgroundMusic(MUSIC_TRACKS, 30)
  const [countdown, setCountdown] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState('')
  const [viewers, setViewers] = useState({ facebook: 0, youtube: 0, tiktok: 0, instagram: 0 })
  const [camSlot, setCamSlot] = useState(0)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [switchInterval, setSwitchInterval] = useState(8)
  const [showCintForm, setShowCintForm] = useState(false)
  const [cintFormText, setCintFormText] = useState('')
  const [cintFormTag, setCintFormTag] = useState('CUSTOM')
  const [cintilloStyle, setCintilloStyle] = useState(() =>
    project?.cintilloStyle || localStorage.getItem('podcastudio_cintillo_style') || 'angled'
  )
  const [cintilloPosition, setCintilloPosition] = useState(() =>
    project?.cintilloPosition || localStorage.getItem('podcastudio_cintillo_position') || 'bl'
  )
  const [showStylePicker, setShowStylePicker] = useState(true)
  const [showBgPicker, setShowBgPicker] = useState(true)
  const [backgroundTemplate, setBackgroundTemplate] = useState(() =>
    project?.backgroundTemplate || localStorage.getItem('podcastudio_bg_template') || 'podcast-dark'
  )
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState(project?.customBackgroundUrl || null)
  const [chromaEnabled, setChromaEnabled] = useState(() =>
    project?.chromaEnabled ?? localStorage.getItem('podcastudio_chroma') === 'true'
  )
  const [chromaSimilarity, setChromaSimilarity] = useState(project?.chromaSimilarity ?? 45)
  const [chromaSmoothness, setChromaSmoothness] = useState(project?.chromaSmoothness ?? 20)
  const [cameraScale, setCameraScale] = useState(project?.cameraScale ?? 100)
  const canvasRef = useRef()
  const compositeStreamRef = useRef()

  const proj = project || {
    name: 'Mi Podcast', episodeTitle: 'Episodio', guestName: 'Invitado', guestRole: '',
    logoPosition: 'tr', logoUrl: null, format: '16:9', cintillos: {},
    cintilloStyle: 'classic', cintilloPosition: 'bl',
    backgroundTemplate: 'podcast-dark', customBackgroundUrl: null,
    chromaEnabled: false, chromaSimilarity: 45, chromaSmoothness: 20, cameraScale: 100,
  }

  const {
    cintillo, animPhase, animKey, showManual, showCustom, hide: hideCintillo,
  } = useCintilloRotation({ project: proj, enabled: autoCintillos, displaySec: cintDisplaySec })

  const { getProgramStream, getDisplayCanvas } = useStudioCompositor({
    streams,
    activeCamera,
    backgroundTemplate,
    customBackgroundUrl,
    chromaEnabled,
    chromaSimilarity,
    chromaSmoothness,
    cameraScale,
    logoUrl: proj.logoUrl,
    logoPosition: proj.logoPosition || 'tr',
    podcastName: proj.name || 'Mi Podcast',
    cintillo,
    cintilloPosition,
  })
  const { buildRecordingStream } = useAudioMix()

  useAutoSwitcher({
    enabled: autoSwitch,
    intervalSec: switchInterval,
    streams,
    activeCamera,
    setActiveCamera,
    onlyWhileRecording: false,
    recording,
  })

  useEffect(() => {
    localStorage.setItem('podcastudio_cintillo_style', cintilloStyle)
  }, [cintilloStyle])

  useEffect(() => {
    localStorage.setItem('podcastudio_cintillo_position', cintilloPosition)
  }, [cintilloPosition])

  useEffect(() => { localStorage.setItem('podcastudio_bg_template', backgroundTemplate) }, [backgroundTemplate])
  useEffect(() => { localStorage.setItem('podcastudio_chroma', String(chromaEnabled)) }, [chromaEnabled])

  useEffect(() => {
    if (!project) return
    if (project.backgroundTemplate) setBackgroundTemplate(project.backgroundTemplate)
    if (project.customBackgroundUrl) setCustomBackgroundUrl(project.customBackgroundUrl)
    if (project.chromaEnabled != null) setChromaEnabled(project.chromaEnabled)
    if (project.chromaSimilarity != null) setChromaSimilarity(project.chromaSimilarity)
    if (project.chromaSmoothness != null) setChromaSmoothness(project.chromaSmoothness)
    if (project.cameraScale != null) setCameraScale(project.cameraScale)
  }, [project])

  const handleBgUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCustomBackgroundUrl(URL.createObjectURL(f))
  }

  // Initialize cameras and mic on mount
  useEffect(() => {
    async function init() {
      const devs = await enumerateDevices()
      if (devs.cameras.length > 0) {
        const n = await autoConnectAll(devs.cameras)
        if (n === 0) setInitError('Permite el acceso a la cámara en el navegador y pulsa reconectar.')
      } else {
        setInitError('No se detectaron cámaras USB. Conecta una y autoriza el acceso.')
      }
      if (devs.microphones.length > 0) await startMic(devs.microphones[0]?.deviceId)
      await checkAIStatus()
      setInitialized(true)
    }
    init()
  }, [enumerateDevices, autoConnectAll, startMic, checkAIStatus])

  // Re-scan for newly plugged cameras
  useEffect(() => {
    if (!initialized) return
    const id = setInterval(async () => {
      const { cameras } = await enumerateDevices(false)
      const connected = Object.values(streams).filter(Boolean).length
      if (cameras.length > connected) await autoConnectAll(cameras)
    }, 10000)
    return () => clearInterval(id)
  }, [initialized, enumerateDevices, autoConnectAll, streams])

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

  const handleRecord = async () => {
    if (recording) { stopRecording(); return }
    if (countdown) return

    for (let i = 3; i >= 1; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(null)

    const videoStream = getProgramStream()
    if (!videoStream) return
    try {
      const combined = await buildRecordingStream(videoStream, {
        micStream: getMicStream(),
        musicEl: getAudioElement(),
        musicVolume: musicVol,
        musicPlaying,
      })
      startRecording(combined)
    } catch (e) {
      console.error('Recording mix error:', e)
      startRecording(videoStream)
    }
  }

  const handleLive = () => {
    if (liveOn) { setLiveOn(false); return }
    if (activePlats.length === 0) { setActivePlats(['youtube', 'facebook']); }
    setLiveOn(true)
  }

  const showCintillo = (preset) => {
    setAutoCintillos(false)
    showManual(preset)
  }

  const handleAICintillo = async () => {
    const text = await generateCintillo({ topic: proj.episodeTitle, guest: proj.guestName, role: proj.guestRole, type: 'guest' })
    if (text) {
      setAutoCintillos(false)
      showCustom({ tag: 'IA', text, color: '#9d8ce8' })
    }
  }

  const submitCustomCint = () => {
    if (!cintFormText.trim()) return
    setAutoCintillos(false)
    showCustom({ tag: cintFormTag, text: cintFormText.trim() })
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
          {initialized && (
            <div className={`${styles.aiChip} ${aiConfigured ? '' : styles.aiChipOff}`} title={aiConfigured ? 'Claude Sonnet activo' : 'Añade ANTHROPIC_API_KEY en Vercel'}>
              <i className="ti ti-sparkles" style={{ fontSize: 9 }} />
              {aiConfigured ? 'IA activa' : 'IA sin configurar'}
            </div>
          )}
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
                <ViewportComposer
                  getDisplayCanvas={getDisplayCanvas}
                  hasStream={!!streams[activeCamera ?? 0]}
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
                {countdown != null && (
                  <div className={styles.countdownOverlay}>
                    <span className={styles.countdownNum}>{countdown}</span>
                  </div>
                )}
              </div>
            </div>

            {/* CAM STRIP */}
            <div className={styles.camStrip}>
              <div className={styles.camStripLeft}>
              {[0, 1, 2].map(i => {
                const meta = cameraMeta[i]
                const typeIcon = meta?.type === 'wifi' ? 'ti-wifi' : meta?.type === 'bluetooth' ? 'ti-bluetooth' : meta?.type === 'usb' ? 'ti-plug' : null
                return (
                  <div
                    key={i}
                    className={`${styles.camThumb} ${activeCamera === i ? styles.camActive : ''}`}
                    onClick={() => {
                      setActiveCamera(i)
                      setCamSlot(i)
                      if (!streams[i]) connectNextCameraToSlot(i)
                    }}
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
              </div>
              <div className={styles.switcherControls}>
                <label className={styles.autoSwitchToggle} title="Cambiar cámara automáticamente">
                  <input type="checkbox" checked={autoSwitch} onChange={e => setAutoSwitch(e.target.checked)} />
                  <i className="ti ti-switch-horizontal" />
                  <span>Auto</span>
                </label>
                {autoSwitch && (
                  <>
                    <input
                      type="range"
                      min={4}
                      max={20}
                      value={switchInterval}
                      onChange={e => setSwitchInterval(+e.target.value)}
                      className={styles.switchInterval}
                      title={`Cada ${switchInterval}s`}
                    />
                    <span className={styles.switchIntervalVal}>{switchInterval}s</span>
                  </>
                )}
              </div>
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
            {converting && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Convirtiendo a MP4… {convertProgress}%
              </div>
            )}
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
                    <i className="ti ti-download" /> WebM
                  </button>
                  <button className={styles.dlBtn} onClick={() => downloadRecordingMp4(r)} disabled={converting}>
                    <i className="ti ti-file-type-mp4" /> MP4
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {/* RIGHT PANEL */}
        <div className={styles.panelRight}>
          <div className={styles.panelScroll}>
          {/* CAMERAS */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Cámaras</div>
            <CameraConnectPanel
              slotIndex={camSlot}
              devices={devices}
              cameraMeta={cameraMeta}
              autoConnecting={autoConnecting}
              connectedCount={connectedCount}
              onReconnectAll={() => autoConnectAll()}
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

          {/* FONDOS / SET */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={styles.styleToggle}
              onClick={() => setShowBgPicker(s => !s)}
            >
              <i className="ti ti-photo" />
              <span>Fondo: <strong>{customBackgroundUrl ? 'Mi set' : getBackgroundTemplate(backgroundTemplate).name}</strong></span>
              <i className={`ti ti-chevron-${showBgPicker ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 11 }} />
            </button>
            {showBgPicker && (
              <BackgroundPicker
                compact
                templateId={backgroundTemplate}
                customUrl={customBackgroundUrl}
                chromaEnabled={chromaEnabled}
                chromaSimilarity={chromaSimilarity}
                chromaSmoothness={chromaSmoothness}
                cameraScale={cameraScale}
                onTemplateChange={setBackgroundTemplate}
                onCustomUpload={handleBgUpload}
                onClearCustom={() => setCustomBackgroundUrl(null)}
                onChromaChange={setChromaEnabled}
                onChromaSimilarityChange={setChromaSimilarity}
                onChromaSmoothnessChange={setChromaSmoothness}
                onCameraScaleChange={setCameraScale}
              />
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
          <div className={styles.prSection}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div className={styles.prTitle} style={{ margin: 0 }}>Cintillos</div>
              <div className={styles.aiChipSm} style={{ marginLeft: 'auto' }}><i className="ti ti-sparkles" style={{ fontSize: 8 }} /> IA</div>
            </div>

            <button
              type="button"
              className={styles.styleToggle}
              onClick={() => setShowStylePicker(s => !s)}
            >
              <i className="ti ti-palette" />
              <span>Diseño: <strong>{getCintilloStyle(cintilloStyle).name}</strong></span>
              <i className={`ti ti-chevron-${showStylePicker ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 11 }} />
            </button>

            {showStylePicker && (
              <div className={styles.stylePickerWrap}>
                <CintilloStylePicker
                  compact
                  value={cintilloStyle}
                  onChange={setCintilloStyle}
                  previewTag="TEMA"
                  previewText={proj.episodeTitle || 'Tu texto'}
                />
                <div className={styles.posRow}>
                  {[
                    { id: 'bl', icon: 'ti-arrow-down-left' },
                    { id: 'bc', icon: 'ti-arrow-down' },
                    { id: 'br', icon: 'ti-arrow-down-right' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.posBtn} ${cintilloPosition === p.id ? styles.posBtnActive : ''}`}
                      onClick={() => setCintilloPosition(p.id)}
                      title={{ bl: 'Abajo izquierda', bc: 'Abajo centro', br: 'Abajo derecha' }[p.id]}
                    >
                      <i className={`ti ${p.icon}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.cintDivider} />

            <label className={styles.autoCintToggle}>
              <input type="checkbox" checked={autoCintillos} onChange={e => setAutoCintillos(e.target.checked)} />
              <span><i className="ti ti-rotate-clockwise" /> Rotación automática</span>
            </label>
            {autoCintillos && (
              <p className={styles.autoCintHint}>
                Tema → Invitado → Redes → Contacto · cada {cintDisplaySec}s
              </p>
            )}
            {autoCintillos && (
              <div className={styles.sliderRow} style={{ marginBottom: 8 }}>
                <span>Duración</span>
                <input type="range" min={4} max={12} value={cintDisplaySec} onChange={e => setCintDisplaySec(+e.target.value)} style={{ flex: 1 }} />
                <span className={styles.val}>{cintDisplaySec}s</span>
              </div>
            )}

            <div className={styles.prTitle} style={{ marginBottom: 6 }}>Activar manual</div>
            {ROTATION_PRESETS.map(preset => (
              <button key={preset.id} className={styles.cintItem} onClick={() => showCintillo(preset)}>
                <div className={styles.cintDot} style={{ background: preset.color }} />
                <span className={styles.cintItemLabel}>{preset.label}</span>
                <i className="ti ti-player-play" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }} />
              </button>
            ))}
            {CINTILLO_PRESETS.filter(p => p.id === 'promo').map(preset => (
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
                  {['INVITADO', 'TEMA', 'PROMO', 'REDES', 'CONTACTO', 'CUSTOM'].map(t => <option key={t}>{t}</option>)}
                </select>
                <input className={styles.cintInput} value={cintFormText} onChange={e => setCintFormText(e.target.value)} placeholder="Texto del cintillo..." onKeyDown={e => e.key === 'Enter' && submitCustomCint()} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={styles.cintFormBtn} onClick={submitCustomCint}><i className="ti ti-check" /></button>
                  <button className={styles.cintFormBtn} onClick={() => setShowCintForm(false)}><i className="ti ti-x" /></button>
                </div>
              </div>
            )}
          </div>

          </div>{/* panelScroll */}

          <div className={styles.panelFooter}>
          {/* MUSIC */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Música sin copyright</div>
            <div className={styles.musicRow}>
              <div className={`${styles.musicThumb} ${musicPlaying ? styles.musicThumbActive : ''}`}>
                <i className={`ti ${musicLoading ? 'ti-loader' : 'ti-music'}`} style={musicLoading ? { animation: 'spin 1s linear infinite' } : {}} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.musicTitle}>{currentMusic.name}</div>
                <div className={styles.musicSub}>
                  {musicPlaying ? 'Reproduciendo...' : musicError || currentMusic.sub}
                </div>
              </div>
              <button className={styles.musicBtn} onClick={toggleMusic} title={musicPlaying ? 'Pausar' : 'Reproducir'}>
                <i className={`ti ${musicPlaying ? 'ti-player-pause' : 'ti-player-play'}`} style={{ fontSize: 13 }} />
              </button>
              <button className={styles.musicBtn} onClick={nextMusicTrack} title="Siguiente pista">
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
          </div>{/* panelFooter */}
        </div>
      </div>

      {/* DEVICE INIT OVERLAY */}
      {!initialized && (
        <div className={styles.initOverlay}>
          <div className={styles.initCard}>
            <i className="ti ti-loader" style={{ fontSize: 32, color: 'var(--accent)', animation: 'spin 1s linear infinite', display: 'block', marginBottom: 14 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Detectando dispositivos...</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {autoConnecting
                ? 'Conectando cámaras USB automáticamente...'
                : 'Autoriza el acceso a cámaras y micrófono cuando el navegador lo solicite.'}
            </div>
            {initError && <div className={styles.initError}><i className="ti ti-alert-circle" /> {initError}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
