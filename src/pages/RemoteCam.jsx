import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { getWebRtcConfig } from '../utils/rtcConfig.js'
import styles from './RemoteCam.module.css'

const RTC_CONFIG = getWebRtcConfig()


// TIERS CORREGIDOS: 720p30 es el estándar broadcast de oro para móviles.
// Evita el motion blur y la saturación del encoder.
const QUALITY_TIERS = [
  { label: 'HD 720p', maxBitrate: 2500000, width: 1280, height: 720, frameRate: 30 },
  { label: 'SD+ 540p', maxBitrate: 1500000, width: 960, height: 540, frameRate: 30 },
  { label: 'SD 360p', maxBitrate: 800000, width: 640, height: 360, frameRate: 24 },
]
const RTT_DEGRADE_MS = 300     
const RTT_HEALTHY_MS = 120     
const HEALTHY_CHECKS_TO_RISE = 3

function applyVideoSenderParams(sender, tier) {
  if (!sender) return
  try {
    const params = sender.getParameters() || {}
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    const e = params.encodings[0]
    
    e.maxBitrate = tier.maxBitrate
    e.maxFramerate = tier.frameRate
    e.priority = 'high'
    e.networkPriority = 'high'
    // CLAVE: Ya no forzamos minBitrate. Si la red cae, WebRTC debe bajar la calidad.
    
    if ('degradationPreference' in params) {
      params.degradationPreference = 'maintain-framerate'
    }
    sender.setParameters(params).catch(() => {})
  } catch {}
}

function applyAudioSenderParams(sender) {
  if (!sender) return
  try {
    const params = sender.getParameters() || {}
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    params.encodings[0].maxBitrate = 128000
    params.encodings[0].priority = 'high'
    params.encodings[0].networkPriority = 'high'
    sender.setParameters(params).catch(() => {})
  } catch {}
}

