import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Sliders,
  Radio,
  Music,
  Zap,
  Headphones,
  X,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import {
  getAudioMixerTelemetry,
  setChannelFader,
  setChannelGain,
  setChannelMute,
  setChannelSolo,
  setMasterVolume,
  setMonitorVolume,
  setBgmVolume,
  setChannelNoiseSuppression
} from '../utils/masterBroadcastEngine.js';

/**
 * Convierta nivel RMS/pico (0 a 1) a porcentaje de visualización de vúmetro en dB
 * -48dB = 0%, -18dB = ~50%, -6dB = ~80%, 0dB = 95%, +3dB = 100%
 */
function levelToMeterPercent(rawLevel) {
  if (!rawLevel || rawLevel <= 0.002) return 0;
  const db = 20 * Math.log10(rawLevel);
  if (db <= -48) return 0;
  if (db >= 3) return 100;
  return Math.min(100, Math.max(0, ((db + 48) / 51) * 100));
}

export default function AudioMixerDesk({ isOpen, onClose, camSlots = [] }) {
  const [channelsState, setChannelsState] = useState({});
  const [masterFader, setMasterFader] = useState(1.0);
  const [monitorFader, setMonitorFader] = useState(1.0);
  const [bgmFader, setBgmFader] = useState(0.5);
  const [sfxFader, setSfxFader] = useState(0.9);
  const [isExpanded, setIsExpanded] = useState(false);

  // Referencias DOM para barras VU directas a 60 FPS sin saturar re-renders React
  const meterRefs = useRef({});
  const peakTextRefs = useRef({});
  const animRef = useRef(null);

  // Sincronizar estado inicial con canales de las cámaras y telemetría
  useEffect(() => {
    if (!isOpen) return;

    const initial = {};
    // Canales de cámaras estándar
    camSlots.forEach((slot, index) => {
      const camId = index + 1;
      const key = `cam_${camId}`;
      initial[key] = {
        id: key,
        label: camId === 1 ? 'CAM 1 (Master / Host)' : `CAM ${camId}`,
        fader: 1.0,
        gainDb: 0,
        muted: Boolean(slot.muted),
        solo: false,
      };
    });

    // Canales existentes en el motor
    const telem = getAudioMixerTelemetry();
    if (telem && telem.channels) {
      const chList = Array.isArray(telem.channels)
        ? telem.channels
        : Object.values(telem.channels);
      chList.forEach(ch => {
        if (!initial[ch.id]) {
          initial[ch.id] = {
            id: ch.id,
            label: ch.label || ch.id,
            fader: ch.fader ?? 1.0,
            gainDb: ch.gainDb ?? 0,
            muted: Boolean(ch.isMuted),
            solo: Boolean(ch.isSolo),
          };
        } else {
          initial[ch.id].fader = ch.fader ?? initial[ch.id].fader;
          initial[ch.id].gainDb = ch.gainDb ?? initial[ch.id].gainDb;
          initial[ch.id].muted = Boolean(ch.isMuted);
          initial[ch.id].solo = Boolean(ch.isSolo);
        }
      });
    }

    setChannelsState(initial);
  }, [isOpen, camSlots]);

  // Bucle de telemetría a 60 FPS para vúmetros ultra fluidos
  useEffect(() => {
    if (!isOpen) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const updateMeters = () => {
      const telem = getAudioMixerTelemetry();
      if (telem) {
        // Canales individuales
        if (telem.channels) {
          const chList = Array.isArray(telem.channels)
            ? telem.channels
            : Object.values(telem.channels);
          chList.forEach(ch => {
            const el = meterRefs.current[ch.id];
            if (el) {
              const peakVal = ch.meter?.peak != null 
                ? (ch.meter.peak / 100) 
                : (ch.peakLevel ?? 0);
              const pct = levelToMeterPercent(peakVal);
              el.style.height = `${pct}%`;
              if (pct > 92) {
                el.style.backgroundColor = '#ef4444'; // Red Clip
              } else if (pct > 72) {
                el.style.backgroundColor = '#eab308'; // Yellow Warm
              } else {
                el.style.backgroundColor = '#22c55e'; // Green Normal
              }
            }
          });
        }

        // BGM meter
        const bgmEl = meterRefs.current['bgm_meter'];
        if (bgmEl) {
          const bgmPeak = telem.bgm?.peak != null ? (telem.bgm.peak / 100) : (telem.bgmLevel ?? 0);
          const pct = levelToMeterPercent(bgmPeak);
          bgmEl.style.height = `${pct}%`;
          bgmEl.style.backgroundColor = pct > 85 ? '#eab308' : '#38bdf8';
        }

        // SFX meter
        const sfxEl = meterRefs.current['sfx_meter'];
        if (sfxEl) {
          const sfxPeak = telem.sfx?.peak != null ? (telem.sfx.peak / 100) : (telem.sfxLevel ?? 0);
          const pct = levelToMeterPercent(sfxPeak);
          sfxEl.style.height = `${pct}%`;
          sfxEl.style.backgroundColor = pct > 90 ? '#ef4444' : '#a855f7';
        }

        // Master PGM meter
        const masterEl = meterRefs.current['master_meter'];
        if (masterEl) {
          const masterPeak = telem.master?.peak != null ? (telem.master.peak / 100) : (telem.masterPeak ?? 0);
          const pct = levelToMeterPercent(masterPeak);
          masterEl.style.height = `${pct}%`;
          if (pct > 92) {
            masterEl.style.backgroundColor = '#ef4444';
          } else if (pct > 74) {
            masterEl.style.backgroundColor = '#f59e0b';
          } else {
            masterEl.style.backgroundColor = '#10b981';
          }

          const txt = peakTextRefs.current['master_txt'];
          if (txt) {
            const db = masterPeak > 0.002 ? (20 * Math.log10(masterPeak)).toFixed(1) : '-inf';
            txt.innerText = `${db} dB`;
          }
        }
      }
      animRef.current = requestAnimationFrame(updateMeters);
    };

    animRef.current = requestAnimationFrame(updateMeters);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Acciones en canal
  const handleFaderChange = (chId, val) => {
    setChannelsState(prev => ({
      ...prev,
      [chId]: { ...prev[chId], fader: val }
    }));
    setChannelFader(chId, val);
  };

  const handleGainChange = (chId, db) => {
    setChannelsState(prev => ({
      ...prev,
      [chId]: { ...prev[chId], gainDb: db }
    }));
    setChannelGain(chId, db);
  };

  const handleToggleMute = (chId) => {
    setChannelsState(prev => {
      const nextMute = !prev[chId]?.muted;
      setChannelMute(chId, nextMute);
      return {
        ...prev,
        [chId]: { ...prev[chId], muted: nextMute }
      };
    });
  };

  const handleToggleSolo = (chId) => {
    setChannelsState(prev => {
      const nextSolo = !prev[chId]?.solo;
      setChannelSolo(chId, nextSolo);
      return {
        ...prev,
        [chId]: { ...prev[chId], solo: nextSolo }
      };
    });
  };

  const handleMasterChange = (val) => {
    setMasterFader(val);
    setMasterVolume(val);
  };

  const handleMonitorChange = (val) => {
    setMonitorFader(val);
    setMonitorVolume(val);
  };

  const handleBgmFader = (val) => {
    setBgmFader(val);
    setBgmVolume(val * 100);
  };

  const resetAllPots = () => {
    Object.keys(channelsState).forEach(id => {
      setChannelFader(id, 1.0);
      setChannelGain(id, 0);
      setChannelMute(id, false);
      setChannelSolo(id, false);
    });
    setMasterFader(1.0);
    setMasterVolume(1.0);
    setMonitorFader(1.0);
    setMonitorVolume(1.0);
    setBgmFader(0.5);
    setBgmVolume(50);
  };

  const handleToggleNoiseSuppression = (id) => {
    setChannelsState(prev => {
      const current = prev[id];
      if (!current) return prev;
      const nextVal = !current.noiseSuppression;
      setChannelNoiseSuppression(id, nextVal);
      return {
        ...prev,
        [id]: { ...current, noiseSuppression: nextVal }
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className={`bg-[#101216] border border-[#262934] rounded-xl flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
        isExpanded ? 'w-[98vw] h-[95vh]' : 'w-[94vw] max-w-6xl h-[84vh] max-h-[820px]'
      }`}>
        {/* HEADER DE LA CONSOLA DE AUDIO */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#222530] bg-[#141720]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Sliders size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-wider uppercase text-white">Consola de Audio Broadcast</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded uppercase tracking-wider">
                  48 kHz · 24-bit DSP
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Mezclador profesional multicanal con limitador brickwall y enrutamiento a Program & Monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetAllPots}
              title="Restablecer Faders a 0 dB (Unity)"
              className="p-1.5 px-3 rounded-lg bg-[#1a1d26] hover:bg-[#252936] text-gray-300 hover:text-white text-xs flex items-center gap-1.5 border border-[#2a2e3d] transition-colors"
            >
              <RotateCcw size={13} /> Unity Reset
            </button>
            <button
              onClick={() => setIsExpanded(p => !p)}
              className="p-2 rounded-lg bg-[#1a1d26] hover:bg-[#252936] text-gray-300 hover:text-white border border-[#2a2e3d] transition-colors"
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#2a1717] hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* CUERPO DEL MEZCLADOR: CHANNEL STRIPS Y BUSES MAESTROS */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 flex gap-3 bg-[#0c0d12]">
          {/* SECCIÓN 1: CANALES DE MICRÓFONOS Y CÁMARAS */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 pr-3 border-r border-[#1f2330]">
            {Object.values(channelsState).map((ch, idx) => {
              const isMasterMic = ch.id === 'cam_1';
              return (
                <div
                  key={ch.id}
                  className={`w-28 flex flex-col items-center bg-[#141620] border rounded-lg p-2.5 shadow-md select-none transition-colors ${
                    ch.solo ? 'border-amber-400 ring-1 ring-amber-400/40 bg-[#191924]' : ch.muted ? 'border-red-900/50 opacity-70' : 'border-[#232736]'
                  }`}
                >
                  {/* Badge de canal */}
                  <div className="w-full text-center mb-2">
                    <span className={`inline-block w-full truncate px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                      isMasterMic ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-[#1e2230] text-gray-300 border border-[#2c3144]'
                    }`}>
                      {ch.label}
                    </span>
                  </div>

                  {/* Perilla de Ganancia (Trim dB) */}
                  <div className="w-full flex flex-col items-center mb-3">
                    <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Trim Gain</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="range"
                        min="-24"
                        max="18"
                        step="1"
                        value={ch.gainDb || 0}
                        onChange={(e) => handleGainChange(ch.id, parseFloat(e.target.value))}
                        className="w-16 accent-amber-500 h-1 bg-[#222634] rounded-lg cursor-pointer"
                      />
                      <span className="text-[9px] font-mono text-amber-400 w-7 text-right">
                        {(ch.gainDb || 0) > 0 ? `+${ch.gainDb}` : ch.gainDb || 0}dB
                      </span>
                    </div>
                  </div>

                  {/* Fader Vertical con Vúmetro Estéreo al lado */}
                  <div className="flex-1 w-full flex items-center justify-center gap-2.5 my-1 min-h-[220px]">
                    {/* Fader slider */}
                    <div className="relative flex flex-col items-center h-full justify-center">
                      <div className="h-48 flex items-center">
                        <input
                          type="range"
                          orient="vertical"
                          min="0"
                          max="1.3"
                          step="0.01"
                          value={ch.fader ?? 1.0}
                          onChange={(e) => handleFaderChange(ch.id, parseFloat(e.target.value))}
                          className="h-44 w-7 cursor-pointer accent-amber-500 bg-[#1b1f2b] rounded appearance-none"
                          style={{ WebkitAppearance: 'slider-vertical' }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-gray-400 mt-1">
                        {ch.fader ? (ch.fader === 0 ? '-inf' : `${((ch.fader - 1.0) * 12).toFixed(1)}dB`) : '0dB'}
                      </span>
                    </div>

                    {/* Barra de Vúmetro Peak */}
                    <div className="h-44 w-3.5 bg-[#0d0e14] border border-[#222533] rounded-sm p-[1px] flex flex-col justify-end overflow-hidden relative">
                      {/* Gradiente de marcas */}
                      <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-25">
                        <div className="w-full h-[1px] bg-red-500" />
                        <div className="w-full h-[1px] bg-yellow-400" />
                        <div className="w-full h-[1px] bg-green-400" />
                        <div className="w-full h-[1px] bg-green-400" />
                      </div>
                      <div
                        ref={el => meterRefs.current[ch.id] = el}
                        className="w-full bg-emerald-500 rounded-sm transition-all duration-75"
                        style={{ height: '0%' }}
                      />
                    </div>
                  </div>

                  {/* Botones MUTE y SOLO */}
                  <div className="w-full grid grid-cols-2 gap-1.5 mt-2">
                    <button
                      onClick={() => handleToggleMute(ch.id)}
                      className={`py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-colors border ${
                        ch.muted
                          ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                          : 'bg-[#1d212d] border-[#292e40] text-gray-400 hover:text-white'
                      }`}
                    >
                      Mute
                    </button>
                    <button
                      onClick={() => handleToggleSolo(ch.id)}
                      className={`py-1 text-[10px] font-bold rounded uppercase tracking-wider transition-colors border ${
                        ch.solo
                          ? 'bg-amber-400 border-amber-300 text-black shadow-lg shadow-amber-400/40 font-black'
                          : 'bg-[#1d212d] border-[#292e40] text-gray-400 hover:text-white'
                      }`}
                    >
                      Solo
                    </button>
                  </div>

                  {/* Botón Filtro Anti-Ruido DSP (80Hz + Noise Gate) (P4.2) */}
                  <button
                    onClick={() => handleToggleNoiseSuppression(ch.id)}
                    className={`w-full mt-1.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider transition-colors border flex items-center justify-center gap-1 ${
                      ch.noiseSuppression
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                        : 'bg-[#181a24] border-[#262a38] text-gray-400 hover:text-white'
                    }`}
                    title="Activar Filtro Paso Alto 80Hz + Puerta de Ruido Dinámica (Noise Gate)"
                  >
                    <ShieldCheck size={11} className={ch.noiseSuppression ? 'text-cyan-400' : 'text-gray-500'} />
                    <span>DSP Anti-Ruido</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* SECCIÓN 2: BUSES AUXILIARES (BGM Y SFX) */}
          <div className="flex gap-2.5 px-3 border-r border-[#1f2330]">
            {/* Tira BGM (Música de fondo) */}
            <div className="w-28 flex flex-col items-center bg-[#131622] border border-[#222636] rounded-lg p-2.5 shadow-md select-none">
              <div className="w-full text-center mb-3">
                <span className="inline-flex items-center justify-center gap-1 w-full truncate px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  <Music size={11} /> BGM Music
                </span>
              </div>

              <div className="w-full text-center text-[10px] text-gray-400 font-mono mb-2">
                Auto-Duck: <span className="text-emerald-400 font-bold">Activo</span>
              </div>

              {/* Fader BGM */}
              <div className="flex-1 w-full flex items-center justify-center gap-2.5 min-h-[220px]">
                <div className="relative flex flex-col items-center h-full justify-center">
                  <div className="h-48 flex items-center">
                    <input
                      type="range"
                      orient="vertical"
                      min="0"
                      max="1.2"
                      step="0.01"
                      value={bgmFader}
                      onChange={(e) => handleBgmFader(parseFloat(e.target.value))}
                      className="h-44 w-7 cursor-pointer accent-sky-400 bg-[#1b1f2b] rounded appearance-none"
                      style={{ WebkitAppearance: 'slider-vertical' }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 mt-1">
                    {Math.round(bgmFader * 100)}%
                  </span>
                </div>

                {/* Vúmetro BGM */}
                <div className="h-44 w-3.5 bg-[#0d0e14] border border-[#222533] rounded-sm p-[1px] flex flex-col justify-end overflow-hidden">
                  <div
                    ref={el => meterRefs.current['bgm_meter'] = el}
                    className="w-full bg-sky-400 rounded-sm transition-all duration-75"
                    style={{ height: '0%' }}
                  />
                </div>
              </div>

              <button
                onClick={() => handleBgmFader(bgmFader > 0 ? 0 : 0.5)}
                className={`w-full py-1.5 mt-2 text-[10px] font-bold rounded uppercase tracking-wider border transition-colors ${
                  bgmFader === 0 ? 'bg-red-600 border-red-500 text-white' : 'bg-[#1d212d] border-[#292e40] text-gray-300'
                }`}
              >
                {bgmFader === 0 ? 'BGM Muted' : 'Mute BGM'}
              </button>
            </div>

            {/* Tira SFX (Efectos de sonido) */}
            <div className="w-28 flex flex-col items-center bg-[#151322] border border-[#28223c] rounded-lg p-2.5 shadow-md select-none">
              <div className="w-full text-center mb-3">
                <span className="inline-flex items-center justify-center gap-1 w-full truncate px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <Zap size={11} /> SFX FX
                </span>
              </div>

              <div className="w-full text-center text-[10px] text-gray-400 font-mono mb-2">
                Búfer: <span className="text-purple-400 font-bold">In-Memory</span>
              </div>

              {/* Fader SFX */}
              <div className="flex-1 w-full flex items-center justify-center gap-2.5 min-h-[220px]">
                <div className="relative flex flex-col items-center h-full justify-center">
                  <div className="h-48 flex items-center">
                    <input
                      type="range"
                      orient="vertical"
                      min="0"
                      max="1.2"
                      step="0.01"
                      value={sfxFader}
                      onChange={(e) => setSfxFader(parseFloat(e.target.value))}
                      className="h-44 w-7 cursor-pointer accent-purple-400 bg-[#1b1f2b] rounded appearance-none"
                      style={{ WebkitAppearance: 'slider-vertical' }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 mt-1">
                    {Math.round(sfxFader * 100)}%
                  </span>
                </div>

                {/* Vúmetro SFX */}
                <div className="h-44 w-3.5 bg-[#0d0e14] border border-[#222533] rounded-sm p-[1px] flex flex-col justify-end overflow-hidden">
                  <div
                    ref={el => meterRefs.current['sfx_meter'] = el}
                    className="w-full bg-purple-400 rounded-sm transition-all duration-75"
                    style={{ height: '0%' }}
                  />
                </div>
              </div>

              <button
                onClick={() => setSfxFader(sfxFader > 0 ? 0 : 0.9)}
                className={`w-full py-1.5 mt-2 text-[10px] font-bold rounded uppercase tracking-wider border transition-colors ${
                  sfxFader === 0 ? 'bg-red-600 border-red-500 text-white' : 'bg-[#1d212d] border-[#292e40] text-gray-300'
                }`}
              >
                {sfxFader === 0 ? 'SFX Muted' : 'Mute SFX'}
              </button>
            </div>
          </div>

          {/* SECCIÓN 3: MASTER BROADCAST PROGRAM & STUDIO MONITOR */}
          <div className="flex gap-3 pl-2">
            {/* MONITOR LOCAL (Auriculares / Booth) */}
            <div className="w-28 flex flex-col items-center bg-[#13161c] border border-[#202533] rounded-lg p-2.5 shadow-md select-none">
              <div className="w-full text-center mb-3">
                <span className="inline-flex items-center justify-center gap-1 w-full truncate px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-gray-700/40 text-gray-200 border border-gray-600/40">
                  <Headphones size={11} /> Monitor
                </span>
              </div>

              <div className="w-full text-center text-[10px] text-gray-400 font-mono mb-2">
                Salida: <span className="text-gray-300">Cabina</span>
              </div>

              <div className="flex-1 w-full flex items-center justify-center gap-2.5 min-h-[220px]">
                <div className="relative flex flex-col items-center h-full justify-center">
                  <div className="h-48 flex items-center">
                    <input
                      type="range"
                      orient="vertical"
                      min="0"
                      max="1.2"
                      step="0.01"
                      value={monitorFader}
                      onChange={(e) => handleMonitorChange(parseFloat(e.target.value))}
                      className="h-44 w-7 cursor-pointer accent-cyan-400 bg-[#1b1f2b] rounded appearance-none"
                      style={{ WebkitAppearance: 'slider-vertical' }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 mt-1">
                    {Math.round(monitorFader * 100)}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleMonitorChange(monitorFader > 0 ? 0 : 1.0)}
                className={`w-full py-1.5 mt-2 text-[10px] font-bold rounded uppercase tracking-wider border transition-colors ${
                  monitorFader === 0 ? 'bg-red-600 border-red-500 text-white' : 'bg-[#1d212d] border-[#292e40] text-gray-300'
                }`}
              >
                {monitorFader === 0 ? 'Muted' : 'Mute Out'}
              </button>
            </div>

            {/* MASTER PGM (SALIDA PRINCIPAL BROADCAST Y GRABACIÓN) */}
            <div className="w-36 flex flex-col items-center bg-[#171313] border-2 border-red-500/50 rounded-lg p-2.5 shadow-xl select-none relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
              <div className="w-full text-center mb-2 mt-1">
                <span className="inline-flex items-center justify-center gap-1 w-full truncate px-2 py-0.5 text-[11px] font-black rounded uppercase tracking-wider bg-red-600 text-white shadow-md shadow-red-600/40">
                  <Radio size={12} className="animate-pulse" /> MASTER PGM
                </span>
              </div>

              <div className="w-full text-center text-[10px] text-gray-300 font-mono mb-2 flex items-center justify-center gap-1">
                <span>Peak:</span>
                <span ref={el => peakTextRefs.current['master_txt'] = el} className="text-red-400 font-bold">
                  -inf dB
                </span>
              </div>

              {/* Fader Master con Vúmetro Doble */}
              <div className="flex-1 w-full flex items-center justify-center gap-3 min-h-[220px]">
                <div className="relative flex flex-col items-center h-full justify-center">
                  <div className="h-48 flex items-center">
                    <input
                      type="range"
                      orient="vertical"
                      min="0"
                      max="1.3"
                      step="0.01"
                      value={masterFader}
                      onChange={(e) => handleMasterChange(parseFloat(e.target.value))}
                      className="h-44 w-8 cursor-pointer accent-red-500 bg-[#221c1c] rounded appearance-none"
                      style={{ WebkitAppearance: 'slider-vertical' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-red-400 font-bold mt-1">
                    {masterFader === 0 ? '-inf' : `${((masterFader - 1.0) * 12).toFixed(1)}dB`}
                  </span>
                </div>

                {/* Vúmetro Master Estéreo */}
                <div className="h-44 w-5 bg-[#0d0e14] border border-[#351c1c] rounded-sm p-[1px] flex flex-col justify-end overflow-hidden relative">
                  <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-30">
                    <div className="w-full h-[1px] bg-red-500" />
                    <div className="w-full h-[1px] bg-yellow-400" />
                    <div className="w-full h-[1px] bg-green-400" />
                    <div className="w-full h-[1px] bg-green-400" />
                  </div>
                  <div
                    ref={el => meterRefs.current['master_meter'] = el}
                    className="w-full bg-emerald-500 rounded-sm transition-all duration-75"
                    style={{ height: '0%' }}
                  />
                </div>
              </div>

              <div className="w-full mt-2 text-center">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest block font-bold">
                  Brickwall Limiter
                </span>
                <span className="text-[9px] text-emerald-400 font-mono block">
                  -1.5 dBFS True Peak
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
