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

export function useAudioMix() {
  const ctxRef = useRef(null)
  const destRef = useRef(null)
  const micSourceRef = useRef(null)
  const musicSourceRef = useRef(null)
  const musicGainRef = useRef(null)
  const micGainRef = useRef(null)

  // DSP Audio Nodes
  const lowCutFilterRef = useRef(null)
  const deHissFilterRef = useRef(null)
  const eqLowRef = useRef(null)
  const eqMidRef = useRef(null)
  const eqHighRef = useRef(null)
  const compressorRef = useRef(null)
  const dspSettingsRef = useRef(DEFAULT_DSP_SETTINGS)

  useEffect(() => () => {
    ctxRef.current?.close().catch(() => {})
  }, [])

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      ctxRef.current = new AudioCtx()
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

      // 7. Ganancia final de micrófono
      const micGain = ctx.createGain()
      micGain.gain.value = dspSettingsRef.current.micGain
      micGainRef.current = micGain

      // Conexión en cadena DSP:
      // lowCut -> deHiss -> eqLow -> eqMid -> eqHigh -> compressor -> micGain -> dest
      lowCut.connect(deHiss)
      deHiss.connect(eqLow)
      eqLow.connect(eqMid)
      eqMid.connect(eqHigh)
      eqHigh.connect(compressor)
      compressor.connect(micGain)
      micGain.connect(destRef.current)

      // Canal de música de fondo
      musicGainRef.current = ctx.createGain()
      musicGainRef.current.gain.value = 0
      musicGainRef.current.connect(destRef.current)
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

  const setMicStream = useCallback((micStream) => {
    const { ctx } = ensureContext()
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect() } catch { /* */ }
      micSourceRef.current = null
    }
    if (!micStream) return
    const src = ctx.createMediaStreamSource(micStream)
    src.connect(lowCutFilterRef.current)
    micSourceRef.current = src
  }, [ensureContext])

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

    const captured = musicEl.captureStream()
    const track = captured.getAudioTracks()[0]
    if (!track) return

    const src = ctx.createMediaStreamSource(new MediaStream([track]))
    src.connect(musicGainRef.current)
    musicSourceRef.current = src
  }, [ensureContext])

  const buildRecordingStream = useCallback(async (videoStream, { micStream, musicEl, musicVolume, musicPlaying, dspSettings }) => {
    const { ctx, dest } = ensureContext()
    if (ctx.state === 'suspended') await ctx.resume()

    if (dspSettings) {
      applyDspSettings(dspSettings)
    }

    setMicStream(micStream)
    setMusicMix({ musicEl, volume: musicVolume, playing: musicPlaying })

    const audioTracks = dest.stream.getAudioTracks()
    const tracks = [
      ...videoStream.getVideoTracks(),
      ...(audioTracks.length ? audioTracks : (micStream?.getAudioTracks() || [])),
    ]
    return new MediaStream(tracks)
  }, [ensureContext, applyDspSettings, setMicStream, setMusicMix])

  return { setMicStream, setMusicMix, buildRecordingStream, applyDspSettings, ensureContext }
}
