export function isMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Móvil/táctil: preview con &lt;video&gt; (Safari iOS falla con canvas grande). */
export function preferVideoPreview() {
  return isMobileViewport() || isCoarsePointer()
}
