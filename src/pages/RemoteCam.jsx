import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCw, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Disc, Zap, Radio, Smartphone, Camera, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getConfiguredWebRtcConfig } from '../utils/rtcConfig.js'

const QUALITY_TIERS = [
  { label: 'Full HD 1080p · 6 Mbps', maxBitrate: 6000000, scaleResolutionDownBy: 1, frameRate: 30 },
  { label: 'HD 720p · 3.5 Mbps', maxBitrate: 3500000, scaleResolutionDownBy: 1, frameRate: 30 },
  { label: 'Fluido 720p · 2 Mbps', maxBitrate: 2000000, scaleResolutionDownBy: 1.25, frameRate: 30 },
]
const RTT_DEGRADE_MS = 600     
const RTT_HEALTHY_MS = 200     
const HEALTHY_CHECKS_TO_RISE = 3

function getCaptureResolutionLabel(settings = {}) {
  const width = Number(settings.width) || 0
  const height = Number(settings.height) || 0
  if (width >= 1920 && height >= 1080) return 'Full HD 1080p'
  if (width >= 1280 && height >= 720) return `HD ${Math.min(width, height)}p (límite del dispositivo)`
  return width && height ? `${width}×${height} (límite del dispositivo)` : 'Resolución de cámara'
}

function applyVideoSenderParams(sender, tier) {
  if (!sender) return
  try {
    const params = sender.getParameters() || {}
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    const e = params.encodings[0]
    
    e.maxBitrate = tier.maxBitrate
    e.maxFramerate = tier.frameRate
    e.scaleResolutionDownBy = tier.scaleResolutionDownBy
    // 'balanced' evita pixelación masiva por movimiento rápido y previene caída brusca de resolución
    params.degradationPreference = 'balanced'
    sender.setParameters(params).catch(() => {})
  } catch {}
}

function applyAudioSenderParams(sender) {
  if (!sender) return
  try {
    const params = sender.getParameters() || {}
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    params.encodings[0].maxBitrate = 64000
    sender.setParameters(params).catch(() => {})
  } catch {}
}

function getRemoteCameraSessionId() {
  const storageKey = 'podcaststudio_remote_camera_session_v1'
  try {
    const saved = window.sessionStorage.getItem(storageKey)
    if (saved) return saved
    const sessionId = `phone_${Math.random().toString(36).slice(2, 12)}`
    window.sessionStorage.setItem(storageKey, sessionId)
    return sessionId
  } catch {
    return `phone_${Math.random().toString(36).slice(2, 12)}`
  }
}

