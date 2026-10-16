import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
}

function getStudioSessionPrefix() {
  if (typeof window === 'undefined') return 'pcd_studio'
  try {
    let id = sessionStorage.getItem('podcastudio_remote_session_prefix')
    if (!id) {
      id = 'pcd_' + Math.random().toString(36).substring(2, 7)
      sessionStorage.setItem('podcastudio_remote_session_prefix', id)
    }
    return id
  } catch {
    return 'pcd_studio'
  }
}

export function useRemoteCameraManager({ onStreamConnected, onStreamDisconnected }) {
  const [remoteStatus, setRemoteStatus] = useState({}) // { [slotIndex]: 'disconnected' | 'waiting' | 'connected' }
  const channelsRef = useRef({}) // { [slotIndex]: supabaseChannel }
  const peerConnectionsRef = useRef({}) // { [slotIndex]: RTCPeerConnection }
  const iceQueuesRef = useRef({}) // { [slotIndex]: [] }
  const sessionPrefixRef = useRef(getStudioSessionPrefix())

  const getRoomCodeForSlot = useCallback((slotIndex) => {
    return `${sessionPrefixRef.current}_c${slotIndex + 1}`
  }, [])

  const disconnectSlot = useCallback((slotIndex) => {
    // 1. Cerrar RTCPeerConnection
    if (peerConnectionsRef.current[slotIndex]) {
      try {
        peerConnectionsRef.current[slotIndex].close()
      } catch {}
      delete peerConnectionsRef.current[slotIndex]
    }
    delete iceQueuesRef.current[slotIndex]

    // 2. Notificar por canal si sigue abierto
    if (channelsRef.current[slotIndex]) {
      try {
        channelsRef.current[slotIndex].send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'studio-disconnect', slotIndex },
        }).catch(() => {})
      } catch {}
    }

    setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'disconnected' }))
    if (onStreamDisconnected) onStreamDisconnected(slotIndex)
  }, [onStreamDisconnected])

  const listenToSlot = useCallback((slotIndex) => {
    if (!supabase) {
      console.warn('[RemoteCamManager] Supabase no está configurado para señalización WebRTC')
      return
    }

    const roomCode = getRoomCodeForSlot(slotIndex)
    const channelName = `remotecam_${roomCode}`

    // Si ya existe suscripción para este canal, no duplicar
    if (channelsRef.current[slotIndex]) return

    setRemoteStatus(prev => ({ ...prev, [slotIndex]: prev[slotIndex] === 'connected' ? 'connected' : 'waiting' }))
    iceQueuesRef.current[slotIndex] = []

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'signal' }, async (event) => {
      const payload = event?.payload
      if (!payload) return

      // Descartar mensajes enviados por el propio estudio
      if (payload.sender === 'studio') return

      const pc = peerConnectionsRef.current[slotIndex]

      if (payload.type === 'phone-ready' || payload.type === 'request-offer') {
        // El teléfono está listo para transmitir
        setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'waiting' }))
        try {
          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'studio-ready', slotIndex, sender: 'studio' },
          })
        } catch {}
        return
      }

      if (payload.type === 'offer') {
        try {
          // Limpiar peer connection previa si existía
          if (peerConnectionsRef.current[slotIndex]) {
            try { peerConnectionsRef.current[slotIndex].close() } catch {}
          }

          const newPc = new RTCPeerConnection(RTC_CONFIG)
          peerConnectionsRef.current[slotIndex] = newPc
          iceQueuesRef.current[slotIndex] = []

          newPc.ontrack = (trackEvent) => {
            const stream = trackEvent.streams[0] || new MediaStream([trackEvent.track])
            setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'connected' }))
            if (onStreamConnected) {
              onStreamConnected(slotIndex, stream, `iPhone Remoto ${slotIndex + 1}`)
            }
          }

          newPc.onicecandidate = (iceEvent) => {
            if (iceEvent.candidate) {
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                  type: 'candidate',
                  candidate: iceEvent.candidate.toJSON(),
                  sender: 'studio',
                },
              }).catch(() => {})
            }
          }

          newPc.onconnectionstatechange = () => {
            const state = newPc.connectionState
            if (state === 'connected') {
              setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'connected' }))
            } else if (state === 'disconnected' || state === 'failed') {
              setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'waiting' }))
            } else if (state === 'closed') {
              setRemoteStatus(prev => ({ ...prev, [slotIndex]: 'disconnected' }))
            }
          }

          await newPc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

          // Aplicar candidatos ICE encolados
          const queue = iceQueuesRef.current[slotIndex] || []
          while (queue.length > 0) {
            const cand = queue.shift()
            try { await newPc.addIceCandidate(cand) } catch (err) { console.warn('ICE add error:', err) }
          }

          const answer = await newPc.createAnswer()
          await newPc.setLocalDescription(answer)

          await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              type: 'answer',
              sdp: answer,
              sender: 'studio',
            },
          })
        } catch (err) {
          console.error('[RemoteCamManager] Error procesando offer WebRTC:', err)
        }
        return
      }

      if (payload.type === 'candidate' && payload.candidate) {
        const iceCandidate = new RTCIceCandidate(payload.candidate)
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(iceCandidate)
          } catch (err) {
            console.warn('[RemoteCamManager] Error agregando ICE candidate:', err)
          }
        } else {
          iceQueuesRef.current[slotIndex] = iceQueuesRef.current[slotIndex] || []
          iceQueuesRef.current[slotIndex].push(iceCandidate)
        }
        return
      }

      if (payload.type === 'phone-disconnect') {
        disconnectSlot(slotIndex)
      }
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'studio-ready', slotIndex, sender: 'studio' },
        }).catch(() => {})
      }
    })

    channelsRef.current[slotIndex] = channel
  }, [getRoomCodeForSlot, onStreamConnected, disconnectSlot])

  // Cleanup general al desmontar
  useEffect(() => {
    return () => {
      Object.keys(channelsRef.current).forEach((slot) => {
        try { channelsRef.current[slot]?.unsubscribe() } catch {}
      })
      Object.keys(peerConnectionsRef.current).forEach((slot) => {
        try { peerConnectionsRef.current[slot]?.close() } catch {}
      })
    }
  }, [])

  return {
    getRoomCodeForSlot,
    listenToSlot,
    disconnectSlot,
    remoteStatus,
  }
}
