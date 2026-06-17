import { useRef, useCallback, useEffect } from 'react'

export function useAudioMix() {
  const ctxRef = useRef(null)
  const destRef = useRef(null)
  const micSourceRef = useRef(null)
  const musicSourceRef = useRef(null)
  const musicGainRef = useRef(null)
  const micGainRef = useRef(null)

  useEffect(() => () => {
    ctxRef.current?.close().catch(() => {})
  }, [])

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
      destRef.current = ctxRef.current.createMediaStreamDestination()
      micGainRef.current = ctxRef.current.createGain()
      micGainRef.current.gain.value = 1
      micGainRef.current.connect(destRef.current)
      musicGainRef.current = ctxRef.current.createGain()
      musicGainRef.current.gain.value = 0
      musicGainRef.current.connect(destRef.current)
    }
    return { ctx: ctxRef.current, dest: destRef.current }
  }, [])

  const setMicStream = useCallback((micStream) => {
    const { ctx } = ensureContext()
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect() } catch { /* */ }
      micSourceRef.current = null
    }
    if (!micStream) return
    const src = ctx.createMediaStreamSource(micStream)
    src.connect(micGainRef.current)
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

  const buildRecordingStream = useCallback(async (videoStream, { micStream, musicEl, musicVolume, musicPlaying }) => {
    const { ctx, dest } = ensureContext()
    if (ctx.state === 'suspended') await ctx.resume()

    setMicStream(micStream)
    setMusicMix({ musicEl, volume: musicVolume, playing: musicPlaying })

    const tracks = [
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]
    return new MediaStream(tracks)
  }, [ensureContext, setMicStream, setMusicMix])

  return { setMicStream, setMusicMix, buildRecordingStream }
}
