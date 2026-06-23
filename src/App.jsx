import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { PwaInstallBanner, PwaInstallProvider } from './components/PwaInstall.jsx'
import { supabase, mapSupabaseUser, withTimeout } from './lib/supabase.js'
import { redirectToCanonicalDomain } from './lib/site.js'
import { loadProject } from './lib/projects.js'
import { fetchSubscription } from './lib/billing.js'

const Plans = lazy(() => import('./pages/Plans.jsx'))
const Tour = lazy(() => import('./pages/Tour.jsx'))
const Manual = lazy(() => import('./pages/Manual.jsx'))
const ProjectSetup = lazy(() => import('./pages/ProjectSetup.jsx'))
const Studio = lazy(() => import('./pages/Studio.jsx'))

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

export default function App() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [projectLoading, setProjectLoading] = useState(false)
  const [authReady, setAuthReady] = useState(!supabase)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    redirectToCanonicalDomain()
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!supabase) {
      try {
        const saved = localStorage.getItem('podcastudio_user')
        if (saved) setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('podcastudio_user')
      }
      setAuthReady(true)
      return
    }

    let cancelled = false

    async function hydrateUser(sessionUser) {
      const u = mapSupabaseUser(sessionUser)
      setUser(u)
      if (u) {
        setProjectLoading(true)
        loadProject(u.id).catch(() => null).then((p) => {
          if (!cancelled && p) setProject(p)
        }).finally(() => {
          if (!cancelled) setProjectLoading(false)
        })
      } else {
        setProject(null)
        setSubscription(null)
        setProjectLoading(false)
      }
    }

    async function initAuth() {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          4000,
          { data: { session: null } },
        )
        if (!cancelled) await hydrateUser(session?.user)
      } catch {
        if (!cancelled) {
          setBootError('No se pudo conectar con el servidor. Revisa tu conexión.')
        }
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }

    initAuth()

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session?.user)
    })

    return () => {
      cancelled = true
      authSub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setSubscription(null)
      setSubscriptionLoading(false)
      return undefined
    }
    let cancelled = false
    setSubscriptionLoading(true)
    fetchSubscription()
      .then((sub) => { if (!cancelled) setSubscription(sub) })
      .finally(() => { if (!cancelled) setSubscriptionLoading(false) })
    return () => { cancelled = true }
  }, [user?.id])

  const handleAuth = (u) => {
    setUser(u)
    localStorage.setItem('podcastudio_user', JSON.stringify(u))
  }

  const handleProject = (p) => {
    setProject(p)
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setProject(null)
    setSubscription(null)
    localStorage.removeItem('podcastudio_user')
  }

  return (
    <PwaInstallProvider>
      {bootError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          padding: '10px 16px', background: '#3a1a1a', color: '#ffb4b4',
          fontSize: 13, textAlign: 'center',
          paddingTop: 'max(10px, env(safe-area-inset-top))',
        }}>
          {bootError}
        </div>
      )}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing user={user} />} />
          <Route path="/auth" element={<Auth onAuth={handleAuth} />} />
          <Route path="/tour" element={<Tour user={user} />} />
          <Route path="/guia" element={<Manual />} />
          <Route
            path="/plans"
            element={(
              <ProtectedRoute user={user} authReady={authReady} require="auth">
                <Plans user={user} subscription={subscription} onContinue={() => {}} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/setup"
            element={(
              <ProtectedRoute
                user={user}
                subscription={subscription}
                authReady={authReady}
                subscriptionLoading={subscriptionLoading}
                require="subscription"
              >
                <ProjectSetup user={user} onProject={handleProject} />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/studio"
            element={(
              <ProtectedRoute
                user={user}
                project={project}
                subscription={subscription}
                authReady={authReady}
                subscriptionLoading={subscriptionLoading}
                projectLoading={projectLoading}
                require="project"
              >
                <Studio
                  project={project}
                  user={user}
                  subscription={subscription}
                  onProjectSave={handleProject}
                  onSignOut={handleSignOut}
                />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      <PwaInstallBanner />
    </PwaInstallProvider>
  )
}
