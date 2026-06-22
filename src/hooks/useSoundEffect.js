import { useState, useRef, useCallback, useEffect } from 'react'

export function useSoundEffect() {
  const stopRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => () => {
    stopRef.current?.()
    stopRef.current = null
  }, [])

  const stopSfx = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setPlayingId(null)
  }, [])

  const playSfx = useCallback((sfx) => {
    if (!sfx?.url) return

    stopRef.current?.()
    stopRef.current = null

    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = sfx.url
    audio.volume = 0.9

    let disposed = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (stopRef.current === dispose) stopRef.current = null
    }

    stopRef.current = dispose
    setPlayingId(sfx.id)
    setError(null)

    audio.onended = () => {
      dispose()
      setPlayingId(null)
    }

    audio.onerror = () => {
      dispose()
      setPlayingId(null)
      setError(`"${sfx.name}" no está disponible. Prueba otro efecto.`)
    }

    const tryPlay = () => {
      audio.play().catch(() => {
        dispose()
        setPlayingId(null)
        setError('No se pudo reproducir. Haz clic de nuevo en el efecto.')
      })
    }

    if (audio.readyState >= 2) tryPlay()
    else {
      audio.addEventListener('canplay', tryPlay, { once: true })
      audio.load()
    }
  }, [])

  return { playSfx, stopSfx, playingSfxId: playingId, sfxError: error }
}
