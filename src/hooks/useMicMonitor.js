import { useEffect, useRef } from 'react'

/** Reproduce el micrófono en altavoces para escucharte en vivo (el video va mute por autoplay). */
export function useMicMonitor(micStream) {
  const audioRef = useRef(null)

  useEffect(() => {
    if (!micStream?.getAudioTracks?.()?.length) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.srcObject = null
      }
      return undefined
    }

    const el = audioRef.current || new Audio()
    el.autoplay = true
    el.muted = false
    el.volume = 1
    if (el.srcObject !== micStream) el.srcObject = micStream

    const start = () => { el.play().catch(() => {}) }
    start()
    document.addEventListener('click', start, { once: true })

    audioRef.current = el

    return () => {
      document.removeEventListener('click', start)
      el.pause()
      el.srcObject = null
    }
  }, [micStream])
}
