import { useRef, useCallback, useEffect } from 'react'

export const DEFAULT_DSP_SETTINGS = {
  noiseReduction: true,      // Eliminador de ruidos
  deHiss: true,              // Reducción de his / siseo
  lowCut: true,              // Filtro anti-retumbo 80Hz
  compressor: true,          // Compresor nivelador de voz
  eqBass: 2,                 // Graves (dB)
  eqMid: 1,                  // Medios (dB)
  eqTreble: 0,               // Agudos (dB)
  micGain: 1.0,              // Ganancia maestra
}

/**
 * Hook de Mezcla de Audio Broadcast para PODCASTUDIO.
 * - Soporta latencia interactiva en tiempo real (lip-sync natural sin retraso de audio).
 * - Salida directa a bocinas/altavoces de la computadora (ctx.destination).
 * - Enrutamiento dinámico multi-cámara (Master + PiP + Split 2ª + Triple 3ª + Quad 4ª + Micrófono externo).
 * - Cadena DSP profesional (filtro anti-retumbo, de-hiss, EQ 3 bandas, compresor broadcast y nivelador).
 */
export function useAudioMix() {
  const ctxRef = useRef(null)
  const destRef = useRef(null)
  const masterSumGainRef = useRef(null)
  const monitorSumGainRef = useRef(null)
  const monitorGainRef = useRef(null)
  const musicSourceRef = useRef(null)
  const musicGainRef = useRef(null)
  const micGainRef = useRef(null)

  // Canales independientes para cada fuente de audio
  const channelsRef = useRef({
    master: { source: null, gain: null, stream: null },
    pip: { source: null, gain: null, stream: null },
    split: { source: null, gain: null, stream: null },
    triple: { source: null, gain: null, stream: null },
    quad: { source: null, gain: null, stream: null },
    mic: { source: null, gain: null, stream: null },
  })

  // DSP Audio Nodes & Filters
  const lowCutFilterRef = useRef(null)
  const lowCut2FilterRef = useRef(null)
  const humNotchFilterRef = useRef(null)
  const deHissFilterRef = useRef(null)
  const lowPassFilterRef = useRef(null)
  const eqLowRef = useRef(null)
  const eqMidRef = useRef(null)
  const eqHighRef = useRef(null)
  const noiseGateGainRef = useRef(null)
  const gateAnalyserRef = useRef(null)
  const gateRafRef = useRef(null)
  const compressorRef = useRef(null)
  const dspSettingsRef = useRef(DEFAULT_DSP_SETTINGS)
  const speakerEnabledRef = useRef(false) // Desactivado por defecto para evitar acople/chillido en bocinas
  const speakerVolumeRef = useRef(1.0)

  useEffect(() => () => {
    if (gateRafRef.current) cancelAnimationFrame(gateRafRef.current)
    ctxRef.current?.close().catch(() => {})
  }, [])

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      // latencyHint: 'interactive' para eliminar retardos de búfer y garantizar sincronía labial
      ctxRef.current = new AudioCtx({ latencyHint: 'interactive' })
      const ctx = ctxRef.current
      destRef.current = ctx.createMediaStreamDestination()

      const unlockAudio = () => {
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {})
        }
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('click', unlockAudio, { once: true, passive: true })
        window.addEventListener('keydown', unlockAudio, { once: true, passive: true })
        window.addEventListener('touchstart', unlockAudio, { once: true, passive: true })
        window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true })
      }

      // CADENA DSP BROADCAST PROFESIONAL:
      // 1. Doble filtro pasa-altos en cascada a 95Hz (24dB/octava):
      //    Elimina por completo el "zumbido de aire", ráfagas de aire acondicionado,
      //    golpes en la mesa y retumbos graves sin perjudicar la calidez de la voz humana.
      const lowCut1 = ctx.createBiquadFilter()
      lowCut1.type = 'highpass'
      lowCut1.frequency.value = dspSettingsRef.current.lowCut ? 95 : 10
      lowCut1.Q.value = 0.707
      lowCutFilterRef.current = lowCut1

      const lowCut2 = ctx.createBiquadFilter()
      lowCut2.type = 'highpass'
      lowCut2.frequency.value = dspSettingsRef.current.lowCut ? 95 : 10
      lowCut2.Q.value = 0.707
      lowCut2FilterRef.current = lowCut2

      // 2. Filtro Notch de 60Hz: Elimina zumbidos eléctricos de corriente alterna (hum eléctrico / bucles de masa)
      const humNotch = ctx.createBiquadFilter()
      humNotch.type = 'notch'
      humNotch.frequency.value = 60
      humNotch.Q.value = 6.0
      humNotchFilterRef.current = humNotch

      // 3. Eliminador profundo de siseo / hiss (High-Shelf a 6800Hz, -12dB)
      const deHiss = ctx.createBiquadFilter()
      deHiss.type = 'highshelf'
      deHiss.frequency.value = 6800
      deHiss.gain.value = dspSettingsRef.current.deHiss ? -12 : 0
      deHissFilterRef.current = deHiss

      // 4. Filtro pasa-bajos a 12500Hz: descarta frecuencias ultrasónicas y chillidos residuales de previos móviles
      const lowPass = ctx.createBiquadFilter()
      lowPass.type = 'lowpass'
      lowPass.frequency.value = 12500
      lowPassFilterRef.current = lowPass

      // 5. EQ Bajos (Graves agradables / Cuerpo de la voz - 200Hz)
      const eqLow = ctx.createBiquadFilter()
      eqLow.type = 'lowshelf'
      eqLow.frequency.value = 200
      eqLow.gain.value = dspSettingsRef.current.eqBass
      eqLowRef.current = eqLow

      // 6. EQ Medios (Presencia e inteligibilidad vocal - 1600Hz)
      const eqMid = ctx.createBiquadFilter()
      eqMid.type = 'peaking'
      eqMid.frequency.value = 1600
      eqMid.Q.value = 1.1
      eqMid.gain.value = dspSettingsRef.current.eqMid
      eqMidRef.current = eqMid

      // 7. EQ Agudos (Claridad vocal sin asperezas - 5000Hz)
      const eqHigh = ctx.createBiquadFilter()
      eqHigh.type = 'highshelf'
      eqHigh.frequency.value = 5000
      eqHigh.gain.value = dspSettingsRef.current.eqTreble
      eqHighRef.current = eqHigh

      // 8. Compuerta Inteligente de Ruido (Automated Soft Noise Gate)
      //    Atenúa -22dB el ruido de fondo, his y zumbido de aire cuando la persona no está hablando
      const noiseGateGain = ctx.createGain()
      noiseGateGain.gain.value = 1.0
      noiseGateGainRef.current = noiseGateGain

      const gateAnalyser = ctx.createAnalyser()
      gateAnalyser.fftSize = 512
      gateAnalyser.smoothingTimeConstant = 0.2
      gateAnalyserRef.current = gateAnalyser

      // Monitor de nivel RMS para compuerta suave continua
      const gateData = new Uint8Array(gateAnalyser.frequencyBinCount)
      let lastCheck = 0
      const runGateLoop = (timestamp) => {
        if (!ctxRef.current) return
        if (timestamp - lastCheck > 25) {
          lastCheck = timestamp
          if (dspSettingsRef.current.noiseReduction && noiseGateGainRef.current) {
            gateAnalyser.getByteFrequencyData(gateData)
            let sum = 0
            for (let i = 0; i < gateData.length; i++) {
              sum += gateData[i]
            }
            const avg = sum / gateData.length // 0 a 255
            const now = ctx.currentTime
            // Umbral de habla sensible: si el promedio supera 2.8, está hablando -> compuerta 100% abierta
            // Si está en silencio/pausa vocal, atenuación suave a 0.40 (-8dB) que limpia siseo/aire sin cortar palabras
            const targetGate = avg > 2.8 ? 1.0 : 0.40
            noiseGateGainRef.current.gain.setTargetAtTime(targetGate, now, targetGate === 1.0 ? 0.003 : 0.12)
          }
        }
        gateRafRef.current = requestAnimationFrame(runGateLoop)
      }
      gateRafRef.current = requestAnimationFrame(runGateLoop)

      // 9. Compresor de voz Broadcast (evita saturación y nivela volumen de voz)
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = dspSettingsRef.current.compressor ? -22 : 0
      compressor.knee.value = 10
      compressor.ratio.value = dspSettingsRef.current.compressor ? 4 : 1
      compressor.attack.value = 0.003
      compressor.release.value = 0.20
      compressorRef.current = compressor

      // 10. Ganancia maestra de micrófonos procesados
      const micGain = ctx.createGain()
      micGain.gain.value = dspSettingsRef.current.micGain ?? 1.2
      micGainRef.current = micGain

      // Conexión en cadena DSP:
      // lowCut1 -> lowCut2 -> humNotch -> deHiss -> lowPass -> eqLow -> eqMid -> eqHigh -> gateAnalyser -> noiseGateGain -> compressor -> micGain
      lowCut1.connect(lowCut2)
      lowCut2.connect(humNotch)
      humNotch.connect(deHiss)
      deHiss.connect(lowPass)
      lowPass.connect(eqLow)
      eqLow.connect(eqMid)
      eqMid.connect(eqHigh)
      eqHigh.connect(gateAnalyser)
      gateAnalyser.connect(noiseGateGain)
      noiseGateGain.connect(compressor)
      compressor.connect(micGain)

      // Nodo Sumador Maestro
      const masterSum = ctx.createGain()
      masterSum.gain.value = 1.0
      masterSumGainRef.current = masterSum

      micGain.connect(masterSum)

      // Canal de música de fondo
      const musicGain = ctx.createGain()
      musicGain.gain.value = 0
      musicGainRef.current = musicGain
      musicGain.connect(masterSum)

      // 1. Destino para Grabación en alta calidad (mezcla maestra completa con todos los micros y música)
      masterSum.connect(destRef.current)

      // 2. Bus MIX-MINUS para SALIDA DE AUDIO A BOCINAS / ALTAVOCES DE LA PC (Monitoreo en vivo)
      //    Regla de oro de ingeniería de audio: Las bocinas de la computadora reproducen
      //    la música y los participantes/alumnos remotos, pero NUNCA el micrófono local
      //    del presentador que está frente a esas mismas bocinas, erradicando al 100% el chillido/acople acústico.
      const monitorSum = ctx.createGain()
      monitorSum.gain.value = 1.0
      monitorSumGainRef.current = monitorSum
      musicGain.connect(monitorSum)

      const monitorGain = ctx.createGain()
      monitorGain.gain.value = speakerEnabledRef.current ? speakerVolumeRef.current : 0
      monitorGainRef.current = monitorGain
      monitorSum.connect(monitorGain)
      monitorGain.connect(ctx.destination)
    }
    return { ctx: ctxRef.current, dest: destRef.current }
  }, [])

  const applyDspSettings = useCallback((newSettings) => {
    dspSettingsRef.current = { ...dspSettingsRef.current, ...newSettings }
    const s = dspSettingsRef.current
    const ctx = ctxRef.current
    if (!ctx) return

    const now = ctx.currentTime

    if (lowCutFilterRef.current) {
      lowCutFilterRef.current.frequency.setTargetAtTime(s.lowCut ? 95 : 10, now, 0.05)
    }
    if (lowCut2FilterRef.current) {
      lowCut2FilterRef.current.frequency.setTargetAtTime(s.lowCut ? 95 : 10, now, 0.05)
    }
    if (deHissFilterRef.current) {
      deHissFilterRef.current.gain.setTargetAtTime(s.deHiss ? -12 : 0, now, 0.05)
    }
    if (lowPassFilterRef.current) {
      lowPassFilterRef.current.frequency.setTargetAtTime(s.deHiss ? 12500 : 20000, now, 0.05)
    }
    if (eqLowRef.current) {
      eqLowRef.current.gain.setTargetAtTime(s.eqBass, now, 0.05)
    }
    if (eqMidRef.current) {
      eqMidRef.current.gain.setTargetAtTime(s.eqMid, now, 0.05)
    }
    if (eqHighRef.current) {
      eqHighRef.current.gain.setTargetAtTime(s.eqTreble, now, 0.05)
    }
    if (compressorRef.current) {
      compressorRef.current.threshold.setTargetAtTime(s.compressor ? -22 : 0, now, 0.05)
      compressorRef.current.ratio.setTargetAtTime(s.compressor ? 4 : 1, now, 0.05)
    }
    if (micGainRef.current) {
      micGainRef.current.gain.setTargetAtTime(s.micGain ?? 1.2, now, 0.05)
    }
  }, [])

  // Conectar o actualizar un canal de audio específico (Master, PiP, Split, Triple, Quad, Mic)
  const updateChannel = useCallback((channelKey, stream, isMuted = false, gainMultiplier = 1.0) => {
    const { ctx } = ensureContext()
    const ch = channelsRef.current[channelKey]
    if (!ch) return

    const hasAudioTrack = Boolean(stream?.getAudioTracks?.()?.some(t => t.readyState === 'live'))

    if (!stream || !hasAudioTrack) {
      if (ch.source) {
        try { ch.source.disconnect() } catch {}
        ch.source = null
      }
      if (ch.audioHelper) {
        try {
          ch.audioHelper.pause()
          ch.audioHelper.srcObject = null
        } catch {}
      }
      ch.stream = null
      return
    }

    if (!ch.gain) {
      const g = ctx.createGain()
      g.connect(lowCutFilterRef.current)
      // Conectar fuentes remotas/participantes a la salida de bocinas Mix-Minus
      // REGLA ACÚSTICA CRÍTICA: 'master' y 'mic' son el presentador local frente a la PC;
      // NUNCA deben enviarse a las bocinas para erradicar al 100% el acople/chillido acústico.
      if (channelKey !== 'mic' && channelKey !== 'master' && monitorSumGainRef.current) {
        try { g.connect(monitorSumGainRef.current) } catch {}
      }
      ch.gain = g
    }

    if (ch.stream !== stream || !ch.source) {
      if (ch.source) {
        try { ch.source.disconnect() } catch {}
      }
      try {
        const src = ctx.createMediaStreamSource(stream)
        src.connect(ch.gain)
        ch.source = src
        ch.stream = stream

        // En Chromium/Safari: los MediaStreams de WebRTC requieren un elemento de audio
        // activo para que el motor WebRTC decodifique los paquetes de audio entrantes.
        // Lo mantenemos en muted=true para que decodifique sin duplicar salida en bocinas.
        if (!ch.audioHelper && typeof Audio !== 'undefined') {
          const a = new Audio()
          a.autoplay = true
          a.playsInline = true
          a.muted = true
          a.volume = 0
          ch.audioHelper = a
        }
        if (ch.audioHelper) {
          ch.audioHelper.srcObject = stream
          ch.audioHelper.play().catch(() => {})
        }
      } catch (err) {
        console.warn(`[useAudioMix] Error conectando canal ${channelKey}:`, err)
      }
    }

    const targetGain = isMuted ? 0 : (1.0 * gainMultiplier)
    if (ch.gain) {
      ch.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.02)
    }
  }, [ensureContext])

  // Sincronizar todas las fuentes de audio activas del estudio
  const syncAudioSources = useCallback(({
    masterStream = null,
    masterMuted = false,
    masterGain = 1.0,
    pipStream = null,
    pipMuted = false,
    pipGain = 1.0,
    splitStream = null,
    splitMuted = false,
    splitGain = 1.0,
    tripleStream = null,
    tripleMuted = false,
    tripleGain = 1.0,
    quadStream = null,
    quadMuted = false,
    quadGain = 1.0,
    extMicStream = null,
    extMicMuted = false,
  }) => {
    // Cámaras remotas y móviles reciben preamplificador 1.8x para nivelar su volumen broadcast
    updateChannel('master', masterStream, masterMuted, masterGain * 1.8)
    updateChannel('pip', pipStream, pipMuted, pipGain * 1.8)
    updateChannel('split', splitStream, splitMuted, splitGain * 1.8)
    updateChannel('triple', tripleStream, tripleMuted, tripleGain * 1.8)
    updateChannel('quad', quadStream, quadMuted, quadGain * 1.8)
    // Micrófono de PC / USB recibe preamplificador 1.8x para captación clara
    updateChannel('mic', extMicStream, extMicMuted, 1.8)
  }, [updateChannel])

  // Salida de audio a bocinas / altavoces de la PC
  const setSpeakerMonitoring = useCallback(({ enabled = true, volume = 1.0 } = {}) => {
    speakerEnabledRef.current = enabled
    speakerVolumeRef.current = volume
    const { ctx } = ensureContext()
    if (monitorGainRef.current && ctx) {
      const target = enabled ? Math.max(0, Math.min(1.5, volume)) : 0
      monitorGainRef.current.gain.setTargetAtTime(target, ctx.currentTime, 0.03)
      if (enabled && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
    }
  }, [ensureContext])

  const resumeContext = useCallback(async () => {
    const { ctx } = ensureContext()
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {}
    }
  }, [ensureContext])

  const setMicStream = useCallback((micStream) => {
    updateChannel('mic', micStream, false)
  }, [updateChannel])

  const setMusicMix = useCallback(({ musicEl, volume = 30, playing = false }) => {
    const { ctx } = ensureContext()
    if (musicSourceRef.current) {
      try { musicSourceRef.current.disconnect() } catch { /* */ }
      musicSourceRef.current = null
    }

    if (musicGainRef.current) {
      musicGainRef.current.gain.value = playing ? volume / 100 : 0
    }

    if (!musicEl || !playing || typeof musicEl.captureStream !== 'function') return

    try {
      const captured = musicEl.captureStream()
      const track = captured.getAudioTracks()[0]
      if (!track) return

      const src = ctx.createMediaStreamSource(new MediaStream([track]))
      src.connect(musicGainRef.current)
      musicSourceRef.current = src
    } catch (e) {
      console.warn('[useAudioMix] Error al capturar música de fondo:', e)
    }
  }, [ensureContext])

  const buildRecordingStream = useCallback(async (videoStream, {
    micStream,
    masterStream,
    masterMuted = false,
    pipStream,
    pipMuted = true,
    splitStream,
    splitMuted = true,
    tripleStream,
    tripleMuted = true,
    quadStream,
    quadMuted = true,
    musicEl,
    musicVolume,
    musicPlaying,
    dspSettings,
  }) => {
    const { ctx, dest } = ensureContext()
    if (ctx.state === 'suspended') await ctx.resume()

    if (dspSettings) {
      applyDspSettings(dspSettings)
    }

    const masterHasLiveAudio = Boolean(masterStream?.getAudioTracks?.()?.some(t => t.readyState === 'live'))
    const shouldMuteExtMic = masterHasLiveAudio && !masterMuted

    syncAudioSources({
      masterStream,
      masterMuted,
      pipStream,
      pipMuted,
      splitStream,
      splitMuted,
      tripleStream,
      tripleMuted,
      quadStream,
      quadMuted,
      extMicStream: micStream,
      extMicMuted: shouldMuteExtMic,
    })

    setMusicMix({ musicEl, volume: musicVolume, playing: musicPlaying })

    const audioTracks = dest.stream.getAudioTracks()
    const tracks = [
      ...videoStream.getVideoTracks(),
      ...(audioTracks.length ? audioTracks : (micStream?.getAudioTracks() || masterStream?.getAudioTracks() || [])),
    ]
    return new MediaStream(tracks)
  }, [ensureContext, applyDspSettings, syncAudioSources, setMusicMix])

  return {
    setMicStream,
    setMusicMix,
    syncAudioSources,
    updateChannel,
    setSpeakerMonitoring,
    resumeContext,
    buildRecordingStream,
    applyDspSettings,
    ensureContext,
  }
}
