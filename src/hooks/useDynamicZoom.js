import { useState, useRef, useEffect, useCallback } from 'react'

export const ZOOM_PRESETS = [
  { id: 'wide', label: '1.0x Plano General', zoom: 1.0, focusX: 0.5, focusY: 0.45 },
  { id: 'medium', label: '1.35x Plano Medio', zoom: 1.35, focusX: 0.5, focusY: 0.42 },
  { id: 'closeup', label: '1.75x Primer Plano', zoom: 1.75, focusX: 0.5, focusY: 0.38 },
  { id: 'tight', label: '2.2x Detalle', zoom: 2.2, focusX: 0.5, focusY: 0.36 },
  { id: 'far', label: '3.5x Distante', zoom: 3.5, focusX: 0.5, focusY: 0.35 },
  { id: 'tele', label: '5.0x Teleobjetivo', zoom: 5.0, focusX: 0.5, focusY: 0.35 },
  { id: 'ultra', label: '8.0x Retirada Ultra', zoom: 8.0, focusX: 0.5, focusY: 0.35 },
]

const DEFAULT_CROP = {
  zoom: 1.0,
  targetZoom: 1.0,
  focusX: 0.5,
  focusY: 0.42,
  pushIn: false,
  presetId: 'wide',
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

export function useDynamicZoom({ activeCamera = 0, recording = false } = {}) {
  const [crops, setCrops] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_camera_crops')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })
  const cropsRef = useRef({})
  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  const saveTimerRef = useRef(null)

  useEffect(() => {
    cropsRef.current = crops
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('podcastudio_camera_crops', JSON.stringify(crops))
      } catch {}
    }, 400)
    return () => clearTimeout(saveTimerRef.current)
  }, [crops])

  const getSlotCrop = useCallback((slot) => {
    return crops[slot] || DEFAULT_CROP
  }, [crops])

  const setSlotProfile = useCallback((slot, profile) => {
    setCrops(prev => {
      const current = prev[slot] || DEFAULT_CROP
      return {
        ...prev,
        [slot]: {
          ...current,
          ...profile,
          zoom: clamp(Number(profile.zoom ?? current.zoom) || 1.0, 1.0, 8.0),
          targetZoom: clamp(Number(profile.zoom ?? current.zoom) || 1.0, 1.0, 8.0),
          focusX: clamp(Number(profile.focusX ?? current.focusX) ?? 0.5, 0.1, 0.9),
          focusY: clamp(Number(profile.focusY ?? current.focusY) ?? 0.42, 0.1, 0.9),
        },
      }
    })
  }, [])

  const setSlotZoom = useCallback((slotOrZoom, maybeZoom) => {
    let targetSlot = activeCamera
    let zoomVal = slotOrZoom
    if (typeof maybeZoom === 'number') {
      targetSlot = slotOrZoom
      zoomVal = maybeZoom
    } else if (typeof slotOrZoom !== 'number') {
      zoomVal = Number(slotOrZoom) || 1.0
    }
    const cleanZoom = clamp(Number(zoomVal) || 1.0, 1.0, 8.0)
    setCrops(prev => {
      const current = prev[targetSlot] || DEFAULT_CROP
      return {
        ...prev,
        [targetSlot]: {
          ...current,
          zoom: cleanZoom,
          targetZoom: cleanZoom,
          presetId: cleanZoom === 1.0 ? 'wide' : 'custom',
        },
      }
    })
  }, [activeCamera])

  const setSlotPan = useCallback((slotOrX, xOrY, maybeY) => {
    let targetSlot = activeCamera
    let fX = slotOrX
    let fY = xOrY
    if (typeof maybeY === 'number') {
      targetSlot = slotOrX
      fX = xOrY
      fY = maybeY
    }
    const cleanX = clamp(Number(fX) ?? 0.5, 0.1, 0.9)
    const cleanY = clamp(Number(fY) ?? 0.42, 0.1, 0.9)
    setCrops(prev => {
      const current = prev[targetSlot] || DEFAULT_CROP
      return {
        ...prev,
        [targetSlot]: {
          ...current,
          focusX: cleanX,
          focusY: cleanY,
          presetId: 'custom',
        },
      }
    })
  }, [activeCamera])

  const applyPreset = useCallback((slotOrPresetId, maybePresetId) => {
    let targetSlot = activeCamera
    let presetId = slotOrPresetId
    if (typeof maybePresetId === 'string') {
      targetSlot = slotOrPresetId
      presetId = maybePresetId
    } else if (typeof slotOrPresetId === 'string') {
      presetId = slotOrPresetId
    }
    const preset = ZOOM_PRESETS.find(p => p.id === presetId) || ZOOM_PRESETS[0]
    setCrops(prev => {
      const current = prev[targetSlot] || DEFAULT_CROP
      return {
        ...prev,
        [targetSlot]: {
          ...current,
          zoom: preset.zoom,
          targetZoom: preset.zoom,
          focusX: preset.focusX,
          focusY: preset.focusY,
          presetId: preset.id,
          pushIn: false,
        },
      }
    })
  }, [activeCamera])

  const togglePushIn = useCallback((maybeSlot) => {
    const targetSlot = typeof maybeSlot === 'number' ? maybeSlot : activeCamera
    setCrops(prev => {
      const current = prev[targetSlot] || DEFAULT_CROP
      const nextPushIn = !current.pushIn
      const base = current.baseZoom || (current.zoom > 1.05 && !current.pushIn ? current.zoom : 1.0)
      const target = nextPushIn ? Math.min(2.4, Math.max(1.35, base + 0.45)) : base
      return {
        ...prev,
        [targetSlot]: {
          ...current,
          baseZoom: base,
          pushIn: nextPushIn,
          zoom: target,
          targetZoom: target,
        },
      }
    })
  }, [activeCamera])

  const resetZoom = useCallback((maybeSlot) => {
    const targetSlot = typeof maybeSlot === 'number' ? maybeSlot : activeCamera
    setCrops(prev => ({
      ...prev,
      [targetSlot]: { ...DEFAULT_CROP },
    }))
  }, [activeCamera])

  const activeCrop = crops[activeCamera] || DEFAULT_CROP

  return {
    crops,
    activeCrop,
    zoomState: activeCrop,
    activeZoom: activeCrop.zoom || 1.0,
    getZoomCrop: getSlotCrop,
    getEffectiveCrop: getSlotCrop,
    getDynamicCrop: getSlotCrop,
    setSlotProfile,
    setSlotCrop: setSlotProfile,
    setZoom: setSlotZoom,
    setManualZoom: setSlotZoom,
    setPan: setSlotPan,
    setZoomPan: setSlotPan,
    applyPreset,
    setPreset: applyPreset,
    setZoomPreset: applyPreset,
    togglePushIn,
    resetZoom,
    presets: ZOOM_PRESETS,
  }
}
