export const PWA_INSTALLED_KEY = 'podcastudio_pwa_installed'
export const PWA_DISMISS_KEY = 'podcastudio_pwa_dismiss'

export function markPwaInstalled() {
  try { localStorage.setItem(PWA_INSTALLED_KEY, '1') } catch { /* noop */ }
}

export function wasPwaInstalled() {
  try { return localStorage.getItem(PWA_INSTALLED_KEY) === '1' } catch { return false }
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export async function detectInstalledRelatedApp() {
  if (typeof navigator === 'undefined' || !navigator.getInstalledRelatedApps) return false
  try {
    const apps = await navigator.getInstalledRelatedApps()
    return apps.length > 0
  } catch {
    return false
  }
}
