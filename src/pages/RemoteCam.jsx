import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCw, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, PhoneOff, Disc, Zap, Radio, Smartphone, Camera, AlertTriangle, Lock, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getWebRtcConfig } from '../utils/rtcConfig.js'
import styles from './RemoteCam.module.css'

const RTC_CONFIG = getWebRtcConfig()


// TIERS BROADCAST HD ULTRA-BAJA LATENCIA (30 FPS FIJOS)
// Evita bufferbloat, retrasos en movimiento y desincronización labial
const QUALITY_TIERS = [
  { label: 'HD 720p Fluido', maxBitrate: 2500000, width: 1280, height: 720, frameRate: 30 },
  { label: 'HD 720p Balanceado', maxBitrate: 2000000, width: 1280, height: 720, frameRate: 30 },
  { label: 'SD+ 540p Rápido', maxBitrate: 1400000, width: 960, height: 540, frameRate: 30 },
]
const RTT_DEGRADE_MS = 250     
const RTT_HEALTHY_MS = 100     
const HEALTHY_CHECKS_TO_RISE = 3

function applyVideoSenderParams(sender, tier) {
  if (!sender) return
  try {
    const params = sender.getParameters() || {}
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    const e = params.encodings[0]
    
    e.maxBitrate = tier.maxBitrate
    e.maxFramerate = 30
    e.priority = 'high'
    e.networkPriority = 'high'
    
    // CLAVE BROADCAST: maintain-framerate prioriza fluidez de 30 FPS en movimiento de cámara,
    // eliminando acumulación de buffer, barrido de imagen y retraso de 2 segundos.
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
  const explicitSlot = searchParams.get('slot');
  const explicitRoom = searchParams.get('room');
  const pinFromUrl = searchParams.get('pin') || '';
  const isAuto = searchParams.get('auto') === 'true' || (!explicitSlot && !explicitRoom);

  // SEGURIDAD: PIN de Estudio para restringir accesos no autorizados desde la web pública
  const [studioPin, setStudioPin] = useState(() => {
    if (pinFromUrl && /^\d{4,8}$/.test(pinFromUrl.trim())) return pinFromUrl.trim();
    try {
      const stored = sessionStorage.getItem('podcastudio_mobile_pin');
      if (stored && /^\d{4,8}$/.test(stored)) return stored;
    } catch {}
    return '';
  });
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const isFlippingRef = useRef(false);

  const handleValidatePin = (e) => {
    if (e) e.preventDefault();
    const clean = enteredPin.trim();
    if (!/^\d{4,8}$/.test(clean)) {
      setPinError('Ingresa un PIN numérico válido de 6 dígitos.');
      return;
    }
    setPinError('');
    try {
      sessionStorage.setItem('podcastudio_mobile_pin', clean);
    } catch {}
    setStudioPin(clean);
  };

  const [slot, setSlot] = useState(explicitSlot || '2');
  const [room, setRoom] = useState(explicitRoom || (explicitSlot ? `studio_cam_${explicitSlot}` : 'studio_cam_2'));
  const [guestName, setGuestName] = useState(searchParams.get('name') || '');
  const sessionRole = searchParams.get('role') || 'guest';
  const [isAssigning, setIsAssigning] = useState(isAuto);
  const deviceSessionIdRef = useRef('phone_' + Math.random().toString(36).substring(2, 9));

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  // Bocina / Altavoz del celular: MUTEADA POR DEFAULT para evitar que vicie/acople con su propio micrófono
  const [speakerMuted, setSpeakerMuted] = useState(true)
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

  // NEGOCIACIÓN AUTOMÁTICA DEL SIGUIENTE SLOT LIBRE EN EL ESTUDIO
  useEffect(() => {
    if (!supabase || !isAuto || !studioPin) return;

    const dispatchChannelName = `remotecam_auto_dispatch_${studioPin}`;
    const dispatchChannel = supabase.channel(dispatchChannelName, {
      config: { broadcast: { self: false } },
    });

    dispatchChannel.on('broadcast', { event: 'assign-slot' }, (ev) => {
      const payload = ev?.payload;
      if (payload && payload.targetDeviceId === deviceSessionIdRef.current) {
        console.log('[RemoteCam] Slot auto-asignado por Master:', payload.slot, payload.room);
        setSlot(String(payload.slot));
        setRoom(payload.room || `studio_${studioPin}_cam_${payload.slot}`);
        setIsAssigning(false);
      }
    });

    dispatchChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        dispatchChannel.send({
          type: 'broadcast',
          event: 'request-slot',
          payload: {
            deviceId: deviceSessionIdRef.current,
            guestName: guestName.trim() || undefined,
            pin: studioPin,
          },
        }).catch(() => {});
      }
    });

    // Fallback: Si el estudio no responde en 2.5s, continuar con el slot por defecto
    const fallbackTimer = setTimeout(() => {
      setIsAssigning(false);
    }, 2500);

    return () => {
      clearTimeout(fallbackTimer);
      try { supabase.removeChannel(dispatchChannel); } catch {}
    };
  }, [isAuto, guestName, studioPin]);

  useEffect(() => {
    if (!supabase || !studioPin) return;
    const presenceChannelName = `remotecam_presence_${studioPin}`;
    const presenceChannel = supabase.channel(presenceChannelName, {
      config: { broadcast: { self: false } },
    });

    const phoneId = 'phone_' + Math.random().toString(36).substring(2, 8);
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const deviceType = isIos ? 'iPhone' : isAndroid ? 'Android' : 'Celular Móvil';
    const deviceName = guestName.trim()
      ? `${guestName.trim()} (${deviceType})`
      : `${deviceType} (Cámara Wi-Fi)`;

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
          pin: studioPin,
        },
      }).catch(() => {});
    });

    presenceChannel.subscribe();
    return () => {
      try { supabase.removeChannel(presenceChannel); } catch {}
    };
  }, [facingMode, room, slot, guestName, sessionRole, studioPin]);

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
      } catch {}
      try {
        supabase.removeChannel(channelRef.current)
      } catch {}
      channelRef.current = null
    }

    if (supabase && studioPin) {
      try {
        const autoChan = supabase.channel(`remotecam_auto_dispatch_${studioPin}`)
        autoChan.send({
          type: 'broadcast',
          event: 'release-slot',
          payload: { deviceId: deviceSessionIdRef.current, slot, pin: studioPin },
        }).catch(() => {})
      } catch {}
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
    setSpeakerMuted(true)
    setQualityLabel('HD 720p')
  }, [releaseWakeLock, stopAdaptationEngine, slot, studioPin])

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

    const baseRoom = studioPin && !room.includes(studioPin) ? `${studioPin}_${room}` : room
    const channelName = `remotecam_${baseRoom}`

    if (channelRef.current) {
      try { supabase.removeChannel(channelRef.current) } catch {}
      channelRef.current = null
    }
    try {
      const existingChans = supabase.getChannels ? supabase.getChannels() : []
      existingChans.forEach(ch => {
        if (ch.topic === `realtime:${channelName}`) {
          try { supabase.removeChannel(ch) } catch {}
        }
      })
    } catch {}

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
        try {
          const transceivers = pc.getTransceivers();
          const vTransceiver = transceivers.find(t => t.sender && t.sender.track && t.sender.track.kind === 'video');
          if (vTransceiver && 'setCodecPreferences' in vTransceiver && window.RTCRtpReceiver && RTCRtpReceiver.getCapabilities) {
            const caps = RTCRtpReceiver.getCapabilities('video');
            if (caps && caps.codecs) {
              const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
              const others = caps.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
              vTransceiver.setCodecPreferences([...h264, ...others]);
            }
          }
        } catch (e) {}

        const offer = await pc.createOffer({
          offerToReceiveVideo: false,
          offerToReceiveAudio: false,
          ...(isRestart ? { iceRestart: true } : {}),
        })

        function prioritizeH264(sdp) {
          const lines = sdp.split('\r\n');
          let mIdx = -1;
          const h264Pts = [];
          lines.forEach((l, i) => {
            if (l.startsWith('m=video')) mIdx = i;
            if (l.startsWith('a=rtpmap:') && l.toLowerCase().includes('h264')) {
              const pt = l.split(':')[1].split(' ')[0];
              if (!h264Pts.includes(pt)) h264Pts.push(pt);
            }
          });
          if (mIdx !== -1 && h264Pts.length > 0) {
            const parts = lines[mIdx].split(' ');
            const header = parts.slice(0, 3);
            const payloads = parts.slice(3);
            const rest = payloads.filter(p => !h264Pts.includes(p));
            lines[mIdx] = [...header, ...h264Pts, ...rest].join(' ');
          }
          return lines.join('\r\n');
        }

        offer.sdp = prioritizeH264(offer.sdp);
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
          if (pc.iceConnectionState === 'connected' || pc.connectionState === 'connected') {
            setStatus('connected');
          } else {
            setStatus('negotiating');
          }
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
  }, [room, slot, guestName, sessionRole, studioPin, startAdaptationEngine])

  const startCamera = async (targetFacing = 'environment') => {
    setErrorMsg(null)
    offerSentRef.current = false
    isOfferingRef.current = false
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('El navegador no permite acceso a cámara por seguridad. En Android debes abrir el enlace con HTTPS (https://www.podcastudio.mx/remote-cam).');
      }

      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }

      let stream = null
      try {
        // Formato adaptable para Android e iOS en vertical u horizontal
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: audioConstraints,
        })
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true,
          })
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
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
    if (isFlippingRef.current) return
    isFlippingRef.current = true
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
    setTorchOn(false)

    try {
      // 1. CLAVE ANDROID: Liberar el sensor actual ANTES de pedir el nuevo en el HAL
      const oldTrack = streamRef.current?.getVideoTracks?.()?.[0]
      if (oldTrack) {
        try { oldTrack.stop() } catch {}
      }

      let newStream = null
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: false,
        })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
          audio: false,
        })
      }

      const newTrack = newStream.getVideoTracks()[0]
      if (newTrack) {
        try { newTrack.contentHint = 'motion' } catch {}
      }

      const sender = videoSenderRef.current || pcRef.current?.getSenders?.()?.find(s => s.track?.kind === 'video' || s.kind === 'video')
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack)
      }

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
      setTimeout(() => {
        isFlippingRef.current = false
      }, 350)
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
    if (track) {
      track.enabled = !track.enabled
      setMicMuted(!track.enabled)
    } else {
      setMicMuted(prev => !prev)
    }
  }

  const handleToggleSpeaker = () => {
    setSpeakerMuted(prev => {
      const next = !prev
      if (videoRef.current) {
        videoRef.current.muted = next
        if (!next && videoRef.current.paused) {
          videoRef.current.play().catch(() => {})
        }
      }
      return next
    })
  }

  const setVideoEl = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.setAttribute('playsinline', 'true')
      node.setAttribute('webkit-playsinline', 'true')
      node.muted = speakerMuted
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
      }
      node.play().catch(() => {})
    }
  }, [speakerMuted])

  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      const v = videoRef.current
      v.setAttribute('playsinline', 'true')
      v.setAttribute('webkit-playsinline', 'true')
      v.muted = speakerMuted
      if (v.srcObject !== streamRef.current) v.srcObject = streamRef.current
      v.play().catch(() => {})
    }
  }, [active, speakerMuted])

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

  if (!studioPin) {
    return (
      <div className={styles.container}>
        <div className={styles.lockScreen}>
          <div className={styles.lockCard}>
            <div className={styles.lockIconWrap}>
              <Lock size={36} />
            </div>
            <div className={styles.logoBadge} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)', marginBottom: 12 }}>
              <Shield size={14} className="text-red-400" />
              <span style={{ color: '#fca5a5' }}>ACCESO RESTRINGIDO</span>
            </div>
            <h2 className={styles.title} style={{ fontSize: 20, marginBottom: 8, textAlign: 'center' }}>
              PodcastStudio Remoto
            </h2>
            <p className={styles.desc} style={{ fontSize: 13, marginBottom: 18, textAlign: 'center' }}>
              Esta pantalla es exclusiva para conectar teléfonos al estudio. Escanea el código QR desde PodcastStudio o ingresa el <strong>PIN de 6 dígitos</strong> del estudio.
            </p>

            <form onSubmit={handleValidatePin} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={enteredPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setEnteredPin(val);
                  if (pinError) setPinError('');
                }}
                className={styles.pinInput}
              />
              {pinError && (
                <div style={{ color: '#f87171', fontSize: 11, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={13} /> {pinError}
                </div>
              )}
              <button
                type="submit"
                className={styles.unlockBtn}
                disabled={enteredPin.length < 4}
                style={{
                  opacity: enteredPin.length < 4 ? 0.5 : 1,
                  cursor: enteredPin.length < 4 ? 'not-allowed' : 'pointer'
                }}
              >
                Desbloquear y Acceder
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!active ? (
        <div className={styles.startScreen}>
          <div className={styles.logoBadge}>
            <Radio size={16} className="text-orange-400" />
            <span>PODCASTUDIO REMOTO</span>
          </div>
          <div className={styles.iconHero}>
            <Smartphone size={54} className="text-sky-400" />
          </div>
          {isAssigning ? (
            <div style={{ padding: '6px 14px', borderRadius: 9999, background: 'rgba(234, 88, 12, 0.25)', border: '1px solid #ea580c', color: '#ffedd5', fontSize: 11, fontWeight: 700, margin: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} className="animate-pulse text-orange-400" />
              <span>Asignando cámara libre en Master...</span>
            </div>
          ) : (
            <span className={styles.slotBadgeLarge}>
              {sessionRole === 'student' ? 'AULA VIRTUAL' : sessionRole === 'cohost' ? 'CO-PRESENTADOR' : 'INVITADO EN VIVO'} • CANAL CAM {slot}
            </span>
          )}

          {/* SELECTOR DE CANAL MANUAL EN CASO DE PREFERENCIA */}
          <div style={{ display: 'flex', gap: 6, margin: '4px 0 14px', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Canal:</span>
            {['2', '3', '4'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSlot(s);
                  setRoom(studioPin ? `studio_${studioPin}_cam_${s}` : `studio_cam_${s}`);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: String(slot) === s ? '1px solid #ea580c' : '1px solid rgba(255,255,255,0.12)',
                  background: String(slot) === s ? '#ea580c' : 'rgba(255,255,255,0.06)',
                  color: String(slot) === s ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                CAM {s}
              </button>
            ))}
          </div>

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
            <Camera size={20} />
            <span>Activar Cámara y Conectar</span>
          </button>

          {errorMsg && (
            <div className={styles.errorCard}>
              <AlertTriangle size={16} style={{ marginRight: 6, flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.cameraView}>
          <video 
            ref={setVideoEl} 
            className={styles.videoElement} 
            autoPlay 
            playsInline 
            webkit-playsinline="true" 
            muted={speakerMuted} 
            onLoadedMetadata={(e) => e.target.play().catch(() => {})} 
          />
          <div className={styles.topOverlay}>
            <div className={`${styles.tallyPill} ${status === 'connected' ? styles.tallyLive : styles.tallyConnecting}`}>
              <div className={status === 'connected' ? styles.dotLive : styles.dotConnecting} />
              <span>
                {status === 'connected' 
                  ? `AL AIRE • CAM ${slot}` 
                  : status === 'negotiating' 
                    ? 'ENLAZANDO CON ESTUDIO...' 
                    : 'CONECTANDO SEÑAL...'}
              </span>
            </div>
            <div className={styles.slotInfoBadge}>{facingMode === 'environment' ? 'Trasera' : 'Frontal'}</div>
          </div>
          <div style={{ position: 'absolute', top: 52, left: 12, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8' }}>
            {qualityLabel} • AUTO-NET
          </div>

          <div className={styles.bottomOverlay}>
            <div className={styles.actionPill}>
              {/* 1. GIRAR CÁMARA (SOLO ÍCONO) */}
              <button 
                type="button" 
                className={styles.flipBtn} 
                onClick={handleFlipCamera}
                title="Girar cámara (Frontal / Trasera)"
              >
                <RotateCw size={20} strokeWidth={2.4} />
              </button>

              {/* 2. BOCINA / ALTAVOZ (SOLO ÍCONO - MUTEADA POR DEFAULT) */}
              <button
                type="button"
                className={styles.controlBtn}
                onClick={handleToggleSpeaker}
                style={{
                  color: speakerMuted ? '#f87171' : '#4ade80',
                  border: speakerMuted ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid rgba(34,197,94,0.7)',
                  background: speakerMuted ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.22)',
                  boxShadow: speakerMuted ? 'none' : '0 0 10px rgba(34,197,94,0.4)',
                }}
                title={speakerMuted ? 'Bocina silenciada (Toca para activar)' : 'Bocina activa (Toca para silenciar)'}
              >
                {speakerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {/* 3. MICRÓFONO (SOLO ÍCONO) */}
              <button 
                type="button" 
                className={styles.controlBtn} 
                onClick={handleToggleMic} 
                style={{ 
                  color: micMuted ? '#ef4444' : '#22c55e', 
                  border: micMuted ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid rgba(34,197,94,0.6)', 
                  background: micMuted ? 'rgba(239,68,68,0.22)' : 'rgba(34,197,94,0.18)',
                  boxShadow: micMuted ? 'none' : '0 0 10px rgba(34,197,94,0.3)',
                }}
                title={micMuted ? 'Micrófono silenciado' : 'Micrófono activo'}
              >
                {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* 4. PAUSAR VIDEO (SOLO ÍCONO) */}
              <button 
                type="button" 
                className={`${styles.controlBtn} ${videoPaused ? styles.controlBtnActive : ''}`} 
                onClick={handleTogglePause}
                style={{
                  color: videoPaused ? '#ef4444' : '#ffffff',
                  border: videoPaused ? '1.5px solid rgba(239,68,68,0.7)' : '1.5px solid rgba(255,255,255,0.15)',
                  background: videoPaused ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)',
                }}
                title={videoPaused ? 'Reanudar video' : 'Pausar video'}
              >
                {videoPaused ? <VideoOff size={20} /> : <Video size={20} />}
              </button>

              {/* 5. LINTERNA (SOLO ÍCONO SI ESTÁ SOPORTADA) */}
              {torchSupported && (
                <button 
                  type="button" 
                  className={styles.controlBtn} 
                  onClick={handleToggleTorch}
                  style={{
                    color: torchOn ? '#facc15' : '#ffffff',
                    border: torchOn ? '1.5px solid rgba(250,204,21,0.7)' : '1.5px solid rgba(255,255,255,0.15)',
                    background: torchOn ? 'rgba(250,204,21,0.22)' : 'rgba(255,255,255,0.08)',
                    boxShadow: torchOn ? '0 0 10px rgba(250,204,21,0.4)' : 'none',
                  }}
                  title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                >
                  <Zap size={20} />
                </button>
              )}

              {/* 6. GRABACIÓN LOCAL DE RESPALDO (SOLO ÍCONO) */}
              <button
                type="button"
                className={styles.controlBtn}
                onClick={localBackupActive ? stopLocalBackup : startLocalBackup}
                style={{
                  color: localBackupActive ? '#ef4444' : '#38bdf8',
                  border: localBackupActive ? '1.5px solid #ef4444' : '1.5px solid rgba(56,189,248,0.4)',
                  background: localBackupActive ? 'rgba(239,68,68,0.25)' : 'rgba(56,189,248,0.15)',
                  boxShadow: localBackupActive ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
                }}
                title={localBackupActive ? `Detener respaldo local (${localBackupDuration}s)` : 'Grabar respaldo local en dispositivo'}
              >
                <Disc size={20} className={localBackupActive ? 'animate-spin' : ''} />
              </button>

              {/* 7. SALIR / DESCONECTAR (SOLO ÍCONO ROJO) */}
              <button 
                type="button" 
                className={styles.disconnectBtn} 
                onClick={stopAll}
                title="Desconectar y salir"
              >
                <PhoneOff size={20} strokeWidth={2.4} />
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