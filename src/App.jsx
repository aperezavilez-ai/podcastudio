import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Plans from './pages/Plans.jsx'
import Tour from './pages/Tour.jsx'
import ProjectSetup from './pages/ProjectSetup.jsx'
import Studio from './pages/Studio.jsx'
import { PwaInstallBanner, PwaInstallProvider } from './components/PwaInstall.jsx'
import { supabase, mapSupabaseUser, isSupabaseConfigured, withTimeout } from './lib/supabase.js'
import { loadProject } from './lib/projects.js'

const bootStyles = {
  screen: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    background: '#08080b',
    color: '#e8e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'rgba(232,97,42,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e8612a',
    fontSize: 22,
  },
  muted: { color: '#8888a0', fontSize: 14, textAlign: 'center', maxWidth: 320 },
}

function BootScreen({ message }) {
  return (
    <div style={bootStyles.screen}>
      <div style={bootStyles.logo}><i className="ti ti-microphone" /></div>
      <p style={bootStyles.muted}>{message || 'Cargando PodcastStudio…'}</p>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    if (!supabase) {
      const saved = localStorage.getItem('podcastudio_user')
      if (saved) setUser(JSON.parse(saved))
      setAuthReady(true)
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
          8000,
          { data: { session: null } },
        )
        if (!cancelled) {
          await hydrateUser(session?.user)
          setAuthReady(true)
        }
      } catch {
        if (!cancelled) {
          setBootError('No se pudo conectar con el servidor. Revisa tu conexión.')
          setAuthReady(true)
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

  if (!authReady) return <BootScreen />

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
