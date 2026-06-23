import { useState, useCallback } from 'react'
import { getBackgroundCameraRect } from '../config/backgroundTemplates.js'

const KEYS = {
  template: 'podcastudio_bg_template',
  custom: 'podcastudio_bg_custom',
  scale: 'podcastudio_bg_scale',
}

function loadTemplate() {
  try {
    return localStorage.getItem(KEYS.template) || 'none'
  } catch {
    return 'none'
  }
}

function loadScale() {
  try {
    return parseInt(localStorage.getItem(KEYS.scale) || '100', 10)
  } catch {
    return 100
  }
}

function loadCustom() {
  try {
    return localStorage.getItem(KEYS.custom) || null
  } catch {
    return null
  }
}

export function useStudioBackground() {
  const [templateId, setTemplateIdState] = useState(loadTemplate)
  const [customUrl, setCustomUrlState] = useState(loadCustom)
  const [cameraScale, setCameraScaleState] = useState(loadScale)

  const setTemplateId = useCallback((id) => {
    setTemplateIdState(id)
    localStorage.setItem(KEYS.template, id)
  }, [])

  const setCameraScale = useCallback((scale) => {
    setCameraScaleState(scale)
    localStorage.setItem(KEYS.scale, String(scale))
  }, [])

  const setCustomUrl = useCallback((url) => {
    setCustomUrlState(url)
    if (url) localStorage.setItem(KEYS.custom, url)
    else localStorage.removeItem(KEYS.custom)
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

  const hasVirtualSet = templateId !== 'none' || !!customUrl
  const cameraRect = getBackgroundCameraRect(templateId, cameraScale)

  return {
    templateId,
    customUrl,
    cameraScale,
    hasVirtualSet,
    cameraRect,
    setTemplateId,
    setCameraScale,
    setCustomUrl,
    onCustomUpload,
    clearCustom,
  }
}
