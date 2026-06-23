/** Admin vía Supabase app_metadata.role = 'admin' (mapSupabaseUser). */
export function isAdminUser(user) {
  if (!user) return false
  return user.isAdmin === true || user.role === 'admin'
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