export default function RemoteCam() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const explicitSlot = searchParams.get('slot');
  const explicitRoom = searchParams.get('room');
  const isAuto = searchParams.get('auto') === 'true' || (!explicitSlot && !explicitRoom);

  const isFlippingRef = useRef(false);

  const [slot, setSlot] = useState(explicitSlot || '2');
  const [room, setRoom] = useState(explicitRoom || (explicitSlot ? `studio_cam_${explicitSlot}` : 'studio_cam_2'));
  const [guestName, setGuestName] = useState(searchParams.get('name') || '');
  const sessionRole = searchParams.get('role') || 'guest';
  const [isAssigning, setIsAssigning] = useState(isAuto);
  // Mantener el mismo ID al recargar la página permite reutilizar la ranura existente
  // y reemplazar el PeerConnection viejo en vez de abrir otra cámara duplicada.
  const deviceSessionIdRef = useRef(null);
  if (!deviceSessionIdRef.current) deviceSessionIdRef.current = getRemoteCameraSessionId();

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [speakerMuted, setSpeakerMuted] = useState(true)
  const [qualityLabel, setQualityLabel] = useState('Full HD 1080p · Conectando')

  const [localBackupActive, setLocalBackupActive] = useState(false)
  const [localBackupDuration, setLocalBackupDuration] = useState(0)
  const [localBackupBlobUrl, setLocalBackupBlobUrl] = useState(null)
  const localRecorderRef = useRef(null)
  const localChunksRef = useRef([])
  const localTimerRef = useRef(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const pcRef = useRef(null)
  const connectionIdRef = useRef('')
  const connectionStartedAtRef = useRef(0)
  const isSignalingInitializingRef = useRef(false)
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
  const tierIndexRef = useRef(1)
  const healthyChecksRef = useRef(0)
  const poorChecksRef = useRef(0)
  const captureResolutionRef = useRef('Full HD 1080p')
  const lastBytesRef = useRef({ bytes: 0, ts: 0 })

  const startAdaptationEngine = useCallback(() => {
    if (adaptTimerRef.current) clearInterval(adaptTimerRef.current)
    tierIndexRef.current = 0
    healthyChecksRef.current = 0
    poorChecksRef.current = 0
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
        const reports = Array.from(stats.values())
        const selectedPairId = reports.find(report => report.type === 'transport')?.selectedCandidatePairId
        const candidatePair = reports.find(report => report.type === 'candidate-pair' && report.id === selectedPairId)
          || reports.find(report => report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated)
        if (candidatePair?.currentRoundTripTime != null) rttMs = Math.round(candidatePair.currentRoundTripTime * 1000)
        reports.forEach((r) => {
          if (r.type === 'outbound-rtp' && r.kind === 'video' && !r.isRemote) {
            fps = r.framesPerSecond || 0
            limitation = r.qualityLimitationReason || ''
            bytes = r.bytesSent || 0
          }
        })

        const now = performance.now()
        const dtSec = (now - lastBytesRef.current.ts) / 1000
        lastBytesRef.current = { bytes, ts: now }

        const mustDegrade = rttMs > RTT_DEGRADE_MS || limitation === 'bandwidth' || limitation === 'cpu'
        if (mustDegrade) {
          poorChecksRef.current += 1
          healthyChecksRef.current = 0
        } else {
          poorChecksRef.current = 0
        }
        if (poorChecksRef.current >= 2 && tierIndexRef.current < QUALITY_TIERS.length - 1) {
          tierIndexRef.current += 1
          poorChecksRef.current = 0
          applyTier(tierIndexRef.current)
          return
        }

        const isHealthy = rttMs > 0 && rttMs < RTT_HEALTHY_MS && (fps === 0 || fps >= 25) && limitation === ''
        if (isHealthy) {
          healthyChecksRef.current += 1
          if (healthyChecksRef.current >= HEALTHY_CHECKS_TO_RISE && tierIndexRef.current > 0) {
            tierIndexRef.current -= 1
            healthyChecksRef.current = 0
            applyTier(tierIndexRef.current)
          }
        } else {
          healthyChecksRef.current = 0
        }
      } catch { }
    }, 2000)

    const applyTier = (idx) => {
      const tier = QUALITY_TIERS[idx]
      setQualityLabel(`${captureResolutionRef.current} · ${tier.label}`)
      if (videoSenderRef.current) {
        applyVideoSenderParams(videoSenderRef.current, tier)
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
    if (!isAuto) return;
    if (!supabase) {
      setIsAssigning(false);
      setErrorMsg('No se pudo conectar con el servicio del estudio. Comprueba tu conexión y vuelve a abrir el enlace.');
      return;
    }

    const dispatchChannel = supabase.channel('remotecam_auto_dispatch', {
      config: { broadcast: { self: false } },
    });
    let fallbackTimer;

    dispatchChannel.on('broadcast', { event: 'assign-slot' }, (ev) => {
      const payload = ev?.payload;
      if (payload && payload.targetDeviceId === deviceSessionIdRef.current) {
        clearTimeout(fallbackTimer);
        setSlot(String(payload.slot));
        setRoom(payload.room || `studio_cam_${payload.slot}`);
        setIsAssigning(false);
        setErrorMsg(null);
      }
    });

    dispatchChannel.on('broadcast', { event: 'slot-full' }, (ev) => {
      if (ev?.payload?.targetDeviceId === deviceSessionIdRef.current) {
        clearTimeout(fallbackTimer);
        setIsAssigning(false);
        setErrorMsg('No hay cámaras libres en el estudio. Pide que agreguen una ranura (hasta CAM 12) y vuelve a abrir el enlace.');
      }
    });

    dispatchChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        dispatchChannel.send({
          type: 'broadcast', event: 'request-slot',
          payload: { deviceId: deviceSessionIdRef.current, guestName: guestName.trim() || undefined },
        }).catch(() => {});
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(fallbackTimer);
        setIsAssigning(false);
        setErrorMsg('No se pudo conectar con el estudio. Comprueba tu conexión e inténtalo de nuevo.');
      }
    });

    fallbackTimer = setTimeout(() => {
      setIsAssigning(false);
      setErrorMsg((current) => current || 'No se recibió respuesta del estudio. Comprueba la conexión e inténtalo de nuevo.');
    }, 10000);

    return () => {
      clearTimeout(fallbackTimer);
      try { supabase.removeChannel(dispatchChannel); } catch {}
    };
  }, [isAuto, guestName]);

  useEffect(() => {
    if (!supabase) return;
    const presenceChannel = supabase.channel('remotecam_presence', {
      config: { broadcast: { self: false } },
    });

    const phoneId = deviceSessionIdRef.current;
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const deviceType = isIos ? 'iPhone' : isAndroid ? 'Android' : 'Celular Móvil';
    const deviceName = guestName.trim() ? `${guestName.trim()} (${deviceType})` : `${deviceType} (Cámara Wi-Fi)`;

    presenceChannel.on('broadcast', { event: 'ping-presence' }, () => {
      presenceChannel.send({
        type: 'broadcast', event: 'pong-presence',
        payload: { id: phoneId, deviceName, facing: facingMode, slot, roomCode: room, guestName: guestName.trim() || undefined, sessionRole, available: true },
      }).catch(() => {});
    });

    presenceChannel.subscribe();
    return () => { try { supabase.removeChannel(presenceChannel); } catch {} };
  }, [facingMode, room, slot, guestName, sessionRole]);

  const requestWakeLock = useCallback(async () => {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
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
      localTimerRef.current = setInterval(() => setLocalBackupDuration(d => d + 1), 1000)
    } catch (err) {}
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

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (pcRef.current) {
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }

    if (channelRef.current) {
      try {
        channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'phone-disconnect', slot, connectionId: connectionIdRef.current, connectionStartedAt: connectionStartedAtRef.current, sender: 'phone' } }).catch(() => {})
      } catch {}
      try { supabase.removeChannel(channelRef.current) } catch {}
      channelRef.current = null
    }

    if (handshakeTimerRef.current) clearInterval(handshakeTimerRef.current)
    if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current)
    
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
    setSpeakerMuted(true)
  }, [releaseWakeLock, stopAdaptationEngine, slot, stopLocalBackup])

  const initSignaling = useCallback(async (localStream) => {
    if (isSignalingInitializingRef.current) return
    isSignalingInitializingRef.current = true
    try {
    if (!supabase) {
      setErrorMsg('No se pudo inicializar la conexión.')
      setStatus('error')
      return
    }

    setStatus('connecting')
    stopAdaptationEngine()
    if (handshakeTimerRef.current) clearInterval(handshakeTimerRef.current)
    if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current)
    const rtcConfig = await getConfiguredWebRtcConfig()
    const connectionId = `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
    connectionIdRef.current = connectionId
    connectionStartedAtRef.current = Date.now()

    // Una reconexión reutiliza la misma cámara y ranura, pero nunca conserva
    // el PeerConnection anterior enviando cuadros en paralelo.
    const previousPc = pcRef.current
    pcRef.current = null
    if (previousPc && previousPc.signalingState !== 'closed') {
      try { previousPc.close() } catch {}
    }
    const previousChannel = channelRef.current
    channelRef.current = null
    if (previousChannel) {
      try {
        await Promise.race([
          previousChannel.send({ type: 'broadcast', event: 'signal', payload: { type: 'phone-disconnect', slot, connectionId: connectionIdRef.current, connectionStartedAt: connectionStartedAtRef.current, sender: 'phone' } }),
          new Promise(resolve => setTimeout(resolve, 500)),
        ])
      } catch {}
      try { await supabase.removeChannel(previousChannel) } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig)
    pcRef.current = pc
    iceQueueRef.current = []
    reconnectAttemptsRef.current = 0

    localStream.getTracks().forEach((track) => {
      try {
        if (track.kind === 'video') track.contentHint = 'detail'
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

    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current) } catch {}
      channelRef.current = null
    }
    
    const channel = supabase.channel(channelName, { config: { broadcast: { self: false } } })
    channelRef.current = channel

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast', event: 'signal', payload: { type: 'candidate', candidate: event.candidate.toJSON(), connectionId, connectionStartedAt: connectionStartedAtRef.current, sender: 'phone' },
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
      } else if (ice === 'disconnected' || ice === 'failed') {
        if (iceRecoveryTimerRef.current) clearTimeout(iceRecoveryTimerRef.current)
        iceRecoveryTimerRef.current = setTimeout(async () => {
          if (pcRef.current === pc && !['connected', 'completed'].includes(pc.iceConnectionState)) {
            offerSentRef.current = false
            await sendOffer(true)
          }
        }, 3000)
      }
    }

    const sendOffer = async (isRestart = false) => {
      if (isOfferingRef.current || offerSentRef.current) return
      isOfferingRef.current = true
      try {
        if (!pc || pc.signalingState === 'closed') return
        
        try {
          if (pc.signalingState !== 'stable') {
             await pc.setLocalDescription({ type: 'rollback' });
          }
        } catch(e) {}
        
        try {
          const transceivers = pc.getTransceivers();
          const vTransceiver = transceivers.find(t => t.sender && t.sender.track && t.sender.track.kind === 'video');
          if (vTransceiver && 'setCodecPreferences' in vTransceiver && window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
            const caps = RTCRtpReceiver.getCapabilities('video');
            if (caps && caps.codecs) {
              const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
              const vp8 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8');
              const others = caps.codecs.filter(c => !h264.includes(c) && !vp8.includes(c));
              // H.264 primero: ambos dispositivos (S22 Ultra Snapdragon y iPhone 14 Pro Max) cuentan con codificadores de hardware H.264 nativos dedicados
              const preferred = [...h264, ...vp8, ...others];
              try { vTransceiver.setCodecPreferences(preferred); } catch (e) {}
            }
          }
        } catch (e) {}

        const offer = await pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false, ...(isRestart ? { iceRestart: true } : {}) })
        await pc.setLocalDescription(offer)

        await channel.send({
          type: 'broadcast', event: 'signal',
          payload: { type: 'offer', sdp: { type: offer.type, sdp: offer.sdp }, connectionId, connectionStartedAt: connectionStartedAtRef.current, sender: 'phone', slot, guestName: guestName.trim() || undefined, sessionRole },
        })
        offerSentRef.current = true
      } catch (err) {
      } finally {
        isOfferingRef.current = false
      }
    }

    channel.on('broadcast', { event: 'signal' }, async (event) => {
      const payload = event?.payload
      if (!payload || payload.sender === 'phone') return
      if (payload.connectionId && payload.connectionId !== connectionId) return

      if (payload.type === 'studio-ready') {
        if (!offerSentRef.current && pc.signalingState === 'stable') await sendOffer()
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
          } else if (pc.signalingState === 'have-remote-offer') {
            try { await pc.setLocalDescription({ type: 'rollback' }); } catch(e){}
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
          setStatus(pc.iceConnectionState === 'connected' ? 'connected' : 'negotiating')
          reconnectAttemptsRef.current = 0
          
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
          channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { type: 'phone-ready', slot, connectionId, connectionStartedAt: connectionStartedAtRef.current, sender: 'phone' } }).catch(() => {})
        setTimeout(() => { if (!offerSentRef.current && pc.signalingState === 'stable') sendOffer() }, 300)
      }
    })

    startAdaptationEngine()
    } finally {
      isSignalingInitializingRef.current = false
    }
  }, [room, slot, guestName, sessionRole, startAdaptationEngine])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active && streamRef.current) {
        if (!pcRef.current || pcRef.current.iceConnectionState === 'disconnected' || pcRef.current.iceConnectionState === 'failed') {
          initSignaling(streamRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [active, initSignaling]);

  const startCamera = async (targetFacing = 'environment') => {
    setErrorMsg(null)
    offerSentRef.current = false
    isOfferingRef.current = false
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador no compatible. Abre el enlace en Safari o Chrome usando HTTPS.');
      }

      // Forzar captura nítida 1080p (Full HD) nativa del sensor
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 24, max: 30 },
          },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        })
      } catch (e1) {
        console.warn('getUserMedia 1080p estricto falló; intentando fallback general:', e1)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
        } catch (e2) {
          console.warn('Fallback 1080p falló; usando resolución máxima disponible:', e2)
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: targetFacing } }, audio: true })
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          }
        }
      }

      if (stream) stream.getVideoTracks().forEach(t => { try { t.contentHint = 'detail' } catch {} })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.srcObject = stream;
        try { videoRef.current.play().catch(e => console.warn('Auto-play error:', e)); } catch (e) {}
      }

      const track = stream.getVideoTracks()[0]
      if (track) {
        const settings = track.getSettings?.() || {}
        captureResolutionRef.current = getCaptureResolutionLabel(settings)
        setQualityLabel(`${captureResolutionRef.current} · ${Math.round(settings.frameRate || 30)} fps`)
        try {
          const caps = track.getCapabilities ? track.getCapabilities() : {}
          setTorchSupported(Boolean(caps.torch))
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {}
      }

      setActive(true)
      await requestWakeLock()
      await initSignaling(stream)
    } catch (err) {
      setErrorMsg('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
      setStatus('error')
    }
  }

  const handleFlipCamera = async () => {
    if (isFlippingRef.current) return
    isFlippingRef.current = true
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
    setTorchOn(false)

    try {
      const oldTrack = streamRef.current?.getVideoTracks?.()?.[0]
      if (oldTrack) { try { oldTrack.stop() } catch {} }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: nextFacing }, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false,
      })

      const newTrack = newStream.getVideoTracks()[0]
      if (newTrack) { try { newTrack.contentHint = 'detail' } catch {} }

      const sender = videoSenderRef.current || pcRef.current?.getSenders?.()?.find(s => s.track?.kind === 'video' || s.kind === 'video')
      if (sender && newTrack) await sender.replaceTrack(newTrack)

      const existingAudio = streamRef.current?.getAudioTracks?.()?.[0]
      if (existingAudio) newStream.addTrack(existingAudio)

      streamRef.current = newStream
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        videoRef.current.play().catch(() => {})
      }
      
      const caps = newTrack?.getCapabilities ? newTrack.getCapabilities() : {}
      setTorchSupported(Boolean(caps.torch))
    } catch (err) {
      console.warn('Error al cambiar de cámara:', err)
    } finally {
      setTimeout(() => { isFlippingRef.current = false }, 350)
    }
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
    let nextMutedState = !micMuted;
    
    if (track) {
      track.enabled = !track.enabled
      nextMutedState = !track.enabled;
    }
    
    setMicMuted(nextMutedState);

    if (pcRef.current) {
      const audioTransceiver = pcRef.current.getTransceivers().find(t => t.sender && t.sender.track && t.sender.track.kind === 'audio');
      if (audioTransceiver) {
        audioTransceiver.direction = nextMutedState ? 'inactive' : 'sendonly';
      }
    }
  }

  const handleToggleSpeaker = () => {
    setSpeakerMuted(prev => {
      const next = !prev
      if (videoRef.current) {
        videoRef.current.muted = next
        if (!next && videoRef.current.paused) videoRef.current.play().catch(() => {})
      }
      return next
    })
  }

  const stopAllRef = useRef(stopAll)
  stopAllRef.current = stopAll
  useEffect(() => { return () => stopAllRef.current?.() }, [])

  return (
    // FIX DE COLAPSO CSS: position fixed puro, ignora medidas dudosas del navegador.
    <div style={{ backgroundColor: '#000', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* VIDEO SIEMPRE EN EL DOM: Resuelve bloqueo de seguridad de iOS Safari */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted
        style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          objectFit: 'cover', zIndex: 1, backgroundColor: '#050505',
          opacity: active ? 1 : 0,
          pointerEvents: 'none'
        }}
      />

      {/* PANTALLA DE INICIO (Menú de Conexión) */}
      {!active && (
        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 20, marginBottom: 20 }}>
            <Radio size={16} color="#fb923c" />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>PODCASTUDIO REMOTO</span>
          </div>
          
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Smartphone size={40} color="#38bdf8" />
          </div>
          
          {isAssigning ? (
            <div style={{ padding: '6px 14px', borderRadius: 20, background: 'rgba(234, 88, 12, 0.25)', border: '1px solid #ea580c', color: '#ffedd5', fontSize: 11, fontWeight: 700, margin: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} className="animate-pulse" color="#fb923c" />
              <span>Asignando cámara libre en Master...</span>
            </div>
          ) : (
            <span style={{ padding: '6px 16px', background: '#ea580c', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {sessionRole === 'student' ? 'AULA VIRTUAL' : sessionRole === 'cohost' ? 'CO-PRESENTADOR' : 'INVITADO EN VIVO'} • CAM {slot}
            </span>
          )}

          <div style={{ display: 'flex', gap: 6, margin: '12px 0 20px', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Cambiar canal:</span>
            {Array.from({ length: 11 }, (_, index) => String(index + 2)).map((s) => (
              <button
                key={s} type="button" onClick={() => { setSlot(s); setRoom(`studio_cam_${s}`); }}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                  border: String(slot) === s ? '1px solid #ea580c' : '1px solid rgba(255,255,255,0.12)',
                  background: String(slot) === s ? '#ea580c' : 'rgba(255,255,255,0.06)',
                  color: String(slot) === s ? '#fff' : '#94a3b8', transition: 'all 0.15s ease'
                }}
              >CAM {s}</button>
            ))}
          </div>

          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 10 }}>{guestName ? `¡Hola, ${guestName}!` : 'Cámara Inalámbrica'}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', maxWidth: 300, marginBottom: 24, lineHeight: 1.5 }}>Conecta la cámara de tu smartphone en tiempo real al estudio principal.</p>

          <div style={{ display: 'flex', gap: 10, margin: '8px 0 24px', justifyContent: 'center' }}>
            <button
              type="button" onClick={() => setFacingMode('environment')}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: facingMode === 'environment' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'environment' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'environment' ? '#38bdf8' : '#94a3b8'
              }}
            >📷 Trasera</button>
            <button
              type="button" onClick={() => setFacingMode('user')}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: facingMode === 'user' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'user' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'user' ? '#38bdf8' : '#94a3b8'
              }}
            >🤳 Frontal</button>
          </div>

          <button type="button" disabled={isAuto && (isAssigning || Boolean(errorMsg))} onClick={() => startCamera(facingMode)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 12, padding: '16px 24px', fontSize: 16, fontWeight: 800, cursor: isAuto && (isAssigning || Boolean(errorMsg)) ? 'not-allowed' : 'pointer', opacity: isAuto && (isAssigning || Boolean(errorMsg)) ? 0.55 : 1, boxShadow: '0 4px 14px rgba(56,189,248,0.4)' }}>
            <Camera size={20} />
            <span>Activar Cámara</span>
          </button>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, marginTop: 24, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#fca5a5', fontSize: 13, maxWidth: 300 }}>
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* OVERLAYS CUANDO LA CÁMARA ESTÁ ACTIVA */}
      {active && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 16px 40px', pointerEvents: 'none' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(0,0,0,0.65)', border: status === 'connected' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'connected' ? '#ef4444' : '#facc15', boxShadow: status === 'connected' ? '0 0 8px #ef4444' : 'none', animation: status === 'connected' ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{status === 'connected' ? `AL AIRE • CAM ${slot}` : status === 'negotiating' ? 'ENLAZANDO...' : 'CONECTANDO...'}</span>
            </div>
            <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', backdropFilter: 'blur(4px)' }}>
              {qualityLabel} • AUTO-NET
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', pointerEvents: 'auto', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(15, 23, 42, 0.85)', padding: '10px 14px', borderRadius: 30, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <button type="button" onClick={handleFlipCamera} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <RotateCw size={20} />
              </button>

              <button type="button" onClick={handleToggleSpeaker} style={{ width: 44, height: 44, borderRadius: '50%', border: speakerMuted ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid rgba(34,197,94,0.7)', background: speakerMuted ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)', color: speakerMuted ? '#f87171' : '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {speakerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <button type="button" onClick={handleToggleMic} style={{ width: 44, height: 44, borderRadius: '50%', border: micMuted ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid rgba(34,197,94,0.6)', background: micMuted ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.18)', color: micMuted ? '#ef4444' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button type="button" onClick={handleTogglePause} style={{ width: 44, height: 44, borderRadius: '50%', border: videoPaused ? '1.5px solid rgba(239,68,68,0.7)' : '1px solid rgba(255,255,255,0.15)', background: videoPaused ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)', color: videoPaused ? '#ef4444' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                {videoPaused ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              {torchSupported && (
                <button type="button" onClick={handleToggleTorch} style={{ width: 44, height: 44, borderRadius: '50%', border: torchOn ? '1.5px solid rgba(250,204,21,0.7)' : '1px solid rgba(255,255,255,0.15)', background: torchOn ? 'rgba(250,204,21,0.22)' : 'rgba(255,255,255,0.08)', color: torchOn ? '#facc15' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Zap size={20} />
                </button>
              )}

              <button type="button" onClick={localBackupActive ? stopLocalBackup : startLocalBackup} style={{ width: 44, height: 44, borderRadius: '50%', border: localBackupActive ? '1.5px solid #ef4444' : '1.5px solid rgba(56,189,248,0.4)', background: localBackupActive ? 'rgba(239,68,68,0.25)' : 'rgba(56,189,248,0.15)', color: localBackupActive ? '#ef4444' : '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Disc size={20} className={localBackupActive ? 'animate-spin' : ''} />
              </button>

              <button type="button" onClick={stopAll} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 4 }}>
                <PhoneOff size={20} />
              </button>
            </div>
          </div>

          {localBackupBlobUrl && !localBackupActive && (
            <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16, 185, 129, 0.95)', color: '#fff', borderRadius: 20, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 110, pointerEvents: 'auto' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>💾 Guardado</span>
              <button type="button" onClick={downloadLocalBackup} style={{ background: '#fff', color: '#059669', border: 'none', borderRadius: 12, padding: '6px 12px', fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Descargar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
