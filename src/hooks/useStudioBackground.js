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

  // Calibración de silueta e integración con iluminación de estudio
  const [edgeSmoothness, setEdgeSmoothnessState] = useState(() => loadNum(KEYS.edgeSmooth, 30))
  const [presenterWarmth, setPresenterWarmthState] = useState(() => loadNum(KEYS.warmth, 8))
  const [presenterBrightness, setPresenterBrightnessState] = useState(() => loadNum(KEYS.brightness, 102))
  const [presenterContrast, setPresenterContrastState] = useState(() => loadNum(KEYS.contrast, 104))

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

  const setEdgeSmoothness = useCallback((v) => {
    setEdgeSmoothnessState(v)
    try { localStorage.setItem(KEYS.edgeSmooth, String(v)) } catch {}
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

  const applyPresetPosition = useCallback((preset) => {
    if (preset === 'anchor_desk') {
      setPresenterX(50)
      setPresenterY(55)
      setPresenterScale(92)
      setShowDesk(true)
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
  }, [setPresenterX, setPresenterY, setPresenterScale, setShowDesk])

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
    edgeSmoothness,
    presenterWarmth,
    presenterBrightness,
    presenterContrast,
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
    setEdgeSmoothness,
    setPresenterWarmth,
    setPresenterBrightness,
    setPresenterContrast,
    applyPresetPosition,
    setCustomUrl,
    onCustomUpload,
    clearCustom,
  }
}
