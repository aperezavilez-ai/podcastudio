import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10, // Mayor pool para conexión más rápida
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
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
  const [remoteStatus, setRemoteStatus] = useState({})
  const channelsRef = useRef({})
  const peerConnectionsRef = useRef({})
  const iceQueuesRef = useRef({})
  const activeTracksRef = useRef({})
  const compoundStreamsRef = useRef({})
  const sessionPrefixRef = useRef(getStudioSessionPrefix())

  const getRoomCodeForSlot = useCallback(
    (slotIndex) => {
      return `${sessionPrefixRef.current}_c${slotIndex + 1}`
    },
    []
  )

  const disconnectSlot = useCallback(
    (slotIndex) => {
      if (peerConnectionsRef.current[slotIndex]) {
        try {
          peerConnectionsRef.current[slotIndex].close()
        } catch {}
        delete peerConnectionsRef.current[slotIndex]
      }
      delete iceQueuesRef.current[slotIndex]
      delete activeTracksRef.current[slotIndex]
      delete compoundStreamsRef.current[slotIndex]
      if (channelsRef.current[slotIndex]) {
        try {
          channelsRef.current[slotIndex]
            .send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'studio-disconnect', slotIndex },
            })
            .catch(() => {})
        } catch {}
      }
      setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'disconnected' }))
      if (onStreamDisconnected) onStreamDisconnected(slotIndex)
    },
    [onStreamDisconnected]
  )

  const listenToSlot = useCallback(
    (slotIndex) => {
      if (!supabase) {
        console.warn('[RemoteCamManager] Supabase no está configurado para señalización WebRTC')
        return
      }
      const roomCode = getRoomCodeForSlot(slotIndex)
      const channelName = `remotecam_${roomCode}`
      if (channelsRef.current[slotIndex]) return
      setRemoteStatus((prev) => ({
        ...prev,
        [slotIndex]: prev[slotIndex] === 'connected' ? 'connected' : 'waiting',
      }))
      iceQueuesRef.current[slotIndex] = []
      activeTracksRef.current[slotIndex] = new Map()
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      })
      channel.on('broadcast', { event: 'signal' }, async (event) => {
        const payload = event?.payload
        if (!payload) return
        if (payload.sender === 'studio') return
        if (payload.type === 'phone-ready' || payload.type === 'request-offer') {
          setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'waiting' }))
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
            const existingPc = peerConnectionsRef.current[slotIndex]
            if (
              existingPc &&
              (existingPc.connectionState === 'connected' ||
                existingPc.iceConnectionState === 'connected')
            ) {
              console.log(
                '[RemoteCamManager] Conexión ya establecida en slot',
                slotIndex,
                '- ignorando oferta redundante'
              )
              return
            }
            if (existingPc) {
              try {
                existingPc.close()
              } catch {}
            }
            compoundStreamsRef.current[slotIndex] = null
            const callerLabel = payload.guestName
              ? payload.sessionRole === 'student'
                ? `Alumno: ${payload.guestName}`
                : payload.guestName
              : payload.sessionRole === 'student'
              ? `Alumno CAM ${slotIndex + 1}`
              : `iPhone Remoto ${slotIndex + 1}`
            const newPc = new RTCPeerConnection(RTC_CONFIG)
            peerConnectionsRef.current[slotIndex] = newPc
            const trackMap = new Map()
            activeTracksRef.current[slotIndex] = trackMap

            const dispatchStreamUpdate = () => {
              const liveTracks = Array.from(trackMap.values()).filter(
                (t) => t && t.readyState !== 'ended'
              )
              if (liveTracks.length === 0) return
              let stream = compoundStreamsRef.current[slotIndex]
              if (!stream) {
                stream = new MediaStream()
                compoundStreamsRef.current[slotIndex] = stream
              }
              const currentIds = new Set(stream.getTracks().map((t) => t.id))
              const desiredIds = new Set(liveTracks.map((t) => t.id))
              stream.getTracks().forEach((t) => {
                if (!desiredIds.has(t.id)) {
                  try {
                    stream.removeTrack(t)
                  } catch {}
                }
              })
              liveTracks.forEach((t) => {
                if (!currentIds.has(t.id)) {
                  try {
                    if (t.kind === 'video') t.contentHint = 'motion'
                    stream.addTrack(t)
                  } catch {}
                }
              })
              setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'connected' }))
              if (onStreamConnected) {
                onStreamConnected(slotIndex, stream, callerLabel)
              }
            }

            newPc.ontrack = (trackEvent) => {
              const track = trackEvent.track
              if (!track) return
              trackMap.set(track.id, track)
              track.onunmute = () => {
                dispatchStreamUpdate()
              }
              track.onmute = () => {
                // Conservar track en silencio temporal
              }
              track.onended = () => {
                trackMap.delete(track.id)
                dispatchStreamUpdate()
              }
              if (trackEvent.streams && trackEvent.streams[0]) {
                trackEvent.streams[0].getTracks().forEach((t) => {
                  trackMap.set(t.id, t)
                  t.onunmute = () => dispatchStreamUpdate()
                })
              }
              // 👇 DIRECTIVA CLAVE: latencia cero en el receptor
              const receiver = trackEvent.receiver
              if (receiver && 'playoutDelayHint' in receiver) {
                receiver.playoutDelayHint = 0
              }
              dispatchStreamUpdate()
            }

            newPc.onicecandidate = (iceEvent) => {
              if (iceEvent.candidate) {
                channel
                  .send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: {
                      type: 'candidate',
                      candidate: iceEvent.candidate.toJSON(),
                      sender: 'studio',
                    },
                  })
                  .catch(() => {})
              }
            }

            newPc.onconnectionstatechange = () => {
              const state = newPc.connectionState
              if (state === 'connected') {
                setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'connected' }))
                dispatchStreamUpdate()
              } else if (state === 'disconnected' || state === 'failed') {
                setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'waiting' }))
              } else if (state === 'closed') {
                setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'disconnected' }))
              }
            }

            newPc.oniceconnectionstatechange = () => {
              const ice = newPc.iceConnectionState
              if (ice === 'connected' || ice === 'completed') {
                setRemoteStatus((prev) => ({ ...prev, [slotIndex]: 'connected' }))
                dispatchStreamUpdate()
              }
            }

            await newPc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            // Aplicar playoutDelayHint a todos los receptores
            newPc.getReceivers().forEach((receiver) => {
              if ('playoutDelayHint' in receiver) {
                receiver.playoutDelayHint = 0
              }
            })
            const initialQueue = iceQueuesRef.current[slotIndex] || []
            iceQueuesRef.current[slotIndex] = []
            for (const cand of initialQueue) {
              try {
                await newPc.addIceCandidate(cand)
              } catch (err) {
                console.warn('[RemoteCamManager] ICE add error:', err)
              }
            }
            const answer = await newPc.createAnswer()
            await newPc.setLocalDescription(answer)
            const postQueue = iceQueuesRef.current[slotIndex] || []
            iceQueuesRef.current[slotIndex] = []
            for (const cand of postQueue) {
              try {
                await newPc.addIceCandidate(cand)
              } catch {}
            }
            await channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'answer', sdp: answer, sender: 'studio' },
            })
          } catch (err) {
            console.error('[RemoteCamManager] Error procesando offer WebRTC:', err)
          }
          return
        }
        if (payload.type === 'candidate' && payload.candidate) {
          const currentPc = peerConnectionsRef.current[slotIndex]
          const iceCandidate = new RTCIceCandidate(payload.candidate)
          if (currentPc && currentPc.remoteDescription && currentPc.remoteDescription.type) {
            try {
              await currentPc.addIceCandidate(iceCandidate)
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
          channel
            .send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'studio-ready', slotIndex, sender: 'studio' },
            })
            .catch(() => {})
        }
      })
      channelsRef.current[slotIndex] = channel
    },
    [getRoomCodeForSlot, onStreamConnected, disconnectSlot]
  )

  useEffect(() => {
    return () => {
      Object.keys(channelsRef.current).forEach((slot) => {
        try {
          channelsRef.current[slot]?.unsubscribe()
        } catch {}
      })
      Object.keys(peerConnectionsRef.current).forEach((slot) => {
        try {
          peerConnectionsRef.current[slot]?.close()
        } catch {}
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