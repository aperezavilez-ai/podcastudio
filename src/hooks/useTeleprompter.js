import { useState, useEffect, useRef, useCallback } from 'react'

export function useTeleprompter(initialScript = '', autoScrollWithRecord = true) {
  const [script, setScript] = useState(initialScript)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(35)
  const [fontSize, setFontSize] = useState(28)
  const [mirror, setMirror] = useState(false)
  const [direction, setDirection] = useState('up') // up = abajo→arriba (clásico), down = arriba→abajo
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(false)
  const [maxScroll, setMaxScroll] = useState(0)
  const rafRef = useRef(null)
  const lastRef = useRef(0)

  useEffect(() => {
    if (initialScript) setScript(initialScript)
  }, [initialScript])

  const tick = useCallback((ts) => {
    if (!lastRef.current) lastRef.current = ts
    const dt = (ts - lastRef.current) / 1000
    lastRef.current = ts
    setOffset(o => {
      const next = o + speed * dt
      return maxScroll > 0 ? Math.min(next, maxScroll) : next
    })
    rafRef.current = requestAnimationFrame(tick)
  }, [speed, maxScroll])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
      return
    }
    if (maxScroll > 0 && offset >= maxScroll) {
      setPlaying(false)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, tick, maxScroll, offset])

  const toggle = useCallback(() => setPlaying(p => !p), [])
  const reset = useCallback(() => { setOffset(0); setPlaying(false) }, [])

  const setRecordingActive = useCallback((active) => {
    if (autoScrollWithRecord) {
      if (active) {
        setOffset(0)
        setPlaying(true)
      } else {
        setPlaying(false)
      }
    }
  }, [autoScrollWithRecord])

  return {
    script, setScript, playing, toggle, reset, speed, setSpeed,
    fontSize, setFontSize, mirror, setMirror, direction, setDirection,
    offset, visible, setVisible, setRecordingActive, maxScroll, setMaxScroll,
  }
}
