/** Admin: Supabase app_metadata.role = 'admin' o correo admin oficial. */
import { ADMIN_EMAIL, normalizeLoginEmail } from './adminEmail.js'

export function isAdminUser(user) {
  if (!user) return false
  if (user.isAdmin === true || user.role === 'admin') return true
  return normalizeLoginEmail(user.email || '') === ADMIN_EMAIL
}

/** Ruta tras login según rol y contexto. */
export function getPostLoginPath(user, { pendingPlan, seenTour } = {}) {
  if (isAdminUser(user)) return '/studio'
  if (pendingPlan) return `/plans?plan=${pendingPlan}`
  if (!seenTour) return '/tour'
  return '/plans'
}

export function canAccessStudio(user, subscription) {
  if (isAdminUser(user)) return true
  return !!subscription?.active
}
