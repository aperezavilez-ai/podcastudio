import { safeStorage } from './safeStorage.js'
import { PWA_CACHE_VERSION } from './pwaCacheVersion.js'

const MIGRATE_RELOAD_KEY = 'podcastudio_sw_migrate_reload'

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ])
}

/** Limpia service workers viejos que dejan pantalla negra o bucle de recarga. */
export async function migrateServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const stored = safeStorage.getItem('podcastudio_sw_version')
  if (stored === PWA_CACHE_VERSION) return

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
    safeStorage.setItem('podcastudio_sw_version', PWA_CACHE_VERSION)
  } catch {
    safeStorage.setItem('podcastudio_sw_version', PWA_CACHE_VERSION)
  }

  if (
    hadOldVersion
    && typeof window !== 'undefined'
    && !sessionStorage.getItem(MIGRATE_RELOAD_KEY)
  ) {
    sessionStorage.setItem(MIGRATE_RELOAD_KEY, '1')
    window.location.reload()
  }
}
