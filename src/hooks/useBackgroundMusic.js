import { useState, useEffect, useRef, useCallback } from 'react'

export function useBackgroundMusic(tracks, initialVolume = 30) {
  const audioRef = useRef(null)
  const playingRef = useRef(false)
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(initialVolume)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  return {
    trackIndex,
    playing,
    toggle,
    nextTrack,
    volume,
    setVolume,
    loading,
    error,
    currentTrack: tracks[trackIndex],
    getAudioElement: () => audioRef.current,
  }
}
