/** Limpia service workers viejos que dejan pantalla negra en móvil/PWA. */
const SW_VERSION = '3'

export async function migrateServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const stored = localStorage.getItem('podcastudio_sw_version')
  if (stored === SW_VERSION) return

  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    localStorage.setItem('podcastudio_sw_version', SW_VERSION)
  } catch {
    /* noop */
  }
}
