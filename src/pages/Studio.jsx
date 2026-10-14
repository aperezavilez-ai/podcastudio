import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWebcam } from '../hooks/useWebcam.js'
import { useRecorder } from '../hooks/useRecorder.js'
import { useAI } from '../hooks/useAI.js'
import ProgramPreview from '../components/ProgramPreview.jsx'
import CameraThumb from '../components/CameraThumb.jsx'
import CameraConnectPanel from '../components/CameraConnectPanel.jsx'
import CintilloStylePicker from '../components/CintilloStylePicker.jsx'
import CintilloOverlay from '../components/CintilloOverlay.jsx'
import { getCintilloStyle } from '../config/cintilloStyles.js'
import { CINTILLO_PRESETS, resolveCintilloText } from '../config/cintilloPresets.js'
import {
  CINTILLO_CAMERA_GROUPS,
  CINTILLO_POSITION_OPTIONS,
  loadCintilloPositions,
  saveCintilloPositions,
  getRoleForSlot,
  getPresetCameraSlot,
} from '../config/cintilloCameraMap.js'
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
import MicMuteButton from '../components/MicMuteButton.jsx'
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
import { saveProject } from '../lib/projects.js'
import { fetchCloudRecordings, fetchIntegrationStatus, publishToYouTube } from '../lib/integrations.js'
import { handleTeleprompterKeydown } from '../utils/teleprompterKeys.js'
import GuideModal from '../components/GuideModal.jsx'
import LandscapeGate from '../components/LandscapeGate.jsx'
import { getPlanLimits } from '../lib/planLimits.js'
import { aiPostsRemaining } from '../lib/aiUsage.js'
import { isTouchDevice } from '../lib/device.js'
import { PRIMARY_CAMERA_SLOT, CAM_SLOT_LABELS, pickPrimaryActiveSlot, getSlotLabel } from '../config/cameraSlots.js'
import { useDynamicZoom } from '../hooks/useDynamicZoom.js'
import DynamicZoomControl from '../components/DynamicZoomControl.jsx'
import CameraConnectModal from '../components/CameraConnectModal.jsx'
import SwitcherMasterBar from '../components/SwitcherMasterBar.jsx'
import { useMicMonitor } from '../hooks/useMicMonitor.js'
import styles from './Studio.module.css'

const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'
const CANONICAL_STUDIO = 'https://www.podcastudio.mx/studio'

function isWrongStudioHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host.includes('podcaststudio') || (host !== 'www.podcastudio.mx' && host !== 'localhost' && !host.endsWith('.vercel.app') && host !== '127.0.0.1')
}

const CINTILLO_PRESET_MAP = Object.fromEntries(CINTILLO_PRESETS.map(p => [p.id, p]))

export const SOCIAL_FORMAT_PRESETS = [
  {
    id: 'youtube',
    format: '16:9',
    label: 'YouTube / FB',
    ratio: '16:9',
    icon: 'ti ti-brand-youtube',
    network: 'YouTube · Facebook Watch · Twitch · Web',
    desc: 'Formato horizontal Full HD (1920x1080). Ideal para episodios completos, entrevistas en mesa y podcasts en pantallas grandes.',
    color: '#ef4444',
  },
  {
    id: 'tiktok',
    format: '9:16',
    label: 'TikTok / Reels',
    ratio: '9:16',
    icon: 'ti ti-brand-tiktok',
    network: 'TikTok · Instagram Reels · YouTube Shorts',
    desc: 'Formato vertical Full HD (1080x1920). Diseñado para teléfonos móviles con encuadre centrado y split vertical arriba/abajo.',
    color: '#00f2fe',
  },
  {
    id: 'instagram',
    format: '1:1',
    label: 'Instagram Feed',
    ratio: '1:1',
    icon: 'ti ti-brand-instagram',
    network: 'Instagram Post · Facebook Feed · LinkedIn',
    desc: 'Formato cuadrado perfecto (1080x1080). Máxima visibilidad y presencia en el feed sin recortes indeseados.',
    color: '#e1306c',
  },
]

const POS_MAP = {
  tl: { top: 10, left: 10 }, tc: { top: 10, left: '50%', transform: 'translateX(-50%)' },
  tr: { top: 10, right: 10 }, ml: { top: '50%', left: 10, transform: 'translateY(-50%)' },
  mc: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
  mr: { top: '50%', right: 10, transform: 'translateY(-50%)' },
  bl: { bottom: 50, left: 10 }, bc: { bottom: 50, left: '50%', transform: 'translateX(-50%)' },
  br: { bottom: 50, right: 10 },
}

