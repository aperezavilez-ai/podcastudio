import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_LOOK, applyLookPreset } from '../config/lookPresets.js'

const STORAGE_KEY = 'podcastudio_look'

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LOOK }
    return { ...DEFAULT_LOOK, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_LOOK }
  }
}

export function useLookSettings() {
  const [look, setLook] = useState(loadStored)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(look))
  }, [look])

  const setField = useCallback((key, value) => {
    setLook(prev => {
      const next = { ...prev, [key]: value }
      const metaKeys = ['transition', 'temporalVignette', 'cintilloMotion']
      if (key === 'presetId') return next
      if (!metaKeys.includes(key)) next.presetId = 'custom'
      return next
    })
  }, [])

  const applyPreset = useCallback((presetId) => {
    setLook(prev => ({
      ...prev,
      ...applyLookPreset(presetId),
      presetId,
      temporalVignette: prev.temporalVignette,
      transition: prev.transition,
      cintilloMotion: prev.cintilloMotion,
    }))
  }, [])

  const resetLook = useCallback(() => {
    setLook({ ...DEFAULT_LOOK })
  }, [])

  return { look, setLook, setField, applyPreset, resetLook }
}
