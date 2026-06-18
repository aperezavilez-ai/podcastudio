import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { migrateServiceWorker } from './lib/pwaMigrate.js'
import { setPwaUpdateHandler, notifyPwaUpdateAvailable } from './lib/pwaUpdate.js'
import App from './App.jsx'
import './styles/globals.css'

async function boot() {
  if (import.meta.env.PROD) {
    await migrateServiceWorker()
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
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

boot()
