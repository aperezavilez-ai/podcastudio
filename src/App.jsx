import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Plans from './pages/Plans.jsx'
import Tour from './pages/Tour.jsx'
import ProjectSetup from './pages/ProjectSetup.jsx'
import Studio from './pages/Studio.jsx'
import { PwaInstallBanner, PwaInstallProvider } from './components/PwaInstall.jsx'
import { supabase, mapSupabaseUser, withTimeout } from './lib/supabase.js'
import { redirectToCanonicalDomain } from './lib/site.js'
import { loadProject } from './lib/projects.js'

export default function App() {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    redirectToCanonicalDomain()
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!supabase) {
      const saved = localStorage.getItem('podcastudio_user')
      if (saved) setUser(JSON.parse(saved))
      return
    }

    let cancelled = false

    async function hydrateUser(sessionUser) {
      const u = mapSupabaseUser(sessionUser)
      setUser(u)
      if (u) {
        loadProject(u.id).catch(() => null).then((p) => {
          if (!cancelled && p) setProject(p)
        })
      } else {
        setProject(null)
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
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session?.user)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleAuth = (u) => {
    setUser(u)
    localStorage.setItem('podcastudio_user', JSON.stringify(u))
  }

  const handleProject = (p) => {
    setProject(p)
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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth onAuth={handleAuth} />} />
        <Route path="/tour" element={<Tour user={user} />} />
        <Route path="/plans" element={<Plans user={user} onContinue={() => {}} />} />
        <Route path="/setup" element={<ProjectSetup user={user} onProject={handleProject} />} />
        <Route path="/studio" element={<Studio project={project} user={user} onProjectSave={handleProject} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <PwaInstallBanner />
    </PwaInstallProvider>
  )
}
