import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getRotationPresets,
  resolveCintilloText,
} from '../config/cintilloPresets.js'
import {
  getPresetCameraSlot,
  getPositionForPreset,
  DEFAULT_CINTILLO_POSITIONS,
} from '../config/cintilloCameraMap.js'

const ENTER_MS = 900
const EXIT_MS = 450
const DEFAULT_DISPLAY_SEC = 10

function buildCintilloState(preset, project, positions, overrides = {}) {
  const presetId = preset?.id || overrides.presetId || 'custom'
  const text = overrides.text ?? (preset ? resolveCintilloText(preset.id, project) : '')
  return {
    active: true,
    tag: overrides.tag ?? preset?.tag ?? 'INFO',
    text,
    color: overrides.color ?? preset?.color ?? '#e8612a',
    presetId,
    targetSlot: overrides.targetSlot ?? getPresetCameraSlot(presetId),
    position: overrides.position ?? getPositionForPreset(presetId, positions),
  }
}

export function useCintilloRotation({
  project,
  enabled,
  displaySec = DEFAULT_DISPLAY_SEC,
  positions = DEFAULT_CINTILLO_POSITIONS,
}) {
  const [cintillo, setCintillo] = useState({
    active: false, tag: '', text: '', color: '#4a90d9', presetId: null, targetSlot: 1, position: 'bc',
  })
  const [animPhase, setAnimPhase] = useState('hold')
  const [animKey, setAnimKey] = useState(0)
  const indexRef = useRef(0)
  const timersRef = useRef([])
  const positionsRef = useRef(positions)

  positionsRef.current = positions

  const projectRef = useRef(project)
  projectRef.current = project

  const cintillosKey = JSON.stringify(project?.cintillos || {})

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
    setCintillo(buildCintilloState(preset, projectRef.current, positionsRef.current))
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

    schedule(() => setAnimPhase('hold'), ENTER_MS)
    schedule(() => {
      indexRef.current = (indexRef.current + 1) % items.length
      runCycle()
    }, ENTER_MS + displaySec * 1000)
  }, [displaySec, clearTimers, schedule, showPreset])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }
    indexRef.current = 0
    runCycle()
    return clearTimers
  }, [enabled, displaySec, cintillosKey, positions, runCycle, clearTimers])

  const showManual = useCallback((preset) => {
    clearTimers()
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo(buildCintilloState(preset, projectRef.current, positionsRef.current))
    schedule(() => setAnimPhase('hold'), ENTER_MS)
  }, [clearTimers, schedule])

  const showCustom = useCallback(({ tag, text, color = '#e8612a', targetSlot, position, presetId = 'custom' }) => {
    clearTimers()
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo(buildCintilloState(null, projectRef.current, positionsRef.current, {
      tag, text, color, targetSlot, position, presetId,
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
