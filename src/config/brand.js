/** Logo oficial Editcore — PNG con fondo negro, usar tal cual. */
export const DEFAULT_LOGO_URL = '/editcore-logo.png'

export function resolveLogoUrl(projectLogoUrl) {
  return projectLogoUrl || DEFAULT_LOGO_URL
}
