/**
 * InstantReplayControl.jsx
 * Panel Broadcast de Repetición Instantánea / Replay en Vivo (P4.3)
 * 
 * Controles de cabina para disparar repeticiones a cámara lenta (0.25x, 0.5x, 1.0x)
 * con buffer circular de video, indicación de progreso y corte limpio a EN VIVO.
 */

import React, { useState } from 'react';
import { 
  History, 
  Play, 
  Square, 
  RotateCcw, 
  Gauge, 
  Clock, 
  Sparkles,
  Zap,
  Radio
} from 'lucide-react';

export default function InstantReplayControl({
  isReplaying,
  replaySpeed,
  replayDuration,
  replayProgress,
  bufferedSeconds,
  maxBufferSeconds = 30,
  onTriggerReplay,
  onStopReplay,
  onSetReplaySpeed,
  isOpen,
  onClose
}) {
  const [selectedSpeed, setSelectedSpeed] = useState(0.5);

  const handleSpeedChange = (spd) => {
    setSelectedSpeed(spd);
    if (onSetReplaySpeed) onSetReplaySpeed(spd);
  };

  const handleTrigger = (durSec) => {
    if (onTriggerReplay) {
      onTriggerReplay({ durationSec: durSec, speed: selectedSpeed });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 bg-[#0f1118]/95 backdrop-blur-md border border-red-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-4 text-white animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Cabecera del Panel */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222533]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <History size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wide uppercase text-white flex items-center gap-1.5">
              Instant Replay
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 font-bold border border-red-800/50">
                P4.3
              </span>
            </h3>
            <p className="text-[10px] text-gray-400">Repetición en vivo con búfer circular</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md bg-[#1a1d28] hover:bg-[#252a3b] text-gray-400 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Estado del Búfer Circular y Estado al Aire */}
      <div className="my-3 p-2.5 rounded-xl bg-[#141724] border border-[#232738] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-sky-400" />
          <span className="text-[11px] font-semibold text-gray-300">Búfer en Memoria:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-2 bg-[#22273a] rounded-full overflow-hidden">
            <div 
              className="h-full bg-sky-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (bufferedSeconds / maxBufferSeconds) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-black text-sky-300 font-mono">
            {bufferedSeconds}s / {maxBufferSeconds}s
          </span>
        </div>
      </div>

      {/* Monitor de Estado en Tiempo Real (Al Aire / En Replay) */}
      <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
        isReplaying 
          ? 'bg-red-950/60 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' 
          : 'bg-[#121420] border-[#22263a]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isReplaying ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className="text-xs font-black tracking-wider uppercase">
            {isReplaying ? `🔴 REPLAY ACTIVO · ${replaySpeed}x` : '● EMISIÓN EN VIVO'}
          </span>
        </div>
        {isReplaying && (
          <span className="text-xs font-mono font-black text-red-300">
            {Math.round(replayProgress * 100)}%
          </span>
        )}
      </div>

      {/* Barra de Progreso del Clip Activo */}
      {isReplaying && (
        <div className="w-full bg-[#202538] h-1.5 rounded-full overflow-hidden mt-2">
          <div 
            className="bg-red-500 h-full rounded-full transition-all duration-75"
            style={{ width: `${replayProgress * 100}%` }}
          />
        </div>
      )}

      {/* Selector de Velocidad de Reproducción */}
      <div className="mt-3">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Gauge size={12} className="text-amber-400" />
          Velocidad de Repetición:
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: '0.25x', val: 0.25 },
            { label: '0.5x', val: 0.5 },
            { label: '0.75x', val: 0.75 },
            { label: '1.0x', val: 1.0 },
          ].map(spd => (
            <button
              key={spd.val}
              onClick={() => handleSpeedChange(spd.val)}
              className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                selectedSpeed === spd.val
                  ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'bg-[#181b28] hover:bg-[#22273a] text-gray-300 border-[#2a2f42]'
              }`}
            >
              {spd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disparadores de Repetición Rápida por Duración */}
      <div className="mt-3">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Disparar Repetición (Atajo: [R]):</span>
          <span className="text-gray-500 text-[9px] lowercase font-normal">últimos segundos</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: '⏪ 5 Seg', dur: 5 },
            { label: '⏪ 10 Seg', dur: 10 },
            { label: '⏪ 15 Seg', dur: 15 },
          ].map(btn => (
            <button
              key={btn.dur}
              onClick={() => handleTrigger(btn.dur)}
              disabled={bufferedSeconds < 2}
              className={`py-2 px-1 rounded-xl text-xs font-black flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                bufferedSeconds < 2
                  ? 'opacity-40 cursor-not-allowed bg-[#151722] border-[#222] text-gray-500'
                  : 'bg-[#1d2235] hover:bg-red-950/70 text-white border-red-500/30 hover:border-red-500 shadow-sm active:scale-95'
              }`}
            >
              <span>{btn.label}</span>
              <span className="text-[9px] text-red-300 font-mono font-semibold">
                {selectedSpeed}x
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Botón de Retorno Inmediato a VIVO (CUT TO LIVE) */}
      <div className="mt-3 pt-2 border-t border-[#222533]">
        <button
          onClick={onStopReplay}
          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
            isReplaying
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.5)] animate-bounce'
              : 'bg-[#161a29] text-gray-400 border-[#252c42] hover:bg-[#1f253a] hover:text-gray-200'
          }`}
        >
          {isReplaying ? (
            <>
              <Square size={14} className="fill-current" />
              <span>⏹️ VOLVER A VIVO (Live) [R]</span>
            </>
          ) : (
            <>
              <Radio size={14} className="text-emerald-400" />
              <span>AL AIRE · EN VIVO</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
