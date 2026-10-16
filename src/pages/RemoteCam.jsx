import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import styles from './RemoteCam.module.css'

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
}

export default function RemoteCam() {
  const [searchParams] = useSearchParams()
  const slot = searchParams.get('slot') || '1'
  const room = searchParams.get('room') || `pcd_cam_${slot}`

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle') // idle | connecting | connected | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [facingMode, setFacingMode] = useState('environment') // environment (trasera) | user (frontal)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [videoPaused, setVideoPaused] = useState(false)
  const [micMuted, setMicMuted] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const pcRef = useRef(null)
  const channelRef = useRef(null)
  const iceQueueRef = useRef([])
  const wakeLockRef = useRef(null)
  const videoSenderRef = useRef(null)
  const audioSenderRef = useRef(null)

  // Responder a pings de descubrimiento para que el estudio detecte este celular automáticamente
  useEffect(() => {
    if (!supabase) return
    const presenceChannel = supabase.channel('remotecam_presence', {
      config: { broadcast: { self: false } },
    })

    const phoneId = 'phone_' + Math.random().toString(36).substring(2, 8)
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)
    const deviceName = isIos ? 'iPhone' : isAndroid ? 'Android' : 'Celular Móvil'

    presenceChannel.on('broadcast', { event: 'ping-presence' }, () => {
      presenceChannel.send({
        type: 'broadcast',
        event: 'pong-presence',
        payload: {
          id: phoneId,
          deviceName: `${deviceName} (Cámara Wi-Fi)`,
          facing: facingMode,
          slot,
          roomCode: room,
          available: true,
        },
      }).catch(() => {})
    })

    presenceChannel.subscribe()
    return () => {
      presenceChannel.unsubscribe().catch(() => {})
    }
  }, [facingMode, room, slot])

  // Wake lock para que la pantalla del iPhone no se apague durante la grabación
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch (e) {
      console.warn('Wake Lock no disponible o denegado:', e)
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    try {
      wakeLockRef.current?.release?.()
      wakeLockRef.current = null
    } catch {}
  }, [])

  const stopAll = useCallback(() => {
    releaseWakeLock()

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

    videoSenderRef.current = null
    audioSenderRef.current = null
    iceQueueRef.current = []
    setActive(false)
    setStatus('idle')
    setTorchOn(false)
    setMicMuted(false)
  }, [releaseWakeLock, slot])

  // Iniciar la señalización WebRTC a través de Supabase
  const initSignaling = useCallback(async (localStream) => {
    if (!supabase) {
      setErrorMsg('No se pudo inicializar la conexión con el servidor. Revisa tu conexión a internet.')
      setStatus('error')
      return
    }

    setStatus('connecting')

    // 1. Crear RTCPeerConnection
    const pc = new RTCPeerConnection(RTC_CONFIG)
    pcRef.current = pc
    iceQueueRef.current = []

    // Agregar tracks locales (video y audio para micrófono del celular)
    localStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStream)
      if (track.kind === 'video') {
        videoSenderRef.current = sender
      } else if (track.kind === 'audio') {
        audioSenderRef.current = sender
      }
    })

    // 2. Suscribir al canal de señalización
    const channelName = `remotecam_${room}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = channel

    // Enviar candidatos ICE generados por el teléfono
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
            sender: 'phone',
          },
        }).catch(() => {})
      }
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        setStatus('connected')
      } else if (s === 'disconnected' || s === 'failed') {
        setStatus('connecting')
      } else if (s === 'closed') {
        setStatus('idle')
      }
    }

    // Función auxiliar para crear y enviar oferta SDP sin duplicados ni colisiones
    const sendOffer = async () => {
      try {
        if (!pc || pc.signalingState === 'closed') return
        if (pc.signalingState === 'have-local-offer') {
          console.log('[RemoteCam] Ya existe una oferta en proceso hacia el estudio.')
          return
        }
        const offer = await pc.createOffer({
          offerToReceiveVideo: false,
          offerToReceiveAudio: false,
        })
        await pc.setLocalDescription(offer)
        await channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'offer',
            sdp: offer,
            sender: 'phone',
            slot,
          },
        })
      } catch (err) {
        console.error('Error enviando offer WebRTC:', err)
      }
    }

    // Escuchar respuestas del estudio
    channel.on('broadcast', { event: 'signal' }, async (event) => {
      const payload = event?.payload
      if (!payload || payload.sender === 'phone') return

      if (payload.type === 'studio-ready') {
        // El estudio está listo para recibir nuestro feed
        await sendOffer()
        return
      }

      if (payload.type === 'answer') {
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
          setStatus('connected')

          // Aplicar candidatos encolados
          const queue = iceQueueRef.current || []
          while (queue.length > 0) {
            const cand = queue.shift()
            try { await pc.addIceCandidate(cand) } catch (e) { console.warn('ICE add error:', e) }
          }
        } catch (err) {
          console.error('Error aplicando answer WebRTC:', err)
        }
        return
      }

      if (payload.type === 'candidate' && payload.candidate) {
        const iceCandidate = new RTCIceCandidate(payload.candidate)
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(iceCandidate)
          } catch (e) {
            console.warn('Error agregando candidate:', e)
          }
        } else {
          iceQueueRef.current.push(iceCandidate)
        }
        return
      }

      if (payload.type === 'studio-disconnect') {
        setStatus('connecting')
      }
    })

    channel.subscribe(async (subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        // Notificar al estudio que el teléfono está listo
        await channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'phone-ready', slot, sender: 'phone' },
        })
        // Enviar la oferta inicial tras breve espera para que el canal se propague
        setTimeout(() => {
          sendOffer()
        }, 300)
      }
    })
  }, [room, slot])

  // Iniciar la captura de cámara con audio del micrófono
  const startCamera = async (targetFacing = 'environment') => {
    setErrorMsg(null)
    try {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }

      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: audioConstraints,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing } },
            audio: true,
          })
        } catch {
          // Fallback a solo video si el navegador rechaza el audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing } },
            audio: false,
          })
        }
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }

      // Detectar si la cámara soporta antorcha / linterna (torch)
      const track = stream.getVideoTracks()[0]
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {}
        setTorchSupported(Boolean(caps.torch))
      }

      setActive(true)
      await requestWakeLock()
      await initSignaling(stream)
    } catch (err) {
      console.error('Error al acceder a la cámara:', err)
      setErrorMsg('No se pudo acceder a la cámara. Por favor autoriza el permiso de cámara y micrófono en tu navegador.')
      setStatus('error')
    }
  }

  // Voltear entre cámara trasera y frontal (manteniendo el audio del micrófono activo)
  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextFacing)
    setTorchOn(false)

    try {
      let newStream = null
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          },
          audio: false,
        })
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing } },
          audio: false,
        })
      }

      const newTrack = newStream.getVideoTracks()[0]
      const oldTrack = streamRef.current?.getVideoTracks?.()?.[0]

      // Encontrar el sender de video en la conexión WebRTC
      const sender = videoSenderRef.current || pcRef.current?.getSenders?.()?.find(s => s.track?.kind === 'video' || s.kind === 'video')
      if (sender && newTrack) {
        await sender.replaceTrack(newTrack)
      }

      if (oldTrack) oldTrack.stop()

      // Conservar el track de audio existente
      const existingAudio = streamRef.current?.getAudioTracks?.()?.[0]
      if (existingAudio) {
        newStream.addTrack(existingAudio)
      }

      streamRef.current = newStream

      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true')
        videoRef.current.setAttribute('webkit-playsinline', 'true')
        videoRef.current.muted = true
        videoRef.current.srcObject = newStream
        videoRef.current.play().catch(() => {})
      }

      const caps = newTrack?.getCapabilities ? newTrack.getCapabilities() : {}
      setTorchSupported(Boolean(caps.torch))
    } catch (err) {
      console.error('Error al cambiar de cámara:', err)
    }
  }

  // Alternar linterna / torch
  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0]
    if (!track) return

    const nextTorch = !torchOn
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }],
      })
      setTorchOn(nextTorch)
    } catch (err) {
      console.warn('No se pudo encender la linterna:', err)
    }
  }

  // Alternar pausa de video
  const handleTogglePause = () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0]
    if (track) {
      track.enabled = !track.enabled
      setVideoPaused(!track.enabled)
    }
  }

  // Alternar silencio de micrófono en el celular
  const handleToggleMic = () => {
    const track = streamRef.current?.getAudioTracks?.()?.[0]
    if (track) {
      track.enabled = !track.enabled
      setMicMuted(!track.enabled)
    } else {
      setMicMuted(prev => !prev)
    }
  }

  // Callback ref para vincular el flujo de cámara al visor en cuanto monta el elemento <video>
  const setVideoEl = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.setAttribute('playsinline', 'true')
      node.setAttribute('webkit-playsinline', 'true')
      node.muted = true
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current
      }
      const p = node.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {})
      }
    }
  }, [])

  // Sincronizar visor si el estado cambia a activo
  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      const v = videoRef.current
      v.setAttribute('playsinline', 'true')
      v.setAttribute('webkit-playsinline', 'true')
      v.muted = true
      if (v.srcObject !== streamRef.current) {
        v.srcObject = streamRef.current
      }
      v.play().catch(() => {})
    }
  }, [active])

  // Reanudar cámara y WebRTC automáticamente cuando el usuario regresa tras minimizar
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && active) {
        await requestWakeLock()

        // 1. Reanudar reproducción del visor en pantalla
        if (videoRef.current && streamRef.current) {
          videoRef.current.play().catch(() => {})
        }

        // 2. Comprobar si el track de video fue congelado o cerrado por el sistema
        const currentVideoTrack = streamRef.current?.getVideoTracks?.()?.[0]
        const isTrackEnded = !currentVideoTrack || currentVideoTrack.readyState === 'ended'

        if (isTrackEnded) {
          console.log('[RemoteCam] Reactivando captura tras segundo plano...')
          try {
            const nextFacing = facingMode
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: nextFacing },
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 60 },
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })

            const newVideoTrack = newStream.getVideoTracks()[0]
            const newAudioTrack = newStream.getAudioTracks()[0]

            if (videoSenderRef.current && newVideoTrack) {
              await videoSenderRef.current.replaceTrack(newVideoTrack)
            }
            if (audioSenderRef.current && newAudioTrack) {
              await audioSenderRef.current.replaceTrack(newAudioTrack)
            }

            streamRef.current = newStream
            if (videoRef.current) {
              videoRef.current.srcObject = newStream
              videoRef.current.play().catch(() => {})
            }
          } catch (e) {
            console.warn('[RemoteCam] Error al reanudar cámara tras segundo plano:', e)
          }
        }

        // 3. Si la conexión WebRTC cayó mientras estaba minimizado, enviar señal para renegociar
        if (pcRef.current) {
          const pcState = pcRef.current.connectionState
          const iceState = pcRef.current.iceConnectionState
          if (pcState === 'disconnected' || pcState === 'failed' || iceState === 'disconnected' || iceState === 'failed') {
            console.log('[RemoteCam] Renegociando enlace WebRTC tras retorno...')
            if (channelRef.current && streamRef.current) {
              try {
                await channelRef.current.send({
                  type: 'broadcast',
                  event: 'signal',
                  payload: { type: 'phone-ready', slot, sender: 'phone' },
                })
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

  // Cleanup al salir
  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  return (
    <div className={styles.container}>
      {!active ? (
        <div className={styles.startScreen}>
          <div className={styles.logoBadge}>
            <i className="ti ti-broadcast" />
            <span>PODCASTUDIO REMOTO</span>
          </div>

          <div className={styles.iconHero}>
            <i className="ti ti-device-mobile" />
          </div>

          <span className={styles.slotBadgeLarge}>CANAL CAM {slot}</span>
          <h1 className={styles.title}>Cámara Móvil Inalámbrica</h1>
          <p className={styles.desc}>
            Conecta la cámara de tu iPhone en tiempo real con el estudio sin necesidad de instalar ninguna aplicación.
          </p>

          <div style={{ display: 'flex', gap: 10, margin: '8px 0 16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFacingMode('environment')}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: facingMode === 'environment' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'environment' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'environment' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              📷 Trasera (HD)
            </button>
            <button
              type="button"
              onClick={() => setFacingMode('user')}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: facingMode === 'user' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                background: facingMode === 'user' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                color: facingMode === 'user' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              🤳 Frontal
            </button>
          </div>

          <button
            type="button"
            className={styles.startBtn}
            onClick={() => startCamera(facingMode)}
          >
            <i className="ti ti-camera" />
            <span>Activar {facingMode === 'environment' ? 'Cámara Trasera' : 'Cámara Frontal'} y Conectar</span>
          </button>

          {errorMsg && (
            <div className={styles.errorCard}>
              <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
              {errorMsg}
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
            muted
            onLoadedMetadata={(e) => {
              e.target.play().catch(() => {})
            }}
          />

          {/* TOP BAR / TALLY */}
          <div className={styles.topOverlay}>
            <div className={`${styles.tallyPill} ${status === 'connected' ? styles.tallyLive : styles.tallyConnecting}`}>
              <div className={status === 'connected' ? styles.dotLive : styles.dotConnecting} />
              <span>
                {status === 'connected' ? `AL AIRE • CAM ${slot}` : 'CONECTANDO CON ESTUDIO...'}
              </span>
            </div>

            <div className={styles.slotInfoBadge}>
              {facingMode === 'environment' ? 'Trasera (HD)' : 'Frontal'}
            </div>
          </div>

          {/* BOTTOM FLOATING CONTROLS */}
          <div className={styles.bottomOverlay}>
            <div className={styles.actionPill}>
              {/* Botón Voltear Cámara (Frontal / Trasera) */}
              <button
                type="button"
                className={styles.flipBtn}
                onClick={handleFlipCamera}
                title={facingMode === 'environment' ? 'Girar a cámara frontal' : 'Girar a cámara trasera'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 1.5.4 2.9 1.1 4.1L3 16l4 .5.5-4-1.6 1.4C5.3 12.8 5 11.5 5 10c0-3.9 3.1-7 7-7s7 3.1 7 7c0 3.1-2 5.7-4.8 6.6l.6 1.9C18.4 17.3 20 13.9 20 10z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
                  {facingMode === 'environment' ? 'GIRAR' : 'TRASERA'}
                </span>
              </button>

              {/* Botón Torch / Linterna */}
              {torchSupported && (
                <button
                  type="button"
                  className={`${styles.controlBtn} ${torchOn ? styles.controlBtnActive : ''}`}
                  onClick={handleToggleTorch}
                  title="Encender / Apagar Linterna"
                >
                  <i className="ti ti-flare" />
                </button>
              )}

              {/* Botón Micrófono Móvil */}
              <button
                type="button"
                className={`${styles.controlBtn} ${micMuted ? styles.controlBtnActive : ''}`}
                onClick={handleToggleMic}
                title={micMuted ? 'Micrófono Silenciado — Clic para transmitir audio' : 'Micrófono Transmitiendo — Clic para silenciar'}
                style={{
                  color: micMuted ? '#ef4444' : '#22c55e',
                  border: micMuted ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(34,197,94,0.4)',
                  background: micMuted ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)',
                  gap: 4,
                  padding: '6px 12px',
                }}
              >
                <i className={micMuted ? 'ti ti-microphone-off' : 'ti ti-microphone'} />
                <span style={{ fontSize: 10, fontWeight: 800 }}>
                  {micMuted ? 'MUTE' : 'MIC ON'}
                </span>
              </button>

              {/* Botón Pausa de Video */}
              <button
                type="button"
                className={`${styles.controlBtn} ${videoPaused ? styles.controlBtnActive : ''}`}
                onClick={handleTogglePause}
                title={videoPaused ? 'Reanudar video' : 'Pausar video'}
              >
                <i className={videoPaused ? 'ti ti-video-off' : 'ti ti-video'} />
              </button>

              {/* Botón Desconectar */}
              <button
                type="button"
                className={styles.disconnectBtn}
                onClick={stopAll}
                title="Detener cámara y salir"
              >
                <i className="ti ti-phone-off" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
