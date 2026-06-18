import { useCallback, useRef, useState } from 'react'
import { createLiveSession, sendLiveOffer, stopLiveSession } from '../lib/integrations.js'

export function useLiveBroadcast() {
  const [liveOn, setLiveOn] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const pcRef = useRef(null)
  const sessionRef = useRef(null)

  const startDemo = useCallback(() => {
    setLiveOn(true)
    setStatus('Modo demo (conecta Restream + Livepeer para transmitir de verdad)')
    setError(null)
  }, [])

  const stop = useCallback(async () => {
    const session = sessionRef.current
    sessionRef.current = null

    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop())
      pcRef.current.close()
      pcRef.current = null
    }

    if (session?.streamId) {
      try {
        await stopLiveSession(session.streamId, session.sessionId)
      } catch { /* noop */ }
    }

    setLiveOn(false)
    setStatus('')
  }, [])

  const start = useCallback(async (mediaStream, title) => {
    if (!mediaStream) throw new Error('Sin señal de video')
    setError(null)
    setStatus('Conectando con Restream…')

    const session = await createLiveSession(title)
    sessionRef.current = session

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    pcRef.current = pc

    mediaStream.getTracks().forEach((track) => {
      pc.addTrack(track, mediaStream)
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    setStatus('Estableciendo transmisión WebRTC…')
    const answerSdp = await sendLiveOffer(session.streamId, offer.sdp)
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    setLiveOn(true)
    setStatus('En vivo vía Restream')
    return session
  }, [])

  return { liveOn, status, error, start, startDemo, stop, setError }
}
