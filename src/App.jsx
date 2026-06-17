import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Plans from './pages/Plans.jsx'
import ProjectSetup from './pages/ProjectSetup.jsx'
import Studio from './pages/Studio.jsx'
import { supabase, mapSupabaseUser, isSupabaseConfigured } from './lib/supabase.js'
import { loadProject } from './lib/projects.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      const saved = localStorage.getItem('podcastudio_user')
      if (saved) setUser(JSON.parse(saved))
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = mapSupabaseUser(session?.user)
      setUser(u)
      if (u) {
        const p = await loadProject(u.id).catch(() => null)
        if (p) setProject(p)
      }
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = mapSupabaseUser(session?.user)
      setUser(u)
      if (u) {
        const p = await loadProject(u.id).catch(() => null)
        if (p) setProject(p)
      } else {
        setProject(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = (u) => {
    setUser(u)
    localStorage.setItem('podcastudio_user', JSON.stringify(u))
  }

  const handleProject = (p) => {
    setProject(p)
  }

  if (!authReady) return null

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth onAuth={handleAuth} />} />
      <Route path="/plans" element={<Plans user={user} onContinue={() => {}} />} />
      <Route path="/setup" element={<ProjectSetup user={user} onProject={handleProject} />} />
      <Route path="/studio" element={<Studio project={project} user={user} onProjectSave={handleProject} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
