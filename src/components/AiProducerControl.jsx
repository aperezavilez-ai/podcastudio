import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sliders, Check, Zap, Sparkles, Volume2, Users, AlertCircle } from 'lucide-react';

export default function AiProducerControl({ vadState }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const {
    enabled,
    toggleEnabled,
    sensitivity,
    setSensitivity,
    cooldownSeconds,
    setCooldownSeconds,
    autoWideShot,
    setAutoWideShot,
    currentSpeakerId,
    activeSpeakers,
    isDebate,
    statusText
  } = vadState;

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

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Botón de Activación / Estado de la IA Productora */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer border ${
          enabled
            ? 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 text-purple-200 border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
            : 'bg-[#14151a] hover:bg-[#1c1d24] text-gray-300 border-[#2a2c38]'
        }`}
        title="IA Productora VAD: Conmutador automático de cámaras por detección de voz activa"
      >
        <Bot size={14} className={enabled ? 'text-purple-400 animate-bounce' : 'text-gray-400'} />
        <span>{enabled ? 'IA Director ON' : 'IA Director'}</span>
        {enabled && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        )}
      </button>

      {/* Popover de Configuración y Telemetría VAD */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 rounded-xl bg-[#111217] border border-[#262836] shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Cabecera */}
          <div className="p-3 border-b border-[#20222e] bg-[#161720]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-purple-400" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-200">
                  IA Productora (Auto-Director)
                </h4>
                <p className="text-[10px] text-gray-400">
                  Voice Activity Detection (Fase P1.2)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleEnabled}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                enabled
                  ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                  : 'bg-[#222430] hover:bg-[#2b2e3e] text-gray-300'
              }`}
            >
              {enabled ? 'ACTIVADO' : 'ENCENDER'}
            </button>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {/* Monitor de Estado en Vivo */}
            <div className="p-2.5 rounded-lg bg-[#181924] border border-[#27293a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className={activeSpeakers.length > 0 ? 'text-emerald-400 animate-pulse' : 'text-gray-500'} />
                <span className="text-[11px] text-gray-300 font-medium">
                  {statusText}
                </span>
              </div>
              {isDebate && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">
                  Debate
                </span>
              )}
            </div>

            {/* Ajuste de Sensibilidad Acústica */}
            <div>
              <label className="text-[11px] font-bold text-gray-300 block mb-1">
                Sensibilidad Acústica (Umbral VAD)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'low', label: 'Baja (Voz Alta)' },
                  { id: 'medium', label: 'Media (Estándar)' },
                  { id: 'high', label: 'Alta (Susurros)' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSensitivity(opt.id)}
                    className={`py-1.5 px-2 rounded text-[10px] font-bold transition-all border ${
                      sensitivity === opt.id
                        ? 'bg-purple-950/80 text-purple-200 border-purple-500 shadow-sm'
                        : 'bg-[#181924] text-gray-400 border-[#27293a] hover:bg-[#202230]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tiempo Mínimo de Permanencia de Plano (Cooldown) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-300 mb-1">
                <span>Tiempo Mínimo en Cámara</span>
                <span className="text-purple-400">{cooldownSeconds} segundos</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="6"
                step="0.5"
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#202230] rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                <span>Rápido (1.5s)</span>
                <span>Moderado (3s)</span>
                <span>Calmado (6s)</span>
              </div>
            </div>

            {/* Switch: Cambiar a Plano General / Galería en Debate */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#181924] border border-[#27293a]">
              <div>
                <span className="text-[11px] font-bold text-gray-200 block">
                  Plano General en Cruce de Palabras
                </span>
                <span className="text-[10px] text-gray-400">
                  Si 2 o más hablan a la vez, conmuta a Two-Shot o Cuadrícula.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoWideShot(prev => !prev)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  autoWideShot ? 'bg-purple-600' : 'bg-gray-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoWideShot ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="p-2.5 bg-[#0d0e13] border-t border-[#1f212c] text-[10px] text-gray-400 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-400 shrink-0" />
            <span>El director humano siempre tiene prioridad sobre la IA pulsando CUT o seleccionando una cámara.</span>
          </div>
        </div>
      )}
    </div>
  );
}
