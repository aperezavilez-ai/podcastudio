import { useState, useEffect, useRef, useCallback } from 'react'

export function useBackgroundMusic(tracks, initialVolume = 30, { micLevel = 0 } = {}) {
  const audioRef = useRef(null)
  const playingRef = useRef(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(initialVolume)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [duckingEnabled, setDuckingEnabledState] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_audio_ducking')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const isDuckingRef = useRef(false)
  const duckReleaseTimerRef = useRef(null)

  const setDuckingEnabled = useCallback((enabledOrFn) => {
    setDuckingEnabledState(prev => {
      const next = typeof enabledOrFn === 'function' ? enabledOrFn(prev) : enabledOrFn
      try { localStorage.setItem('podcastudio_audio_ducking', String(next)) } catch {}
      return next
    })
  }, [])

  const toggleDucking = useCallback(() => {
    setDuckingEnabled(prev => !prev)
  }, [setDuckingEnabled])

  playingRef.current = playing

  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  // Auto-Ducking reactivo al nivel de voz del micrófono
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const baseVol = Math.max(0, Math.min(1, volume / 100))

    if (!duckingEnabled || !playing) {
      audio.volume = baseVol
      return
    }

    const speaking = micLevel > 14
    if (speaking) {
      clearTimeout(duckReleaseTimerRef.current)
      isDuckingRef.current = true
      // Atenuación suave a un 25% del volumen normal (sensación broadcast)
      audio.volume = baseVol * 0.25
    } else if (isDuckingRef.current) {
      clearTimeout(duckReleaseTimerRef.current)
      duckReleaseTimerRef.current = setTimeout(() => {
        isDuckingRef.current = false
        if (audioRef.current) {
          audioRef.current.volume = baseVol
        }
      }, 1000)
    } else {
      audio.volume = baseVol
    }
  }, [micLevel, volume, duckingEnabled, playing])

  useEffect(() => {
    const audio = audioRef.current
    const track = tracks[trackIndex]
    if (!audio || !track?.url) return

    setLoading(true)
    setError(null)
    audio.pause()
    audio.src = track.url
    audio.volume = volume / 100

    const onCanPlay = () => {
      setLoading(false)
      if (playingRef.current) {
        audio.play().catch(() => {
          setError('Haz clic en play para iniciar')
          setPlaying(false)
        })
      }
    }

    const onError = () => {
      setLoading(false)
      setError('No se pudo cargar la pista')
      setPlaying(false)
    }

    audio.addEventListener('canplay', onCanPlay, { once: true })
    audio.addEventListener('error', onError, { once: true })

    return () => {
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('error', onError)
    }
  }, [trackIndex, tracks])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume / 100
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio?.src) return

    if (playing) {
      setLoading(true)
      audio.play()
        .then(() => { setLoading(false); setError(null) })
        .catch(() => {
          setLoading(false)
          setError('Haz clic en play para iniciar')
          setPlaying(false)
        })
    } else {
      audio.pause()
      setLoading(false)
    }
  }, [playing])

  const toggle = useCallback(() => setPlaying(p => !p), [])

  const nextTrack = useCallback(() => {
    setTrackIndex(i => (i + 1) % tracks.length)
    setPlaying(true)
  }, [tracks.length])

  const selectTrack = useCallback((index) => {
    if (index < 0 || index >= tracks.length) return
    setTrackIndex(index)
  }, [tracks.length])

  const selectTrackById = useCallback((id, autoPlay = false) => {
    const idx = tracks.findIndex(t => t.id === id)
    if (idx >= 0) {
      setTrackIndex(idx)
      if (autoPlay) setPlaying(true)
    }
  }, [tracks])

  return {
    trackIndex,
    playing,
    toggle,
    nextTrack,
    selectTrack,
    selectTrackById,
    setPlaying,
    volume,
    setVolume,
    duckingEnabled,
    setDuckingEnabled,
    toggleDucking,
    loading,
    error,
    currentTrack: tracks[trackIndex],
    getAudioElement: () => audioRef.current,
  }
}
