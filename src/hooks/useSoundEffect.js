import { useState, useRef, useCallback, useEffect } from 'react'

export function useSoundEffect() {
  const audioRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  const playSfx = useCallback((sfx) => {
    if (!sfx?.url) return
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.pause()
    audio.loop = false
    audio.src = sfx.url
    audio.volume = 0.9
    setPlayingId(sfx.id)
    setError(null)
    audio.play().catch(() => {
      setError('No se pudo reproducir el efecto')
      setPlayingId(null)
    })
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => {
      setError('Efecto no disponible')
      setPlayingId(null)
    }
  }, [])

  const stopSfx = useCallback(() => {
    audioRef.current?.pause()
    setPlayingId(null)
  }, [])

  return { playSfx, stopSfx, playingSfxId: playingId, sfxError: error }
}
