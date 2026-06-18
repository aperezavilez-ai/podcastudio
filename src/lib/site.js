/** Dominio público de la app (Vercel: VITE_SITE_URL + redeploy). */
export const CANONICAL_SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://podcaststudio.mx'
).replace(/\/$/, '')

export function getCanonicalHost() {
  try {
    return new URL(CANONICAL_SITE_URL).hostname
  } catch {
    return 'podcaststudio.mx'
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

/** Redirige vercel.app (u otro host de preview) al dominio propio. */
export function redirectToCanonicalDomain() {
  if (!import.meta.env.PROD || typeof window === 'undefined') return false

  const { hostname, pathname, search, hash } = window.location
  if (isLocalDevHost(hostname)) return false

  const canonicalHost = getCanonicalHost()
  if (hostname === canonicalHost) return false

  const shouldRedirect = hostname.endsWith('.vercel.app') || hostname.startsWith('www.')
  if (!shouldRedirect) return false

  const target = `${CANONICAL_SITE_URL}${pathname}${search}${hash}`
  window.location.replace(target)
  return true
}
