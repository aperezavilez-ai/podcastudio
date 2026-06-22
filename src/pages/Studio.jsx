import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWebcam } from '../hooks/useWebcam.js'
import { useRecorder } from '../hooks/useRecorder.js'
import { useAI } from '../hooks/useAI.js'
import CameraThumb from '../components/CameraThumb.jsx'
import CameraConnectPanel from '../components/CameraConnectPanel.jsx'
import CintilloStylePicker from '../components/CintilloStylePicker.jsx'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import { CINTILLO_PRESETS } from '../config/cintilloPresets.js'
import { useCintilloRotation } from '../hooks/useCintilloRotation.js'
import { MUSIC_TRACKS, MUSIC_GENRES, MUSIC_SFX } from '../config/musicTracks.js'
import { useBackgroundMusic } from '../hooks/useBackgroundMusic.js'
import { useSoundEffect } from '../hooks/useSoundEffect.js'
import MusicBank from '../components/MusicBank.jsx'
import { useAutoSwitcher } from '../hooks/useAutoSwitcher.js'
import { useAIDirector } from '../hooks/useAIDirector.js'
import { useStudioCompositor } from '../hooks/useStudioCompositor.js'
import { useAudioMix } from '../hooks/useAudioMix.js'
import VUMeter from '../components/VUMeter.jsx'
import MicSelector from '../components/MicSelector.jsx'
import Teleprompter from '../components/Teleprompter.jsx'
import TeleprompterDocUpload from '../components/TeleprompterDocUpload.jsx'
import TeleprompterOverlay from '../components/TeleprompterOverlay.jsx'
import PublishPanel, { connectYouTubeChannel, fetchYouTubeStatus } from '../components/PublishPanel.jsx'
import PostsPanel from '../components/PostsPanel.jsx'
import { useLookSettings } from '../hooks/useLookSettings.js'
import LookPanel from '../components/LookPanel.jsx'
import SubtitleOverlay from '../components/SubtitleOverlay.jsx'
import { useTeleprompter } from '../hooks/useTeleprompter.js'
import { useAIProducer, applyAIProducerPlan } from '../hooks/useAIProducer.js'
import { useSpeechSubtitles } from '../hooks/useSpeechSubtitles.js'
import { notifyRecordingReady } from '../lib/notifications.js'
import { useMuxUpload } from '../hooks/useMuxUpload.js'
import { fetchCloudRecordings, fetchIntegrationStatus, publishToYouTube } from '../lib/integrations.js'
import { fetchSubscription } from '../lib/billing.js'
import { isAdminUser, canAccessStudio } from '../lib/access.js'
import { isTouchDevice } from '../lib/device.js'
import { PRIMARY_CAMERA_SLOT, CAM_SLOT_LABELS, pickPrimaryActiveSlot } from '../config/cameraSlots.js'
import LandscapeGate from '../components/LandscapeGate.jsx'
import GuideModal from '../components/GuideModal.jsx'

const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'
const CANONICAL_STUDIO = 'https://www.podcastudio.mx/studio'

function isWrongStudioHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host.includes('podcaststudio') || (host !== 'www.podcastudio.mx' && host !== 'localhost' && !host.endsWith('.vercel.app') && host !== '127.0.0.1')
}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    devices, streams, cameraMeta, activeCamera, setActiveCamera, error: camError, setError: setCamError,
    micLevel, bluetoothSupported, wifiConnecting, btScanning, wifiPresets,
    autoConnecting, connectedCount, mobilePrimaryFacing,
    enumerateDevices, startCamera, initMobileCameras, switchMobilePrimaryFacing,
    autoConnectAll, connectNextCameraToSlot, stopCamera, connectWifiCamera,
    scanBluetoothCamera, connectBluetoothWifiStream, startPreferredMic, switchMic, selectedMicId, micLabel, getMicStream,
  } = useWebcam()
  const { recording, duration, recordings, converting, convertProgress, startRecording, stopRecording, downloadRecording, downloadRecordingMp4, formatDuration } = useRecorder()
  const { generateCintillo, generateTeleprompterScript, formatTeleprompterDocument, analyzeEventWithAI, loadingCintillo, loadingScript, loadingProducer, aiConfigured, checkAIStatus } = useAI()
  const { runProducer, shouldAutoRun, markRan } = useAIProducer({ analyzeEventWithAI, aiConfigured })
  const [showAiInfo, setShowAiInfo] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 1025px)').matches
  })
  const [enrichedProject, setEnrichedProject] = useState(null)
  const [producerStatus, setProducerStatus] = useState('')
  const [subtitlesOn, setSubtitlesOn] = useState(false)

  const [tab, setTab] = useState('studio')
  const { uploadRecording } = useMuxUpload()
  const [integrations, setIntegrations] = useState(null)
  const [cloudRecordings, setCloudRecordings] = useState([])
  const [muxUploading, setMuxUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [autoCintillos, setAutoCintillos] = useState(true)
  const [cintDisplaySec, setCintDisplaySec] = useState(6)
  const {
    trackIndex: musicTrack, playing: musicPlaying, toggle: toggleMusic,
    nextTrack: nextMusicTrack, volume: musicVol, setVolume: setMusicVol,
    loading: musicLoading, error: musicError, currentTrack: currentMusic,
    getAudioElement, selectTrackById, setPlaying: setMusicPlaying,
  } = useBackgroundMusic(MUSIC_TRACKS, 30)
  const { playSfx, playingSfxId, sfxError } = useSoundEffect()
  const [countdown, setCountdown] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState('')
  const [camSlot, setCamSlot] = useState(PRIMARY_CAMERA_SLOT)
  const userPickedCameraRef = useRef(false)
  const [switchMode, setSwitchMode] = useState('ai')
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
  const [outputFormat, setOutputFormat] = useState(() => project?.format || '16:9')
  const [showStylePicker, setShowStylePicker] = useState(true)
  const canvasRef = useRef()
  const compositeStreamRef = useRef()
  const initRanRef = useRef(false)
  const panelRightRef = useRef(null)
  const panelScrollRef = useRef(null)

  const proj = {
    ...(enrichedProject || project || {
      name: 'Mi Podcast', episodeTitle: 'Episodio', guestName: 'Invitado', guestRole: '',
      logoPosition: 'tr', logoUrl: null, format: '16:9', cintillos: {},
      cintilloStyle: 'classic', cintilloPosition: 'bl',
      subtitlesEnabled: false, subtitleLanguage: 'es-MX', directorMode: 'ai', autoCintillos: true,
    }),
    format: outputFormat,
  }

  useEffect(() => {
    if (project?.format) setOutputFormat(project.format)
  }, [project?.format])

  useEffect(() => {
    document.documentElement.classList.add('studio-active')
    document.body.classList.add('studio-active')
    return () => {
      document.documentElement.classList.remove('studio-active')
      document.body.classList.remove('studio-active')
    }
  }, [])

  // Bloquear scroll de página: solo el panel derecho se mueve
  useEffect(() => {
    const onWheel = (e) => {
      if (panelRightRef.current?.contains(e.target)) return
      e.preventDefault()
    }
    const onTouchMove = (e) => {
      if (panelScrollRef.current?.contains(e.target)) return
      e.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  // Rueda del mouse en panel derecho
  useEffect(() => {
    const panel = panelRightRef.current
    const scroll = panelScrollRef.current
    if (!panel || !scroll) return undefined

    const onWheel = (e) => {
      if (e.target.closest('input[type="range"]')) return
      if (scroll.scrollHeight <= scroll.clientHeight) return

      const atTop = scroll.scrollTop <= 0
      const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 1

      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      scroll.scrollTop += e.deltaY
    }

    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => panel.removeEventListener('wheel', onWheel)
  }, [])

  const openControlsPanel = useCallback(() => {
    setTab('studio')
    setPanelOpen(true)
    requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      panelRightRef.current?.classList.add(styles.panelPulse)
      window.setTimeout(() => {
        panelRightRef.current?.classList.remove(styles.panelPulse)
      }, 700)
    })
  }, [])

  const closeControlsPanel = useCallback(() => setPanelOpen(false), [])

  const toggleControlsPanel = useCallback(() => {
    setTab('studio')
    setPanelOpen((was) => {
      if (was) return false
      requestAnimationFrame(() => {
        panelScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        panelRightRef.current?.classList.add(styles.panelPulse)
        window.setTimeout(() => {
          panelRightRef.current?.classList.remove(styles.panelPulse)
        }, 700)
      })
      return true
    })
  }, [])

  const programCamera = useMemo(() => {
    if (userPickedCameraRef.current && streams[activeCamera]) return activeCamera
    return pickPrimaryActiveSlot(streams)
  }, [activeCamera, streams])

  useEffect(() => {
    if (!initialized || userPickedCameraRef.current) return
    const slot = pickPrimaryActiveSlot(streams)
    if (streams[slot] && activeCamera !== slot) setActiveCamera(slot)
  }, [initialized, streams, activeCamera, setActiveCamera])

  const subtitleLang = proj.subtitleLanguage || 'es-MX'
  const { displayText: subtitleText, interim: subtitleInterim, supported: subtitlesSupported } = useSpeechSubtitles({
    enabled: subtitlesOn && recording,
    language: subtitleLang,
  })

  const {
    cintillo, animPhase, animKey, showManual, showCustom, hide: hideCintillo,
  } = useCintilloRotation({ project: proj, enabled: autoCintillos, displaySec: cintDisplaySec })

  const defaultScript = proj.teleprompterScript || [
    proj.episodeTitle && `Hoy hablamos de: ${proj.episodeTitle}`,
    proj.guestName && `Con nosotros: ${proj.guestName}${proj.guestRole ? `, ${proj.guestRole}` : ''}`,
    proj.cintillos?.topic,
    '',
    'Introduce el tema, desarrolla los puntos clave y cierra con una llamada a la acción.',
  ].filter(Boolean).join('\n\n')

  const teleprompter = useTeleprompter(defaultScript, true)

  const { look, setField: setLookField, applyPreset: applyLookPreset, resetLook } = useLookSettings()

  const { directorCrop, directorStatus } = useAIDirector({
    enabled: switchMode === 'ai',
    streams,
    micLevel,
    activeCamera,
    setActiveCamera,
    minCutSec: switchInterval,
    shotCycleSec: Math.max(switchInterval, 5),
  })

  const { getProgramStream } = useStudioCompositor({
    streams,
    activeCamera: programCamera,
    logoUrl: proj.logoUrl,
    logoPosition: proj.logoPosition || 'tr',
    podcastName: proj.name || 'Mi Podcast',
    cintillo,
    cintilloPosition,
    cintilloStyle,
    animPhase,
    animKey,
    directorCrop: switchMode === 'ai' ? directorCrop : null,
    look,
    recording,
    recordDurationSec: duration,
  })
  const { buildRecordingStream } = useAudioMix()

  useAutoSwitcher({
    enabled: switchMode === 'timer',
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

  useEffect(() => {
    localStorage.setItem('podcastudio_bg_template', 'none')
    localStorage.setItem('podcastudio_chroma', 'false')
    localStorage.setItem('podcastudio_ai_bg', 'false')
  }, [])

  useEffect(() => {
    if (isAdminUser(user)) return undefined
    let cancelled = false
    fetchSubscription().then((sub) => {
      if (!cancelled && !canAccessStudio(user, sub)) {
        navigate('/plans', { replace: true })
      }
    })
    return () => { cancelled = true }
  }, [user, navigate])

  useEffect(() => {
    if (!project) return
    setEnrichedProject(prev => {
      if (prev?.aiPlanAt && project.aiPlanAt === prev.aiPlanAt) return prev
      return project.aiPlan ? applyAIProducerPlan(project, project.aiPlan) : null
    })
    if (project.subtitlesEnabled) setSubtitlesOn(true)
    if (project.directorMode === 'ai') setSwitchMode('ai')
    if (project.autoCintillos != null) setAutoCintillos(project.autoCintillos)
    if (project.musicVolume != null) setMusicVol(project.musicVolume)
    if (project.musicTrackId) selectTrackById(project.musicTrackId)
  }, [project])

  useEffect(() => {
    if (tab !== 'studio' || !teleprompter.visible) return

    const onKeyDown = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.target?.isContentEditable) return
      e.preventDefault()
      teleprompter.toggle()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, teleprompter.visible, teleprompter.toggle])

  // Initialize cameras and mic once on mount (evita bucle de reconexión)
  useEffect(() => {
    if (initRanRef.current) return
    initRanRef.current = true

    async function init() {
      const devs = await enumerateDevices()
      if (isTouchDevice()) {
        const n = await initMobileCameras()
        if (n === 0) setInitError('Permite el acceso a la cámara en el navegador y pulsa reconectar.')
      } else if (devs.cameras.length > 0) {
        let n = await autoConnectAll(devs.cameras)
        if (n === 0 && devs.cameras[0]) {
          await startCamera(devs.cameras[0].deviceId, PRIMARY_CAMERA_SLOT, devs.cameras[0].label)
          n = 1
        }
        if (n === 0) setInitError('Permite el acceso a la cámara en el navegador y pulsa reconectar.')
      } else {
        setInitError('No se detectaron cámaras USB. Conecta una y autoriza el acceso.')
      }
      if (devs.microphones.length > 0) await startPreferredMic(devs.microphones)
      await checkAIStatus()
      setInitialized(true)
    }
    init()
  }, [])

  // IA Productora: analiza el evento y configura cintillos, música, director y subtítulos
  useEffect(() => {
    if (!initialized || !project || !aiConfigured) return

    const applyPlan = (result) => {
      if (!result?.plan) return
      setEnrichedProject(result.project)
      if (result.music?.id) selectTrackById(result.music.id, true)
      if (result.plan.musicVolume != null) setMusicVol(result.plan.musicVolume)
      if (result.plan.subtitlesEnabled) setSubtitlesOn(true)
      if (result.plan.directorMode === 'ai') setSwitchMode('ai')
      if (result.plan.autoCintillos != null) setAutoCintillos(result.plan.autoCintillos)
      if (result.plan.teleprompterScript?.trim() && !project.teleprompterScript?.trim()) {
        teleprompter.setScript(result.plan.teleprompterScript)
        teleprompter.setVisible(true)
      }
      setProducerStatus(result.plan.producerSummary || 'IA productora activa')
    }

    if (project.aiPlan?.producerSummary) {
      applyPlan({ project: applyAIProducerPlan(project, project.aiPlan), plan: project.aiPlan, music: null })
      return
    }

    if (!shouldAutoRun(project)) return
    markRan()
    setProducerStatus('Analizando evento con IA...')
    runProducer(project).then(applyPlan)
  }, [initialized, project, aiConfigured])

  // Re-scan for newly plugged cameras
  useEffect(() => {
    if (!initialized) return
    const id = setInterval(async () => {
      const { cameras } = await enumerateDevices(false)
      const connected = Object.keys(streams).filter(k => streams[k]).length
      if (isTouchDevice()) {
        if (connected === 0) await initMobileCameras()
      } else if (cameras.length > connected) {
        await autoConnectAll(cameras)
      }
    }, 12000)
    return () => clearInterval(id)
  }, [initialized])

  useEffect(() => {
    fetchIntegrationStatus().then(setIntegrations)
    fetchYouTubeStatus().then(s => setYoutubeConnected(!!s?.connected)).catch(() => {})
    if (user?.id) {
      fetchCloudRecordings().then(setCloudRecordings).catch(() => {})
    }
  }, [user?.id])

  useEffect(() => {
    const yt = searchParams.get('youtube')
    if (!yt) return
    if (yt === 'connected') setUploadMsg('YouTube conectado correctamente')
    if (yt === 'error') setUploadMsg('No se pudo conectar YouTube')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const handleRecord = async () => {
    if (recording) { handleStopRecord(); return }
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
      teleprompter.setRecordingActive(true)
      startRecording(combined)
    } catch (e) {
      console.error('Recording mix error:', e)
      teleprompter.setRecordingActive(true)
      startRecording(videoStream)
    }
  }

  const handleStopRecord = () => {
    stopRecording(async (rec) => {
      if (user?.email) {
        notifyRecordingReady(user, {
          podcastName: proj.name,
          episodeTitle: proj.episodeTitle,
          duration: formatDuration(rec.duration ?? duration),
          fileName: rec.name,
        })
      }
      if (integrations?.mux && user?.id) {
        setMuxUploading(true)
        setUploadMsg('Subiendo a Mux…')
        const result = await uploadRecording(rec, {
          title: proj.episodeTitle || proj.name || 'Episodio',
        })
        setMuxUploading(false)
        if (result.ok) {
          setUploadMsg('Subida a Mux iniciada. Se publicará en YouTube cuando esté lista.')
          fetchCloudRecordings().then(setCloudRecordings).catch(() => {})
        } else {
          setUploadMsg(result.error || 'Error al subir a Mux')
        }
      }
    })
    teleprompter.setRecordingActive(false)
  }

  const showCintillo = (preset) => {
    setAutoCintillos(false)
    showManual(preset)
  }

  const handleGenerateScript = async () => {
    const text = await generateTeleprompterScript({
      podcast: proj.name,
      topic: proj.episodeTitle,
      guest: proj.guestName,
      role: proj.guestRole,
    })
    if (text) {
      teleprompter.setScript(text)
      teleprompter.reset()
      teleprompter.setVisible(true)
    }
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

  return (
    <LandscapeGate>
    <div className={`${styles.app} ${isTouchDevice() ? styles.touchStudio : ''}`}>
      {isWrongStudioHost() && (
        <div className={styles.domainWarn}>
          <i className="ti ti-alert-triangle" />
          <span>
            Estás en un dominio antiguo. Abre{' '}
            <a href={CANONICAL_STUDIO}>www.podcastudio.mx/studio</a>
            {' '}para ver los cambios.
          </span>
        </div>
      )}
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
        </div>
        <div className={styles.topRight}>
          <span className={styles.buildStamp} title="Versión desplegada — si no coincide, recarga sin caché">
            v{APP_BUILD}
          </span>
          {producerStatus && aiConfigured && (
            <div className={styles.producerChip} title="IA Productora">
              <i className="ti ti-robot" style={{ fontSize: 9 }} />
              {loadingProducer ? 'IA preparando...' : producerStatus.slice(0, 42)}
            </div>
          )}
          {initialized && (
            <button
              type="button"
              className={`${styles.aiChip} ${aiConfigured ? '' : styles.aiChipOff}`}
              onClick={() => setShowAiInfo(s => !s)}
              title={aiConfigured ? 'Claude activo — clic para ver funciones' : 'IA sin configurar — clic para ver cómo activarla'}
            >
              <i className="ti ti-sparkles" style={{ fontSize: 9 }} />
              {aiConfigured ? 'IA activa' : 'IA sin configurar'}
            </button>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.mobileOnly}`}
            onClick={() => openControlsPanel()}
            title="Abrir controles"
          >
            <i className="ti ti-layout-sidebar-right" style={{ fontSize: 13 }} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Guía de operación"
            onClick={() => setShowGuide(true)}
          >
            <i className="ti ti-book" style={{ fontSize: 13 }} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="Controles y ajustes"
            onClick={() => openControlsPanel()}
          >
            <i className="ti ti-settings" style={{ fontSize: 13 }} />
          </button>
        </div>
      </div>

      {showAiInfo && (
        <div className={styles.aiInfoBar}>
          <div className={styles.aiInfoInner}>
            <strong><i className="ti ti-sparkles" /> ¿Qué hace la IA en PodcastStudio?</strong>
            <ul>
              <li><b>Guion IA</b> — escribe el teleprompter del episodio</li>
              <li><b>Cintillos IA</b> — genera textos para pantalla (invitado, tema)</li>
              <li><b>Posts IA</b> — crea publicaciones y hashtags para redes</li>
              <li><b>Descarga</b> — exporta WebM/MP4 y súbelo a tus canales</li>
            </ul>
            {!aiConfigured && (
              <p className={styles.aiInfoSetup}>
                Para activarla: añade <code>ANTHROPIC_API_KEY</code> en Vercel → Settings → Environment Variables y redeploy.
              </p>
            )}
            <button type="button" className={styles.aiInfoClose} onClick={() => setShowAiInfo(false)}>
              <i className="ti ti-x" /> Cerrar
            </button>
          </div>
        </div>
      )}

      {/* LAYOUT */}
      <div className={`${styles.layout} ${!panelOpen ? styles.layoutPanelClosed : ''}`}>
        {/* LEFT SIDEBAR */}
        <div className={styles.sidebarLeft}>
          <button
            type="button"
            className={`${styles.slBtn} ${tab === 'studio' ? styles.slBtnActive : ''}`}
            onClick={() => {
              setTab('studio')
              setCamSlot(PRIMARY_CAMERA_SLOT)
              if (isTouchDevice()) openControlsPanel()
            }}
            title="Vista de cámaras"
          >
            <i className="ti ti-video" />
            <span className={styles.slBtnLabel}>Live</span>
          </button>
          <button
            type="button"
            className={`${styles.slBtn} ${showGuide ? styles.slBtnActive : ''}`}
            onClick={() => setShowGuide(true)}
            title="Guía de operación"
          >
            <i className="ti ti-book" />
            <span className={styles.slBtnLabel}>Guía</span>
          </button>
          {[
            { id: 'posts', icon: 'ti-sparkles', label: 'Posts IA', short: 'Posts' },
            { id: 'recordings', icon: 'ti-files', label: 'Grabaciones', short: 'Clips' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              className={`${styles.slBtn} ${tab === item.id ? styles.slBtnActive : ''}`}
              onClick={() => {
                setTab(item.id)
                closeControlsPanel()
                setShowGuide(false)
              }}
              title={item.label}
            >
              <i className={`ti ${item.icon}`} />
              <span className={styles.slBtnLabel}>{item.short}</span>
            </button>
          ))}
          <div className={styles.slDivider} />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className={`${styles.slBtn} ${panelOpen ? styles.slBtnActive : ''}`}
            title={panelOpen ? 'Ocultar controles y ajustes' : 'Mostrar controles y ajustes'}
            onClick={toggleControlsPanel}
          >
            <i className="ti ti-adjustments" />
            <span className={styles.slBtnLabel}>Ajustes</span>
          </button>
        </div>

        {/* STAGE — shown when tab === studio */}
        {tab === 'studio' && (
          <div className={styles.stage}>
            <div className={styles.stageStack}>
            {/* MAIN VIEWPORT — arriba */}
            <div className={styles.viewport}>
              <div
                className={styles.viewportInner}
                style={{
                  '--viewport-aspect': proj.format === '9:16' ? '9 / 16' : proj.format === '1:1' ? '1 / 1' : '16 / 9',
                  '--vp-ar': proj.format === '9:16' ? '0.5625' : proj.format === '1:1' ? '1' : '1.777777778',
                }}
              >
                {streams[programCamera] ? (
                  <CameraThumb
                    stream={streams[programCamera]}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 0 }}
                    directorCrop={switchMode === 'ai' && activeCamera === programCamera ? directorCrop : null}
                  />
                ) : (
                  <div className={styles.noSignalViewport}>
                    <i className="ti ti-video-off" />
                    <span>Sin señal — conecta una cámara</span>
                  </div>
                )}
                <div className={styles.scanlines} />
                {countdown != null && (
                  <div className={styles.countdownOverlay}>
                    <span className={styles.countdownNum}>{countdown}</span>
                  </div>
                )}
                {switchMode === 'ai' && directorStatus && (
                  <div className={styles.directorBadge}>
                    <i className="ti ti-wand" />
                    <span>{directorStatus}</span>
                  </div>
                )}
                {teleprompter.visible && (
                  <TeleprompterOverlay
                    script={teleprompter.script}
                    playing={teleprompter.playing}
                    offset={teleprompter.offset}
                    fontSize={teleprompter.fontSize}
                    mirror={teleprompter.mirror}
                    direction={teleprompter.direction}
                    onMaxScrollChange={teleprompter.setMaxScroll}
                  />
                )}
                <SubtitleOverlay
                  text={subtitleText}
                  interim={subtitleInterim}
                  visible={subtitlesOn && subtitlesSupported && recording}
                />
              </div>
            </div>

            {/* 3 CÁMARAS — justo debajo del visor; CAM 2 centro = MASTER */}
            <div className={styles.camStrip}>
              <div className={styles.camStripCams}>
              {[0, 1, 2].map(i => {
                const meta = cameraMeta[i]
                const isMaster = i === PRIMARY_CAMERA_SLOT
                const typeIcon = meta?.type === 'wifi' ? 'ti-wifi' : meta?.type === 'bluetooth' ? 'ti-bluetooth' : meta?.type === 'usb' ? 'ti-plug' : null
                return (
                  <div
                    key={i}
                    className={`${styles.camThumb} ${isMaster ? styles.camThumbMaster : ''} ${programCamera === i ? styles.camActive : ''}`}
                    onClick={() => {
                      userPickedCameraRef.current = true
                      setActiveCamera(i)
                      setCamSlot(i)
                      if (!streams[i]) connectNextCameraToSlot(i)
                    }}
                  >
                    {isMaster && (
                      <div className={styles.camMasterBadge}>MASTER</div>
                    )}
                    <CameraThumb
                      stream={streams[i]}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 7 }}
                      cintillo={cintillo?.active ? cintillo : null}
                      cintilloPosition={cintilloPosition}
                      logoOverlay={{
                        podcastName: proj.name || 'Mi Podcast',
                        position: proj.logoPosition || 'tr',
                      }}
                      directorCrop={switchMode === 'ai' && activeCamera === i ? directorCrop : null}
                    />
                    {typeIcon && (
                      <div className={styles.camTypeBadge} title={meta?.label}>
                        <i className={`ti ${typeIcon}`} />
                      </div>
                    )}
                    <div className={styles.camLabel}>
                      {streams[i]
                        ? <><div className={styles.camLiveDot} />{meta?.label?.slice(0, 14) || CAM_SLOT_LABELS[i]}</>
                        : CAM_SLOT_LABELS[i]}
                    </div>
                  </div>
                )
              })}
              </div>
              <div className={styles.camStripTools}>
              {isTouchDevice() && (
                <button
                  type="button"
                  className={styles.flipCamBtn}
                  onClick={() => switchMobilePrimaryFacing()}
                  disabled={autoConnecting}
                  title={mobilePrimaryFacing === 'environment' ? 'Cambiar a cámara frontal' : 'Cambiar a cámara trasera'}
                >
                  <i className={`ti ${mobilePrimaryFacing === 'environment' ? 'ti-camera-selfie' : 'ti-camera'}`} />
                  {mobilePrimaryFacing === 'environment' ? 'Frontal' : 'Trasera'}
                </button>
              )}
              <div className={styles.switcherControls}>
                <i className="ti ti-switch-horizontal" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
                <select
                  className={styles.switchModeSelect}
                  value={switchMode}
                  onChange={e => setSwitchMode(e.target.value)}
                  title="Modo de cambio de cámara"
                >
                  <option value="off">Manual</option>
                  <option value="timer">Auto tiempo</option>
                  <option value="ai">Director IA</option>
                </select>
                {switchMode !== 'off' && (
                  <>
                    <input
                      type="range"
                      min={4}
                      max={20}
                      value={switchInterval}
                      onChange={e => setSwitchInterval(+e.target.value)}
                      className={styles.switchInterval}
                      title={switchMode === 'ai'
                        ? `Corte mín. ${switchInterval}s · plano cada ${Math.max(switchInterval, 5)}s`
                        : `Cada ${switchInterval}s`}
                    />
                    <span className={styles.switchIntervalVal}>{switchInterval}s</span>
                  </>
                )}
              </div>
              {/* FORMAT SELECTOR */}
              <div className={styles.fmtSelector}>
                {[{ f: '16:9', w: 26, h: 15 }, { f: '9:16', w: 12, h: 22 }, { f: '1:1', w: 18, h: 18 }].map(({ f, w, h }) => (
                  <button
                    key={f}
                    type="button"
                    className={`${styles.fmtOpt} ${proj.format === f ? styles.fmtActive : ''}`}
                    title={f}
                    onClick={() => setOutputFormat(f)}
                  >
                    <div style={{ width: w * 0.65, height: h * 0.65, border: `1.5px solid ${proj.format === f ? 'var(--purple)' : 'var(--border-3)'}`, borderRadius: 2 }} />
                    <span style={{ fontSize: 8, color: proj.format === f ? 'var(--purple)' : 'var(--text-muted)' }}>{f}</span>
                  </button>
                ))}
              </div>
              </div>
            </div>
            </div>{/* stageStack */}
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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Grabaciones</div>
            {(uploadMsg || muxUploading) && (
              <div style={{ fontSize: 11, color: muxUploading ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: 12 }}>
                {muxUploading ? <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> {uploadMsg}</> : uploadMsg}
              </div>
            )}
            {converting && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Convirtiendo a MP4… {convertProgress}%
              </div>
            )}
            {cloudRecordings.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>En la nube (Mux / YouTube)</div>
                {cloudRecordings.map(cr => (
                  <div key={cr.id} className={styles.recItem}>
                    <i className="ti ti-cloud-upload" style={{ fontSize: 20, color: 'var(--green)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{cr.title || cr.file_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {cr.status}
                        {cr.youtube_video_id && ' · YouTube publicado'}
                      </div>
                    </div>
                    {cr.status === 'ready' && !cr.youtube_video_id && integrations?.youtube && (
                      <button type="button" className={styles.dlBtn} onClick={async () => {
                        try {
                          await publishToYouTube(cr.id)
                          setUploadMsg('Publicado en YouTube')
                          fetchCloudRecordings().then(setCloudRecordings)
                        } catch (e) { setUploadMsg(e.message) }
                      }}>
                        <i className="ti ti-brand-youtube" /> Publicar
                      </button>
                    )}
                    {cr.mux_playback_id && (
                      <a className={styles.dlBtn} href={`https://stream.mux.com/${cr.mux_playback_id}`} target="_blank" rel="noreferrer">
                        <i className="ti ti-player-play" /> Ver
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {recordings.length === 0 && cloudRecordings.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <i className="ti ti-video" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                  Aún no hay grabaciones. Graba en el estudio y descarga tu episodio para subirlo a tus redes.
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
        {panelOpen && (
          <button
            type="button"
            className={styles.panelBackdrop}
            onClick={closeControlsPanel}
            aria-label="Cerrar panel"
          />
        )}
        <div ref={panelRightRef} className={`${styles.panelRight} ${panelOpen ? styles.panelRightOpen : ''}`}>
          <div className={styles.panelMobileHead}>
            <span>Controles y ajustes</span>
            <button type="button" className={styles.panelCloseBtn} onClick={closeControlsPanel}>
              <i className="ti ti-x" /> Cerrar
            </button>
          </div>
          <div ref={panelScrollRef} className={styles.panelScroll}>
          <div className={styles.panelScrollInner}>
          {/* CAMERAS */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Cámaras</div>
            <CameraConnectPanel
              slotIndex={camSlot}
              devices={devices}
              cameraMeta={cameraMeta}
              autoConnecting={autoConnecting}
              connectedCount={connectedCount}
              onReconnectAll={async () => {
                setCamError(null)
                const devs = await enumerateDevices(true)
                if (isTouchDevice()) {
                  await initMobileCameras()
                } else {
                  let n = await autoConnectAll(devs.cameras)
                  if (n === 0 && devs.cameras[0]) {
                    await startCamera(devs.cameras[0].deviceId, PRIMARY_CAMERA_SLOT, devs.cameras[0].label)
                  }
                }
              }}
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

          {/* TELEPROMPTER */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={styles.styleToggle}
              onClick={() => teleprompter.setVisible(v => !v)}
            >
              <i className="ti ti-script" />
              <span>Teleprompter {teleprompter.visible ? '(activo)' : ''}</span>
              <i className={`ti ti-chevron-${teleprompter.visible ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 11 }} />
            </button>
            {teleprompter.visible && (
              <Teleprompter
                script={teleprompter.script}
                onScriptChange={teleprompter.setScript}
                playing={teleprompter.playing}
                onToggle={teleprompter.toggle}
                onReset={teleprompter.reset}
                speed={teleprompter.speed}
                onSpeedChange={teleprompter.setSpeed}
                fontSize={teleprompter.fontSize}
                onFontSizeChange={teleprompter.setFontSize}
                mirror={teleprompter.mirror}
                onMirrorChange={teleprompter.setMirror}
                direction={teleprompter.direction}
                onDirectionChange={(d) => { teleprompter.setDirection(d); teleprompter.reset() }}
                onGenerateScript={handleGenerateScript}
                generatingScript={loadingScript}
                aiConfigured={aiConfigured}
                docUpload={(
                  <TeleprompterDocUpload
                    compact
                    aiConfigured={aiConfigured}
                    processing={loadingScript}
                    onScriptReady={(text) => { teleprompter.setScript(text); teleprompter.reset(); teleprompter.setVisible(true) }}
                    onFormatWithAI={(raw) => formatTeleprompterDocument(raw, {
                      podcast: proj.name,
                      topic: proj.episodeTitle,
                      guest: proj.guestName,
                    })}
                  />
                )}
              />
            )}
          </div>

          {/* AUDIO / MIC */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Audio</div>
            <MicSelector
              microphones={devices.microphones}
              selectedMicId={selectedMicId}
              micLabel={micLabel}
              micLevel={micLevel}
              onSelectMic={switchMic}
              onRefresh={async () => {
                const devs = await enumerateDevices(false)
                await startPreferredMic(devs.microphones)
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <VUMeter level={micLevel} bars={14} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 32 }}>
                {micLevel > 0 ? `-${Math.round(40 - micLevel * 0.32)} dB` : '–∞'}
              </span>
            </div>
          </div>

          {/* LOOK PRO */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>
              Look Pro
              <span className={styles.aiChipSm} style={{ marginLeft: 6 }}><i className="ti ti-palette" /> Color</span>
            </div>
            <LookPanel
              look={look}
              onPreset={applyLookPreset}
              onField={setLookField}
              onReset={resetLook}
            />
          </div>

          {/* PUBLICAR */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Publicar episodio</div>
            <PublishPanel
              onOpenPosts={() => setTab('posts')}
              hasRecordings={recordings.length > 0 || cloudRecordings.length > 0}
              youtubeConnected={youtubeConnected}
              onYouTubeConnect={integrations?.youtube ? connectYouTubeChannel : null}
            />
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

          {aiConfigured && (
            <div className={styles.prSection}>
              <div className={styles.prTitle}>
                IA Productora
                <span className={styles.aiChipSm}><i className="ti ti-robot" /> Auto</span>
              </div>
              <p className={styles.autoCintHint}>
                {producerStatus || 'Director IA, cintillos y música se configuran solos según tu evento.'}
              </p>
              <label className={styles.autoCintToggle}>
                <input type="checkbox" checked={switchMode === 'ai'} onChange={e => setSwitchMode(e.target.checked ? 'ai' : 'off')} />
                Director IA de cámaras
              </label>
              <label className={styles.autoCintToggle}>
                <input type="checkbox" checked={autoCintillos} onChange={e => setAutoCintillos(e.target.checked)} />
                Cintillos automáticos
              </label>
              <label className={styles.autoCintToggle}>
                <input
                  type="checkbox"
                  checked={subtitlesOn}
                  disabled={!subtitlesSupported}
                  onChange={e => setSubtitlesOn(e.target.checked)}
                />
                Subtítulos al grabar {subtitlesSupported ? '' : '(Chrome/Edge)'}
              </label>
            </div>
          )}
          {/* MUSIC */}
          <div className={styles.prSection}>
            <div className={styles.prTitle}>Música sin copyright</div>
            <MusicBank
              tracks={MUSIC_TRACKS}
              sfxList={MUSIC_SFX}
              currentTrack={currentMusic}
              playing={musicPlaying}
              loading={musicLoading}
              error={musicError}
              volume={musicVol}
              onVolumeChange={setMusicVol}
              onSelectTrack={(id, autoPlay) => selectTrackById(id, autoPlay)}
              onTogglePlay={toggleMusic}
              onPlaySfx={playSfx}
              playingSfxId={playingSfxId}
              sfxError={sfxError}
              podcastGenre={proj.podcastGenre}
            />
          </div>

          {/* RECORD CONTROLS */}
          <div className={styles.recControls}>
            <button type="button" className={`${styles.rcBtn} ${styles.rcRec} ${recording ? styles.rcRecOn : ''}`} onClick={handleRecord}>
              <i className={`ti ${recording ? 'ti-player-stop' : 'ti-circle'}`} style={{ fontSize: 13 }} />
              {recording ? 'Detener' : 'Grabar'}
            </button>
            <button
              type="button"
              className={styles.rcBtn}
              onClick={() => { if (recordings.length > 0) downloadRecording(recordings[recordings.length - 1]) }}
              disabled={recordings.length === 0}
              title="Descargar última grabación"
            >
              <i className="ti ti-download" style={{ fontSize: 13 }} />
              Descargar
            </button>
            <button
              type="button"
              className={styles.rcBtn}
              onClick={() => {
                setTab('posts')
                closeControlsPanel()
              }}
              title="Generar posts para redes"
            >
              <i className="ti ti-sparkles" style={{ fontSize: 13 }} />
              Posts
            </button>
          </div>
          </div>{/* panelScrollInner */}
          </div>{/* panelScroll */}
        </div>
      </div>

      <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />

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
    </LandscapeGate>
  )
}
