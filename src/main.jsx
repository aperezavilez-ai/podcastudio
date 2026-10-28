import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RemoteCam from './pages/RemoteCam.jsx'
import StudioRemoteControl from './pages/StudioRemoteControl.jsx'
import './index.css'

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
    {isRemoteCam ? <RemoteCam /> : isStudioRemote ? <StudioRemoteControl /> : <App />}
  </React.StrictMode>,
);

if (typeof window !== 'undefined' && window.api?.signalReady) {
  window.api.signalReady();
}
