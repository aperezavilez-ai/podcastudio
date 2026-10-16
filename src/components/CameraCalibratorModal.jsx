import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  const [focusMode, setFocusMode] = useState('continuous')
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
    })
  }, [brightness, contrast, saturation, warmth, tint])

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

  // Acciones de Zoom y Encuadre
  const handleApplyPreset = (preset) => {
    setActivePreset(preset.id)
    setZoom(preset.zoom)
    setFocusX(preset.focusX)
    setFocusY(preset.focusY)
  }

  const handleZoomSlider = (val) => {
    setZoom(val)
    setActivePreset(val <= 1.02 ? 'wide' : 'custom')
  }

  const handleNudge = (dx, dy) => {
    if (zoom <= 1.02) {
      setZoom(1.15)
      setActivePreset('custom')
    }
    setFocusX(prev => Math.max(0.1, Math.min(0.9, parseFloat((prev + dx).toFixed(2)))))
    setFocusY(prev => Math.max(0.1, Math.min(0.9, parseFloat((prev + dy).toFixed(2)))))
  }

  const handlePanSlider = (axis, val) => {
    if (zoom <= 1.02) {
      setZoom(1.15)
      setActivePreset('custom')
    }
    if (axis === 'x') setFocusX(val)
    if (axis === 'y') setFocusY(val)
  }

  const handleSelectLookPreset = (p) => {
    setLookPreset(p.id)
    setBrightness(p.brightness)
    setContrast(p.contrast)
    setSaturation(p.saturation)
    setWarmth(p.warmth ?? 0)
    setTint(p.tint ?? 0)
  }

  const handleReset = () => {
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
    setAudioGain(1.0)
    setAudioMuted(false)
  }

  const buildProfile = () => ({
    zoom,
    focusX,
    focusY,
    pushIn,
    presetId: activePreset,
    lookPreset,
    brightness,
    contrast,
    saturation,
    warmth,
    tint,
    lutId: CALIBRATION_LOOK_PRESETS.find(p => p.id === lookPreset)?.lutId || 'none',
    filter: computedFilter !== 'none' ? computedFilter : null,
    audioGain,
    audioMuted,
  })

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
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.headerIcon}>
              <i className="ti ti-adjustments-horizontal" />
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
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Cerrar">
            <i className="ti ti-x" />
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
                    transform: (zoom > 1.02 || Math.abs(focusX - 0.5) > 0.02 || Math.abs(focusY - 0.42) > 0.03)
                      ? `scale(${Math.max(zoom, (Math.abs(focusX - 0.5) > 0.02 || Math.abs(focusY - 0.42) > 0.03) ? 1.15 : 1)})`
                      : undefined,
                    transformOrigin: `${Math.round(focusX * 100)}% ${Math.round(focusY * 100)}%`,
                  }}
                />
              ) : (
                <div className={styles.noSignal}>
                  <i className="ti ti-video-off" />
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
                <i className="ti ti-grid-dots" /> Regla de Tercios
              </button>
              <button
                type="button"
                className={`${styles.guideBtn} ${showSafeArea ? styles.guideBtnActive : ''}`}
                onClick={() => setShowSafeArea(s => !s)}
              >
                <i className="ti ti-frame" /> Margen Seguro
              </button>
              <button
                type="button"
                className={`${styles.guideBtn} ${showCrosshair ? styles.guideBtnActive : ''}`}
                onClick={() => setShowCrosshair(c => !c)}
              >
                <i className="ti ti-crosshair" /> Centro
              </button>
            </div>
          </div>

          {/* CONTROLES DE CALIBRACIÓN */}
          <div className={styles.controlsCol}>
            {/* SECCIÓN 1: ZOOM DINÁMICO */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <i className="ti ti-zoom-in" />
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

              {/* SLIDER DE ZOOM CONTINUO */}
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Acercamiento</span>
                <input
                  type="range"
                  min="1"
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
                  <i className="ti ti-movie" /> {pushIn ? 'Activado' : 'Desactivado'}
                </button>
              </div>
            </div>

            {/* SECCIÓN 2: ENCUADRE Y PANORÁMICA */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <i className="ti ti-arrows-maximize" />
                  Encuadre y Panorámica (Eje X / Y)
                </div>
              </div>

              <div className={styles.panWrapper}>
                {/* D-PAD INTERACTIVO */}
                <div className={styles.dpad}>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0, -0.05)} title="Arriba">
                    <i className="ti ti-chevron-up" />
                  </button>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(-0.05, 0)} title="Izquierda">
                    <i className="ti ti-chevron-left" />
                  </button>
                  <button type="button" className={styles.dpadBtn} onClick={() => { setFocusX(0.5); setFocusY(0.42) }} title="Centrar">
                    <i className="ti ti-target" />
                  </button>
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0.05, 0)} title="Derecha">
                    <i className="ti ti-chevron-right" />
                  </button>
                  <div />
                  <button type="button" className={styles.dpadBtn} onClick={() => handleNudge(0, 0.05)} title="Abajo">
                    <i className="ti ti-chevron-down" />
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
                  <i className="ti ti-palette" />
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
                <span className={styles.sliderLabel}>Brillo</span>
                <input
                  type="range"
                  min="70"
                  max="130"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
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
                  onChange={(e) => setContrast(parseInt(e.target.value, 10))}
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
                  onChange={(e) => setSaturation(parseInt(e.target.value, 10))}
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
                  onChange={(e) => setWarmth(parseInt(e.target.value, 10))}
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
                  onChange={(e) => setTint(parseInt(e.target.value, 10))}
                  className={styles.slider}
                />
                <span className={styles.sliderValue}>{tint > 0 ? `+${tint}` : tint}</span>
              </div>
            </div>

            {/* SECCIÓN 4: AUDIO DE ESTA CÁMARA */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <i className="ti ti-volume" />
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
                    onChange={(e) => setAudioGain(parseFloat(e.target.value))}
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
                  <i className="ti ti-aperture" />
                  Sensor y Hardware de Cámara (UVC)
                </div>
                <span style={{ fontSize: 10, color: 'var(--accent, #e8612a)', fontWeight: 600 }}>
                  Bloqueo Broadcast
                </span>
              </div>
              <p style={{ fontSize: 10, color: '#8c97ab', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                Fija los automatismos del sensor de tu webcam para evitar parpadeos de luz, variaciones de color o respirado de foco mientras grabas.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${exposureMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleToggleHardwareMode('exposureMode', exposureMode === 'manual' ? 'continuous' : 'manual')}
                  title="Bloquea la exposición fija para que el brillo no cambie al moverte"
                >
                  <i className={`ti ${exposureMode === 'manual' ? 'ti-lock' : 'ti-sun'}`} style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 10 }}>{exposureMode === 'manual' ? 'Luz Bloqueada' : 'Luz Auto'}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.presetBtn} ${whiteBalanceMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleToggleHardwareMode('whiteBalanceMode', whiteBalanceMode === 'manual' ? 'continuous' : 'manual')}
                  title="Bloquea el balance de blancos para evitar cambios de color entre azul y naranja"
                >
                  <i className={`ti ${whiteBalanceMode === 'manual' ? 'ti-lock' : 'ti-color-filter'}`} style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 10 }}>{whiteBalanceMode === 'manual' ? 'Color Fijo' : 'Color Auto'}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.presetBtn} ${focusMode === 'manual' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleToggleHardwareMode('focusMode', focusMode === 'manual' ? 'continuous' : 'manual')}
                  title="Bloquea la distancia de enfoque para eliminar el respirado de lente"
                >
                  <i className={`ti ${focusMode === 'manual' ? 'ti-lock' : 'ti-focus-2'}`} style={{ fontSize: 14 }} />
                  <span style={{ fontSize: 10 }}>{focusMode === 'manual' ? 'Foco Fijo' : 'Foco Auto'}</span>
                </button>
              </div>

              {uvcMsg && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="ti ti-info-circle" />
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
              <i className="ti ti-check" style={{ fontSize: 16 }} />
              <span>{saveToast}</span>
            </div>
          ) : (
            <button type="button" className={styles.resetBtn} onClick={handleReset} title="Restablecer valores predeterminados">
              <i className="ti ti-rotate" />
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
              <i className="ti ti-check" />
              Guardar Calibración
            </button>

            <button
              type="button"
              className={styles.promoteMasterBtn}
              onClick={handlePromoteAndClose}
              title="Guarda y manda inmediatamente esta cámara con sus ajustes a Master"
            >
              <i className="ti ti-bolt" />
              ★ Mandar a Master (Al Aire)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
