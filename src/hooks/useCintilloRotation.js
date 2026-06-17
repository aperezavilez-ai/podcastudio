import { useState, useEffect, useRef, useCallback } from 'react'
import { getRotationPresets, resolveCintilloText } from '../config/cintilloPresets.js'

const ENTER_MS = 900
const EXIT_MS = 450
const DEFAULT_DISPLAY_SEC = 6

export function useCintilloRotation({ project, enabled, displaySec = DEFAULT_DISPLAY_SEC }) {
  const [cintillo, setCintillo] = useState({ active: false, tag: '', text: '', color: '#4a90d9', presetId: null })
  const [animPhase, setAnimPhase] = useState('hold')
  const [animKey, setAnimKey] = useState(0)
  const indexRef = useRef(0)
  const timersRef = useRef([])

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
    const text = resolveCintilloText(preset.id, project)
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo({
      active: true,
      tag: preset.tag,
      text,
      color: preset.color,
      presetId: preset.id,
    })
  }, [project])

  const runCycle = useCallback(() => {
    clearTimers()
    const items = getRotationPresets(project)
    if (!items.length) {
      setCintillo(c => ({ ...c, active: false }))
      return
    }

    const preset = items[indexRef.current % items.length]
    showPreset(preset)

    schedule(() => setAnimPhase('hold'), ENTER_MS)
    schedule(() => setAnimPhase('exit'), ENTER_MS + displaySec * 1000)
    schedule(() => {
      indexRef.current = (indexRef.current + 1) % items.length
      runCycle()
    }, ENTER_MS + displaySec * 1000 + EXIT_MS)
  }, [project, displaySec, clearTimers, schedule, showPreset])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }
    indexRef.current = 0
    runCycle()
    return clearTimers
  }, [enabled, project, displaySec, runCycle, clearTimers])

  const showManual = useCallback((preset) => {
    clearTimers()
    const text = resolveCintilloText(preset.id, project)
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo({
      active: true,
      tag: preset.tag,
      text,
      color: preset.color,
      presetId: preset.id,
    })
    schedule(() => setAnimPhase('hold'), ENTER_MS)
  }, [clearTimers, project, schedule])

  const showCustom = useCallback(({ tag, text, color = '#e8612a' }) => {
    clearTimers()
    setAnimKey(k => k + 1)
    setAnimPhase('enter')
    setCintillo({ active: true, tag, text, color, presetId: 'custom' })
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
