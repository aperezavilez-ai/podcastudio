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
import { CINTILLO_PRESETS, resolveCintilloText, resolveCintilloSubtitle } from '../config/cintilloPresets.js'
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
import { useAudioMix, DEFAULT_DSP_SETTINGS } from '../hooks/useAudioMix.js'
import AudioDspPanel from '../components/AudioDspPanel.jsx'
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
import MultiFormatExportModal from '../components/MultiFormatExportModal.jsx'
import { useLiveStreaming } from '../hooks/useLiveStreaming.js'
import LiveStreamModal from '../components/LiveStreamModal.jsx'
import CintilloEditorModal from '../components/CintilloEditorModal.jsx'
import CameraCalibratorModal from '../components/CameraCalibratorModal.jsx'
import styles from './Studio.module.css'

const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev'
const CANONICAL_STUDIO = 'https://www.podcastudio.mx/studio'

function isWrongStudioHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host.includes('podcaststudio') || (host !== 'www.podcastudio.mx' && host !== 'localhost' && !host.endsWith('.vercel.app') && host !== '127.0.0.1')
}

const CINTILLO_PRESET_MAP = Object.fromEntries(CINTILLO_PRESETS.map(p => [p.id, p]))

export const ALL_SOCIAL_NETWORKS = ['facebook', 'youtube', 'tiktok', 'instagram']

