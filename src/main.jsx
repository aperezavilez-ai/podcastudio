import React from 'react'
import ReactDOM from 'react-dom/client'
import { lazy, Suspense } from 'react'
import './index.css'

import App from './App.jsx'
const RemoteCam = lazy(() => import('./pages/RemoteCam.jsx'))
const StudioRemoteControl = lazy(() => import('./pages/StudioRemoteControl.jsx'))

// Detección de entorno Electron Master vs Navegador Móvil/Tablet
const hasElectronApi = typeof window !== 'undefined' && Boolean(window.api);
const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
const search = typeof window !== 'undefined' ? window.location.search.toLowerCase() : '';
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isTouchTabletOrMobile = /ipad|tablet|(android(?!.*mobile))|iphone|ipod/i.test(userAgent) || 
  (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /macintosh/i.test(userAgent));

// 1. Rutas de consola de control remoto profesional para iPad / Tablets
const isStudioRemote = 
  pathname.includes('/control') || 
  pathname.includes('/mando') ||
  search.includes('control') ||
  search.includes('mando') ||
  (!hasElectronApi && isTouchTabletOrMobile && !search.includes('slot=') && !pathname.includes('/camara') && !pathname.includes('/remote-cam'));

// 2. Rutas de captura de cámara remota para celulares
const isRemoteCam = 
  !isStudioRemote && (
    pathname.includes('/remote-cam') || 
    pathname.includes('/camara') ||
    search.includes('slot=') ||
    (search.includes('room=') && !search.includes('master_studio'))
  );

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={(
      <div style={{ height: '100vh', width: '100vw', background: '#0a0a0a', color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#ea580c', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 20 }}>🎙</div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{isRemoteCam ? 'Preparando cámara remota…' : 'Iniciando PodcastStudio…'}</span>
      </div>
    )}>
      {isRemoteCam ? <RemoteCam /> : isStudioRemote ? <StudioRemoteControl /> : <App />}
    </Suspense>
  </React.StrictMode>,
);

if (typeof window !== 'undefined' && window.api?.signalReady) {
  window.api.signalReady();
}
