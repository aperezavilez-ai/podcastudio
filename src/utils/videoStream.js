/** Mantiene el video activo al volver de segundo plano o PWA instalada. */
export function bindVideoKeepAlive(video) {
  if (!video) return () => {}

  let retryTimer = null
  const resume = () => {
    const stream = video.srcObject
    if (!stream) return
    const before = video.currentTime
    video.play().catch(() => {})

    // Electron may retain a live UVC track while the visual decoder is paused
    // after another app owns the foreground. If the element did not advance,
    // reattach the SAME stream to this element only. This never closes or
    // toggles the physical camera track, so it cannot trigger UVC negotiation.
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      if (video.srcObject === stream && video.currentTime === before) {
        try {
          video.srcObject = null
          video.srcObject = stream
          video.play().catch(() => {})
        } catch { /* noop */ }
      }
    }, 750)
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
  video.addEventListener('stalled', resume)

  return () => {
    if (retryTimer) clearTimeout(retryTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('focus', resume)
    video.removeEventListener('stalled', resume)
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

export function getVideoTrackResolution(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  const s = track?.getSettings?.()
  return s?.width && s?.height ? `${s.width}×${s.height}` : null
}

export function getVideoTrackInfo(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  const s = track?.getSettings?.() || {}
  const width = Number(s.width) || 0
  const height = Number(s.height) || 0
  const frameRate = Number(s.frameRate) || 0
  return {
    width,
    height,
    frameRate,
    label: width && height
      ? `${width}×${height}${frameRate ? ` · ${Math.round(frameRate)} fps` : ''}`
      : 'Midiendo señal…',
  }
}
