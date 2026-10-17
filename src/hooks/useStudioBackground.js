import { useState, useCallback, useEffect } from 'react'
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

export function useStudioBackground() {
  const [templateId, setTemplateIdState] = useState(() => {
    try { return localStorage.getItem(KEYS.template) || 'none' } catch { return 'none' }
  })
  const [customUrl, setCustomUrlState] = useState(() => {
    try { return localStorage.getItem(KEYS.custom) || null } catch { return null }
  })

  // Controles interactivos de posición, escala y recorte de grabación
  const [presenterScale, setPresenterScaleState] = useState(() => loadNum(KEYS.scale, 100))
  const [presenterX, setPresenterXState] = useState(() => loadNum(KEYS.posX, 50))
  const [presenterY, setPresenterYState] = useState(() => loadNum(KEYS.posY, 55))

  const [cropLeft, setCropLeftState] = useState(() => loadNum(KEYS.cropLeft, 0))
  const [cropRight, setCropRightState] = useState(() => loadNum(KEYS.cropRight, 0))
  const [cropTop, setCropTopState] = useState(() => loadNum(KEYS.cropTop, 0))
  const [cropBottom, setCropBottomState] = useState(() => loadNum(KEYS.cropBottom, 0))

  const [showDesk, setShowDeskState] = useState(() => loadBool(KEYS.showDesk, true))

  const setTemplateId = useCallback((id) => {
    setTemplateIdState(id)
    try { localStorage.setItem(KEYS.template, id) } catch {}
    // Cargar posición recomendada por defecto del escenario si es la primera vez
    const tmpl = getBackgroundTemplate(id)
    if (tmpl?.defaultPresenter) {
      setPresenterXState(tmpl.defaultPresenter.x)
      setPresenterYState(tmpl.defaultPresenter.y)
      setPresenterScaleState(tmpl.defaultPresenter.scale)
    }
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
    presenterScale,
    presenterX,
    presenterY,
    cropLeft,
    cropRight,
    cropTop,
    cropBottom,
    showDesk,
    setTemplateId,
    setPresenterScale,
    setPresenterX,
    setPresenterY,
    setCropLeft,
    setCropRight,
    setCropTop,
    setCropBottom,
    setShowDesk,
    setCustomUrl,
    onCustomUpload,
    clearCustom,
  }
}
