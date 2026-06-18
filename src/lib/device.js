export function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 1024px)').matches
}

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function isTouchDevice() {
  if (typeof navigator === 'undefined') return false
  return (
    navigator.maxTouchPoints > 0
    || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  )
}

/** Safari iOS no pinta canvas grande; usar &lt;video&gt; en táctil y móvil. */
export function preferVideoPreview() {
  if (typeof window === 'undefined') return false
  if (isTouchDevice()) return true
  if (isCoarsePointer()) return true
  if (window.matchMedia('(hover: none)').matches) return true
  return isMobileViewport()
}
