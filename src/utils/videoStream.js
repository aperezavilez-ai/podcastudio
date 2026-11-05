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

export async function applyStreamQualityHints(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track) return

  try {
    track.contentHint = 'motion'
  } catch { /* noop */ }

  // Do not force a USB device to 60 fps or impose a minimum framerate.  Many
  // webcams share a USB controller; an impossible constraint makes Chromium
  // renegotiate the camera and can stall the renderer while a button is being
  // handled.  These are only *preferences*, bounded by what the device says it
  // can provide.  1080p30 is the Master quality target.
  try {
    const capabilities = track.getCapabilities?.() || {}
    const maxWidth = Number(capabilities.width?.max) || 1920
    const maxHeight = Number(capabilities.height?.max) || 1080
    const maxFps = Number(capabilities.frameRate?.max) || 30
    await track.applyConstraints({
      width: { ideal: Math.min(1920, maxWidth) },
      height: { ideal: Math.min(1080, maxHeight) },
      frameRate: { ideal: Math.min(30, maxFps) },
    })
  } catch { /* Keep the camera's negotiated native mode. */ }
}

export function getVideoTrackResolution(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  const s = track?.getSettings?.()
  return s?.width && s?.height ? `${s.width}×${s.height}` : null
}