export default function Studio({ project, user, subscription, onProjectSave, onSignOut }) {
  const navigate = useNavigate()
  const planLimits = useMemo(() => getPlanLimits(user, subscription), [user, subscription])
  const [postsQuotaTick, setPostsQuotaTick] = useState(0)
  const postsRemaining = useMemo(
    () => (planLimits.maxAiPostsPerMonth != null ? aiPostsRemaining(user?.id, planLimits) : null),
    [user?.id, planLimits, postsQuotaTick],
  )
  const [planMsg, setPlanMsg] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    devices, streams, cameraMeta, activeCamera, setActiveCamera, error: camError, setError: setCamError,
    micLevel, bluetoothSupported, wifiConnecting, btScanning, wifiPresets,
    autoConnecting, connectedCount, mobilePrimaryFacing,
    slotsCount, setSlotsCount, masterCameraSlot, setMasterCameraSlot,
    addCameraSlot, removeCameraSlot, renameCameraSlot,
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
  const [cintDisplaySec, setCintDisplaySec] = useState(10)
  const {
    trackIndex: musicTrack, playing: musicPlaying, toggle: toggleMusic,
    nextTrack: nextMusicTrack, volume: musicVol, setVolume: setMusicVol,
    loading: musicLoading, error: musicError, currentTrack: currentMusic,
    getAudioElement, selectTrackById, setPlaying: setMusicPlaying,
  } = useBackgroundMusic(MUSIC_TRACKS, 30)
  const { playSfx, playingSfxId, sfxError } = useSoundEffect()
  const [countdown, setCountdown] = useState(null)
  const [preparingRecord, setPreparingRecord] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState('')
  const [camSlot, setCamSlot] = useState(PRIMARY_CAMERA_SLOT)
  const userPickedCameraRef = useRef(false)
  const [switchMode, setSwitchMode] = useState('ai')
  const [switchInterval, setSwitchInterval] = useState(8)
  const [showCintForm, setShowCintForm] = useState(false)
  const [cintFormText, setCintFormText] = useState('')
  const [cintFormTag, setCintFormTag] = useState('CUSTOM')
  const [cintFormSlot, setCintFormSlot] = useState(1)
  const [editingCintId, setEditingCintId] = useState(null)
  const [editingCintText, setEditingCintText] = useState('')
  const [customCintillos, setCustomCintillos] = useState(() => ({
    ...(project?.cintillos || {})
  }))
  const [cintilloStyle, setCintilloStyle] = useState(() =>
    project?.cintilloStyle || localStorage.getItem('podcastudio_cintillo_style') || 'angled'
  )
  const [cintilloPositions, setCintilloPositions] = useState(loadCintilloPositions)
  const [outputFormat, setOutputFormat] = useState(() => project?.format || '16:9')
  const [micMuted, setMicMuted] = useState(false)
  const [showSocialModal, setShowSocialModal] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(true)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const [connectModalSlot, setConnectModalSlot] = useState(0)
  const [proSwitcherMode, setProSwitcherMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('podcastudio_pro_switcher') === 'true'
  })
  const [previewCamera, setPreviewCamera] = useState(null)

  const toggleProSwitcherMode = useCallback(() => {
    setProSwitcherMode(prev => {
      const next = !prev
      try { localStorage.setItem('podcastudio_pro_switcher', String(next)) } catch {}
      return next
    })
  }, [])

  const handleOpenConnectModal = useCallback((slot = 0) => {
    setConnectModalSlot(slot)
    setConnectModalOpen(true)
  }, [])

  // Modos de composición multi-cámara (Solo, PiP, Split 50/50, Triple)
  const [screenLayout, setScreenLayout] = useState(() => {
    if (typeof window === 'undefined') return 'full'
    return localStorage.getItem('podcastudio_screen_layout') || 'full'
  })
  const [pipCameraSlot, setPipCameraSlot] = useState(0)
  const [splitSecondarySlot, setSplitSecondarySlot] = useState(2)
  const [tripleTertiarySlot, setTripleTertiarySlot] = useState(0)

  const handleSelectLayout = useCallback((layoutMode) => {
    setScreenLayout(layoutMode)
    try { localStorage.setItem('podcastudio_screen_layout', layoutMode) } catch {}
  }, [])

  const handleSetPipSlot = useCallback((slot) => {
    setPipCameraSlot(slot)
    setScreenLayout('pip')
    try { localStorage.setItem('podcastudio_screen_layout', 'pip') } catch {}
  }, [])

  const handleSetSplitSlot = useCallback((slot) => {
    setSplitSecondarySlot(slot)
    setScreenLayout('split')
    try { localStorage.setItem('podcastudio_screen_layout', 'split') } catch {}
  }, [])

  const handleSetTripleSlot = useCallback((slot) => {
    setTripleTertiarySlot(slot)
    setScreenLayout('triple')
    try { localStorage.setItem('podcastudio_screen_layout', 'triple') } catch {}
  }, [])

  const handleSwapPipMaster = useCallback(() => {
    userPickedCameraRef.current = true
    const prevPgm = programCamera
    const prevPip = pipCameraSlot
    setActiveCamera(prevPip)
    setCamSlot(prevPip)
    setPipCameraSlot(prevPgm)
  }, [programCamera, pipCameraSlot, setActiveCamera, setCamSlot])

  const handleSwapSplit = useCallback(() => {
    userPickedCameraRef.current = true
    const prevPgm = programCamera
    const prevSec = splitSecondarySlot
    setActiveCamera(prevSec)
    setCamSlot(prevSec)
    setSplitSecondarySlot(prevPgm)
  }, [programCamera, splitSecondarySlot, setActiveCamera, setCamSlot])

  // Posición unificada de cintillos para la toma Master
  const [masterCintilloPosition, setMasterCintilloPosition] = useState(() => {
    if (typeof window === 'undefined') return 'bl'
    return localStorage.getItem('podcastudio_master_cintillo_pos') || 'bl'
  })
  const handleSetMasterCintilloPosition = useCallback((pos) => {
    setMasterCintilloPosition(pos)
    try { localStorage.setItem('podcastudio_master_cintillo_pos', pos) } catch {}
  }, [])

  // Secciones colapsables del panel derecho (estilo Teleprompter)
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_panel_sections')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      cameras: true,
      audio: false,
      look: false,
      publish: false,
      cintillos: false,
      aiProducer: false,
      music: false,
    }
  })

  const toggleSection = useCallback((key) => {
    setOpenSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('podcastudio_panel_sections', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])
  const canvasRef = useRef()
  const compositeStreamRef = useRef()
  const initRanRef = useRef(false)
  const panelRightRef = useRef(null)
  const panelScrollRef = useRef(null)
  const teleprompterKeyRef = useRef(0)
  const proj = {
    ...(enrichedProject || project || {
      name: 'Mi Podcast', episodeTitle: 'Episodio', guestName: 'Invitado', guestRole: '',
      logoPosition: 'tr', logoUrl: null, format: '16:9', cintillos: {},
      cintilloStyle: 'classic', cintilloPosition: 'bl',
      subtitlesEnabled: false, subtitleLanguage: 'es-MX', directorMode: 'ai', autoCintillos: true,
    }),
    cintillos: {
      ...((enrichedProject || project)?.cintillos || {}),
      ...customCintillos,
    },
    format: outputFormat,
  }

  const handleSaveCintilloText = useCallback((id, text) => {
    const trimmed = text.trim()
    setCustomCintillos(prev => {
      const updated = { ...prev, [id]: trimmed }
      const updatedProj = {
        ...proj,
        cintillos: updated,
      }
      try {
        localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
        if (user?.id) {
          saveProject(user.id, updatedProj).catch(() => {})
        }
        onProjectSave?.(updatedProj)
      } catch (e) {
        console.warn('Error guardando cintillo:', e)
      }
      return updated
    })
    setEditingCintId(null)
  }, [proj, user?.id, onProjectSave])

  const handleFormatChange = useCallback((f) => {
    setOutputFormat(f)
    const updatedProj = { ...proj, format: f }
    try {
      localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
      if (user?.id) {
        saveProject(user.id, updatedProj).catch(() => {})
      }
      onProjectSave?.(updatedProj)
    } catch (e) {
      console.warn('Error guardando formato:', e)
    }
  }, [proj, user?.id, onProjectSave])

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
    return pickPrimaryActiveSlot(streams, masterCameraSlot)
  }, [activeCamera, streams, masterCameraSlot])

  useEffect(() => {
    if (!initialized || userPickedCameraRef.current) return
    const slot = pickPrimaryActiveSlot(streams, masterCameraSlot)
    if (streams[slot] && activeCamera !== slot) setActiveCamera(slot)
  }, [initialized, streams, activeCamera, setActiveCamera, masterCameraSlot])

  const handleCut = useCallback(() => {
    if (previewCamera !== null && streams[previewCamera]) {
      userPickedCameraRef.current = true
      const prevProgram = programCamera
      setActiveCamera(previewCamera)
      setCamSlot(previewCamera)
      setPreviewCamera(prevProgram)
    }
  }, [previewCamera, streams, programCamera, setActiveCamera, setCamSlot])

  const handleAutoTransition = useCallback(() => {
    handleCut()
  }, [handleCut])

  const subtitleLang = proj.subtitleLanguage || 'es-MX'
  const { displayText: subtitleText, interim: subtitleInterim, supported: subtitlesSupported } = useSpeechSubtitles({
    enabled: subtitlesOn && recording,
    language: subtitleLang,
  })

  const {
    cintillo, animPhase, animKey, showManual, showCustom, hide: hideCintillo,
  } = useCintilloRotation({ project: proj, enabled: autoCintillos, displaySec: cintDisplaySec, positions: cintilloPositions })

  const cintilloForSlot = useCallback((slot) => {
    if (!cintillo?.active || cintillo.targetSlot !== slot) return null
    return cintillo
  }, [cintillo])

  /** Visor principal: cintillo activo renderizado sobre la toma Master */
  const cintilloForMainView = useCallback(() => {
    if (!cintillo?.active) return null
    return {
      ...cintillo,
      position: masterCintilloPosition || cintillo.position || 'bl',
    }
  }, [cintillo, masterCintilloPosition])

  useEffect(() => {
    getMicStream()?.getAudioTracks?.()?.forEach(track => {
      track.enabled = !micMuted
    })
  }, [micMuted, micLabel, getMicStream])

  useMicMonitor(getMicStream(), micMuted)

  const defaultScript = proj.teleprompterScript || [
    proj.episodeTitle && `Hoy hablamos de: ${proj.episodeTitle}`,
    proj.guestName && `Con nosotros: ${proj.guestName}${proj.guestRole ? `, ${proj.guestRole}` : ''}`,
    proj.cintillos?.topic,
    '',
    'Introduce el tema, desarrolla los puntos clave y cierra con una llamada a la acción.',
  ].filter(Boolean).join('\n\n')

  const teleprompter = useTeleprompter(defaultScript, true)

  const { look, setField: setLookField, applyPreset: applyLookPreset, resetLook } = useLookSettings()

  const { getDirectorCrop, directorStatus } = useAIDirector({
    enabled: switchMode === 'ai' && planLimits.aiDirector,
    streams,
    micLevel,
    activeCamera,
    setActiveCamera,
    minCutSec: switchInterval,
    faceZoomSec: 10,
  })

  const {
    zoomState,
    activeZoom,
    setPreset: setZoomPreset,
    setZoom: setManualZoom,
    setPan: setZoomPan,
    resetZoom,
    togglePushIn,
    getEffectiveCrop: getDynamicCrop,
  } = useDynamicZoom({ activeCamera: programCamera, recording })

  const effectiveCrop = useMemo(() => {
    if (switchMode === 'ai' && planLimits.aiDirector && typeof getDirectorCrop === 'function') {
      const aiCrop = getDirectorCrop(programCamera)
      if (aiCrop && aiCrop.zoom > 1.02) return aiCrop
    }
    const dyn = typeof getDynamicCrop === 'function' ? getDynamicCrop(programCamera) : null
    if (dyn && dyn.zoom > 1.01) return dyn
    return null
  }, [switchMode, planLimits.aiDirector, getDirectorCrop, getDynamicCrop, programCamera, zoomState, activeZoom])

  const { getProgramStream } = useStudioCompositor({
    streams,
    activeCamera: programCamera,
    format: proj.format,
    layout: screenLayout,
    pipCamera: screenLayout === 'pip' ? pipCameraSlot : null,
    secondaryCamera: screenLayout === 'split' ? splitSecondarySlot : null,
    logoUrl: proj.logoUrl,
    logoPosition: proj.logoPosition || 'tr',
    podcastName: proj.name || 'Mi Podcast',
    cintillo,
    cintilloPosition: cintillo?.position || masterCintilloPosition || 'bl',
    cintilloStyle,
    animPhase,
    animKey,
    directorCrop: effectiveCrop,
    look,
    recording,
    recordDurationSec: duration,
    compositorActive: recording || countdown !== null || preparingRecord,
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
    saveCintilloPositions(cintilloPositions)
  }, [cintilloPositions])

  useEffect(() => {
    localStorage.setItem('podcastudio_cintillo_style', cintilloStyle)
  }, [cintilloStyle])

  useEffect(() => {
    if (!planLimits.aiDirector && switchMode === 'ai') setSwitchMode('timer')
  }, [planLimits.aiDirector, switchMode])

  useEffect(() => {
    if (!project) return
    setEnrichedProject(prev => {
      if (prev?.aiPlanAt && project.aiPlanAt === prev.aiPlanAt) return prev
      return project.aiPlan ? applyAIProducerPlan(project, project.aiPlan) : null
    })
    if (project.subtitlesEnabled) setSubtitlesOn(true)
    if (project.directorMode === 'ai' && planLimits.aiDirector) setSwitchMode('ai')
    if (project.autoCintillos != null) setAutoCintillos(project.autoCintillos)
    if (project.musicVolume != null) setMusicVol(project.musicVolume)
    if (project.musicTrackId) selectTrackById(project.musicTrackId)
  }, [project])

  useEffect(() => {
    if (tab !== 'studio') return
    if (!teleprompter.visible && !recording && countdown == null) return

    const onKeyDown = (e) => {
      handleTeleprompterKeydown(e, {
        onToggle: teleprompter.toggle,
        onReset: teleprompter.reset,
        lastActionRef: teleprompterKeyRef,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, teleprompter.visible, teleprompter.toggle, teleprompter.reset, recording, countdown])

  // Atajos de teclado para switcher multicámara (1-9 = CAM 1 a 9, 0 = CAM 10, Espacio = CUT, Enter = AUTO)
  useEffect(() => {
    if (tab !== 'studio') return
    const handleKeySwitch = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.code === 'Space' && proSwitcherMode) {
        e.preventDefault()
        handleCut()
        return
      }
      if (e.code === 'Enter' && proSwitcherMode) {
        e.preventDefault()
        handleAutoTransition()
        return
      }

      let targetSlot = null
      if (e.key >= '1' && e.key <= '9') {
        targetSlot = parseInt(e.key, 10) - 1
      } else if (e.key === '0') {
        targetSlot = 9
      }
      if (targetSlot !== null && targetSlot < slotsCount) {
        e.preventDefault()
        if (proSwitcherMode) {
          setPreviewCamera(targetSlot)
        } else {
          userPickedCameraRef.current = true
          setActiveCamera(targetSlot)
          setCamSlot(targetSlot)
        }
      }
    }
    window.addEventListener('keydown', handleKeySwitch)
    return () => window.removeEventListener('keydown', handleKeySwitch)
  }, [tab, slotsCount, proSwitcherMode, handleCut, handleAutoTransition, setActiveCamera, setCamSlot])

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
        let n = await autoConnectAll(devs.cameras, planLimits.maxCameras)
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

    setPreparingRecord(true)
    teleprompter.setVisible(true)
    teleprompter.reset()
    for (let i = 3; i >= 1; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(null)

    const videoStream = getProgramStream()
    if (!videoStream) {
      setPreparingRecord(false)
      return
    }
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
    } finally {
      setPreparingRecord(false)
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
    if (cintillo.active && cintillo.presetId === preset.id) {
      hideCintillo()
      return
    }
    const txt = resolveCintilloText(preset.id, proj)
    showCustom({
      tag: preset.tag,
      text: txt,
      color: preset.color,
      targetSlot: programCamera,
      position: masterCintilloPosition,
      presetId: preset.id,
    })
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
      showCustom({ tag: 'IA', text, color: '#9d8ce8', targetSlot: getPresetCameraSlot('guest') })
    }
  }

  const handleSignOut = useCallback(async () => {
    try {
      await onSignOut?.()
    } finally {
      navigate('/auth')
    }
  }, [onSignOut, navigate])

  const toggleMicMute = useCallback(() => setMicMuted(m => !m), [])

  const submitCustomCint = () => {
    if (!cintFormText.trim()) return
    setAutoCintillos(false)
    showCustom({
      tag: cintFormTag,
      text: cintFormText.trim(),
      targetSlot: cintFormSlot,
      position: cintilloPositions[getRoleForSlot(cintFormSlot)],
    })
    setShowCintForm(false); setCintFormText(''); setCintFormTag('CUSTOM'); setCintFormSlot(1)
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
            title="Cerrar sesión"
            onClick={handleSignOut}
          >
            <i className="ti ti-logout" style={{ fontSize: 13 }} />
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
                Para activarla: añade <code>MEAI_API_KEY</code> en Vercel → Settings → Environment Variables y redeploy.
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
            <span className={styles.slBtnLabel}>Cámaras</span>
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
                data-format={proj.format}
                style={{
                  '--viewport-aspect': proj.format === '9:16' ? '9 / 16' : proj.format === '1:1' ? '1 / 1' : '16 / 9',
                  '--vp-ar': proj.format === '9:16' ? '0.5625' : proj.format === '1:1' ? '1' : '1.777777778',
                }}
              >
                <div className={styles.activeFormatBadge} title="Formato actual de grabación">
                  {proj.format === '9:16' ? (
                    <>
                      <i className="ti ti-brand-tiktok" style={{ color: '#00f2fe' }} />
                      <span>TikTok · Reels (9:16)</span>
                    </>
                  ) : proj.format === '1:1' ? (
                    <>
                      <i className="ti ti-brand-instagram" style={{ color: '#ff5f9e' }} />
                      <span>Instagram Feed (1:1)</span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-brand-youtube" style={{ color: '#ff4444' }} />
                      <span>YouTube · FB (16:9)</span>
                    </>
                  )}
                </div>
                {streams[programCamera] ? (
                  <ProgramPreview
                    stream={streams[programCamera]}
                    cameraKey={programCamera}
                    look={look}
                    directorCrop={effectiveCrop}
                    layout={screenLayout}
                    pipStream={screenLayout === 'pip' ? streams[pipCameraSlot] : null}
                    pipLabel={getSlotLabel(pipCameraSlot, cameraMeta[pipCameraSlot]?.customLabel, pipCameraSlot === masterCameraSlot)}
                    onClosePip={() => handleSelectLayout('full')}
                    secondaryStream={screenLayout === 'split' ? streams[splitSecondarySlot] : null}
                    secondaryLabel={getSlotLabel(splitSecondarySlot, cameraMeta[splitSecondarySlot]?.customLabel, splitSecondarySlot === masterCameraSlot)}
                    primaryLabel={getSlotLabel(programCamera, cameraMeta[programCamera]?.customLabel, programCamera === masterCameraSlot)}
                    onOpenConnectModal={() => handleOpenConnectModal(screenLayout === 'pip' ? pipCameraSlot : splitSecondarySlot)}
                  />
                ) : (
                  <div className={styles.noSignalViewport}>
                    <i className="ti ti-video-off" />
                    <span>Sin señal — conecta una cámara</span>
                  </div>
                )}
                {streams[programCamera] && (
                  <DynamicZoomControl
                    activeCamera={programCamera}
                    cameraLabel={getSlotLabel(programCamera, cameraMeta[programCamera]?.customLabel, programCamera === masterCameraSlot)}
                    crop={zoomState}
                    zoom={activeZoom ?? 1.0}
                    activePreset={zoomState?.presetId || zoomState?.preset || (activeZoom <= 1.02 ? 'wide' : 'custom')}
                    pushIn={!!zoomState?.pushIn}
                    focusX={zoomState?.focusX ?? 0.5}
                    focusY={zoomState?.focusY ?? 0.42}
                    onApplyPreset={setZoomPreset}
                    onPresetChange={setZoomPreset}
                    onSetZoom={setManualZoom}
                    onZoomChange={setManualZoom}
                    onPanChange={setZoomPan}
                    onTogglePushIn={togglePushIn}
                    onPushInToggle={togglePushIn}
                    onResetZoom={resetZoom}
                    onReset={resetZoom}
                  />
                )}
                {(() => {
                  const mainCint = cintilloForMainView()
                  if (!mainCint) return null
                  return (
                    <CintilloOverlay
                      styleId={cintilloStyle}
                      tag={mainCint.tag}
                      text={mainCint.text}
                      accentColor={mainCint.color}
                      position={mainCint.position}
                      size="large"
                      animPhase={animPhase}
                      animKey={animKey}
                      onClose={hideCintillo}
                    />
                  )
                })()}
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
                {(teleprompter.visible || recording || preparingRecord || countdown != null) && (
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

            {/* SWITCHER MASTER BROADCAST BAR */}
            <SwitcherMasterBar
              programCamera={programCamera}
              previewCamera={previewCamera}
              cameraMeta={cameraMeta}
              streams={streams}
              slotsCount={slotsCount}
              masterCameraSlot={masterCameraSlot}
              proSwitcherMode={proSwitcherMode}
              screenLayout={screenLayout}
              onSelectLayout={handleSelectLayout}
              pipCameraSlot={pipCameraSlot}
              onSelectPipSlot={setPipCameraSlot}
              splitSecondarySlot={splitSecondarySlot}
              onSelectSplitSecondarySlot={setSplitSecondarySlot}
              tripleTertiarySlot={tripleTertiarySlot}
              onSelectTripleTertiarySlot={setTripleTertiarySlot}
              onSwapPipMaster={handleSwapPipMaster}
              onSwapSplitSlots={handleSwapSplit}
              onSelectProgramCamera={(slot) => {
                userPickedCameraRef.current = true
                setActiveCamera(slot)
                setCamSlot(slot)
              }}
              onToggleProSwitcherMode={toggleProSwitcherMode}
              onCut={handleCut}
              onAutoTransition={handleAutoTransition}
              onOpenConnectModal={() => handleOpenConnectModal(programCamera)}
            />

            {/* MULTICÁMARA (hasta 15 cámaras) con Swisher Master */}
            <div className={styles.camStrip}>
              <div className={styles.camStripCams}>
              {Array.from({ length: slotsCount }).map((_, i) => {
                const meta = cameraMeta[i]
                const isMaster = i === masterCameraSlot
                const isLivePgm = programCamera === i
                const isPvw = proSwitcherMode && previewCamera === i && !isLivePgm
                const typeIcon = meta?.type === 'wifi' ? 'ti-wifi' : meta?.type === 'bluetooth' ? 'ti-bluetooth' : meta?.type === 'usb' ? 'ti-plug' : null
                const slotTitle = getSlotLabel(i, meta?.customLabel, isMaster)
                return (
                  <div
                    key={i}
                    className={`${styles.camThumb} ${isMaster ? styles.camThumbMaster : ''} ${isLivePgm ? styles.camActive : ''} ${isPvw ? styles.camThumbPvw : ''}`}
                    onClick={() => {
                      if (!streams[i]) {
                        handleOpenConnectModal(i)
                        return
                      }
                      if (proSwitcherMode) {
                        setPreviewCamera(i)
                      } else {
                        userPickedCameraRef.current = true
                        setActiveCamera(i)
                        setCamSlot(i)
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={`${styles.camMasterBadgeBtn} ${isMaster ? styles.camMasterBadgeActive : ''}`}
                      title={isMaster ? 'Cámara Master Principal (clic para reasignar)' : 'Hacer Master'}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMasterCameraSlot(i)
                      }}
                    >
                      {isMaster ? '★ MASTER' : 'SET MST'}
                    </button>
                    <button
                      type="button"
                      className={styles.camConfigBtn}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConnectModal(i)
                      }}
                      title="Configurar entrada de video"
                    >
                      <i className="ti ti-settings" />
                    </button>
                    <div className={styles.camActionPills}>
                      <button
                        type="button"
                        className={`${styles.camRolePill} ${screenLayout === 'pip' && pipCameraSlot === i ? styles.camRolePillPipActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (screenLayout === 'pip' && pipCameraSlot === i) {
                            handleSelectLayout('full')
                          } else {
                            handleSetPipSlot(i)
                          }
                        }}
                        title={screenLayout === 'pip' && pipCameraSlot === i ? 'Quitar de PiP' : 'Enviar como recuadro PiP'}
                      >
                        {screenLayout === 'pip' && pipCameraSlot === i ? '✓ PiP' : 'PiP'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.camRolePill} ${screenLayout === 'split' && splitSecondarySlot === i ? styles.camRolePillSplitActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (screenLayout === 'split' && splitSecondarySlot === i) {
                            handleSelectLayout('full')
                          } else {
                            handleSetSplitSlot(i)
                          }
                        }}
                        title={screenLayout === 'split' && splitSecondarySlot === i ? 'Quitar de pantalla Doble' : 'Enviar como 2ª cámara (Doble)'}
                      >
                        {screenLayout === 'split' && splitSecondarySlot === i ? '✓ 2ª' : '2ª'}
                      </button>
                    </div>
                    {isLivePgm && (
                      <div className={styles.camTallyBadge}>PGM</div>
                    )}
                    {isPvw && (
                      <div className={styles.camTallyBadgePvw}>PVW</div>
                    )}
                    <CameraThumb
                      stream={streams[i]}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 7 }}
                      cintillo={cintilloForSlot(i)}
                      cintilloPosition={cintilloForSlot(i)?.position || cintilloPositions[getRoleForSlot(i)]}
                      logoOverlay={{
                        podcastName: proj.name || 'Mi Podcast',
                        position: proj.logoPosition || 'tr',
                      }}
                      directorCrop={switchMode === 'ai' ? getDirectorCrop(i) : null}
                    />
                    {typeIcon && (
                      <div className={styles.camTypeBadge} title={meta?.label}>
                        <i className={`ti ${typeIcon}`} />
                      </div>
                    )}
                    <div className={styles.camLabel}>
                      {streams[i]
                        ? <><div className={styles.camLiveDot} />{meta?.label?.slice(0, 14) || slotTitle}</>
                        : slotTitle}
                    </div>
                  </div>
                )
              })}
              {slotsCount < 15 && (
                <button
                  type="button"
                  className={styles.addCamStripBtn}
                  onClick={() => {
                    addCameraSlot()
                    handleOpenConnectModal(slotsCount)
                  }}
                  title="Agregar otra cámara (hasta 15 cámaras)"
                >
                  <i className="ti ti-plus" />
                  <span>+ CAM</span>
                </button>
              )}
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
                  {planLimits.aiDirector && <option value="ai">Director IA</option>}
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
                        ? `Corte mín. ${switchInterval}s entre CAM 1/CAM 3 · zoom rostro 10s en laterales`
                        : `Cada ${switchInterval}s`}
                    />
                    <span className={styles.switchIntervalVal}>{switchInterval}s</span>
                  </>
                )}
              </div>
              {/* FORMAT SELECTOR + MIC MUTE + SOCIAL PRESETS */}
              <div className={styles.fmtSelector}>
                <MicMuteButton muted={micMuted} onToggle={toggleMicMute} />
                <div className={styles.socialPresets} role="group" aria-label="Formato de video y Redes Sociales">
                  {SOCIAL_FORMAT_PRESETS.map((p) => {
                    const isActive = proj.format === p.format
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`${styles.socialBtn} ${isActive ? styles.socialBtnActive : ''}`}
                        data-format={p.format}
                        title={`${p.label} (${p.ratio}): ${p.network}`}
                        onClick={() => handleFormatChange(p.format)}
                      >
                        <i className={`${p.icon} ${styles.socialBtnIcon}`} style={{ color: isActive ? undefined : p.color }} />
                        <span className={styles.socialBtnLabel}>{p.label}</span>
                        <span className={styles.socialBtnRatio}>{p.ratio}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className={styles.socialMoreBtn}
                  onClick={() => setShowSocialModal(true)}
                  title="Adaptar para cualquier red social (Facebook, Instagram, TikTok, YouTube)"
                >
                  <i className="ti ti-world" />
                  <span>Redes</span>
                </button>
              </div>
              </div>
            </div>
            </div>{/* stageStack */}
          </div>
        )}

        {/* POSTS TAB */}
        {tab === 'posts' && (
          <div className={styles.stage} style={{ overflow: 'hidden' }}>
            <PostsPanel
              project={proj}
              user={user}
              postsRemaining={postsRemaining}
              onLimitReached={() => {
                setPlanMsg('Límite de posts IA alcanzado este mes. Mejora a Pro para ilimitados.')
                setPostsQuotaTick(t => t + 1)
              }}
              onPostsGenerated={() => setPostsQuotaTick(t => t + 1)}
            />
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
          {planMsg && (
            <div className={styles.planMsg}>
              <i className="ti ti-info-circle" /> {planMsg}
              <button type="button" onClick={() => setPlanMsg('')} aria-label="Cerrar"><i className="ti ti-x" /></button>
            </div>
          )}
          {/* CAMERAS */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.cameras ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('cameras')}
            >
              <i className={`ti ti-video ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Cámaras</span>
              <span className={styles.sectionToggleBadge}>
                {connectedCount > 0 ? `${connectedCount} activa${connectedCount > 1 ? 's' : ''}` : 'Sin señal'}
              </span>
              <i className={`ti ti-chevron-${openSections.cameras ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.cameras && (
              <div className={styles.sectionBody}>
                <CameraConnectPanel
                  slotIndex={camSlot}
                  devices={devices}
                  cameraMeta={cameraMeta}
                  autoConnecting={autoConnecting}
                  connectedCount={connectedCount}
                  slotsCount={slotsCount}
                  onAddSlot={addCameraSlot}
                  onReconnectAll={async () => {
                    setCamError(null)
                    const devs = await enumerateDevices(true)
                    if (isTouchDevice()) {
                      await initMobileCameras()
                    } else {
                      let n = await autoConnectAll(devs.cameras, planLimits.maxCameras, slotsCount)
                      if (n === 0 && devs.cameras[0]) {
                        await startCamera(devs.cameras[0].deviceId, masterCameraSlot, devs.cameras[0].label)
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
            )}
          </div>

          {/* TELEPROMPTER */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${teleprompter.visible ? styles.sectionToggleActive : ''}`}
              onClick={() => teleprompter.setVisible(v => !v)}
            >
              <i className={`ti ti-script ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Teleprompter</span>
              <span className={styles.sectionToggleBadge}>
                {teleprompter.visible ? 'Activo' : 'Cerrado'}
              </span>
              <i className={`ti ti-chevron-${teleprompter.visible ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {teleprompter.visible && (
              <div className={styles.sectionBody}>
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
              </div>
            )}
          </div>

          {/* AUDIO / MIC */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.audio ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('audio')}
            >
              <i className={`ti ${micMuted ? 'ti-microphone-off' : 'ti-microphone'} ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Audio & Mic</span>
              <span className={styles.sectionToggleBadge}>
                {micMuted ? 'Mute' : (micLevel > 5 ? 'Activo' : 'Conectado')}
              </span>
              <i className={`ti ti-chevron-${openSections.audio ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.audio && (
              <div className={styles.sectionBody}>
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
            )}
          </div>

          {/* LOOK PRO */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.look ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('look')}
            >
              <i className={`ti ti-palette ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Look Pro (Color)</span>
              <span className={styles.sectionToggleBadge}>
                {look?.preset || 'Original'}
              </span>
              <i className={`ti ti-chevron-${openSections.look ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.look && (
              <div className={styles.sectionBody}>
                <LookPanel
                  look={look}
                  onPreset={applyLookPreset}
                  onField={setLookField}
                  onReset={resetLook}
                  limits={planLimits}
                />
              </div>
            )}
          </div>

          {/* PUBLICAR */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.publish ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('publish')}
            >
              <i className={`ti ti-brand-youtube ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Publicar episodio</span>
              <span className={styles.sectionToggleBadge}>
                {youtubeConnected ? 'YouTube listo' : 'Exportar'}
              </span>
              <i className={`ti ti-chevron-${openSections.publish ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.publish && (
              <div className={styles.sectionBody}>
                <PublishPanel
                  onOpenPosts={() => setTab('posts')}
                  hasRecordings={recordings.length > 0 || cloudRecordings.length > 0}
                  youtubeConnected={youtubeConnected}
                  onYouTubeConnect={integrations?.youtube ? connectYouTubeChannel : null}
                />
              </div>
            )}
          </div>

          {/* CINTILLOS */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.cintillos ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('cintillos')}
            >
              <i className={`ti ti-typography ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Cintillos & Gráficos</span>
              <span className={styles.sectionToggleBadge}>
                {cintillo.active ? 'AL AIRE' : (autoCintillos ? 'Auto rot.' : 'Manual')}
              </span>
              <i className={`ti ti-chevron-${openSections.cintillos ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.cintillos && (
              <div className={styles.sectionBody}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <div className={styles.prTitle} style={{ margin: 0 }}>Estilo y posición</div>
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
                  </div>
                )}

                <p className={styles.autoCintHint} style={{ marginTop: 8 }}>
                  Los cintillos se proyectan directamente sobre la toma Master en vivo. Configura la posición en pantalla y activa el cintillo deseado.
                </p>

                <div className={styles.cintCameraBlock}>
                  <div className={styles.cintCameraHead} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Posición en Pantalla Master</span>
                    <span style={{ fontSize: 9, opacity: 0.7, textTransform: 'none', fontWeight: 400 }}>
                      (Aplica a la toma principal)
                    </span>
                  </div>
                  <div className={styles.posGrid}>
                    {CINTILLO_POSITION_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`${styles.posBtn} ${masterCintilloPosition === p.id ? styles.posBtnActive : ''}`}
                        onClick={() => handleSetMasterCintilloPosition(p.id)}
                        title={p.label}
                      >
                        <i className={`ti ${p.icon}`} />
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Cintillos disponibles para Master:
                  </div>

                  {CINTILLO_PRESETS.map((preset) => {
                    const id = preset.id
                    const currentText = resolveCintilloText(id, proj)
                    const isEditing = editingCintId === id
                    const isCurrentActive = cintillo.active && cintillo.presetId === id
                    return (
                      <div key={id} className={`${styles.cintCard} ${isCurrentActive ? styles.cintCardActive : ''}`}>
                        <div className={styles.cintCardHeader}>
                          <div className={styles.cintDot} style={{ background: preset.color }} />
                          <div className={styles.cintCardMeta}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span className={styles.cintItemLabel}>{preset.label}</span>
                              {isCurrentActive && <span className={styles.cintLiveBadge}>AL AIRE</span>}
                            </div>
                            <span className={styles.cintCurrentText} title={currentText || 'Sin texto asignado'}>
                              {currentText || <em style={{ opacity: 0.5 }}>Sin texto asignado</em>}
                            </span>
                          </div>
                          <div className={styles.cintActions}>
                            <button
                              type="button"
                              className={`${styles.cintActionBtn} ${isEditing ? styles.cintActionBtnActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isEditing) {
                                  setEditingCintId(null)
                                } else {
                                  setEditingCintId(id)
                                  setEditingCintText(currentText)
                                }
                              }}
                              title="Editar texto del cintillo"
                            >
                              <i className="ti ti-edit" />
                            </button>
                            <button
                              type="button"
                              className={`${styles.cintActionBtn} ${isCurrentActive ? styles.cintLiveBtn : styles.cintPlayBtn}`}
                              onClick={() => showCintillo(preset)}
                              title={isCurrentActive ? 'Quitar cintillo del aire' : 'Lanzar este cintillo a Master'}
                            >
                              <i className={`ti ${isCurrentActive ? 'ti-player-stop' : 'ti-player-play'}`} />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className={styles.cintEditBox}>
                            <input
                              type="text"
                              className={styles.cintInput}
                              value={editingCintText}
                              onChange={(e) => setEditingCintText(e.target.value)}
                              placeholder={`Texto para ${preset.label}...`}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCintilloText(id, editingCintText)
                                if (e.key === 'Escape') setEditingCintId(null)
                              }}
                            />
                            <div className={styles.cintEditBtns}>
                              <button
                                type="button"
                                className={styles.cintSaveBtn}
                                onClick={() => handleSaveCintilloText(id, editingCintText)}
                              >
                                <i className="ti ti-check" /> Guardar
                              </button>
                              <button
                                type="button"
                                className={styles.cintLiveBtn}
                                onClick={() => {
                                  handleSaveCintilloText(id, editingCintText)
                                  showCintillo(preset)
                                }}
                                title="Guardar y mostrar de inmediato en Master"
                              >
                                <i className="ti ti-broadcast" /> Al aire
                              </button>
                              <button
                                type="button"
                                className={styles.cintCancelBtn}
                                onClick={() => setEditingCintId(null)}
                                title="Cancelar"
                              >
                                <i className="ti ti-x" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className={styles.cintDivider} />

                <label className={styles.autoCintToggle}>
                  <input type="checkbox" checked={autoCintillos} onChange={e => setAutoCintillos(e.target.checked)} />
                  <span><i className="ti ti-rotate-clockwise" /> Rotación automática</span>
                </label>
                {autoCintillos && (
                  <p className={styles.autoCintHint}>
                    Tema (MASTER) → Invitado (CAM 3) → Conductor (CAM 1) → Redes → Contacto → Promo · cada {cintDisplaySec}s
                  </p>
                )}
                {autoCintillos && (
                  <div className={styles.sliderRow} style={{ marginBottom: 8 }}>
                    <span>Duración</span>
                    <input type="range" min={8} max={15} value={cintDisplaySec} onChange={e => setCintDisplaySec(+e.target.value)} style={{ flex: 1 }} />
                    <span className={styles.val}>{cintDisplaySec}s</span>
                  </div>
                )}

                <button className={styles.cintItem} onClick={handleAICintillo} disabled={loadingCintillo}>
                  <div className={styles.cintDot} style={{ background: 'var(--purple)' }} />
                  <span className={styles.cintItemLabel} style={{ color: 'var(--purple)' }}>
                    {loadingCintillo ? 'Generando...' : 'Generar cintillo IA (invitado)'}
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
                    <select value={cintFormSlot} onChange={e => setCintFormSlot(+e.target.value)} className={styles.cintSelect}>
                      <option value={0}>CAM 1 · Conductor</option>
                      <option value={1}>CAM 2 · MASTER</option>
                      <option value={2}>CAM 3 · Invitado</option>
                    </select>
                    <select value={cintFormTag} onChange={e => setCintFormTag(e.target.value)} className={styles.cintSelect}>
                      {['HOST', 'INVITADO', 'TEMA', 'PROMO', 'REDES', 'CONTACTO', 'CUSTOM'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input className={styles.cintInput} value={cintFormText} onChange={e => setCintFormText(e.target.value)} placeholder="Texto del cintillo..." onKeyDown={e => e.key === 'Enter' && submitCustomCint()} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className={styles.cintFormBtn} onClick={submitCustomCint}><i className="ti ti-check" /></button>
                      <button className={styles.cintFormBtn} onClick={() => setShowCintForm(false)}><i className="ti ti-x" /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {aiConfigured && (
            <div className={styles.prSection}>
              <button
                type="button"
                className={`${styles.sectionToggle} ${openSections.aiProducer ? styles.sectionToggleActive : ''}`}
                onClick={() => toggleSection('aiProducer')}
              >
                <i className={`ti ti-robot ${styles.sectionIcon}`} />
                <span className={styles.sectionToggleTitle}>IA Productora</span>
                <span className={styles.sectionToggleBadge}>
                  {switchMode === 'ai' ? 'Director IA' : 'Configurar'}
                </span>
                <i className={`ti ti-chevron-${openSections.aiProducer ? 'up' : 'down'} ${styles.sectionChevron}`} />
              </button>
              {openSections.aiProducer && (
                <div className={styles.sectionBody}>
                  <p className={styles.autoCintHint}>
                    {producerStatus || 'Director IA, cintillos y música se configuran solos según tu evento.'}
                  </p>
                  <label className={styles.autoCintToggle}>
                    <input
                      type="checkbox"
                      checked={switchMode === 'ai'}
                      disabled={!planLimits.aiDirector}
                      onChange={e => setSwitchMode(e.target.checked ? 'ai' : 'off')}
                    />
                    Director IA de cámaras{!planLimits.aiDirector ? ' (Pro)' : ''}
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
            </div>
          )}
          {/* MUSIC */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.music ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('music')}
            >
              <i className={`ti ti-music ${styles.sectionIcon}`} />
              <span className={styles.sectionToggleTitle}>Música sin copyright</span>
              <span className={styles.sectionToggleBadge}>
                {musicPlaying ? 'Sonando' : (currentMusic ? 'Cargada' : 'Seleccionar')}
              </span>
              <i className={`ti ti-chevron-${openSections.music ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.music && (
              <div className={styles.sectionBody}>
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
            )}
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

      <CameraConnectModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        initialSlot={connectModalSlot}
        slotsCount={slotsCount}
        onAddSlot={addCameraSlot}
        devices={devices}
        cameraMeta={cameraMeta}
        streams={streams}
        masterCameraSlot={masterCameraSlot}
        onSetMaster={(slot) => setMasterCameraSlot(slot)}
        onUsbConnect={async (deviceId, slot, label) => {
          await startCamera(deviceId, slot, label)
          setConnectModalOpen(false)
        }}
        onWifiConnect={async (url, slot, label) => {
          const stream = await connectWifiCamera(url, slot, label)
          if (stream) setConnectModalOpen(false)
        }}
        onDisconnect={(slot) => {
          stopCamera(slot)
        }}
        onRenameSlot={(slot, label) => {
          renameCameraSlot(slot, label)
        }}
      />

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

      {/* MODAL ADAPTAR PARA CUALQUIER RED SOCIAL */}
      {showSocialModal && (
        <div className={styles.socialModalOverlay} onClick={() => setShowSocialModal(false)}>
          <div className={styles.socialModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.socialModalHeader}>
              <div className={styles.socialModalTitle}>
                <i className="ti ti-world" style={{ color: 'var(--accent)' }} />
                <span>Adaptar para Redes Sociales</span>
              </div>
              <button
                type="button"
                className={styles.socialModalClose}
                onClick={() => setShowSocialModal(false)}
                title="Cerrar"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className={styles.socialModalBody}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Selecciona la red social de destino. El encuadre de las cámaras, el visor y la grabación se adaptarán automáticamente:
              </p>
              <div className={styles.socialGrid}>
                {SOCIAL_FORMAT_PRESETS.map((p) => {
                  const isActive = proj.format === p.format
                  return (
                    <div
                      key={p.id}
                      className={`${styles.socialCard} ${isActive ? styles.socialCardActive : ''}`}
                      onClick={() => {
                        handleFormatChange(p.format)
                        setShowSocialModal(false)
                      }}
                    >
                      <div className={styles.socialCardIcon} style={{ background: `${p.color}22`, color: p.color }}>
                        <i className={p.icon} />
                      </div>
                      <div className={styles.socialCardInfo}>
                        <div className={styles.socialCardHeader}>
                          <span className={styles.socialCardName}>{p.network}</span>
                          <span className={styles.socialCardRatio}>{p.ratio}</span>
                          {isActive && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginLeft: 'auto' }}>
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <span className={styles.socialCardDesc}>{p.desc}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </LandscapeGate>
  )
}
