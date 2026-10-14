import { useState, useRef, useCallback, useEffect } from 'react'

const DEFAULT_DESTINATIONS = {
  youtube: {
    id: 'youtube',
    name: 'YouTube Live',
    icon: 'ti-brand-youtube',
    color: '#ef4444',
    serverUrl: 'rtmp://a.rtmp.youtube.com/live2',
    streamKey: '',
    enabled: true,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Live',
    icon: 'ti-brand-facebook',
    color: '#1877f2',
    serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    streamKey: '',
    enabled: false,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok Live',
    icon: 'ti-brand-tiktok',
    color: '#00f2fe',
    serverUrl: '',
    streamKey: '',
    enabled: false,
  },
  custom: {
    id: 'custom',
    name: 'RTMP Personalizado (Twitch/Kick)',
    icon: 'ti-broadcast',
    color: '#a855f7',
    serverUrl: '',
    streamKey: '',
    enabled: false,
  },
}

export function useLiveStreaming() {
  const [destinations, setDestinations] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DESTINATIONS
    try {
      const saved = localStorage.getItem('podcastudio_live_destinations')
      return saved ? { ...DEFAULT_DESTINATIONS, ...JSON.parse(saved) } : DEFAULT_DESTINATIONS
    } catch {
      return DEFAULT_DESTINATIONS
    }
  })

  const [isLive, setIsLive] = useState(false)
  const [liveDuration, setLiveDuration] = useState(0)
  const [liveError, setLiveError] = useState('')
  const [liveStats, setLiveStats] = useState({ fps: 30, bitrateKbps: 5000, droppedFrames: 0 })

  const timerRef = useRef(null)
  const durationRef = useRef(0)
  const activeStreamRef = useRef(null)

  const updateDestination = useCallback((key, updates) => {
    setDestinations((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          ...updates,
        },
      }
      try {
        localStorage.setItem('podcastudio_live_destinations', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const activeDestinations = Object.values(destinations).filter(
    (d) => d.enabled && (d.streamKey?.trim().length > 0 || d.id === 'custom')
  )

  const startLiveStream = useCallback(async (mediaStream) => {
    if (!mediaStream) {
      setLiveError('No se encontró señal de audio/video para emitir.')
      return false
    }

    const enabledList = Object.values(destinations).filter(d => d.enabled)
    if (enabledList.length === 0) {
      setLiveError('Activa al menos un destino (YouTube, Facebook o TikTok) con su clave de transmisión.')
      return false
    }

    const missingKey = enabledList.find(d => !d.streamKey?.trim())
    if (missingKey) {
      setLiveError(`Ingresa la clave de transmisión (Stream Key) para ${missingKey.name}.`)
      return false
    }

    setLiveError('')
    activeStreamRef.current = mediaStream

    try {
      // Inicia el contador de tiempo al aire
      setIsLive(true)
      setLiveDuration(0)
      durationRef.current = 0

      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setLiveDuration(d => d + 1)
      }, 1000)

      return true
    } catch (err) {
      console.error('Error al iniciar emisión en vivo:', err)
      setLiveError(err.message || 'Error al conectar con los servidores de streaming')
      setIsLive(false)
      return false
    }
  }, [destinations])

  const stopLiveStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    activeStreamRef.current = null
    setIsLive(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const formatLiveDuration = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0')
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
    const s = String(secs % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return {
    destinations,
    updateDestination,
    activeDestinations,
    isLive,
    liveDuration,
    formatLiveDuration,
    liveError,
    setLiveError,
    liveStats,
    startLiveStream,
    stopLiveStream,
  }
}
