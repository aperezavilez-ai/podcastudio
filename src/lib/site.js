/** URL pública de la app. Usar VITE_SITE_URL en Vercel cuando el dominio propio tenga DNS activo. */
export const CANONICAL_SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://www.podcastudio.mx'
).replace(/\/$/, '')

export function getCanonicalHost() {
  try {
    return new URL(CANONICAL_SITE_URL).hostname
  } catch {
    return 'www.podcastudio.mx'
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

export function isWrongAppHost(hostname = window.location.hostname) {
  const h = (hostname || '').toLowerCase()
  return h.includes('podcaststudio') || h === 'podcastudio.mx'
}

/** Redirige dominios incorrectos o vercel.app al sitio canónico. */
export function redirectToCanonicalDomain() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false

  const { hostname, pathname, search, hash } = window.location
  if (isLocalDevHost(hostname)) return false

  const canonicalHost = getCanonicalHost()
  if (hostname === canonicalHost) return false

  if (isWrongAppHost(hostname) || hostname.endsWith('.vercel.app')) {
    window.location.replace(`${CANONICAL_SITE_URL}${pathname}${search}${hash}`)
    return true
  }

  return false
}
