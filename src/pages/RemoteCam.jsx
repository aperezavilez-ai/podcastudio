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

    // Función auxiliar para crear y enviar oferta SDP
    const sendOffer = async () => {
      try {
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
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
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
        // Notificar que el teléfono está listo
        await channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: { type: 'phone-ready', slot, sender: 'phone' },
        })
        // Enviar la oferta inicial
        await sendOffer()
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
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      const newTrack = newStream.getVideoTracks()[0]
      const oldTrack = streamRef.current?.getVideoTracks?.()?.[0]

      if (videoSenderRef.current && newTrack) {
        await videoSenderRef.current.replaceTrack(newTrack)
      }

      if (oldTrack) oldTrack.stop()

      // Conservar el track de audio existente
      const existingAudio = streamRef.current?.getAudioTracks?.()?.[0]
      if (existingAudio) {
        newStream.addTrack(existingAudio)
      }

      streamRef.current = newStream

      if (videoRef.current) {
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
    }
  }

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

          <button
            type="button"
            className={styles.startBtn}
            onClick={() => startCamera(facingMode)}
          >
            <i className="ti ti-camera" />
            <span>Activar Cámara y Conectar</span>
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
            ref={videoRef}
            className={styles.videoElement}
            autoPlay
            playsInline
            muted
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
              {/* Botón Voltear Cámara */}
              <button
                type="button"
                className={styles.controlBtn}
                onClick={handleFlipCamera}
                title="Cambiar entre cámara trasera y frontal"
              >
                <i className="ti ti-switch-camera" />
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
                title={micMuted ? 'Activar micrófono del celular' : 'Silenciar micrófono del celular'}
                style={{ color: micMuted ? '#ef4444' : '#22c55e' }}
              >
                <i className={micMuted ? 'ti ti-microphone-off' : 'ti ti-microphone'} />
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
