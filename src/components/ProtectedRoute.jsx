import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAdminUser, canAccessStudio } from '../lib/access.js'

function RouteFallback() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#08080b',
      color: '#8888a0',
      fontSize: 14,
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      Cargando…
    </div>
  )
}

/**
 * @param {'auth'|'subscription'|'project'} require - nivel de acceso
 */
export default function ProtectedRoute({
  user,
  project,
  subscription,
  authReady,
  subscriptionLoading,
  projectLoading = false,
  require = 'auth',
  children,
}) {
  const location = useLocation()
  const needsSubscriptionCheck = (require === 'subscription' || require === 'project')
    && user
    && !isAdminUser(user)

  if (!authReady || (needsSubscriptionCheck && subscriptionLoading)) {
    return <RouteFallback />
  }

  if (require === 'project' && projectLoading && user && !project) {
    return <RouteFallback />
  }

  if (!user) {
    const redirect = require === 'auth' ? '/auth' : `/auth?next=${encodeURIComponent(location.pathname)}`
    return <Navigate to={redirect} replace state={{ from: location.pathname }} />
  }

  if (require === 'subscription' && !canAccessStudio(user, subscription)) {
    return <Navigate to="/plans" replace />
  }

  if (require === 'project') {
    if (!canAccessStudio(user, subscription)) {
      return <Navigate to="/plans" replace />
    }
    if (!project && !isAdminUser(user)) {
      return <Navigate to="/setup" replace />
    }
  }

  return children
}
