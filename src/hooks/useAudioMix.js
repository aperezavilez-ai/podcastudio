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

  // DSP Audio Nodes
  const lowCutFilterRef = useRef(null)
  const deHissFilterRef = useRef(null)
  const eqLowRef = useRef(null)
  const eqMidRef = useRef(null)
  const eqHighRef = useRef(null)
  const compressorRef = useRef(null)
  const dspSettingsRef = useRef(DEFAULT_DSP_SETTINGS)
  const speakerEnabledRef = useRef(false)
  const speakerVolumeRef = useRef(1.0)

  useEffect(() => () => {
    ctxRef.current?.close().catch(() => {})
  }, [])

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      // latencyHint: 'interactive' para eliminar retardos de búfer y garantizar sincronía labial
      ctxRef.current = new AudioCtx({ latencyHint: 'interactive' })
      const ctx = ctxRef.current
      destRef.current = ctx.createMediaStreamDestination()

      // DSP Chain Nodes
      // 1. Filtro pasa-altos 80Hz (elimina retumbos, golpes en escritorio y ruido eléctrico de 50/60Hz)
      const lowCut = ctx.createBiquadFilter()
      lowCut.type = 'highpass'
      lowCut.frequency.value = dspSettingsRef.current.lowCut ? 80 : 10
      lowCutFilterRef.current = lowCut

      // 2. Eliminador de siseo / his (corte suave a partir de 7500Hz)
      const deHiss = ctx.createBiquadFilter()
      deHiss.type = 'highshelf'
      deHiss.frequency.value = 7500
      deHiss.gain.value = dspSettingsRef.current.deHiss ? -9 : 0
      deHissFilterRef.current = deHiss

      // 3. EQ Bajos (Graves / Calidez de la voz - 200Hz)
      const eqLow = ctx.createBiquadFilter()
      eqLow.type = 'lowshelf'
      eqLow.frequency.value = 200
      eqLow.gain.value = dspSettingsRef.current.eqBass
      eqLowRef.current = eqLow

      // 4. EQ Medios (Presencia e inteligibilidad vocal - 1500Hz)
      const eqMid = ctx.createBiquadFilter()
      eqMid.type = 'peaking'
      eqMid.frequency.value = 1500
      eqMid.Q.value = 1.1
      eqMid.gain.value = dspSettingsRef.current.eqMid
      eqMidRef.current = eqMid

      // 5. EQ Agudos (Claridad y brillo vocal - 5500Hz)
      const eqHigh = ctx.createBiquadFilter()
      eqHigh.type = 'highshelf'
      eqHigh.frequency.value = 5500
      eqHigh.gain.value = dspSettingsRef.current.eqTreble
      eqHighRef.current = eqHigh

      // 6. Compresor de voz Broadcast (evita saturación y nivela volumen de voz)
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = dspSettingsRef.current.compressor ? -24 : 0
      compressor.knee.value = 12
      compressor.ratio.value = dspSettingsRef.current.compressor ? 4 : 1
      compressor.attack.value = 0.003
      compressor.release.value = 0.25
      compressorRef.current = compressor

      // 7. Ganancia maestra de micrófonos procesados
      const micGain = ctx.createGain()
      micGain.gain.value = dspSettingsRef.current.micGain
      micGainRef.current = micGain

      // Conexión en cadena DSP:
      // lowCut -> deHiss -> eqLow -> eqMid -> eqHigh -> compressor -> micGain
      lowCut.connect(deHiss)
      deHiss.connect(eqLow)
      eqLow.connect(eqMid)
      eqMid.connect(eqHigh)
      eqHigh.connect(compressor)
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

      // 1. Destino para Grabación en alta calidad
      masterSum.connect(destRef.current)

      // 2. Destino para SALIDA DE AUDIO A BOCINAS / ALTAVOCES DE LA PC (Monitoreo en vivo)
      const monitorGain = ctx.createGain()
      monitorGain.gain.value = speakerEnabledRef.current ? speakerVolumeRef.current : 0
      monitorGainRef.current = monitorGain
      masterSum.connect(monitorGain)
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
      lowCutFilterRef.current.frequency.setTargetAtTime(s.lowCut ? 80 : 10, now, 0.05)
    }
    if (deHissFilterRef.current) {
      deHissFilterRef.current.gain.setTargetAtTime(s.deHiss ? -9 : 0, now, 0.05)
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
      compressorRef.current.threshold.setTargetAtTime(s.compressor ? -24 : 0, now, 0.05)
      compressorRef.current.ratio.setTargetAtTime(s.compressor ? 4 : 1, now, 0.05)
    }
    if (micGainRef.current) {
      micGainRef.current.gain.setTargetAtTime(s.micGain ?? 1, now, 0.05)
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
      ch.stream = null
      return
    }

    if (!ch.gain) {
      const g = ctx.createGain()
      g.connect(lowCutFilterRef.current)
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
    pipStream = null,
    pipMuted = true,
    splitStream = null,
    splitMuted = true,
    tripleStream = null,
    tripleMuted = true,
    quadStream = null,
    quadMuted = true,
    extMicStream = null,
    extMicMuted = false,
  }) => {
    updateChannel('master', masterStream, masterMuted)
    updateChannel('pip', pipStream, pipMuted)
    updateChannel('split', splitStream, splitMuted)
    updateChannel('triple', tripleStream, tripleMuted)
    updateChannel('quad', quadStream, quadMuted)
    updateChannel('mic', extMicStream, extMicMuted)
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
      extMicMuted: false,
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
