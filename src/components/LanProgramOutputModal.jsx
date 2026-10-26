/**
 * LanProgramOutputModal.jsx
 * Modal de Salida LAN Program & Enrutamiento Virtual para OBS y vMix (P4.4)
 * 
 * Expone la señal limpia 1080p60 del Master Program (PGM) a través de la red local
 * para su ingesta directa en OBS Studio (Browser Source), vMix o monitores de retorno.
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Tv, 
  Copy, 
  Check, 
  ExternalLink, 
  Cast, 
  Monitor, 
  Wifi, 
  ShieldCheck,
  Radio
} from 'lucide-react';

export default function LanProgramOutputModal({
  open,
  onClose,
  lanFeedUrl,
  activeCam = 1,
  layoutMode = '1'
}) {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [statusData, setStatusData] = useState(null);

  const fallbackUrl = lanFeedUrl || `http://${window.location.hostname || '192.168.1.100'}:3001/program/feed`;

  useEffect(() => {
    if (open && fallbackUrl) {
      QRCode.toDataURL(fallbackUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(url => setQrCodeDataUrl(url)).catch(() => {});
    }
  }, [open, fallbackUrl]);

  useEffect(() => {
    if (!open) return;
    const fetchStatus = async () => {
      try {
        if (window.api?.getProgramStatus) {
          const res = await window.api.getProgramStatus();
          setStatusData(res);
        } else {
          const res = await fetch(`http://${window.location.hostname || 'localhost'}:3001/program/status`);
          const json = await res.json();
          setStatusData(json);
        }
      } catch (e) {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fallbackUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleOpenBrowser = () => {
    if (window.api?.openExternal) {
      window.api.openExternal(fallbackUrl);
    } else {
      window.open(fallbackUrl, '_blank');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#0e1017] border border-[#262c42] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white">
        
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-[#1f2436] flex items-center justify-between bg-[#121520]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
              <Tv size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                SALIDA LAN PROGRAM & VIRTUAL FEED
                <span className="text-[10px] px-2 py-0.5 rounded font-black bg-purple-900/60 text-purple-300 border border-purple-500/40">
                  FASE P4.4
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                Señal limpia 1080p para OBS Studio, vMix, pantallas inteligentes o retorno en LAN
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1a1e2e] hover:bg-[#252b40] text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Tarjeta de Enlace LAN con Copiado Rápido */}
          <div className="p-4 rounded-xl bg-[#141724] border border-[#252b40] space-y-2.5">
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi size={13} className="text-purple-400" />
              Dirección Web de la Señal Master (LAN):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fallbackUrl}
                className="flex-1 bg-[#090b12] border border-[#2a3148] rounded-lg px-3 py-2 text-xs font-mono text-purple-300 select-all outline-none"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                    : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
              <button
                onClick={handleOpenBrowser}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-[#1d2235] hover:bg-[#282f49] text-gray-200 border border-[#333b58] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir en pestaña de navegador"
              >
                <ExternalLink size={14} />
                <span>Abrir</span>
              </button>
            </div>
          </div>

          {/* Telemetría y Código QR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Panel de Telemetría */}
            <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222738] space-y-2.5">
              <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Monitor size={14} className="text-sky-400" />
                Telemetría de la Señal
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1c2133] text-gray-400">
                  <span>Resolución:</span>
                  <span className="font-mono font-bold text-white">1920 × 1080 (Full HD)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1c2133] text-gray-400">
                  <span>Frecuencia de Cuadro:</span>
                  <span className="font-mono font-bold text-emerald-400">60 FPS</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1c2133] text-gray-400">
                  <span>Cámara PGM Activa:</span>
                  <span className="font-mono font-bold text-red-400">CAM {activeCam}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1c2133] text-gray-400">
                  <span>Layout en Emisión:</span>
                  <span className="font-mono font-bold text-amber-400">{layoutMode}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-400">
                  <span>Clientes Conectados en LAN:</span>
                  <span className="font-mono font-bold text-purple-400">
                    {statusData?.feedClients || 0} pantalla(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Código QR para Móvil, Tablet o Smart TV */}
            <div className="p-3.5 rounded-xl bg-[#131622] border border-[#222738] flex flex-col items-center justify-center text-center">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code Salida LAN"
                  className="w-32 h-32 rounded-lg border border-white/20 p-1 bg-white shadow-md mb-2"
                />
              ) : (
                <div className="w-32 h-32 rounded-lg bg-gray-800 flex items-center justify-center text-gray-500 mb-2">
                  Cargando QR...
                </div>
              )}
              <span className="text-[10px] text-gray-400 font-bold">
                Escanear con iPad, Smart TV o móvil
              </span>
            </div>
          </div>

          {/* Guía Rápida de Configuración Broadcast */}
          <div className="p-3.5 rounded-xl bg-[#11131e] border border-[#1f2436] space-y-2">
            <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Guía de Conexión en 1 Clic
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-gray-400">
              <div className="p-2.5 rounded-lg bg-[#161a29] border border-[#23293e]">
                <div className="font-bold text-purple-300 mb-1 flex items-center gap-1">
                  <Cast size={12} /> OBS Studio
                </div>
                <p>1. Añadir fuente: <b>Navegador</b></p>
                <p>2. Pegar la URL de arriba</p>
                <p>3. Ancho: <b>1920</b>, Alto: <b>1080</b></p>
                <p>4. FPS: <b>60</b></p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#161a29] border border-[#23293e]">
                <div className="font-bold text-sky-300 mb-1 flex items-center gap-1">
                  <Monitor size={12} /> vMix Broadcast
                </div>
                <p>1. Añadir entrada: <b>Web Browser</b></p>
                <p>2. Pegar la URL de la señal</p>
                <p>3. Resolución: <b>1080p</b></p>
                <p>4. Asignar como Overlay o Input</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#161a29] border border-[#23293e]">
                <div className="font-bold text-amber-300 mb-1 flex items-center gap-1">
                  <Tv size={12} /> Monitor Retorno / TV
                </div>
                <p>1. Abrir navegador en Smart TV</p>
                <p>2. Navegar a la URL de red local</p>
                <p>3. Presionar F11 / Pantalla Completa</p>
                <p>4. Imagen limpia sin controles</p>
              </div>
            </div>
          </div>

        </div>

        {/* Pie del Modal */}
        <div className="p-3.5 border-t border-[#1f2436] bg-[#121520] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Radio size={13} className="text-emerald-400 animate-pulse" />
            <span>Servidor HTTP activo en puerto <span className="font-mono text-white font-bold">3001</span></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#1f2436] hover:bg-[#2b334d] text-white transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
