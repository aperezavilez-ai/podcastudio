import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { 
  X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair, 
  Sliders, VideoOff, Grid, Square, ZoomIn, Film, Move, Palette, 
  Volume2, Camera, Info, Check, RotateCcw, Zap, Lock, Sun, Focus
} from 'lucide-react'
import styles from './CameraCalibratorModal.module.css'
import { ZOOM_PRESETS } from '../hooks/useDynamicZoom.js'
import { buildCanvasFilter } from '../utils/videoLook.js'
import { getSlotLabel } from '../config/cameraSlots.js'
import { bindVideoKeepAlive } from '../utils/videoStream.js'

function safeAttachVideo(videoEl, targetStream) {
  if (!videoEl) return
  videoEl.setAttribute('playsinline', '')
  videoEl.setAttribute('webkit-playsinline', '')
  videoEl.muted = true

  if (targetStream) {
    if (videoEl.srcObject !== targetStream) {
      videoEl.srcObject = targetStream
    }
    const tryPlay = () => {
      const p = videoEl.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    tryPlay()
    videoEl.addEventListener('canplay', tryPlay)
    videoEl.addEventListener('loadeddata', tryPlay)
    videoEl.addEventListener('loadedmetadata', tryPlay)

    const videoTracks = targetStream?.getVideoTracks?.() || []
    videoTracks.forEach(t => {
      t.addEventListener('unmute', tryPlay)
    })
  } else if (videoEl.srcObject) {
    videoEl.srcObject = null
  }
}

const CALIBRATION_LOOK_PRESETS = [
  { id: 'original', name: 'Original', brightness: 100, contrast: 100, saturation: 100, warmth: 0, tint: 0, lutId: 'none' },
  { id: 'kodak-2383', name: 'Kodak 2383 Film', brightness: 101, contrast: 114, saturation: 105, warmth: 12, tint: -2, lutId: 'kodak-2383' },
  { id: 'teal-orange-pro', name: 'Teal & Orange Pro', brightness: 100, contrast: 118, saturation: 112, warmth: 14, tint: 2, lutId: 'teal-orange-pro' },
  { id: 'scinetone', name: 'Sony S-Cinetone', brightness: 103, contrast: 108, saturation: 102, warmth: 6, tint: -1, lutId: 'scinetone' },
  { id: 'arri-warm', name: 'Arri Alexa Golden', brightness: 102, contrast: 110, saturation: 106, warmth: 20, tint: -3, lutId: 'arri-warm' },
  { id: 'clean-broadcast', name: 'Broadcast TV Neutro', brightness: 102, contrast: 114, saturation: 102, warmth: 0, tint: 0, lutId: 'clean-broadcast' },
  { id: 'fuji-eterna', name: 'Fuji Eterna 500T', brightness: 104, contrast: 98, saturation: 90, warmth: 4, tint: -4, lutId: 'fuji-eterna' },
  { id: 'cyber-cool', name: 'Cyber Tech Blue', brightness: 101, contrast: 114, saturation: 94, warmth: -16, tint: 4, lutId: 'cyber-cool' },
  { id: 'noir-contrast', name: 'B&W Silver Gelatin', brightness: 98, contrast: 128, saturation: 0, warmth: 0, tint: 0, lutId: 'noir-contrast' },
]

export default function CameraCalibratorModal({
  isOpen,
  onClose,
  initialSlot = 0,
  slotsCount = 4,
  streams = [],
  cameraMeta = [],
  crops = {},
  masterCameraSlot = 0,
  onSaveSlotProfile,
  onPromoteToMaster,
}) {
  const [selectedSlot, setSelectedSlot] = useState(initialSlot)

  // Sincronizar slot inicial al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedSlot(initialSlot)
    }
  }, [isOpen, initialSlot])

  // Estado local de calibración para el slot actual
  const currentSlotCrop = crops[selectedSlot] || {}
  const [zoom, setZoom] = useState(currentSlotCrop.zoom || 1.0)
  const [focusX, setFocusX] = useState(currentSlotCrop.focusX ?? 0.5)
  const [focusY, setFocusY] = useState(currentSlotCrop.focusY ?? 0.42)
  const [pushIn, setPushIn] = useState(Boolean(currentSlotCrop.pushIn))
  const [activePreset, setActivePreset] = useState(currentSlotCrop.presetId || (zoom <= 1.02 ? 'wide' : 'custom'))
  const [lookPreset, setLookPreset] = useState(currentSlotCrop.lookPreset || 'original')
  const [brightness, setBrightness] = useState(currentSlotCrop.brightness ?? 100)
  const [contrast, setContrast] = useState(currentSlotCrop.contrast ?? 100)
  const [saturation, setSaturation] = useState(currentSlotCrop.saturation ?? 100)
  const [warmth, setWarmth] = useState(currentSlotCrop.warmth ?? 0)
  const [tint, setTint] = useState(currentSlotCrop.tint ?? 0)
  const [sharpness, setSharpness] = useState(currentSlotCrop.sharpness ?? 100)
  const [focusDistance, setFocusDistance] = useState(currentSlotCrop.focusDistance ?? 50)
  const [audioGain, setAudioGain] = useState(currentSlotCrop.audioGain ?? 1.0)
  const [audioMuted, setAudioMuted] = useState(Boolean(currentSlotCrop.audioMuted))

  // Guías visuales
  const [showGrid, setShowGrid] = useState(true)
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [showCrosshair, setShowCrosshair] = useState(false)

  // VU Meter state
  const [audioLevel, setAudioLevel] = useState(0)

  // Hardware UVC states
  const [exposureMode, setExposureMode] = useState('continuous')
  const [whiteBalanceMode, setWhiteBalanceMode] = useState('continuous')
  const [focusMode, setFocusMode] = useState(currentSlotCrop.focusMode || 'continuous')
  const [uvcMsg, setUvcMsg] = useState('')

  // Cargar valores del slot cuando cambia de pestaña dentro del modal
  useEffect(() => {
    const sc = crops[selectedSlot] || {}
    setZoom(sc.zoom || 1.0)
    setFocusX(sc.focusX ?? 0.5)
    setFocusY(sc.focusY ?? 0.42)
    setPushIn(Boolean(sc.pushIn))
    setActivePreset(sc.presetId || (sc.zoom <= 1.02 ? 'wide' : 'custom'))
    setLookPreset(sc.lookPreset || 'original')
    setBrightness(sc.brightness ?? 100)
    setContrast(sc.contrast ?? 100)
    setSaturation(sc.saturation ?? 100)
    setWarmth(sc.warmth ?? (CALIBRATION_LOOK_PRESETS.find(p => p.id === sc.lookPreset)?.warmth || 0))
    setTint(sc.tint ?? (CALIBRATION_LOOK_PRESETS.find(p => p.id === sc.lookPreset)?.tint || 0))
    setSharpness(sc.sharpness ?? 100)
    setFocusDistance(sc.focusDistance ?? 50)
    setFocusMode(sc.focusMode || 'continuous')
    setAudioGain(sc.audioGain ?? 1.0)
    setAudioMuted(Boolean(sc.audioMuted))
  }, [selectedSlot, crops])

  // Elemento de video en vivo
  const videoRef = useRef(null)
  const stream = streams[selectedSlot]
  const [saveToast, setSaveToast] = useState('')

  const setVideoNode = useCallback((node) => {
    videoRef.current = node
    if (node && stream) {
      safeAttachVideo(node, stream)
    }
  }, [stream])

  useEffect(() => {
    if (!isOpen) return
    if (videoRef.current && stream) {
      safeAttachVideo(videoRef.current, stream)
    } else if (videoRef.current && !stream) {
      videoRef.current.srcObject = null
    }

    const unbind = bindVideoKeepAlive(videoRef.current)

    const track = stream?.getVideoTracks?.()[0]
    if (track && typeof track.getSettings === 'function') {
      try {
        const s = track.getSettings()
        if (s.exposureMode) setExposureMode(s.exposureMode)
        if (s.whiteBalanceMode) setWhiteBalanceMode(s.whiteBalanceMode)
        if (s.focusMode) setFocusMode(s.focusMode)
      } catch {}
    }

    return () => unbind?.()
  }, [isOpen, stream, selectedSlot])

  const handleToggleHardwareMode = useCallback(async (modeKey, targetValue) => {
    const track = stream?.getVideoTracks?.()[0]
    if (!track || typeof track.applyConstraints !== 'function') {
      setUvcMsg('Esta entrada de video no permite control UVC directo.')
      setTimeout(() => setUvcMsg(''), 3000)
      return
    }

    try {
      await track.applyConstraints({
        advanced: [{ [modeKey]: targetValue }],
      })
      if (modeKey === 'exposureMode') setExposureMode(targetValue)
      if (modeKey === 'whiteBalanceMode') setWhiteBalanceMode(targetValue)
      if (modeKey === 'focusMode') setFocusMode(targetValue)
      setUvcMsg(`Ajuste ${modeKey === 'exposureMode' ? 'Luz' : modeKey === 'whiteBalanceMode' ? 'Color' : 'Foco'} actualizado a ${targetValue === 'manual' ? 'Fijo' : 'Auto'}`)
      setTimeout(() => setUvcMsg(''), 3000)
    } catch {
      // Si el driver UVC no soporta advanced mode, simular estado de software
      if (modeKey === 'exposureMode') setExposureMode(targetValue)
      if (modeKey === 'whiteBalanceMode') setWhiteBalanceMode(targetValue)
      if (modeKey === 'focusMode') setFocusMode(targetValue)
      setUvcMsg('Ajuste asistido por software activado.')
      setTimeout(() => setUvcMsg(''), 3000)
    }
  }, [stream])

  // Filtro CSS calculado
  const computedFilter = useMemo(() => {
    return buildCanvasFilter({
      brightness,
      contrast,
      saturation,
      warmth,
      tint,
      sharpness,
    })
  }, [brightness, contrast, saturation, warmth, tint, sharpness])

  // Medidor VU de audio en tiempo real sin feedback
  useEffect(() => {
    if (!isOpen || !stream) {
      setAudioLevel(0)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (!audioTracks || audioTracks.length === 0) {
      setAudioLevel(0)
      return
    }

    let audioCtx = null
    let analyser = null
    let source = null
    let animId = null

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const checkVolume = () => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        // Normalizar 0 a 100%
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100 * audioGain)))
        animId = requestAnimationFrame(checkVolume)
      }

      checkVolume()
    } catch {
      setAudioLevel(0)
    }

    return () => {
      if (animId) cancelAnimationFrame(animId)
      if (source) {
        try { source.disconnect() } catch {}
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close() } catch {}
      }
    }
  }, [isOpen, stream, selectedSlot, audioGain])

  const buildProfile = (overrides = {}) => {
    const pZoom = overrides.zoom ?? zoom
    const pFocusX = overrides.focusX ?? focusX
    const pFocusY = overrides.focusY ?? focusY
    const pPushIn = overrides.pushIn ?? pushIn
    const pPresetId = overrides.presetId ?? activePreset
    const pLookPreset = overrides.lookPreset ?? lookPreset
    const pBrightness = overrides.brightness ?? brightness
    const pContrast = overrides.contrast ?? contrast
    const pSaturation = overrides.saturation ?? saturation
    const pWarmth = overrides.warmth ?? warmth
    const pTint = overrides.tint ?? tint
    const pSharpness = overrides.sharpness ?? sharpness
    const pFocusMode = overrides.focusMode ?? focusMode
    const pFocusDistance = overrides.focusDistance ?? focusDistance
    const pAudioGain = overrides.audioGain ?? audioGain
    const pAudioMuted = overrides.audioMuted ?? audioMuted

    const f = buildCanvasFilter({
      brightness: pBrightness,
      contrast: pContrast,
      saturation: pSaturation,
      warmth: pWarmth,
      tint: pTint,
      sharpness: pSharpness,
    })

    return {
      zoom: pZoom,
      focusX: pFocusX,
      focusY: pFocusY,
      pushIn: pPushIn,
      presetId: pPresetId,
      lookPreset: pLookPreset,
      brightness: pBrightness,
      contrast: pContrast,
      saturation: pSaturation,
      warmth: pWarmth,
      tint: pTint,
      sharpness: pSharpness,
      focusMode: pFocusMode,
      focusDistance: pFocusDistance,
      lutId: CALIBRATION_LOOK_PRESETS.find(p => p.id === pLookPreset)?.lutId || 'none',
      filter: f !== 'none' ? f : null,
      audioGain: pAudioGain,
      audioMuted: pAudioMuted,
      ...overrides,
    }
  }

  // Sincronización reactiva inmediata en vivo (Master Canvas y Preview)
  const autoSync = useCallback((patch = {}) => {
    if (onSaveSlotProfile) {
      onSaveSlotProfile(selectedSlot, buildProfile(patch))
    }
  }, [selectedSlot, onSaveSlotProfile, zoom, focusX, focusY, pushIn, activePreset, lookPreset, brightness, contrast, saturation, warmth, tint, sharpness, focusMode, focusDistance, audioGain, audioMuted])

  // Acciones de Zoom y Encuadre
  const handleApplyPreset = (preset) => {
    setActivePreset(preset.id)
    setZoom(preset.zoom)
    setFocusX(preset.focusX)
    setFocusY(preset.focusY)
    autoSync({ presetId: preset.id, zoom: preset.zoom, focusX: preset.focusX, focusY: preset.focusY })
  }

  const handleZoomSlider = (val) => {
    setZoom(val)
    const pid = val <= 1.02 ? 'wide' : 'custom'
    setActivePreset(pid)
    autoSync({ zoom: val, presetId: pid })
  }

  const handleNudge = (dx, dy) => {
    const nextZoom = zoom <= 1.02 ? 1.15 : zoom
    if (zoom <= 1.02) {
      setZoom(1.15)
      setActivePreset('custom')
    }
    const nx = Math.max(0.1, Math.min(0.9, parseFloat((focusX + dx).toFixed(2))))
    const ny = Math.max(0.1, Math.min(0.9, parseFloat((focusY + dy).toFixed(2))))
    setFocusX(nx)
    setFocusY(ny)
    autoSync({ zoom: nextZoom, focusX: nx, focusY: ny, presetId: 'custom' })
  }

  const handlePanSlider = (axis, val) => {
    const nextZoom = zoom <= 1.02 ? 1.15 : zoom
    if (zoom <= 1.02) {
      setZoom(1.15)
      setActivePreset('custom')
    }
    if (axis === 'x') {
      setFocusX(val)
      autoSync({ zoom: nextZoom, focusX: val, presetId: 'custom' })
    } else {
      setFocusY(val)
      autoSync({ zoom: nextZoom, focusY: val, presetId: 'custom' })
    }
  }

  const handleSelectLookPreset = (p) => {
    setLookPreset(p.id)
    setBrightness(p.brightness)
    setContrast(p.contrast)
    setSaturation(p.saturation)
    setWarmth(p.warmth ?? 0)
    setTint(p.tint ?? 0)
    autoSync({
      lookPreset: p.id,
      brightness: p.brightness,
      contrast: p.contrast,
      saturation: p.saturation,
      warmth: p.warmth ?? 0,
      tint: p.tint ?? 0,
    })
  }

  const handleReset = () => {
    const resetProf = {
      zoom: 1.0,
      focusX: 0.5,
      focusY: 0.42,
      pushIn: false,
      presetId: 'wide',
      lookPreset: 'original',
      brightness: 100,
      contrast: 100,
      saturation: 100,
      warmth: 0,
      tint: 0,
      sharpness: 100,
      focusDistance: 50,
      focusMode: 'continuous',
      audioGain: 1.0,
      audioMuted: false,
    }
    setZoom(1.0)
    setFocusX(0.5)
    setFocusY(0.42)
    setPushIn(false)
    setActivePreset('wide')
    setLookPreset('original')
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setWarmth(0)
    setTint(0)
    setSharpness(100)
    setFocusDistance(50)
    setFocusMode('continuous')
    setAudioGain(1.0)
    setAudioMuted(false)
    autoSync(resetProf)
  }

  const handleFocusDistance = useCallback(async (distVal) => {
    setFocusDistance(distVal)
    setFocusMode('manual')
    autoSync({ focusDistance: distVal, focusMode: 'manual' })
    const track = stream?.getVideoTracks?.()[0]
    if (track && typeof track.applyConstraints === 'function') {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'manual', focusDistance: distVal / 100 }]
        })
      } catch (_) {}
    }
  }, [stream, autoSync])

  const handleAutoEnhanceFocus = useCallback(async () => {
    setSharpness(130)
    setContrast(112)
    setBrightness(102)
    setFocusMode('continuous')
    const track = stream?.getVideoTracks?.()[0]
    if (track && typeof track.applyConstraints === 'function') {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'continuous' }]
        })
      } catch (_) {}
    }
    autoSync({ sharpness: 130, contrast: 112, brightness: 102, focusMode: 'continuous' })
    setUvcMsg('⚡ Nitidez y Auto-Enfoque continuo aplicados en vivo')
    setTimeout(() => setUvcMsg(''), 3000)
  }, [stream, autoSync])

  const handleSave = () => {
    const prof = buildProfile()
    if (onSaveSlotProfile) {
      onSaveSlotProfile(selectedSlot, prof)
    }
    setSaveToast(`¡Calibración guardada en CAM ${selectedSlot + 1}!`)
    setTimeout(() => {
      setSaveToast('')
      onClose()
    }, 450)
  }

  const handlePromoteAndClose = () => {
    if (onSaveSlotProfile) {
      onSaveSlotProfile(selectedSlot, buildProfile())
    }
    if (onPromoteToMaster) {
      onPromoteToMaster(selectedSlot)
    }
    onClose()
  }

  if (!isOpen) return null

  const isCurrentSlotMaster = selectedSlot === masterCameraSlot
  const meta = cameraMeta[selectedSlot]
  const slotName = getSlotLabel(selectedSlot, meta?.customLabel, isCurrentSlotMaster)

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.headerIcon}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 className={styles.title}>
                Calibrador y Monitor Preview (PVW)
                {isCurrentSlotMaster && <span className={styles.livePill}>● AL AIRE</span>}
              </h2>
              <p className={styles.subtitle}>
                Ajusta zoom independiente, encuadre, color y audio antes de enviar a Master
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className={styles.closeBtn} 
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose?.(); }} 
            title="Cerrar ventana (Esc)"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* SELECTOR DE CÁMARAS RÁPIDO */}
        <div className={styles.slotTabs}>
          {Array.from({ length: slotsCount }).map((_, idx) => {
            const hasSignal = Boolean(streams[idx])
            const isMaster = idx === masterCameraSlot
            const isTabActive = idx === selectedSlot
            const tabLabel = getSlotLabel(idx, cameraMeta[idx]?.customLabel, isMaster)

            return (
              <button
                key={idx}
                type="button"
                className={`${styles.slotTab} ${isTabActive ? styles.slotTabActive : ''}`}
                onClick={() => {
                  // Guardar cambios del slot previo antes de cambiar de pestaña
                  if (onSaveSlotProfile) {
                    onSaveSlotProfile(selectedSlot, buildProfile())
                  }
                  setSelectedSlot(idx)
                }}
              >
                <div className={hasSignal ? styles.tabLiveDot : styles.tabOfflineDot} />
                <span>{tabLabel}</span>
                {isMaster && <span className={styles.tabMasterBadge}>Master</span>}
              </button>
            )
          })}
        </div>

        {/* WORKSPACE DE 2 COLUMNAS */}
        <div className={styles.body}>
          {/* MONITOR PREVIEW (PVW) */}
          <div className={styles.monitorCol}>
            <div className={styles.previewFrame}>
              {stream ? (
                <video
                  ref={setVideoNode}
                  className={styles.videoElement}
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={(e) => e.currentTarget.play().catch(() => {})}
                  onCanPlay={(e) => e.currentTarget.play().catch(() => {})}
                  style={{
                    filter: computedFilter,
                    transform: (Math.abs(zoom - 1.0) > 0.02 || Math.abs(focusX - 0.5) > 0.02 || Math.abs(focusY - 0.42) > 0.03)
                      ? `scale(${zoom.toFixed(3)})`
                      : undefined,
                    transformOrigin: `${Math.round(focusX * 100)}% ${Math.round(focusY * 100)}%`,
                  }}
                />
              ) : (
                <div className={styles.noSignal}>
                  <VideoOff size={32} />
                  <span>Sin señal en {slotName}</span>
                </div>
              )}

              {/* OVERLAYS & GUIDES */}
              <div className={styles.pvwBadge}>
                <span className={styles.pvwPill}>PVW</span>
                <span>{slotName}</span>
                {isCurrentSlotMaster && <span className={styles.livePill}>MASTER</span>}
              </div>

              <div className={styles.infoBadge}>
                {zoom.toFixed(2)}x · Pos ({Math.round(focusX * 100)}%, {Math.round(focusY * 100)}%)
              </div>

              {/* REGLA DE TERCIOS */}
              {showGrid && (
                <div className={styles.gridGuide}>
                  <div className={styles.gridLineH1} />
                  <div className={styles.gridLineH2} />
                  <div className={styles.gridLineV1} />
                  <div className={styles.gridLineV2} />
                </div>
              )}

              {/* ÁREA SEGURA BROADCAST */}
              {showSafeArea && <div className={styles.safeArea} />}

              {/* CRUZ CENTRAL */}
              {showCrosshair && <div className={styles.crosshair} />}
            </div>

            {/* BARRA DE GUÍAS DE ENCUADRE */}
            <div className={styles.guideBar}>
              <span style={{ fontSize: 11, color: '#8c97ab', marginRight: 4 }}>Guías:</span>
              <button
                type="button"
                className={`${styles.guideBtn} ${showGrid ? styles.guideBtnActive : ''}`}
                onClick={() => setShowGrid(g => !g)}
              >
                <Grid size={13} style={{ marginRight: 4 }} /> Regla de Tercios
              </button>
              <button
                type="button"
                className={`${styles.guideBtn} ${showSafeArea ? styles.guideBtnActive : ''}`}
                onClick={() => setShowSafeArea(s => !s)}
              >
                <Square size={13} style={{ marginRight: 4 }} /> Margen Seguro
              </button>
              <button
                type="button"
                className={`${styles.guideBtn} ${showCrosshair ? styles.guideBtnActive : ''}`}
                onClick={() => setShowCrosshair(c => !c)}
              >
                <Crosshair size={13} style={{ marginRight: 4 }} /> Centro
              </button>
            </div>
          </div>

          {/* CONTROLES DE CALIBRACIÓN */}
          <div className={styles.controlsCol}>
            {/* SECCIÓN 1: ZOOM DINÁMICO */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <ZoomIn size={15} style={{ marginRight: 6 }} />
                  Zoom Óptico / Digital Independiente
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#e8612a' }}>
                  {zoom.toFixed(2)}x
                </span>
              </div>

              {/* PRESETS RÁPIDOS */}
              <div className={styles.presetRow}>
                {ZOOM_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.presetBtn} ${activePreset === p.id ? styles.presetBtnActive : ''}`}
                    onClick={() => handleApplyPreset(p)}
                  >
                    <span className={styles.presetVal}>{p.zoom}x</span>
                    <span>{p.label.split(' ')[1] || p.label}</span>
                  </button>
                ))}
              </div>

              {/* SLIDER DE ZOOM CONTINUO (0.5x a 8.0x) */}
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Acercamiento</span>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{zoom.toFixed(2)}x</span>
              </div>

              {/* PUSH-IN SUAVE */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#9ba7be' }}>Push-In Cinemático Lento</span>
                <button
                  type="button"
                  className={`${styles.guideBtn} ${pushIn ? styles.guideBtnActive : ''}`}
                  onClick={() => setPushIn(p => !p)}
                >
                  <Film size={13} style={{ marginRight: 4 }} /> {pushIn ? 'Activado' : 'Desactivado'}
                </button>
              </div>
            </div>

            {/* SECCIÓN 2: ENCUADRE Y PANORÁMICA */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Move size={15} style={{ marginRight: 6 }} />
                  Encuadre y Panorámica (Eje X / Y)
                </div>
              </div>

              <div className={styles.panWrapper}>
                {/* D-PAD INTERACTIVO CON FLECHAS SVG CLARAS */}
                <div className={styles.dpad}>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0, -0.05)} title="Arriba">
                    <ChevronUp size={22} strokeWidth={2.6} />
                  </button>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(-0.05, 0)} title="Izquierda">
                    <ChevronLeft size={22} strokeWidth={2.6} />
                  </button>
                  <button type="button" className={styles.dpadBtn} onClick={() => { setFocusX(0.5); setFocusY(0.42) }} title="Centrar">
                    <Crosshair size={18} strokeWidth={2.4} />
                  </button>
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0.05, 0)} title="Derecha">
                    <ChevronRight size={22} strokeWidth={2.6} />
                  </button>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0, 0.05)} title="Abajo">
                    <ChevronDown size={22} strokeWidth={2.6} />
                  </button>
                  <div />
                </div>

                <div className={styles.panCoords}>
                  <div className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>Eje X</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.02"
                      value={focusX}
                      onChange={(e) => handlePanSlider('x', parseFloat(e.target.value))}
                      className={styles.slider}
                    />
                    <span className={styles.sliderValue}>{Math.round(focusX * 100)}%</span>
                  </div>
                  <div className={styles.sliderRow}>
                    <span className={styles.sliderLabel}>Eje Y (Rostro)</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.02"
                      value={focusY}
                      onChange={(e) => handlePanSlider('y', parseFloat(e.target.value))}
                      className={styles.slider}
                    />
                    <span className={styles.sliderValue}>{Math.round(focusY * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: COLOR Y LOOK POR CÁMARA */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Palette size={15} style={{ marginRight: 6 }} />
                  Corrección de Color y Temperatura
                </div>
              </div>

              {/* CHIPS DE LOOK */}
              <div className={styles.lookGrid}>
                {CALIBRATION_LOOK_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.lookChip} ${lookPreset === p.id ? styles.lookChipActive : ''}`}
                    onClick={() => handleSelectLookPreset(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* DESLIZADORES DE FINETUNING */}
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Nitidez / Claridad</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="2"
                  value={sharpness}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSharpness(v);
                    autoSync({ sharpness: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{sharpness}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Brillo</span>
                <input
                  type="range"
                  min="70"
                  max="130"
                  step="1"
                  value={brightness}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setBrightness(v);
                    autoSync({ brightness: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{brightness}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Contraste</span>
                <input
                  type="range"
                  min="70"
                  max="140"
                  step="1"
                  value={contrast}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setContrast(v);
                    autoSync({ contrast: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{contrast}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Saturación</span>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="2"
                  value={saturation}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSaturation(v);
                    autoSync({ saturation: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{saturation}%</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Temp (Kelvin)</span>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={warmth}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setWarmth(v);
                    autoSync({ warmth: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{warmth > 0 ? `+${warmth}` : warmth}</span>
              </div>

              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Tinte (Matiz)</span>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="1"
                  value={tint}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setTint(v);
                    autoSync({ tint: v });
                  }}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{tint > 0 ? `+${tint}` : tint}</span>
              </div>
            </div>

            {/* SECCIÓN 4: AUDIO DE ESTA CÁMARA */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Volume2 size={15} style={{ marginRight: 6 }} />
                  Audio y Ganancia de Entrada
                </div>
                {stream?.getAudioTracks()?.length > 0 ? (
                  <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>● Mic Activo</span>
                ) : (
                  <span style={{ fontSize: 10, color: '#64748b' }}>Sin audio</span>
                )}
              </div>

              <div className={styles.audioBlock}>
                {/* VU METER */}
                <div className={styles.vuMeterTrack}>
                  <div
                    className={styles.vuMeterBar}
                    style={{ width: `${audioMuted ? 0 : audioLevel}%` }}
                  />
                </div>

                <div className={styles.sliderRow}>
                  <span className={styles.sliderLabel}>Ganancia</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={audioGain}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAudioGain(v);
                      autoSync({ audioGain: v });
                    }}
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>{Math.round(audioGain * 100)}%</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: SENSOR Y HARDWARE DE CÁMARA (UVC PRO) */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Camera size={15} style={{ marginRight: 6 }} />
                  Sensor, Auto-Enfoque y Hardware (UVC)
                </div>
                <span style={{ fontSize: 10, color: 'var(--accent, #e8612a)', fontWeight: 600 }}>
                  Bloqueo Broadcast
                </span>
              </div>
              <p style={{ fontSize: 10, color: '#8c97ab', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                Ajusta el foco automático o manual, y bloquea parámetros para evitar parpadeos o respirado de lente.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${exposureMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleToggleHardwareMode('exposureMode', exposureMode === 'manual' ? 'continuous' : 'manual')}
                  title="Bloquea la exposición fija para que el brillo no cambie al moverte"
                >
                  {exposureMode === 'manual' ? <Lock size={14} style={{ marginRight: 4 }} /> : <Sun size={14} style={{ marginRight: 4 }} />}
                  <span style={{ fontSize: 10 }}>{exposureMode === 'manual' ? 'Luz Bloqueada' : 'Luz Auto'}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.presetBtn} ${whiteBalanceMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleToggleHardwareMode('whiteBalanceMode', whiteBalanceMode === 'manual' ? 'continuous' : 'manual')}
                  title="Bloquea el balance de blancos para evitar cambios de color entre azul y naranja"
                >
                  {whiteBalanceMode === 'manual' ? <Lock size={14} style={{ marginRight: 4 }} /> : <Palette size={14} style={{ marginRight: 4 }} />}
                  <span style={{ fontSize: 10 }}>{whiteBalanceMode === 'manual' ? 'Color Fijo' : 'Color Auto'}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.presetBtn} ${focusMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => {
                    const target = focusMode === 'manual' ? 'continuous' : 'manual';
                    handleToggleHardwareMode('focusMode', target);
                    autoSync({ focusMode: target });
                  }}
                  title="Alterna entre Enfoque Automático y Manual para fijar la distancia"
                >
                  {focusMode === 'manual' ? <Lock size={14} style={{ marginRight: 4 }} /> : <Focus size={14} style={{ marginRight: 4 }} />}
                  <span style={{ fontSize: 10 }}>{focusMode === 'manual' ? 'Foco Manual' : 'Foco Auto'}</span>
                </button>
              </div>

              {/* DISTANCIA DE ENFOQUE MANUAL */}
              {focusMode === 'manual' && (
                <div className={styles.sliderRow} style={{ marginTop: 8 }}>
                  <span className={styles.sliderLabel}>Distancia Foco</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={focusDistance}
                    onChange={(e) => handleFocusDistance(parseInt(e.target.value, 10))}
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>{focusDistance}%</span>
                </div>
              )}

              {/* BOTÓN RÁPIDO DE AUTO-MEJORA */}
              <button
                type="button"
                className={styles.guideBtn}
                style={{ marginTop: 8, width: '100%', justifyContent: 'center', background: 'rgba(232, 97, 42, 0.15)', borderColor: 'rgba(232, 97, 42, 0.4)', color: '#ff8a50', fontWeight: 600, padding: '7px 10px' }}
                onClick={handleAutoEnhanceFocus}
                title="Optimiza contraste, nitidez al 130% y activa auto-enfoque continuo en tiempo real"
              >
                <Zap size={14} style={{ marginRight: 6 }} />
                ⚡ Auto-Mejora y Enfoque Rápido
              </button>

              {uvcMsg && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={14} />
                  <span>{uvcMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className={styles.footer}>
          {saveToast ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontWeight: 600, fontSize: 13, background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '6px 14px', borderRadius: 8 }}>
              <Check size={16} />
              <span>{saveToast}</span>
            </div>
          ) : (
            <button type="button" className={styles.resetBtn} onClick={handleReset} title="Restablecer valores predeterminados">
              <RotateCcw size={14} style={{ marginRight: 4 }} />
              Restablecer
            </button>
          )}

          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              title="Guarda los ajustes para esta cámara en el switcher"
            >
              <Check size={15} style={{ marginRight: 4 }} />
              Guardar Calibración
            </button>

            <button
              type="button"
              className={styles.promoteMasterBtn}
              onClick={handlePromoteAndClose}
              title="Guarda y manda inmediatamente esta cámara con sus ajustes a Master"
            >
              <Zap size={15} style={{ marginRight: 4 }} />
              ★ Mandar a Master (Al Aire)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
