/** URL pública de la app. Usar VITE_SITE_URL en Vercel cuando el dominio propio tenga DNS activo. */
export const CANONICAL_SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://podcastudio-three.vercel.app'
).replace(/\/$/, '')

export function getCanonicalHost() {
  try {
    return new URL(CANONICAL_SITE_URL).hostname
  } catch {
    return 'podcastudio-three.vercel.app'
  }
}

export function isLocalDevHost(hostname = window.location.hostname) {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.endsWith('.local')
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  )
}

/** Sin redirección automática: el dominio propio debe tener DNS activo en Vercel primero. */
export function redirectToCanonicalDomain() {
  return false
}
