import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, Video, Mic, Smartphone, Play, Square, Layers, Sparkles, 
  CheckCircle, RefreshCw, Wifi, WifiOff, Volume2, ShieldCheck, 
  Grid, Eye, Layout, ChevronRight, Sliders, Scissors, ArrowRightLeft,
  Tv, Music, Send, Type, Bell, VolumeX, RotateCcw, FileText,
  FastForward, Pause, Plus, Minus, Globe, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function StudioRemoteControl() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const room = searchParams.get('room') || 'master_studio';
  const customHost = searchParams.get('host') || '';

  // Estado sincronizado con el Master PC
  const [connectedToStudio, setConnectedToStudio] = useState(false);
  const [connectionType, setConnectionType] = useState('Buscando'); // 'LAN Wi-Fi Direct' o 'Supabase Cloud'
  const [activeCam, setActiveCam] = useState(1);
  const [pvwCam, setPvwCam] = useState(2);
  const [pipCam, setPipCam] = useState(2);
  const [layoutMode, setLayoutMode] = useState('1');
  const [tBarPosition, setTBarPosition] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [topic, setTopic] = useState('PodcaStudio');
  const [cintillosVisible, setCintillosVisible] = useState(false);
  const [camSlots, setCamSlots] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [toastMsg, setToastMsg] = useState('');
  const [hasLiveFeed, setHasLiveFeed] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [activeTab, setActiveTab] = useState('switcher'); // 'switcher', 'layouts', 'cintillos', 'audio', 'prompter'

  // Teleprompter en iPad
  const [prompterText, setPrompterText] = useState('');
  const [prompterSpeed, setPrompterSpeed] = useState(2.0);
  const [prompterFontSize, setPrompterFontSize] = useState(24);
  const [isPrompterPlaying, setIsPrompterPlaying] = useState(false);
  const prompterScrollRef = useRef(null);

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

  // Función para pintar fotograma de video en el canvas
  const drawFrameOnCanvas = useCallback((srcUrl) => {
    if (!canvasRef.current || !srcUrl) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext('2d');
    if (!feedImgRef.current) feedImgRef.current = new Image();
    feedImgRef.current.onload = () => {
      ctx.drawImage(feedImgRef.current, 0, 0, cvs.width, cvs.height);
      setHasLiveFeed(true);
    };
    feedImgRef.current.src = srcUrl;
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
              if (!b || isUnmounted) return;
              const u = URL.createObjectURL(b);
              drawFrameOnCanvas(u);
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
              if (s.isStreaming !== undefined) setIsStreaming(Boolean(s.isStreaming));
              if (s.streamDuration !== undefined) setStreamDuration(Number(s.streamDuration));
              if (s.topic !== undefined) setTopic(s.topic);
              if (s.cintillosVisible !== undefined) setCintillosVisible(Boolean(s.cintillosVisible));
              if (s.camSlots !== undefined && Array.isArray(s.camSlots) && s.camSlots.length > 0) {
                setCamSlots(s.camSlots.map(Number));
              }
              if (s.tBarPosition !== undefined) setTBarPosition(Number(s.tBarPosition));
              if (s.musicPlaying !== undefined) setIsMusicPlaying(Boolean(s.musicPlaying));
              if (s.camMuted && s.camMuted[1] !== undefined) setIsMicMuted(Boolean(s.camMuted[1]));
              if (s.teleprompter) {
                if (s.teleprompter.text !== undefined) setPrompterText(s.teleprompter.text);
                if (s.teleprompter.speed !== undefined) setPrompterSpeed(Number(s.teleprompter.speed));
                if (s.teleprompter.fontSize !== undefined) setPrompterFontSize(Number(s.teleprompter.fontSize));
                if (s.teleprompter.isPlaying !== undefined) setIsPrompterPlaying(Boolean(s.teleprompter.isPlaying));
              }
            } else if (data.type === 'pgm-frame' && data.data) {
              drawFrameOnCanvas(data.data);
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

    // Sondeo de fotograma por HTTP fallback cada 1s en LAN
    pollTimer = setInterval(() => {
      if (wsRef.current?.readyState === 1 && !hasLiveFeed) {
        fetch('/program/snapshot.jpg')
          .then(r => r.ok ? r.blob() : null)
          .then(b => {
            if (!b || isUnmounted) return;
            const u = URL.createObjectURL(b);
            drawFrameOnCanvas(u);
          }).catch(() => {});
      }
    }, 1000);

    return () => {
      isUnmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (socket) socket.close();
    };
  }, [customHost, drawFrameOnCanvas, hasLiveFeed]);

  // 2. CONEXIÓN SUPABASE EN TIEMPO REAL (CANAL BROADCAST CLOUD)
  useEffect(() => {
    if (!supabase) return;

    const channelName = `studio_control_${room}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = channel;

    // Escuchar actualizaciones de estado general del máster
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
        if (payload.isStreaming !== undefined) setIsStreaming(Boolean(payload.isStreaming));
        if (payload.streamDuration !== undefined) setStreamDuration(Number(payload.streamDuration));
        if (payload.topic !== undefined) setTopic(payload.topic);
        if (payload.cintillosVisible !== undefined) setCintillosVisible(Boolean(payload.cintillosVisible));
        if (payload.camSlots !== undefined && Array.isArray(payload.camSlots) && payload.camSlots.length > 0) {
          setCamSlots(payload.camSlots.map(Number));
        }
        if (payload.tBarPosition !== undefined) setTBarPosition(Number(payload.tBarPosition));
        if (payload.musicPlaying !== undefined) setIsMusicPlaying(Boolean(payload.musicPlaying));
        if (payload.camMuted && payload.camMuted[1] !== undefined) setIsMicMuted(Boolean(payload.camMuted[1]));
        if (payload.teleprompter) {
          if (payload.teleprompter.text !== undefined) setPrompterText(payload.teleprompter.text);
          if (payload.teleprompter.speed !== undefined) setPrompterSpeed(Number(payload.teleprompter.speed));
          if (payload.teleprompter.fontSize !== undefined) setPrompterFontSize(Number(payload.teleprompter.fontSize));
          if (payload.teleprompter.isPlaying !== undefined) setIsPrompterPlaying(Boolean(payload.teleprompter.isPlaying));
        }
      } else if (payload.type === 'REC_TICK') {
        if (payload.recordingTime !== undefined) setRecordingTime(Number(payload.recordingTime));
      }
    });

    // Escuchar fotogramas de video PGM emitidos en tiempo real por Supabase
    channel.on('broadcast', { event: 'pgm_cloud_frame' }, (event) => {
      const payload = event?.payload;
      if (payload && payload.dataUrl) {
        drawFrameOnCanvas(payload.dataUrl);
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

    return () => {
      channel.unsubscribe().catch(() => {});
    };
  }, [room, drawFrameOnCanvas]);

  // Scroll automático del teleprónter cuando está activo
  useEffect(() => {
    let animId = null;
    if (isPrompterPlaying && prompterScrollRef.current) {
      const scrollStep = () => {
        if (prompterScrollRef.current) {
          prompterScrollRef.current.scrollTop += prompterSpeed * 0.75;
        }
        animId = requestAnimationFrame(scrollStep);
      };
      animId = requestAnimationFrame(scrollStep);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPrompterPlaying, prompterSpeed]);

  // ACCIONES DEL SWITCHER BROADCAST REAL
  const handleCut = () => {
    const toPgm = pvwCam;
    const toPvw = activeCam;
    setActiveCam(toPgm);
    setPvwCam(toPvw);
    sendCommand('TRIGGER_CUT');
    showToast(`⚡ CUT a CAM ${toPgm}`);
  };

  const handleAuto = () => {
    const toPgm = pvwCam;
    const toPvw = activeCam;
    setActiveCam(toPgm);
    setPvwCam(toPvw);
    sendCommand('TRIGGER_AUTO');
    showToast(`✨ AUTO DISOLVENCIA a CAM ${toPgm}`);
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
    sendCommand('SET_PIP_CAM', { camId: num });
    showToast(nextMode === 'pip' ? `PiP activado en CAM ${num}` : 'PiP desactivado');
  };

  const handleDeactivatePip = () => {
    setLayoutMode('1');
    sendCommand('SET_LAYOUT', { mode: '1' });
    showToast('Modo Solo (Pantalla Completa)');
  };

  const handleSelectLayout = (mode) => {
    setLayoutMode(mode);
    sendCommand('SET_LAYOUT', { mode });
    const modeLabels = { '1': 'Solo (1 Cam)', 'pip': 'Modo PiP', '2': 'Split 50/50', '3': '3 Cámaras', '4': 'Cuadrícula 4' };
    showToast(`Diseño: ${modeLabels[mode] || mode}`);
  };

  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    sendCommand('TOGGLE_RECORD');
    showToast(!isRecording ? '🔴 Grabación Iniciada en PC Master' : '⏹ Grabación Detenida');
  };

  const handleToggleStream = () => {
    setIsStreaming(!isStreaming);
    sendCommand('TOGGLE_STREAM');
    showToast(!isStreaming ? '📡 Transmisión En Vivo Iniciada' : '⏹ Transmisión Detenida');
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

  const handleMuteAll = () => {
    sendCommand('MUTE_ALL');
    showToast('Silenciando todas las cámaras');
  };

  const handleUnmuteAll = () => {
    sendCommand('UNMUTE_ALL');
    showToast('Activando audio de cámaras');
  };

  // TELEPROMPTER EN IPAD
  const handleTogglePrompterPlay = () => {
    const nextState = !isPrompterPlaying;
    setIsPrompterPlaying(nextState);
    sendCommand('TOGGLE_PROMPTER');
  };

  const handlePrompterSpeedChange = (delta) => {
    const newSpeed = Math.max(0.5, Math.min(8.0, +(prompterSpeed + delta).toFixed(1)));
    setPrompterSpeed(newSpeed);
    sendCommand('SET_PROMPTER_SPEED', { speed: newSpeed });
  };

  const handlePrompterFontChange = (delta) => {
    const newSize = Math.max(14, Math.min(60, prompterFontSize + delta));
    setPrompterFontSize(newSize);
    sendCommand('SET_PROMPTER_FONT_SIZE', { fontSize: newSize });
  };

  // Asegurar siempre lista de 12 cámaras completas para el switcher
  const full12Cams = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div 
      className="w-full min-h-[100dvh] bg-[#07080a] text-white font-sans flex flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pb-36 px-3 sm:px-6 max-w-5xl mx-auto"
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
      <div className="sticky top-0 z-40 bg-[#0c0d12]/95 backdrop-blur-md border-b border-[#22242a] -mx-3 sm:-mx-6 px-4 py-2.5 mb-3 shadow-xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-600/30 shrink-0">
            <Radio size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white leading-tight">
                Podca<span className="text-orange-500">Studio</span>
              </h1>
              <span className="text-[9px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded-full uppercase">
                iPad Máster
              </span>
            </div>
            <p className="text-[10px] text-gray-400 truncate max-w-[160px] sm:max-w-xs">
              {topic || 'PodcastStudio'}
            </p>
          </div>
        </div>

        {/* INDICADOR DE ENLACE Y BOTONES REC / LIVE */}
        <div className="flex items-center gap-1.5">
          {connectedToStudio ? (
            <div className="hidden xs:flex items-center gap-1 bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{connectionType}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-950/70 border border-amber-500/50 text-amber-400 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">
              <RefreshCw size={10} className="animate-spin text-amber-400" />
              <span>Conectando...</span>
            </div>
          )}

          {/* BOTÓN EN VIVO STREAM */}
          <button
            type="button"
            onClick={handleToggleStream}
            className={`px-2.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-md ${
              isStreaming
                ? 'bg-emerald-600 text-white animate-pulse border border-emerald-400'
                : 'bg-[#181a22] hover:bg-[#252834] text-emerald-400 border border-emerald-500/40'
            }`}
          >
            <Globe size={11} className={isStreaming ? 'animate-spin' : ''} />
            <span>{isStreaming ? formatTime(streamDuration) : 'EN VIVO'}</span>
          </button>

          {/* BOTÓN GRABAR PC MASTER */}
          <button
            type="button"
            onClick={handleToggleRecord}
            className={`px-2.5 py-1.5 rounded-xl font-black text-[11px] flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-md ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse border border-red-400'
                : 'bg-[#181a22] hover:bg-[#252834] text-red-400 border border-red-500/40'
            }`}
          >
            {isRecording ? <Square size={11} className="fill-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>}
            <span>{isRecording ? formatTime(recordingTime) : 'GRABAR'}</span>
          </button>
        </div>
      </div>

      {/* BARRA DE NAVEGACIÓN RÁPIDA POR PESTAÑAS PARA IPAD */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          { id: 'switcher', label: 'Cámaras (12)', icon: Sliders },
          { id: 'layouts', label: 'Diseños & PiP', icon: Layout },
          { id: 'cintillos', label: 'Cintillos', icon: Sparkles },
          { id: 'audio', label: 'Audio & SFX', icon: Volume2 },
          { id: 'prompter', label: 'Teleprónter', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                isCurrent
                  ? 'bg-orange-600 text-white border-orange-400 shadow-md shadow-orange-950/60 scale-[1.02]'
                  : 'bg-[#12141a] text-gray-400 border-[#222530] hover:bg-[#1a1d26]'
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PANTALLA MONITOR MASTER (PROGRAM FEED EN VIVO PARA IPAD) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 mb-3 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
            <h2 className="text-xs sm:text-sm font-extrabold text-white tracking-wide uppercase">
              Pantalla Máster PGM al Aire
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {isStreaming && (
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold text-[9px] animate-pulse">
                LIVE {formatTime(streamDuration)}
              </span>
            )}
            {isRecording && (
              <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[9px] animate-pulse">
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
            <div className="flex flex-col items-center justify-center text-center p-4 text-gray-400">
              <Tv size={36} className="text-orange-500/80 mb-2 animate-pulse" />
              <p className="text-xs sm:text-sm font-extrabold text-white">
                Señal Máster Activa — CAM {activeCam}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-sm">
                Modo: <strong className="text-orange-400 uppercase">{layoutMode === 'pip' ? `PiP (CAM ${pipCam})` : layoutMode}</strong> • Enlazado con PC Máster
              </p>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Conectado y sincronizado en tiempo real</span>
              </div>
            </div>
          )}

          {/* Badge de Tally en Vivo superpuesto en el reproductor */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[10px] font-black tracking-wider uppercase border border-red-400 shadow">
              ● PGM {activeCam}
            </span>
            {layoutMode === 'pip' && (
              <span className="px-2 py-0.5 rounded-full bg-sky-600/90 text-white text-[10px] font-black tracking-wider uppercase border border-sky-400 shadow">
                PiP CAM {pipCam}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: SWITCHER DE 12 CÁMARAS Y TRANSICIONES */}
      {(activeTab === 'switcher' || activeTab === 'all') && (
        <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-orange-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-100 uppercase tracking-wider">
                Consola Switcher (12 Cámaras)
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="flex items-center gap-1 font-bold text-red-400 bg-red-950/60 border border-red-500/30 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> PGM: CAM {activeCam}
              </span>
              <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> PVW: CAM {pvwCam}
              </span>
            </div>
          </div>

          {/* 1. BUS PROGRAM (PGM - AL AIRE - TALLY ROJO) */}
          <div className="mb-3.5">
            <div className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>● PROGRAM (AL AIRE INMEDIATO)</span>
              <span className="text-[9px] text-gray-400">Toca para poner al aire</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
              {full12Cams.map((camId) => {
                const isPgm = activeCam === camId;
                return (
                  <button
                    key={`pgm-${camId}`}
                    type="button"
                    onClick={() => handleSelectPgmCam(camId)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center font-black transition-all border cursor-pointer active:scale-95 ${
                      isPgm
                        ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/60 scale-[1.03]'
                        : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                    }`}
                  >
                    <span className="text-xs">CAM {camId}</span>
                    <span className={`text-[8px] mt-0.5 px-1 rounded uppercase font-bold ${
                      isPgm ? 'bg-red-950 text-red-200 border border-red-400' : 'text-gray-500'
                    }`}>
                      {isPgm ? 'ON AIR' : 'PGM'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. BUS PREVIEW (PVW - PRÓXIMA TOMA - TALLY VERDE) */}
          <div className="mb-3.5">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>● PREVIEW (PRÓXIMA TOMA LISTA)</span>
              <span className="text-[9px] text-gray-400">Selecciona para CUT o AUTO</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
              {full12Cams.map((camId) => {
                const isPvw = pvwCam === camId;
                return (
                  <button
                    key={`pvw-${camId}`}
                    type="button"
                    onClick={() => handleSelectPvwCam(camId)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center font-black transition-all border cursor-pointer active:scale-95 ${
                      isPvw
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/60 scale-[1.03]'
                        : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                    }`}
                  >
                    <span className="text-xs">CAM {camId}</span>
                    <span className={`text-[8px] mt-0.5 px-1 rounded uppercase font-bold ${
                      isPvw ? 'bg-emerald-950 text-emerald-200 border border-emerald-400' : 'text-gray-500'
                    }`}>
                      {isPvw ? 'READY' : 'PVW'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. BOTONES DE TRANSICIÓN BROADCAST (CUT, AUTO Y T-BAR REAL) */}
          <div className="bg-[#0b0c10] border border-[#22242a] p-3 rounded-xl flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCut}
                className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm rounded-xl border border-red-400 shadow-lg shadow-red-950/50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Scissors size={15} />
                <span>CUT (CORTE)</span>
              </button>
              <button
                type="button"
                onClick={handleAuto}
                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm rounded-xl border border-orange-400 shadow-lg shadow-orange-950/50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <ArrowRightLeft size={15} />
                <span>AUTO MIX</span>
              </button>
            </div>

            <div className="flex-1 w-full flex items-center gap-2 bg-[#13151b] border border-[#262832] px-3 py-2 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase w-10 text-center">T-Bar</span>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={tBarPosition}
                onChange={handleTBarSliderChange}
                className="flex-1 h-3 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-xs font-mono font-bold text-orange-400 w-10 text-right">
                {Math.round(tBarPosition * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: DISEÑOS DE PANTALLA Y CONTROL PIP */}
      {(activeTab === 'layouts' || activeTab === 'all') && (
        <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
            <div className="flex items-center gap-2">
              <Layout size={16} className="text-sky-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-100 uppercase tracking-wider">
                Diseños de Composición & PiP
              </h2>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              layoutMode === 'pip' ? 'bg-sky-600 text-white' : 'bg-[#20232c] text-gray-400 border border-[#303440]'
            }`}>
              {layoutMode === 'pip' ? `PiP ACTIVO (CAM ${pipCam})` : 'MODO REGULAR'}
            </span>
          </div>

          {/* Modos de Pantalla */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {[
              { id: '1', label: 'Solo (1 Cam)', sub: 'Cámara completa' },
              { id: 'pip', label: 'Modo PiP', sub: `Flotante CAM ${pipCam}` },
              { id: '2', label: 'Split (2)', sub: '50% / 50% Mitad' },
              { id: '3', label: '3 Cámaras', sub: '1 Principal + 2 Laterales' },
              { id: '4', label: 'Cuadrícula (4)', sub: '4 Pantallas' },
            ].map((mode) => {
              const isCurrent = layoutMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleSelectLayout(mode.id)}
                  className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer active:scale-95 ${
                    isCurrent
                      ? 'border-sky-500 bg-sky-950/40 text-white shadow-md shadow-sky-950/30'
                      : 'border-[#22242a] bg-[#14161b] hover:bg-[#1c1f26] text-gray-300'
                  }`}
                >
                  <div className="text-xs font-black mb-0.5">{mode.label}</div>
                  <div className="text-[9px] text-gray-400">{mode.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Selector de Cámara para Recuadro PiP */}
          <div className="bg-[#0b0c10] border border-[#22242a] p-3 rounded-xl">
            <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Elegir Cámara para Recuadro Flotante PiP:</span>
              {layoutMode === 'pip' && (
                <button
                  type="button"
                  onClick={handleDeactivatePip}
                  className="text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                >
                  Quitar PiP
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
              {full12Cams.map((camId) => {
                const isThisPip = layoutMode === 'pip' && pipCam === camId;
                return (
                  <button
                    key={`pip-cam-${camId}`}
                    type="button"
                    onClick={() => handleTogglePipCam(camId)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all border cursor-pointer active:scale-95 ${
                      isThisPip
                        ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-950/60 scale-[1.03]'
                        : 'bg-[#15171d] text-gray-300 border-[#282a32] hover:bg-[#1f222b]'
                    }`}
                  >
                    <span>CAM {camId}</span>
                    <span className="text-[8px] text-gray-400 mt-0.5">
                      {isThisPip ? 'EN PiP' : 'Elegir'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: CINTILLOS Y BANNERS TELEVISIVOS */}
      {(activeTab === 'cintillos' || activeTab === 'all') && (
        <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-100 uppercase tracking-wider">
                Cintillos y Títulos Televisivos
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
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Presets Rápidos al Aire:</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
          <form onSubmit={handleSendCustomCintillo} className="bg-[#0b0c10] border border-[#22242a] p-3 rounded-xl flex flex-col gap-2">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Type size={14} />
              <span>Publicar Texto Personalizado en Pantalla Máster:</span>
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
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <Send size={13} />
              <span>LANZAR CINTILLO A PANTALLA MÁSTER</span>
            </button>
          </form>
        </div>
      )}

      {/* SECCIÓN 4: AUDIO & SOUNDBOARD */}
      {(activeTab === 'audio' || activeTab === 'all') && (
        <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-yellow-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-100 uppercase tracking-wider">
                Audio & Efectos de Sonido SFX
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMusic}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isMusicPlaying
                    ? 'bg-orange-600 text-white shadow'
                    : 'bg-[#1a1d24] hover:bg-[#252a35] text-orange-400 border border-orange-500/40'
                }`}
              >
                <Music size={12} />
                <span>{isMusicPlaying ? 'Pausar BGM' : 'Música BGM'}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleMicMute}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isMicMuted
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-[#1a1d24] hover:bg-[#252a35] text-red-400 border border-red-500/40'
                }`}
              >
                {isMicMuted ? <VolumeX size={12} /> : <Mic size={12} />}
                <span>{isMicMuted ? 'Mic Silenciado' : 'Mic Máster'}</span>
              </button>
            </div>
          </div>

          {/* Botones de Control de Silencio Rápido */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleMuteAll}
              className="flex-1 py-1.5 bg-[#14161b] hover:bg-red-950/60 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <VolumeX size={13} />
              <span>Silenciar Todas las Cams</span>
            </button>
            <button
              type="button"
              onClick={handleUnmuteAll}
              className="flex-1 py-1.5 bg-[#14161b] hover:bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Volume2 size={13} />
              <span>Activar Todas las Cams</span>
            </button>
          </div>

          {/* Soundboard Pads Grandes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'sfx-appl-01', label: '👏 Aplausos', sub: 'Público' },
              { id: 'sfx-laugh-01', label: '😂 Risas', sub: 'Humor' },
              { id: 'sfx-ovat-01', label: '🎉 Ovación', sub: 'Festejo' },
              { id: 'sfx-imp-01', label: '💥 Impacto', sub: 'Golpe' },
              { id: 'sfx-com-01', label: '🎺 Corneta', sub: 'Celebración' },
              { id: 'sfx-phone-01', label: '☎️ Llamada', sub: 'Timbre' },
              { id: 'sfx-whistle-01', label: '🔔 Campana', sub: 'Atención' },
              { id: 'sfx-drum-01', label: '🥁 Tambores', sub: 'Suspenso' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTriggerSfx(item.id, item.label)}
                className="p-3 rounded-xl bg-gradient-to-b from-[#181a22] to-[#12131a] hover:from-[#222530] hover:to-[#181a24] border border-[#2b2e3c] hover:border-yellow-500/50 text-left transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <div className="text-xs sm:text-sm font-black text-yellow-300">{item.label}</div>
                <div className="text-[9px] text-gray-400 mt-0.5">{item.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SECCIÓN 5: TELEPRÓNTER INTEGRADO PARA IPAD */}
      {(activeTab === 'prompter' || activeTab === 'all') && (
        <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-3 sm:p-4 mb-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#20222a] pb-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-sky-400" />
              <h2 className="text-xs sm:text-sm font-extrabold text-gray-100 uppercase tracking-wider">
                Teleprónter en Vivo para iPad
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePrompterPlay}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  isPrompterPlaying
                    ? 'bg-amber-600 text-white shadow animate-pulse'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                {isPrompterPlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{isPrompterPlaying ? 'Pausar' : 'Iniciar'}</span>
              </button>
            </div>
          </div>

          {/* Controles de Velocidad y Tamaño de Letra */}
          <div className="flex items-center justify-between gap-3 bg-[#0b0c10] border border-[#22242a] p-2.5 rounded-xl mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Velocidad:</span>
              <button
                type="button"
                onClick={() => handlePrompterSpeedChange(-0.5)}
                className="w-7 h-7 bg-[#181a22] hover:bg-[#252834] rounded-lg flex items-center justify-center font-bold text-xs"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs font-mono font-bold text-sky-400 w-10 text-center">{prompterSpeed.toFixed(1)}x</span>
              <button
                type="button"
                onClick={() => handlePrompterSpeedChange(0.5)}
                className="w-7 h-7 bg-[#181a22] hover:bg-[#252834] rounded-lg flex items-center justify-center font-bold text-xs"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Letra:</span>
              <button
                type="button"
                onClick={() => handlePrompterFontChange(-2)}
                className="w-7 h-7 bg-[#181a22] hover:bg-[#252834] rounded-lg flex items-center justify-center font-bold text-xs"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs font-mono font-bold text-sky-400 w-10 text-center">{prompterFontSize}px</span>
              <button
                type="button"
                onClick={() => handlePrompterFontChange(2)}
                className="w-7 h-7 bg-[#181a22] hover:bg-[#252834] rounded-lg flex items-center justify-center font-bold text-xs"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Pantalla Lectora del Teleprónter en iPad */}
          <div 
            ref={prompterScrollRef}
            className="w-full h-64 bg-[#050608] border border-[#222530] rounded-xl p-4 overflow-y-auto leading-relaxed text-center font-bold text-white shadow-inner select-none cursor-pointer [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ fontSize: `${prompterFontSize}px` }}
            onClick={handleTogglePrompterPlay}
          >
            <div className="whitespace-pre-wrap py-4">
              {prompterText || 'Sin texto en el teleprónter. Escribe o carga un guión en la computadora máster y aparecerá automáticamente aquí en tu iPad.'}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INFORMATIVO */}
      <footer className="mt-auto py-3 text-center text-[10px] text-gray-500 flex items-center justify-center gap-2">
        <span>PodcastStudio Máster Controller</span>
        <span>•</span>
        <span>v1.1.9</span>
        <span>•</span>
        <span>Sincronización Bidireccional en Vivo</span>
      </footer>
    </div>
  );
}
