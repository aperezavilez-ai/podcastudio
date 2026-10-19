import { useEffect, useRef, useState, useCallback } from 'react'
import { PRIMARY_CAMERA_SLOT } from '../config/cameraSlots.js'

const DEFAULT_CROP = { focusX: 0.5, focusY: 0.42, zoom: 1 }

function emptyCrops() {
  return {
    0: { ...DEFAULT_CROP },
    1: { ...DEFAULT_CROP },
    2: { ...DEFAULT_CROP },
    3: { ...DEFAULT_CROP },
  }
}

function slotLabel(slot) {
  return `CAM ${Number(slot) + 1}`
}

/**
 * Director Inteligente de Cámaras sin IA pesada.
 * Alterna cámaras por actividad de micrófono y cadencia de conversación (corte televisivo).
 * Cero inferencia visual, cero bloqueo de CPU/GPU, video 100% fluido en tiempo real.
 */
export function useAIDirector({
  enabled,
  streams,
  micLevel,
  activeCamera,
  setActiveCamera,
  minCutSec = 4,
  micThreshold = 12,
}) {
  const [directorCrops, setDirectorCrops] = useState(emptyCrops)
  const [directorStatus, setDirectorStatus] = useState('')
  const lastSwitchRef = useRef(0)
  const statusRef = useRef('')

  const micLevelRef = useRef(micLevel)
  const streamsRef = useRef(streams)
  const activeCameraRef = useRef(activeCamera)
  const setActiveCameraRef = useRef(setActiveCamera)

  micLevelRef.current = micLevel
  streamsRef.current = streams
  activeCameraRef.current = activeCamera
  setActiveCameraRef.current = setActiveCamera

  const analyze = useCallback(() => {
    const activeStreams = streamsRef.current
    const curMic = micLevelRef.current
    const currentActive = activeCameraRef.current ?? PRIMARY_CAMERA_SLOT

    const slots = Object.keys(activeStreams).map(Number).filter(i => Boolean(activeStreams[i]))
    if (slots.length === 0) return

    const speaking = curMic >= micThreshold
    const now = Date.now()

    // Si hay más de una cámara activa, alternar según actividad de voz y cadencia
    if (slots.length > 1) {
      const timeSinceLastSwitch = (now - lastSwitchRef.current) / 1000
      const cadenceSec = Math.max(minCutSec, 6)

      if (speaking && timeSinceLastSwitch >= cadenceSec) {
        const currentIdx = slots.indexOf(currentActive)
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % slots.length
        const candidate = slots[nextIdx]

        if (candidate !== currentActive) {
          setActiveCameraRef.current?.(candidate)
          lastSwitchRef.current = now
        }
      }
    }

    const cam = activeCameraRef.current ?? PRIMARY_CAMERA_SLOT
    const camLabel = slotLabel(cam)
    const nextStatus = speaking
      ? `${camLabel} · Voz activa`
      : `${camLabel} · En espera de voz (Plano general)`

    if (nextStatus !== statusRef.current) {
      statusRef.current = nextStatus
      setDirectorStatus(nextStatus)
    }
  }, [minCutSec, micThreshold])

  useEffect(() => {
    if (!enabled) {
      setDirectorCrops(emptyCrops())
      setDirectorStatus('')
      statusRef.current = ''
      return undefined
    }

    const id = setInterval(analyze, 1000)
    return () => clearInterval(id)
  }, [enabled, analyze])

  const getDirectorCrop = useCallback(() => {
    return null
  }, [])

  return { directorCrops, getDirectorCrop, directorStatus }
}
