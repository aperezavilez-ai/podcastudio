import { useState, useCallback } from 'react'
import { getBackgroundTemplate } from '../config/backgroundTemplates.js'

const KEYS = {
  template: 'podcastudio_bg_template',
  custom: 'podcastudio_bg_custom',
  scale: 'podcastudio_bg_scale',
  posX: 'podcastudio_bg_pos_x',
  posY: 'podcastudio_bg_pos_y',
  cropLeft: 'podcastudio_bg_crop_left',
  cropRight: 'podcastudio_bg_crop_right',
  cropTop: 'podcastudio_bg_crop_top',
  cropBottom: 'podcastudio_bg_crop_bottom',
  showDesk: 'podcastudio_bg_show_desk',
  cutoutMode: 'podcastudio_bg_cutout_mode', // 'ai' (sin tela verde) | 'chroma' (pantalla verde/azul) | 'hybrid'
  edgeSmooth: 'podcastudio_bg_edge_smooth',
  warmth: 'podcastudio_bg_warmth',
  brightness: 'podcastudio_bg_brightness',
  contrast: 'podcastudio_bg_contrast',
  sharpness: 'podcastudio_bg_sharpness',
  saturation: 'podcastudio_bg_saturation',
  backlight: 'podcastudio_bg_backlight',
  aiSensitivity: 'podcastudio_bg_ai_sensitivity',
  antiFlicker: 'podcastudio_bg_anti_flicker',
  deskOffset: 'podcastudio_bg_desk_offset',
  liveMotion: 'podcastudio_bg_live_motion',
}

function loadNum(key, fallback) {
  try {
    const val = localStorage.getItem(key)
    const n = val !== null ? parseFloat(val) : NaN
    return !isNaN(n) ? n : fallback
  } catch {
    return fallback
  }
}

function loadBool(key, fallback) {
  try {
    const val = localStorage.getItem(key)
    return val !== null ? val === 'true' : fallback
  } catch {
    return fallback
  }
}

