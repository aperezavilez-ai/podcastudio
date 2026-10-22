export function getSiteUrl() {
  return process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.podcastudio.mx'
}
