import { useState, useRef, useCallback, useEffect } from 'react'
import { playBroadcastSfx, stopBroadcastSfx } from '../utils/masterBroadcastEngine.js'

export function useSoundEffect() {
  const stopRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => () => {
    stopRef.current?.()
    stopRef.current = null
    stopBroadcastSfx()
  }, [])

  const stopSfx = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    stopBroadcastSfx()
    setPlayingId(null)
  }, [])

  const playSfx = useCallback(async (sfx) => {
    if (!sfx?.url) return

    stopRef.current?.()
    stopRef.current = null
    stopBroadcastSfx()

    setPlayingId(sfx.id)
    setError(null)

    let disposed = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      stopBroadcastSfx()
      if (stopRef.current === dispose) stopRef.current = null
    }
    stopRef.current = dispose

    // 1. Intentar reproducir a través del motor Web Audio Broadcast (directo a grabación y stream)
    try {
      const broadcastSource = await playBroadcastSfx(sfx.url, 0.9)
      if (broadcastSource) {
        broadcastSource.addEventListener('ended', () => {
          if (!disposed) {
            setPlayingId(null)
            if (stopRef.current === dispose) stopRef.current = null
          }
        }, { once: true })
        return
      }
    } catch (e) {
      console.warn('[useSoundEffect] Broadcast SFX engine error, using HTMLAudio fallback:', e)
    }

    // 2. Fallback estándar a HTMLAudioElement en caso de error de red Web Audio
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = sfx.url
    audio.volume = 0.9

    const audioDispose = () => {
      if (disposed) return
      disposed = true
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (stopRef.current === audioDispose) stopRef.current = null
    }
    stopRef.current = audioDispose

    audio.onended = () => {
      audioDispose()
      setPlayingId(null)
    }

    audio.onerror = () => {
      audioDispose()
      setPlayingId(null)
      setError(`"${sfx.name}" no está disponible. Prueba otro efecto.`)
    }

    const tryPlay = () => {
      audio.play().catch(() => {
        audioDispose()
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
