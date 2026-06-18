let applyUpdate = null

export function setPwaUpdateHandler(fn) {
  applyUpdate = fn
}

export function triggerPwaUpdate() {
  applyUpdate?.(true)
}

export function notifyPwaUpdateAvailable() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwa-update-available'))
  }
}