export const SOCIAL_FORMAT_PRESETS = [
  {
    id: 'facebook',
    format: '16:9',
    label: 'Facebook',
    ratio: '16:9',
    icon: 'ti ti-brand-facebook',
    network: 'Facebook Watch · Facebook Live · Páginas FB',
    desc: 'Formato horizontal Full HD (1920x1080) optimizado para páginas de Facebook, Facebook Watch y Facebook Live.',
    color: '#1877f2',
  },
  {
    id: 'youtube',
    format: '16:9',
    label: 'YouTube',
    ratio: '16:9',
    icon: 'ti ti-brand-youtube',
    network: 'YouTube · YouTube Live · Canal',
    desc: 'Formato horizontal Full HD (1920x1080) para directos y episodios completos en YouTube.',
    color: '#ef4444',
  },
  {
    id: 'tiktok',
    format: '9:16',
    label: 'TikTok / Reels',
    ratio: '9:16',
    icon: 'ti ti-brand-tiktok',
    network: 'TikTok · Facebook Reels · Instagram Reels · Shorts',
    desc: 'Formato vertical Full HD (1080x1920) para móviles con encuadre centrado y split vertical.',
    color: '#00f2fe',
  },
  {
    id: 'instagram',
    format: '1:1',
    label: 'Instagram Feed',
    ratio: '1:1',
    icon: 'ti ti-brand-instagram',
    network: 'Instagram Post · Facebook Feed · LinkedIn',
    desc: 'Formato cuadrado perfecto (1080x1080). Máxima visibilidad y presencia en el feed.',
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
  const {
    recording, duration, recordings, converting, convertProgress,
    recoveredSession, restoreRecoveredSession, dismissRecoveredSession,
    startRecording, stopRecording, downloadRecording, downloadRecordingMp4, downloadCleanVoice, formatDuration,
  } = useRecorder()
  const [showMultiFormatModal, setShowMultiFormatModal] = useState(false)
  const [multiFormatRecording, setMultiFormatRecording] = useState(null)
  const {
    destinations: liveDestinations,
    updateDestination: updateLiveDestination,
    activeDestinations: liveActiveDestinations,
    isLive,
    liveDuration,
    formatLiveDuration,
    liveStats,
    liveError,
    setLiveError,
    startLiveStream,
    stopLiveStream,
  } = useLiveStreaming()
  const [showLiveModal, setShowLiveModal] = useState(false)
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
  const [cintillosEnabled, setCintillosEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_cintillos_enabled')
      if (saved !== null) return saved === 'true'
    } catch {}
    return false // Por defecto DESACTIVADO: "mientras no se active no entran los cintillos"
  })
  const [autoCintillos, setAutoCintillos] = useState(true)
  const [cintDisplaySec, setCintDisplaySec] = useState(10)
  const {
    trackIndex: musicTrack, playing: musicPlaying, toggle: toggleMusic,
    nextTrack: nextMusicTrack, volume: musicVol, setVolume: setMusicVol,
    duckingEnabled: musicDuckingEnabled, toggleDucking: toggleMusicDucking,
    loading: musicLoading, error: musicError, currentTrack: currentMusic,
    getAudioElement, selectTrackById, setPlaying: setMusicPlaying,
  } = useBackgroundMusic(MUSIC_TRACKS, 30, { micLevel })
  const { playSfx, playingSfxId, sfxError } = useSoundEffect()
  const [countdown, setCountdown] = useState(null)
  const [preparingRecord, setPreparingRecord] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState('')
  const [camSlot, setCamSlot] = useState(PRIMARY_CAMERA_SLOT)
  const userPickedCameraRef = useRef(false)
  const programCamera = useMemo(() => {
    if (userPickedCameraRef.current) return masterCameraSlot ?? activeCamera ?? 0
    return masterCameraSlot ?? pickPrimaryActiveSlot(streams, masterCameraSlot)
  }, [activeCamera, streams, masterCameraSlot])
  const [switchMode, setSwitchMode] = useState('ai')
  const [switchInterval, setSwitchInterval] = useState(8)
  const [showCintForm, setShowCintForm] = useState(false)
  const [cintFormText, setCintFormText] = useState('')
  const [cintFormTag, setCintFormTag] = useState('CUSTOM')
  const [cintFormSlot, setCintFormSlot] = useState(1)
  const [editingCintId, setEditingCintId] = useState(null)
  const [editingCintText, setEditingCintText] = useState('')
  const [editingCintTag, setEditingCintTag] = useState('')
  const [editingCintLabel, setEditingCintLabel] = useState('')
  const [cintilloOverrides, setCintilloOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_cintillo_overrides')
      if (saved) return JSON.parse(saved)
    } catch {}
    return project?.cintilloOverrides || {}
  })
  const [customCintilloList, setCustomCintilloList] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_custom_cintillos_list')
      if (saved) return JSON.parse(saved)
    } catch {}
    return project?.customCintillosList || []
  })
  const [customCintillos, setCustomCintillos] = useState(() => ({
    ...(project?.cintillos || {})
  }))
  const [cintilloStyle, setCintilloStyle] = useState(() =>
    project?.cintilloStyle || localStorage.getItem('podcastudio_cintillo_style') || 'angled'
  )
  const [cintilloPositions, setCintilloPositions] = useState(loadCintilloPositions)
  const [cintilloLogoUrl, setCintilloLogoUrl] = useState(() => {
    try {
      return localStorage.getItem('podcastudio_cintillo_logo') || project?.cintilloLogoUrl || null
    } catch {
      return null
    }
  })

  const handleCintilloLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result
      if (url) {
        setCintilloLogoUrl(url)
        try { localStorage.setItem('podcastudio_cintillo_logo', url) } catch {}
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const handleRemoveCintilloLogo = useCallback(() => {
    setCintilloLogoUrl(null)
    try { localStorage.removeItem('podcastudio_cintillo_logo') } catch {}
  }, [])

  // Logo permanente del Proyecto (Mosca / Watermark de Canal)
  const [projectLogoUrl, setProjectLogoUrl] = useState(() => {
    try {
      return project?.logoUrl || localStorage.getItem(`podcastudio_project_logo_${project?.id || 'default'}`) || null
    } catch {
      return null
    }
  })
  const [projectLogoPosition, setProjectLogoPosition] = useState(() => {
    try {
      return project?.logoPosition || localStorage.getItem(`podcastudio_project_logo_pos_${project?.id || 'default'}`) || 'tr'
    } catch {
      return 'tr'
    }
  })

  const handleProjectLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result
      if (url) {
        setProjectLogoUrl(url)
        try {
          localStorage.setItem(`podcastudio_project_logo_${project?.id || 'default'}`, url)
          const updatedProj = { ...(project || {}), logoUrl: url, logoPosition: projectLogoPosition }
          localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
          if (user?.id) saveProject(user.id, updatedProj).catch(() => {})
          onProjectSave?.(updatedProj)
        } catch {}
      }
    }
    reader.readAsDataURL(file)
  }, [project, projectLogoPosition, user?.id, onProjectSave])

  const handleSetProjectLogoPosition = useCallback((pos) => {
    setProjectLogoPosition(pos)
    try {
      localStorage.setItem(`podcastudio_project_logo_pos_${project?.id || 'default'}`, pos)
      const updatedProj = { ...(project || {}), logoUrl: projectLogoUrl, logoPosition: pos }
      localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
      if (user?.id) saveProject(user.id, updatedProj).catch(() => {})
      onProjectSave?.(updatedProj)
    } catch {}
  }, [project, projectLogoUrl, user?.id, onProjectSave])

  const handleRemoveProjectLogo = useCallback(() => {
    setProjectLogoUrl(null)
    try {
      localStorage.removeItem(`podcastudio_project_logo_${project?.id || 'default'}`)
      const updatedProj = { ...(project || {}), logoUrl: null }
      localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
      if (user?.id) saveProject(user.id, updatedProj).catch(() => {})
      onProjectSave?.(updatedProj)
    } catch {}
  }, [project, user?.id, onProjectSave])

  const [outputFormat, setOutputFormat] = useState(() => project?.format || '16:9')
  const [activeSocialPreset, setActiveSocialPreset] = useState(() => {
    if (project?.socialPreset) return project.socialPreset
    if (project?.format === '9:16') return 'tiktok'
    if (project?.format === '1:1') return 'instagram'
    return 'facebook'
  })
  const [micMuted, setMicMuted] = useState(false)
  const [monitorHeadphones, setMonitorHeadphones] = useState(false)
  const [selectedNetworks, setSelectedNetworks] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_selected_networks')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return ALL_SOCIAL_NETWORKS
  })

  // Cuadrícula y guías de centrado en pantalla Master (Regla de Tercios + Área Segura)
  const [showMasterGrid, setShowMasterGrid] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_master_grid')
      if (saved !== null) return saved === 'true'
    } catch {}
    return false
  })

  const toggleMasterGrid = useCallback(() => {
    setShowMasterGrid(prev => {
      const next = !prev
      try {
        localStorage.setItem('podcastudio_master_grid', String(next))
      } catch {}
      return next
    })
  }, [])

  const toggleNetwork = useCallback((networkId) => {
    setSelectedNetworks(prev => {
      let next
      if (prev.includes(networkId)) {
        if (prev.length === 1) return prev
        next = prev.filter(id => id !== networkId)
      } else {
        next = [...prev, networkId]
      }
      try {
        localStorage.setItem('podcastudio_selected_networks', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const toggleAllNetworks = useCallback(() => {
    setSelectedNetworks(prev => {
      const next = prev.length === ALL_SOCIAL_NETWORKS.length
        ? ['facebook']
        : [...ALL_SOCIAL_NETWORKS]
      try {
        localStorage.setItem('podcastudio_selected_networks', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])
  const [showSocialModal, setShowSocialModal] = useState(false)
  const [showCintEditorModal, setShowCintEditorModal] = useState(false)
  const [cintEditorData, setCintEditorData] = useState(null)
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

  // Modos de composición multi-cámara (Solo, PiP, Split 50/50, Triple, Cuádruple)
  const [screenLayout, setScreenLayoutState] = useState(() => {
    if (typeof window === 'undefined') return 'full'
    return localStorage.getItem('podcastudio_screen_layout') || 'full'
  })

  const handleSelectLayout = useCallback((layoutMode) => {
    setScreenLayoutState(layoutMode)
    try { localStorage.setItem('podcastudio_screen_layout', layoutMode) } catch {}
  }, [])
  const setScreenLayout = handleSelectLayout

  const [pipCameraSlot, setPipCameraSlotState] = useState(() => {
    if (typeof window === 'undefined') return 0
    try {
      const saved = localStorage.getItem('podcastudio_pip_slot')
      const parsed = saved !== null ? parseInt(saved, 10) : NaN
      return !isNaN(parsed) && parsed >= 0 ? parsed : 0
    } catch {
      return 0
    }
  })
  const setPipCameraSlot = useCallback((slotOrFn) => {
    setPipCameraSlotState(prev => {
      const next = typeof slotOrFn === 'function' ? slotOrFn(prev) : slotOrFn
      try { localStorage.setItem('podcastudio_pip_slot', String(next)) } catch {}
      return next
    })
  }, [])

  const [splitSecondarySlot, setSplitSecondarySlotState] = useState(() => {
    if (typeof window === 'undefined') return 1
    try {
      const saved = localStorage.getItem('podcastudio_split_secondary_slot')
      const parsed = saved !== null ? parseInt(saved, 10) : NaN
      return !isNaN(parsed) && parsed >= 0 ? parsed : 1
    } catch {
      return 1
    }
  })
  const setSplitSecondarySlot = useCallback((slotOrFn) => {
    setSplitSecondarySlotState(prev => {
      const next = typeof slotOrFn === 'function' ? slotOrFn(prev) : slotOrFn
      try { localStorage.setItem('podcastudio_split_secondary_slot', String(next)) } catch {}
      return next
    })
  }, [])

  const [tripleTertiarySlot, setTripleTertiarySlotState] = useState(() => {
    if (typeof window === 'undefined') return 2
    try {
      const saved = localStorage.getItem('podcastudio_triple_tertiary_slot')
      const parsed = saved !== null ? parseInt(saved, 10) : NaN
      return !isNaN(parsed) && parsed >= 0 ? parsed : 2
    } catch {
      return 2
    }
  })
  const setTripleTertiarySlot = useCallback((slotOrFn) => {
    setTripleTertiarySlotState(prev => {
      const next = typeof slotOrFn === 'function' ? slotOrFn(prev) : slotOrFn
      try { localStorage.setItem('podcastudio_triple_tertiary_slot', String(next)) } catch {}
      return next
    })
  }, [])

  const [quadQuaternarySlot, setQuadQuaternarySlotState] = useState(() => {
    if (typeof window === 'undefined') return 3
    try {
      const saved = localStorage.getItem('podcastudio_quad_quaternary_slot')
      const parsed = saved !== null ? parseInt(saved, 10) : NaN
      return !isNaN(parsed) && parsed >= 0 ? parsed : 3
    } catch {
      return 3
    }
  })
  const setQuadQuaternarySlot = useCallback((slotOrFn) => {
    setQuadQuaternarySlotState(prev => {
      const next = typeof slotOrFn === 'function' ? slotOrFn(prev) : slotOrFn
      try { localStorage.setItem('podcastudio_quad_quaternary_slot', String(next)) } catch {}
      return next
    })
  }, [])

  const handleSetPipSlot = useCallback((slot) => {
    setPipCameraSlot(slot)
    handleSelectLayout('pip')
  }, [handleSelectLayout, setPipCameraSlot])

  const handleSetSplitSlot = useCallback((slot) => {
    setSplitSecondarySlot(slot)
    handleSelectLayout('split')
  }, [handleSelectLayout, setSplitSecondarySlot])

  const handleSetTripleSlot = useCallback((slot) => {
    setTripleTertiarySlot(slot)
    handleSelectLayout('triple')
  }, [handleSelectLayout, setTripleTertiarySlot])

  const handleSetQuadSlot = useCallback((slot) => {
    setQuadQuaternarySlot(slot)
    handleSelectLayout('quad')
  }, [handleSelectLayout, setQuadQuaternarySlot])

  // Calidad de grabación Master (4K Ultra HD, 1080p Full HD, 720p HD)
  const [recordQuality, setRecordQuality] = useState(() => {
    try { return localStorage.getItem('podcastudio_record_quality') || '1080p' } catch { return '1080p' }
  })
  const handleSelectRecordQuality = useCallback((q) => {
    setRecordQuality(q)
    try { localStorage.setItem('podcastudio_record_quality', q) } catch {}
  }, [])

  const camStripCamsRef = useRef(null)

  // Scroll horizontal fluido con rueda del ratón en la tira de cámaras
  useEffect(() => {
    const el = camStripCamsRef.current
    if (!el) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * 1.2
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /** Promueve de inmediato cualquier cámara a MASTER (toma central grande) y limpia PiPs/multicámaras */
  const handlePromoteToMaster = useCallback((slot) => {
    userPickedCameraRef.current = true
    const prevMaster = masterCameraSlot

    // Regla de estudio: Al hacer clic en la cámara Master o en cualquier cámara para pasar a Master,
    // se limpian los PiPs / multicámaras y la toma vuelve a 1 sola cámara limpia en pantalla completa
    handleSelectLayout('full')

    setMasterCameraSlot(slot)
    setActiveCamera(slot)
    setCamSlot(slot)

    // Si la cámara seleccionada estaba asignada a una secundaria, el master previo toma ese lugar
    if (pipCameraSlot === slot) {
      setPipCameraSlot(prevMaster)
    }
    if (splitSecondarySlot === slot) {
      setSplitSecondarySlot(prevMaster)
    }
    if (tripleTertiarySlot === slot) {
      setTripleTertiarySlot(prevMaster)
    }
    if (quadQuaternarySlot === slot) {
      setQuadQuaternarySlot(prevMaster)
    }
  }, [masterCameraSlot, pipCameraSlot, splitSecondarySlot, tripleTertiarySlot, quadQuaternarySlot, setActiveCamera, setCamSlot, setMasterCameraSlot, handleSelectLayout])


  const handleTogglePipOnCamera = useCallback((slot) => {
    if (screenLayout === 'pip' && pipCameraSlot === slot) {
      handleSelectLayout('full')
      return
    }

    if (slot === masterCameraSlot) {
      const nextMaster = Array.from({ length: slotsCount })
        .map((_, idx) => idx)
        .find(idx => idx !== slot && streams[idx]) ?? (slot === 0 ? 1 : 0)
      setMasterCameraSlot(nextMaster)
      setActiveCamera(nextMaster)
      setCamSlot(nextMaster)
    }

    setPipCameraSlot(slot)
    handleSelectLayout('pip')
  }, [screenLayout, pipCameraSlot, masterCameraSlot, slotsCount, streams, handleSelectLayout, setMasterCameraSlot, setActiveCamera, setCamSlot])

  const handleToggleSplitOnCamera = useCallback((slot) => {
    if (screenLayout === 'split' && splitSecondarySlot === slot) {
      handleSelectLayout('full')
      return
    }

    if (slot === masterCameraSlot) {
      const nextMaster = Array.from({ length: slotsCount })
        .map((_, idx) => idx)
        .find(idx => idx !== slot && streams[idx]) ?? (slot === 0 ? 1 : 0)
      setMasterCameraSlot(nextMaster)
      setActiveCamera(nextMaster)
      setCamSlot(nextMaster)
    }

    setSplitSecondarySlot(slot)
    if (screenLayout !== 'triple' && screenLayout !== 'quad') {
      handleSelectLayout('split')
    }
  }, [screenLayout, splitSecondarySlot, masterCameraSlot, slotsCount, streams, handleSelectLayout, setMasterCameraSlot, setActiveCamera, setCamSlot, setSplitSecondarySlot])

  const handleToggleTripleOnCamera = useCallback((slot) => {
    if (screenLayout === 'triple' && tripleTertiarySlot === slot) {
      handleSelectLayout('full')
      return
    }

    let effectiveMaster = masterCameraSlot
    if (slot === masterCameraSlot) {
      const nextMaster = Array.from({ length: slotsCount })
        .map((_, idx) => idx)
        .find(idx => idx !== slot && streams[idx]) ?? (slot === 0 ? 1 : 0)
      setMasterCameraSlot(nextMaster)
      setActiveCamera(nextMaster)
      setCamSlot(nextMaster)
      effectiveMaster = nextMaster
    }

    if (splitSecondarySlot === slot) {
      const availableSlots = Array.from({ length: slotsCount })
        .map((_, idx) => idx)
        .filter(idx => idx !== effectiveMaster && idx !== slot)
      setSplitSecondarySlot(availableSlots[0] ?? (slot === 0 ? 1 : 0))
    }

    setTripleTertiarySlot(slot)
    if (screenLayout !== 'quad') {
      handleSelectLayout('triple')
    }
  }, [screenLayout, splitSecondarySlot, tripleTertiarySlot, masterCameraSlot, slotsCount, streams, handleSelectLayout, setMasterCameraSlot, setActiveCamera, setCamSlot, setSplitSecondarySlot, setTripleTertiarySlot])

  const handleToggleQuadOnCamera = useCallback((slot) => {
    if (screenLayout === 'quad' && quadQuaternarySlot === slot) {
      handleSelectLayout('full')
      return
    }

    let effectiveMaster = masterCameraSlot
    if (slot === masterCameraSlot) {
      const nextMaster = Array.from({ length: slotsCount })
        .map((_, idx) => idx)
        .find(idx => idx !== slot && streams[idx]) ?? (slot === 0 ? 1 : 0)
      setMasterCameraSlot(nextMaster)
      setActiveCamera(nextMaster)
      setCamSlot(nextMaster)
      effectiveMaster = nextMaster
    }

    const availableSlots = Array.from({ length: slotsCount })
      .map((_, idx) => idx)
      .filter(idx => idx !== effectiveMaster && idx !== slot)

    if (splitSecondarySlot === slot) {
      setSplitSecondarySlot(availableSlots[0] ?? 1)
    }
    if (tripleTertiarySlot === slot) {
      setTripleTertiarySlot(availableSlots[1] ?? availableSlots[0] ?? 2)
    }

    setQuadQuaternarySlot(slot)
    handleSelectLayout('quad')
  }, [screenLayout, splitSecondarySlot, tripleTertiarySlot, quadQuaternarySlot, masterCameraSlot, slotsCount, streams, handleSelectLayout, setMasterCameraSlot, setActiveCamera, setCamSlot, setSplitSecondarySlot, setTripleTertiarySlot, setQuadQuaternarySlot])

  const handleSwapPipMaster = useCallback(() => {
    handlePromoteToMaster(pipCameraSlot)
  }, [handlePromoteToMaster, pipCameraSlot])

  const handleSwapSplit = useCallback(() => {
    handlePromoteToMaster(splitSecondarySlot)
  }, [handlePromoteToMaster, splitSecondarySlot])

  // Posición unificada de cintillos para la toma Master
  const [masterCintilloPosition, setMasterCintilloPosition] = useState(() => {
    if (typeof window === 'undefined') return 'bl'
    return localStorage.getItem('podcastudio_master_cintillo_pos') || 'bl'
  })

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
      teleprompter: false,
    }
  })

  const [teleprompterOnScreen, setTeleprompterOnScreen] = useState(() => {
    try {
      return localStorage.getItem('podcastudio_teleprompter_on_screen') === 'true'
    } catch {
      return false
    }
  })

  const handleToggleTeleprompterOnScreen = useCallback(() => {
    setTeleprompterOnScreen(prev => {
      const next = !prev
      try { localStorage.setItem('podcastudio_teleprompter_on_screen', String(next)) } catch {}
      return next
    })
  }, [])

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
      format: '16:9', cintillos: {},
      cintilloStyle: 'classic', cintilloPosition: 'bl',
      subtitlesEnabled: false, subtitleLanguage: 'es-MX', directorMode: 'ai', autoCintillos: true,
    }),
    logoPosition: projectLogoPosition,
    logoUrl: projectLogoUrl,
    cintillos: {
      ...((enrichedProject || project)?.cintillos || {}),
      ...customCintillos,
    },
    format: outputFormat,
  }

  const getResolvedCintillo = useCallback((preset) => {
    const override = cintilloOverrides[preset.id] || {}
    const defaultText = resolveCintilloText(preset.id, proj)
    const effectiveText = customCintillos[preset.id] ?? override.text ?? defaultText ?? ''
    const effectiveSubtitle = override.subtitle ?? preset.subtitle ?? resolveCintilloSubtitle(preset.id, proj) ?? ''
    const effectiveTag = override.tag ?? preset.tag ?? 'INFO'
    const effectiveLabel = override.label ?? preset.label ?? 'Cintillo'
    const effectiveColor = override.color ?? preset.color ?? '#e8612a'
    return {
      ...preset,
      label: effectiveLabel,
      tag: effectiveTag,
      text: effectiveText,
      subtitle: effectiveSubtitle,
      color: effectiveColor,
      logoUrl: override.logoUrl ?? preset.logoUrl ?? cintilloLogoUrl ?? null,
      socials: override.socials ?? preset.socials ?? proj.socialHandles ?? null,
    }
  }, [cintilloOverrides, customCintillos, proj, cintilloLogoUrl])

  const startEditingCintillo = useCallback((item) => {
    const resolved = getResolvedCintillo(item)
    setEditingCintId(item.id)
    setEditingCintText(resolved.text)
    setEditingCintTag(resolved.tag)
    setEditingCintLabel(resolved.label)
  }, [getResolvedCintillo])

  const handleSaveCintilloFull = useCallback((id, { text, tag, label }) => {
    const trimmedText = (text ?? '').trim()
    const trimmedTag = (tag ?? '').trim().toUpperCase() || 'INFO'
    const trimmedLabel = (label ?? '').trim() || 'Cintillo'

    setCintilloOverrides(prev => {
      const next = {
        ...prev,
        [id]: {
          ...(prev[id] || {}),
          text: trimmedText,
          tag: trimmedTag,
          label: trimmedLabel,
        }
      }
      try { localStorage.setItem('podcastudio_cintillo_overrides', JSON.stringify(next)) } catch {}
      return next
    })

    setCustomCintillos(prev => {
      const updated = { ...prev, [id]: trimmedText }
      const updatedProj = {
        ...proj,
        cintillos: updated,
        cintilloOverrides: {
          ...(proj.cintilloOverrides || {}),
          [id]: { text: trimmedText, tag: trimmedTag, label: trimmedLabel }
        }
      }
      try {
        localStorage.setItem('podcastudio_project', JSON.stringify(updatedProj))
        if (user?.id) saveProject(user.id, updatedProj).catch(() => {})
        onProjectSave?.(updatedProj)
      } catch (e) {
        console.warn('Error guardando cintillo:', e)
      }
      return updated
    })

    setEditingCintId(null)
  }, [proj, user?.id, onProjectSave])

  const handleAddCustomCintillo = useCallback(() => {
    const newId = `cint_${Date.now()}`
    const newItem = {
      id: newId,
      label: 'Entrevista / Dato',
      tag: 'ENTREVISTA',
      text: '',
      color: '#e8612a',
      isCustom: true,
    }
    setCustomCintilloList(prev => {
      const next = [...prev, newItem]
      try { localStorage.setItem('podcastudio_custom_cintillos_list', JSON.stringify(next)) } catch {}
      return next
    })
    startEditingCintillo(newItem)
  }, [startEditingCintillo])

  const handleDeleteCustomCintillo = useCallback((id) => {
    setCustomCintilloList(prev => {
      const next = prev.filter(c => c.id !== id)
      try { localStorage.setItem('podcastudio_custom_cintillos_list', JSON.stringify(next)) } catch {}
      return next
    })
    if (editingCintId === id) setEditingCintId(null)
  }, [editingCintId])

  const handleFormatChange = useCallback((f, presetId) => {
    setOutputFormat(f)
    const effectivePreset = presetId || (f === '9:16' ? 'tiktok' : f === '1:1' ? 'instagram' : 'facebook')
    setActiveSocialPreset(effectivePreset)
    const updatedProj = { ...proj, format: f, socialPreset: effectivePreset }
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
    if (project?.format) {
      setOutputFormat(project.format)
      if (project.socialPreset) setActiveSocialPreset(project.socialPreset)
    }
  }, [project?.format, project?.socialPreset])

  useEffect(() => {
    document.documentElement.classList.add('studio-active')
    document.body.classList.add('studio-active')
    return () => {
      document.documentElement.classList.remove('studio-active')
      document.body.classList.remove('studio-active')
    }
  }, [])

  // Bloquear scroll de página global, permitiendo scroll en el panel derecho y cualquier modal
  useEffect(() => {
    const onWheel = (e) => {
      if (
        panelRightRef.current?.contains(e.target) ||
        e.target.closest?.('[class*="Modal"], [class*="modal"], [class*="dialog"], [class*="overlay"], [class*="drawer"]')
      ) {
        return
      }
      e.preventDefault()
    }
    const onTouchMove = (e) => {
      if (
        panelScrollRef.current?.contains(e.target) ||
        e.target.closest?.('[class*="Modal"], [class*="modal"], [class*="dialog"], [class*="overlay"], [class*="drawer"]')
      ) {
        return
      }
      e.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  // Rueda del mouse en panel derecho y contenedores internos con scroll (Música, Efectos, etc.)
  useEffect(() => {
    const panel = panelRightRef.current
    const scroll = panelScrollRef.current
    if (!panel || !scroll) return undefined

    const onWheel = (e) => {
      if (e.target.closest('input[type="range"]')) return

      // Verificar si el cursor está sobre un contenedor con scroll interno propio (Música, Efectos, etc.)
      let el = e.target
      while (el && el !== scroll && el !== panel) {
        if (el.scrollHeight > el.clientHeight + 2) {
          const style = window.getComputedStyle(el)
          const ov = style.overflowY
          if (ov === 'auto' || ov === 'scroll') {
            // Permitir el scroll nativo de ese contenedor interno con el mouse wheel
            return
          }
        }
        el = el.parentElement
      }

      // Si no es un contenedor interno, desplazar suavemente el panel principal
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
      setMasterCameraSlot(previewCamera)
      setCamSlot(previewCamera)
      setPreviewCamera(prevProgram)
      return
    }
    // Fallback: Si no hay cámara en Preview, conmuta a la siguiente cámara conectada
    const connectedSlots = Array.from({ length: slotsCount })
      .map((_, i) => i)
      .filter(i => streams[i])
    if (connectedSlots.length > 1) {
      const currentIdx = connectedSlots.indexOf(programCamera)
      const nextSlot = connectedSlots[(currentIdx + 1) % connectedSlots.length]
      userPickedCameraRef.current = true
      setActiveCamera(nextSlot)
      setMasterCameraSlot(nextSlot)
      setCamSlot(nextSlot)
    }
  }, [previewCamera, streams, programCamera, slotsCount, setActiveCamera, setMasterCameraSlot, setCamSlot])

  const handleAutoTransition = useCallback(() => {
    if (previewCamera !== null && streams[previewCamera] && previewCamera !== programCamera) {
      handleCut()
      return
    }
    // Si no hay cámara en Preview o estamos en modo normal:
    // AUTO conmuta suavemente a la siguiente cámara conectada disponible
    const connectedSlots = Array.from({ length: slotsCount })
      .map((_, i) => i)
      .filter(i => streams[i])
    if (connectedSlots.length > 1) {
      const currentIdx = connectedSlots.indexOf(programCamera)
      const nextSlot = connectedSlots[(currentIdx + 1) % connectedSlots.length]
      userPickedCameraRef.current = true
      setActiveCamera(nextSlot)
      setMasterCameraSlot(nextSlot)
      setCamSlot(nextSlot)
    }
  }, [previewCamera, streams, programCamera, slotsCount, handleCut, setActiveCamera, setMasterCameraSlot, setCamSlot])

  const {
    cintillo, animPhase, animKey, showManual, showCustom, hide: hideCintillo,
  } = useCintilloRotation({
    project: proj,
    enabled: cintillosEnabled && autoCintillos,
    displaySec: cintDisplaySec,
    positions: cintilloPositions,
    masterPosition: masterCintilloPosition || 'bl',
  })

  const toggleCintillosEnabled = useCallback(() => {
    setCintillosEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('podcastudio_cintillos_enabled', String(next)) } catch {}
      if (!next) {
        hideCintillo()
      } else {
        if (autoCintillos) {
          showManual('topic')
        }
      }
      return next
    })
  }, [hideCintillo, autoCintillos, showManual])

  const handleVoiceIntent = useCallback((presetId) => {
    if (!cintillosEnabled) {
      setCintillosEnabled(true)
      try { localStorage.setItem('podcastudio_cintillos_enabled', 'true') } catch {}
    }
    showManual(presetId)
  }, [showManual, cintillosEnabled])

  const subtitleLang = proj.subtitleLanguage || 'es-MX'
  const { displayText: subtitleText, interim: subtitleInterim, supported: subtitlesSupported } = useSpeechSubtitles({
    enabled: subtitlesOn || switchMode === 'ai',
    language: subtitleLang,
    onVoiceIntent: handleVoiceIntent,
    renderSubtitles: subtitlesOn,
  })

  const cintilloForSlot = useCallback((slot) => {
    if (!cintillosEnabled || !cintillo?.active || cintillo.targetSlot !== slot) return null
    return cintillo
  }, [cintillosEnabled, cintillo])

  /** Visor principal: cintillo activo renderizado sobre la toma Master */
  const cintilloForMainView = useCallback(() => {
    if (!cintillosEnabled || !cintillo?.active) return null
    return {
      ...cintillo,
      position: masterCintilloPosition || cintillo.position || 'bl',
      logoUrl: cintillo.logoUrl || cintilloLogoUrl || null,
    }
  }, [cintillosEnabled, cintillo, masterCintilloPosition, cintilloLogoUrl])

  const handleSetMasterCintilloPosition = useCallback((pos) => {
    setMasterCintilloPosition(pos)
    try { localStorage.setItem('podcastudio_master_cintillo_pos', pos) } catch {}
    if (cintillo?.active) {
      showCustom({
        tag: cintillo.tag,
        text: cintillo.text,
        subtitle: cintillo.subtitle,
        color: cintillo.color,
        targetSlot: programCamera,
        position: pos,
        presetId: cintillo.presetId,
        logoUrl: cintillo.logoUrl || cintilloLogoUrl || null,
        socials: cintillo.socials || null,
      })
    }
  }, [cintillo, showCustom, programCamera, cintilloLogoUrl])

  useEffect(() => {
    getMicStream()?.getAudioTracks?.()?.forEach(track => {
      track.enabled = !micMuted
    })
  }, [micMuted, micLabel, getMicStream])

  useMicMonitor(getMicStream(), !monitorHeadphones || micMuted)

  const defaultScript = proj.teleprompterScript || [
    proj.episodeTitle && `Hoy hablamos de: ${proj.episodeTitle}`,
    proj.guestName && `Con nosotros: ${proj.guestName}${proj.guestRole ? `, ${proj.guestRole}` : ''}`,
    proj.cintillos?.topic,
    '',
    'Introduce el tema, desarrolla los puntos clave y cierra con una llamada a la acción.',
  ].filter(Boolean).join('\n\n')

  const teleprompter = useTeleprompter(defaultScript, false)

  const { look, setField: setLookField, applyPreset: applyLookPreset, resetLook } = useLookSettings()

  const handleAiCameraSwitch = useCallback((slot) => {
    userPickedCameraRef.current = true
    setActiveCamera(slot)
    setMasterCameraSlot(slot)
    setCamSlot(slot)
  }, [setActiveCamera, setMasterCameraSlot, setCamSlot])

  const { getDirectorCrop, directorStatus } = useAIDirector({
    enabled: switchMode === 'ai' && planLimits.aiDirector,
    streams,
    micLevel,
    activeCamera: programCamera,
    setActiveCamera: handleAiCameraSwitch,
    minCutSec: switchInterval,
    faceZoomSec: 10,
  })

  const {
    zoomState,
    activeZoom,
    crops: cameraCrops,
    setSlotProfile,
    setPreset: setZoomPreset,
    setZoom: setManualZoom,
    setPan: setZoomPan,
    resetZoom,
    togglePushIn,
    getEffectiveCrop: getDynamicCrop,
  } = useDynamicZoom({ activeCamera: programCamera, recording })

  const [showCalibratorModal, setShowCalibratorModal] = useState(false)
  const [calibratorTargetSlot, setCalibratorTargetSlot] = useState(0)

  const handleOpenCalibrator = useCallback((slot) => {
    setCalibratorTargetSlot(slot)
    setShowCalibratorModal(true)
  }, [])

  const effectiveCrop = useMemo(() => {
    // El zoom NUNCA debe moverse solo: solo se aplica el zoom configurado por el usuario
    const dyn = typeof getDynamicCrop === 'function' ? getDynamicCrop(programCamera) : null
    if (dyn) return dyn
    return null
  }, [getDynamicCrop, programCamera, zoomState, activeZoom])

  const { getProgramStream } = useStudioCompositor({
    streams,
    activeCamera: programCamera,
    format: proj.format,
    quality: recordQuality,
    layout: screenLayout,
    pipCamera: screenLayout === 'pip' ? pipCameraSlot : null,
    secondaryCamera: (screenLayout === 'split' || screenLayout === 'triple' || screenLayout === 'quad') ? splitSecondarySlot : null,
    tertiaryCamera: (screenLayout === 'triple' || screenLayout === 'quad') ? tripleTertiarySlot : null,
    quaternaryCamera: screenLayout === 'quad' ? quadQuaternarySlot : null,
    logoUrl: proj.logoUrl,
    logoPosition: proj.logoPosition || 'tr',
    podcastName: proj.name || 'Mi Podcast',
    cintillo: cintillosEnabled ? cintillo : null,
    cintilloPosition: masterCintilloPosition || 'bl',
    cintilloStyle,
    cintilloLogoUrl: cintilloLogoUrl || proj.cintilloLogoUrl || null,
    animPhase,
    animKey,
    directorCrop: effectiveCrop,
    secondaryCrop: cameraCrops[splitSecondarySlot] || null,
    tertiaryCrop: cameraCrops[tripleTertiarySlot] || null,
    quaternaryCrop: cameraCrops[quadQuaternarySlot] || null,
    pipCrop: cameraCrops[pipCameraSlot] || null,
    look,
    recording,
    recordDurationSec: duration,
    compositorActive: recording || countdown !== null || preparingRecord,
  })

  const [dspSettings, setDspSettings] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DSP_SETTINGS
    try {
      const saved = localStorage.getItem('podcastudio_dsp_settings')
      return saved ? { ...DEFAULT_DSP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_DSP_SETTINGS
    } catch {
      return DEFAULT_DSP_SETTINGS
    }
  })

  const { buildRecordingStream, applyDspSettings } = useAudioMix()

  const handleDspChange = useCallback((newSettings) => {
    setDspSettings(newSettings)
    applyDspSettings(newSettings)
    try {
      localStorage.setItem('podcastudio_dsp_settings', JSON.stringify(newSettings))
    } catch {}
  }, [applyDspSettings])

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
    if (!teleprompterOnScreen && !openSections.teleprompter) return

    const onKeyDown = (e) => {
      handleTeleprompterKeydown(e, {
        onToggle: () => {
          if (!teleprompterOnScreen) {
            setTeleprompterOnScreen(true)
            try { localStorage.setItem('podcastudio_teleprompter_on_screen', 'true') } catch {}
          }
          teleprompter.toggle()
        },
        onReset: teleprompter.reset,
        lastActionRef: teleprompterKeyRef,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, teleprompterOnScreen, openSections.teleprompter, teleprompter.toggle, teleprompter.reset])

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
      } else {
        const maxCams = Math.max(4, planLimits.maxCameras || 4)
        let n = await autoConnectAll(devs.cameras, maxCams)
        if (n === 0 && devs.cameras.length > 0 && devs.cameras[0]) {
          await startCamera(devs.cameras[0].deviceId, masterCameraSlot, devs.cameras[0].label)
          n = 1
        }
        if (n === 0) {
          if (devs.cameras.length === 0) {
            setInitError('No se detectaron cámaras USB ni WiFi configuradas. Conecta una y autoriza el acceso.')
          } else {
            setInitError('Permite el acceso a la cámara en el navegador y pulsa reconectar.')
          }
        }
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
      const masterCamStream = streams[masterCameraSlot]
      const cameraAudioTrack = masterCamStream?.getAudioTracks?.()?.[0]
      const inputMicStream = getMicStream() || (cameraAudioTrack ? masterCamStream : null)

      const combined = await buildRecordingStream(videoStream, {
        micStream: inputMicStream,
        musicEl: getAudioElement(),
        musicVolume: musicVol,
        musicPlaying,
        dspSettings,
      })
      startRecording(combined, { quality: recordQuality, cleanVoiceStream: inputMicStream })
    } catch (e) {
      console.error('Recording mix error:', e)
      startRecording(videoStream, { quality: recordQuality, cleanVoiceStream: inputMicStream })
    } finally {
      setPreparingRecord(false)
    }
  }

  const handleStopRecord = () => {
    stopRecording(async (rec) => {
      if (rec) {
        setMultiFormatRecording(rec)
        setShowMultiFormatModal(true)
      }
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

  const handleStartLiveStream = useCallback(async () => {
    const videoStream = getProgramStream()
    if (!videoStream) {
      setLiveError('No se encontró señal de video para emitir.')
      return
    }
    const masterCamStream = streams[masterCameraSlot]
    const cameraAudioTrack = masterCamStream?.getAudioTracks?.()?.[0]
    const inputMicStream = getMicStream() || (cameraAudioTrack ? masterCamStream : null)

    let combined = videoStream
    try {
      combined = await buildRecordingStream(videoStream, {
        micStream: inputMicStream,
        musicEl: getAudioElement(),
        musicVolume: musicVol,
        musicPlaying,
        dspSettings,
      })
    } catch {
      combined = videoStream
    }

    const success = await startLiveStream(combined)
    if (success) {
      setShowLiveModal(false)
    }
  }, [getProgramStream, streams, masterCameraSlot, getMicStream, buildRecordingStream, getAudioElement, musicVol, musicPlaying, dspSettings, startLiveStream, setLiveError])

  const showCintillo = (preset) => {
    if (cintillosEnabled && cintillo.active && cintillo.presetId === preset.id) {
      hideCintillo()
      return
    }
    if (!cintillosEnabled) {
      setCintillosEnabled(true)
      try { localStorage.setItem('podcastudio_cintillos_enabled', 'true') } catch {}
    }
    const resolved = getResolvedCintillo(preset)
    showCustom({
      tag: resolved.tag,
      text: resolved.text,
      subtitle: resolved.subtitle || '',
      color: resolved.color,
      targetSlot: programCamera,
      position: masterCintilloPosition || 'bl',
      presetId: preset.id,
      logoUrl: resolved.logoUrl || cintilloLogoUrl || null,
      socials: resolved.socials || null,
    })
    if (autoCintillos) {
      window.setTimeout(() => {
        showManual(preset.id)
      }, 60)
    }
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
          <button
            type="button"
            className={styles.headerBackBtn}
            onClick={() => {
              if (recording && !window.confirm('Hay una grabación en curso. ¿Deseas salir a la página principal?')) return
              navigate('/')
            }}
            title="Volver a la página principal"
          >
            <i className="ti ti-arrow-left" />
            <span>Inicio</span>
          </button>
          <div className={styles.brand} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} title="Ir al Inicio">Podcast<span>Studio</span></div>
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
            className={`${styles.liveHeaderBtn} ${isLive ? styles.liveHeaderBtnOn : ''}`}
            onClick={() => setShowLiveModal(true)}
            title={isLive ? 'Emitiendo en vivo - Clic para ver panel' : 'Transmitir en vivo a YouTube, Facebook y TikTok'}
          >
            <span className={styles.liveHeaderDot} />
            <span>{isLive ? `EN VIVO ${formatLiveDuration(liveDuration)}` : 'TRANSMITIR EN VIVO'}</span>
          </button>
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
          <button
            type="button"
            className={`${styles.slBtn} ${showLiveModal ? styles.slBtnActive : ''}`}
            onClick={() => setShowLiveModal(true)}
            title="Transmisión en Vivo (Facebook Live, YouTube, TikTok)"
            style={{ position: 'relative' }}
          >
            <i className="ti ti-broadcast" style={{ color: isLive ? '#ef4444' : '#1877f2' }} />
            <span className={styles.slBtnLabel}>En Vivo</span>
            {isLive && <span className={styles.slLiveDot} />}
          </button>
          <button
            type="button"
            className={`${styles.slBtn} ${showMultiFormatModal ? styles.slBtnActive : ''}`}
            onClick={() => {
              if (recordings.length > 0) {
                setMultiFormatRecording(recordings[recordings.length - 1])
              }
              setShowMultiFormatModal(true)
            }}
            title="Descargar Pack Multi-Redes (Facebook, YouTube, TikTok, Instagram)"
          >
            <i className="ti ti-world" style={{ color: '#e8612a' }} />
            <span className={styles.slBtnLabel}>Redes</span>
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
                <div className={styles.activeFormatBadge} title="Formato actual y redes armadas de grabación">
                  {proj.format === '9:16' ? (
                    <>
                      <i className="ti ti-brand-tiktok" style={{ color: '#00f2fe' }} />
                      <span>TikTok · Reels (9:16)</span>
                    </>
                  ) : proj.format === '1:1' ? (
                    <>
                      <i className="ti ti-brand-instagram" style={{ color: '#e1306c' }} />
                      <span>Instagram Feed (1:1)</span>
                    </>
                  ) : selectedNetworks?.length === 4 ? (
                    <>
                      <i className="ti ti-world" style={{ color: '#38bdf8' }} />
                      <span>Pack Multi-Redes (4/4) · Master 16:9</span>
                    </>
                  ) : selectedNetworks?.length > 1 ? (
                    <>
                      <i className="ti ti-share" style={{ color: '#38bdf8' }} />
                      <span>Multi-Redes ({selectedNetworks.length}/4) · Master 16:9</span>
                    </>
                  ) : selectedNetworks?.includes('youtube') || activeSocialPreset === 'youtube' ? (
                    <>
                      <i className="ti ti-brand-youtube" style={{ color: '#ef4444' }} />
                      <span>YouTube (16:9)</span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-brand-facebook" style={{ color: '#1877f2' }} />
                      <span>Facebook (16:9)</span>
                    </>
                  )}
                </div>

                {/* GUÍAS VISUALES DE CENTRADO (REGLA DE TERCIOS + ÁREA SEGURA + CRUZ CENTRAL) */}
                {showMasterGrid && (
                  <div className={styles.masterGridOverlay} aria-hidden>
                    <div className={styles.masterGridLineH1} />
                    <div className={styles.masterGridLineH2} />
                    <div className={styles.masterGridLineV1} />
                    <div className={styles.masterGridLineV2} />
                    <div className={styles.masterSafeArea} />
                    <div className={styles.masterCrosshair} />
                  </div>
                )}

                {(streams[programCamera] || Object.values(streams).some(Boolean) || screenLayout !== 'full') ? (
                  <ProgramPreview
                    stream={streams[programCamera] || null}
                    cameraKey={programCamera}
                    look={look}
                    directorCrop={effectiveCrop}
                    crops={cameraCrops}
                    masterCameraSlot={masterCameraSlot}
                    secondarySlot={splitSecondarySlot}
                    tertiarySlot={tripleTertiarySlot}
                    quaternarySlot={quadQuaternarySlot}
                    pipCameraSlot={pipCameraSlot}
                    pushInActive={cameraCrops[programCamera]?.pushIn || false}
                    layout={screenLayout}
                    pipStream={screenLayout === 'pip' ? streams[pipCameraSlot] : null}
                    pipLabel={getSlotLabel(pipCameraSlot, cameraMeta[pipCameraSlot]?.customLabel, pipCameraSlot === masterCameraSlot)}
                    secondaryStream={(screenLayout === 'split' || screenLayout === 'triple' || screenLayout === 'quad') ? streams[splitSecondarySlot] : null}
                    secondaryLabel={getSlotLabel(splitSecondarySlot, cameraMeta[splitSecondarySlot]?.customLabel, false)}
                    tertiaryStream={(screenLayout === 'triple' || screenLayout === 'quad') ? streams[tripleTertiarySlot] : null}
                    tertiaryLabel={getSlotLabel(tripleTertiarySlot, cameraMeta[tripleTertiarySlot]?.customLabel, false)}
                    quaternaryStream={screenLayout === 'quad' ? streams[quadQuaternarySlot] : null}
                    quaternaryLabel={getSlotLabel(quadQuaternarySlot, cameraMeta[quadQuaternarySlot]?.customLabel, false)}
                    primaryLabel={getSlotLabel(programCamera, cameraMeta[programCamera]?.customLabel, true)}
                    onPromoteSecondaryToMaster={() => handlePromoteToMaster(splitSecondarySlot)}
                    onPromoteTertiaryToMaster={() => handlePromoteToMaster(tripleTertiarySlot)}
                    onPromoteQuaternaryToMaster={() => handlePromoteToMaster(quadQuaternarySlot)}
                    onPromotePipToMaster={() => handlePromoteToMaster(pipCameraSlot)}
                    onClosePip={() => handleSelectLayout('full')}
                    onOpenConnectModal={() => handleOpenConnectModal(programCamera)}
                  />
                ) : (
                  <div className={styles.noSignalViewport} onClick={() => handleOpenConnectModal(programCamera)} style={{ cursor: 'pointer' }}>
                    <i className="ti ti-video-off" />
                    <span>Sin señal — conecta una cámara</span>
                    <span style={{ fontSize: 11, color: 'var(--accent, #e8612a)', marginTop: 4 }}>
                      Haz clic aquí para activar tu cámara web o conectar una cámara WiFi
                    </span>
                  </div>
                )}
                {/* MARCADOR DE AUDIO BROADCAST EN PANTALLA */}
                <div
                  className={styles.masterAudioMeter}
                  title={`Audio en vivo: ${micLevel}% ${micMuted ? '(Silenciado)' : '(Captando señal)'}`}
                >
                  <div className={styles.masterAudioIconWrap}>
                    <i
                      className={`ti ${micMuted ? 'ti-microphone-off' : 'ti-microphone'}`}
                      style={{ color: micMuted ? '#ef4444' : micLevel > 12 ? '#22c55e' : '#94a3b8' }}
                    />
                    <span className={styles.masterAudioLabel}>
                      {micMuted ? 'MUTED' : micLabel ? micLabel.slice(0, 14) : 'AUDIO MASTER'}
                    </span>
                  </div>
                  <div className={styles.masterAudioBarTrack}>
                    <div
                      className={styles.masterAudioBarFill}
                      style={{
                        width: `${micMuted ? 0 : Math.min(100, Math.max(micLevel > 0 ? 8 : 0, micLevel * 1.4))}%`,
                        backgroundColor: micMuted ? '#ef4444' : micLevel > 75 ? '#ef4444' : micLevel > 50 ? '#f59e0b' : '#22c55e',
                      }}
                    />
                  </div>
                  <span className={styles.masterAudioDbText}>
                    {micMuted ? 'MUTE' : micLevel > 0 ? `${Math.round(-42 + (micLevel / 100) * 42)} dB` : '-∞ dB'}
                  </span>
                </div>

                {streams[programCamera] && screenLayout === 'full' && (
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
                    onOpenCalibrator={handleOpenCalibrator}
                    showGrid={showMasterGrid}
                    onToggleGrid={toggleMasterGrid}
                  />
                )}
                {proj.logoUrl && (
                  <div
                    className={`${styles.projectWatermark} ${styles[`watermark_${proj.logoPosition || 'tr'}`]}`}
                    title={`Logo permanente del canal (${proj.logoPosition === 'tl' ? 'Arriba Izquierda' : 'Arriba Derecha'})`}
                  >
                    <img src={proj.logoUrl} alt="Logo Canal" />
                  </div>
                )}
                {(() => {
                  const mainCint = cintilloForMainView()
                  if (!mainCint) return null
                  return (
                    <CintilloOverlay
                      styleId={mainCint.styleId || cintilloStyle}
                      tag={mainCint.tag}
                      text={mainCint.text}
                      subtitle={mainCint.subtitle || ''}
                      accentColor={mainCint.color}
                      position={mainCint.position}
                      presetId={mainCint.presetId}
                      socials={mainCint.socials}
                      logoUrl={mainCint.logoUrl || cintilloLogoUrl || null}
                      size="large"
                      format={proj.format}
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
                {teleprompterOnScreen && (
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
              quadQuaternarySlot={quadQuaternarySlot}
              onSelectQuadQuaternarySlot={setQuadQuaternarySlot}
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
              cintillosEnabled={cintillosEnabled}
              onToggleCintillos={toggleCintillosEnabled}
              showMasterGrid={showMasterGrid}
              onToggleMasterGrid={toggleMasterGrid}
              switchMode={switchMode}
              onToggleAiSwitchMode={() => setSwitchMode(m => m === 'ai' ? 'off' : 'ai')}
              directorStatus={directorStatus}
              transitionMode={look?.transition || 'crossfade'}
              onSelectTransitionMode={(mode) => setLookField('transition', mode)}
            />

            {/* MULTICÁMARA (hasta 20 cámaras) con Swisher Master */}
            <div className={styles.camStrip}>
              <div className={styles.camStripCams} ref={camStripCamsRef}>
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
                      handlePromoteToMaster(i)
                    }}
                  >
                    {/* Encabezado con número de cámara asignado (1..20) y badge de Master único */}
                    <div className={styles.camNumberHeader}>
                      <div
                        className={`${styles.camNumberBadge} ${isLivePgm ? styles.camNumberBadgeLive : isMaster ? styles.camNumberBadgeMaster : ''}`}
                        title={`Canal de Cámara ${i + 1}`}
                      >
                        CAM {i + 1}
                      </div>
                      {isMaster ? (
                        <div
                          className={styles.camMasterBadgeActive}
                          title="Cámara Master Central única (Clic para quitar PiP y volver a pantalla completa)"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePromoteToMaster(i)
                          }}
                        >
                          ★ MASTER
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.camMasterBadgeBtn}
                          title={`Pasar CAM ${i + 1} a Master y volver a pantalla completa`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePromoteToMaster(i)
                          }}
                        >
                          Hacer Master
                        </button>
                      )}
                    </div>

                    <div className={styles.camTopControls}>
                      <button
                        type="button"
                        className={`${styles.camPowerBtn} ${streams[i] ? styles.camPowerBtnActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (streams[i]) {
                            stopCamera(i, true)
                          } else {
                            handleOpenConnectModal(i)
                          }
                        }}
                        title={streams[i] ? 'Desactivar / Apagar señal de esta cámara' : 'Activar / Conectar esta cámara'}
                      >
                        <i className={`ti ${streams[i] ? 'ti-power' : 'ti-video-plus'}`} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.camConfigBtn} ${showCalibratorModal && calibratorTargetSlot === i ? styles.camConfigBtnActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenCalibrator(i)
                        }}
                        title="Calibrar zoom, encuadre, color y audio antes de enviar a Master"
                      >
                        <i className="ti ti-adjustments-horizontal" />
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
                      {isLivePgm && (
                        <div className={styles.camTallyBadge}>PGM</div>
                      )}
                      {isPvw && (
                        <div className={styles.camTallyBadgePvw}>PVW</div>
                      )}
                    </div>

                    {/* Marcador de audio en la cámara */}
                    {streams[i] && (
                      <div
                        className={`${styles.camAudioMeterIcon} ${(isLivePgm && !micMuted && micLevel > 10) || streams[i]?.getAudioTracks()?.length > 0 ? styles.camAudioMeterIconActive : ''}`}
                        title={isLivePgm ? `Transmitiendo audio de Programa (Nivel: ${micLevel}%)` : streams[i]?.getAudioTracks()?.length > 0 ? 'Entrada de audio detectada en esta cámara' : 'Cámara activa'}
                      >
                        <i className={`ti ${isLivePgm && micMuted ? 'ti-microphone-off' : 'ti-microphone'}`} />
                        {isLivePgm && !micMuted && micLevel > 12 && <span className={styles.camAudioPulse} />}
                      </div>
                    )}

                    <div className={styles.camActionPills}>
                      <button
                        type="button"
                        className={`${styles.camRolePill} ${screenLayout === 'pip' && pipCameraSlot === i ? styles.camRolePillPipActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePipOnCamera(i)
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
                          handleToggleSplitOnCamera(i)
                        }}
                        title={screenLayout === 'split' && splitSecondarySlot === i ? 'Quitar de pantalla Doble (2)' : 'Enviar como 2ª cámara (2)'}
                      >
                        {screenLayout === 'split' && splitSecondarySlot === i ? '✓ 2' : '2'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.camRolePill} ${screenLayout === 'triple' && (splitSecondarySlot === i || tripleTertiarySlot === i) ? styles.camRolePillTripleActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleTripleOnCamera(i)
                        }}
                        title={screenLayout === 'triple' && (splitSecondarySlot === i || tripleTertiarySlot === i) ? 'Quitar de pantalla Triple (3)' : 'Enviar a pantalla Triple (3)'}
                      >
                        {screenLayout === 'triple' && (splitSecondarySlot === i || tripleTertiarySlot === i) ? '✓ 3' : '3'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.camRolePill} ${screenLayout === 'quad' && (splitSecondarySlot === i || tripleTertiarySlot === i || quadQuaternarySlot === i) ? styles.camRolePillQuadActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleQuadOnCamera(i)
                        }}
                        title={screenLayout === 'quad' && (splitSecondarySlot === i || tripleTertiarySlot === i || quadQuaternarySlot === i) ? 'Quitar de pantalla Cuádruple (4)' : 'Enviar a pantalla Cuádruple (4)'}
                      >
                        {screenLayout === 'quad' && (splitSecondarySlot === i || tripleTertiarySlot === i || quadQuaternarySlot === i) ? '✓ 4' : '4'}
                      </button>
                    </div>
                    <CameraThumb
                      stream={streams[i]}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 7, pointerEvents: 'none' }}
                      cintillo={cintilloForSlot(i)}
                      cintilloPosition={cintilloForSlot(i)?.position || cintilloPositions[getRoleForSlot(i)]}
                      logoOverlay={{
                        podcastName: proj.name || 'Mi Podcast',
                        position: proj.logoPosition || 'tr',
                      }}
                      crop={getDynamicCrop(i)}
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
              {slotsCount < 20 && (
                <button
                  type="button"
                  className={styles.addCamStripBtn}
                  onClick={() => {
                    addCameraSlot()
                    handleOpenConnectModal(slotsCount)
                  }}
                  title="Agregar otra cámara (hasta 20 cámaras)"
                >
                  <i className="ti ti-plus" />
                  <span>+ CAM</span>
                </button>
              )}
              </div>
              <div className={styles.camStripTools}>
              {/* SELECTOR DE CALIDAD DE GRABACIÓN MASTER (4K UHD, 1080p, 720p) */}
              <div className={styles.recordQualityGroup} title="Calidad de Grabación Master">
                <span className={styles.recordQualityLabel}>Calidad:</span>
                {[
                  { id: '4k', label: '4K UHD', title: '4K Ultra HD (3840x2160 @ 35 Mbps) - Máxima nitidez para cámaras 4K' },
                  { id: '1080p', label: '1080p', title: 'Full HD (1920x1080 @ 12 Mbps) - Estándar broadcast recomendado' },
                  { id: '720p', label: '720p', title: 'HD (1280x720 @ 6 Mbps) - Ligero para streaming' },
                ].map(q => (
                  <button
                    key={q.id}
                    type="button"
                    className={`${styles.qualityBtn} ${recordQuality === q.id ? styles.qualityBtnActive : ''}`}
                    onClick={() => handleSelectRecordQuality(q.id)}
                    title={q.title}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
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
                {/* BOTÓN DIRECTO TRANSMISIÓN EN VIVO */}
                <button
                  type="button"
                  className={`${styles.bottomLiveBtn} ${isLive ? styles.bottomLiveBtnActive : ''}`}
                  onClick={() => setShowLiveModal(true)}
                  title="Configurar transmisión en vivo (Facebook Live, YouTube, TikTok)"
                >
                  <i className="ti ti-broadcast" style={{ color: isLive ? '#fff' : '#1877f2', fontSize: 13 }} />
                  <span>{isLive ? `● EN VIVO (${formatLiveDuration(liveDuration)})` : '🔴 Transmitir'}</span>
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
                      let n = await autoConnectAll(devs.cameras, Math.max(4, planLimits.maxCameras || 4))
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
                  onDisconnect={(slot) => stopCamera(slot, true)}
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
              className={`${styles.sectionToggle} ${openSections.teleprompter ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('teleprompter')}
            >
              <i className={`ti ti-script ${styles.sectionIcon}`} style={{ color: teleprompterOnScreen ? '#10b981' : undefined }} />
              <span className={styles.sectionToggleTitle}>Teleprompter</span>
              <span className={`${styles.sectionToggleBadge} ${teleprompterOnScreen ? styles.badgeActiveGreen : ''}`}>
                {teleprompterOnScreen ? (teleprompter.playing ? '● Leyendo' : 'En Pantalla') : (openSections.teleprompter ? 'Abierto' : 'Cerrado')}
              </span>
              <i className={`ti ti-chevron-${openSections.teleprompter ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.teleprompter && (
              <div className={styles.sectionBody}>
                <Teleprompter
                  script={teleprompter.script}
                  onScriptChange={teleprompter.setScript}
                  playing={teleprompter.playing}
                  onToggle={() => {
                    if (!teleprompterOnScreen && !teleprompter.playing) {
                      setTeleprompterOnScreen(true)
                      try { localStorage.setItem('podcastudio_teleprompter_on_screen', 'true') } catch {}
                    }
                    teleprompter.toggle()
                  }}
                  onReset={teleprompter.reset}
                  onScreen={teleprompterOnScreen}
                  onToggleOnScreen={handleToggleTeleprompterOnScreen}
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
                      onScriptReady={(text) => {
                        teleprompter.setScript(text)
                        teleprompter.reset()
                      }}
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
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-headphones" style={{ color: monitorHeadphones ? 'var(--accent)' : 'var(--text-muted)', fontSize: 14 }} />
                    <span style={{ fontSize: 11, color: '#e2e8f0' }}>Monitoreo (usar con auriculares)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonitorHeadphones(prev => !prev)}
                    title={monitorHeadphones ? 'Desactivar monitoreo en vivo' : 'Activar solo con auriculares para evitar eco'}
                    style={{
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: monitorHeadphones ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                      background: monitorHeadphones ? 'rgba(99,102,241,0.2)' : 'transparent',
                      color: monitorHeadphones ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {monitorHeadphones ? 'EN VIVO' : 'OFF'}
                  </button>
                </div>
                <AudioDspPanel
                  settings={dspSettings}
                  onChange={handleDspChange}
                />
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

          {/* TRANSMISIÓN Y REDES SOCIALES */}
          <div className={styles.prSection}>
            <button
              type="button"
              className={`${styles.sectionToggle} ${openSections.publish ? styles.sectionToggleActive : ''}`}
              onClick={() => toggleSection('publish')}
            >
              <i className={`ti ti-broadcast ${styles.sectionIcon}`} style={{ color: isLive ? '#ef4444' : '#1877f2' }} />
              <span className={styles.sectionToggleTitle}>Transmisión y Redes Sociales</span>
              <span className={styles.sectionToggleBadge}>
                {isLive ? '● En Vivo' : 'FB · YouTube · TikTok'}
              </span>
              <i className={`ti ti-chevron-${openSections.publish ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.publish && (
              <div className={styles.sectionBody}>
                <PublishPanel
                  onOpenPosts={() => setTab('posts')}
                  onOpenPackRedes={() => {
                    if (recordings.length > 0) {
                      setMultiFormatRecording(recordings[recordings.length - 1])
                      setShowMultiFormatModal(true)
                    }
                  }}
                  onOpenLiveStream={() => setShowLiveModal(true)}
                  hasRecordings={recordings.length > 0 || cloudRecordings.length > 0}
                  youtubeConnected={youtubeConnected}
                  onYouTubeConnect={integrations?.youtube ? connectYouTubeChannel : null}
                  selectedNetworks={selectedNetworks}
                  onToggleNetwork={toggleNetwork}
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
              <i className={`ti ti-typography ${styles.sectionIcon}`} style={{ color: cintillosEnabled ? '#10b981' : undefined }} />
              <span className={styles.sectionToggleTitle}>Cintillos & Gráficos</span>
              <span className={`${styles.sectionToggleBadge} ${cintillosEnabled ? styles.badgeActiveGreen : ''}`}>
                {cintillosEnabled ? (cintillo.active ? '● AL AIRE' : 'ACTIVADOS') : 'DESACTIVADO'}
              </span>
              <i className={`ti ti-chevron-${openSections.cintillos ? 'up' : 'down'} ${styles.sectionChevron}`} />
            </button>
            {openSections.cintillos && (
              <div className={styles.sectionBody}>
                {/* BOTÓN MAESTRO DE ACTIVACIÓN DE CINTILLOS */}
                <div className={styles.cintilloMasterHeader}>
                  <button
                    type="button"
                    className={`${styles.masterCintilloToggleBtn} ${cintillosEnabled ? styles.masterCintilloToggleActive : ''}`}
                    onClick={toggleCintillosEnabled}
                    title={cintillosEnabled ? 'Haz clic para desactivar y ocultar todos los cintillos' : 'Haz clic para activar la emisión de cintillos en pantalla'}
                  >
                    <span className={styles.masterCintilloIconWrap}>
                      <i className={`ti ${cintillosEnabled ? 'ti-player-play-filled' : 'ti-player-pause'}`} />
                    </span>
                    <div className={styles.masterCintilloTextCol}>
                      <span className={styles.masterCintilloMainText}>
                        {cintillosEnabled ? 'CINTILLOS ACTIVADOS' : 'ACTIVAR CINTILLOS'}
                      </span>
                      <span className={styles.masterCintilloSubText}>
                        {cintillosEnabled ? '● Al aire en la toma Master' : 'Cintillos apagados (no saldrán en pantalla)'}
                      </span>
                    </div>
                    <div className={`${styles.masterCintilloPill} ${cintillosEnabled ? styles.masterCintilloPillOn : styles.masterCintilloPillOff}`}>
                      {cintillosEnabled ? 'ON' : 'OFF'}
                    </div>
                  </button>
                  <p className={styles.masterCintilloDesc}>
                    {cintillosEnabled
                      ? '● Los cintillos están autorizados y se proyectan en pantalla Master según la configuración.'
                      : '⏸ Mientras no actives este botón, ningún cintillo entrará a pantalla ni a la grabación.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
                  <div className={styles.prTitle} style={{ margin: 0 }}>Cintillos Broadcast</div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Presets listos para editar</span>
                </div>

                {/* LOGO INDEPENDIENTE DEL PROYECTO (Mosca / Watermark de Canal) */}
                <div className={styles.projectWatermarkSection}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                      <i className="ti ti-badge" style={{ marginRight: 6, color: '#ef4444' }} />
                      Logo del Proyecto (Mosca / Watermark)
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      {projectLogoUrl ? '● Activo en pantalla' : 'Sin logo'}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                    Marca de agua permanente tipo TV. Independiente de los cintillos.
                  </p>

                  {/* Selector de posición: Arriba Izquierda vs Arriba Derecha */}
                  <div className={styles.watermarkPosRow}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Posición:</span>
                    <div className={styles.watermarkPosBtns}>
                      <button
                        type="button"
                        className={`${styles.watermarkPosBtn} ${projectLogoPosition === 'tl' ? styles.watermarkPosBtnActive : ''}`}
                        onClick={() => handleSetProjectLogoPosition('tl')}
                        title="Esquina Arriba a la Izquierda"
                      >
                        <i className="ti ti-arrow-up-left" /> Arriba Izq
                      </button>
                      <button
                        type="button"
                        className={`${styles.watermarkPosBtn} ${projectLogoPosition === 'tr' ? styles.watermarkPosBtnActive : ''}`}
                        onClick={() => handleSetProjectLogoPosition('tr')}
                        title="Esquina Arriba a la Derecha"
                      >
                        <i className="ti ti-arrow-up-right" /> Arriba Der
                      </button>
                    </div>
                  </div>

                  {projectLogoUrl ? (
                    <div className={styles.cintLogoPreviewRow} style={{ marginTop: 8 }}>
                      <div className={styles.projectLogoThumb}>
                        <img src={projectLogoUrl} alt="Logo del Proyecto" />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        <label className={styles.cintLogoUploadBtn} style={{ cursor: 'pointer' }}>
                          <i className="ti ti-refresh" />
                          Cambiar
                          <input type="file" accept="image/*" onChange={handleProjectLogoUpload} style={{ display: 'none' }} />
                        </label>
                        <button
                          type="button"
                          className={styles.cintLogoRemoveBtn}
                          onClick={handleRemoveProjectLogo}
                        >
                          <i className="ti ti-trash" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={styles.cintLogoUploadBox} style={{ marginTop: 8 }}>
                      <i className="ti ti-cloud-upload" style={{ fontSize: 16 }} />
                      <span>Subir Logo del Proyecto (PNG / SVG transparente)</span>
                      <span className={styles.cintLogoUploadSub}>Se fijará en la esquina seleccionada durante todo el podcast</span>
                      <input type="file" accept="image/*" onChange={handleProjectLogoUpload} style={{ display: 'none' }} />
                    </label>
                  )}
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

                  <div className={styles.posQuickPills}>
                    {[
                      { id: 'tl', label: 'Arriba Izq' },
                      { id: 'tr', label: 'Arriba Der' },
                      { id: 'bl', label: 'Abajo Izq' },
                      { id: 'br', label: 'Abajo Der' },
                      { id: 'bc', label: 'Abajo Centro' },
                      { id: 'tc', label: 'Arriba Centro' },
                    ].map((qp) => (
                      <button
                        key={qp.id}
                        type="button"
                        className={`${styles.posQuickPill} ${masterCintilloPosition === qp.id ? styles.posQuickPillActive : ''}`}
                        onClick={() => handleSetMasterCintilloPosition(qp.id)}
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>

                  {/* Logo Opcional en Cintillo */}
                  <div className={styles.cintLogoSection}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                        <i className="ti ti-badge-ad" style={{ marginRight: 5, color: 'var(--accent)' }} />
                        Logo Opcional (Efecto 3D TV)
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {cintilloLogoUrl ? 'Logo activo' : 'Solo texto'}
                      </span>
                    </div>
                    {cintilloLogoUrl ? (
                      <div className={styles.cintLogoPreviewRow}>
                        <div className={styles.cintLogoThumb}>
                          <img src={cintilloLogoUrl} alt="Logo Cintillo" />
                        </div>
                        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                          <label className={styles.cintLogoUploadBtn} style={{ cursor: 'pointer' }}>
                            <i className="ti ti-refresh" />
                            Cambiar
                            <input type="file" accept="image/*" onChange={handleCintilloLogoUpload} style={{ display: 'none' }} />
                          </label>
                          <button
                            type="button"
                            className={styles.cintLogoRemoveBtn}
                            onClick={handleRemoveCintilloLogo}
                          >
                            <i className="ti ti-trash" />
                            Quitar logo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={styles.cintLogoUploadBox}>
                        <i className="ti ti-cloud-upload" style={{ fontSize: 16 }} />
                        <span>Subir Logo para Cintillos (PNG transparente)</span>
                        <span className={styles.cintLogoUploadSub}>Opcional: Si no subes logo, se mostrará únicamente el texto</span>
                        <input type="file" accept="image/*" onChange={handleCintilloLogoUpload} style={{ display: 'none' }} />
                      </label>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Cintillos disponibles para Master:
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      Toca el lápiz para editar texto o logo
                    </span>
                  </div>

                  {[...CINTILLO_PRESETS, ...customCintilloList].map((preset) => {
                    const id = preset.id
                    const resolved = getResolvedCintillo(preset)
                    const isEditing = editingCintId === id
                    const isCurrentActive = cintillo.active && cintillo.presetId === id
                    const quickTags = ['ENTREVISTA', 'INVITADO', 'TEMA', 'ESPECIALISTA', 'PREGUNTA', 'NOTICIA', 'HOST', 'REDES']
                    return (
                      <div key={id} className={`${styles.cintCard} ${isCurrentActive ? styles.cintCardActive : ''}`}>
                        <div className={styles.cintCardHeader}>
                          <div className={styles.cintDot} style={{ background: resolved.color }} />
                          <div className={styles.cintCardMeta}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <span className={styles.cintItemLabel}>{resolved.label}</span>
                              <span className={styles.cintTagBadge}>{resolved.tag}</span>
                              {isCurrentActive && <span className={styles.cintLiveBadge}>AL AIRE</span>}
                            </div>
                            <span className={styles.cintCurrentText} title={resolved.text || 'Sin texto asignado'}>
                              {resolved.text || <em style={{ opacity: 0.5 }}>Sin texto asignado</em>}
                            </span>
                          </div>
                          <div className={styles.cintActions}>
                            {preset.isCustom && (
                              <button
                                type="button"
                                className={styles.cintActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCustomCintillo(id)
                                }}
                                title="Eliminar cintillo personalizado"
                              >
                                <i className="ti ti-trash" style={{ color: '#ef4444' }} />
                              </button>
                            )}
                            <button
                              type="button"
                              className={`${styles.cintActionBtn} ${isEditing ? styles.cintActionBtnActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (preset.isCustom) {
                                  setCintEditorData({
                                    ...preset,
                                    tag: resolved.tag,
                                    text: resolved.text,
                                    subtitle: preset.subtitle || '',
                                    color: preset.color || resolved.color,
                                    styleId: preset.styleId || cintilloStyle,
                                    logoUrl: preset.logoUrl || null,
                                  })
                                  setShowCintEditorModal(true)
                                } else if (isEditing) {
                                  setEditingCintId(null)
                                } else {
                                  startEditingCintillo(preset)
                                }
                              }}
                              title="Editar diseño, texto, logo 3D y color"
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
                            <div className={styles.cintEditRow}>
                              <div className={styles.cintEditField} style={{ flex: 1.2 }}>
                                <label className={styles.cintFieldLabel}>Nombre / Sección:</label>
                                <input
                                  type="text"
                                  className={styles.cintInputSm}
                                  value={editingCintLabel}
                                  onChange={(e) => setEditingCintLabel(e.target.value)}
                                  placeholder="Ej. Entrevistado, Tema..."
                                />
                              </div>
                              <div className={styles.cintEditField} style={{ flex: 1 }}>
                                <label className={styles.cintFieldLabel}>TAG en Pantalla:</label>
                                <input
                                  type="text"
                                  className={styles.cintInputSm}
                                  value={editingCintTag}
                                  onChange={(e) => setEditingCintTag(e.target.value.toUpperCase())}
                                  placeholder="Ej. ENTREVISTA..."
                                />
                              </div>
                            </div>

                            <div className={styles.cintTagChips}>
                              {quickTags.map((qt) => (
                                <button
                                  key={qt}
                                  type="button"
                                  className={`${styles.cintTagChip} ${editingCintTag === qt ? styles.cintTagChipActive : ''}`}
                                  onClick={() => setEditingCintTag(qt)}
                                >
                                  {qt}
                                </button>
                              ))}
                            </div>

                            <div className={styles.cintEditField}>
                              <label className={styles.cintFieldLabel}>Texto Principal en Pantalla:</label>
                              <input
                                type="text"
                                className={styles.cintInput}
                                value={editingCintText}
                                onChange={(e) => setEditingCintText(e.target.value)}
                                placeholder="Texto principal del cintillo..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveCintilloFull(id, {
                                      text: editingCintText,
                                      tag: editingCintTag,
                                      label: editingCintLabel,
                                    })
                                  }
                                  if (e.key === 'Escape') setEditingCintId(null)
                                }}
                              />
                            </div>

                            <div className={styles.cintEditBtns}>
                              <button
                                type="button"
                                className={styles.cintSaveBtn}
                                onClick={() => handleSaveCintilloFull(id, {
                                  text: editingCintText,
                                  tag: editingCintTag,
                                  label: editingCintLabel,
                                })}
                              >
                                <i className="ti ti-check" /> Guardar
                              </button>
                              <button
                                type="button"
                                className={styles.cintLiveBtn}
                                onClick={() => {
                                  handleSaveCintilloFull(id, {
                                    text: editingCintText,
                                    tag: editingCintTag,
                                    label: editingCintLabel,
                                  })
                                  showCintillo({
                                    ...preset,
                                    tag: editingCintTag,
                                    text: editingCintText,
                                    label: editingCintLabel,
                                  })
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

                  <button
                    type="button"
                    className={styles.cintAddBtn}
                    onClick={handleAddCustomCintillo}
                    title="Agregar un nuevo cintillo (Entrevistado, Debate, Noticia, Tema)"
                  >
                    <i className="ti ti-plus" />
                    <span>+ Agregar cintillo personalizado (Entrevista, Noticia, Tema)</span>
                  </button>
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
                  duckingEnabled={musicDuckingEnabled}
                  onToggleDucking={toggleMusicDucking}
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

          {recoveredSession && (
            <div className={styles.recoveryBanner}>
              <i className="ti ti-shield-check" style={{ fontSize: 20, color: '#10b981', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 11, color: '#fff' }}>¡Grabación previa recuperada!</strong>
                <span style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>
                  Sesión protegida contra cortes ({recoveredSession.chunkCount} bloques guardados).
                </span>
              </div>
              <button type="button" className={styles.recoveryBtn} onClick={restoreRecoveredSession}>
                <i className="ti ti-download" /> Restaurar
              </button>
              <button type="button" className={styles.dismissRecoveryBtn} onClick={dismissRecoveredSession} title="Descartar">
                <i className="ti ti-x" />
              </button>
            </div>
          )}

          {/* RECORD CONTROLS — Único botón principal para iniciar/detener */}
          <div className={styles.recControlsContainer}>
            <button
              type="button"
              className={`${styles.mainRecBtn} ${recording ? styles.mainRecBtnActive : ''}`}
              onClick={handleRecord}
            >
              <i className={`ti ${recording ? 'ti-player-stop' : 'ti-circle-filled'}`} style={{ fontSize: 16 }} />
              <span>{recording ? 'DETENER GRABACIÓN' : 'INICIAR GRABACIÓN'}</span>
              {recording && (
                <span className={styles.recTimerBadge}>
                  REC {formatDuration(duration)}
                </span>
              )}
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
          stopCamera(slot, true)
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
                <span>Adaptar para Redes Sociales (Multi-Selección)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={styles.socialModalSelectAllBtn}
                  onClick={toggleAllNetworks}
                >
                  <i className={selectedNetworks.length === ALL_SOCIAL_NETWORKS.length ? 'ti ti-checkbox' : 'ti ti-square'} />
                  <span>{selectedNetworks.length === ALL_SOCIAL_NETWORKS.length ? 'Deseleccionar' : 'Seleccionar Todas (4)'}</span>
                </button>
                <button
                  type="button"
                  className={styles.socialModalClose}
                  onClick={() => setShowSocialModal(false)}
                  title="Cerrar"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
            </div>
            <div className={styles.socialModalBody}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Selecciona las redes en las que vas a publicar o transmitir. PodcaStudio adaptará el encuadre y generará en simultáneo todos los formatos necesarios (16:9, 9:16 y 1:1) sin pérdida ni distorsión:
              </p>
              <div className={styles.socialGrid}>
                {SOCIAL_FORMAT_PRESETS.map((p) => {
                  const isSelected = selectedNetworks.includes(p.id)
                  return (
                    <div
                      key={p.id}
                      className={`${styles.socialCard} ${isSelected ? styles.socialCardActive : ''}`}
                      onClick={() => {
                        toggleNetwork(p.id)
                        handleFormatChange(p.format, p.id)
                      }}
                    >
                      <div className={styles.socialCardIcon} style={{ background: `${p.color}22`, color: p.color }}>
                        <i className={p.icon} />
                      </div>
                      <div className={styles.socialCardInfo}>
                        <div className={styles.socialCardHeader}>
                          <span className={styles.socialCardName}>{p.network}</span>
                          <span className={styles.socialCardRatio}>{p.ratio}</span>
                          <span
                            className={styles.socialStatusPill}
                            style={{
                              background: isSelected ? `${p.color}26` : 'rgba(255,255,255,0.06)',
                              color: isSelected ? p.color : 'var(--text-muted)',
                              borderColor: isSelected ? `${p.color}60` : 'transparent',
                            }}
                          >
                            <i className={isSelected ? 'ti ti-check' : 'ti ti-plus'} style={{ fontSize: 10 }} />
                            {isSelected ? 'ACTIVA PARA EXPORTACIÓN' : 'DESACTIVADA'}
                          </span>
                        </div>
                        <span className={styles.socialCardDesc}>{p.desc}</span>
                      </div>
                      <div className={styles.socialCardCheckbox}>
                        <i
                          className={isSelected ? 'ti ti-circle-check-filled' : 'ti ti-circle'}
                          style={{
                            fontSize: 22,
                            color: isSelected ? p.color : 'var(--border-2)',
                            transition: 'all 0.15s ease',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* BARRA INFORMATIVA DE REDES SELECCIONADAS */}
              <div className={styles.socialSummaryBanner}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-package" style={{ color: 'var(--accent)', fontSize: 16 }} />
                  <span style={{ fontSize: 11.5, color: '#fff', fontWeight: 600 }}>
                    {selectedNetworks.length} redes activas para producción y descarga:
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                  {SOCIAL_FORMAT_PRESETS.filter(p => selectedNetworks.includes(p.id)).map(p => (
                    <span
                      key={p.id}
                      className={styles.socialActiveChip}
                      style={{ background: `${p.color}18`, borderColor: `${p.color}45`, color: p.color }}
                    >
                      <i className={p.icon} /> {p.label} ({p.ratio})
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  className={styles.socialApplyBtn}
                  onClick={() => setShowSocialModal(false)}
                >
                  <i className="ti ti-check" />
                  <span>Guardar Selección ({selectedNetworks.length} redes)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPORTACIÓN MULTI-REDES CON AUTO-REENCUADRE */}
      <MultiFormatExportModal
        open={showMultiFormatModal}
        onClose={() => setShowMultiFormatModal(false)}
        recording={multiFormatRecording}
        selectedNetworks={selectedNetworks}
        onDownloadOriginal={downloadRecording}
        onDownloadMp4={downloadRecordingMp4}
        onDownloadCleanVoice={downloadCleanVoice}
        onOpenPublish={() => {
          setTab('posts')
          closeControlsPanel()
        }}
      />

      {/* MODAL TRANSMISIÓN EN VIVO MULTI-STREAMING */}
      <LiveStreamModal
        open={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        destinations={liveDestinations}
        onUpdateDestination={updateLiveDestination}
        isLive={isLive}
        liveDuration={liveDuration}
        formatLiveDuration={formatLiveDuration}
        liveStats={liveStats}
        liveError={liveError}
        onStartLive={handleStartLiveStream}
        onStopLive={stopLiveStream}
      />

      {/* MODAL EDITOR DE CINTILLOS PERSONALIZADOS Y GENERADOR IA */}
      <CintilloEditorModal
        open={showCintEditorModal}
        onClose={() => {
          setShowCintEditorModal(false)
          setCintEditorData(null)
        }}
        initialData={cintEditorData}
        project={proj}
        aiGenerator={generateCintillo}
        onApplyLive={(data) => {
          setAutoCintillos(false)
          showCustom({
            tag: data.tag,
            text: data.text,
            subtitle: data.subtitle,
            color: data.color,
            logoUrl: data.logoUrl,
            targetSlot: masterCameraSlot,
          })
          if (data.styleId) setCintilloStyle(data.styleId)
        }}
        onSaveCustom={(data) => {
          setCustomCintilloList((prev) => {
            const idx = prev.findIndex((c) => c.id === data.id)
            let updated
            if (idx >= 0) {
              updated = [...prev]
              updated[idx] = data
            } else {
              updated = [...prev, data]
            }
            try {
              localStorage.setItem('podcastudio_custom_cintillos_list', JSON.stringify(updated))
            } catch {}
            return updated
          })
        }}
      />

      {/* MODAL MONITOR PREVIEW (PVW) Y CALIBRADOR DE CÁMARAS INDEPENDIENTES */}
      <CameraCalibratorModal
        isOpen={showCalibratorModal}
        onClose={() => setShowCalibratorModal(false)}
        initialSlot={calibratorTargetSlot}
        slotsCount={slotsCount}
        streams={streams}
        cameraMeta={cameraMeta}
        crops={cameraCrops}
        masterCameraSlot={masterCameraSlot}
        onSaveSlotProfile={setSlotProfile}
        onPromoteToMaster={handlePromoteToMaster}
      />
    </div>
    </LandscapeGate>
  )
}
