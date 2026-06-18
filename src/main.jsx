import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { redirectToCanonicalDomain } from './lib/site.js'
import App from './App.jsx'
import './styles/globals.css'

const leavingForCanonical = redirectToCanonicalDomain()

if (!leavingForCanonical) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        registration?.update()
      },
    })
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}
