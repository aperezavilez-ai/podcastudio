import { safeStorage } from './safeStorage.js'

/** Limpia service workers viejos que dejan pantalla negra en móvil/PWA. */
const SW_VERSION = '8'

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ])
}

export async function migrateServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const stored = safeStorage.getItem('podcastudio_sw_version')
  if (stored === SW_VERSION) return

  const hadOldVersion = !!stored

  try {
    const regs = await withTimeout(navigator.serviceWorker.getRegistrations(), 4000)
    if (Array.isArray(regs)) {
      await Promise.all(regs.map((r) => withTimeout(r.unregister(), 2000)))
    }
    if ('caches' in window) {
      const keys = await withTimeout(caches.keys(), 3000)
      if (Array.isArray(keys)) {
        await Promise.all(keys.map((k) => withTimeout(caches.delete(k), 2000)))
      }
    }
    safeStorage.setItem('podcastudio_sw_version', SW_VERSION)
  } catch {
    safeStorage.setItem('podcastudio_sw_version', SW_VERSION)
  }

  if (hadOldVersion && typeof window !== 'undefined') {
    window.location.reload()
  }
}
