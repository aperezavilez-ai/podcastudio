import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { migrateServiceWorker } from './lib/pwaMigrate.js'
import { setPwaUpdateHandler, notifyPwaUpdateAvailable } from './lib/pwaUpdate.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './App.jsx'
import './styles/globals.css'

import { redirectToCanonicalDomain } from './lib/site.js'

redirectToCanonicalDomain()

function renderApp() {
  const root = document.getElementById('root')
  if (!root) return
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

function setupPwa() {
  if (!import.meta.env.PROD) return

  migrateServiceWorker().catch(() => {})

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        notifyPwaUpdateAvailable()
        setPwaUpdateHandler(updateSW)
      },
      onRegisteredSW(_url, registration) {
        registration?.update()
      },
    })
  } catch {
    /* SW opcional — la app funciona sin él */
  }
}

renderApp()
setupPwa()
