import { useState, useEffect, useRef, useCallback } from 'react'

export function useTeleprompter(initialScript = '', autoScrollWithRecord = false) {
  const [script, setScript] = useState(initialScript)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(40)
  const [fontSize, setFontSize] = useState(28)
  const [mirror, setMirror] = useState(false)
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(false)
  const rafRef = useRef(null)
  const lastRef = useRef(0)

  useEffect(() => {
    if (initialScript && !script) setScript(initialScript)
  }, [initialScript])

  const tick = useCallback((ts) => {
    if (!lastRef.current) lastRef.current = ts
    const dt = (ts - lastRef.current) / 1000
    lastRef.current = ts
    setOffset(o => o + speed * dt)
    rafRef.current = requestAnimationFrame(tick)
  }, [speed])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
      return
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, tick])

  const toggle = useCallback(() => setPlaying(p => !p), [])
  const reset = useCallback(() => { setOffset(0); setPlaying(false) }, [])

  const setRecordingActive = useCallback((active) => {
    if (autoScrollWithRecord) setPlaying(active)
  }, [autoScrollWithRecord])

  return {
    script, setScript, playing, toggle, reset, speed, setSpeed,
    fontSize, setFontSize, mirror, setMirror, offset, visible, setVisible,
    setRecordingActive,
  }
}
