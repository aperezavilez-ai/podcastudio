import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import RemoteCam from './pages/RemoteCam.jsx'
import './index.css'

// Rutas de captura de cámara remota para celulares
const isRemoteCam = 
  typeof window !== 'undefined' && (
    window.location.pathname.includes('/remote-cam') || 
    window.location.pathname.includes('/camara') ||
    window.location.search.includes('slot=') ||
    (window.location.search.includes('room=') && !window.location.pathname.includes('/control'))
  );

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isRemoteCam ? <RemoteCam /> : <App />}
  </React.StrictMode>,
);

if (typeof window !== 'undefined' && window.api?.signalReady) {
  window.api.signalReady();
}
