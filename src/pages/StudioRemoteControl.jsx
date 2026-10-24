import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, Video, Mic, Smartphone, Play, Square, Layers, Sparkles, 
  CheckCircle, RefreshCw, Wifi, WifiOff, Volume2, ShieldCheck, 
  Grid, Eye, Layout, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function StudioRemoteControl() {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const room = searchParams.get('room') || 'master_studio';

  // Estado sincronizado con el Master PC
  const [connectedToStudio, setConnectedToStudio] = useState(false);
  const [activeCam, setActiveCam] = useState(1);
  const [pipCam, setPipCam] = useState(2);
  const [layoutMode, setLayoutMode] = useState('1');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [topic, setTopic] = useState('PodcaStudio');
  const [cintillosVisible, setCintillosVisible] = useState(false);
  const [camSlots, setCamSlots] = useState([1, 2, 3, 4]);
  const [toastMsg, setToastMsg] = useState('');

  const channelRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(''), 2500);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Enviar comando a la PC Master
  const sendCommand = useCallback((type, data = {}) => {
    if (!channelRef.current) return;
    try {
      channelRef.current.send({
        type: 'broadcast',
        event: 'studio_command',
        payload: { type, sender: 'ipad_remote', ...data }
      }).catch((e) => console.warn('Error enviando comando:', e));
    } catch (e) {
      console.warn('Error de transmisión:', e);
    }
  }, []);

  // Suscripción al canal de control en tiempo real con Supabase
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
        if (payload.activeCam !== undefined) setActiveCam(payload.activeCam);
        if (payload.pipCam !== undefined) setPipCam(payload.pipCam);
        if (payload.layoutMode !== undefined) setLayoutMode(payload.layoutMode);
        if (payload.isRecording !== undefined) setIsRecording(payload.isRecording);
        if (payload.recordingTime !== undefined) setRecordingTime(payload.recordingTime);
        if (payload.topic !== undefined) setTopic(payload.topic);
        if (payload.cintillosVisible !== undefined) setCintillosVisible(payload.cintillosVisible);
        if (payload.camSlots !== undefined && Array.isArray(payload.camSlots)) setCamSlots(payload.camSlots);
      } else if (payload.type === 'REC_TICK') {
        if (payload.recordingTime !== undefined) setRecordingTime(payload.recordingTime);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Solicitar estado actual de la PC al conectar
        channel.send({
          type: 'broadcast',
          event: 'studio_command',
          payload: { type: 'REQUEST_STATE', sender: 'ipad_remote' }
        }).catch(() => {});
      }
    });

    // Sondeo de estado cada 5 segundos si no se ha recibido respuesta
    const pingInterval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'studio_command',
          payload: { type: 'REQUEST_STATE', sender: 'ipad_remote' }
        }).catch(() => {});
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      channel.unsubscribe().catch(() => {});
    };
  }, [room]);

  const handleSelectMasterCam = (camId) => {
    setActiveCam(camId);
    sendCommand('SET_ACTIVE_CAM', { camId });
    showToast(`Cámara ${camId} enviada a Master`);
  };

  const handleTogglePip = (camId) => {
    const nextMode = layoutMode === 'pip' && pipCam === camId ? '1' : 'pip';
    setLayoutMode(nextMode);
    setPipCam(camId);
    sendCommand('TOGGLE_PIP', { camId });
    showToast(nextMode === 'pip' ? `PiP activado en CAM ${camId}` : 'PiP desactivado');
  };

  const handleSelectLayout = (mode) => {
    setLayoutMode(mode);
    sendCommand('SET_LAYOUT', { mode });
    const modeLabels = { '1': 'Solo 1', 'pip': 'Modo PiP', '2': 'Split 50/50', '3': '3 Cámaras', '4': 'Cuadrícula 4' };
    showToast(`Diseño: ${modeLabels[mode] || mode}`);
  };

  const handleToggleRecord = () => {
    sendCommand('TOGGLE_RECORD');
    showToast(isRecording ? 'Deteniendo grabación en PC...' : 'Iniciando grabación en PC...');
  };

  const handleToggleCintillo = () => {
    setCintillosVisible(v => !v);
    sendCommand('TOGGLE_CINTILLO');
    showToast(!cintillosVisible ? 'Cintillo mostrado en pantalla' : 'Cintillo ocultado');
  };

  const handlePresetCintillo = (presetId, label) => {
    sendCommand('SET_CINTILLO_PRESET', { presetId });
    setCintillosVisible(true);
    showToast(`Cintillo: ${label}`);
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-white font-sans flex flex-col select-none p-3 sm:p-5 max-w-4xl mx-auto">
      
      {/* TOAST FLOTANTE DE ACCIÓN */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-600 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-full shadow-2xl shadow-orange-950/80 animate-bounce flex items-center gap-2 border border-orange-400">
          <Sparkles size={14} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-600/30">
            <Radio size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Podca<span className="text-orange-500">Studio</span>
              </h1>
              <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Control iPad
              </span>
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[240px] sm:max-w-md">
              Proyecto: <strong className="text-gray-200">{topic || 'PodcastStudio Master'}</strong>
            </p>
          </div>
        </div>

        {/* INDICADOR DE ENLACE CON MASTER PC */}
        <div className="flex items-center gap-2">
          {connectedToStudio ? (
            <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Enlazado con Master PC</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-950/70 border border-amber-500/50 text-amber-400 text-xs px-3 py-1.5 rounded-full font-bold shadow-sm">
              <RefreshCw size={12} className="animate-spin text-amber-400" />
              <span>Conectando a PC...</span>
            </div>
          )}
        </div>
      </div>

      {/* GRABACIÓN MASTER EN PC (BOTÓN GIGANTE DE ALTA VISIBILIDAD) */}
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
            className={`w-full sm:w-auto px-6 py-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-950/80 animate-pulse border-2 border-red-400' 
                : 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-red-950/50 border border-red-500'
            }`}
          >
            {isRecording ? (
              <>
                <Square size={20} className="fill-white" />
                <div className="flex flex-col items-start leading-tight">
                  <span>DETENER GRABACIÓN MASTER</span>
                  <span className="font-mono text-xs opacity-90">Tiempo: {formatTime(recordingTime)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-4 h-4 rounded-full bg-white animate-ping"></div>
                <span>● INICIAR GRABACIÓN PC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CONSOLA DE SWITCHER DE CÁMARAS MASTER (POTS TÁCTILES) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <Video size={16} className="text-orange-400" />
            SELECTOR DE CÁMARA MASTER AL AIRE
          </h2>
          <span className="text-xs font-extrabold text-orange-400 bg-orange-950/60 border border-orange-500/40 px-2.5 py-0.5 rounded-full">
            ACTIVA: CAM {activeCam}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {camSlots.map((camId) => {
            const isMaster = activeCam === camId;
            const isPip = layoutMode === 'pip' && pipCam === camId;

            return (
              <div 
                key={camId}
                className={`rounded-xl p-3 flex flex-col justify-between transition-all duration-150 border-2 ${
                  isMaster 
                    ? 'border-orange-500 bg-gradient-to-b from-orange-950/50 to-[#181412] shadow-lg shadow-orange-950/40' 
                    : 'border-[#22242a] bg-[#14161b] hover:border-[#383a42]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectMasterCam(camId)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-base font-black ${isMaster ? 'text-orange-400' : 'text-gray-200'}`}>
                      CAM {camId}
                    </span>
                    {isMaster && (
                      <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow">
                        AL AIRE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mb-3">
                    {camId === 1 ? 'Master Principal (Audio PC)' : `Cámara Remota ${camId}`}
                  </p>
                </button>

                {/* BOTÓN PIP DIRECTO PARA CADA CÁMARA */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePip(camId);
                  }}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPip
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-[#20232c] hover:bg-[#2c303c] text-gray-300 border border-[#303440]'
                  }`}
                >
                  <Layers size={12} />
                  <span>{isPip ? 'PiP ACTIVO' : 'PONER EN PiP'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* DISEÑOS DE PANTALLA Y COMPOSICIÓN (SOLO, PIP, SPLIT 2, 3, 4) */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-3">
          <Layout size={16} className="text-sky-400" />
          DISEÑO DE COMPOSICIÓN DEL ESTUDIO
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
                className={`p-3 rounded-xl text-left transition-all border cursor-pointer ${
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

      {/* CINTILLOS Y BANNERS EN PANTALLA */}
      <div className="bg-[#101216] border border-[#22242a] rounded-2xl p-4 sm:p-5 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            CINTILLOS Y BANNERS TELEVISIVOS
          </h2>
          <button
            type="button"
            onClick={handleToggleCintillo}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              cintillosVisible 
                ? 'bg-amber-600 text-white' 
                : 'bg-[#20232c] text-gray-400 border border-[#303440]'
            }`}
          >
            {cintillosVisible ? 'Ocultar Cintillo' : 'Mostrar Cintillo'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'topic_main', label: 'Tema Principal' },
            { id: 'host_name', label: 'Nombre Presentador' },
            { id: 'guest_name', label: 'Nombre Invitado' },
            { id: 'social_follow', label: 'Redes Sociales' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePresetCintillo(c.id, c.label)}
              className="p-2.5 rounded-xl bg-[#14161b] hover:bg-[#20232c] border border-[#22242a] text-xs font-semibold text-gray-200 text-center transition-all cursor-pointer"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* FOOTER INFORMACIÓN */}
      <div className="text-center text-[11px] text-gray-500 py-2">
        PodcaStudio Controller v1.0.7 · Todos los comandos se procesan en tiempo real en la PC Master.
      </div>
    </div>
  );
}
