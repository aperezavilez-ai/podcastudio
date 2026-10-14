import { useState, useEffect, useRef, useCallback } from 'react'

export function useSpeechSubtitles({ enabled, language = 'es-MX', onVoiceIntent = null }) {
  const [lines, setLines] = useState([])
  const [interim, setInterim] = useState('')
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const lastIntentTimeRef = useRef(0)
  const intentCallbackRef = useRef(onVoiceIntent)

  intentCallbackRef.current = onVoiceIntent

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

      // Detección de intenciones por voz en tiempo real para el Director IA
      const textChunk = (finals.join(' ') + ' ' + interimText).toLowerCase()
      const now = Date.now()
      if (intentCallbackRef.current && now - lastIntentTimeRef.current > 10000) {
        if (
          textChunk.includes('redes sociales') ||
          textChunk.includes('en sus redes') ||
          textChunk.includes('nuestras redes') ||
          textChunk.includes('síguenos') ||
          textChunk.includes('síganlo') ||
          textChunk.includes('instagram') ||
          textChunk.includes('tiktok')
        ) {
          lastIntentTimeRef.current = now
          intentCallbackRef.current('social')
        } else if (
          textChunk.includes('contacto') ||
          textChunk.includes('número de contacto') ||
          textChunk.includes('teléfono') ||
          textChunk.includes('comunícate') ||
          textChunk.includes('llámanos') ||
          textChunk.includes('whatsapp') ||
          textChunk.includes('escríbenos')
        ) {
          lastIntentTimeRef.current = now
          intentCallbackRef.current('contact')
        } else if (
          textChunk.includes('tema de hoy') ||
          textChunk.includes('el tema') ||
          textChunk.includes('hoy hablaremos') ||
          textChunk.includes('hoy vamos a platicar') ||
          textChunk.includes('bienvenidos a')
        ) {
          lastIntentTimeRef.current = now
          intentCallbackRef.current('topic')
        } else if (
          textChunk.includes('nuestro invitado') ||
          textChunk.includes('con nosotros está') ||
          textChunk.includes('le damos la bienvenida') ||
          textChunk.includes('invitada especial') ||
          textChunk.includes('invitado especial') ||
          textChunk.includes('nos acompaña hoy')
        ) {
          lastIntentTimeRef.current = now
          intentCallbackRef.current('guest')
        }
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

    rec.current = rec
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
