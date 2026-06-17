import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'
import Plans from './pages/Plans.jsx'
import ProjectSetup from './pages/ProjectSetup.jsx'
import Studio from './pages/Studio.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth onAuth={setUser} />} />
      <Route path="/plans" element={<Plans user={user} onContinue={() => {}} />} />
      <Route path="/setup" element={<ProjectSetup onProject={setProject} />} />
      <Route path="/studio" element={<Studio project={project} user={user} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