export default function RemoteCam() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const slot = searchParams.get('slot') || '1'
  const room = searchParams.get('room') || `pcd_cam_${slot}`
  const guestName = searchParams.get('name') || ''
  const sessionRole = searchParams.get('role') || 'guest'

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [qualityLabel, setQualityLabel] = useState('HD 720p')

  // FASE 4: Grabación Local de Respaldo en Celular (Local Backup)
  const [localBackupActive, setLocalBackupActive] = useState(false)
  const [localBackupDuration, setLocalBackupDuration] = useState(0)
  const [localBackupBlobUrl, setLocalBackupBlobUrl] = useState(null)
  const localRecorderRef = useRef(null)
  const localChunksRef = useRef([])
  const localTimerRef = useRef(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const pcRef = useRef(null)

  const channelRef = useRef(null)
  const iceQueueRef = useRef([])
  const wakeLockRef = useRef(null)
  const videoSenderRef = useRef(null)
  const audioSenderRef = useRef(null)
  const offerSentRef = useRef(false)
  const isOfferingRef = useRef(false)
  const handshakeTimerRef = useRef(null)
  const iceRecoveryTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const adaptTimerRef = useRef(null)
  const tierIndexRef = useRef(0)
  const healthyChecksRef = useRef(0)
  const lastBytesRef = useRef({ bytes: 0, ts: 0 })

  const startAdaptationEngine = useCallback(() => {
    if (adaptTimerRef.current) clearInterval(adaptTimerRef.current)
    tierIndexRef.current = 0
    healthyChecksRef.current = 0
    lastBytesRef.current = { bytes: 0, ts: performance.now() }

    adaptTimerRef.current = setInterval(async () => {
      const pc = pcRef.current
      if (!pc || pc.connectionState !== 'connected') return
      try {
        const stats = await pc.getStats()
        let rttMs = 0
        let fps = 0
        let limitation = ''
        let bytes = 0
        stats.forEach((r) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null) {
            rttMs = Math.round(r.currentRoundTripTime * 1000)
          }
          if (r.type === 'outbound-rtp' && r.kind === 'video') {
            fps = r.framesPerSecond || 0
            limitation = r.qualityLimitationReason || ''
            bytes = r.bytesSent || 0
          }
        })

        const now = performance.now()
        const dtSec = (now - lastBytesRef.current.ts) / 1000
        const kbps = dtSec > 0 ? Math.round(((bytes - lastBytesRef.current.bytes) * 8) / dtSec / 1000) : 0
        lastBytesRef.current = { bytes, ts: now }

        const mustDegrade =
          rttMs > RTT_DEGRADE_MS ||
          limitation === 'bandwidth' ||
          limitation === 'cpu'
          
        if (mustDegrade && tierIndexRef.current < QUALITY_TIERS.length - 1) {
          tierIndexRef.current += 1
          healthyChecksRef.current = 0
          applyTier(tierIndexRef.current)
          console.log(`[RemoteCam] Red saturada → bajando a ${QUALITY_TIERS[tierIndexRef.current].label}`)
          return
        }

        const isHealthy = rttMs > 0 && rttMs < RTT_HEALTHY_MS && (fps === 0 || fps >= 25) && limitation === ''
        if (isHealthy) {
          healthyChecksRef.current += 1
          if (healthyChecksRef.current >= HEALTHY_CHECKS_TO_RISE && tierIndexRef.current > 0) {
            tierIndexRef.current -= 1
            healthyChecksRef.current = 0
            applyTier(tierIndexRef.current)
            console.log(`[RemoteCam] Red sana → subiendo a ${QUALITY_TIERS[tierIndexRef.current].label}`)
          }
        } else {
          healthyChecksRef.current = 0
        }
      } catch { }
    }, 2000)

    const applyTier = (idx) => {
      const tier = QUALITY_TIERS[idx]
      setQualityLabel(tier.label)
      if (videoSenderRef.current) {
        applyVideoSenderParams(videoSenderRef.current, tier)
      }
      const track = streamRef.current?.getVideoTracks?.()?.[0]
      if (track) {
        track.applyConstraints({
          width: { ideal: tier.width },
          height: { ideal: tier.height },
          frameRate: { ideal: tier.frameRate, max: tier.frameRate },
        }).catch(() => {})
      }
    }
  }, [])

  const stopAdaptationEngine = useCallback(() => {
    if (adaptTimerRef.current) {
      clearInterval(adaptTimerRef.current)
      adaptTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    const presenceChannel = supabase.channel('remotecam_presence', {
      config: { broadcast: { self: false } },
    })

    const phoneId = 'phone_' + Math.random().toString(36).substring(2, 8)
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)
    const deviceType = isIos ? 'iPhone' : isAndroid ? 'Android' : 'Celular Móvil'
    const deviceName = guestName.trim()
      ? `${guestName.trim()} (${deviceType})`
      : `${deviceType} (Cámara Wi-Fi)`

    presenceChannel.on('broadcast', { event: 'ping-presence' }, () => {
      presenceChannel.send({
        type: 'broadcast',
        event: 'pong-presence',
        payload: {
          id: phoneId,
          deviceName,
          facing: facingMode,
          slot,
          roomCode: room,
          guestName: guestName.trim() || undefined,
          sessionRole,
          available: true,
        },
      }).catch(() => {})
    })

    presenceChannel.subscribe()
    return () => {
      presenceChannel.unsubscribe().catch(() => {})
    }
  }, [facingMode, room, slot])

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch (e) { }
  }, [])

  const releaseWakeLock = useCallback(() => {
    try {
      wakeLockRef.current?.release?.()
      wakeLockRef.current = null
    } catch {}
  }, [])

  const startLocalBackup = useCallback(() => {

    if (!streamRef.current) return
    try {
      localChunksRef.current = []
      const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || ''
      const mr = mime ? new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 4000000 }) : new MediaRecorder(streamRef.current)
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        if (localChunksRef.current.length > 0) {
          const blob = new Blob(localChunksRef.current, { type: mr.mimeType || 'video/webm' })
          const url = URL.createObjectURL(blob)
          setLocalBackupBlobUrl(url)
        }
      }
      mr.start(1000)
      localRecorderRef.current = mr
      setLocalBackupActive(true)
      setLocalBackupDuration(0)
      if (localTimerRef.current) clearInterval(localTimerRef.current)
      localTimerRef.current = setInterval(() => {
        setLocalBackupDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      console.warn('Error al iniciar grabacion local de respaldo:', err)
    }
  }, [])

  const stopLocalBackup = useCallback(() => {
    if (localRecorderRef.current && localRecorderRef.current.state !== 'inactive') {
      try { localRecorderRef.current.stop() } catch {}
    }
    if (localTimerRef.current) clearInterval(localTimerRef.current)
    setLocalBackupActive(false)
  }, [])

  const downloadLocalBackup = useCallback(() => {
    if (!localBackupBlobUrl) return
    const a = document.createElement('a')
    a.href = localBackupBlobUrl
    a.download = `backup_camara_${slot + 1}_${Date.now()}.webm`
    a.click()
  }, [localBackupBlobUrl, slot])

  const stopAll = useCallback(() => {
    releaseWakeLock()
    stopAdaptationEngine()
    stopLocalBackup()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }


    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }

    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'phone-disconnect', slot, sender: 'phone' },
        }).catch(() => {})
        channelRef.current.unsubscribe()
      } catch {}
      channelRef.current = null
    }

    if (handshakeTimerRef.current) {
      clearInterval(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    if (iceRecoveryTimerRef.current) {
      clearTimeout(iceRecoveryTimerRef.current)
      iceRecoveryTimerRef.current = null
    }
    reconnectAttemptsRef.current = 0
    videoSenderRef.current = null
    audioSenderRef.current = null
    offerSentRef.current = false
    isOfferingRef.current = false
    iceQueueRef.current = []
    setActive(false)
    setStatus('idle')
    setTorchOn(false)
    setMicMuted(false)
    setQualityLabel('HD 720p')
  }, [releaseWakeLock, stopAdaptationEngine, slot])

  const initSignaling = useCallback(async (localStream) => {
    if (!supabase) {
      setErrorMsg('No se pudo inicializar la conexión.')
      setStatus('error')
      return
    }

    setStatus('connecting')
    const pc = new RTCPeerConnection(RTC_CONFIG)
    pcRef.current = pc
    iceQueueRef.current = []
    reconnectAttemptsRef.current = 0

    localStream.getTracks().forEach((track) => {
      try {
        if (track.kind === 'video') track.contentHint = 'motion'
        if (track.kind === 'audio') track.contentHint = 'speech'
      } catch {}
      const sender = pc.addTrack(track, localStream)
      if (track.kind === 'video') {
        videoSenderRef.current = sender
        applyVideoSenderParams(sender, QUALITY_TIERS[0])
      } else if (track.kind === 'audio') {
        audioSenderRef.current = sender
        applyAudioSenderParams(sender)
      }
    })

    const channelName = `remotecam_${room}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'candidate', candidate: event.candidate.toJSON(), sender: 'phone' },
        }).catch(() => {})
      }
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        setStatus('connected')
        reconnectAttemptsRef.current = 0
      } else if (s === 'disconnected' || s === 'failed') {
        setStatus('connecting')
      } else if (s === 'closed') {
        setStatus('idle')
      }
    }

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState
      if (ice === 'connected' || ice === 'completed') {
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        if (iceRecoveryTimerRef.current) {
          clearTimeout(iceRecoveryTimerRef.current)
          iceRecoveryTimerRef.current = null
        }
      } else if (ice === 'disconnected') {
        if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current)
        iceRecoveryTimerRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === 'disconnected') {
            scheduleReconnect()
          }
        }, 3000)
      } else if (ice === 'failed') {
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (!pcRef.current || pcRef.current.signalingState === 'closed') return
      if (reconnectAttemptsRef.current >= 4) return
      reconnectAttemptsRef.current += 1
      const delay = Math.min(8000, 2000 * Math.pow(2, reconnectAttemptsRef.current - 1))

      if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current)
      iceRecoveryTimerRef.current = setTimeout(async () => {
        const current = pcRef.current
        if (!current || current.signalingState === 'closed') return
        if (current.iceConnectionState === 'connected' || current.iceConnectionState === 'completed') return
        offerSentRef.current = false
        await sendOffer(true)
      }, delay)
    }

    const sendOffer = async (isRestart = false) => {
      if (isOfferingRef.current || offerSentRef.current) return
      isOfferingRef.current = true
      try {
        if (!pc || pc.signalingState === 'closed') return
        if (pc.signalingState !== 'stable') return
        if (isRestart) {
          try { pc.restartIce() } catch {}
        }
        const offer = await pc.createOffer({
          offerToReceiveVideo: false,
          offerToReceiveAudio: false,
          ...(isRestart ? { iceRestart: true } : {}),
        })
        await pc.setLocalDescription(offer)

        if (videoSenderRef.current) {
          applyVideoSenderParams(videoSenderRef.current, QUALITY_TIERS[tierIndexRef.current])
        }
        if (audioSenderRef.current) applyAudioSenderParams(audioSenderRef.current)

        let finalSdp = offer.sdp || ''
        if (finalSdp && !finalSdp.includes('x-google-min-bitrate')) {
          finalSdp = finalSdp.replace(/(m=video[^\r\n]*\r\n)/, '$1b=AS:2500\r\nb=TIAS:2500000\r\n')
        }

        await channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'offer',
            sdp: { type: offer.type, sdp: finalSdp || offer.sdp },
            sender: 'phone',
            slot,
            guestName: guestName.trim() || undefined,
            sessionRole,
          },
        })
        offerSentRef.current = true
      } catch (err) {
        console.error('Error enviando offer WebRTC:', err)
      } finally {
        isOfferingRef.current = false
      }
    }

    channel.on('broadcast', { event: 'signal' }, async (event) => {
      const payload = event?.payload
      if (!payload || payload.sender === 'phone') return

      if (payload.type === 'studio-ready') {
        if (!offerSentRef.current && pc.signalingState === 'stable') {
          await sendOffer()
        }
        return
      }
      if (payload.type === 'request-offer') {
        offerSentRef.current = false
        await sendOffer(true)
        return
      }
      if (payload.type === 'answer') {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
          setStatus('connected')
          reconnectAttemptsRef.current = 0
          if (handshakeTimerRef.current) {
            clearTimeout(handshakeTimerRef.current)
            clearInterval(handshakeTimerRef.current)
            handshakeTimerRef.current = null
          }
          const queue = iceQueueRef.current || []
          iceQueueRef.current = []
          for (const cand of queue) {
            try { await pc.addIceCandidate(cand) } catch (e) {}
          }
        } catch (err) {}
        return
      }
      if (payload.type === 'candidate' && payload.candidate) {
        const iceCandidate = new RTCIceCandidate(payload.candidate)
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(iceCandidate) } catch (e) {}
        } else {
          iceQueueRef.current.push(iceCandidate)
        }
        return
      }
      if (payload.type === 'studio-disconnect') {
        setStatus('connecting')
        offerSentRef.current = false
      }
    })

    channel.subscribe(async (subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        const notifyStudio = () => {
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'phone-ready', slot, sender: 'phone' },
            }).catch(() => {})
          }
        }
        notifyStudio()
        setTimeout(() => {
          if (!offerSentRef.current && pc.signalingState === 'stable') {
            sendOffer()
          }
        }, 300)

        if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
        handshakeTimerRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.connectionState !== 'connected') {
            notifyStudio()
          }
        }, 7000)
      }
    })

    startAdaptationEngine()
  }, [room, slot, guestName, sessionRole, startAdaptationEngine])

  const startCamera = async (targetFacing = 'environment') => {
    setErrorMsg(null)
    offerSentRef.current = false
    isOfferingRef.current = false
    try {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        latency: { ideal: 0 },
      }

      let stream = null
      try {
        // CORREGIDO: 720p a 30fps para eliminar el desenfoque de movimiento y saturación
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: audioConstraints,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 960, max: 1280 },
              height: { ideal: 540, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: true,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing }, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } },
            audio: false,
          })
        }
      }

      if (stream) {
        stream.getVideoTracks().forEach(t => { try { t.contentHint = 'motion' } catch {} })
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }

      const track = stream.getVideoTracks()[0]
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {}
        setTorchSupported(Boolean(caps.torch))
      }

      setActive(true)
      await requestWakeLock()
      await initSignaling(stream)
    } catch (err) {
      setErrorMsg('No se pudo acceder a la cámara. Autoriza los permisos.')
      setStatus('error')
    }
  }

  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
    setTorchOn(false)

    try {
      let newStream = null
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing }, width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: false,
        })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        })
      }

      const newTrack = newStream.getVideoTracks()[0]
      const oldTrack = streamRef.current?.getVideoTracks?.()?.[0]

      const sender = videoSenderRef.current || pcRef.current?.getSenders?.()?.find(s => s.track?.kind === 'video' || s.kind === 'video')
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack)
      }

      if (oldTrack) oldTrack.stop()

      const existingAudio = streamRef.current?.getAudioTracks?.()?.[0]
      if (existingAudio) newStream.addTrack(existingAudio)

      streamRef.current = newStream
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        videoRef.current.play().catch(() => {})
      }
      const caps = newTrack?.getCapabilities ? newTrack.getCapabilities() : {}
      setTorchSupported(Boolean(caps.torch))
    } catch (err) {}
  }

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0]
    if (!track) return
    const nextTorch = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorch }] })
      setTorchOn(nextTorch)
    } catch (err) {}
  }

  const handleTogglePause = () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0]
    if (track) {
      track.enabled = !track.enabled
      setVideoPaused(!track.enabled)
    }
  }

  const handleToggleMic = () => {
    const track = streamRef.current?.getAudioTracks?.()?.[0]
    if (track) {
      track.enabled = !track.enabled
      setMicMuted(!track.enabled)
    } else {
      setMicMuted(prev => !prev)
    }
  }

  const setVideoEl = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.setAttribute('playsinline', 'true')
      node.setAttribute('webkit-playsinline', 'true')
      node.muted = true
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
      }
      node.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      const v = videoRef.current
      v.setAttribute('playsinline', 'true')
      v.setAttribute('webkit-playsinline', 'true')
      v.muted = true
      if (v.srcObject !== streamRef.current) v.srcObject = streamRef.current
      v.play().catch(() => {})
    }
  }, [active])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && active) {
        await requestWakeLock()
        if (videoRef.current && streamRef.current) videoRef.current.play().catch(() => {})

        const currentVideoTrack = streamRef.current?.getVideoTracks?.()?.[0]
        const isTrackEnded = !currentVideoTrack || currentVideoTrack.readyState === 'ended'

        if (isTrackEnded) {
          try {
            const nextFacing = facingMode
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            })
            const newVideoTrack = newStream.getVideoTracks()[0]
            if (newVideoTrack) { try { newVideoTrack.contentHint = 'motion' } catch {} }
            const newAudioTrack = newStream.getAudioTracks()[0]

            if (videoSenderRef.current && newVideoTrack) await videoSenderRef.current.replaceTrack(newVideoTrack)
            if (audioSenderRef.current && newAudioTrack) await audioSenderRef.current.replaceTrack(newAudioTrack)

            streamRef.current = newStream
            if (videoRef.current) {
              videoRef.current.srcObject = newStream
              videoRef.current.play().catch(() => {})
            }
          } catch (e) {}
        }

        if (pcRef.current) {
          const pcState = pcRef.current.connectionState
          const iceState = pcRef.current.iceConnectionState
          if (pcState === 'disconnected' || pcState === 'failed' || iceState === 'disconnected' || iceState === 'failed') {
            if (channelRef.current && streamRef.current) {
              try {
                await channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'phone-ready', slot, sender: 'phone' } })
              } catch {}
            }
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [active, facingMode, slot, requestWakeLock])

  useEffect(() => {
    return () => { stopAll() }
  }, [stopAll])

  return (
    <div className={styles.container}>
      {!active ? (
        <div className={styles.startScreen}>
          <div className={styles.logoBadge}>
            <i className="ti ti-broadcast" />
            <span>PODCASTUDIO REMOTO</span>
          </div>
          <div className={styles.iconHero}><i className="ti ti-device-mobile" /></div>
          <span className={styles.slotBadgeLarge}>
            {sessionRole === 'student' ? 'AULA VIRTUAL' : sessionRole === 'cohost' ? 'CO-PRESENTADOR' : 'INVITADO EN VIVO'} • CANAL CAM {slot}
          </span>
          <h1 className={styles.title}>{guestName ? `¡Hola, ${guestName}!` : 'Cámara Móvil Inalámbrica'}</h1>
          <p className={styles.desc}>
            {guestName ? 'Conéctate con video HD fluido y audio en vivo.' : 'Conecta la cámara de tu smartphone en tiempo real sin instalar nada.'}
          </p>

          <div style={{ display: 'flex', gap: 10, margin: '8px 0 16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFacingMode('environment')}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: facingMode === 'environment' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'environment' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'environment' ? '#38bdf8' : '#94a3b8', cursor: 'pointer',
              }}
            >📷 Trasera (HD)</button>
            <button
              type="button"
              onClick={() => setFacingMode('user')}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: facingMode === 'user' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'user' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'user' ? '#38bdf8' : '#94a3b8', cursor: 'pointer',
              }}
            >🤳 Frontal</button>
          </div>

          <button type="button" className={styles.startBtn} onClick={() => startCamera(facingMode)}>
            <i className="ti ti-camera" />
            <span>Activar Cámara y Conectar</span>
          </button>

          {errorMsg && <div className={styles.errorCard}><i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />{errorMsg}</div>}
        </div>
      ) : (
        <div className={styles.cameraView}>
          <video ref={setVideoEl} className={styles.videoElement} autoPlay playsInline webkit-playsinline="true" muted onLoadedMetadata={(e) => e.target.play().catch(() => {})} />
          <div className={styles.topOverlay}>
            <div className={`${styles.tallyPill} ${status === 'connected' ? styles.tallyLive : styles.tallyConnecting}`}>
              <div className={status === 'connected' ? styles.dotLive : styles.dotConnecting} />
              <span>{status === 'connected' ? `AL AIRE • CAM ${slot}` : 'CONECTANDO...'}</span>
            </div>
            <div className={styles.slotInfoBadge}>{facingMode === 'environment' ? 'Trasera' : 'Frontal'}</div>
          </div>
          <div style={{ position: 'absolute', top: 52, left: 12, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8' }}>
            {qualityLabel} • AUTO-NET
          </div>

          <div className={styles.bottomOverlay}>
            <div className={styles.actionPill}>
              <button type="button" className={styles.flipBtn} onClick={handleFlipCamera}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
                  <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 800 }}>GIRAR</span>
              </button>
              {torchSupported && (
                <button type="button" className={`${styles.controlBtn} ${torchOn ? styles.controlBtnActive : ''}`} onClick={handleToggleTorch}>
                  <i className="ti ti-flare" />
                </button>
              )}
              <button type="button" className={`${styles.controlBtn} ${micMuted ? styles.controlBtnActive : ''}`} onClick={handleToggleMic} style={{ color: micMuted ? '#ef4444' : '#22c55e', border: micMuted ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(34,197,94,0.4)', background: micMuted ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)', padding: '6px 12px' }}>
                <i className={micMuted ? 'ti ti-microphone-off' : 'ti ti-microphone'} />
                <span style={{ fontSize: 10, fontWeight: 800 }}>{micMuted ? 'MUTE' : 'MIC'}</span>
              </button>
              <button type="button" className={`${styles.controlBtn} ${videoPaused ? styles.controlBtnActive : ''}`} onClick={handleTogglePause}>
                <i className={videoPaused ? 'ti ti-video-off' : 'ti ti-video'} />
              </button>

              {/* Botón Grabación Local de Respaldo */}
              <button
                type="button"
                className={`${styles.controlBtn} ${localBackupActive ? styles.controlBtnActive : ''}`}
                onClick={localBackupActive ? stopLocalBackup : startLocalBackup}
                style={{
                  color: localBackupActive ? '#ef4444' : '#38bdf8',
                  border: localBackupActive ? '1px solid #ef4444' : '1px solid rgba(56,189,248,0.4)',
                  background: localBackupActive ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.15)',
                  padding: '6px 10px',
                }}
                title={localBackupActive ? 'Detener copia local' : 'Grabar copia local de respaldo en este dispositivo'}
              >
                <i className={localBackupActive ? 'ti ti-player-record-filled' : 'ti ti-device-floppy'} />
                <span style={{ fontSize: 10, fontWeight: 800 }}>
                  {localBackupActive ? `${localBackupDuration}s` : 'BACKUP'}
                </span>
              </button>

              <button type="button" className={styles.disconnectBtn} onClick={stopAll}>
                <i className="ti ti-phone-off" />
              </button>
            </div>
          </div>

          {localBackupBlobUrl && !localBackupActive && (
            <div style={{
              position: 'absolute', bottom: 85, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(16, 185, 129, 0.95)', color: '#fff', borderRadius: 20,
              padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 40,
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)', fontSize: 11, fontWeight: 700,
            }}>
              <span>💾 Respaldo guardado</span>
              <button
                type="button"
                onClick={downloadLocalBackup}
                style={{
                  background: '#fff', color: '#059669', border: 'none', borderRadius: 12,
                  padding: '4px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer',
                }}
              >
                Descargar
              </button>
            </div>
          )}
        </div>

      )}
    </div>
  )
}