function loadStr(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

export function useStudioBackground() {
  const [templateId, setTemplateIdState] = useState(() => loadStr(KEYS.template, 'none'))
  const [customUrl, setCustomUrlState] = useState(() => {
    try { return localStorage.getItem(KEYS.custom) || null } catch { return null }
  })

  // Modo de recorte: 'ai' (Segmentación neuronal sin tela verde por defecto) o 'chroma' (física)
  const [cutoutMode, setCutoutModeState] = useState(() => loadStr(KEYS.cutoutMode, 'ai'))

  // Controles interactivos de posición, escala y recorte de grabación
  const [presenterScale, setPresenterScaleState] = useState(() => loadNum(KEYS.scale, 92))
  const [presenterX, setPresenterXState] = useState(() => loadNum(KEYS.posX, 50))
  const [presenterY, setPresenterYState] = useState(() => loadNum(KEYS.posY, 55))

  const [cropLeft, setCropLeftState] = useState(() => loadNum(KEYS.cropLeft, 0))
  const [cropRight, setCropRightState] = useState(() => loadNum(KEYS.cropRight, 0))
  const [cropTop, setCropTopState] = useState(() => loadNum(KEYS.cropTop, 0))
  const [cropBottom, setCropBottomState] = useState(() => loadNum(KEYS.cropBottom, 0))

  const [showDesk, setShowDeskState] = useState(() => loadBool(KEYS.showDesk, true))
  const [deskHeightOffset, setDeskHeightOffsetState] = useState(() => loadNum(KEYS.deskOffset, 0))

  // Calibración de silueta e integración con iluminación de estudio
  const [edgeSmoothness, setEdgeSmoothnessState] = useState(() => loadNum(KEYS.edgeSmooth, 30))
  const [aiSensitivity, setAiSensitivityState] = useState(() => loadNum(KEYS.aiSensitivity, 38))
  const [antiFlicker, setAntiFlickerState] = useState(() => loadNum(KEYS.antiFlicker, 70))

  // Calibración visual y luz de contra (Broadcast Lighting Match)
  const [presenterWarmth, setPresenterWarmthState] = useState(() => loadNum(KEYS.warmth, 8))
  const [presenterBrightness, setPresenterBrightnessState] = useState(() => loadNum(KEYS.brightness, 102))
  const [presenterContrast, setPresenterContrastState] = useState(() => loadNum(KEYS.contrast, 104))
  const [presenterSharpness, setPresenterSharpnessState] = useState(() => loadNum(KEYS.sharpness, 14))
  const [presenterSaturation, setPresenterSaturationState] = useState(() => loadNum(KEYS.saturation, 104))
  const [presenterBacklight, setPresenterBacklightState] = useState(() => loadNum(KEYS.backlight, 20))

  // Escenario vivo (video loops y efectos animados)
  const [liveMotionEnabled, setLiveMotionEnabledState] = useState(() => loadBool(KEYS.liveMotion, true))

  const setTemplateId = useCallback((id) => {
    setTemplateIdState(id)
    try { localStorage.setItem(KEYS.template, id) } catch {}
    const tmpl = getBackgroundTemplate(id)
    if (tmpl?.defaultPresenter) {
      setPresenterXState(tmpl.defaultPresenter.x)
      setPresenterYState(tmpl.defaultPresenter.y)
      setPresenterScaleState(tmpl.defaultPresenter.scale)
    }
  }, [])

  const setCutoutMode = useCallback((mode) => {
    setCutoutModeState(mode)
    try { localStorage.setItem(KEYS.cutoutMode, mode) } catch {}
  }, [])

  const setPresenterScale = useCallback((scale) => {
    setPresenterScaleState(scale)
    try { localStorage.setItem(KEYS.scale, String(scale)) } catch {}
  }, [])

  const setPresenterX = useCallback((x) => {
    setPresenterXState(x)
    try { localStorage.setItem(KEYS.posX, String(x)) } catch {}
  }, [])

  const setPresenterY = useCallback((y) => {
    setPresenterYState(y)
    try { localStorage.setItem(KEYS.posY, String(y)) } catch {}
  }, [])

  const setCropLeft = useCallback((v) => {
    setCropLeftState(v)
    try { localStorage.setItem(KEYS.cropLeft, String(v)) } catch {}
  }, [])

  const setCropRight = useCallback((v) => {
    setCropRightState(v)
    try { localStorage.setItem(KEYS.cropRight, String(v)) } catch {}
  }, [])

  const setCropTop = useCallback((v) => {
    setCropTopState(v)
    try { localStorage.setItem(KEYS.cropTop, String(v)) } catch {}
  }, [])

  const setCropBottom = useCallback((v) => {
    setCropBottomState(v)
    try { localStorage.setItem(KEYS.cropBottom, String(v)) } catch {}
  }, [])

  const setShowDesk = useCallback((v) => {
    setShowDeskState(v)
    try { localStorage.setItem(KEYS.showDesk, String(v)) } catch {}
  }, [])

  const setDeskHeightOffset = useCallback((v) => {
    setDeskHeightOffsetState(v)
    try { localStorage.setItem(KEYS.deskOffset, String(v)) } catch {}
  }, [])

  const setEdgeSmoothness = useCallback((v) => {
    setEdgeSmoothnessState(v)
    try { localStorage.setItem(KEYS.edgeSmooth, String(v)) } catch {}
  }, [])

  const setAiSensitivity = useCallback((v) => {
    setAiSensitivityState(v)
    try { localStorage.setItem(KEYS.aiSensitivity, String(v)) } catch {}
  }, [])

  const setAntiFlicker = useCallback((v) => {
    setAntiFlickerState(v)
    try { localStorage.setItem(KEYS.antiFlicker, String(v)) } catch {}
  }, [])

  const setPresenterWarmth = useCallback((v) => {
    setPresenterWarmthState(v)
    try { localStorage.setItem(KEYS.warmth, String(v)) } catch {}
  }, [])

  const setPresenterBrightness = useCallback((v) => {
    setPresenterBrightnessState(v)
    try { localStorage.setItem(KEYS.brightness, String(v)) } catch {}
  }, [])

  const setPresenterContrast = useCallback((v) => {
    setPresenterContrastState(v)
    try { localStorage.setItem(KEYS.contrast, String(v)) } catch {}
  }, [])

  const setPresenterSharpness = useCallback((v) => {
    setPresenterSharpnessState(v)
    try { localStorage.setItem(KEYS.sharpness, String(v)) } catch {}
  }, [])

  const setPresenterSaturation = useCallback((v) => {
    setPresenterSaturationState(v)
    try { localStorage.setItem(KEYS.saturation, String(v)) } catch {}
  }, [])

  const setPresenterBacklight = useCallback((v) => {
    setPresenterBacklightState(v)
    try { localStorage.setItem(KEYS.backlight, String(v)) } catch {}
  }, [])

  const setLiveMotionEnabled = useCallback((v) => {
    setLiveMotionEnabledState(v)
    try { localStorage.setItem(KEYS.liveMotion, String(v)) } catch {}
  }, [])

  const applyPresetPosition = useCallback((preset) => {
    if (preset === 'anchor_desk') {
      setPresenterX(50)
      setPresenterY(55)
      setPresenterScale(92)
      setShowDesk(true)
      setDeskHeightOffset(0)
    } else if (preset === 'close_up') {
      setPresenterX(50)
      setPresenterY(46)
      setPresenterScale(128)
    } else if (preset === 'wide_stage') {
      setPresenterX(50)
      setPresenterY(62)
      setPresenterScale(78)
    } else if (preset === 'guest_side') {
      setPresenterX(68)
      setPresenterY(55)
      setPresenterScale(88)
    }
  }, [setPresenterX, setPresenterY, setPresenterScale, setShowDesk, setDeskHeightOffset])

  const setCustomUrl = useCallback((url) => {
    setCustomUrlState(url)
    try {
      if (url) localStorage.setItem(KEYS.custom, url)
      else localStorage.removeItem(KEYS.custom)
    } catch {}
  }, [])

  const onCustomUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setCustomUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }, [setCustomUrl])

  const clearCustom = useCallback(() => setCustomUrl(null), [setCustomUrl])

  const currentTemplate = getBackgroundTemplate(templateId)
  const hasVirtualSet = templateId !== 'none' || Boolean(customUrl)

  return {
    templateId,
    currentTemplate,
    customUrl,
    hasVirtualSet,
    cutoutMode,
    presenterScale,
    presenterX,
    presenterY,
    cropLeft,
    cropRight,
    cropTop,
    cropBottom,
    showDesk,
    deskHeightOffset,
    edgeSmoothness,
    aiSensitivity,
    antiFlicker,
    presenterWarmth,
    presenterBrightness,
    presenterContrast,
    presenterSharpness,
    presenterSaturation,
    presenterBacklight,
    liveMotionEnabled,
    setTemplateId,
    setCutoutMode,
    setPresenterScale,
    setPresenterX,
    setPresenterY,
    setCropLeft,
    setCropRight,
    setCropTop,
    setCropBottom,
    setShowDesk,
    setDeskHeightOffset,
    setEdgeSmoothness,
    setAiSensitivity,
    setAntiFlicker,
    setPresenterWarmth,
    setPresenterBrightness,
    setPresenterContrast,
    setPresenterSharpness,
    setPresenterSaturation,
    setPresenterBacklight,
    setLiveMotionEnabled,
    applyPresetPosition,
    setCustomUrl,
    onCustomUpload,
    clearCustom,
  }
}
