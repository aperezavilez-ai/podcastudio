import { useState, useEffect, useRef, useCallback } from 'react'

export function useSpeechSubtitles({ enabled, language = 'es-MX' }) {
  const [lines, setLines] = useState([])
  const [interim, setInterim] = useState('')
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop?.()
    recRef.current = null
    setListening(false)
  }, [])

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!enabled || !SR) {
      stop()
      if (!enabled) {
        setInterim('')
      }
      return undefined
    }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = language
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interimText = ''
      const finals = []
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.trim()
        if (!t) continue
        if (event.results[i].isFinal) finals.push(t)
        else interimText += `${t} `
      }
      if (finals.length) {
        setLines(prev => [...prev, ...finals].slice(-6))
        setInterim('')
      } else {
        setInterim(interimText.trim())
      }
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('Subtítulos:', e.error)
      }
    }

    rec.onend = () => {
      if (recRef.current === rec && enabled) {
        try { rec.start() } catch { /* ignore */ }
      }
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }

    return () => {
      rec.onend = null
      try { rec.stop() } catch { /* ignore */ }
      if (recRef.current === rec) recRef.current = null
      setListening(false)
    }
  }, [enabled, language, stop])

  const clear = useCallback(() => {
    setLines([])
    setInterim('')
  }, [])

  const displayText = [...lines.slice(-2), interim].filter(Boolean).join(' ')

  return { lines, interim, displayText, supported, listening, clear, stop }
}
