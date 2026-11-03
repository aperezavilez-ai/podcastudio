import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import App from './App.jsx'
import RemoteCam from './pages/RemoteCam.jsx'
import StudioRemoteControl from './pages/StudioRemoteControl.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// DetecciÃ³n de entorno Electron Master vs Navegador MÃ³vil/Tablet
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

// 2. Rutas de captura de cÃ¡mara remota para celulares
const isRemoteCam = 
  !isStudioRemote && (
    pathname.includes('/remote-cam') || 
    pathname.includes('/camara') ||
    search.includes('slot=') || 
    (search.includes('room=') && !search.includes('master_studio'))
  );

function sendSignalReady() {
  if (typeof window !== 'undefined' && window.api?.signalReady) {
    try {
      window.api.signalReady();
      console.log('[Main.jsx] signalReady sent');
    } catch (e) {
      console.warn('[Main.jsx] signalReady failed:', e);
    }
  }
}

function ensureSignalReady() {
  sendSignalReady();
  const interval = setInterval(() => {
    if (typeof window !== 'undefined' && window.api?.signalReady) {
      sendSignalReady();
    } else {
      clearInterval(interval);
    }
  }, 500);
  setTimeout(() => clearInterval(interval), 10000);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isRemoteCam ? <RemoteCam /> : isStudioRemote ? <StudioRemoteControl /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);

// Notificar a Electron que la UI estÃ¡ 100% montada
if (typeof window !== 'undefined') {
  sendSignalReady();
  requestAnimationFrame(sendSignalReady);
  ensureSignalReady();
}

window.addEventListener('error', (e) => {
  console.error('[Main.jsx] Uncaught error:', e.error || e.message);
  sendSignalReady();
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Main.jsx] Unhandled rejection:', e.reason);
  sendSignalReady();
});
