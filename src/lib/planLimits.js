import { isAdminUser } from './access.js'

const PRO_LIMITS = {
  maxCameras: 3,
  starterLookOnly: false,
  maxAiPostsPerMonth: null,
  aiDirector: true,
  proLuts: true,
  proTransitions: true,
}

const BY_PLAN = {
  starter: {
    maxCameras: 2,
    starterLookOnly: true,
    maxAiPostsPerMonth: 20,
    aiDirector: false,
    proLuts: false,
    proTransitions: false,
  },
  pro: PRO_LIMITS,
  annual: PRO_LIMITS,
}

const ADMIN_LIMITS = { planId: 'admin', ...PRO_LIMITS }

export function getEffectivePlanId(user, subscription) {
  if (isAdminUser(user)) return 'admin'
  if (subscription?.active && subscription.planId) return subscription.planId
  return null
}

/** Límites según plan activo (admin = ilimitado en la práctica). */
export function getPlanLimits(user, subscription) {
  if (isAdminUser(user)) return ADMIN_LIMITS
  const planId = getEffectivePlanId(user, subscription) || 'starter'
  const base = planId === 'annual' ? BY_PLAN.pro : (BY_PLAN[planId] || BY_PLAN.starter)
  return { planId, ...base }
}

export function isLookPresetAllowed(preset, limits) {
  if (!limits?.starterLookOnly) return true
  return preset.id === 'none' || preset.starter === true
}

export function isLutAllowed(lutId, limits) {
  if (!limits || limits.proLuts) return true
  return lutId === 'none'
}

export function isTransitionAllowed(modeId, limits) {
  if (!limits || limits.proTransitions) return true
  return modeId === 'cut' || modeId === 'crossfade'
}
