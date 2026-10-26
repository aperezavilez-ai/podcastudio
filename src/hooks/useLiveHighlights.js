import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * useLiveHighlights - Gestor de momentos destacados en vivo (P3.1)
 * Permite marcar clips virales durante la grabación mediante botón o atajo de teclado [H] o [M]
 * También recibe sugerencias automáticas de IA Productor (VAD) y disparos de aplausos / ovación (SFX)
 */
export function useLiveHighlights({ isRecording, recordingDuration = 0, projectName = 'Proyecto_General' } = {}) {
  const [highlights, setHighlights] = useState([])
  const recordingDurationRef = useRef(recordingDuration)

  useEffect(() => {
    recordingDurationRef.current = recordingDuration
  }, [recordingDuration])

  const formatSeconds = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0))
    const m = Math.floor(s / 60)
    const rem = s % 60
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  const addHighlight = useCallback((title = 'Momento Destacado', type = 'manual', duration = 30) => {
    const currentSec = recordingDurationRef.current || 0
    // Centrar o arrancar el clip unos segundos antes para capturar el contexto
    const startSec = Math.max(0, currentSec - 6)
    const newHighlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      timeSeconds: currentSec,
      startSeconds: startSec,
      duration: duration || 30,
      formattedTime: formatSeconds(currentSec),
      formattedStart: formatSeconds(startSec),
      title: title || 'Highlight',
      type: type || 'manual', // 'manual' | 'vad_debate' | 'sfx_applause'
      label: type === 'vad_debate' 
        ? '🔥 Clímax de Debate' 
        : (type === 'sfx_applause' ? '👏 Ovación / Aplausos' : '⭐ Marcado por Conductor')
    }

    setHighlights(prev => [newHighlight, ...prev])
    return newHighlight
  }, [])

  const removeHighlight = useCallback((id) => {
    setHighlights(prev => prev.filter(h => h.id !== id))
  }, [])

  const clearHighlights = useCallback(() => {
    setHighlights([])
  }, [])

  // Atajos de teclado rápidos [H] o [M] para marcar Highlight al aire
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return
      }

      if (e.key === 'h' || e.key === 'H' || e.key === 'm' || e.key === 'M') {
        if (isRecording) {
          e.preventDefault()
          addHighlight('Highlight Marcado [HotKey]', 'manual', 30)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, addHighlight])

  return {
    highlights,
    addHighlight,
    removeHighlight,
    clearHighlights,
    count: highlights.length
  }
}
