import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, Video, Mic, Smartphone, Play, Square, Layers, Sparkles, 
  CheckCircle, RefreshCw, Wifi, WifiOff, Volume2, ShieldCheck, 
  Grid, Eye, Layout, ChevronRight, Sliders, Scissors, ArrowRightLeft,
  Tv, Music, Send, Type, Bell, VolumeX, RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function StudioRemoteControl() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const room = searchParams.get('room') || 'master_studio';
  const customHost = searchParams.get('host') || '';

  // Estado sincronizado con el Master PC
  const [connectedToStudio, setConnectedToStudio] = useState(false);
  const [connectionType, setConnectionType] = useState('Buscando'); // 'LAN Direct' o 'Cloud'
  const [activeCam, setActiveCam] = useState(1);
  const [pvwCam, setPvwCam] = useState(2);
  const [pipCam, setPipCam] = useState(2);
  const [layoutMode, setLayoutMode] = useState('1');
  const [tBarPosition, setTBarPosition] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [topic, setTopic] = useState('PodcaStudio');
  const [cintillosVisible, setCintillosVisible] = useState(false);
  const [camSlots, setCamSlots] = useState([1, 2, 3, 4, 5, 6]);
  const [toastMsg, setToastMsg] = useState('');
  const [hasLiveFeed, setHasLiveFeed] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Formulario de cintillo personalizado desde el iPad
  const [customTitle, setCustomTitle] = useState('');
  const [customSub, setCustomSub] = useState('');
  const [customTag, setCustomTag] = useState('EN VIVO');

  const channelRef = useRef(null);
  const wsRef = useRef(null);
  const canvasRef = useRef(null);
  const feedImgRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(''), 2200);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Enviar comando a la PC Master (Prioridad 1: WebSocket LAN local directo; Prioridad 2: Supabase Cloud)
  const sendCommand = useCallback((type, data = {}) => {
    let sent = false;
    const payload = { type, sender: 'ipad_remote', timestamp: Date.now(), ...data };

    // 1. Envío directo por WebSocket de Red Local (Cero latencia en LAN)
    if (wsRef.current && wsRef.current.readyState === 1) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'remote-command', payload }));
        sent = true;
      } catch (e) {
        console.warn('[RemoteControl] Fallo envío WebSocket LAN:', e);
      }
    }

    // 2. Envío por canal Supabase (Nube / Internet)
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'studio_command',
          payload
        }).catch(() => {});
        sent = true;
      } catch (e) {}
    }

    if (!sent) {
      console.warn('[RemoteControl] No hay conexión activa para enviar comando:', type);
    }
  }, []);

  // 1. CONEXIÓN LOCAL WEBSOCKET DIRECTA (LAN WI-FI PARA IPAD)
  useEffect(() => {
    let socket = null;
    let isUnmounted = false;
    let retryTimer = null;
    let pollTimer = null;

    function connectLocalWs() {
      if (isUnmounted) return;
      const host = customHost || window.location.hostname || '127.0.0.1';
      // Conectar a puerto 3001 (HTTP) o 3000 (HTTPS)
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = window.location.port || (window.location.protocol === 'https:' ? '3000' : '3001');
      const wsUrl = `${proto}//${host}:${port}`;

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('[RemoteControl] WebSocket LAN conectado a Master PC en:', wsUrl);
          setConnectedToStudio(true);
          setConnectionType('LAN Wi-Fi Direct');
          socket.send(JSON.stringify({ type: 'identify', role: 'remote-control' }));
          socket.send(JSON.stringify({ type: 'request-state' }));

          // Sondeo inicial de fotograma snapshot de master
          fetch('/program/snapshot.jpg')
            .then(r => r.ok ? r.blob() : null)
            .then(b => {
              if (!b || !canvasRef.current || isUnmounted) return;
              const u = URL.createObjectURL(b);
              const i = new Image();
              i.onload = () => {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx && canvasRef.current) ctx.drawImage(i, 0, 0, canvasRef.current.width, canvasRef.current.height);
                setHasLiveFeed(true);
                URL.revokeObjectURL(u);
              };
              i.src = u;
            }).catch(() => {});
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'studio-state' && data.state) {
              const s = data.state;
              setConnectedToStudio(true);
              setConnectionType('LAN Wi-Fi Direct');
              if (s.activeCam !== undefined) setActiveCam(Number(s.activeCam));
              if (s.pvwCam !== undefined) setPvwCam(Number(s.pvwCam));
              if (s.pipCam !== undefined) setPipCam(Number(s.pipCam));
              if (s.layoutMode !== undefined) setLayoutMode(String(s.layoutMode));
              if (s.isRecording !== undefined) setIsRecording(Boolean(s.isRecording));
              if (s.recordingTime !== undefined) setRecordingTime(Number(s.recordingTime));
              if (s.topic !== undefined) setTopic(s.topic);
              if (s.cintillosVisible !== undefined) setCintillosVisible(Boolean(s.cintillosVisible));
              if (s.camSlots !== undefined && Array.isArray(s.camSlots)) setCamSlots(s.camSlots.map(Number));
              if (s.tBarPosition !== undefined) setTBarPosition(Number(s.tBarPosition));
              if (s.musicPlaying !== undefined) setIsMusicPlaying(Boolean(s.musicPlaying));
              if (s.camMuted && s.camMuted[1] !== undefined) setIsMicMuted(Boolean(s.camMuted[1]));
            } else if (data.type === 'pgm-frame' && data.data) {
              if (canvasRef.current) {
                const cvs = canvasRef.current;
                const ctx = cvs.getContext('2d');
                if (!feedImgRef.current) feedImgRef.current = new Image();
                feedImgRef.current.onload = () => {
                  ctx.drawImage(feedImgRef.current, 0, 0, cvs.width, cvs.height);
                  setHasLiveFeed(true);
                };
                feedImgRef.current.src = data.data;
              }
            }
          } catch (e) {}
        };

        socket.onclose = () => {
          if (!isUnmounted) {
            setConnectedToStudio(prev => (channelRef.current ? prev : false));
            retryTimer = setTimeout(connectLocalWs, 2000);
          }
        };

        socket.onerror = () => {
          try { socket.close(); } catch (e) {}
        };
      } catch (err) {
        retryTimer = setTimeout(connectLocalWs, 3000);
      }
    }

    connectLocalWs();

    // Sondeo de fotograma por HTTP fallback cada 1.5s
    pollTimer = setInterval(() => {
      if (wsRef.current?.readyState === 1 && !hasLiveFeed) {
        fetch('/program/snapshot.jpg')
          .then(r => r.ok ? r.blob() : null)
          .then(b => {
            if (!b || !canvasRef.current || isUnmounted) return;
            const u = URL.createObjectURL(b);
            const i = new Image();
            i.onload = () => {
              const ctx = canvasRef.current?.getContext('2d');
              if (ctx && canvasRef.current) ctx.drawImage(i, 0, 0, canvasRef.current.width, canvasRef.current.height);
              setHasLiveFeed(true);
              URL.revokeObjectURL(u);
            };
            i.src = u;
          }).catch(() => {});
      }
    }, 1500);

    return () => {
      isUnmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (socket) socket.close();
    };
  }, [customHost]);

  // 2. CONEXIÓN SUPABASE EN TIEMPO REAL (CANAL BROADCAST CLOUD)
  useEffect(() => {
    if (!supabase) return;

    const channelName = `studio_control_${room}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'studio_state' }, (event) => {
      const payload = event?.payload;
      if (!payload) return;

      if (payload.type === 'STATE_UPDATE') {
        setConnectedToStudio(true);
        if (wsRef.current?.readyState !== 1) setConnectionType('Supabase Cloud');
        if (payload.activeCam !== undefined) setActiveCam(Number(payload.activeCam));
        if (payload.pvwCam !== undefined) setPvwCam(Number(payload.pvwCam));
        if (payload.pipCam !== undefined) setPipCam(Number(payload.pipCam));
        if (payload.layoutMode !== undefined) setLayoutMode(String(payload.layoutMode));
        if (payload.isRecording !== undefined) setIsRecording(Boolean(payload.isRecording));
        if (payload.recordingTime !== undefined) setRecordingTime(Number(payload.recordingTime));
        if (payload.topic !== undefined) setTopic(payload.topic);
        if (payload.cintillosVisible !== undefined) setCintillosVisible(Boolean(payload.cintillosVisible));
        if (payload.camSlots !== undefined && Array.isArray(payload.camSlots)) setCamSlots(payload.camSlots.map(Number));
        if (payload.tBarPosition !== undefined) setTBarPosition(Number(payload.tBarPosition));
        if (payload.musicPlaying !== undefined) setIsMusicPlaying(Boolean(payload.musicPlaying));
        if (payload.camMuted && payload.camMuted[1] !== undefined) setIsMicMuted(Boolean(payload.camMuted[1]));
      } else if (payload.type === 'REC_TICK') {
        if (payload.recordingTime !== undefined) setRecordingTime(Number(payload.recordingTime));
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectedToStudio(true);
        if (wsRef.current?.readyState !== 1) setConnectionType('Supabase Cloud');
        channel.send({
          type: 'broadcast',
          event: 'studio_command',
          payload: { type: 'REQUEST_STATE', sender: 'ipad_remote' }
        }).catch(() => {});
      }
    });

    const pingInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'studio_command',
          payload: { type: 'REQUEST_STATE', sender: 'ipad_remote' }
        }).catch(() => {});
      }
    }, 4000);

    return () => {
      clearInterval(pingInterval);
      channel.unsubscribe().catch(() => {});
    };
  }, [room]);

  // ACCIONES DEL SWITCHER BROADCAST REAL
  const handleCut = () => {
    setActiveCam(pvwCam);
    setPvwCam(activeCam);
    sendCommand('TRIGGER_CUT');
    showToast(`⚡ CUT a CAM ${pvwCam}`);
  };

  const handleAuto = () => {
    setActiveCam(pvwCam);
    setPvwCam(activeCam);
    sendCommand('TRIGGER_AUTO');
    showToast(`✨ AUTO DISOLVENCIA a CAM ${pvwCam}`);
  };

  const handleSelectPgmCam = (camId) => {
    const num = Number(camId);
    setActiveCam(num);
    sendCommand('SET_ACTIVE_CAM', { camId: num });
    showToast(`● CAM ${num} AL AIRE (PGM)`);
  };

  const handleSelectPvwCam = (camId) => {
    const num = Number(camId);
    setPvwCam(num);
    sendCommand('SET_PVW_CAM', { camId: num });
    showToast(`● CAM ${num} LISTA (PREVIEW)`);
  };

  const handleTBarSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setTBarPosition(val);
    sendCommand('SET_TBAR', { position: val });
  };

  // CONTROL PIP PRECISO
  const handleTogglePipCam = (camId) => {
    const num = Number(camId);
    const nextMode = (layoutMode === 'pip' && pipCam === num) ? '1' : 'pip';
    setLayoutMode(nextMode);
    setPipCam(num);
    sendCommand('TOGGLE_PIP', { camId: num });
    showToast(nextMode === 'pip' ? `PiP activado en CAM ${num}` : 'PiP desactivado');
  };

  const handleDeactivatePip = () => {
    setLayoutMode('1');
    sendCommand('SET_LAYOUT', { mode: '1' });
    showToast('Modo Solo 1 (Pantalla Completa)');
  };

  const handleSelectLayout = (mode) => {
    setLayoutMode(mode);
    sendCommand('SET_LAYOUT', { mode });
    const modeLabels = { '1': 'Solo 1', 'pip': 'Modo PiP', '2': 'Split 50/50', '3': '3 Cámaras', '4': 'Cuadrícula 4' };
    showToast(`Diseño: ${modeLabels[mode] || mode}`);
  };

  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    sendCommand('TOGGLE_RECORD');
    showToast(!isRecording ? '🔴 Grabación Iniciada en PC Master' : '⏹ Grabación Detenida');
  };

  const handleToggleCintillo = () => {
    const nextVal = !cintillosVisible;
    setCintillosVisible(nextVal);
    sendCommand('TOGGLE_CINTILLO');
    showToast(nextVal ? 'Cintillo Mostrado' : 'Cintillo Ocultado');
  };

  const handlePresetCintillo = (presetId, label) => {
    setCintillosVisible(true);
    sendCommand('SET_CINTILLO_PRESET', { presetId });
    showToast(`Cintillo: ${label}`);
  };

  const handleSendCustomCintillo = (e) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    setCintillosVisible(true);
    sendCommand('SET_CUSTOM_CINTILLO', {
      text: customTitle.trim(),
      subtitle: customSub.trim(),
      tag: customTag.trim() || 'EN VIVO'
    });
    showToast(`Cintillo publicado: "${customTitle}"`);
    setCustomTitle('');
    setCustomSub('');
  };

  // AUDIO & SFX
  const handleTriggerSfx = (sfxId, label) => {
    sendCommand('TRIGGER_SFX', { sfxId });
    showToast(`Efecto SFX: ${label}`);
  };

  const handleToggleMusic = () => {
    setIsMusicPlaying(!isMusicPlaying);
    sendCommand('TOGGLE_MUSIC');
    showToast(!isMusicPlaying ? 'Música Encendida' : 'Música Pausada');
  };

  const handleToggleMicMute = () => {
    setIsMicMuted(!isMicMuted);
    sendCommand('TOGGLE_MIC_MUTE', { camId: 1 });
    showToast(!isMicMuted ? 'Micrófono Master Silenciado' : 'Micrófono Master Activo');
  };

  return (
    <div 
      className="w-full min-h-screen bg-[#07080a] text-white font-sans overflow-x-hidden overflow-y-auto overscroll-y-contain pb-44 px-3 sm:px-6 max-w-5xl mx-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      
      {/* TOAST FLOTANTE DE ACCIÓN TÁCTIL */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white font-black text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl shadow-orange-950/90 flex items-center gap-2 border border-orange-400 animate-in fade-in zoom-in duration-150">
          <Sparkles size={14} className="text-amber-200" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL STICKY CON ESTADO Y CONTROL RÁPIDO DE GRABACIÓN */}
      <div className="sticky top-0 z-40 bg-[#0c0d12]/95 backdrop-blur-md border-b border-[#22242a] -mx-3 sm:-mx-6 px-4 py-3 mb-4 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-600/30 shrink-0">
            <Radio size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                Podca<span className="text-orange-500">Studio</span>
              </h1>
              <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Mando iPad
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate max-w-[200px] sm:max-w-xs">
              {topic || 'PodcastStudio Master'}
            </p>
          </div>
        </div>

        {/* INDICADOR DE ENLACE Y BOTÓN RÁPIDO DE GRABACIÓN */}
        <div className="flex items-center gap-2">
          {connectedToStudio ? (
            <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Enlazado ({connectionType})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-950/70 border border-amber-500/50 text-amber-400 text-[11px] sm:text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
              <RefreshCw size={11} className="animate-spin text-amber-400" />
              <span>Conectando a PC...</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleRecord}
            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse border border-red-400'
                : 'bg-[#181a22] hover:bg-[#252834] text-red-400 border border-red-500/40'
            }`}
          >
            {isRecording ? <Square size={12} className="fill-white" /> : <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
            <span>{isRecording ? formatTime(recordingTime) : 'GRABAR'}</span>
          </button>
        </div>
      </div>

      {/* PANTALLA MONITOR MASTER (PROGRAM FEED EN VIVO PARA IPAD) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
            <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">
              Pantalla Master PGM al Aire
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[10px] animate-pulse">
                REC {formatTime(recordingTime)}
              </span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/40">
              CAM {activeCam} AL AIRE
            </span>
          </div>
        </div>

        {/* Video Canvas Feed 16:9 */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#2a2d36] flex items-center justify-center shadow-inner">
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className={`w-full h-full object-contain ${hasLiveFeed ? 'block' : 'hidden'}`}
          />
          {!hasLiveFeed && (
            <div className="flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Tv size={40} className="text-gray-600 mb-2 animate-pulse" />
              <p className="text-sm font-bold text-gray-200">Señal Master Activa (CAM {activeCam})</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Controlando en vivo la salida de producción. Las acciones se reflejan inmediatamente en la pantalla Master de la computadora.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SWITCHER BROADCAST REAL: PROGRAM (PGM) Y PREVIEW (PVW) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-orange-400" />
            <h2 className="text-sm font-extrabold text-gray-100 uppercase tracking-wider">
              Consola Switcher de Cámaras
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 font-bold text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> PGM: CAM {activeCam}
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> PVW: CAM {pvwCam}
            </span>
          </div>
        </div>

        {/* 1. BUS PROGRAM (PGM - AL AIRE - TALLY ROJO) */}
        <div className="mb-4">
          <div className="text-[11px] font-black text-red-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>● PROGRAM (AL AIRE INMEDIATO)</span>
            <span className="text-[10px] text-gray-400">Toca para poner al aire</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {camSlots.map((camId) => {
              const isPgm = activeCam === camId;
              return (
                <button
                  key={`pgm-${camId}`}
                  type="button"
                  onClick={() => handleSelectPgmCam(camId)}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center font-black transition-all border cursor-pointer active:scale-95 ${
                    isPgm
                      ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/60 scale-[1.02]'
                      : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                  }`}
                >
                  <span className="text-sm">CAM {camId}</span>
                  <span className={`text-[9px] mt-0.5 px-1.5 py-0.2 rounded font-bold uppercase ${
                    isPgm ? 'bg-red-900/90 text-red-100 border border-red-300' : 'text-gray-500'
                  }`}>
                    {isPgm ? 'ON AIR' : 'PGM'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. BUS PREVIEW (PVW - PRÓXIMA TOMA - TALLY VERDE) */}
        <div className="mb-4">
          <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>● PREVIEW (PRÓXIMA TOMA LISTA)</span>
            <span className="text-[10px] text-gray-400">Selecciona para CUT o AUTO</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {camSlots.map((camId) => {
              const isPvw = pvwCam === camId;
              return (
                <button
                  key={`pvw-${camId}`}
                  type="button"
                  onClick={() => handleSelectPvwCam(camId)}
                  className={`p-3 rounded-xl flex flex-col items-center justify-center font-black transition-all border cursor-pointer active:scale-95 ${
                    isPvw
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/60 scale-[1.02]'
                      : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                  }`}
                >
                  <span className="text-sm">CAM {camId}</span>
                  <span className={`text-[9px] mt-0.5 px-1.5 py-0.2 rounded font-bold uppercase ${
                    isPvw ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-300' : 'text-gray-500'
                  }`}>
                    {isPvw ? 'READY' : 'PVW'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. BOTONES DE TRANSICIÓN BROADCAST (CUT, AUTO Y T-BAR REAL) */}
        <div className="bg-[#0b0c10] border border-[#22242a] p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCut}
              className="flex-1 sm:flex-none px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl border border-red-400 shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Scissors size={16} />
              <span>CUT (CORTE)</span>
            </button>
            <button
              type="button"
              onClick={handleAuto}
              className="flex-1 sm:flex-none px-6 py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-sm rounded-xl border border-orange-400 shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <ArrowRightLeft size={16} />
              <span>AUTO MIX</span>
            </button>
          </div>

          <div className="flex-1 w-full flex items-center gap-3 bg-[#13151b] border border-[#262832] px-3 py-2 rounded-xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-12 text-center">T-Bar</span>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={tBarPosition}
              onChange={handleTBarSliderChange}
              className="flex-1 h-3 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <span className="text-xs font-mono font-bold text-orange-400 w-12 text-right">
              {Math.round(tBarPosition * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* CONTROL DE IMAGEN EN IMAGEN (PiP) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-sky-400" />
            <h2 className="text-sm font-extrabold text-gray-100 uppercase tracking-wider">
              Control PiP (Recuadro Flotante)
            </h2>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
            layoutMode === 'pip' ? 'bg-sky-600 text-white' : 'bg-[#20232c] text-gray-400 border border-[#303440]'
          }`}>
            {layoutMode === 'pip' ? `PiP ACTIVO (CAM ${pipCam})` : 'PiP INACTIVO'}
          </span>
        </div>

        <div className="text-[11px] font-bold text-gray-400 mb-2">
          Toca una cámara para enviarla al recuadro flotante PiP:
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
          {camSlots.map((camId) => {
            const isThisPip = layoutMode === 'pip' && pipCam === camId;
            return (
              <button
                key={`pip-cam-${camId}`}
                type="button"
                onClick={() => handleTogglePipCam(camId)}
                className={`p-2.5 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all border cursor-pointer active:scale-95 ${
                  isThisPip
                    ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-950/60 scale-[1.02]'
                    : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                }`}
              >
                <span>CAM {camId}</span>
                <span className="text-[9px] text-gray-400 mt-0.5">
                  {isThisPip ? 'EN PiP' : 'Poner en PiP'}
                </span>
              </button>
            );
          })}
        </div>

        {layoutMode === 'pip' && (
          <button
            type="button"
            onClick={handleDeactivatePip}
            className="w-full py-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>✕ Quitar Modo PiP (Regresar a Pantalla Completa)</span>
          </button>
        )}
      </div>

      {/* DISEÑOS DE PANTALLA Y COMPOSICIÓN (SOLO, PIP, SPLIT 2, 3, 4) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-3">
          <Layout size={16} className="text-sky-400" />
          DISEÑOS DE COMPOSICIÓN DEL ESTUDIO
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { id: '1', label: 'Solo (1 Cam)', sub: 'Cámara completa' },
            { id: 'pip', label: 'PiP', sub: `Flotante CAM ${pipCam}` },
            { id: '2', label: 'Split (2)', sub: '50% / 50% Mitad' },
            { id: '3', label: '3 Cámaras', sub: '1 Grande + 2 Lado' },
            { id: '4', label: 'Cuadrícula (4)', sub: '4 Pantallas' },
          ].map((mode) => {
            const isCurrent = layoutMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelectLayout(mode.id)}
                className={`p-3 rounded-xl text-left transition-all border cursor-pointer active:scale-95 ${
                  isCurrent
                    ? 'border-sky-500 bg-sky-950/40 text-white shadow-md shadow-sky-950/30'
                    : 'border-[#22242a] bg-[#14161b] hover:bg-[#1c1f26] text-gray-300'
                }`}
              >
                <div className="text-xs sm:text-sm font-black mb-0.5">{mode.label}</div>
                <div className="text-[10px] text-gray-400">{mode.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CINTILLOS Y BANNERS TELEVISIVOS CON EDITOR PERSONALIZADO */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h2 className="text-sm font-extrabold text-gray-100 uppercase tracking-wider">
              Cintillos y Banners Televisivos
            </h2>
          </div>
          <button
            type="button"
            onClick={handleToggleCintillo}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              cintillosVisible 
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50' 
                : 'bg-[#20232c] text-gray-400 border border-[#303440]'
            }`}
          >
            {cintillosVisible ? 'Ocultar Cintillo' : 'Mostrar Cintillo'}
          </button>
        </div>

        {/* Presets Rápidos */}
        <div className="text-[11px] font-bold text-gray-400 mb-2">Presets Rápidos al Aire:</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { id: 'topic', label: 'Tema Principal' },
            { id: 'host', label: 'Conductor' },
            { id: 'guest', label: 'Invitado Especial' },
            { id: 'social_youtube', label: 'YouTube / Redes' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePresetCintillo(c.id, c.label)}
              className="p-2.5 rounded-xl bg-[#14161b] hover:bg-[#20232c] border border-[#22242a] text-xs font-semibold text-gray-200 text-center transition-all cursor-pointer active:scale-95"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Publicar Cintillo Personalizado desde iPad */}
        <form onSubmit={handleSendCustomCintillo} className="bg-[#0b0c10] border border-[#22242a] p-3 sm:p-4 rounded-xl flex flex-col gap-2.5">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Type size={14} />
            <span>Publicar Texto Personalizado en Pantalla Master:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Título / Nombre (ej. Dr. Pedro Gómez)"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="bg-[#14161b] border border-[#2a2d38] text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="Subtítulo / Cargo (ej. Experto en Inteligencia Artificial)"
              value={customSub}
              onChange={(e) => setCustomSub(e.target.value)}
              className="bg-[#14161b] border border-[#2a2d38] text-white text-xs px-3 py-2 rounded-lg outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer active:scale-98 flex items-center justify-center gap-2"
          >
            <Send size={14} />
            <span>LANZAR CINTILLO A PANTALLA MASTER</span>
          </button>
        </form>
      </div>

      {/* DISPARADOR DE AUDIO & EFECTOS SFX EN VIVO */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-yellow-400" />
            <h2 className="text-sm font-extrabold text-gray-100 uppercase tracking-wider">
              Audio & Efectos de Sonido SFX
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMusic}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isMusicPlaying
                  ? 'bg-orange-600 text-white shadow'
                  : 'bg-[#1a1d24] hover:bg-[#252a35] text-orange-400 border border-orange-500/40'
              }`}
            >
              <Music size={13} />
              <span>{isMusicPlaying ? 'Pausar Música' : 'Música'}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleMicMute}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isMicMuted
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-[#1a1d24] hover:bg-[#252a35] text-red-400 border border-red-500/40'
              }`}
            >
              {isMicMuted ? <VolumeX size={13} /> : <Mic size={13} />}
              <span>{isMicMuted ? 'Mic Silenciado' : 'Mic Master'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'sfx-appl-01', label: '👏 Aplausos', sub: 'Público en estudio' },
            { id: 'sfx-laugh-01', label: '😂 Risas', sub: 'Carcajadas de humor' },
            { id: 'sfx-ovat-01', label: '🎉 Ovación', sub: 'Celebración y vítores' },
            { id: 'sfx-imp-01', label: '💥 Boom', sub: 'Impacto dramático' },
            { id: 'sfx-com-01', label: '🎺 Corneta', sub: 'Bocina festejo' },
            { id: 'sfx-phone-01', label: '☎️ Teléfono', sub: 'Llamada al aire' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTriggerSfx(item.id, item.label)}
              className="p-3 rounded-xl bg-gradient-to-b from-[#181a22] to-[#12131a] hover:from-[#222530] hover:to-[#181a24] border border-[#2b2e3c] hover:border-yellow-500/50 text-left transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <div className="text-xs sm:text-sm font-black text-yellow-300">{item.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* GRABACIÓN MASTER EN PC (TARJETA DE ALTA VISIBILIDAD) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Grabación Local en Disco de PC
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Guarda automáticamente en <strong className="text-gray-200">proyectos/{topic || 'General'}/</strong> en 1080p sin pérdidas.
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleRecord}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl active:scale-95 ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-950/80 animate-pulse border-2 border-red-400' 
                : 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-red-950/50 border border-red-500'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={18} className="fill-white" />
                <div className="flex flex-col items-start leading-tight">
                  <span>DETENER GRABACIÓN MASTER</span>
                  <span className="font-mono text-xs opacity-90">Tiempo: {formatTime(recordingTime)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded-full bg-white animate-ping"></div>
                <span>● INICIAR GRABACIÓN PC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* PIE DE PÁGINA */}
      <footer className="mt-auto py-4 text-center text-[10px] text-gray-500 flex items-center justify-center gap-2">
        <span>PodcastStudio Broadcast Controller</span>
        <span>•</span>
        <span>v1.1.9</span>
        <span>•</span>
        <span>Enlazado con PC Master</span>
      </footer>
    </div>
  );
}
