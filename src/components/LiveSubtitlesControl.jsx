import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Globe, Check, Eye, EyeOff, Sparkles, Trash2 } from 'lucide-react';

export default function LiveSubtitlesControl({ subtitlesState }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const {
    isSupported,
    active,
    toggleSubtitles,
    currentText,
    language,
    setLanguage,
    recentTranscripts,
    burnInVideo,
    setBurnInVideo
  } = subtitlesState;

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón en barra superior */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer border ${
          active
            ? 'bg-blue-950/80 text-blue-200 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.35)]'
            : 'bg-[#14151a] hover:bg-[#1c1d24] text-gray-300 border-[#2a2c38]'
        }`}
        title="Subtítulos en Vivo (Closed / Open Captions): Transcripción local y quemado opcional en video"
      >
        <MessageSquare size={14} className={active ? 'text-blue-400 animate-pulse' : 'text-gray-400'} />
        <span>{active ? 'Subtítulos ON' : 'Subtítulos'}</span>
        {active && (
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
        )}
      </button>

      {/* Popover de Configuración y Transcripción */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 rounded-xl bg-[#111217] border border-[#262836] shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-[#20222e] bg-[#161720]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-400" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-200">
                  Subtítulos en Vivo (Captions)
                </h4>
                <p className="text-[10px] text-gray-400">
                  Transcripción Local (Fase P1.3)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSubtitles}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'bg-[#222430] hover:bg-[#2b2e3e] text-gray-300'
              }`}
            >
              {active ? 'DETENER' : 'ACTIVAR'}
            </button>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {/* Monitor de texto en vivo */}
            <div className="p-2.5 rounded-lg bg-[#181924] border border-[#27293a]">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Texto en Tiempo Real
              </span>
              <p className="text-xs text-blue-200 italic min-h-[36px] bg-[#101118] p-2 rounded border border-[#1f212c]">
                {currentText || (active ? 'Habla al micrófono para transcribir...' : 'Subtítulos inactivos')}
              </p>
            </div>

            {/* Selector de Idioma */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                <Globe size={13} className="text-gray-400" /> Idioma
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-[#181924] border border-[#27293a] text-gray-200 text-xs rounded px-2 py-1 font-semibold outline-none cursor-pointer"
              >
                <option value="es-MX">Español (México / LATAM)</option>
                <option value="es-ES">Español (España)</option>
                <option value="en-US">English (United States)</option>
                <option value="pt-BR">Português (Brasil)</option>
              </select>
            </div>

            {/* Opción de Quemar en Video PGM */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#181924] border border-[#27293a]">
              <div>
                <span className="text-[11px] font-bold text-gray-200 block">
                  Quemar en Salida PGM (Open Captions)
                </span>
                <span className="text-[10px] text-gray-400">
                  Grabar los subtítulos en el video MP4 y emitirlos en el streaming.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBurnInVideo(prev => !prev)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  burnInVideo ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${burnInVideo ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Historial reciente */}
            {recentTranscripts.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Bitácora Reciente ({recentTranscripts.length})
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-[#101118] p-2 rounded border border-[#1f212c] text-[11px]">
                  {recentTranscripts.slice(0, 5).map(item => (
                    <div key={item.id} className="text-gray-300">
                      <span className="text-gray-500 text-[10px] mr-1.5">{item.time}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-2.5 bg-[#0d0e13] border-t border-[#1f212c] text-[10px] text-gray-400 text-center">
            Procesamiento por Web Speech API local: 100% privado y sin enviar audio a servidores externos.
          </div>
        </div>
      )}
    </div>
  );
}
