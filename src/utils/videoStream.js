/** Mantiene el video activo al volver de segundo plano o PWA instalada. */
export function bindVideoKeepAlive(video) {
  if (!video) return () => {}

  const resume = () => {
    if (video.srcObject && (video.paused || video.readyState < 2)) {
      video.play().catch(() => {})
    }
  }

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

export function applyStreamQualityHints(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track) return

  try {
    track.contentHint = 'detail'
  } catch { /* noop */ }

  try {
    track.applyConstraints({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    })
  } catch { /* noop */ }
}

export function getVideoTrackResolution(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  const s = track?.getSettings?.()
  return s?.width && s?.height ? `${s.width}×${s.height}` : null
}
