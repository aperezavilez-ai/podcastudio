/** Mantiene el video activo al volver de segundo plano o PWA instalada. */
export function bindVideoKeepAlive(video) {
  if (!video) return () => {}

  const resume = () => {
    if (video.srcObject && (video.paused || video.readyState < 2)) {
      video.play().catch(() => {})
    }
  }

  // ✅ FIX CRÍTICO #7: Atributos para evitar throttling de Chromium
  video.setAttribute('disablePictureInPicture', 'false')
  video.setAttribute('disableRemotePlayback', 'false')

  const onVisibility = () => {
    if (document.visibilityState === 'visible') resume()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', resume)
  window.addEventListener('focus', resume)

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('focus', resume)
  }
}

/**
 * Sincroniza el repintado con los frames REALES del video.
 *
 * requestVideoFrameCallback() se dispara exactamente cuando el decodificador
 * entrega un frame nuevo, así el canvas nunca dibuja frames obsoletos.
 */
export function bindVideoFrameSync(video, onFrame) {
  if (!video || typeof onFrame !== 'function') return () => {}

  const supportsRVFC = typeof video.requestVideoFrameCallback === 'function'

  if (supportsRVFC) {
    let handleId = 0
    let cancelled = false
    const onVideoFrame = () => {
      if (cancelled) return
      onFrame()
      handleId = video.requestVideoFrameCallback(onVideoFrame)
    }
    handleId = video.requestVideoFrameCallback(onVideoFrame)
    return () => {
      cancelled = true
      try {
        video.cancelVideoFrameCallback?.(handleId)
      } catch {
        /* noop */
      }
    }
  }

  let rafId = 0
  let lastTime = -1
  const tick = () => {
    rafId = requestAnimationFrame(tick)
    if (video.readyState >= 2 && video.currentTime !== lastTime) {
      lastTime = video.currentTime
      onFrame()
    }
  }
  rafId = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(rafId)
  }
}

export function applyStreamQualityHints(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track) return

  try {
    track.contentHint = 'motion'
  } catch { /* noop */ }

  try {
    track.applyConstraints({
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 60, min: 24, max: 60 },
    })
  } catch { /* noop */ }
}

export function getVideoTrackResolution(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  const s = track?.getSettings?.()
  return s?.width && s?.height ? `${s.width}×${s.height}` : null
}