import { useState, useRef, useEffect, useCallback } from 'react'

export const ZOOM_PRESETS = [
  { id: 'wide', label: '1.0x Plano General', zoom: 1.0, focusX: 0.5, focusY: 0.45 },
  { id: 'medium', label: '1.35x Plano Medio', zoom: 1.35, focusX: 0.5, focusY: 0.42 },
  { id: 'closeup', label: '1.75x Primer Plano', zoom: 1.75, focusX: 0.5, focusY: 0.38 },
  { id: 'tight', label: '2.2x Detalle', zoom: 2.2, focusX: 0.5, focusY: 0.36 },
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
  const [crops, setCrops] = useState({})
  const cropsRef = useRef({})
  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    cropsRef.current = crops
  }, [crops])

  const getSlotCrop = useCallback((slot) => {
    return crops[slot] || DEFAULT_CROP
  }, [crops])

  const setSlotZoom = useCallback((slot, zoomVal) => {
    const cleanZoom = clamp(Number(zoomVal) || 1.0, 1.0, 3.0)
    setCrops(prev => {
      const current = prev[slot] || DEFAULT_CROP
      return {
        ...prev,
        [slot]: {
          ...current,
          zoom: cleanZoom,
          targetZoom: cleanZoom,
          presetId: cleanZoom === 1.0 ? 'wide' : 'custom',
        },
      }
    })
  }, [])

  const setSlotPan = useCallback((slot, focusX, focusY) => {
    const cleanX = clamp(Number(focusX) ?? 0.5, 0.1, 0.9)
    const cleanY = clamp(Number(focusY) ?? 0.42, 0.1, 0.9)
    setCrops(prev => {
      const current = prev[slot] || DEFAULT_CROP
      return {
        ...prev,
        [slot]: {
          ...current,
          focusX: cleanX,
          focusY: cleanY,
          presetId: 'custom',
        },
      }
    })
  }, [])

  const applyPreset = useCallback((slot, presetId) => {
    const preset = ZOOM_PRESETS.find(p => p.id === presetId) || ZOOM_PRESETS[0]
    setCrops(prev => {
      const current = prev[slot] || DEFAULT_CROP
      return {
        ...prev,
        [slot]: {
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
  }, [])

  const togglePushIn = useCallback((slot) => {
    setCrops(prev => {
      const current = prev[slot] || DEFAULT_CROP
      const nextPushIn = !current.pushIn
      return {
        ...prev,
        [slot]: {
          ...current,
          pushIn: nextPushIn,
          targetZoom: nextPushIn ? Math.min(3.0, current.zoom + 0.35) : current.zoom,
        },
      }
    })
  }, [])

  const resetZoom = useCallback((slot) => {
    setCrops(prev => ({
      ...prev,
      [slot]: { ...DEFAULT_CROP },
    }))
  }, [])

  // Animación continua y suave para Push-In (Dolly cinemático) y Lerp
  useEffect(() => {
    const tick = (now) => {
      const deltaMs = Math.min(100, now - lastTimeRef.current)
      lastTimeRef.current = now

      const currentActive = cropsRef.current[activeCamera]
      if (currentActive?.pushIn) {
        const speed = 0.015 * (deltaMs / 1000) // incremento sutil por segundo
        if (currentActive.zoom < currentActive.targetZoom) {
          const nextZoom = Math.min(currentActive.targetZoom, currentActive.zoom + speed)
          setCrops(prev => ({
            ...prev,
            [activeCamera]: {
              ...(prev[activeCamera] || DEFAULT_CROP),
              zoom: nextZoom,
            },
          }))
        }
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
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
