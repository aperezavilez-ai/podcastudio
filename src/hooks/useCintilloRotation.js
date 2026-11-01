import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getRotationPresets,
  resolveCintilloText,
  resolveCintilloSubtitle,
  CINTILLO_PRESETS,
} from '../config/cintilloPresets.js'
import {
  getPresetCameraSlot,
  DEFAULT_CINTILLO_POSITIONS,
} from '../config/cintilloCameraMap.js'

const ENTER_MS = 500
const EXIT_MS = 400
const DEFAULT_DISPLAY_SEC = 8

function buildCintilloState(preset, project, positions, masterPosition, overrides = {}) {
  const presetId = preset?.id || overrides.presetId || 'custom'
  const text = overrides.text ?? (preset ? resolveCintilloText(preset.id, project) : '')
  const subtitle = overrides.subtitle ?? (preset ? resolveCintilloSubtitle(preset.id, project) : '')
  const fixedPos = overrides.position || masterPosition || positions?.master || 'bl'

  return {
    active: true,
    tag: overrides.tag ?? preset?.tag ?? 'INFO',
    text,
    subtitle,
    color: overrides.color ?? preset?.color ?? '#e8612a',
    presetId,
    targetSlot: overrides.targetSlot ?? getPresetCameraSlot(presetId),
    position: fixedPos,
    logoUrl: overrides.logoUrl ?? project?.cintilloLogoUrl ?? null,
    socials: overrides.socials ?? project?.socialHandles ?? null,
  }
}

export function useCintilloRotation({
  project,
  enabled,
  displaySec = DEFAULT_DISPLAY_SEC,
  positions = DEFAULT_CINTILLO_POSITIONS,
  masterPosition = 'bl',
}) {
  const [cintillo, setCintillo] = useState({
    active: false,
    tag: '',
    text: '',
    subtitle: '',
    color: '#4a90d9',
    presetId: null,
    targetSlot: 1,
    position: masterPosition || 'bl',
    logoUrl: null,
    socials: null,
  })
  const [animPhase, setAnimPhase] = useState('hold')
  const [animKey, setAnimKey] = useState(0)
  const indexRef = useRef(0)
  const timersRef = useRef([])
  const positionsRef = useRef(positions)
  const masterPosRef = useRef(masterPosition)
  const projectRef = useRef(project)
  const enabledRef = useRef(enabled)
  const runCycleRef = useRef(null)

  positionsRef.current = positions
  masterPosRef.current = masterPosition
  projectRef.current = project
  enabledRef.current = enabled

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const showPreset = useCallback((preset) => {
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo(buildCintilloState(preset, projectRef.current, positionsRef.current, masterPosRef.current))
  }, [])

  const runCycle = useCallback(() => {
    clearTimers()
    const items = getRotationPresets(projectRef.current)
    if (!items.length) {
      setCintillo(c => ({ ...c, active: false }))
      return
    }

    const preset = items[indexRef.current % items.length]
    showPreset(preset)

    // Fase 1: Enter -> Hold
    schedule(() => setAnimPhase('hold'), ENTER_MS)

    // Fase 2: Hold -> Exit
    const holdDuration = Math.max(3000, displaySec * 1000)
    schedule(() => {
      setAnimPhase('exit')
    }, ENTER_MS + holdDuration)

    // Fase 3: Exit -> Siguiente Preset
    schedule(() => {
      indexRef.current = (indexRef.current + 1) % items.length
      if (runCycleRef.current && enabledRef.current) {
        runCycleRef.current()
      }
    }, ENTER_MS + holdDuration + EXIT_MS)
  }, [displaySec, clearTimers, schedule, showPreset])

  runCycleRef.current = runCycle

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }
    // Iniciar ciclo de rotación continua
    runCycle()
    return clearTimers
  }, [enabled, runCycle, clearTimers])

  // Selección manual o por botón: entra de inmediato y si la rotación está activa, continúa al siguiente
  const showManual = useCallback((presetOrId) => {
    clearTimers()
    const preset = typeof presetOrId === 'string'
      ? (CINTILLO_PRESETS.find(p => p.id === presetOrId) || { id: presetOrId, tag: presetOrId.toUpperCase() })
      : presetOrId

    const items = getRotationPresets(projectRef.current)
    const foundIdx = items.findIndex(p => p.id === preset.id)
    if (foundIdx >= 0) {
      indexRef.current = (foundIdx + 1) % items.length
    }

    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo(buildCintilloState(preset, projectRef.current, positionsRef.current, masterPosRef.current))
    schedule(() => setAnimPhase('hold'), ENTER_MS)

    const holdDuration = Math.max(3000, displaySec * 1000)
    // Programar salida y avance automático al siguiente cintillo
    schedule(() => {
      if (enabledRef.current && items.length > 1) {
        setAnimPhase('exit')
      }
    }, ENTER_MS + holdDuration)

    schedule(() => {
      if (enabledRef.current && items.length > 1 && runCycleRef.current) {
        runCycleRef.current()
      }
    }, ENTER_MS + holdDuration + EXIT_MS)
  }, [clearTimers, schedule, displaySec])

  const showCustom = useCallback(({ tag, text, subtitle, color = '#e8612a', targetSlot, position, presetId = 'custom', logoUrl, socials }) => {
    clearTimers()
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo(buildCintilloState(null, projectRef.current, positionsRef.current, masterPosRef.current, {
      tag, text, subtitle, color, targetSlot, position, presetId, logoUrl, socials,
    }))
    schedule(() => setAnimPhase('hold'), ENTER_MS)
  }, [clearTimers, schedule])

  const hide = useCallback(() => {
    clearTimers()
    setAnimPhase('exit')
    schedule(() => setCintillo(c => ({ ...c, active: false })), EXIT_MS)
  }, [clearTimers, schedule])

  return {
    cintillo,
    animPhase,
    animKey,
    showManual,
    showCustom,
    hide,
  }
}

