import React, { useState, useRef, useEffect, useMemo, useCallback, Component } from 'react';
import { 
  Video, Mic, MicOff, Sparkles, Settings, Play, Pause, Square, QrCode, Share2, Camera, 
  Sliders, Volume2, Users, LayoutGrid, Plus, Headphones, Wifi, Search, 
  Grid, Eye, EyeOff, X, Copy, Link, Mail, MessageCircle, Globe, Sun, Disc, Smartphone, 
  CheckCircle, Download, UploadCloud, Image as ImageIcon, FileVideo, AudioLines, Monitor,
  BookOpen, Type, Layers, Music, ChevronRight, ChevronLeft, PanelRight, ChevronDown,
  PlayCircle, PauseCircle, Upload, Facebook, Youtube, Instagram, VolumeX, Sparkle, RefreshCw,
  Radio, Tv, Trash2, Loader2, Pencil, HelpCircle, RotateCcw, Zap, FlipHorizontal, Tablet, Tag, Lock, Focus
} from 'lucide-react';
import QRCode from 'qrcode';
import mammoth from 'mammoth';
import './index.css';

// Componentes y Configuración de Cintillos importados desde PODCASTUDIO
import CintilloStylePicker from './components/CintilloStylePicker.jsx';
import CintilloEditorModal from './components/CintilloEditorModal.jsx';
import CameraConnectModal from './components/CameraConnectModal.jsx';
import CameraCalibratorModal from './components/CameraCalibratorModal.jsx';
import MultiFormatExportModal from './components/MultiFormatExportModal.jsx';
import StreamDestinationEditor from './components/StreamDestinationEditor.jsx';
import AudioMixerDesk from './components/AudioMixerDesk.jsx';
import { BROADCAST_LAYOUTS } from './config/cameraSlots.js';
import { useCameraAudioLevels } from './hooks/useCameraAudioLevels.js';
import { buildCanvasFilter } from './utils/videoLook.js';
import { bindVideoKeepAlive, getVideoTrackInfo, getVideoTrackResolution } from './utils/videoStream.js';
import { CINTILLO_STYLES, getCintilloStyle } from './config/cintilloStyles.js';
import { CINTILLO_PRESETS, resolveCintilloText, resolveCintilloSubtitle } from './config/cintilloPresets.js';
import { CINTILLO_POSITION_OPTIONS } from './config/cintilloCameraMap.js';
import { findAvailableRemoteCameraSlot, resolveRemoteCameraSlot, chooseReconnectCameraSlot, decidirColocacionRemotaCloud, fuentesDeOcupacion, elegirRanuraReadquisicion } from './utils/remoteCameraSlots.mjs';
import { esEtiquetaLenteNoEstandar } from './utils/remoteCameraLens.mjs';
import { componerFuentesPrograma } from './utils/nativeProgramSources.mjs';
import { debeMontarOverlayPrompter, maximoDesplazamientoPrompter, acotarDesplazamientoPrompter } from './utils/teleprompter.mjs';
import { buildStreamDestinations } from './utils/streamDestinations.mjs';
import { useCintilloRotation } from './hooks/useCintilloRotation.js';

// Componentes y Configuración de Música y Efectos importados desde PODCASTUDIO
import MusicBank from './components/MusicBank.jsx';
import { MUSIC_TRACKS, MUSIC_SFX, MUSIC_GENRES, SFX_CATEGORIES } from './config/musicTracks.js';
import { useBackgroundMusic } from './hooks/useBackgroundMusic.js';
import { useSoundEffect } from './hooks/useSoundEffect.js';
import { 
  startBroadcastEngine, updateBroadcastState, stopBroadcastEngine,
  captureMasterCanvasSnapshot, getMasterCanvas, getProgramStream, hasMasterCanvasPresentedFrames,
  setVoiceMonitor, syncStudioAudio, getCameraSnapshots,
  startNativeEngineBroadcast, stopNativeEngineBroadcast,
  getActiveInitHeader,
  setProgramFrameTap, switchEngineToWebmChunks, setProgramSize,
  registerCameraVideoElement, getCameraFrameHealth,
  getCompositionGovernorState, getRenderDiagStats,
  setNativeWindowDiet,
} from './utils/masterBroadcastEngine.js';
import { probeProgramEncoderSupport, createProgramEncoderPump } from './utils/programEncoder.js';
import { PROGRAM_PROFILE_IDS, DEFAULT_PROGRAM_PROFILE_ID, getProgramProfile, isUplinkCapped } from './utils/programProfiles.mjs';
import { USB_OPEN_TIERS, nextUsbTierDown, decideUsbOpenTier } from './utils/usbBudget.mjs';
import { logger } from './utils/logger.js';
import { version as APP_VERSION } from '../package.json';
import { isNativeEngineEnabled, getNativeEngineConfig, FEATURE_FLAGS } from './config/featureFlags.js';
import { VOICE_EFFECTS } from './utils/voiceEffectsProcessor.js';
import { createStreamTransport } from './utils/streamTransport.js';
import { supabase } from './lib/supabase.js';

// Componentes y Configuración de Fase P1 (Workspaces y Telemetría)
import { WORKSPACES, getWorkspaceById } from './config/workspaces.js';
import WorkspaceSelector from './components/WorkspaceSelector.jsx';
import StreamingTelemetryPill from './components/StreamingTelemetryPill.jsx';
import { useNumpadSfx } from './hooks/useNumpadSfx.js';

// Componentes y Configuración de Fase P2.4 / P3.1 (Hardware Tally Lights & Live Highlights)
import TallySettingsModal from './components/TallySettingsModal.jsx';
import { useLiveHighlights } from './hooks/useLiveHighlights.js';

// Componentes y Configuración de Fase P3.2 (Teleprompter Broadcast & Soundboard Pad)
// v3.2.1: BroadcastTeleprompter (la ventana flotante) ya no se importa:
// su uso como ventana sobre el programa quedó desmontado — el HUD es el
// overlay de solo-texto sobre el monitor. El componente queda en el repo.
import SoundboardQuickPad from './components/SoundboardQuickPad.jsx';

// Componentes y Configuración de Fase P3.3 (Sala Multi-Invitados & Auto-Cintillo por Voz)
import MultiGuestRoomModal from './components/MultiGuestRoomModal.jsx';
import { useAutoSpeakerCintillo } from './hooks/useAutoSpeakerCintillo.js';

// Componentes y Configuración de Fase P4.3 & P4.4 (Instant Replay & Salida LAN Program)
import { useInstantReplay } from './hooks/useInstantReplay.js';
import InstantReplayControl from './components/InstantReplayControl.jsx';
import LanProgramOutputModal from './components/LanProgramOutputModal.jsx';
import ConnectedCamerasModal from './components/ConnectedCamerasModal.jsx';
import PgmFeedCanvas from './components/PgmFeedCanvas.jsx';
import CameraNameBadgeModal from './components/CameraNameBadgeModal.jsx';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    logger.error('[ErrorBoundary]', error, errorInfo);
    if (window.api?.logError) {
      window.api.logError(error.message, error.stack, errorInfo?.componentStack);
    }
  }
  reset = () => { this.setState({ hasError: false, error: null, errorInfo: null }); };
  render() {
    if (this.state.hasError) return (
      <div style={{ color: '#f87171', padding: '20px', backgroundColor: '#1a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <h1>⚠️ Error en la aplicación</h1>
        <pre style={{ whiteSpace: 'pre-wrap', maxWidth: '600px' }}>{this.state.error?.toString() || 'Error desconocido'}</pre>
        <button onClick={this.reset} style={{ marginTop: '16px', padding: '8px 16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Reintentar</button>
      </div>
    );
    return this.props.children;
  }
}

const VideoTile = React.forwardRef(({
  stream,
  isLocal,
  muted,
  label,
  speakerMuted,
  onToggleSpeaker,
  micMuted,
  onToggleMic,
  className,
  onClick,
  style,
  chromaKey,
  bgImage,
  isActive = true,
  camId = null,
  registerWithEngine = false,
  frozen = false,
  objectFit = 'cover'
}, ref) => {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!stream) {
      if (v.srcObject) {
        try { v.srcObject = null; } catch (e) {}
      }
      return;
    }
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    if (v.srcObject !== stream) {
      v.srcObject = stream;
    }
    const attemptPlay = () => {
      if (v && v.paused) {
        v.play().catch(() => {});
      }
    };
    attemptPlay();
    const keepAliveCleanup = bindVideoKeepAlive(v);

    v.addEventListener('loadedmetadata', attemptPlay);
    v.addEventListener('loadeddata', attemptPlay);
    v.addEventListener('canplay', attemptPlay);

    // Track unmute listeners for tracks that already exist
    const unmuteCbs = new Map();
    const wireTrackListeners = (track) => {
      if (unmuteCbs.has(track.id)) return;
      const cb = () => attemptPlay();
      unmuteCbs.set(track.id, { track, cb });
      track.addEventListener('unmute', cb);
    };
    const initialTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
    initialTracks.forEach(wireTrackListeners);

    // When stable stream adds a new track, also wire its unmute listener
    const onAddTrack = (evt) => {
      if (evt.track) wireTrackListeners(evt.track);
      attemptPlay();
    };
    if (stream.addEventListener) {
      stream.addEventListener('addtrack', onAddTrack);
    }

    // Safety polling: retry play() every 500ms for 10s to handle edge cases
    let pollCount = 0;
    const pollTimer = setInterval(() => {
      pollCount++;
      if (pollCount > 20) { clearInterval(pollTimer); return; }
      if (v && v.paused && v.srcObject && v.srcObject.getVideoTracks().some(t => t.readyState === 'live')) {
        v.play().catch(() => {});
      }
    }, 500);

    return () => {
      clearInterval(pollTimer);
      keepAliveCleanup();
      v.removeEventListener('loadedmetadata', attemptPlay);
      v.removeEventListener('loadeddata', attemptPlay);
      v.removeEventListener('canplay', attemptPlay);
      unmuteCbs.forEach(({ track, cb }) => {
        try { track.removeEventListener('unmute', cb); } catch {}
      });
      unmuteCbs.clear();
      if (stream.removeEventListener) {
        try { stream.removeEventListener('addtrack', onAddTrack); } catch {}
      }
    };
  }, [stream, videoRef]);

  // A3: la miniatura visible registrada es LA fuente del compositor para esa
  // cámara: el motor dibuja desde este mismo elemento y no crea un <video>
  // oculto duplicado que vuelva a decodificar el stream 1080p.
  useEffect(() => {
    if (!registerWithEngine || camId == null || !stream) return undefined;
    const el = videoRef.current;
    if (!el) return undefined;
    try { registerCameraVideoElement(camId, el); } catch (e) {}
    return () => { try { registerCameraVideoElement(camId, null); } catch (e) {} };
  }, [stream, camId, registerWithEngine, videoRef]);

  const isMuted = muted !== undefined ? muted : isLocal;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted && videoRef.current.paused) {
        videoRef.current.play().catch(e => logger.log("Audio un-mute play error:", e));
      }
    }
  }, [isMuted, videoRef]);

  return (
    <div className={`relative overflow-hidden bg-[#050505] flex items-center justify-center ${className} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {chromaKey && bgImage && <img src={bgImage} className="absolute inset-0 w-full h-full object-cover z-0" alt="Virtual BG" />}
      {stream ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={isMuted} 
          onLoadedMetadata={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => {}); }}
          onCanPlay={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => {}); }}
          className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${chromaKey ? 'relative z-10 mix-blend-screen' : ''}`} 
          style={{...style, filter: chromaKey ? `${style?.filter || ''} contrast(1.5) brightness(1.1)` : style?.filter }} 
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 w-full h-full bg-[#111] z-10">
          <Camera size={24} className="mb-2 opacity-50" />
          <span className="text-[10px] uppercase tracking-wider">Sin señal</span>
        </div>
      )}
      {label && <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold z-20 border border-[#333] text-white flex items-center gap-1">{label}</div>}
      {frozen && stream && <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600/90 px-2 py-0.5 rounded text-[10px] font-bold z-20 border border-red-300 text-white flex items-center gap-1">CONGELADA</div>}

      {/* CONTROLES VISIBLES DIRECTAMENTE EN LA PANTALLA/RECUADRO DE CADA CÁMARA */}
      {(onToggleSpeaker || onToggleMic) && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20 pointer-events-auto">
          {onToggleSpeaker && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSpeaker();
              }}
              className={`p-1.5 rounded-full flex items-center justify-center transition-all backdrop-blur-md shadow-md cursor-pointer ${
                speakerMuted
                  ? 'bg-red-600/95 text-white border border-red-400 hover:bg-red-700 hover:scale-105'
                  : 'bg-emerald-600/90 text-white border border-emerald-400 hover:bg-emerald-700 hover:scale-105'
              }`}
              title={speakerMuted ? 'Bocina silenciada en este recuadro · Clic para escuchar audio' : 'Bocina activa · Clic para silenciar y no viciar sonido'}
            >
              {speakerMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          )}
          {onToggleMic && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleMic();
              }}
              className={`p-1.5 rounded-full flex items-center justify-center transition-all backdrop-blur-md shadow-md cursor-pointer ${
                micMuted
                  ? 'bg-red-600/95 text-white border border-red-400 hover:bg-red-700 hover:scale-105'
                  : 'bg-black/70 text-emerald-400 border border-emerald-500/50 hover:bg-black/90 hover:scale-105'
              }`}
              title={micMuted ? 'Micrófono silenciado · Clic para activar' : 'Micrófono activo · Clic para silenciar'}
            >
              {micMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// PGM = canvas maestro: cuando el motor ya presentó fotogramas, el monitor de
// programa muestra el stream del canvas (con escena, overlays y cintillos tal
// como salen en grabación/streaming, no el <video> crudo). Su estado vive en
// este componente, no en la raíz: sondea hasMasterCanvasPresentedFrames() y
// solo se re-renderiza él. Si el canvas aún no tiene fotogramas, no pinta
// nada y debajo quedan los VideoTile directos como respaldo.
const MasterProgramMonitor = React.memo(function MasterProgramMonitor() {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Auditoría de fluidez (E): este intervalo de 500 ms vive en la hoja
    // MasterProgramMonitor, no en la raíz; además solo publica si el valor
    // cambió, así que en reposo no re-renderiza ni siquiera esta hoja.
    const check = () => {
      const next = hasMasterCanvasPresentedFrames();
      setReady(prev => (prev === next ? prev : next));
    };
    check();
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready) return;
    try {
      const programStream = getProgramStream();
      if (programStream && v.srcObject !== programStream) v.srcObject = programStream;
      if (v.paused) v.play().catch(() => {});
    } catch (e) {}
  }, [ready]);

  if (!ready) return null;
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full object-cover z-40 pointer-events-none"
    />
  );
});

// ── Apertura USB con constraints probadas (v1.6.1) + presupuesto (v2.0.0) ──
// La v1.6.0 medía cada cámara ~900 ms tras abrirla y persistía el escalón
// resultante; medir bajo carga degradó cámaras sanas y el perfil guardado
// fijó la principal del usuario en 854×480. v1.6.1 volvió a la apertura
// directa. v2.0.0 (Raíz B) suma el presupuesto de bus de usbBudget.mjs:
// el escalón de apertura lo decide decideUsbOpenTier() desde las cámaras
// YA vivas (máx. 2 a 1080p a la vez) — decisión previa, sin medir fps,
// sin persistir rebajas — y ante OverconstrainedError hay UN solo
// reintento en el escalón inferior.
async function openProvenUsbStream(deviceId, gumTimeout, tier = '1080p') {
  const constraintsFor = (t) => ({
    video: { deviceId: { exact: deviceId }, ...USB_OPEN_TIERS[t] },
    audio: false,
  });
  try {
    return await gumTimeout(constraintsFor(tier), 6000);
  } catch (err) {
    if (err?.name !== 'OverconstrainedError') throw err;
    return await gumTimeout(constraintsFor(nextUsbTierDown(tier)), 6000);
  }
}

// v1.7.0 (Raíz A): codificación de miniatura SIN bloquear el hilo de UI.
// El camino de Detener hacía snapshotCanvas.toDataURL('image/jpeg', 0.92)
// SÍNCRONO a 1920×1080: codificar un JPEG de 2 MP en el hilo principal,
// con la máquina ya saturada, era trabajo pesado síncrono en el camino
// del clic. Esta versión reduce a 640 px de ancho y codifica con
// canvas.toBlob (asíncrono) + FileReader (asíncrono). Nunca lanza.
function canvasToJpegDataUrl(sourceCanvas, maxWidth = 640) {
  return new Promise((resolve) => {
    try {
      if (!sourceCanvas || !sourceCanvas.width) return resolve(null);
      const scale = Math.min(1, maxWidth / sourceCanvas.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sourceCanvas.width * scale));
      c.height = Math.max(1, Math.round(sourceCanvas.height * scale));
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(sourceCanvas, 0, 0, c.width, c.height);
      if (typeof c.toBlob === 'function') {
        c.toBlob((blob) => {
          if (!blob) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.85);
      } else {
        resolve(c.toDataURL('image/jpeg', 0.85));
      }
    } catch { resolve(null); }
  });
}

const defaultCamSettings = { zoom: 1.0, panX: 50, panY: 50, brightness: 100, contrast: 100, saturation: 100, temp: 0, tint: 0, luts: 'Original' };

function PodcastStudioApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [isStoppingRecordingUI, setIsStoppingRecordingUI] = useState(false);
  // B2-ui: progreso real del cierre de grabación (etapa + percent que envía
  // el proceso principal vía onFinalizeProgress; percent puede ser null).
  const [finalizeProgress, setFinalizeProgress] = useState(null);
  // A4: cámaras congeladas según getCameraFrameHealth() (mapa camId -> true).
  const [frozenCams, setFrozenCams] = useState({});
  const frozenCamsRef = useRef({});
  // Cola global de apertura USB (una negociación UVC a la vez).
  const usbOpenQueueRef = useRef(Promise.resolve());

  // v1.6.1: borrar una sola vez los perfiles de captura que la v1.6.0
  // persistió en localStorage (un perfil degradado fijó la cámara principal
  // del usuario en 854×480 en cada arranque).
  useEffect(() => {
    try { localStorage.removeItem('podcastudio_capture_profiles'); } catch (e) {}
  }, []);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMasterGrid, setShowMasterGrid] = useState(false);
  const [recordedVideoData, setRecordedVideoData] = useState(null);
  const recordingChunksRef = useRef([]);
  const recordingCountdownTimersRef = useRef([]);
  const recordingStartPendingRef = useRef(false);
  const recordingStopPendingRef = useRef(false);
  const isRecordingPausedRef = useRef(false);
  const isCancelingRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef(null);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef(null);
  // Contador de fragmentos SOLO del modo web (sin Electron): con Electron
  // la grabación vive en el núcleo y el conteo lo lleva el proceso
  // principal (bytesWritten del consumidor).
  const recordingChunkCountRef = useRef(0);

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const togglePanel = (panel) => setActivePanel(activePanel === panel ? '' : panel);
  const [voiceEffect, setVoiceEffect] = useState('normal');
  const [voiceTarget, setVoiceTarget] = useState('all'); // 'all' | 'master'
  const [voiceMonitorActive, setVoiceMonitorActive] = useState(false);

  const toggleVoiceMonitor = () => {
    setVoiceMonitorActive(prev => {
      const next = !prev;
      setVoiceMonitor(next);
      updateBroadcastState({ voiceMonitor: next });
      return next;
    });
  };

  const handleSelectVoiceEffect = (effectId) => {
    setVoiceEffect(effectId);
    if (effectId !== 'normal') {
      setVoiceMonitorActive(true);
      setVoiceMonitor(true);
      updateBroadcastState({ voiceEffect: effectId, voiceTarget, voiceMonitor: true });
    } else {
      updateBroadcastState({ voiceEffect: effectId, voiceTarget });
    }
  };

  const handleSelectVoiceTarget = (target) => {
    setVoiceTarget(target);
    updateBroadcastState({ voiceEffect, voiceTarget: target });
  };

  const [camSlots, setCamSlots] = useState([1, 2, 3, 4]); 
  const camSlotsRef = useRef(camSlots);
  useEffect(() => { camSlotsRef.current = camSlots; }, [camSlots]);
  const [activeCam, setActiveCam] = useState(1);
  const prevActiveCamRef = useRef(1);
  useEffect(() => {
    prevActiveCamRef.current = activeCam;
  }, [activeCam]);
  const [layoutMode, setLayoutMode] = useState('1'); 
  const [pipCam, setPipCam] = useState(2); 
  const [camThumbnails, setCamThumbnails] = useState({}); 

  // CONSOLA DE AUDIO BROADCAST PROFESIONAL (P0.4)
  const [showAudioMixerModal, setShowAudioMixerModal] = useState(false);

  // MODO DUAL PREVIEW (PVW) / PROGRAM (PGM) BROADCAST SWITCHER (P0.3)
  const [dualMonitorMode, setDualMonitorMode] = useState(false);
  const [pvwCam, setPvwCam] = useState(2);
  const [transitionDuration, setTransitionDuration] = useState(500); // 500ms
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [tBarPosition, setTBarPosition] = useState(0); // 0 a 1

  // HARDWARE & LAN TALLY LIGHTS (P2.4)
  const [showTallyModal, setShowTallyModal] = useState(false);

  // TELEPROMPTER BROADCAST & SOUNDBOARD EN CABINA (P3.2)
  // v3.3.4: el interruptor HUD CONSERVA su estado entre sesiones
  // (localStorage, mismo patrón que los rótulos de cámara): hasta la
  // v3.3.3 era un useState(false) sin persistencia y cada arranque
  // nacía con el HUD apagado aunque Luis lo hubiera dejado encendido
  // — en vivo se leyó como «el teleprompter desapareció de la cámara
  // máster». Primera vez en la vida de la app: apagado.
  const [showFloatingPrompter, setShowFloatingPrompter] = useState(() => {
    try { return localStorage.getItem('podcastudio_teleprompter_hud') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('podcastudio_teleprompter_hud', showFloatingPrompter ? '1' : '0'); } catch (e) {}
  }, [showFloatingPrompter]);
  const [showSoundboardPad, setShowSoundboardPad] = useState(false);

  // SALA MULTI-INVITADOS & AUTO-CINTILLO (P3.3)
  const [showMultiGuestModal, setShowMultiGuestModal] = useState(false);
  const [autoSpeakerCintilloEnabled, setAutoSpeakerCintilloEnabled] = useState(false);

  // GRABACIÓN ISO MULTICANAL (PISTAS INDEPENDIENTES POR CÁMARA) (P4.1)
  const [isoRecordingEnabled, setIsoRecordingEnabled] = useState(false);
  const isoRecordersRef = useRef(new Map()); // slotNum -> MediaRecorder
  const isoChunkQueuesRef = useRef(new Map()); // slotNum -> Promise

  const [editingCamId, setEditingCamId] = useState(1);
  const [camSettings, setCamSettings] = useState({
    1: { ...defaultCamSettings }, 2: { ...defaultCamSettings }, 3: { ...defaultCamSettings }, 4: { ...defaultCamSettings }
  });

  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [mobileStatus, setMobileStatus] = useState('');
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false); 
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectModalSlot, setConnectModalSlot] = useState(0);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [cameraMeta, setCameraMeta] = useState({});
  const cameraMetaRef = useRef(cameraMeta);
  useEffect(() => { cameraMetaRef.current = cameraMeta; }, [cameraMeta]);
  const [slotStreams, setSlotStreams] = useState({});
  const slotStreamsRef = useRef(slotStreams);
  useEffect(() => { slotStreamsRef.current = slotStreams; }, [slotStreams]);

  // Abrir modal de conexión dirigiendo automáticamente a la primera ranura libre
  const handleOpenConnectModal = useCallback((slotNumber) => {
    let target = typeof slotNumber === 'number' ? slotNumber : (activeCam - 1);
    // v3.3.4: una ranura con cámara prestada al motor cuenta como
    // ocupada también al sugerir el destino del modal de conexión.
    const isOccupied = (s) => Boolean(slotStreamsRef.current[s]) || Boolean(cameraMetaRef.current[s]?.deviceId || cameraMetaRef.current[s]?.url) || Boolean(nativeReleasedCamsRef.current?.[s]);
    if (isOccupied(target)) {
      for (let s = 0; s < 12; s++) {
        if (!isOccupied(s)) {
          target = s;
          break;
        }
      }
    }
    if (target >= (camSlotsRef.current?.length || 4) && target < 12) {
      const newSlots = Array.from({ length: target + 1 }, (_, i) => i + 1);
      setCamSlots(newSlots);
      camSlotsRef.current = newSlots;
    }
    setConnectModalSlot(target);
    setShowConnectModal(true);
  }, [activeCam]);

  // NOTIFICACIONES TOAST FLOTANTES NO BLOQUEANTES (Cero congelamientos de UI por alert)
  const [toastNotification, setToastNotification] = useState(null);
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastNotification({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, duration);
  }, []);

  // RÓTULOS DE NOMBRE INDIVIDUALES POR CÁMARA (RESTRAM / LOWER THIRDS PARA INVITADOS O CLASES)
  const [cameraBadges, setCameraBadges] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_camera_badges');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [badgeModalSlot, setBadgeModalSlot] = useState(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  const handleSaveCameraBadge = useCallback((camId, badge) => {
    setCameraBadges(prev => {
      const next = { ...prev, [camId]: badge };
      try {
        localStorage.setItem('podcastudio_camera_badges', JSON.stringify(next));
      } catch (e) {}
      updateBroadcastState({ cameraBadges: next });
      return next;
    });
  }, []);

  useEffect(() => {
    updateBroadcastState({ cameraBadges });
  }, [cameraBadges]);

  const [showRemoteControlModal, setShowRemoteControlModal] = useState(false);
  const [remoteControlTab, setRemoteControlTab] = useState('web'); // 'web' | 'lan'
  const [remoteControlQrImage, setRemoteControlQrImage] = useState('');
  const [remoteControlUrl, setRemoteControlUrl] = useState('https://www.podcastudio.mx/control?room=master_studio');
  const [lanControlUrl, setLanControlUrl] = useState('');

  // Gestión de Cámaras Guardadas y Conectadas (Persistentes)
  const [showConnectedCamerasModal, setShowConnectedCamerasModal] = useState(false);
  const [savedCameras, setSavedCameras] = useState(() => {
    try {
      const stored = localStorage.getItem('podcastudio_saved_cameras');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const saveCameraToHistory = useCallback((camera) => {
    if (!camera) return;
    setSavedCameras(prev => {
      const filtered = prev.filter(c => {
        if (camera.url && c.url === camera.url) return false;
        if (camera.deviceId && c.deviceId === camera.deviceId) return false;
        if (camera.id && c.id === camera.id) return false;
        return true;
      });
      const newEntry = {
        id: camera.id || camera.deviceId || camera.url || `cam_${Date.now()}`,
        name: camera.label || camera.name || 'Cámara Conectada',
        type: camera.type || 'usb',
        url: camera.url || null,
        deviceId: camera.deviceId || null,
        // v3.3.1 (defecto 2): la ranura donde quedó conectada — al
        // reconectar, una cámara conocida recupera SU ranura si está
        // libre (regla b de chooseReconnectCameraSlot).
        slot: Number.isInteger(camera.slot) ? camera.slot : null,
        lastUsed: new Date().toISOString()
      };
      const updated = [newEntry, ...filtered].slice(0, 30);
      try {
        localStorage.setItem('podcastudio_saved_cameras', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const handleForgetCamera = useCallback((camIdOrKey) => {
    setSavedCameras(prev => {
      const updated = prev.filter(c => c.id !== camIdOrKey && c.deviceId !== camIdOrKey && c.url !== camIdOrKey);
      try {
        localStorage.setItem('podcastudio_saved_cameras', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  useEffect(() => {
    if (window.api?.getLocalControlUrl) {
      window.api.getLocalControlUrl().then(url => {
        if (url) setLanControlUrl(url);
      }).catch(() => {});
    }
  }, []);

  const activeQrTargetUrl = remoteControlTab === 'lan' && lanControlUrl
    ? lanControlUrl
    : 'https://www.podcastudio.mx/control?room=master_studio';

  useEffect(() => {
    QRCode.toDataURL(activeQrTargetUrl, { 
      width: 320, 
      margin: 3, 
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' } 
    })
      .then(img => setRemoteControlQrImage(img))
      .catch(() => {});
  }, [activeQrTargetUrl]);

  const assignedSlotsRef = useRef({});
  // v3.3.1 (defecto 1): sala cloud → ranura donde el stream quedó
  // COLOCADO de verdad (si la de la sala estaba ocupada por otra
  // fuente, la remota se reubica a la primera libre; la desconexión de
  // la sala debe limpiar la ranura colocada, no la de la sala).
  const colocacionCloudRef = useRef({});
  const controlChannelRef = useRef(null);
  const cloudTransportRef = useRef(null);
  const recordingStartPendingTimeRef = useRef(0);
  const activeCamRef = useRef(activeCam);
  useEffect(() => { activeCamRef.current = activeCam; }, [activeCam]);
  const isElectronMaster = typeof window !== 'undefined' && Boolean(window.api);
  const remoteWsRef = useRef(null);

  // Enviar comando desde el iPad a la PC Máster vía LAN WebSocket y Supabase
  const dispatchRemoteCommand = useCallback((type, data = {}) => {
    const payload = { type, sender: 'ipad_extension', timestamp: Date.now(), ...data };
    if (remoteWsRef.current && remoteWsRef.current.readyState === 1) {
      try {
        remoteWsRef.current.send(JSON.stringify({ type: 'remote-command', payload }));
      } catch (e) {}
    }
    if (controlChannelRef.current) {
      try {
        controlChannelRef.current.send({
          type: 'broadcast',
          event: 'studio_command',
          payload
        }).catch(() => {});
      } catch (e) {}
    }
  }, []);

  const showCustomRef = useRef(null);

  // Actualizar estado del iPad con la información en vivo de la PC Máster
  const applyRemoteStudioState = useCallback((s) => {
    if (!s) return;
    if (s.activeCam !== undefined) setActiveCam(Number(s.activeCam));
    if (s.pvwCam !== undefined) setPvwCam(Number(s.pvwCam));
    if (s.pipCam !== undefined) setPipCam(Number(s.pipCam));
    if (s.layoutMode !== undefined) setLayoutMode(String(s.layoutMode));
    if (s.isRecording !== undefined) {
      setIsRecording(Boolean(s.isRecording));
      isRecordingRef.current = Boolean(s.isRecording);
    }
    if (s.recordingTime !== undefined) setRecordingTime(Number(s.recordingTime));
    if (s.isStreaming !== undefined) {
      setIsStreaming(Boolean(s.isStreaming));
      isStreamingRef.current = Boolean(s.isStreaming);
    }
    if (s.streamDuration !== undefined) setStreamDuration(Number(s.streamDuration));
    if (s.topic !== undefined) setTopic(s.topic);
    if (s.cintillosVisible !== undefined) setCintillosVisible(Boolean(s.cintillosVisible));
    if (s.cintillo !== undefined && showCustomRef.current) {
      showCustomRef.current(s.cintillo);
    }
    if (s.camSlots !== undefined && Array.isArray(s.camSlots) && s.camSlots.length > 0) {
      setCamSlots(s.camSlots.map(Number));
    }
    if (s.tBarPosition !== undefined) setTBarPosition(Number(s.tBarPosition));
    if (s.camMuted !== undefined) setCamMuted(s.camMuted);
    if (s.teleprompter) {
      if (s.teleprompter.text !== undefined) setTeleprompterText(s.teleprompter.text);
      if (s.teleprompter.speed !== undefined) setTeleprompterSpeed(Number(s.teleprompter.speed));
      if (s.teleprompter.fontSize !== undefined) setTeleprompterFontSize(Number(s.teleprompter.fontSize));
      if (s.teleprompter.isPlaying !== undefined) setIsTeleprompterPlaying(Boolean(s.teleprompter.isPlaying));
    }
  }, []);
  const [showCalibratorModal, setShowCalibratorModal] = useState(false);
  const [calibratorTargetSlot, setCalibratorTargetSlot] = useState(0);
  const [camFocusLocked, setCamFocusLocked] = useState({});
  // v1.7.0 (Raíz D): estado HONESTO del foco por cámara, confirmado contra
  // la pista: { supported:false, message } cuando la cámara no expone
  // control de foco o el driver no lo aplicó; { supported:true,
  // focusMode, unconfirmed? } cuando la pista lo confirmó (o aceptó la
  // llamada sin ofrecer lectura de vuelta).
  const [camFocusStatus, setCamFocusStatus] = useState({});
  const [cameraCrops, setCameraCrops] = useState(() => {
    const saved = localStorage.getItem('podcastudio_camera_crops');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(k => {
            if (parsed[k]?.zoom != null) {
              parsed[k].zoom = Math.max(1.0, parsed[k].zoom);
            }
            // Older versions stored colour fields as soon as the calibration
            // window was opened.  Those fields must not alter a camera until
            // the operator explicitly saves a colour correction again.
            if (parsed[k]) parsed[k].colorEnabled = parsed[k].colorEnabled === true;
          });
        }
        return parsed;
      } catch (e) {}
    }
    return {};
  });
  const [camMuted, setCamMuted] = useState({ 1: false, 2: true, 3: true, 4: true });
  // Control de retorno de audio local (bocina / parlante de monitoreo en estudio para cada cámara)
  // POR SEGURIDAD: Silenciado por defecto en todas las cámaras para evitar retroalimentación ("vicio/acople")
  // El usuario puede activar la bocina manualmente con el botón de cada ranura si cuenta con audífonos.
  const [camSpeakerMuted, setCamSpeakerMuted] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true, 9: true, 10: true, 11: true, 12: true });

  // AFV (Audio Follows Video): Solo el micrófono de la cámara activa al aire (PGM) está abierto.
  // Todas las demás cámaras permanecen silenciadas en la línea de tiempo inferior para evitar
  // retroalimentación ("vicios"), eco de sala y que el micrófono de la computadora se cuele en las tomas remotas.
  useEffect(() => {
    setCamMuted(prev => {
      const next = { ...prev };
      const currentSlots = Array.isArray(camSlots) && camSlots.length > 0 ? camSlots : [1, 2, 3, 4];
      currentSlots.forEach(id => {
        if (layoutMode === '1') {
          next[id] = id !== activeCam;
        } else if (layoutMode === 'pip') {
          next[id] = id !== activeCam && id !== pipCam;
        } else if (layoutMode === '2' || layoutMode === 'two-shot') {
          next[id] = id !== currentSlots[0] && id !== currentSlots[1];
        } else if (layoutMode === '3') {
          next[id] = id !== currentSlots[0] && id !== currentSlots[1] && id !== currentSlots[2];
        } else if (layoutMode === '4') {
          next[id] = id !== currentSlots[0] && id !== currentSlots[1] && id !== currentSlots[2] && id !== currentSlots[3];
        }
      });
      return next;
    });
  }, [activeCam, layoutMode, pipCam, camSlots]);


  // ZOOM DINÁMICO & ENCUADRE DE CÁMARA (PAN/DRAG) EN MONITOR MASTER
  const [zoomHud, setZoomHud] = useState({ visible: false, zoom: 1.0 });
  const zoomHudTimeoutRef = useRef(null);
  const [panHud, setPanHud] = useState({ visible: false, x: 50, y: 50 });
  const panHudTimeoutRef = useRef(null);
  const [isDraggingMaster, setIsDraggingMaster] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const masterMonitorRef = useRef(null);

  // TELEPROMPTER BROADCAST PROFESIONAL (ESTRUCTURA HUD COMPLETA EN PANEL DERECHO)
  const [teleprompterText, setTeleprompterText] = useState('Hoy hablamos de: El futuro del podcasting y la IA\n\nCon nosotros: Invitado Especial\n\nIntroduce el tema, desarrolla los puntos clave y cierra con una llamada a la acción.');
  const [isTeleprompterPlaying, setIsTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2.0);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(36);
  const [prompterEditMode, setPrompterEditMode] = useState(false);
  const [prompterMirrorH, setPrompterMirrorH] = useState(false);
  const [prompterEyeline, setPrompterEyeline] = useState(true);
  const [prompterCopiedLink, setPrompterCopiedLink] = useState(false);
  const teleprompterTextRef = useRef(null);
  const teleprompterOverlayRef = useRef(null);
  // v3.3.2 — RECONSTRUCCIÓN DEL TELEPROMPTER (orden de Luis): UN solo
  // estado (el de arriba: showFloatingPrompter = HUD, isTeleprompterPlaying,
  // teleprompterSpeed, teleprompterFontSize, teleprompterText — panel y
  // overlay leen y escriben ESE estado, sin paralelos) y UN solo reloj:
  // teleprompterYRef es el DESPLAZAMIENTO canónico del guion, en píxeles
  // recorridos (≥ 0, CRECE mientras reproduce), ACOTADO al recorrido real
  // del texto en las superficies montadas (src/utils/teleprompter.mjs).
  // Fuera de aquí quedaron: la segunda compuerta del montaje
  // (teleprompterHideInRec, siempre true y sin control: el overlay no se
  // montaba grabando aunque el HUD estuviera encendido), el acumulador
  // propio de la caja (rightPrompterScrollPos) y su rAF «puerto seguro»,
  // y el acumulador zombi panelPrompterScrollRef que se escribía en los
  // resets y no se leía en ninguna parte. El log de la v3.3.0 lo probó:
  // HUD OFF y overlay AUSENTE en 551/551 muestras mientras el reloj corría
  // sin cota hasta y=12437 con un guion de 29 palabras.
  const teleprompterYRef = useRef(0);
  const rightPrompterScrollRef = useRef(null);

  // v3.3.2 (modalidades): la región REAL de la cámara de programa (PGM)
  // en el layout vigente, medida sobre el DOM: el tile de la cámara
  // activa lleva data-pgm-tile="1" en CUALQUIER modalidad (1, pip, 2,
  // two-shot, 3, 4, 6, 6-lead, 8, 10, speaker, gallery) y su caja es la
  // franja del teleprompter. Sin tile (espejo iPad sin tiles), null y el
  // overlay conserva su geometría por defecto: todo el contenedor.
  const medirRegionPgmPrompter = (wrap) => {
    try {
      const scope = masterMonitorRef.current;
      const op = wrap?.offsetParent;
      if (!scope || !op) return null;
      const tile = scope.querySelector('[data-pgm-tile="1"]');
      if (!tile) return null;
      const r = tile.getBoundingClientRect();
      const o = op.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        left: r.left - o.left - (op.clientLeft || 0),
        top: r.top - o.top - (op.clientTop || 0),
        width: r.width,
        height: r.height,
      };
    } catch (e) { return null; }
  };

  // Proyección del reloj sobre el HUD del programa: primero coloca la
  // franja sobre la región PGM medida (en cualquier modalidad) y después
  // posiciona el texto: entra por el borde INFERIOR de la región
  // (translateY = altura de la región − desplazamiento; con
  // desplazamiento 0 la primera línea está a pie de video) y sale por
  // arriba (tope = −altura del texto). Se calcula desde el
  // desplazamiento SIEMPRE, así que da igual en qué orden pulse Luis
  // INICIAR y el interruptor HUD: al montar el overlay ya sale en la
  // posición que le corresponde del guion.
  const projectTeleprompterOverlay = () => {
    const el = teleprompterTextRef.current;
    if (!el || !el.parentElement) return;
    const wrap = el.parentElement;
    const region = medirRegionPgmPrompter(wrap);
    if (region) {
      wrap.style.left = `${region.left.toFixed(1)}px`;
      wrap.style.top = `${region.top.toFixed(1)}px`;
      wrap.style.width = `${region.width.toFixed(1)}px`;
      wrap.style.height = `${region.height.toFixed(1)}px`;
    }
    const stripH = el.parentElement.clientHeight || 0;
    const textH = el.scrollHeight || el.offsetHeight || 0;
    const y = Math.max(-textH, stripH - teleprompterYRef.current);
    el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
  };

  // Proyección del MISMO reloj sobre la caja de lectura del panel: su
  // scrollTop es el desplazamiento topado al recorrido real de la caja.
  // La caja conserva su comportamiento probado (desplaza y satura al
  // final del texto) porque su tope ES su recorrido: scrollHeight −
  // clientHeight.
  const projectTeleprompterPanel = () => {
    const panel = rightPrompterScrollRef.current;
    if (!panel) return;
    const max = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const target = Math.min(Math.floor(teleprompterYRef.current), max);
    if (target !== panel.scrollTop) panel.scrollTop = target;
  };

  // Recorrido real del guion según las superficies MONTADAS ahora mismo
  // (overlay y/o caja del panel); null si ninguna está montada — sin
  // superficie no hay recorrido medible y el reloj no avanza a ciegas.
  const medirMaximoDesplazamientoPrompter = () => {
    const el = teleprompterTextRef.current;
    const overlay = el && el.parentElement
      ? { franjaPx: el.parentElement.clientHeight || 0, textoPx: el.scrollHeight || el.offsetHeight || 0 }
      : null;
    const panel = rightPrompterScrollRef.current;
    return maximoDesplazamientoPrompter({
      overlay,
      panel: panel ? { scrollPx: panel.scrollHeight || 0, clientePx: panel.clientHeight || 0 } : null,
    });
  };

  const prompterWordCount = useMemo(() => {
    return (teleprompterText || '').trim().split(/\s+/).filter(Boolean).length;
  }, [teleprompterText]);
  const prompterEstMins = useMemo(() => {
    return Math.ceil(prompterWordCount / 130) || 1;
  }, [prompterWordCount]);

  // CONFIGURACIÓN DE STREAMING Y MULTI-STREAM
  const [streamConfigs, setStreamConfigs] = useState(() => {
    const defaults = {
      facebook: { server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: '', enabled: true },
      youtube: { server: 'rtmp://a.rtmp.youtube.com/live2/', key: '', enabled: false },
      tiktok: { server: 'rtmp://live.tiktok.com/live/', key: '', enabled: false },
      custom: { server: 'rtmp://live.twitch.tv/app/', key: '', enabled: false }
    };
    const saved = localStorage.getItem('podcastStudio_streamConfigs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.facebook?.server?.startsWith('rtmp://')) {
          parsed.facebook.server = parsed.facebook.server.replace('rtmp://', 'rtmps://');
        }
        return Object.fromEntries(Object.entries(defaults).map(([id, config]) => [id, { ...config, ...(parsed[id] || {}) }]));
      } catch(e) {}
    }
    return defaults;
  });
  useEffect(() => { localStorage.setItem('podcastStudio_streamConfigs', JSON.stringify(streamConfigs)); }, [streamConfigs]);

  const [activeLiveDestinations, setActiveLiveDestinations] = useState([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const streamDurationRef = useRef(0);
  useEffect(() => { streamDurationRef.current = streamDuration; }, [streamDuration]);
  const recordingTimeRef = useRef(0);
  useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);
  const isStreamingRef = useRef(false);
  const isRecordingRef = useRef(false);

  // SISTEMA DE AUDIO & EFECTOS (Importado de PODCASTUDIO)
  const [customTracks, setCustomTracks] = useState([]);
  const [customSfx, setCustomSfx] = useState([]);

  const combinedTracks = useMemo(() => [...customTracks, ...MUSIC_TRACKS], [customTracks]);
  const combinedSfx = useMemo(() => [...customSfx, ...MUSIC_SFX], [customSfx]);

  const music = useBackgroundMusic(combinedTracks, 25, { micLevel });
  const { playSfx, stopSfx, playingSfxId, sfxError } = useSoundEffect();

  const handleAddCustomTrack = (track) => {
    setCustomTracks(prev => [track, ...prev]);
    setTimeout(() => {
      music.selectTrackById(track.id, true);
    }, 50);
  };

  const handleAddCustomSfx = (sfxItem) => {
    setCustomSfx(prev => [sfxItem, ...prev]);
  };

  // SISTEMA DE CINTILLOS Y GRÁFICOS BROADCAST (Inicia desactivado por defecto)
  const [cintillosVisible, setCintillosVisible] = useState(false);
  const [cintilloStyle, setCintilloStyle] = useState('glass');
  const [cintilloPosition, setCintilloPosition] = useState('bl');
  const [autoRotateCintillos, setAutoRotateCintillos] = useState(false);
  const [randomRotateCintillos, setRandomRotateCintillos] = useState(false);
  const [showCintilloModal, setShowCintilloModal] = useState(false);
  const [showSocialsModal, setShowSocialsModal] = useState(false);
  const [socialTarget, setSocialTarget] = useState('guest'); // 'guest' | 'program'
  const [activeSocialTab, setActiveSocialTab] = useState('guest');

  // Soporte Multi-Conductor & Multi-Invitado Dinámico (Para mesas de 2, 3, 4 o más participantes)
  const [conductores, setConductores] = useState(() => {
    const saved = localStorage.getItem('podcastudio_conductores_v3');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, name: 'Luis Avilez', role: 'Conductor & Productor', instagram: '@luisavilez', youtube: '@luisavilez', tiktok: '', facebook: '' },
      { id: 2, name: 'Co-Conductor', role: 'Conductor', instagram: '', youtube: '', tiktok: '', facebook: '' }
    ];
  });
  const [activeConductorIdx, setActiveConductorIdx] = useState(0);

  const [invitados, setInvitados] = useState(() => {
    const saved = localStorage.getItem('podcastudio_invitados_v3');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, name: 'Invitado Especial', role: 'Especialista en IA & Media', instagram: '@invitado_oficial', youtube: '@invitado_oficial', tiktok: '', facebook: '' }
    ];
  });
  const [activeInvitadoIdx, setActiveInvitadoIdx] = useState(0);

  useEffect(() => {
    try { localStorage.setItem('podcastudio_conductores_v3', JSON.stringify(conductores)); } catch (e) {}
  }, [conductores]);

  useEffect(() => {
    try { localStorage.setItem('podcastudio_invitados_v3', JSON.stringify(invitados)); } catch (e) {}
  }, [invitados]);

  const hostName = conductores[activeConductorIdx]?.name || 'Luis Avilez';
  const hostRole = conductores[activeConductorIdx]?.role || 'Conductor & Productor';
  const guestName = invitados[activeInvitadoIdx]?.name || 'Invitado Especial';
  const guestRole = invitados[activeInvitadoIdx]?.role || 'Especialista en IA & Media';
  const setHostName = (val) => {
    setConductores(prev => prev.map((c, i) => i === activeConductorIdx ? { ...c, name: val } : c));
  };
  const setHostRole = (val) => {
    setConductores(prev => prev.map((c, i) => i === activeConductorIdx ? { ...c, role: val } : c));
  };
  const setGuestName = (val) => {
    setInvitados(prev => prev.map((g, i) => i === activeInvitadoIdx ? { ...g, name: val } : g));
  };
  const setGuestRole = (val) => {
    setInvitados(prev => prev.map((g, i) => i === activeInvitadoIdx ? { ...g, role: val } : g));
  };

  const [topic, setTopic] = useState('El futuro del podcast');
  const [contactPhone, setContactPhone] = useState('+52 667 491 2221');
  const [subContact, setSubContact] = useState('Atención directa & Consultas en vivo');
  const [promoCode, setPromoCode] = useState('Código: PODCAST24 · Descuento Exclusivo');
  const [subPromo, setSubPromo] = useState('Aprovecha la promoción del programa hoy');

  // Redes Oficiales del Programa
  const [socialYoutube, setSocialYoutube] = useState('@podcaststudio');
  const [subYoutube, setSubYoutube] = useState('Canal oficial · Suscríbete');
  const [socialInstagram, setSocialInstagram] = useState('@podcaststudio');
  const [subInstagram, setSubInstagram] = useState('Síguenos en Instagram');
  const [socialTiktok, setSocialTiktok] = useState('@podcaststudio');
  const [subTiktok, setSubTiktok] = useState('Contenido exclusivo en TikTok');
  const [socialFacebook, setSocialFacebook] = useState('/podcaststudio');
  const [subFacebook, setSubFacebook] = useState('Comunidad oficial en Facebook');

  // Redes del Invitado
  const [guestInstagram, setGuestInstagram] = useState('@invitado_oficial');
  const [guestInstagramSub, setGuestInstagramSub] = useState('Instagram oficial del invitado');
  const [guestYoutube, setGuestYoutube] = useState('@invitado_oficial');
  const [guestYoutubeSub, setGuestYoutubeSub] = useState('Canal de YouTube del invitado');
  const [guestTiktok, setGuestTiktok] = useState('@invitado_oficial');
  const [guestTiktokSub, setGuestTiktokSub] = useState('TikTok oficial del invitado');
  const [guestFacebook, setGuestFacebook] = useState('/invitado_oficial');
  const [guestFacebookSub, setGuestFacebookSub] = useState('Página oficial en Facebook');

  const [logoConfig, setLogoConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_logo_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      url: null,
      mediaType: 'image',
      position: 'top-left',
      scale: 100,
      opacity: 100,
    };
  });
  const [logoBase64, setLogoBase64] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_logo_config');
      if (saved) return JSON.parse(saved).url || null;
    } catch {}
    return null;
  });
  const [customCintillosList, setCustomCintillosList] = useState([]);

  // Redes activas según objetivo ('guest' o 'program')
  const currentYoutube = socialTarget === 'guest' ? (guestYoutube || '@invitado') : socialYoutube;
  const currentInstagram = socialTarget === 'guest' ? (guestInstagram || '@invitado') : socialInstagram;
  const currentTiktok = socialTarget === 'guest' ? (guestTiktok || '@invitado') : socialTiktok;
  const currentFacebook = socialTarget === 'guest' ? (guestFacebook || '/invitado') : socialFacebook;

  const currentYoutubeSub = socialTarget === 'guest' ? (guestYoutubeSub || `Canal de ${guestName}`) : subYoutube;
  const currentInstagramSub = socialTarget === 'guest' ? (guestInstagramSub || `Instagram de ${guestName}`) : subInstagram;
  const currentTiktokSub = socialTarget === 'guest' ? (guestTiktokSub || `TikTok de ${guestName}`) : subTiktok;
  const currentFacebookSub = socialTarget === 'guest' ? (guestFacebookSub || `Página de ${guestName}`) : subFacebook;

  // Proyecto memoizado para cintillos
  const projectConfig = useMemo(() => ({
    name: 'PodcastStudio',
    episodeTitle: topic,
    hostName: hostName,
    hostRole: hostRole,
    guestName: guestName,
    guestRole: guestRole,
    contactPhone: contactPhone,
    socialHandles: {
      youtube: currentYoutube,
      instagram: currentInstagram,
      tiktok: currentTiktok,
      facebook: currentFacebook,
    },
    cintilloStyle: cintilloStyle,
    cintilloLogoUrl: null,
    cintillos: {
      topic: topic,
      host: hostName,
      guest: guestName,
      contact: contactPhone,
      social_youtube: currentYoutube,
      social_instagram: currentInstagram,
      social_tiktok: currentTiktok,
      social_facebook: currentFacebook,
      promo: promoCode,
    },
    cintilloSubtitles: {
      topic: 'Episodio en vivo · Transmisión oficial',
      host: hostRole,
      guest: guestRole,
      contact: subContact,
      social_youtube: currentYoutubeSub,
      social_instagram: currentInstagramSub,
      social_tiktok: currentTiktokSub,
      social_facebook: currentFacebookSub,
      promo: subPromo,
    }
  }), [
    topic, hostName, hostRole, guestName, guestRole, contactPhone, subContact, promoCode, subPromo,
    currentYoutube, currentInstagram, currentTiktok, currentFacebook,
    currentYoutubeSub, currentInstagramSub, currentTiktokSub, currentFacebookSub,
    cintilloStyle
  ]);

  const {
    cintillo,
    animPhase,
    animKey,
    showManual,
    showCustom,
    hide: hideCintillo
  } = useCintilloRotation({
    project: projectConfig,
    enabled: cintillosVisible && autoRotateCintillos,
    displaySec: 7,
    masterPosition: cintilloPosition,
    randomRotation: randomRotateCintillos,
  });
  showCustomRef.current = showCustom;

  // ==========================================================================
  // MOTOR PODCASTUDIO — v3.0.0: motor propio. El núcleo del proceso
  // principal escribe el programa a un archivo maestro y los
  // consumidores leen de ahí. Aquí viven el perfil de programa elegido
  // (persistido) y la autoprueba del motor.
  // ==========================================================================
  const [programProfileId, setProgramProfileId] = useState(() => {
    try {
      const saved = localStorage.getItem('podcastudio_program_profile');
      if (saved && PROGRAM_PROFILE_IDS.includes(saved)) return saved;
    } catch (e) {}
    return DEFAULT_PROGRAM_PROFILE_ID;
  });
  const programProfile = getProgramProfile(programProfileId);
  const [selfTest, setSelfTest] = useState(null);
  const [selfTestBusy, setSelfTestBusy] = useState(false);
  const selfTestFlowRef = useRef(false);

  // ==========================================================================
  // MOTOR NATIVO (Hito 2, v3.1.0; botones reales en el Hito 3, v3.2.0):
  // estado del motor GStreamer hospedado en
  // el proceso principal (electron/native-engine.js). Llega por el puente
  // window.electronAPI.nativeEngine (preload.js) y por su evento de estado.
  // ==========================================================================
  const nativeStateRef = useRef(null);
  const [nativeEngineState, setNativeEngineState] = useState(null);
  useEffect(() => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return undefined;
    let cancelado = false;
    try { bridge.getState().then((s) => { if (!cancelado && s) { nativeStateRef.current = s; setNativeEngineState(s); } }).catch(() => {}); } catch (e) {}
    let off = null;
    try { off = bridge.onState?.((s) => { nativeStateRef.current = s; setNativeEngineState(s); }); } catch (e) {}
    return () => { cancelado = true; try { if (typeof off === 'function') off(); } catch (e) {} };
  }, []);

  // ==========================================================================
  // HITO 3 (v3.2.0): los BOTONES REALES (Grabar / Transmitir) gobiernan el
  // motor nativo cuando GStreamer está disponible (gstInstalled llega en
  // el estado del motor; el anfitrión lo resuelve al montar). Si NO está,
  // los botones usan la cadena anterior CON AVISO VISIBLE — nunca un
  // respaldo silencioso. La señal nativa es la cámara principal LIMPIA:
  // cintillos, logos y cambio de cámaras DENTRO de la señal nativa son
  // el hito siguiente. Las transiciones de sesión (grabar mientras se
  // transmite y viceversa) REINICIAN la tubería: la UI lo declara.
  // ==========================================================================
  const nativeFlagsRef = useRef({ forRecord: false, forStream: false });
  // v3.2.1: arranque PENDIENTE de confirmación por fase real del motor y
  // vigilante de muerte no ordenada (ver el sondeo confirmador y el
  // efecto vigilante más abajo). nativeBusyRef marca las transiciones ORDENADAS
  // (iniciar/detener desde los botones) para que el vigilante no las
  // confunda con una muerte del motor.
  const nativeBusyRef = useRef(false);
  const nativeStreamPendingRef = useRef(null);
  const nativeRecordPendingRef = useRef(null);
  const nativePendingSeqRef = useRef(0);
  const nativeStreamUrlsRef = useRef([]);
  const nativeStreamTargetsRef = useRef([]);
  const [nativeNotice, setNativeNotice] = useState('');
  const [nativeStreamError, setNativeStreamError] = useState('');
  const nativeGstAvailable = nativeEngineState?.gstInstalled === true;
  const nativeGstUnavailable = nativeEngineState?.gstInstalled === false;
  // v3.3.0: «modo motor» — la condición vigente que ya elige la cadena
  // nativa en los botones: GStreamer presente y sin grabación ISO (con
  // ISO manda la cadena heredada). Gobierna la dieta de la ventana (D1),
  // y el monitor de programa. (La banda D3 bajo el programa se eliminó
  // en la v3.3.2 por orden de Luis: el recuadro máster queda limpio.)
  const enModoMotor = nativeGstAvailable && !isoRecordingEnabled;

  // Espera a que el motor confirme la fase «apagado» (su parada valida
  // el máster antes de publicar el estado final).
  const esperarMotorApagado = async (timeoutMs = 20000) => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return null;
    const t0 = Date.now();
    let st = null;
    while (Date.now() - t0 < timeoutMs) {
      try { st = await bridge.getState(); } catch (e) {}
      if (st && st.phase === 'apagado') return st;
      await new Promise((r) => setTimeout(r, 300));
    }
    try { st = await bridge.getState(); } catch (e) {}
    return st;
  };

  // Entrega el máster nativo VALIDADO al mismo estado que abre el modal
  // de exportación tras una grabación de la cadena anterior (el modal
  // trabaja igual con el MP4 fragmentado del motor).
  const entregarMasterNativoAlModal = (st) => {
    const cleanTopicName = (topic || 'Episodio').replace(/[^\w\d-_]/g, '_');
    setRecordedVideoData({
      blob: null,
      url: null,
      snapshotCanvas: null,
      thumbnailDataUrl: null,
      filePath: st?.outFile || st?.validation?.path || null,
      blackWarning: false,
      recordedDurationSec: st?.validation?.durationSec || null,
      projectName: topic || 'Proyecto_General',
      name: `PodcaStudio_${cleanTopicName}_${Date.now()}`,
      duration: st?.validation?.durationSec ? Math.round(st.validation.durationSec) : (recordingTime || 1),
    });
    setShowExportModal(true);
  };

  // ==========================================================================
  // v3.2.1 — «AL AIRE» / «GRABANDO» SOLO CON LA VERDAD DEL MOTOR.
  // El fallo en vivo de la v3.2.0: el clic encendía isStreaming y la app
  // decía «AL AIRE - EN VIVO» mientras el motor estaba en «Fase: error»
  // y Facebook no recibía nada. Ahora bridge.start() solo confirma el
  // LANZAMIENTO del proceso: el arranque queda PENDIENTE y la UI solo se
  // enciende cuando la fase real del motor (transmitiendo / grabando /
  // grabando-transmitiendo) se sostiene 2 s (sondeo confirmador). Si la
  // fase cae a «error» antes, o no llega en 10 s, el arranque se declara
  // FALLIDO con el lastError del motor. Y un vigilante apaga la UI si el
  // motor muere a mitad de sesión sin orden de parada.
  // ==========================================================================
  const confirmarTransmisionNativa = () => {
    const pend = nativeStreamPendingRef.current;
    if (!pend) return;
    if (pend.checkTimer) clearTimeout(pend.checkTimer);
    if (pend.timeoutTimer) clearTimeout(pend.timeoutTimer);
    nativeStreamPendingRef.current = null;
    isStreamStartingRef.current = false;
    setIsStreamStarting(false);
    isStreamingRef.current = true;
    setIsStreaming(true);
    setActiveLiveDestinations(nativeStreamTargetsRef.current);
    setShowStreamModal(false);
    setNativeNotice('');
    showToast(`Transmitiendo con el motor nativo a ${nativeStreamTargetsRef.current.length} destino(s).`, 'success');
  };

  const confirmarGrabacionNativa = () => {
    const pend = nativeRecordPendingRef.current;
    if (!pend) return;
    if (pend.checkTimer) clearTimeout(pend.checkTimer);
    if (pend.timeoutTimer) clearTimeout(pend.timeoutTimer);
    nativeRecordPendingRef.current = null;
    isRecordingRef.current = true;
    setIsRecording(true);
    recordingStartTimeRef.current = Date.now();
    setRecordingTime(0);
    isRecordingPausedRef.current = false;
    setIsRecordingPaused(false);
    pausedDurationRef.current = 0;
    pauseStartRef.current = null;
    setCountdown(null);
    setNativeNotice('');
    showToast(pend.conStream ? 'Grabando el máster nativo SIN dejar de transmitir.' : 'Grabando con el motor nativo (cámara principal).', 'success');
  };

  const declararFalloArranqueNativo = (tipo, mensaje) => {
    if (tipo === 'stream') {
      const pend = nativeStreamPendingRef.current;
      if (pend?.checkTimer) clearTimeout(pend.checkTimer);
      if (pend?.timeoutTimer) clearTimeout(pend.timeoutTimer);
      nativeStreamPendingRef.current = null;
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forStream: false };
      nativeStreamUrlsRef.current = [];
      nativeStreamTargetsRef.current = [];
      isStreamStartingRef.current = false;
      setIsStreamStarting(false);
      setNativeNotice('');
      setNativeStreamError(mensaje);
      showToast(mensaje, 'error', 8000);
    } else {
      const pend = nativeRecordPendingRef.current;
      if (pend?.checkTimer) clearTimeout(pend.checkTimer);
      if (pend?.timeoutTimer) clearTimeout(pend.timeoutTimer);
      nativeRecordPendingRef.current = null;
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: false };
      setNativeNotice('');
      showToast(mensaje, 'error', 8000);
    }
  };

  const cancelarPendientesNativos = () => {
    for (const ref of [nativeStreamPendingRef, nativeRecordPendingRef]) {
      const pend = ref.current;
      if (pend?.checkTimer) clearTimeout(pend.checkTimer);
      if (pend?.timeoutTimer) clearTimeout(pend.timeoutTimer);
      ref.current = null;
    }
  };

  // Arma el arranque pendiente: sondea la fase REAL del motor (espejo
  // nativeStateRef) — la primera revisión a los 2 s del lanzamiento (la
  // fase debe SOSTENERSE, no solo aparecer: el motor de la v3.2.0 moría
  // al nacer justo tras anunciar su fase) y después cada 500 ms. Si la
  // fase cae a «error», el arranque se declara fallido con el lastError;
  // si a los 10 s no se confirmó, también. El sondeo propio hace la
  // confirmación independiente de cuántos eventos de estado emita el
  // motor mientras tanto.
  const armarPendienteNativo = (tipo, fasesOk, conStream = false) => {
    const token = ++nativePendingSeqRef.current;
    const pend = { token, fasesOk, conStream, checkTimer: null, timeoutTimer: null };
    const ref = tipo === 'stream' ? nativeStreamPendingRef : nativeRecordPendingRef;
    const revisar = () => {
      if (!ref.current || ref.current.token !== token) return;
      const faseAhora = nativeStateRef.current?.phase;
      if (fasesOk.includes(faseAhora)) {
        if (tipo === 'stream') confirmarTransmisionNativa();
        else confirmarGrabacionNativa();
        return;
      }
      if (faseAhora === 'error') {
        declararFalloArranqueNativo(tipo, nativeStateRef.current?.lastError || 'El motor nativo no pudo arrancar.');
        return;
      }
      pend.checkTimer = setTimeout(revisar, 500);
    };
    pend.checkTimer = setTimeout(revisar, 2000);
    pend.timeoutTimer = setTimeout(() => {
      if (!ref.current || ref.current.token !== token) return;
      const err = nativeStateRef.current?.lastError;
      declararFalloArranqueNativo(tipo, err || `El motor nativo no confirmó ${tipo === 'stream' ? 'la transmisión' : 'la grabación'} en 10 segundos.`);
    }, 10000);
    ref.current = pend;
    return pend;
  };

  // v3.3.0 (A-renderer) → v3.3.1 (defecto 4): fuentes LOCALES para el
  // motor multicámara. La composición vive en la función pura
  // componerFuentesPrograma (src/utils/nativeProgramSources.mjs): la
  // fuente de PROGRAMA es la cámara con el tally PGM (activeCam, por
  // defecto CAM 1) y las demás entran como PiP en orden de ranura,
  // máximo 3. Si la de programa no tiene cámara local elegible, la
  // composición NO promueve a otra: devuelve programa null y el
  // llamador se detiene ANTES de arrancar (prepararFuentesSesionNativa).
  // Las etiquetas salen del track vivo, del nombre guardado por ranura
  // o — durante una sesión, cuando la dieta las tiene liberadas — de
  // la etiqueta guardada por la liberación. Las ranuras REMOTAS quedan
  // fuera siempre: el motor nativo solo abre cámaras físicas locales.
  const componerFuentesLocalesNativas = () => {
    const releasedLabels = {};
    for (const [slotKey, info] of Object.entries(nativeReleasedCamsRef.current || {})) {
      if (info?.label) releasedLabels[slotKey] = info.label;
    }
    return componerFuentesPrograma({
      camSlots: camSlotsRef.current || [],
      programaCamId: activeCamRef.current || 1,
      cameraMeta: cameraMetaRef.current || {},
      slotStreams: slotStreamsRef.current || {},
      localStream: localStreamRef.current,
      releasedLabels,
    });
  };

  // v3.3.1 (defecto 4): prepara las opciones de fuentes de una sesión
  // nativa. Devuelve { opts } listo para bridge.start, o
  // { errorPrograma } cuando la cámara de programa (tally PGM) no está
  // disponible como fuente local: en ese caso la sesión NO se arranca
  // y el motivo va a la banda del motor — jamás se sustituye otra
  // cámara en silencio. Con 2+ fuentes se pasa sources (programa en el
  // índice 0); con una sola, su nombre EXPLÍCITO en cameraName para
  // que el motor la empareje (o se niegue) en vez de elegir otra por
  // defecto.
  const prepararFuentesSesionNativa = () => {
    const comp = componerFuentesLocalesNativas();
    if (!comp.programa) {
      return {
        errorPrograma: `La cámara de programa (CAM ${activeCamRef.current || 1}) no está disponible para el motor nativo: no tiene señal local conectada. La sesión no se inició y no se sustituyó otra cámara.`,
      };
    }
    if (comp.sources.length > 1) {
      return { opts: { sources: comp.sources, programIndex: 0 } };
    }
    return { opts: { cameraName: comp.etiquetaPrograma } };
  };

  const iniciarGrabacionNativa = async () => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return;
    if (nativeRecordPendingRef.current) return;
    const subiendo = nativeFlagsRef.current.forStream;
    if (subiendo && !isStreamingRef.current) {
      // La transmisión aún está en arranque pendiente de confirmación
      // (v3.2.1): no hay sesión confirmada que reiniciar todavía.
      showToast('La transmisión aún se está conectando: espera a que el motor la confirme para sumarle la grabación.', 'warning', 6000);
      return;
    }
    // v3.3.1 (defecto 4): la parada previa va ANTES de detener nada:
    // si la cámara de programa no está disponible como fuente local,
    // no se arranca ni se toca la sesión en curso.
    const prep = prepararFuentesSesionNativa();
    if (prep.errorPrograma) {
      setNativeNotice(prep.errorPrograma);
      showToast(prep.errorPrograma, 'error', 9000);
      return;
    }
    nativeBusyRef.current = true;
    try {
      setNativeNotice(subiendo
        ? 'Reconectando sesión: la grabación se suma a la transmisión (la tubería se reinicia)…'
        : 'Iniciando grabación con el motor nativo…');
      let res = null;
      try {
        if (subiendo) {
          // v3.2.2 — SUBIDA de sesión: el motor rechaza (correctamente)
          // un start con otra sesión en curso, así que la transmisión
          // en curso se detiene PRIMERO y la combinada 'recordStream'
          // la reemplaza: el diseño aprobado del Hito 3 («la transición
          // REINICIA la tubería»), el mismo orden parar→arrancar que
          // usan las bajadas. nativeBusyRef sigue en true durante todo
          // el reinicio: el vigilante no lo confunde con una muerte.
          try { await bridge.stop(); } catch (e) {}
          await esperarMotorApagado();
        }
        // v3.3.0 (A) → v3.3.1 (defecto 4): las fuentes ya vienen
        // preparadas (programa PGM primero) de prepararFuentesSesionNativa.
        const optsFuentes = prep.opts;
        res = subiendo
          ? await bridge.start({ session: 'recordStream', projectName: topic || 'Proyecto_General', streamUrls: nativeStreamUrlsRef.current, ...optsFuentes })
          : await bridge.start({ session: 'record', projectName: topic || 'Proyecto_General', ...optsFuentes });
      } catch (e) { res = { success: false, error: e?.message || String(e) }; }
      if (!res?.success) {
        if (subiendo) {
          // La sesión anterior YA terminó (la detuvimos para el
          // reinicio) y la combinada no arrancó: estado honesto — se
          // apaga también la transmisión en la UI y se declara, sin
          // restaurar estados falsos ni reintentar en silencio.
          nativeFlagsRef.current = { forRecord: false, forStream: false };
          nativeStreamUrlsRef.current = [];
          nativeStreamTargetsRef.current = [];
          isStreamingRef.current = false;
          setIsStreaming(false);
          setActiveLiveDestinations([]);
          // v3.3.1 (defecto 4): si el motor se detuvo ANTES de arrancar
          // (programa no disponible), el motivo queda en la banda.
          setNativeNotice(res?.code === 'PROGRAMA_NO_DISPONIBLE' ? res.error : '');
          showToast(`La sesión combinada no arrancó: ${res?.error || 'error del motor nativo'}. La transmisión anterior terminó al intentar sumarle la grabación.`, 'error', 9000);
          return;
        }
        setNativeNotice(res?.code === 'PROGRAMA_NO_DISPONIBLE' ? res.error : '');
        showToast(res?.error || 'El motor nativo no pudo iniciar la grabación.', 'error', 7000);
        return;
      }
      // v3.2.1: el OK de start() es solo el lanzamiento. isRecording se
      // enciende en confirmarGrabacionNativa() cuando la fase real del
      // motor lo confirme; si el motor muere al nacer, el arranque se
      // declara fallido con su lastError (nada de grabación fingida).
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: true };
      armarPendienteNativo('record', ['grabando', 'grabando-transmitiendo'], subiendo);
    } finally {
      nativeBusyRef.current = false;
    }
  };

  const detenerGrabacionNativa = async () => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return;
    cancelarPendientesNativos();
    nativeBusyRef.current = true;
    const seguirTransmitiendo = nativeFlagsRef.current.forStream;
    setIsStoppingRecordingUI(true);
    setNativeNotice('Deteniendo el motor: validando el máster…');
    let avisoBandaTrasDetener = '';
    try {
      try { await bridge.stop(); } catch (e) {}
      const st = await esperarMotorApagado();
      if (st?.validation?.valid) {
        entregarMasterNativoAlModal(st);
      } else {
        showToast(`El máster nativo no superó la validación${st?.lastError ? `: ${st.lastError}` : ''}. Revisa el panel Motor Nativo.`, 'error', 8000);
      }
      if (seguirTransmitiendo) {
        // Downgrade declarado: la transmisión CONTINÚA en una sesión
        // nueva solo-stream (la tubería se reinicia y el directo se
        // reconecta; los visores pueden notar un corte breve).
        setNativeNotice('Reconectando sesión: la transmisión continúa sin grabación…');
        // v3.3.1 (defecto 4): el reinicio también sale de la cámara de
        // programa; si no está disponible, no se arranca ni se sustituye.
        const prepRe = prepararFuentesSesionNativa();
        let res2 = null;
        if (prepRe.errorPrograma) {
          res2 = { success: false, code: 'PROGRAMA_NO_DISPONIBLE', error: prepRe.errorPrograma };
        } else {
          try { res2 = await bridge.start({ session: 'stream', streamUrls: nativeStreamUrlsRef.current, ...prepRe.opts }); } catch (e) { res2 = { success: false, error: e?.message || String(e) }; }
        }
        if (!res2?.success) {
          if (res2?.code === 'PROGRAMA_NO_DISPONIBLE') avisoBandaTrasDetener = res2.error;
          nativeFlagsRef.current = { forRecord: false, forStream: false };
          nativeStreamUrlsRef.current = [];
          nativeStreamTargetsRef.current = [];
          isStreamingRef.current = false;
          setIsStreaming(false);
          setActiveLiveDestinations([]);
          setNativeStreamError(res2?.error || 'No se pudo reanudar la transmisión tras detener la grabación.');
          showToast('La transmisión no pudo reanudarse tras detener la grabación.', 'error', 8000);
        }
      }
    } finally {
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: false };
      isRecordingRef.current = false;
      setIsRecording(false);
      setRecordingTime(0);
      recordingStartTimeRef.current = null;
      setIsStoppingRecordingUI(false);
      setNativeNotice('');
      nativeBusyRef.current = false;
    }
    // v3.3.1 (defecto 4): el aviso de programa no disponible sobrevive
    // a la limpieza del finally: queda en la banda del motor.
    if (avisoBandaTrasDetener) setNativeNotice(avisoBandaTrasDetener);
  };

  const iniciarTransmisionNativa = async (targets) => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return;
    const urls = (targets || []).map((t) => t.url).filter(Boolean);
    if (urls.length === 0) {
      setNativeStreamError('Ningún destino tiene una URL válida.');
      return;
    }
    const conGrabacion = nativeFlagsRef.current.forRecord;
    if (conGrabacion && !isRecordingRef.current) {
      // La grabación aún está en arranque pendiente de confirmación
      // (v3.2.1): no hay sesión confirmada que reiniciar todavía. El
      // error va EN el modal, como el resto de fallos de este flujo.
      setNativeStreamError('La grabación aún se está iniciando: espera a que el motor la confirme para sumarle la transmisión.');
      return;
    }
    // v3.3.1 (defecto 4): parada previa ANTES de detener la grabación
    // en curso: sin cámara de programa disponible no se arranca ni se
    // sustituye, y la grabación en curso queda intacta.
    const prep = prepararFuentesSesionNativa();
    if (prep.errorPrograma) {
      setNativeStreamError(prep.errorPrograma);
      setNativeNotice(prep.errorPrograma);
      showToast(prep.errorPrograma, 'error', 9000);
      return;
    }
    nativeBusyRef.current = true;
    try {
      setNativeStreamError('');
      isStreamStartingRef.current = true;
      setIsStreamStarting(true);
      setNativeNotice(conGrabacion
        ? 'Reconectando sesión: la transmisión se suma a la grabación en curso (la tubería se reinicia)…'
        : 'Iniciando transmisión con el motor nativo…');
      let res = null;
      try {
        if (conGrabacion) {
          // v3.2.2 — SUBIDA de sesión: el motor rechaza (correctamente)
          // un start con otra sesión en curso, así que la grabación en
          // curso se detiene PRIMERO (la parada cierra y valida su
          // máster; la combinada graba un máster NUEVO, declarado como
          // en las demás transiciones) y 'recordStream' la reemplaza.
          // nativeBusyRef sigue en true durante todo el reinicio: el
          // vigilante no lo confunde con una muerte del motor, y la UI
          // de grabación NO se apaga ni parpadea durante el reinicio.
          try { await bridge.stop(); } catch (e) {}
          await esperarMotorApagado();
        }
        // v3.3.0 (A) → v3.3.1 (defecto 4): las fuentes ya vienen
        // preparadas (programa PGM primero) de prepararFuentesSesionNativa.
        res = await bridge.start({
          session: conGrabacion ? 'recordStream' : 'stream',
          projectName: topic || 'Proyecto_General',
          streamUrls: urls,
          ...prep.opts,
        });
      } catch (e) { res = { success: false, error: e?.message || String(e) }; }
      if (!res?.success) {
        // Sin respaldo silencioso a mitad de clic: el error del motor se
        // muestra EN el modal y el modal queda abierto.
        isStreamStartingRef.current = false;
        setIsStreamStarting(false);
        if (conGrabacion) {
          // La grabación anterior YA terminó (la detuvimos para el
          // reinicio) y la combinada no arrancó: estado honesto — se
          // apaga también la grabación en la UI y se declara, sin
          // restaurar estados falsos ni reintentar en silencio.
          nativeFlagsRef.current = { forRecord: false, forStream: false };
          isRecordingRef.current = false;
          setIsRecording(false);
          setRecordingTime(0);
          recordingStartTimeRef.current = null;
          const msgCombinada = `La sesión combinada no arrancó: ${res?.error || 'error del motor nativo'}. La grabación anterior terminó al intentar sumarle la transmisión.`;
          setNativeStreamError(msgCombinada);
          // v3.3.1 (defecto 4): negativa previa del motor → banda.
          setNativeNotice(res?.code === 'PROGRAMA_NO_DISPONIBLE' ? res.error : '');
          showToast(msgCombinada, 'error', 9000);
          return;
        }
        setNativeStreamError(res?.error || 'El motor nativo no pudo iniciar la transmisión.');
        setNativeNotice(res?.code === 'PROGRAMA_NO_DISPONIBLE' ? res.error : '');
        showToast(res?.error || 'El motor nativo no pudo iniciar la transmisión.', 'error', 8000);
        return;
      }
      // v3.2.1: «AL AIRE» ya NO se enciende con el clic ni con el OK del
      // lanzamiento: el arranque queda PENDIENTE (isStreamStarting sigue
      // activo, el modal sigue abierto con el aviso de conexión) hasta
      // que el efecto confirmador vea la fase real del motor sostenida.
      // Si el motor muere al nacer — el fallo en vivo de la v3.2.0 — el
      // arranque se declara fallido con su lastError y la app jamás
      // muestra «AL AIRE» sin estar transmitiendo.
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forStream: true };
      nativeStreamUrlsRef.current = urls;
      nativeStreamTargetsRef.current = targets;
      setNativeNotice('Conectando: esperando la confirmación del motor nativo…');
      armarPendienteNativo('stream', ['transmitiendo', 'grabando-transmitiendo']);
    } finally {
      nativeBusyRef.current = false;
    }
  };

  const detenerTransmisionNativa = async () => {
    const bridge = window.electronAPI?.nativeEngine;
    if (!bridge) return;
    cancelarPendientesNativos();
    nativeBusyRef.current = true;
    const conGrabacion = nativeFlagsRef.current.forRecord;
    setNativeNotice('Deteniendo la transmisión del motor nativo…');
    let avisoBandaTrasDetenerStream = '';
    try { await bridge.stop(); } catch (e) {}
    const st = await esperarMotorApagado();
    nativeFlagsRef.current = { ...nativeFlagsRef.current, forStream: false };
    nativeStreamUrlsRef.current = [];
    nativeStreamTargetsRef.current = [];
    isStreamingRef.current = false;
    setIsStreaming(false);
    setActiveLiveDestinations([]);
    if (conGrabacion && st?.validation?.valid) {
      // La parada también cerró y validó el máster en curso: se entrega
      // al modal y la grabación CONTINÚA en un máster nuevo (declarado).
      entregarMasterNativoAlModal(st);
      // v3.3.1 (defecto 4): la grabación que continúa también sale de
      // la cámara de programa; sin ella no se arranca ni se sustituye.
      const prepRe = prepararFuentesSesionNativa();
      let res2 = null;
      if (prepRe.errorPrograma) {
        res2 = { success: false, code: 'PROGRAMA_NO_DISPONIBLE', error: prepRe.errorPrograma };
      } else {
        try { res2 = await bridge.start({ session: 'record', projectName: topic || 'Proyecto_General', ...prepRe.opts }); } catch (e) { res2 = { success: false, error: e?.message || String(e) }; }
      }
      if (res2?.success) {
        setNativeNotice('La transmisión terminó; la grabación sigue en un máster nuevo.');
        showToast('Transmisión detenida. La grabación continúa en un máster nuevo.', 'success', 7000);
      } else {
        nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: false };
        isRecordingRef.current = false;
        setIsRecording(false);
        if (res2?.code === 'PROGRAMA_NO_DISPONIBLE') avisoBandaTrasDetenerStream = res2.error;
        showToast(res2?.code === 'PROGRAMA_NO_DISPONIBLE' ? res2.error : 'La grabación no pudo continuar tras detener la transmisión.', 'error', 8000);
      }
    } else {
      if (conGrabacion) {
        nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: false };
        isRecordingRef.current = false;
        setIsRecording(false);
        showToast('Al detener la transmisión, el máster en curso no superó la validación.', 'error', 8000);
      }
      showToast('Transmisión detenida.', 'success');
    }
    if (!nativeFlagsRef.current.forRecord) setNativeNotice('');
    // v3.3.1 (defecto 4): el aviso de programa no disponible queda en
    // la banda aunque la limpieza anterior lo haya borrado.
    if (avisoBandaTrasDetenerStream) setNativeNotice(avisoBandaTrasDetenerStream);
    nativeBusyRef.current = false;
  };

  // ==========================================================================
  // v3.2.1 — VIGILANTE del motor nativo. La CONFIRMACIÓN de los arranques
  // vive en armarPendienteNativo (sondeo de la fase real). Este efecto es
  // la otra mitad: fuera de las transiciones ordenadas (nativeBusyRef),
  // si la fase cae a «error» o «apagado» con la transmisión o la
  // grabación nativas encendidas en la UI, el motor murió sin orden de
  // parada: se apaga la UI y se avisa con el lastError. Nunca más un
  // «AL AIRE» con temporizador sobre un motor muerto.
  // ==========================================================================
  useEffect(() => {
    const st = nativeEngineState;
    if (!st) return;
    const phase = st.phase;
    if (nativeBusyRef.current) return;
    if (phase !== 'error' && phase !== 'apagado') return;
    if (nativeFlagsRef.current.forStream && isStreamingRef.current) {
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forStream: false };
      nativeStreamUrlsRef.current = [];
      nativeStreamTargetsRef.current = [];
      isStreamingRef.current = false;
      setIsStreaming(false);
      setActiveLiveDestinations([]);
      showToast(`La transmisión se detuvo: ${st.lastError || 'el motor nativo se detuvo sin aviso.'}`, 'error', 8000);
    }
    if (nativeFlagsRef.current.forRecord && isRecordingRef.current) {
      nativeFlagsRef.current = { ...nativeFlagsRef.current, forRecord: false };
      isRecordingRef.current = false;
      setIsRecording(false);
      setRecordingTime(0);
      recordingStartTimeRef.current = null;
      showToast(`La grabación se detuvo: ${st.lastError || 'el motor nativo se detuvo sin aviso.'}`, 'error', 8000);
    }
  }, [nativeEngineState]);

  // ==========================================================================
  // v3.3.0 — DIETA DE LA VENTANA (D1/D2) Y TELEPROMPTER SOBRE LA VISTA
  // PREVIA NATIVA (C-renderer). El instrumento ventana-diag no se toca.
  // ==========================================================================

  // D1: en modo motor, el bucle de composición por canvas NO se arranca
  // (Worker en reposo). Mapa de evidencia en masterBroadcastEngine.js
  // (setNativeWindowDiet): el bucle también lo arrancaba el monitor
  // siempre encendido vía updateBroadcastState -> ensureMasterCanvas ->
  // startRenderLoop, sin grabar ni transmitir por la cadena heredada.
  // Al salir del modo motor (sin GStreamer, o con ISO) la dieta se
  // levanta y los caminos heredados componen exactamente como hoy.
  useEffect(() => {
    try { setNativeWindowDiet(enModoMotor); } catch (e) {}
  }, [enModoMotor]);

  // D2: liberación con foto fija. Al confirmarse una sesión nativa
  // (fases de marcha), cada cámara LOCAL de la ventana cuyo nombre
  // coincide con nativeEngineState.sourceNames deja de decodificarse en
  // la ventana: se guarda UNA foto de su <video>, se detienen TODOS los
  // tracks de su stream y el stream sale del mapa de la ventana; el
  // mosaico muestra la foto + el rótulo «En el motor nativo». Al volver
  // la fase a apagado/error, cada cámara liberada se readquiere por el
  // camino de adquisición existente (handleUsbConnect / getUserMedia).
  // v3.3.4: mientras una cámara está liberada, su ranura cuenta como
  // OCUPADA y BLOQUEADA para toda colocación remota (el registro
  // nativeReleasedCamsRef alimenta el predicado único de ocupación), y
  // la readquisición devuelve la cámara COMPLETA (stream + meta) a su
  // ranura — o a la primera libre si otra fuente la ocupó — sin pisar
  // jamás la ranura ajena (ver readquirirLiberadas).
  const [nativeReleasedPhotos, setNativeReleasedPhotos] = useState({});
  const nativeReleasedCamsRef = useRef({});

  useEffect(() => {
    const st = nativeEngineState;
    if (!st) return undefined;
    const phase = st.phase;
    const FASES_MARCHA_NATIVAS = ['vista-previa', 'grabando', 'transmitiendo', 'grabando-transmitiendo'];

    const readquirirLiberadas = () => {
      const entradas = Object.entries(nativeReleasedCamsRef.current);
      if (!entradas.length) return;
      // v3.3.4 — la vuelta de una cámara prestada al motor respeta la
      // ocupación con el predicado ÚNICO (todas las fuentes, vía
      // elegirRanuraReadquisicion):
      //  - recupera SU ranura si está libre;
      //  - si otra fuente la ocupó mientras estaba prestada (una
      //    conexión manual del usuario; una remota ya no puede: la
      //    guarda bloquea las ranuras liberadas desde esta versión),
      //    se reubica a la primera libre con aviso visible — la
      //    readquisición JAMÁS sobrescribe la ranura ajena;
      //  - sin ranura libre, el registro de liberada se RESTAURA y la
      //    cámara reintenta en el próximo apagado, con aviso.
      // El mapa de trabajo «reservadas» empieza como copia del
      // registro de liberadas y se muta por decisión: al decidir el
      // destino de una cámara se retira SU registro (no se bloquea a
      // sí misma) y se marca su destino como reservado, para que dos
      // cámaras que vuelven en la misma pasada no elijan la misma
      // ranura (las aperturas son asíncronas: el mapa de streams aún
      // no refleja la primera cuando se decide la segunda).
      const reservadas = { ...nativeReleasedCamsRef.current };
      nativeReleasedCamsRef.current = {};
      setNativeReleasedPhotos({});
      for (const [slotKey, info] of entradas) {
        const slotIdx = Number(slotKey);
        delete reservadas[slotKey];
        const fuentesAhora = () => ({
          streams: slotStreamsRef.current,
          cameraMeta: cameraMetaRef.current,
          assignedSlots: assignedSlotsRef.current,
          liberadasAlMotor: reservadas,
          localStreamActive: Boolean(localStreamRef.current),
        });
        const restaurarRegistro = (motivo) => {
          if (nativeReleasedCamsRef.current[slotIdx]) return; // un ciclo más nuevo ya la registró
          if (slotStreamsRef.current?.[slotIdx] || cameraMetaRef.current?.[slotIdx]?.deviceId) return; // su ranura ya tiene dueña: no resucitar
          nativeReleasedCamsRef.current = { ...nativeReleasedCamsRef.current, [slotIdx]: info };
          if (info?.photo) setNativeReleasedPhotos((prev) => ({ ...prev, [slotIdx]: info.photo }));
          ventanaDiagSend('ranura', `camino=readquisición-motor camara="${info?.label || ''}" destino=CAM ${slotIdx + 1} decision=sin-retorno motivo="${motivo}"`);
        };
        const destino = elegirRanuraReadquisicion({
          ranuraOriginal: slotIdx,
          slotsCount: camSlotsRef.current?.length || 12,
          ...fuentesAhora(),
        });
        if (destino.slot === null) {
          restaurarRegistro('sin ranuras libres');
          showToast(`«${info?.label || 'Una cámara'}» no pudo volver del motor nativo: no hay ranuras libres. Su ranura sigue reservada y reintentará al apagar el motor.`, 'error', 9000);
          continue;
        }
        const destinoIdx = destino.slot;
        const ocupacionPedida = fuentesDeOcupacion(slotIdx, fuentesAhora()).join(',') || 'libre';
        reservadas[destinoIdx] = { deviceId: info?.deviceId || 'readquiriendo', label: info?.label || '' };
        ventanaDiagSend('ranura', `camino=readquisición-motor camara="${info?.label || ''}" pedida=CAM ${slotIdx + 1} ocupacionPedida=[${ocupacionPedida}] decision=${destino.reubicada ? 'reubicar' : 'retornar'} destino=CAM ${destinoIdx + 1}`);
        if (destino.reubicada) {
          showToast(`«${info?.label || 'Una cámara'}» volvió del motor nativo a CAM ${destinoIdx + 1}: su ranura (CAM ${slotIdx + 1}) quedó ocupada mientras tanto y no se reemplazó a nadie.`, 'info', 9000);
        }
        if (info?.deviceId && info?.type !== 'remote') {
          // Camino de adquisición EXISTENTE: cola USB + getUserMedia
          // probado (handleUsbConnect -> openProvenUsbStream), que ya
          // registra la cámara completa (stream + cameraMeta) y se
          // niega a pisar una pista viva de otro dispositivo.
          try { const p = handleUsbConnect(info.deviceId, destinoIdx, info.label); if (p?.catch) p.catch(() => restaurarRegistro('la apertura USB falló')); } catch (e) { restaurarRegistro('la apertura USB falló'); }
        } else {
          // Sin deviceId guardado: reapertura directa con el
          // getUserMedia con timeout existente (respaldo declarado).
          getUserMediaWithTimeout({ video: true, audio: false }).then((stream) => {
            if (!stream) { restaurarRegistro('el respaldo no entregó señal'); return; }
            // Re-chequeo EN EL MOMENTO de escribir (v3.3.4): durante
            // la espera asíncrona alguien pudo ocupar el destino
            // elegido; si fue así se re-decide con el estado de ahora
            // y jamás se pisa la ranura ajena (hasta la v3.3.3 esta
            // escritura era incondicional sobre la ranura original).
            let escritura = destinoIdx;
            if (slotStreamsRef.current?.[escritura]) {
              const re = elegirRanuraReadquisicion({
                ranuraOriginal: escritura,
                slotsCount: camSlotsRef.current?.length || 12,
                ...fuentesAhora(),
              });
              if (re.slot === null) {
                try { stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} }); } catch (e) {}
                restaurarRegistro('el destino se ocupó durante la reapertura y no hay otra libre');
                return;
              }
              escritura = re.slot;
              showToast(`«${info?.label || 'Una cámara'}» volvió del motor nativo a CAM ${escritura + 1}: su destino se ocupó durante la reapertura y no se reemplazó a nadie.`, 'info', 9000);
            }
            // Registro COMPLETO al volver (v3.3.4): stream Y
            // metadatos (deviceId si se conoce, label, type). Hasta
            // la v3.3.3 este respaldo escribía SOLO el stream: la
            // cámara volvía «a medias», sin meta, y la mitad del
            // predicado de ocupación quedaba ciega para ella en
            // adelante — el eslabón que dejó a CAM 2 leerse «libre».
            const vTrack = stream.getVideoTracks?.()[0];
            const deviceIdVuelta = info?.deviceId || vTrack?.getSettings?.()?.deviceId || null;
            const labelVuelta = info?.label || vTrack?.label || 'Cámara';
            const metaVuelta = { deviceId: deviceIdVuelta, resolution: getVideoTrackResolution(stream), videoInfo: getVideoTrackInfo(stream), label: labelVuelta, type: info?.type || 'usb' };
            slotStreamsRef.current = { ...slotStreamsRef.current, [escritura]: stream };
            cameraMetaRef.current = { ...cameraMetaRef.current, [escritura]: metaVuelta };
            setSlotStreams((prev) => ({ ...prev, [escritura]: stream }));
            setCameraMeta((prev) => ({ ...prev, [escritura]: metaVuelta }));
            if (deviceIdVuelta) saveCameraToHistory({ deviceId: deviceIdVuelta, label: labelVuelta, type: metaVuelta.type, slot: escritura });
            if (escritura === 0) { localStreamRef.current = stream; setLocalStream(stream); }
          }).catch(() => restaurarRegistro('el respaldo falló'));
        }
      }
    };

    if (FASES_MARCHA_NATIVAS.includes(phase) && Array.isArray(st.sourceNames) && st.sourceNames.length > 0) {
      let cancelado = false;
      (async () => {
        for (const nombreCrudo of st.sourceNames) {
          if (cancelado) return;
          const nombre = String(nombreCrudo || '').trim().toLowerCase();
          if (!nombre) continue;
          for (const camId of (camSlotsRef.current || [])) {
            const slotIdx = camId - 1;
            if (nativeReleasedCamsRef.current[slotIdx]) continue;
            const meta = cameraMetaRef.current?.[slotIdx] || {};
            // SOLO ranuras locales: una ranura remota lleva type
            // 'remote' en su meta (handleAssignRemoteStream) o mobileId
            // en su stream (transporte cloud); los ids remotos viven en
            // remoteCams / meta.deviceId 'remote_…', nunca como etiqueta
            // física en sourceNames, y aun así la guarda los excluye.
            if (meta?.type === 'remote') continue;
            const stream = slotStreamsRef.current?.[slotIdx] || (slotIdx === 0 ? localStreamRef.current : null);
            if (!stream || stream.mobileId) continue;
            // Coincidencia laxa como la regla de audio del motor:
            // includes en ambos sentidos, sin distinguir mayúsculas.
            const candidatas = [(stream.getVideoTracks?.() || [])[0]?.label, meta?.label, meta?.videoInfo?.label]
              .filter(Boolean).map((s) => String(s).trim().toLowerCase());
            const coincide = candidatas.some((c) => c && (nombre.includes(c) || c.includes(nombre)));
            if (!coincide) continue;
            // Foto fija: del <video> que ya muestra este stream en la
            // ventana; si ninguno está listo, de un <video> desechable
            // alimentado con el mismo stream. Si la foto no se puede
            // capturar, se libera igual (declarado): el mosaico muestra
            // el rótulo «En el motor nativo» sin foto.
            let dataUrl = null;
            try {
              let videoEl = null;
              document.querySelectorAll('video').forEach((v) => { if (!videoEl && v.srcObject === stream && v.videoWidth > 0) videoEl = v; });
              let desechable = null;
              if (!videoEl) {
                desechable = document.createElement('video');
                desechable.muted = true;
                desechable.playsInline = true;
                desechable.srcObject = stream;
                await new Promise((res) => { const t = setTimeout(res, 1200); desechable.onloadeddata = () => { clearTimeout(t); res(); }; desechable.play().catch(() => {}); });
                if (desechable.videoWidth > 0) videoEl = desechable;
              }
              if (videoEl) {
                const c = document.createElement('canvas');
                c.width = videoEl.videoWidth;
                c.height = videoEl.videoHeight;
                const cx = c.getContext('2d');
                if (cx) { cx.drawImage(videoEl, 0, 0, c.width, c.height); dataUrl = c.toDataURL('image/jpeg', 0.7); }
              }
              if (desechable) { try { desechable.srcObject = null; } catch (e) {} }
            } catch (e) { dataUrl = null; }
            if (cancelado) return;
            nativeReleasedCamsRef.current = {
              ...nativeReleasedCamsRef.current,
              // v3.3.4: la foto viaja en el propio registro de liberada
              // (además del estado de fotos que pinta el mosaico): si la
              // readquisición no puede completarse, el registro se
              // restaura entero — foto incluida — para reintentar en el
              // próximo apagado sin perder la identidad de la cámara.
              [slotIdx]: { camId, deviceId: meta?.deviceId || null, label: meta?.label || nombreCrudo, type: meta?.type || null, photo: dataUrl },
            };
            setNativeReleasedPhotos((prev) => ({ ...prev, [slotIdx]: dataUrl }));
            try { stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} }); } catch (e) {}
            const sinLiberada = { ...slotStreamsRef.current };
            delete sinLiberada[slotIdx];
            slotStreamsRef.current = sinLiberada;
            setSlotStreams((prev) => { const next = { ...prev }; delete next[slotIdx]; return next; });
            if (slotIdx === 0) { localStreamRef.current = null; setLocalStream(null); }
            break; // un nombre de sourceNames -> una sola ranura
          }
        }
      })();
      return () => { cancelado = true; };
    }

    if ((phase === 'apagado' || phase === 'error') && Object.keys(nativeReleasedCamsRef.current).length > 0) {
      if (nativeBusyRef.current) {
        // Transición ordenada en curso (p. ej. subida a recordStream o
        // los Detener de los botones): el apagado intermedio NO es el
        // fin de la sesión. Se reevalúa en 1,2 s con la fase real: si
        // el motor volvió a marcha, no se readquiere nada.
        const t = setTimeout(() => {
          const ph = nativeStateRef.current?.phase;
          if ((ph === 'apagado' || ph === 'error') && !nativeBusyRef.current) readquirirLiberadas();
        }, 1200);
        return () => clearTimeout(t);
      }
      readquirirLiberadas();
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeEngineState]);

  // C-renderer: teleprompter SOLO sobre la vista previa nativa
  // independiente, y SOLO fuera de sesión de grabación/transmisión
  // (corrección v3.3.0 tras la compuerta: el proceso independiente no
  // convive con la sesión — dos lectores MF mataban la grabación —;
  // en sesión la vista previa del motor es su rama integrada y el
  // teleprompter es el de la ventana, como siempre). Hace falta la
  // concurrencia del motor (concurrentPreview === true) y que la fase
  // NO sea de grabación/transmisión: este sondeo se detiene en esas
  // fases (el motor, además, trata cualquier llamada en sesión como
  // no-op declarado). Se envía el tramo visible (~6 líneas desde la
  // línea estimada por el reloj único teleprompterYRef y el tamaño de
  // letra) SOLO cuando el tramo cambia; al pausar/detener, al perderse
  // la concurrencia o al entrar en sesión se envía '' una vez. Guarda
  // opcional del puente, como el resto del archivo: si setPreviewText
  // no existe (build parcial), no se rompe.
  const previewTextLastSentRef = useRef(null);
  useEffect(() => {
    const bridge = window.electronAPI?.nativeEngine;
    const concurrente = nativeEngineState?.concurrentPreview === true;
    const enSesionGrabacion = ['grabando', 'grabando-transmitiendo', 'transmitiendo'].includes(nativeEngineState?.phase);
    if (!concurrente || enSesionGrabacion || !isTeleprompterPlaying || typeof bridge?.setPreviewText !== 'function') {
      if (previewTextLastSentRef.current) {
        try { bridge?.setPreviewText?.(''); } catch (e) {}
        previewTextLastSentRef.current = '';
      }
      return undefined;
    }
    const enviarTramoSiCambio = () => {
      const lineas = (teleprompterText || '').split('\n');
      const idx = Math.max(0, Math.round((teleprompterYRef.current || 0) / ((teleprompterFontSize || 36) * 1.4)));
      const tramo = lineas.slice(idx, idx + 6).join('\n').trim();
      if (tramo === previewTextLastSentRef.current) return;
      previewTextLastSentRef.current = tramo;
      try { const r = bridge.setPreviewText(tramo); if (r?.catch) r.catch(() => {}); } catch (e) {}
    };
    enviarTramoSiCambio();
    // El reloj del teleprompter avanza fuera de React: se sondea el
    // tramo (mismo patrón de sondeo que MasterProgramMonitor) y solo
    // se llama al motor cuando el tramo cambia de verdad.
    const timer = setInterval(enviarTramoSiCambio, 600);
    return () => clearInterval(timer);
  }, [nativeEngineState?.concurrentPreview, nativeEngineState?.phase, isTeleprompterPlaying, teleprompterText, teleprompterFontSize]);

  const handleNativeEngineStart = async (session) => {
    try {
      // Hito 3: una sesión lanzada desde el PANEL no pertenece a los
      // botones reales: las banderas se reinician para que los Detener
      // de Grabar/Transmitir no reclamen una sesión que no es suya.
      nativeFlagsRef.current = { forRecord: false, forStream: false };
      nativeStreamUrlsRef.current = [];
      nativeStreamTargetsRef.current = [];
      // outDir va undefined A PROPÓSITO: la carpeta de grabaciones del
      // proyecto la resuelve el proceso principal (getProjectsRootDir en
      // main.js) y NO está expuesta al renderer; al ir undefined aplica
      // el defecto del anfitrión (userData/motor-nativo).
      await window.electronAPI?.nativeEngine?.start({ session, outDir: undefined });
    } catch (e) {}
  };
  const handleNativeEngineStop = async () => {
    try { await window.electronAPI?.nativeEngine?.stop(); } catch (e) {}
  };
  const nePhase = nativeEngineState?.phase || 'apagado';
  const formatMotorBytes = (n) => {
    const v = Number(n) || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / (1024 * 1024)).toFixed(2)} MB`;
  };
  const formatMotorDur = (s) => (s == null ? '—' : `${Number(s).toFixed(1)}s`);
  // El arranque/parada del flujo de programa viven más abajo (junto al
  // núcleo v2); estas refs los puentean para las suscripciones de aquí.
  const programFlowStarterRef = useRef(null);
  const programFlowStopperRef = useRef(null);
  const programProfileFirstApplyRef = useRef(true);

  // Al montar y al cambiar el perfil: anunciarlo al núcleo, fijar el
  // tamaño real del canvas máster y, si el flujo de programa está
  // activo, reiniciarlo para que la bomba nazca con el perfil nuevo.
  useEffect(() => {
    try { localStorage.setItem('podcastudio_program_profile', programProfileId); } catch (e) {}
    try {
      window.api?.setProgramProfile?.({
        id: programProfile.id,
        width: programProfile.width,
        height: programProfile.height,
        masterBitrateBps: programProfile.masterBitrateBps,
        streamWidth: programProfile.streamWidth,
        streamHeight: programProfile.streamHeight,
        streamBitrateBps: programProfile.streamBitrateBps,
      });
    } catch (e) {}
    try { setProgramSize(programProfile.width, programProfile.height); } catch (e) {}
    if (programProfileFirstApplyRef.current) {
      programProfileFirstApplyRef.current = false;
      return;
    }
    if (isStreamingRef.current || isRecordingRef.current || selfTestFlowRef.current) {
      try { programFlowStopperRef.current?.(); } catch (e) {}
      programFlowStarterRef.current?.().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programProfileId]);

  const handleRunSelfTest = async () => {
    setSelfTestBusy(true);
    try {
      const verdict = await window.api?.runProgramSelfTest?.();
      if (verdict) setSelfTest(verdict);
      else setSelfTest({ ok: false, error: 'El motor no respondió a la autoprueba (¿sin Electron?).', at: new Date().toISOString() });
    } catch (e) {
      setSelfTest({ ok: false, error: e?.message || 'Error inesperado en la autoprueba.', at: new Date().toISOString() });
    } finally {
      setSelfTestBusy(false);
    }
  };

  // Veredicto de autoprueba empujado por el proceso principal.
  useEffect(() => {
    const off = window.api?.onProgramSelfTestResult?.((verdict) => {
      if (verdict) setSelfTest(verdict);
      if (selfTestFlowRef.current && !isStreamingRef.current && !isRecordingRef.current) {
        try { programFlowStopperRef.current?.(); } catch (e) {}
        selfTestFlowRef.current = false;
      }
    });
    return () => { if (typeof off === 'function') off(); };
  }, []);

  // El proceso principal pide arrancar el flujo de programa para poder
  // medirlo: si ya hay streaming/grabación, el flujo ya corre y no se
  // toca nada; si no, se arranca por el camino habitual y se marca la
  // ref para detener SOLO ese flujo al llegar el veredicto.
  useEffect(() => {
    const off = window.api?.onProgramSelfTestRequest?.(async () => {
      if (isStreamingRef.current || isRecordingRef.current) return;
      if (selfTestFlowRef.current) return;
      selfTestFlowRef.current = true;
      try {
        await programFlowStarterRef.current?.();
      } catch (e) {
        selfTestFlowRef.current = false;
      }
    });
    return () => { if (typeof off === 'function') off(); };
  }, []);

  // Notificar a Electron que la UI está 100% montada (señal enviada desde main.jsx para evitar duplicación)
  // Esta señal ya fue enviada desde main.jsx con requestAnimationFrame. No duplicar.

  // ESCENARIOS Y CROMA KEY
  const [chromaKeyActive, setChromaKeyActive] = useState(false);
  const [virtualBg, setVirtualBg] = useState('https://images.unsplash.com/photo-1598550476439-6847785fce6b?auto=format&fit=crop&w=1920&q=80');

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamDestStatuses, setStreamDestStatuses] = useState({});
  const streamDestStatusesRef = useRef({});
  const [isStreamStarting, setIsStreamStarting] = useState(false);
  const isStreamStartingRef = useRef(false);
  const [activeStreamTab, setActiveStreamTab] = useState('facebook');
  const [showKey, setShowKey] = useState(false);

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(localStream);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  const [remoteCams, setRemoteCams] = useState([]); 
  const peerConnections = useRef({}); 
  const candidateBuffers = useRef({}); 

  const openCalibrator = (id) => {
    setCalibratorTargetSlot(id - 1);
    setShowCalibratorModal(true);
  };

  // v1.7.0 (Raíz D): el botón ya NO afirma el bloqueo antes de comprobar.
  // Orden: (1) capacidad real vía getCapabilities().focusMode; si la
  // cámara no expone el modo pedido, la UI lo dice y no se finge nada.
  // (2) applyConstraints. (3) confirmación vía getSettings().focusMode:
  // el estado guardado refleja lo que la pista CONFIRMÓ; si el driver
  // aceptó la llamada pero sigue en 'continuous', no hay bloqueo y se
  // dice. Sin catch silencioso: todo rechazo queda en log y en el estado.
  const toggleFocusLock = useCallback(async (camId) => {
    const wantLock = !camFocusLocked[camId];
    const stream = getCamStream(camId);
    const track = stream?.getVideoTracks?.()[0];
    const fail = (message) => {
      logger.warn(`[FocusLock] CAM ${camId}: ${message}`);
      setCamFocusLocked(prev => ({ ...prev, [camId]: false }));
      setCamFocusStatus(prev => ({ ...prev, [camId]: { supported: false, message } }));
    };
    if (!track || typeof track.applyConstraints !== 'function') {
      fail('Esta cámara no expone control de foco');
      return;
    }
    let modes = null;
    try { modes = track.getCapabilities?.()?.focusMode || null; } catch (e) { modes = null; }
    if (Array.isArray(modes) && modes.length > 0) {
      const canLock = modes.includes('manual') || modes.includes('single-shot');
      const canUnlock = modes.includes('continuous');
      if (wantLock && !canLock) { fail('Esta cámara no expone control de foco'); return; }
      if (!wantLock && !canUnlock) { fail('Esta cámara no expone autoenfoque reactivable'); return; }
    }
    try {
      if (wantLock) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'manual' }] });
        } catch {
          await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
        }
      } else {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch (e) {
      fail('La cámara rechazó el ajuste de foco');
      return;
    }
    let confirmedMode = null;
    try { confirmedMode = track.getSettings?.()?.focusMode || null; } catch (e) { confirmedMode = null; }
    if (confirmedMode) {
      const isLockedNow = confirmedMode === 'manual' || confirmedMode === 'single-shot';
      if (wantLock && !isLockedNow) {
        fail(`La cámara no aplicó el bloqueo de foco (sigue en «${confirmedMode}»)`);
        return;
      }
      if (!wantLock && isLockedNow) {
        logger.warn(`[FocusLock] CAM ${camId}: el driver mantiene «${confirmedMode}» tras pedir autoenfoque.`);
        setCamFocusLocked(prev => ({ ...prev, [camId]: true }));
        setCamFocusStatus(prev => ({ ...prev, [camId]: { supported: true, focusMode: confirmedMode, message: 'La cámara mantiene el foco fijo; no reactivó el autoenfoque' } }));
        return;
      }
      setCamFocusLocked(prev => ({ ...prev, [camId]: isLockedNow }));
      setCamFocusStatus(prev => ({ ...prev, [camId]: { supported: true, focusMode: confirmedMode } }));
    } else {
      // El driver aceptó la llamada pero no ofrece lectura de vuelta: se
      // aplica lo pedido, marcado como NO confirmado (no como un hecho).
      setCamFocusLocked(prev => ({ ...prev, [camId]: wantLock }));
      setCamFocusStatus(prev => ({ ...prev, [camId]: { supported: true, unconfirmed: true, message: 'La cámara aceptó el ajuste pero no confirma el modo de foco' } }));
    }
  }, [camFocusLocked, slotStreams, localStream]);
  const openSettings = (id) => { setEditingCamId(id); setShowSettingsModal(true); };
  const updateSetting = (key, value) => { setCamSettings(prev => ({ ...prev, [editingCamId]: { ...prev[editingCamId], [key]: value } })); };
  const resetSettings = () => { setCamSettings(prev => ({ ...prev, [editingCamId]: { ...defaultCamSettings } })); };

  const addCam = () => { 
    if (camSlots.length >= 12) return;
    const nextCount = camSlots.length + 1;
    const newSlots = Array.from({ length: nextCount }, (_, i) => i + 1);
    setCamSlots(newSlots); 
    camSlotsRef.current = newSlots;
    setCamSettings(prev => ({ ...prev, [nextCount]: { ...defaultCamSettings } })); 
    updateBroadcastState({ camSlots: newSlots });
    if (!isElectronMaster) {
      dispatchRemoteCommand('ADD_CAM_SLOT');
    }
  };

  const removeCam = (id) => { 
    if (id === 1 || camSlots.length <= 1) return;
    const removeIdx = id - 1;

    // 1. Detener pistas del stream de la ranura eliminada
    if (slotStreams[removeIdx]) {
      try { slotStreams[removeIdx].getTracks().forEach(t => t.stop()); } catch (e) {}
    }

    // 2. Re-indexar streams consecutivos desplazando slots posteriores
    setSlotStreams(prev => {
      const next = {};
      let targetIdx = 0;
      for (let i = 0; i < camSlots.length; i++) {
        if (i === removeIdx) continue;
        if (prev[i]) next[targetIdx] = prev[i];
        targetIdx++;
      }
      return next;
    });

    // 3. Re-indexar configuración de cámaras consecutivas
    setCamSettings(prev => {
      const next = {};
      let targetId = 1;
      for (let i = 1; i <= camSlots.length; i++) {
        if (i === id) continue;
        next[targetId] = prev[i] || { ...defaultCamSettings };
        targetId++;
      }
      return next;
    });

    // 4. Re-indexar encuadres / crops de cámaras
    setCameraCrops(prev => {
      const next = {};
      let targetIdx = 0;
      for (let i = 0; i < camSlots.length; i++) {
        if (i === removeIdx) continue;
        if (prev[i]) next[targetIdx] = prev[i];
        targetIdx++;
      }
      return next;
    });

    // 5. Re-indexar metadatos y etiquetas
    setCameraMeta(prev => {
      const next = {};
      let targetIdx = 0;
      for (let i = 0; i < camSlots.length; i++) {
        if (i === removeIdx) continue;
        if (prev[i]) next[targetIdx] = prev[i];
        targetIdx++;
      }
      return next;
    });

    // 6. Re-indexar estados de silencio (mute)
    setCamMuted(prev => {
      const next = {};
      let targetId = 1;
      for (let i = 1; i <= camSlots.length; i++) {
        if (i === id) continue;
        next[targetId] = prev[i];
        targetId++;
      }
      return next;
    });
    setCamSpeakerMuted(prev => {
      const next = {};
      let targetId = 1;
      for (let i = 1; i <= camSlots.length; i++) {
        if (i === id) continue;
        next[targetId] = prev[i];
        targetId++;
      }
      return next;
    });

    // 7. Re-numerar ranuras consecutivamente 1..N sin huecos
    const newCount = camSlots.length - 1;
    const newSlots = Array.from({ length: newCount }, (_, i) => i + 1);

    let nextActiveCam = activeCam;
    if (activeCam === id) {
      nextActiveCam = 1;
    } else if (activeCam > id) {
      nextActiveCam = activeCam - 1;
    }
    setActiveCam(nextActiveCam);

    let nextPvwCam = pvwCam;
    if (pvwCam === id) {
      nextPvwCam = nextActiveCam === 1 ? (newSlots.length > 1 ? 2 : 1) : 1;
    } else if (pvwCam > id) {
      nextPvwCam = pvwCam - 1;
    }
    setPvwCam(nextPvwCam);

    setCamSlots(newSlots);
    setCamMuted(prev => {
      const next = { ...prev };
      newSlots.forEach(slotId => { next[slotId] = (slotId !== nextActiveCam); });
      return next;
    });
    updateBroadcastState({
      camSlots: newSlots,
      activeCam: nextActiveCam,
      pvwCam: nextPvwCam
    });
    if (!isElectronMaster) {
      dispatchRemoteCommand('REMOVE_CAM_SLOT', { camId: id });
    }
  };

  // Transición instantánea CUT (conmuta PVW y PGM tanto en UI como en Master Canvas)
  const handleCutTransition = useCallback(() => {
    const fromPgm = activeCam;
    const toPgm = pvwCam;
    setActiveCam(toPgm);
    setPvwCam(fromPgm);
    setTBarPosition(0);
    setCamMuted(prev => {
      const next = { ...prev };
      camSlots.forEach(id => { next[id] = (id !== toPgm); });
      return next;
    });
    updateBroadcastState({
      activeCam: toPgm,
      pvwCam: fromPgm,
      transitionProgress: 0,
      transitionFromCam: null,
      transitionToCam: null,
    });
    if (!isElectronMaster) {
      dispatchRemoteCommand('TRIGGER_CUT');
    }
  }, [activeCam, pvwCam, camSlots, isElectronMaster, dispatchRemoteCommand]);

  // Transición suave AUTO (Disolvencia / Mix real en Master Canvas y grabación)
  const handleAutoTransition = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    if (!isElectronMaster) {
      dispatchRemoteCommand('TRIGGER_AUTO');
    }
    const start = performance.now();
    const duration = transitionDuration;
    const fromPgm = activeCam;
    const toPgm = pvwCam;

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1.0, elapsed / duration);
      setTBarPosition(progress);

      // Suministrar el progreso exacto al compositor broadcast para mezcla alfa continua
      updateBroadcastState({
        transitionProgress: progress,
        transitionFromCam: fromPgm,
        transitionToCam: toPgm,
      });

      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        setActiveCam(toPgm);
        setPvwCam(fromPgm);
        setTBarPosition(0);
        setCamMuted(prev => {
          const next = { ...prev };
          camSlots.forEach(id => { next[id] = (id !== toPgm); });
          return next;
        });
        updateBroadcastState({
          activeCam: toPgm,
          pvwCam: fromPgm,
          transitionProgress: 0,
          transitionFromCam: null,
          transitionToCam: null,
        });
        setIsTransitioning(false);
      }
    };
    requestAnimationFrame(step);
  }, [isTransitioning, transitionDuration, activeCam, pvwCam, camSlots, isElectronMaster, dispatchRemoteCommand]);

  // Control manual palanca T-Bar con mezcla proporcional real en Master Canvas
  const handleTBarChange = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1.0, val));
    setTBarPosition(clamped);
    if (!isElectronMaster) {
      dispatchRemoteCommand('SET_TBAR', { position: clamped });
    }

    if (clamped >= 0.98) {
      const fromPgm = activeCam;
      const toPgm = pvwCam;
      setActiveCam(toPgm);
      setPvwCam(fromPgm);
      setTBarPosition(0);
      setCamMuted(prev => {
        const next = { ...prev };
        camSlots.forEach(id => { next[id] = (id !== toPgm); });
        return next;
      });
      updateBroadcastState({
        activeCam: toPgm,
        pvwCam: fromPgm,
        transitionProgress: 0,
        transitionFromCam: null,
        transitionToCam: null,
      });
    } else {
      updateBroadcastState({
        transitionProgress: clamped,
        transitionFromCam: activeCam,
        transitionToCam: pvwCam,
      });
    }
  }, [activeCam, pvwCam, camSlots, isElectronMaster, dispatchRemoteCommand]);
  
  const getCamStream = (id) => { 
    const slotIdx = id - 1;
    const st = slotStreams[slotIdx];
    if (st) {
      const vTracks = st.getVideoTracks ? st.getVideoTracks() : [];
      if (vTracks.length === 0 || vTracks.every(t => t.readyState === 'ended')) {
        return null;
      }
      return st;
    }
    if (id === 1 && localStream) {
      const vTracks = localStream.getVideoTracks ? localStream.getVideoTracks() : [];
      if (vTracks.length === 0 || vTracks.every(t => t.readyState === 'ended')) {
        return null;
      }
      return localStream;
    }
    return null; 
  };

  // Mapeo dinámico de streams activos para análisis de audio por cámara
  const camStreamsMap = useMemo(() => {
    const map = {};
    camSlots.forEach(id => {
      map[id] = getCamStream(id);
    });
    return map;
  }, [camSlots, localStream, remoteCams, slotStreams]);

  // AFV is enforced inside masterBroadcastEngine with gain nodes.  Toggling
  // MediaStreamTrack.enabled here used to disable the physical input itself,
  // causing some USB devices to fail when they returned to Program.

  // Hook de niveles de percepción de micrófono y estado de silencio por cámara
  const camAudioLevels = useCameraAudioLevels(camStreamsMap, camMuted);

  // Hook de reconocimiento automático de orador y activación de cintillos (Fase P3.3)
  const {
    autoCintilloActive,
    activeSpeakerSlot,
    isSpeakerHolding,
  } = useAutoSpeakerCintillo({
    enabled: autoSpeakerCintilloEnabled,
    cameraLevels: camAudioLevels,
    cameraMeta,
    hostName,
    hostRole,
    guestName,
    guestRole,
    cintillosVisible,
    showManual,
    showCustom,
    hide: hideCintillo,
    sensitivityThreshold: 18,
    holdSeconds: 4.5,
  });

  // GESTIÓN DE ESPACIOS DE TRABAJO (WORKSPACES) (Fase P1.1)
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('podcast');

  const handleSelectWorkspace = useCallback((ws) => {
    setCurrentWorkspaceId(ws.id);
    if (ws.defaultLayout) setLayoutMode(ws.defaultLayout);
    if (ws.camSlotCount) {
      const slots = Array.from({ length: ws.camSlotCount }, (_, i) => i + 1);
      setCamSlots(slots);
    }
    if (typeof ws.dualMonitorDefault === 'boolean') {
      setDualMonitorMode(ws.dualMonitorDefault);
    }
    if (ws.activePanelDefault !== undefined) {
      setActivePanel(ws.activePanelDefault);
    }
    if (typeof ws.cintillosVisibleDefault === 'boolean') {
      setCintillosVisible(ws.cintillosVisibleDefault);
    }
    if (ws.pipCamDefault) setPipCam(ws.pipCamDefault);
    if (ws.activeCamDefault) setActiveCam(ws.activeCamDefault);

    updateBroadcastState({
      layoutMode: ws.defaultLayout || layoutMode,
      cintillosVisible: ws.cintillosVisibleDefault ?? cintillosVisible,
      camSlots: Array.from({ length: ws.camSlotCount || 4 }, (_, i) => i + 1)
    });
  }, [layoutMode, cintillosVisible]);

  // GESTIÓN DE HIGHLIGHTS Y CLIPS VIRALES EN VIVO (P3.1)
  const {
    highlights,
    addHighlight,
    removeHighlight,
    clearHighlights,
    count: highlightCount
  } = useLiveHighlights({
    isRecording,
    recordingDuration: recordingTime,
    projectName: topic || 'Proyecto_General'
  });

  // CARTUCHERA DE EFECTOS POR TECLADO NUMÉRICO NUMPAD (Fase P2.3)
  useNumpadSfx({
    onPlaySfx: (id) => {
      playSfx(id);
      if (isRecording && (id === 'applause' || id === 'cheering')) {
        addHighlight('Aplausos / Ovación [SFX]', 'sfx_applause');
      }
    },
    onStopSfx: () => stopSfx(),
    enabled: true
  });

  // VISUALIZADOR DE ESPECTRO EN MODO RADIO VIRTUAL (Fase P2.3)
  useEffect(() => {
    updateBroadcastState({
      showAudioVisualizer: currentWorkspaceId === 'radio'
    });
  }, [currentWorkspaceId]);

  // REPETICIÓN INSTANTÁNEA EN VIVO CON BÚFER CIRCULAR (Fase P4.3)
  const instantReplay = useInstantReplay();
  const [showInstantReplayControl, setShowInstantReplayControl] = useState(false);

  // SALIDA LAN PROGRAM & VIRTUAL FEED (Fase P4.4)
  const [showLanProgramModal, setShowLanProgramModal] = useState(false);
  const [lanProgramUrl, setLanProgramUrl] = useState('');

  useEffect(() => {
    if (window.api?.getProgramFeedUrl) {
      window.api.getProgramFeedUrl().then(url => {
        if (url) setLanProgramUrl(url);
      }).catch(() => {});
    }
  }, []);

  // 1. Notificar a Electron que el estudio está completamente montado y listo
  useEffect(() => {
    if (window.api?.signalReady) {
      window.api.signalReady();
    }
  }, []);

  // 2. Monitorización de clientes remotos LAN y Cloud para no consumir CPU en vacío
  const feedClientsCountRef = useRef(0);
  const remoteClientsCountRef = useRef(0);
  const hasCloudClientsRef = useRef(false);

  useEffect(() => {
    if (!isElectronMaster) return;
    if (window.api?.getFeedClientCount) {
      window.api.getFeedClientCount().then(counts => {
        if (counts) {
          feedClientsCountRef.current = counts.feedClients || 0;
          remoteClientsCountRef.current = counts.remoteClients || 0;
        }
      }).catch(() => {});
    }
    if (window.api?.onFeedClientsChange) {
      const unsub = window.api.onFeedClientsChange(counts => {
        if (counts) {
          feedClientsCountRef.current = counts.feedClients || 0;
          remoteClientsCountRef.current = counts.remoteClients || 0;
        }
      });
      return unsub;
    }
  }, [isElectronMaster]);

  // Emisión continua de fotogramas PGM al servidor HTTP/WS para clientes externos e iPad en LAN y Cloud (Ultra Baja Latencia)
  useEffect(() => {
    if (!isElectronMaster) return;
    let timer = null;
    let isBroadcasting = true;
    let lastCloudEmit = 0;
    let lastThumbEmit = 0;

    // El encoder Master conserva 1080p30 para grabación/RTMP. El monitor LAN
    // es deliberadamente más liviano: comprimir un JPEG 1080p diez veces por
    // segundo en el proceso de interfaz congelaba clics y transiciones.
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 960;
    previewCanvas.height = 540;
    const previewCtx = previewCanvas.getContext('2d', { alpha: false });
    let lastProgramEmit = 0;

    const streamLoop = () => {
      if (!isBroadcasting) return;
      const now = Date.now();
      const hasLanFeed = feedClientsCountRef.current > 0;
      const hasRemoteCtrl = remoteClientsCountRef.current > 0;
      const hasCloudFeed = hasCloudClientsRef.current;

      // Los controles remotos sólo reciben miniaturas; no requieren recodificar
      // el Programa completo en cada ciclo.
      const needsProgramFrame = hasLanFeed || hasCloudFeed;
      if (!needsProgramFrame && !hasRemoteCtrl) {
        timer = setTimeout(streamLoop, 1000);
        return;
      }

      const c = getMasterCanvas();
      if (needsProgramFrame && c && c.width > 0 && c.height > 0 && now - lastProgramEmit >= 300) {
        try {
          lastProgramEmit = now;
          if (previewCtx) {
            previewCtx.drawImage(c, 0, 0, 960, 540);
          }
          const lowLatencyDataUrl = previewCanvas.toDataURL('image/jpeg', 0.72);

          // 1. Enviar a clientes WebSocket LAN (iPad en red local) si están conectados
          if (hasLanFeed && window.api?.sendProgramFeedFrame) {
            window.api.sendProgramFeedFrame(lowLatencyDataUrl);
          }

          // Emitir snapshot de monitor por Supabase para iPads remotos vía Cloud.
          if (hasCloudFeed && controlChannelRef.current && (now - lastCloudEmit > 350)) {
            lastCloudEmit = now;
            controlChannelRef.current.send({
              type: 'broadcast',
              event: 'pgm_cloud_frame',
              payload: { dataUrl: lowLatencyDataUrl }
            }).catch(() => {});
          }
        } catch(e) {}
      }

      // Miniaturas de cámaras para Multiviewer: una vez cada 2.5 s, sin
      // depender de la compresión del Programa.
      if (hasRemoteCtrl && window.api?.sendCamThumbnails && (now - lastThumbEmit > 2500)) {
        lastThumbEmit = now;
        const thumbs = getCameraSnapshots();
        if (thumbs && Object.keys(thumbs).length > 0) {
          window.api.sendCamThumbnails(thumbs);
        }
      }

      timer = setTimeout(streamLoop, 100);
    };

    streamLoop();
    return () => {
      isBroadcasting = false;
      if (timer) clearTimeout(timer);
    };
  }, [isElectronMaster]);

  // Guardar calibración de cámara (zoom, pan, color, LUT, audio)
  const handleSaveSlotProfile = (slotIndex, profile) => {
    setCameraCrops(prev => {
      const updated = {
        ...prev,
        [slotIndex]: {
          ...(prev[slotIndex] || {}),
          ...profile,
        }
      };
      try { localStorage.setItem('podcastudio_camera_crops', JSON.stringify(updated)); } catch (e) {}
      updateBroadcastState({ cameraCrops: updated });
      return updated;
    });

    if (profile.audioMuted !== undefined) {
      const camId = slotIndex + 1;
      setCamMuted(prev => ({ ...prev, [camId]: Boolean(profile.audioMuted) }));
    }
  };

  // Silenciar / Activar micrófono de cámara individual (para evitar eco con micrófonos externos)
  const toggleMuteCam = async (camId) => {
    const nextMuted = !Boolean(camMuted[camId]);
    setCamMuted(prev => ({ ...prev, [camId]: nextMuted }));
    // AFV is applied by the master gain bus. Do not disable MediaStream tracks:
    // many UVC drivers cannot recover an input after it has been disabled.
    handleSaveSlotProfile(camId - 1, { audioMuted: nextMuted });
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_MIC_MUTE', { camId });
    }
  };

  // Silenciar / Activar bocina de monitoreo local (retorno en altavoces de la computadora para no viciar el audio)
  const toggleSpeakerCam = (camId) => {
    setCamSpeakerMuted(prev => ({
      ...prev,
      [camId]: !Boolean(prev[camId])
    }));
  };

  // ZOOM DINÁMICO & ENCUADRE DE CÁMARA (PAN / DRAG 1:1) CON EL MOUSE EN PANTALLA MASTER
  useEffect(() => {
    const el = masterMonitorRef.current;
    if (!el) return;

    // 1. Zoom dinámico suave y gradual con la rueda del ratón (Scroll)
    const onWheelHandler = (e) => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();

      const slotIdx = activeCam - 1;
      const currentCrop = cameraCrops[slotIdx] || {};
      const currentZoom = currentCrop.zoom ?? camSettings[activeCam]?.zoom ?? 1.0;

      // Subir o bajar lento y gradual como en los teléfonos (0.04x por paso de scroll)
      const deltaStep = e.deltaY < 0 ? 0.04 : -0.04;
      let targetZoom = Math.round((currentZoom + deltaStep) * 100) / 100;
      targetZoom = Math.max(1.0, Math.min(4.0, targetZoom));

      if (Math.abs(targetZoom - currentZoom) > 0.001) {
        const curFocusX = currentCrop.focusX ?? (camSettings[activeCam]?.panX != null ? camSettings[activeCam].panX / 100 : 0.5);
        const curFocusY = currentCrop.focusY ?? (camSettings[activeCam]?.panY != null ? camSettings[activeCam].panY / 100 : 0.42);

        // Si se regresa al 1.0x, centrar automáticamente la toma; si tiene zoom, respetar el encuadre actual
        const nextFocusX = targetZoom > 1.01 ? curFocusX : 0.5;
        const nextFocusY = targetZoom > 1.01 ? curFocusY : 0.42;

        const updatedProfile = {
          ...currentCrop,
          zoom: targetZoom,
          focusX: nextFocusX,
          focusY: nextFocusY,
        };

        handleSaveSlotProfile(slotIdx, updatedProfile);
        updateBroadcastState({
          cameraCrops: { ...cameraCrops, [slotIdx]: updatedProfile }
        });

        // Mostrar HUD temporal del zoom tipo smartphone
        setZoomHud({ visible: true, zoom: targetZoom });
        if (zoomHudTimeoutRef.current) clearTimeout(zoomHudTimeoutRef.current);
        zoomHudTimeoutRef.current = setTimeout(() => {
          setZoomHud(prev => ({ ...prev, visible: false }));
        }, 1300);
      }
    };

    // 2. Encuadre interactivo: Clic izquierdo presionado y arrastrar (mover/centrar imagen como ventana de Windows)
    const onMouseDownHandler = (e) => {
      if (e.button !== 0) return; // Exclusivo botón izquierdo

      const slotIdx = activeCam - 1;
      const currentCrop = cameraCrops[slotIdx] || {};
      const currentZoom = currentCrop.zoom ?? camSettings[activeCam]?.zoom ?? 1.0;

      // Respetar el zoom actual suavemente sin brincos bruscos
      const activeZoom = currentZoom;

      const curFocusX = currentCrop.focusX ?? (camSettings[activeCam]?.panX != null ? camSettings[activeCam].panX / 100 : 0.5);
      const curFocusY = currentCrop.focusY ?? (camSettings[activeCam]?.panY != null ? camSettings[activeCam].panY / 100 : 0.42);

      isDraggingRef.current = true;
      setIsDraggingMaster(true);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startFocusX: curFocusX,
        startFocusY: curFocusY,
        zoom: activeZoom,
        slotIdx,
        currentCrop
      };

      setPanHud({
        visible: true,
        x: Math.round(curFocusX * 100),
        y: Math.round(curFocusY * 100)
      });

      e.preventDefault();
    };

    const onMouseMoveHandler = (e) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      e.preventDefault();

      const { startX, startY, startFocusX, startFocusY, zoom, slotIdx, currentCrop } = dragStartRef.current;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Cálculo de desplazamiento 1:1 pixel exacto con el ratón
      const effectiveZoom = Math.max(1.05, zoom);
      const shiftRangeX = rect.width * (1 - 1 / effectiveZoom);
      const shiftRangeY = rect.height * (1 - 1 / effectiveZoom);

      // Jalar hacia la izquierda (deltaX < 0) despliega el lado derecho -> focusX aumenta
      // Jalar hacia arriba (deltaY < 0) despliega la parte inferior -> focusY aumenta
      const deltaFocusX = shiftRangeX > 0 ? - (deltaX / shiftRangeX) : 0;
      const deltaFocusY = shiftRangeY > 0 ? - (deltaY / shiftRangeY) : 0;

      let nextFocusX = Math.max(0.0, Math.min(1.0, startFocusX + deltaFocusX));
      let nextFocusY = Math.max(0.0, Math.min(1.0, startFocusY + deltaFocusY));

      nextFocusX = Math.round(nextFocusX * 1000) / 1000;
      nextFocusY = Math.round(nextFocusY * 1000) / 1000;

      const updatedProfile = {
        ...currentCrop,
        zoom,
        focusX: nextFocusX,
        focusY: nextFocusY,
      };

      handleSaveSlotProfile(slotIdx, updatedProfile);
      updateBroadcastState({
        cameraCrops: { ...cameraCrops, [slotIdx]: updatedProfile }
      });

      setPanHud({
        visible: true,
        x: Math.round(nextFocusX * 100),
        y: Math.round(nextFocusY * 100)
      });
    };

    const onMouseUpHandler = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDraggingMaster(false);
        dragStartRef.current = null;
        if (panHudTimeoutRef.current) clearTimeout(panHudTimeoutRef.current);
        panHudTimeoutRef.current = setTimeout(() => {
          setPanHud(prev => ({ ...prev, visible: false }));
        }, 1200);
      }
    };

    el.addEventListener('wheel', onWheelHandler, { passive: false });
    el.addEventListener('mousedown', onMouseDownHandler);
    window.addEventListener('mousemove', onMouseMoveHandler);
    window.addEventListener('mouseup', onMouseUpHandler);

    return () => {
      el.removeEventListener('wheel', onWheelHandler);
      el.removeEventListener('mousedown', onMouseDownHandler);
      window.removeEventListener('mousemove', onMouseMoveHandler);
      window.removeEventListener('mouseup', onMouseUpHandler);
      if (zoomHudTimeoutRef.current) clearTimeout(zoomHudTimeoutRef.current);
      if (panHudTimeoutRef.current) clearTimeout(panHudTimeoutRef.current);
    };
  }, [activeCam, cameraCrops, camSettings]);
  
  const getVideoStyle = (camId, isMaster = false) => {
    const s = camSettings[camId] || defaultCamSettings;
    const crop = cameraCrops[camId - 1] || {};

    const zoom = Math.max(1.0, crop.zoom ?? s.zoom ?? 1.0);
    const focusX = crop.focusX != null ? crop.focusX : (s.panX != null ? s.panX / 100 : 0.5);
    const focusY = crop.focusY != null ? crop.focusY : (s.panY != null ? s.panY / 100 : 0.42);

    const filter = crop.colorEnabled === true ? buildCanvasFilter({
      brightness: crop.brightness ?? s.brightness,
      contrast: crop.contrast ?? s.contrast,
      saturation: crop.saturation ?? s.saturation,
      warmth: crop.warmth ?? s.temp,
      tint: crop.tint ?? 0,
      sharpness: crop.sharpness ?? s.sharpness ?? 100,
    }) : 'none';

    // Panning relativo al zoom con centro fijo al 50%: elimina al 100% cualquier brinco visual
    const panPercentX = (0.5 - focusX) * (zoom - 1) * 100;
    const panPercentY = (0.42 - focusY) * (zoom - 1) * 100;

    const isZoomed = Math.abs(zoom - 1.0) > 0.005 || Math.abs(panPercentX) > 0.05 || Math.abs(panPercentY) > 0.05;

    return {
      transformOrigin: '50% 50%',
      transform: isZoomed 
        ? `translate3d(${panPercentX.toFixed(2)}%, ${panPercentY.toFixed(2)}%, 0) scale(${zoom.toFixed(3)})` 
        : 'translate3d(0, 0, 0) scale(1)',
      transition: (isMaster && !isDraggingMaster) ? 'transform 0.15s ease-out' : 'none',
      filter: filter !== 'none' ? filter : undefined,
    };
  };

  const getUserMediaWithTimeout = (constraints, timeoutMs = 6000) => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('TIMEOUT_EXCEEDED'));
        }
      }, timeoutMs);

      navigator.mediaDevices.getUserMedia(constraints)
        .then((st) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(st);
          } else {
            try { st.getTracks().forEach(t => t.stop()); } catch (e) {}
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  };

  // A USB camera and its embedded microphone share a media-device group in
  // Chromium.  Never attach the system's default microphone to every camera:
  // that creates duplicate/incorrect audio sources and defeats audio-follow-
  // video. Secondary cameras get audio only when a paired input is known.
  const findPairedAudioInput = async (videoDeviceId) => {
    if (!videoDeviceId || !navigator.mediaDevices?.enumerateDevices) return null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const video = devices.find(d => d.kind === 'videoinput' && d.deviceId === videoDeviceId);
      if (!video?.groupId) return null;
      return devices.find(d => d.kind === 'audioinput' && d.groupId === video.groupId)?.deviceId || null;
    } catch {
      return null;
    }
  };

  // v1.7.0 (Raíz C): la fuente de audio de cada ranura es EXPLÍCITA.
  // Antes, si la cámara no traía pista de audio y no se encontraba micro
  // emparejado, attachCameraAudio abría con constraints genéricas el
  // dispositivo POR DEFECTO del sistema — el micro de la computadora — y
  // lo metía DENTRO del stream de la cámara máster (allowDefault): el
  // micro de la PC quedaba invisible, mezclado e inseparable. PROHIBIDO:
  // esta función solo abre (a) el micro elegido por el usuario
  // (audioSourceDeviceId) o (b) el emparejado por groupId con la cámara.
  // Sin ninguno de los dos, la ranura queda SIN audio hasta que el
  // usuario elija fuente en la UI; jamás se sustituye por el default.
  const attachCameraAudio = async (stream, videoDeviceId, { audioSourceDeviceId = null } = {}) => {
    if (!stream) return null;
    if (stream.getAudioTracks().length > 0) {
      return stream.getAudioTracks()[0].getSettings?.()?.deviceId || null;
    }
    const targetDeviceId = audioSourceDeviceId || (await findPairedAudioInput(videoDeviceId));
    if (!targetDeviceId) return null;
    try {
      const audioStream = await getUserMediaWithTimeout({
        audio: { deviceId: { exact: targetDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      }, 3500);
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
      return audioTrack ? targetDeviceId : null;
    } catch (error) {
      logger.warn('[USB audio] No se pudo abrir la fuente de audio de la ranura:', error?.message || error);
      return null;
    }
  };

  // Elección de fuente de audio por cámara (v1.7.0, Raíz C). Valores:
  // 'camera' = micro emparejado de la propia cámara (defecto), 'none' =
  // sin audio (bloqueado), o un deviceId de audioinput elegido. Se guarda
  // por deviceId de vídeo: la elección sigue a la cámara, no a la ranura.
  const slotAudioChoiceRef = useRef((() => {
    try { return JSON.parse(localStorage.getItem('podcastudio_audio_source_by_device') || '{}'); } catch { return {}; }
  })());
  const [slotAudioChoices, setSlotAudioChoices] = useState({});
  const getAudioChoiceForDevice = (videoDeviceId) => slotAudioChoiceRef.current[videoDeviceId] || 'camera';
  const getSlotAudioChoice = (slot) => {
    if (slotAudioChoices[slot]) return slotAudioChoices[slot];
    const videoDeviceId = cameraMetaRef.current[slot]?.deviceId;
    return videoDeviceId ? getAudioChoiceForDevice(videoDeviceId) : 'camera';
  };
  const persistAudioChoice = (videoDeviceId, choice) => {
    if (!videoDeviceId) return;
    slotAudioChoiceRef.current = { ...slotAudioChoiceRef.current, [videoDeviceId]: choice };
    try { localStorage.setItem('podcastudio_audio_source_by_device', JSON.stringify(slotAudioChoiceRef.current)); } catch {}
  };

  // Adjunta el audio de una ranura respetando la elección del usuario:
  // 'none' no adjunta nada y marca la ranura como bloqueada.
  const attachSlotAudio = (slot, stream, videoDeviceId) => {
    const choice = getAudioChoiceForDevice(videoDeviceId);
    if (choice === 'none') {
      setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], audioDeviceId: null, audioSourceBlocked: true } }));
      return;
    }
    attachCameraAudio(stream, videoDeviceId, { audioSourceDeviceId: choice === 'camera' ? null : choice })
      .then(audioDeviceId => {
        if (audioDeviceId) {
          cameraMetaRef.current[slot] = { ...cameraMetaRef.current[slot], audioDeviceId, audioSourceBlocked: false };
          setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], audioDeviceId, audioSourceBlocked: false } }));
        }
      })
      .catch(() => {});
  };

  // Cambio de fuente desde la UI (modal de configuración de la cámara):
  // desacopla la pista actual y acopla la elegida, en caliente. Las
  // cámaras USB se abren SOLO con vídeo (openProvenUsbStream, audio:
  // false), así que toda pista de audio presente en su stream fue
  // acoplada por attachCameraAudio y se puede retirar sin tocar el vídeo.
  const handleAudioSourceChange = async (slot, choice) => {
    const meta = cameraMetaRef.current[slot] || {};
    const videoDeviceId = meta.deviceId;
    persistAudioChoice(videoDeviceId, choice);
    setSlotAudioChoices(prev => ({ ...prev, [slot]: choice }));
    const stream = slotStreamsRef.current[slot] || (slot === 0 ? localStreamRef.current : null);
    if (!stream) return;
    if (meta.type === 'usb' || slot === 0) {
      stream.getAudioTracks().slice().forEach(t => {
        try { t.stop(); } catch {}
        try { stream.removeTrack(t); } catch {}
      });
    }
    if (choice === 'none') {
      cameraMetaRef.current[slot] = { ...cameraMetaRef.current[slot], audioDeviceId: null, audioSourceBlocked: true };
      setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], audioDeviceId: null, audioSourceBlocked: true } }));
      return;
    }
    const audioDeviceId = await attachCameraAudio(stream, videoDeviceId, { audioSourceDeviceId: choice === 'camera' ? null : choice });
    cameraMetaRef.current[slot] = { ...cameraMetaRef.current[slot], audioDeviceId, audioSourceBlocked: false };
    setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], audioDeviceId, audioSourceBlocked: false } }));
  };

  // Dispositivos de entrada de audio para el selector de fuente (se
  // refresca al abrir el modal de configuración y en devicechange).
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const refreshAudioInputDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices?.() || [];
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
    } catch {}
  }, []);
  useEffect(() => {
    refreshAudioInputDevices();
    const md = navigator.mediaDevices;
    if (md?.addEventListener) {
      md.addEventListener('devicechange', refreshAudioInputDevices);
      return () => md.removeEventListener('devicechange', refreshAudioInputDevices);
    }
    return undefined;
  }, [refreshAudioInputDevices]);

  useEffect(() => {
    if (!isElectronMaster) {
      logger.log('[PodcastStudio] Cliente remoto / iPad: Modo Switcher Espejo activo. Cámara local desactivada.');
      return;
    }
    const startCamera = async () => {
      const preferredDeviceId = localStorage.getItem('podcastudio_master_camera_device');
      const preferredLabel = localStorage.getItem('podcastudio_master_camera_label');
      if (!preferredDeviceId && !preferredLabel) return;
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) || [];
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        if (videoDevs.length === 0) return;

        const targetDev = videoDevs.find(d => d.deviceId === preferredDeviceId) 
          || (preferredLabel ? videoDevs.find(d => d.label && d.label.toLowerCase().includes(preferredLabel.toLowerCase())) : null);
        
        if (!targetDev) return;
        const effectiveDeviceId = targetDev.deviceId;

        // Apertura directa con las constraints probadas (v1.6.1): es la
        // única cámara en este punto del arranque, así que la apertura ya
        // es secuencial por construcción.
        let stream = null;
        try {
          stream = await openProvenUsbStream(effectiveDeviceId, getUserMediaWithTimeout);
        } catch (e1) {
          stream = null;
        }

        if (stream) {
          const vt = stream.getVideoTracks()[0];
          if (vt && 'contentHint' in vt) vt.contentHint = 'motion';

          setLocalStream(stream);
          setSlotStreams(prev => ({ ...prev, 0: stream }));
          const videoTrack = stream.getVideoTracks()[0];
          const devId = videoTrack?.getSettings?.()?.deviceId || effectiveDeviceId;
          const devLabel = videoTrack?.label || targetDev.label || 'Cámara 1 (Principal)';
          setCameraMeta(prev => ({ ...prev, 0: { deviceId: devId, resolution: getVideoTrackResolution(stream), videoInfo: getVideoTrackInfo(stream), label: devLabel, type: 'usb' } }));

          // Adjuntar audio asociado en segundo plano sin congelar el video en pantalla.
          // v1.7.0 (Raíz C): pasa por attachSlotAudio — respeta la fuente
          // elegida y NUNCA inyecta el micro por defecto de la PC.
          const videoDeviceId = stream.getVideoTracks()[0]?.getSettings?.()?.deviceId || effectiveDeviceId;
          attachSlotAudio(0, stream, videoDeviceId);



          if (stream.getAudioTracks().length > 0) {
            try {
              const audioCtx = getBroadcastAudioContext();
              const analyser = audioCtx.createAnalyser();
              const source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);
              analyser.fftSize = 256;
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              let lastUiUpdate = 0;
              let lastPublishedLevel = -1;
              const updateVolume = () => {
                // Gobernador (v3.2.4): con la página oculta el medidor no
                // analiza ni publica estado; el bucle sigue vivo pero su
                // coste en segundo plano es ~cero y al volver no hay
                // ningún atraso que reproducir (rAF no acumula cola).
                if (typeof document !== 'undefined' && document.hidden) {
                  requestAnimationFrame(updateVolume);
                  return;
                }
                analyser.getByteFrequencyData(dataArray);
                let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const now = performance.now();
                if (now - lastUiUpdate >= 200) {
                  const level = Math.min(100, Math.round((sum / dataArray.length / 128) * 20) * 5);
                  if (Math.abs(level - lastPublishedLevel) >= 5) {
                    setMicLevel(level);
                    lastPublishedLevel = level;
                  }
                  lastUiUpdate = now;
                }
                requestAnimationFrame(updateVolume);
              };
              updateVolume();
            } catch (e) {}
          }
        }
      } catch (err) { logger.error("Error cámara inicial:", err); }
    };
    const mountTimer = setTimeout(() => {
      startCamera();
    }, 300);
    return () => clearTimeout(mountTimer);
  }, []);

  // LÓGICA DE SCROLL FLUIDO 60FPS CON TRANSFORM 3D (TELEPROMPTER SIN BRINCO NI VIBRACIÓN)
  // v3.3.2: UN solo bucle para UN solo reloj. El bucle avanza
  // teleprompterYRef SOLO si hay al menos una superficie montada que lo
  // muestre (overlay y/o caja del panel) y lo ACOTA al recorrido real
  // medido de esas superficies: al final del texto, el desplazamiento se
  // detiene en el final en ambas. Después proyecta las dos superficies
  // desde el mismo desplazamiento. (La era anterior: el reloj «avanza
  // SIEMPRE, esté montada la superficie que esté montada» — y corría a
  // y=12437 con el HUD apagado — y la caja tenía su propio rAF y su
  // propio acumulador «puerto seguro». Ambos quedan retirados.)
  useEffect(() => {
    let animationFrameId;
    let lastTime = null;

    const animate = (time) => {
      if (!lastTime) lastTime = time;
      const delta = Math.min(33, Math.max(1, time - lastTime));
      lastTime = time;

      if (isTeleprompterPlaying) {
        const maximo = medirMaximoDesplazamientoPrompter();
        if (maximo !== null) {
          const speed = (teleprompterSpeed || 3) * 1.8;
          const moveAmount = speed * (delta / 16.666);
          teleprompterYRef.current += moveAmount;
          teleprompterYRef.current = acotarDesplazamientoPrompter(teleprompterYRef.current, maximo);
        }
        // Proyecciones del MISMO desplazamiento: el overlay sobre la
        // región de la cámara de programa (transform) y la caja de
        // lectura del panel (scrollTop). Si una superficie se monta a
        // mitad de lectura, sale ya en el punto del guion que toca.
        projectTeleprompterOverlay();
        projectTeleprompterPanel();
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (teleprompterTextRef.current) teleprompterTextRef.current.style.willChange = 'transform';
    // Al montar (o al cambiar play/velocidad), la posición de ambas
    // superficies sale de la proyección del reloj, nunca de una posición
    // guardada en otra parte.
    projectTeleprompterOverlay();
    projectTeleprompterPanel();
    if (isTeleprompterPlaying) {
      animationFrameId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isTeleprompterPlaying, teleprompterSpeed]);

  // Al encender el HUD o cambiar el guion con el HUD encendido, el texto
  // se coloca según el desplazamiento vigente en cuanto el overlay monta.
  useEffect(() => {
    if (showFloatingPrompter) projectTeleprompterOverlay();
  }, [showFloatingPrompter, teleprompterText]);

  // v3.3.2 (modalidades): con el HUD encendido pero en pausa, la franja
  // sigue a la región PGM cuando cambia el layout, la cámara de programa
  // o el tamaño de la ventana (reproduciendo, el bucle ya reproyecta en
  // cada fotograma).
  useEffect(() => {
    if (!showFloatingPrompter) return undefined;
    projectTeleprompterOverlay();
    const onResize = () => projectTeleprompterOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode, activeCam, camSlots, showFloatingPrompter]);

  // (El rAF propio de la caja del panel — el «puerto seguro» de la build
  // diagnóstica post-v3.2.4 — quedó RETIRADO en la v3.3.2: la caja se
  // proyecta desde el reloj único en el bucle de arriba.)

  // ==========================================================================
  // INSTRUMENTO DE DIAGNÓSTICO DE VENTANA (build diagnóstica post-v3.2.4):
  // el renderer alimenta userData/logs/ventana-diag.log vía el proceso
  // principal (window.api.diagPing / diagEvent). Solo observa y anota:
  // ningún cambio visual ni de comportamiento sale de aquí.
  // ==========================================================================
  const ventanaDiagSend = (prefix, text) => {
    try { window.api?.diagEvent?.(prefix, text); } catch (e) {}
  };
  const ventanaDiagValoresRef = useRef({ camaras: 0, grabando: false, transmitiendo: false });
  useEffect(() => {
    ventanaDiagValoresRef.current = {
      camaras: camSlots.filter((s) => slotStreams[s - 1] || cameraMeta[s - 1]).length,
      grabando: !!isRecording,
      transmitiendo: !!isStreaming,
    };
  }, [camSlots, slotStreams, cameraMeta, isRecording, isStreaming]);

  // Latido del renderer (ping cada 500 ms), visibilitychange y muestra
  // del estado de composición cada 5 s.
  useEffect(() => {
    if (!window.api?.diagPing && !window.api?.diagEvent) return undefined;
    let prevTicks = 0;
    let prevComps = 0;
    try {
      const s0 = getRenderDiagStats();
      prevTicks = s0.ticksReceived;
      prevComps = s0.compositionsRun;
    } catch (e) {}
    const pingId = setInterval(() => {
      try { window.api?.diagPing?.(performance.now()); } catch (e) {}
    }, 500);
    const onVis = () => {
      ventanaDiagSend('foco', `renderer visibilitychange estado=${document.visibilityState} hidden=${document.hidden}`);
    };
    document.addEventListener('visibilitychange', onVis);
    const muestraId = setInterval(() => {
      try {
        const s = getRenderDiagStats();
        const g = getCompositionGovernorState();
        const v = ventanaDiagValoresRef.current || {};
        const dTicks = s.ticksReceived - prevTicks;
        const dComps = s.compositionsRun - prevComps;
        prevTicks = s.ticksReceived;
        prevComps = s.compositionsRun;
        const haceMs = g.lastRenderAt > 0 ? Math.round(performance.now() - g.lastRenderAt) : 'nunca';
        ventanaDiagSend('muestra', `ticks5s=${dTicks} composiciones5s=${dComps} modoGobernador=${g.mode} visible=${g.visible} enfocado=${g.focused} ultimoRenderHaceMs=${haceMs} camarasActivas=${v.camaras ?? '?'} grabando=${!!v.grabando} transmitiendo=${!!v.transmitiendo}`);
      } catch (e) {}
    }, 5000);
    return () => {
      clearInterval(pingId);
      clearInterval(muestraId);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // [prompter] cambios del HUD y de INICIAR/PAUSAR con el estado resultante
  // (la primera línea de cada efecto es el estado al montar la app).
  useEffect(() => {
    ventanaDiagSend('prompter', `HUD=${showFloatingPrompter ? 'ON' : 'OFF'} reproduciendo=${isTeleprompterPlaying}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFloatingPrompter]);
  useEffect(() => {
    ventanaDiagSend('prompter', `${isTeleprompterPlaying ? 'INICIAR' : 'PAUSAR'} -> reproduciendo=${isTeleprompterPlaying} hud=${showFloatingPrompter ? 'ON' : 'OFF'} y=${Math.round(teleprompterYRef.current)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeleprompterPlaying]);

  // [prompter] una vez por segundo mientras reproduce: los valores REALES
  // del overlay (o su ausencia) y del recuadro del panel.
  useEffect(() => {
    if (!isTeleprompterPlaying) return undefined;
    const id = setInterval(() => {
      try {
        const panel = rightPrompterScrollRef.current;
        const panelTxt = panel ? `panelScrollTop=${Math.round(panel.scrollTop)}` : 'panelScrollTop=sin-panel';
        const el = teleprompterTextRef.current;
        if (!el || !el.parentElement) {
          ventanaDiagSend('prompter', `overlay AUSENTE hud=${showFloatingPrompter ? 'ON' : 'OFF'} y=${Math.round(teleprompterYRef.current)} ${panelTxt}`);
          return;
        }
        const stripH = el.parentElement.clientHeight || 0;
        const textH = el.scrollHeight || el.offsetHeight || 0;
        const yCalc = Math.max(-textH, stripH - teleprompterYRef.current);
        ventanaDiagSend('prompter', `overlay PRESENTE hud=${showFloatingPrompter ? 'ON' : 'OFF'} y=${Math.round(teleprompterYRef.current)} franjaPx=${stripH} textoPx=${textH} translateYCalculado=${yCalc.toFixed(1)} transformAplicado="${el.style.transform || ''}" ${panelTxt}`);
      } catch (e) {}
    }, 1000);
    return () => clearInterval(id);
  }, [isTeleprompterPlaying, showFloatingPrompter]);

  // v3.3.2: ÚNICO camino de INICIAR/PAUSAR — el botón de transporte del
  // panel y el clic sobre la caja de lectura pasan por aquí. (El
  // handlePlayTeleprompter anterior, el único con guarda de fin de
  // guion, era código muerto: estaba definido y nadie lo llamaba; el
  // botón alternaba el estado a pelo y la guarda nunca corría.) Si el
  // reloj ya llegó al final del recorrido real medido, INICIAR vuelve
  // al principio en vez de seguir fuera de vista.
  const handleToggleTeleprompterPlay = () => {
    if (isTeleprompterPlaying) {
      setIsTeleprompterPlaying(false);
      return;
    }
    const maximo = medirMaximoDesplazamientoPrompter();
    if (maximo !== null && maximo > 0 && teleprompterYRef.current >= maximo) {
      teleprompterYRef.current = 0;
      if (rightPrompterScrollRef.current) rightPrompterScrollRef.current.scrollTop = 0;
      projectTeleprompterOverlay();
    }
    setIsTeleprompterPlaying(true);
  };

  // TEMPORIZADOR PRECISO DE GRABACIÓN BASADO EN RELOJ REAL (Date.now)
  useEffect(() => {
    let timer;
    if (isRecording) {
      if (!isRecordingPaused) {
        if (!recordingStartTimeRef.current) {
          recordingStartTimeRef.current = Date.now();
          pausedDurationRef.current = 0;
        } else if (pauseStartRef.current) {
          pausedDurationRef.current += (Date.now() - pauseStartRef.current);
          pauseStartRef.current = null;
        }
        // Auditoría de fluidez (E): el intervalo corre a 500 ms pero solo
        // publica cuando el segundo mostrado cambia (efectivo: 1 Hz).
        let lastPublishedElapsed = -1;
        const tick = () => {
          if (!recordingStartTimeRef.current) return;
          const elapsed = Math.max(0, Math.floor((Date.now() - recordingStartTimeRef.current - pausedDurationRef.current) / 1000));
          if (elapsed !== lastPublishedElapsed) {
            lastPublishedElapsed = elapsed;
            setRecordingTime(elapsed);
          }
        };
        tick();
        timer = setInterval(tick, 500);
      } else {
        if (!pauseStartRef.current) pauseStartRef.current = Date.now();
      }
    } else {
      recordingStartTimeRef.current = null;
      pausedDurationRef.current = 0;
      pauseStartRef.current = null;
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording, isRecordingPaused]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Auditoría de fluidez (E) — contador de duración del stream (1 Hz):
  // NO se mueve a un componente hoja a propósito. streamDuration no es solo
  // el texto de cabecera: es la fuente que applyRemoteStudioState sobrescribe
  // en modo espejo (iPad) y que sendStudioState publica vía
  // streamDurationRef. Extraerlo a una hoja con reloj propio partiría esa
  // fuente de verdad en dos (master e iPad mostrarían tiempos distintos) y
  // el espejo dejaría de poder fijar la duración. Se queda en la raíz a
  // 1 Hz exacto (no por encima de 1 Hz): es el coste mínimo seguro.
  useEffect(() => {
    let timer;
    if (isStreaming) {
      timer = setInterval(() => setStreamDuration(prev => prev + 1), 1000);
    } else {
      setStreamDuration(0);
    }
    return () => clearInterval(timer);
  }, [isStreaming]);

  useEffect(() => {
    if (window.api?.onStreamStatus) {
      const unsubscribe = window.api.onStreamStatus((status) => {
        if (status.active) {
          if (Array.isArray(status.destinations)) setActiveLiveDestinations(status.destinations);
        } else {
          isStreamStartingRef.current = false;
          setIsStreamStarting(false);
          isStreamingRef.current = false;
          setIsStreaming(false);
          setActiveLiveDestinations([]);
          streamDestStatusesRef.current = {};
          setStreamDestStatuses({});
        }
      });
      return unsubscribe;
    }
  }, []);

  // Estado por destino del directo (v1.5.0): un destino caído se avisa SIEMPRE.
  useEffect(() => {
    if (window.api?.onStreamDestinationStatus) {
      const unsubscribe = window.api.onStreamDestinationStatus((evt) => {
        if (!evt?.targetId) return;
        const prev = streamDestStatusesRef.current[evt.targetId];
        const next = { ...streamDestStatusesRef.current, [evt.targetId]: evt };
        streamDestStatusesRef.current = next;
        setStreamDestStatuses(next);
        if (evt.status === 'down') {
          showToast(`${evt.targetName || 'Destino'}: la transmisión cayó. Reconectando automáticamente…`, 'warning', 7000);
        } else if (evt.status === 'failed') {
          // D-ui: si el proceso principal adjunta userMessage (kind 'url':
          // URL/clave mal formada), ese texto accionable sustituye al
          // genérico «Server error». El resto de kinds no cambia.
          showToast(evt.userMessage
            ? `${evt.targetName || 'Destino'}: ${evt.userMessage}`
            : `${evt.targetName || 'Destino'}: no se pudo recuperar la transmisión tras 5 intentos.${evt.error ? ' ' + evt.error : ''}`, 'error', 9000);
        } else if (evt.status === 'live' && prev && prev.status !== 'live') {
          showToast(`${evt.targetName || 'Destino'}: transmisión recuperada.`, 'success', 5000);
        }
      });
      return unsubscribe;
    }
  }, []);

  // A4: salud de fotogramas por cámara. Sondeo a 1 Hz que SOLO publica
  // estado cuando el conjunto de cámaras congeladas cambió (comparación
  // contra la ref): sin cambios, cero re-renders.
  useEffect(() => {
    const timer = setInterval(() => {
      let health = null;
      try { health = getCameraFrameHealth(); } catch (e) { health = null; }
      if (!health || typeof health !== 'object') return;
      const next = {};
      Object.entries(health).forEach(([camId, h]) => { if (h?.frozen) next[camId] = true; });
      const prev = frozenCamsRef.current;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const changed = prevKeys.length !== nextKeys.length || nextKeys.some(k => !prev[k]);
      if (changed) {
        frozenCamsRef.current = next;
        setFrozenCams(next);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // B2-ui: progreso honesto del cierre de grabación desde el proceso
  // principal. API opcional del preload: si no existe, la UI conserva el
  // texto genérico de «Finalizando…» sin inventar porcentajes.
  useEffect(() => {
    let unsubscribe = null;
    try {
      unsubscribe = window.api?.onFinalizeProgress?.((payload) => {
        if (!payload) return;
        setFinalizeProgress({
          stage: payload.stage || '',
          percent: payload.percent == null ? null : Number(payload.percent),
        });
      });
    } catch (e) { unsubscribe = null; }
    return () => { try { if (typeof unsubscribe === 'function') unsubscribe(); } catch (e) {} };
  }, []);

  // Sincronización en tiempo real del Master Compositor y Audio Engine
  useEffect(() => {
    if (!isElectronMaster) return;
    // Sincronizar siempre el audio del estudio y los efectos de voz en vivo
    syncStudioAudio(localStream, remoteCams, camStreamsMap, camMuted);
    // v1.6.1: el motor recibe el cintillo REAL del panel ya resuelto — una
    // sola representación, la del canvas (la que se graba y se transmite).
    // tag/text/subtitle salen de useCintilloRotation (presets + perfiles de
    // conductor e invitados); el color sigue la misma resolución que usa el
    // panel (color del cintillo; si no hubiera, acento del estilo elegido).
    // La posición viaja como dato; drawCintillo mantiene su posición fija.
    const engineCintillo = cintillo ? {
      active: Boolean(cintillo.active),
      tag: cintillo.tag || 'TEMA',
      text: cintillo.text || topic,
      subtitle: cintillo.subtitle || '',
      color: cintillo.color || getCintilloStyle(cintilloStyle)?.colors?.primary || '#e8612a',
      presetId: cintillo.presetId || null,
      logoUrl: cintillo.logoUrl || null,
      position: cintilloPosition,
    } : cintillo;
    updateBroadcastState({
      voiceEffect,
      voiceTarget,
      voiceMonitor: voiceMonitorActive,
      localStream,
      camStreamsMap,
      camMuted,
      activeCam,
      pvwCam,
      pipCam,
      camSlots,
      cameraCrops,
      layoutMode,
      chromaKeyActive,
      virtualBg,
      logoBase64,
      logoConfig,
      cameraBadges,
      cameraMeta,
      hostName,
      hostRole,
      guestName,
      guestRole,
      cintillosVisible,
      cintillo: engineCintillo,
      topic,
      // v3.3.2 — TELEPROMPTER EXCLUIDO DE LA MEZCLA POR CONSTRUCCIÓN:
      // el motor de composición (masterBroadcastEngine) DIBUJA el
      // teleprompter en su canvas si el estado trae texto + reproduciendo
      // (su bloque fillText), y ese canvas es la señal que se graba y se
      // transmite en el camino heredado. El teleprompter es ayuda de
      // lectura SOLO en el monitor de los conductores (overlay DOM sobre
      // el programa + caja del panel + vista del Mando iPad, que reciben
      // el estado real por sus propios canales): al motor de composición
      // se le publica SIEMPRE excluido — sin texto y sin reproducción —
      // y su bloque de dibujo nunca se activa. El estado real de la app
      // no cambia; lo que cambia es solo lo que se le entrega a la
      // superficie capturable.
      teleprompterText: '',
      teleprompterSpeed,
      teleprompterFontSize,
      isTeleprompterPlaying: false,
      getCamStream,
      remoteCams,
    });
  }, [activeCam, pvwCam, pipCam, camSlots, cameraCrops, cameraBadges, cameraMeta, hostName, hostRole, guestName, guestRole, layoutMode, chromaKeyActive, virtualBg, logoBase64, logoConfig, cintillosVisible, cintillo, cintilloStyle, cintilloPosition, topic, teleprompterText, teleprompterSpeed, teleprompterFontSize, isTeleprompterPlaying, voiceEffect, voiceTarget, voiceMonitorActive, localStream, remoteCams, camStreamsMap, camMuted, isStreaming, isRecording]);

  useEffect(() => {
    const officialQr = 'https://www.podcastudio.mx/remote-cam?auto=true';
    setQrCodeUrl(officialQr);
    QRCode.toDataURL(officialQr, { width: 250, margin: 2 }).then(img => setQrCodeImage(img)).catch(() => {});

    // Generar código QR para el Control Remoto iPad
    QRCode.toDataURL(remoteControlUrl, { width: 250, margin: 2 }).then(img => setRemoteControlQrImage(img)).catch(() => {});

    // Conectar receptor en la nube de cámaras remotas de celular (Supabase WebRTC) SOLO en Electron Master
    let cloudTransport = null;
    let dispatchChannel = null;
    if (isElectronMaster) {
      try {
        cloudTransport = createStreamTransport('p2p');
        cloudTransportRef.current = cloudTransport;
        const setupSlot = (slotIdx) => {
          const roomCode = `studio_cam_${slotIdx + 1}`;
          cloudTransport.on('streamConnected', slotIdx, (stream, label) => {
            logger.log(`[Cloud WebRTC] Cámara conectada en slot ${slotIdx + 1}:`, label);
            // v3.3.1 (defecto 1): la sala NO manda sobre la ocupación.
            // Si la ranura de la sala está ocupada por OTRA fuente, el
            // celular se coloca en la primera ranura libre y la
            // ocupante NO se desconecta.
            //
            // v3.3.3 (defecto A — el 4º camino): el transporte emite
            // «streamConnected» en CADA actualización de pistas
            // (ontrack de video, luego de audio, renegociaciones…),
            // no una sola vez por conexión. La v3.3.1 decidió la
            // colocación solo contra la foto de ocupación de CADA
            // emisión, claveada por la sala: en una re-emisión, si la
            // ocupante no se veía en los mapas en ese instante, el
            // handler volvía a «colocar» y pisaba la ranura — por eso
            // la remota siguió cayendo en CAM 2 en vivo. Ahora TODA
            // emisión pasa por la guarda única
            // decidirColocacionRemotaCloud: con colocación viva de
            // esta sala manda la REUTILIZACIÓN (solo se actualiza el
            // stream en la ranura ya colocada; jamás se reevalúa la
            // ocupación ni se escribe en otra ranura, y ninguna
            // emisión puede detener los tracks de otra fuente — la
            // antigua rama de CAM 1 que detenía la cámara local salió
            // de este handler: CAM 1 remota se atiende en su ranura
            // como cualquier otra, sin tocar la señal local).
            // Regla de Luis: ranura ocupada = bloqueada; la única vía
            // para cambiarla es la desconexión manual del usuario.
            // v3.3.4: las fuentes de ocupación incluyen el registro de
            // cámaras prestadas al motor (nativeReleasedCamsRef): una
            // ranura liberada está BLOQUEADA para el celular aunque en
            // este instante no tenga stream ni meta que la sostenga —
            // el agujero por el que la v3.3.3 volvió a perder CAM 2 en
            // vivo. Y TODA decisión (colocar / actualizar / rechazar)
            // queda registrada en el instrumento ([ranura]) con la
            // ocupación vista, para que el log diga por qué se decidió.
            const fuentesOcupacion = {
              streams: slotStreamsRef.current,
              cameraMeta: cameraMetaRef.current,
              assignedSlots: assignedSlotsRef.current,
              liberadasAlMotor: nativeReleasedCamsRef.current,
              localStreamActive: Boolean(localStreamRef.current),
              requestingDeviceId: `cloud_${slotIdx}`,
            };
            const decision = decidirColocacionRemotaCloud({
              sala: slotIdx,
              colocaciones: colocacionCloudRef.current,
              explicitSlot: slotIdx,
              slotsCount: camSlotsRef.current?.length || 12,
              streams: fuentesOcupacion.streams,
              cameraMeta: fuentesOcupacion.cameraMeta,
              assignedSlots: fuentesOcupacion.assignedSlots,
              liberadasAlMotor: fuentesOcupacion.liberadasAlMotor,
              localStreamActive: fuentesOcupacion.localStreamActive,
              requestingDeviceId: fuentesOcupacion.requestingDeviceId,
            });
            if (decision.accion === 'rechazar') {
              ventanaDiagSend('ranura', `camino=cloud sala ${slotIdx + 1} pedida=CAM ${slotIdx + 1} ocupacionPedida=[${fuentesDeOcupacion(slotIdx, fuentesOcupacion).join(',') || 'libre'}] decision=rechazar destino=ninguna`);
              logger.warn(`[Cloud WebRTC] Sin ranuras libres para el celular de la sala ${slotIdx + 1}: no se reemplazó ninguna cámara.`);
              setMobileStatus(`Un celular llegó a CAM ${slotIdx + 1}, pero no hay ranuras libres: no se desconectó ninguna cámara.`);
              return;
            }
            if (decision.reemision) {
              // Re-emisión de pistas de una conexión ya colocada:
              // solo se actualiza el stream EN SU ranura. Ninguna
              // otra escritura, ninguna parada de tracks.
              const placedSlot = decision.placedSlot;
              ventanaDiagSend('ranura', `camino=cloud sala ${slotIdx + 1} pedida=CAM ${slotIdx + 1} decision=actualizar (re-emisión, colocación viva) destino=CAM ${placedSlot + 1}`);
              setSlotStreams(prev => ({ ...prev, [placedSlot]: stream }));
              setRemoteCams(prev => [
                ...prev.filter(r => r.id !== `cloud_${placedSlot}`),
                { id: `cloud_${placedSlot}`, stream, name: label || `Celular CAM ${placedSlot + 1}` }
              ]);
              return;
            }
            const decisionDespues = decision; // ancla: de aquí en adelante SOLO se coloca (primera vez)
            const placedSlot = decisionDespues.placedSlot;
            ventanaDiagSend('ranura', `camino=cloud sala ${slotIdx + 1} pedida=CAM ${slotIdx + 1} ocupacionPedida=[${fuentesDeOcupacion(slotIdx, fuentesOcupacion).join(',') || 'libre'}] decision=colocar destino=CAM ${placedSlot + 1}${decisionDespues.reubicada ? ' reubicada=true' : ''}`);
            colocacionCloudRef.current[slotIdx] = placedSlot;
            if (decisionDespues.reubicada) {
              logger.log(`[Cloud WebRTC] CAM ${slotIdx + 1} estaba ocupada: el celular se colocó en CAM ${placedSlot + 1} sin desconectar ninguna cámara.`);
              setMobileStatus(`CAM ${slotIdx + 1} estaba ocupada: el celular se conectó en CAM ${placedSlot + 1} sin desconectar ninguna cámara.`);
            }
            setSlotStreams(prev => ({ ...prev, [placedSlot]: stream }));
            setRemoteCams(prev => [
              ...prev.filter(r => r.id !== `cloud_${placedSlot}`),
              { id: `cloud_${placedSlot}`, stream, name: label || `Celular CAM ${placedSlot + 1}` }
            ]);
            setCameraMeta(prev => ({
              ...prev,
              [placedSlot]: { deviceId: `cloud_${placedSlot}`, label: label || `Celular Remoto (CAM ${placedSlot + 1})`, type: 'remote' }
            }));
            if (!decisionDespues.reubicada) {
              setMobileStatus(`Celular en vivo conectado en CAM ${placedSlot + 1}`);
            }
          });
          cloudTransport.on('streamDisconnected', slotIdx => {
            logger.log(`[Cloud WebRTC] Cámara desconectada en slot ${slotIdx + 1}`);
            delete assignedSlotsRef.current[slotIdx];
            // v3.3.1 (defecto 1): se limpia la ranura donde el stream
            // quedó COLOCADO (puede no ser la de la sala si hubo
            // reubicación al conectar).
            const placedSlot = colocacionCloudRef.current[slotIdx] ?? slotIdx;
            delete colocacionCloudRef.current[slotIdx];
            // v3.3.3 (defecto A): la limpieza SOLO toca la ranura si
            // sigue ocupada por ESTE celular. Si hoy la ocupa otra
            // fuente (deviceId distinto), la desconexión de esta sala
            // no puede limpiar la ranura ajena: la guarda de
            // ocupación también protege contra escrituras de salida.
            const metaColocada = cameraMetaRef.current?.[placedSlot];
            if (metaColocada && metaColocada.deviceId !== `cloud_${placedSlot}` && slotStreamsRef.current?.[placedSlot]) {
              logger.log(`[Cloud WebRTC] CAM ${placedSlot + 1} ya la ocupa otra fuente: la desconexión de la sala ${slotIdx + 1} no la toca.`);
              setRemoteCams(prev => prev.filter(r => r.id !== `cloud_${placedSlot}`));
              return;
            }
            if (placedSlot === 0) {
              setLocalStream(null);
            }
            setSlotStreams(prev => {
              const next = { ...prev };
              delete next[placedSlot];
              return next;
            });
            setRemoteCams(prev => prev.filter(r => r.id !== `cloud_${placedSlot}`));
            setCameraMeta(prev => {
              const next = { ...prev };
              delete next[placedSlot];
              return next;
            });
            if (activeCamRef.current === placedSlot + 1) {
              setActiveCam(1);
              updateBroadcastState({ activeCam: 1 });
            }
            if (pvwCam === placedSlot + 1) setPvwCam(null);
            if (pipCam === placedSlot + 1) setPipCam(null);
            setMobileStatus('');
          });
          cloudTransport.connectSlot(slotIdx, roomCode);
        };

        // Conectar inicialmente las ranuras activas (CAM 1 a 4) de forma inmediata
        const initialSlots = camSlotsRef.current?.length ? camSlotsRef.current.map(c => c - 1) : [0, 1, 2, 3];
        initialSlots.forEach(slotIdx => setupSlot(slotIdx));

        // Conectar ranuras superiores en segundo plano diferido sin saturar el arranque
        const deferredTimer = setTimeout(() => {
          Array.from({ length: 12 }, (_, i) => i)
            .filter(slotIdx => !initialSlots.includes(slotIdx))
            .forEach(slotIdx => setupSlot(slotIdx));
        }, 3000);
      } catch (e) {
        logger.warn('Transporte cloud:', e);
      }

      // Auto-asignación dinámica de cámaras en la nube (Supabase)
      if (supabase) {
        try {
          dispatchChannel = supabase.channel('remotecam_auto_dispatch', {
            config: { broadcast: { self: false } }
          });

          dispatchChannel.on('broadcast', { event: 'request-slot' }, (ev) => {
            const { deviceId, guestName } = ev?.payload || {};
            if (!deviceId) return;

            // v3.3.4: el auto-despacho decide con las MISMAS fuentes
            // que el resto de caminos — incluidas las cámaras
            // prestadas al motor (ranura liberada = bloqueada) — y la
            // decisión queda en el instrumento ([ranura]).
            const fuentesDespacho = {
              streams: slotStreamsRef.current,
              cameraMeta: cameraMetaRef.current,
              assignedSlots: assignedSlotsRef.current,
              liberadasAlMotor: nativeReleasedCamsRef.current,
              localStreamActive: Boolean(localStreamRef.current),
              requestingDeviceId: deviceId,
            };
            const targetSlot = findAvailableRemoteCameraSlot({
              slotsCount: camSlotsRef.current.length,
              streams: fuentesDespacho.streams,
              cameraMeta: fuentesDespacho.cameraMeta,
              assignedSlots: fuentesDespacho.assignedSlots,
              liberadasAlMotor: fuentesDespacho.liberadasAlMotor,
              localStreamActive: fuentesDespacho.localStreamActive,
              requestingDeviceId: deviceId,
            });

            if (targetSlot === null) {
              ventanaDiagSend('ranura', `camino=auto-despacho dispositivo=${deviceId} pedida=primera-libre decision=rechazar destino=ninguna`);
              dispatchChannel.send({
                type: 'broadcast',
                event: 'slot-full',
                payload: { targetDeviceId: deviceId },
              }).catch(() => {});
              return;
            }
            ventanaDiagSend('ranura', `camino=auto-despacho dispositivo=${deviceId} pedida=primera-libre ocupacionDestino=[${fuentesDeOcupacion(targetSlot, fuentesDespacho).join(',') || 'libre'}] decision=asignar destino=CAM ${targetSlot + 1}`);

            assignedSlotsRef.current[targetSlot] = deviceId;
            const assignedCam = targetSlot + 1;
            const assignedRoom = `studio_cam_${assignedCam}`;
            logger.log(`[Auto-Dispatch Master] Asignando CAM ${assignedCam} (${assignedRoom}) a ${deviceId}`);

            dispatchChannel.send({
              type: 'broadcast',
              event: 'assign-slot',
              payload: {
                targetDeviceId: deviceId,
                slot: assignedCam,
                room: assignedRoom,
              }
            }).catch(() => {});
          });

          dispatchChannel.on('broadcast', { event: 'release-slot' }, (ev) => {
            const { deviceId, slot } = ev?.payload || {};
            if (slot != null) {
              const s = parseInt(slot, 10) - 1;
              if (assignedSlotsRef.current[s] === deviceId) {
                delete assignedSlotsRef.current[s];
              }
            }
          });

          dispatchChannel.subscribe();
        } catch (err) {
          logger.warn('Error configurando auto-dispatch:', err);
        }
      }
    }

    if (window.api) {
      window.api.onMobileWsConnected((id) => setMobileStatus(`Celular conectado (${id}).`));
      
      window.api.onRemoteOffer(async ({ id, offer, slot, name, role }) => {
        logger.log(`[WebRTC] Oferta recibida de celular: ${id}`);
        
        // Cerrar conexión anterior si existía para este ID
        if (peerConnections.current[id]) {
          try { peerConnections.current[id].close(); } catch (e) {}
        }

        const pc = new RTCPeerConnection(getWebRtcConfig());
        peerConnections.current[id] = pc;

        // Stream ESTABLE que persiste toda la conexión — NUNCA crear uno nuevo por evento
        const stableStream = new MediaStream();
        stableStream.mobileId = id;
        let slotAssigned = false;

        const assignSlotOnce = () => {
          if (slotAssigned) return;
          const liveTracks = stableStream.getVideoTracks().filter(t => t.readyState !== 'ended' && !t.muted);
          if (liveTracks.length === 0) return;
          slotAssigned = true;

          logger.log(`[WebRTC] Video en vivo recibido de celular ${id} (tracks: ${stableStream.getTracks().length})`);

          let targetSlot = null;
          // v3.3.4: las fuentes de ocupación de este camino incluyen
          // las cámaras prestadas al motor (ranura liberada =
          // bloqueada), igual que en los demás caminos, y la decisión
          // queda registrada en el instrumento ([ranura]).
          const fuentesOferta = {
            streams: slotStreamsRef.current,
            cameraMeta: cameraMetaRef.current,
            assignedSlots: assignedSlotsRef.current,
            liberadasAlMotor: nativeReleasedCamsRef.current,
            localStreamActive: Boolean(localStreamRef.current),
            requestingDeviceId: id,
          };
          const parsedOferta = slot != null ? parseInt(slot, 10) - 1 : NaN;
          const explicitOferta = (!isNaN(parsedOferta) && parsedOferta >= 0 && parsedOferta < 12) ? parsedOferta : null;
          // Primero, la reconexión del MISMO celular: si su stream ya
          // vive en una ranura, esa sigue siendo la suya.
          for (let s = 1; s < 12; s++) {
            if (slotStreamsRef.current[s] && slotStreamsRef.current[s].mobileId === id) {
              targetSlot = s;
              break;
            }
          }
          const reutilizaOferta = targetSlot !== null;
          if (targetSlot === null) {
            // v3.3.1 (defecto 1): la ranura que trae la oferta es una
            // PETICIÓN, no una orden: manda solo si está libre; si
            // está ocupada, la remota va a la primera ranura libre y
            // la ocupante NO se desconecta (la v3.3.0 la honraba sin
            // mirar y pisaba la cámara que estuviera ahí).
            const explicitSlot = explicitOferta;
            targetSlot = resolveRemoteCameraSlot({
              explicitSlot,
              slotsCount: camSlotsRef.current.length,
              streams: fuentesOferta.streams,
              cameraMeta: fuentesOferta.cameraMeta,
              assignedSlots: fuentesOferta.assignedSlots,
              liberadasAlMotor: fuentesOferta.liberadasAlMotor,
              localStreamActive: fuentesOferta.localStreamActive,
              requestingDeviceId: id,
            });
            if (explicitSlot !== null && targetSlot !== null && targetSlot !== explicitSlot) {
              logger.log(`[WebRTC] CAM ${explicitSlot + 1} estaba ocupada: el celular ${id} se asignó a CAM ${targetSlot + 1} sin desconectar ninguna cámara.`);
              setMobileStatus(`CAM ${explicitSlot + 1} estaba ocupada: el celular se conectó en CAM ${targetSlot + 1}.`);
            }
          }
          if (targetSlot === null) {
            ventanaDiagSend('ranura', `camino=oferta-webrtc dispositivo=${id} pedida=${explicitOferta !== null ? `CAM ${explicitOferta + 1}` : 'primera-libre'}${explicitOferta !== null ? ` ocupacionPedida=[${fuentesDeOcupacion(explicitOferta, fuentesOferta).join(',') || 'libre'}]` : ''} decision=rechazar destino=ninguna`);
            logger.warn('[RemoteCam] No hay ranuras disponibles para esta cámara móvil.');
            return;
          }
          ventanaDiagSend('ranura', `camino=oferta-webrtc dispositivo=${id} pedida=${explicitOferta !== null ? `CAM ${explicitOferta + 1}` : 'primera-libre'}${explicitOferta !== null ? ` ocupacionPedida=[${fuentesDeOcupacion(explicitOferta, fuentesOferta).join(',') || 'libre'}]` : ''} decision=${reutilizaOferta ? 'reutilizar (mismo celular)' : (explicitOferta !== null && targetSlot !== explicitOferta ? 'reubicar' : 'colocar')} destino=CAM ${targetSlot + 1}`);

          // v3.3.3 (defecto B): la lente REALMENTE servida por el
          // celular se lee del track recibido (su label refleja el
          // dispositivo de captura en el estudio; la página además la
          // publica en su presencia como lensLabel) y queda VISIBLE
          // en la etiqueta de la cámara: si es una lente no estándar
          // (ultra gran angular / tele — el ojo de pez), se declara
          // con «lente no estándar» en vez de esconderlo.
          const trackVideoVivo = stableStream.getVideoTracks().find(t => t.readyState !== 'ended');
          const lensLabel = trackVideoVivo?.label || '';
          const nombreCamara = name ? (role === 'student' ? `Alumno: ${name}` : name) : `Celular Wi-Fi (CAM ${targetSlot + 1})`;
          const etiquetaCamara = lensLabel
            ? (esEtiquetaLenteNoEstandar(lensLabel)
              ? `${nombreCamara} · ⚠ lente no estándar: ${lensLabel}`
              : `${nombreCamara} · ${lensLabel}`)
            : nombreCamara;
          if (lensLabel && esEtiquetaLenteNoEstandar(lensLabel)) {
            logger.warn(`[WebRTC] El celular ${id} entró con una lente NO estándar («${lensLabel}»): la imagen puede verse con ojo de pez.`);
          }

          setRemoteCams(prev => {
            const filtered = prev.filter(s => s.id !== id);
            return [...filtered, { id, stream: stableStream, name: etiquetaCamara, lensLabel: lensLabel || undefined }];
          });

          setSlotStreams(prevStreams => ({ ...prevStreams, [targetSlot]: stableStream }));
          setCameraMeta(prevMeta => ({
            ...prevMeta,
            [targetSlot]: {
              deviceId: id,
              label: etiquetaCamara,
              type: 'mobile',
              lensLabel: lensLabel || undefined
            }
          }));
        };

        const trackListeners = new Map();
        const handleTrack = (track) => {
          if (!track) return;
          try {
            if (track.kind === 'video') track.contentHint = 'motion';
            if (track.kind === 'audio') {
              track.contentHint = 'speech';
              track.enabled = true;
            }
          } catch {}
          if (!stableStream.getTracks().some(t => t.id === track.id)) {
            stableStream.addTrack(track);
          }
          if (trackListeners.has(track.id)) return;
          const onUnmute = () => assignSlotOnce();
          const onEnded = () => {
            try { stableStream.removeTrack(track); } catch {}
            if (trackListeners.has(track.id)) {
              const l = trackListeners.get(track.id);
              try { track.removeEventListener('unmute', l.onUnmute); track.removeEventListener('ended', l.onEnded); } catch {}
              trackListeners.delete(track.id);
            }
          };
          trackListeners.set(track.id, { track, onUnmute, onEnded });
          track.addEventListener('unmute', onUnmute);
          track.addEventListener('ended', onEnded);
          assignSlotOnce();
        };

        pc.ontrack = (event) => {
          if (event.receiver) {
            try {
              if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0.05;
              if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 50;
            } catch (e) {}
          }
          if (event.track) {
            handleTrack(event.track);
          }
          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach(handleTrack);
          }
          assignSlotOnce();
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && window.api?.sendCandidate) {
            window.api.sendCandidate(id, e.candidate);
          }
        };

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          logger.log(`[WebRTC ${id}] Estado ICE:`, state);
          if (state === 'closed' || state === 'failed' || state === 'disconnected') {
            trackListeners.forEach(({ track, onUnmute, onEnded }) => {
              try { track.removeEventListener('unmute', onUnmute); track.removeEventListener('ended', onEnded); } catch {}
            });
            trackListeners.clear();
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));

          // Vaciar candidatos pendientes que hayan llegado antes de setRemoteDescription
          const pending = candidateBuffers.current[id] || [];
          for (const cand of pending) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (err) {}
          }
          candidateBuffers.current[id] = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          window.api.sendAnswer(id, answer);
          logger.log(`[WebRTC] Answer enviado a celular: ${id}`);
        } catch (err) {
          logger.error(`[WebRTC] Error negociando conexión con ${id}:`, err);
        }
      });

      window.api.onRemoteCandidate(async ({ id, candidate }) => {
        const pc = peerConnections.current[id];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {}
        } else {
          // Almacenar en búfer si la descripción remota aún no está lista
          if (!candidateBuffers.current[id]) {
            candidateBuffers.current[id] = [];
          }
          candidateBuffers.current[id].push(candidate);
        }
      });

      window.api.onRemoteDisconnected((id) => {
        logger.log(`[WebRTC] Celular desconectado: ${id}`);
        setRemoteCams(prev => prev.filter(s => s.id !== id));
        if (peerConnections.current[id]) {
          try { peerConnections.current[id].close(); } catch (e) {}
          delete peerConnections.current[id];
        }
        delete candidateBuffers.current[id];

        // Liberar el slot de cámara correspondiente y dejarlo en 'Sin señal'
        setCameraMeta(prevMeta => {
          const nextMeta = { ...prevMeta };
          let targetSlot = null;
          for (const [slot, meta] of Object.entries(nextMeta)) {
            if (meta && meta.deviceId === id) {
              targetSlot = slot;
              delete nextMeta[slot];
              break;
            }
          }
          if (targetSlot !== null) {
            setSlotStreams(prevStreams => {
              const nextStreams = { ...prevStreams };
              delete nextStreams[targetSlot];
              return nextStreams;
            });
          }
          return nextMeta;
        });
      });
    }

    let unsubRecErr = null;
    if (window.api?.onRecordingProcessError) {
      unsubRecErr = window.api.onRecordingProcessError((data) => {
        logger.error('[Recording Error IPC]:', data);
        if (isRecordingRef.current) {
          isRecordingRef.current = false;
          setIsRecording(false);
          setIsRecordingPaused(false);
          isRecordingPausedRef.current = false;
          if (!isStreamingRef.current) stopBroadcastEngine();
          showToast('Grabación finalizada: ' + (data?.error || 'El proceso se detuvo'), 'error', 6000);
        }
      });
    }

    return () => {
      if (cloudTransport) { try { cloudTransport.destroy(); } catch {} }
      cloudTransportRef.current = null;
      if (dispatchChannel && supabase) { try { supabase.removeChannel(dispatchChannel); } catch {} }
      if (unsubRecErr) unsubRecErr();
    };
  }, []);

  const hasSentHeaderRef = useRef(false);
  const usbConnectInFlightRef = useRef(new Set());

  // ── Flujo de programa del núcleo v2.0.0 ─────────────────────────────
  // UNA codificación por activación del motor:
  //  - 'webcodecs': la bomba WebCodecs (programEncoder.js) codifica el
  //    canvas en H.264 por hardware si la plataforma lo ofrece; el motor
  //    NO crea su MediaRecorder (chunkSource 'external') y el audio
  //    mezclado viaja en un MediaRecorder SOLO de audio (Opus).
  //  - 'webm': el MediaRecorder histórico del motor (VP8) alimenta el
  //    núcleo, que transcodifica UNA vez (h264_mf primero) y reparte.
  //  - Sin Electron ('web'): chunks en memoria para descarga, como antes.
  const programFlowRef = useRef({ mode: null, pump: null, audioRecorder: null });

  const decideProgramFlowMode = async () => {
    if (!window.api) return 'web';
    if (programFlowRef.current.mode) return programFlowRef.current.mode;
    try {
      const support = await probeProgramEncoderSupport(programProfileId);
      return support.supported ? 'webcodecs' : 'webm';
    } catch {
      return 'webm';
    }
  };

  // v3.0.1: el modo EFECTIVO del flujo (tras el posible volteo a WebM)
  // se anuncia al proceso principal para que quede en streaming.log.
  // Hasta la v3.0.0 el modo solo vivía en la consola del renderer y un
  // flujo que no entregaba bytes era indiagnosticable desde el registro.
  const notifyProgramFlowMode = (mode) => {
    try { window.api?.setProgramFlowMode?.(mode || 'desconocido'); } catch {}
  };

  // Arranca la bomba WebCodecs + el grabador solo-audio sobre el
  // masterStream ya creado por el motor en modo 'external'.
  const startWebcodecsFlow = async (masterStream) => {
    const pump = createProgramEncoderPump({
      profile: programProfile,
      onChunk: (buf) => { try { window.api?.sendProgramVideoChunk?.(buf); } catch {} },
      onError: (err) => {
        logger.error('[Núcleo v2] La bomba WebCodecs falló en vivo; volteando a WebM:', err);
        handleProgramEncoderFailure();
      },
    });
    const started = await pump.start();
    if (!started) return false;
    programFlowRef.current.pump = pump;
    setProgramFrameTap((canvas) => pump.captureFrame(canvas));
    try {
      const audioTrack = masterStream?.getAudioTracks?.()[0];
      if (audioTrack) {
        const audioOnly = new MediaStream([audioTrack]);
        const mime = ['audio/webm;codecs=opus', 'audio/webm'].find(m => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } });
        const rec = new MediaRecorder(audioOnly, mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : { audioBitsPerSecond: 192000 });
        rec.ondataavailable = (e) => {
          if (!e.data || e.data.size === 0) return;
          e.data.arrayBuffer().then(buf => { try { window.api?.sendProgramAudioChunk?.(buf); } catch {} }).catch(() => {});
        };
        rec.start(250);
        programFlowRef.current.audioRecorder = rec;
      }
    } catch (e) {
      logger.warn('[Núcleo v2] No se pudo iniciar el audio del flujo WebCodecs:', e);
    }
    programFlowRef.current.mode = 'webcodecs';
    logger.log('[Núcleo v2] Flujo de programa: WebCodecs H.264 (una sola codificación).');
    return true;
  };

  const stopProgramFlow = () => {
    try { setProgramFrameTap(null); } catch {}
    try { programFlowRef.current.pump?.stop(); } catch {}
    try {
      const rec = programFlowRef.current.audioRecorder;
      if (rec && rec.state !== 'inactive') rec.stop();
    } catch {}
    programFlowRef.current = { mode: null, pump: null, audioRecorder: null };
  };

  // Arranque del flujo de programa desde el estado vigente (mismo
  // camino que usa handleStream/handleRecord ~línea del flujo): decide
  // el modo, arranca el compositor y, en WebCodecs, la bomba con el
  // perfil activo. Lo usan el reinicio por cambio de perfil y la
  // autoprueba pedida por el proceso principal.
  const startProgramFlowFromCurrentState = async () => {
    const flowMode = await decideProgramFlowMode();
    const masterStream = startBroadcastEngine({
      activeCam,
      pvwCam,
      pipCam,
      camSlots,
      cameraCrops,
      cameraBadges,
      layoutMode,
      chromaKeyActive,
      virtualBg,
      logoBase64,
      logoConfig,
      cintillosVisible,
      cintillo,
      topic,
      voiceEffect,
      voiceTarget,
      getCamStream,
      localStream,
      remoteCams,
      camStreamsMap,
      camMuted,
    }, handleMasterChunk, { chunkSource: flowMode === 'webcodecs' ? 'external' : 'mediarecorder' });
    if (flowMode === 'webcodecs' && masterStream && !programFlowRef.current.pump) {
      const flowOk = await startWebcodecsFlow(masterStream);
      if (!flowOk) {
        switchEngineToWebmChunks();
        programFlowRef.current.mode = 'webm';
      }
    } else if (flowMode === 'webm') {
      programFlowRef.current.mode = 'webm';
    }
    notifyProgramFlowMode(programFlowRef.current.mode || flowMode);
    return masterStream;
  };
  programFlowStarterRef.current = startProgramFlowFromCurrentState;
  programFlowStopperRef.current = stopProgramFlow;

  // WebCodecs murió a mitad de sesión: se apaga la bomba y el motor crea
  // su MediaRecorder WebM sobre el mismo masterStream (sin reiniciar la
  // composición); el núcleo detecta el cambio de contenedor y reinicia
  // su grafo en modo WebM. La sesión (directo/grabación) continúa.
  const handleProgramEncoderFailure = () => {
    if (programFlowRef.current.mode !== 'webcodecs') return;
    stopProgramFlow();
    if (!isStreamingRef.current && !isRecordingRef.current) return;
    const ok = switchEngineToWebmChunks();
    programFlowRef.current.mode = ok ? 'webm' : null;
    if (ok) logger.log('[Núcleo v2] Flujo de programa: WebM de respaldo (una transcodificación en el núcleo).');
  };

  const handleMasterChunk = (buffer) => {
    // v3.0.1 — LA COMPUERTA QUE MATÓ EL FLUJO EN VIVO: hasta la v3.0.0
    // esto solo reenviaba fragmentos si había streaming activo. Fuera de
    // streaming (la autoprueba, y GRABAR SIN transmitir) la ventana
    // descartaba TODOS los fragmentos WebM: el núcleo recibía 0 bytes
    // (veredicto de autoprueba «sin flujo del renderer» en los tres
    // arranques del 2026-11-12) y la grabación de la v2.0.0 murió con la
    // FLV sin flujos por la misma causa. La regla correcta: los
    // fragmentos van al núcleo siempre que exista UN consumidor real
    // (streaming, grabación o autoprueba); en previsualización pura la
    // compuerta sigue cerrada y el núcleo no transcodifica en vacío.
    if ((isStreamingRef.current || isStreamStartingRef.current || isRecordingRef.current || selfTestFlowRef.current) && window.api?.sendStreamChunk) {
      window.api.sendStreamChunk(buffer);
    }
    // v2.0.0: con Electron la grabación ya NO recibe chunks por aquí: es
    // un consumidor del núcleo en el proceso principal. Solo el modo web
    // (sin Electron) sigue acumulando el WebM en memoria para descargar,
    // y su pausa descarta fragmentos (semántica histórica del respaldo).
    if (isRecordingRef.current && !window.api) {
      if (!isRecordingPausedRef.current) {
        recordingChunksRef.current.push(buffer);
        recordingChunkCountRef.current += 1;
      }
      return;
    }
  };

  const handleRecord = async () => {
    if (recordingStopPendingRef.current || isCancelingRecordingRef.current) return;
    if (recordingStartPendingRef.current && !isRecordingRef.current) {
      if (Date.now() - recordingStartPendingTimeRef.current < 4000) {
        return;
      }
      logger.warn('[handleRecord] Timeout de inicio previo detectado, desbloqueando botón...');
      recordingStartPendingRef.current = false;
      setIsStartingRecording(false);
    }
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_RECORD');
      return;
    }
    // HITO 3 (v3.2.0): con GStreamer disponible, el botón gobierna el
    // MOTOR NATIVO (la cadena anterior queda de respaldo). Con la
    // grabación ISO activa manda la cadena anterior, que es la que sabe
    // grabar por cámara (declarado en el LEEME del hito).
    if (window.electronAPI?.nativeEngine && !isoRecordingEnabled) {
      if (isRecordingRef.current && nativeFlagsRef.current.forRecord) {
        await detenerGrabacionNativa();
        return;
      }
      if (!isRecordingRef.current && nativeGstAvailable) {
        await iniciarGrabacionNativa();
        return;
      }
      if (!isRecordingRef.current && nativeGstUnavailable) {
        showToast('Motor nativo no disponible: se usa la cadena anterior.', 'warning', 6000);
      }
    }
    if (!isRecordingRef.current) {
      try {
        setIsStartingRecording(true);
        recordingStartPendingRef.current = true;
        recordingStartPendingTimeRef.current = Date.now();
        recordingChunksRef.current = [];
        recordingChunkCountRef.current = 0;
        if (!window.api) {
          // Modo web: si el motor ya estaba activo, su cabecera WebM es el
          // primer fragmento del arreglo de descarga.
          try { const h = getActiveInitHeader(); if (h) recordingChunksRef.current.push(h); } catch {}
        }
        setRecordingTime(0);
        setIsRecordingPaused(false);
        isRecordingPausedRef.current = false;
        setCountdown(null);

        // 2. Activar timer y estado de grabación inmediatamente
        isRecordingRef.current = true;
        setIsRecording(true);
        setIsStartingRecording(false);
        recordingStartTimeRef.current = Date.now();
        pausedDurationRef.current = 0;
        pauseStartRef.current = null;

        // 3. Iniciar el compositor Master con el flujo del núcleo v2.0.0:
        // WebCodecs (sin MediaRecorder de vídeo en el motor) si la
        // plataforma lo soporta; WebM histórico si no. El estado REC ya
        // está visible y el contador en marcha.
        const flowMode = await decideProgramFlowMode();
        const masterStream = startBroadcastEngine({
          activeCam,
          pvwCam,
          pipCam,
          camSlots,
          cameraCrops,
          cameraBadges,
          layoutMode,
          chromaKeyActive,
          virtualBg,
          logoBase64,
          logoConfig,
          cintillosVisible,
          cintillo,
          topic,
          voiceEffect,
          voiceTarget,
          getCamStream,
          localStream,
          remoteCams,
          camStreamsMap,
          camMuted,
        }, handleMasterChunk, { chunkSource: flowMode === 'webcodecs' ? 'external' : 'mediarecorder' });

        if (!masterStream || masterStream.getVideoTracks().length === 0) {
          throw new Error('El compositor Master no generó video grabable. Verifica una cámara activa y los permisos de medios.');
        }
        if (flowMode === 'webcodecs' && !programFlowRef.current.pump) {
          const flowOk = await startWebcodecsFlow(masterStream);
          if (!flowOk) {
            // La bomba no arrancó: el motor crea su MediaRecorder WebM y
            // el núcleo transcodifica una sola vez (respaldo declarado).
            switchEngineToWebmChunks();
            programFlowRef.current.mode = 'webm';
          }
        } else if (flowMode === 'webm') {
          programFlowRef.current.mode = 'webm';
        }
        notifyProgramFlowMode(programFlowRef.current.mode || flowMode);

        // Compuerta de primer fotograma (v1.5.0, Frente B): no se graba hasta
        // que el programa presente un fotograma REAL de cámara (fotograma
        // presentado + muestra de píxeles no uniforme). Si en 3 s no hay
        // señal, error honesto en vez de un archivo en negro.
        {
          const sampleHasRealFrame = () => {
            try {
              if (!hasMasterCanvasPresentedFrames()) return false;
              const snap = captureMasterCanvasSnapshot();
              if (!snap) return false;
              const small = document.createElement('canvas');
              small.width = 160; small.height = 90;
              const sctx = small.getContext('2d');
              if (!sctx) return false;
              sctx.drawImage(snap, 0, 0, 160, 90);
              const data = sctx.getImageData(0, 0, 160, 90).data;
              let min = 255, max = 0;
              for (let i = 0; i < data.length; i += 16) {
                const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (lum < min) min = lum;
                if (lum > max) max = lum;
                if (max - min > 16) return true;
              }
              return max - min > 16;
            } catch { return false; }
          };
          const gateStart = Date.now();
          let gateOk = sampleHasRealFrame();
          while (!gateOk && Date.now() - gateStart < 3000) {
            await new Promise((r) => setTimeout(r, 150));
            gateOk = sampleHasRealFrame();
          }
          if (!gateOk) {
            throw new Error('Sin señal de cámara: el programa no presentó ningún fotograma real en 3 segundos. No se grabó nada para no generar un archivo en negro.');
          }
        }

        // v2.0.0: la grabación se engancha como consumidor del núcleo
        // (copia del flujo ya codificado). Ya no hay grabador dedicado ni
        // chunks propios: si el enganche falla, el catch general limpia.
        if (window.api) {
          const recRes = await window.api.startRecording({ projectName: topic || 'Proyecto_General' })
            .catch((error) => ({ success: false, error: error.message }));
          if (!recRes?.success) {
            throw new Error('El núcleo no pudo iniciar la grabación: ' + (recRes?.error || 'error desconocido'));
          }
        }

          // Iniciar Grabación ISO Multicanal si está habilitada (P4.1)
          if (isoRecordingEnabled && window.api?.startIsoRecording) {
            const activeSlots = [];
            Object.entries(camStreamsMap).forEach(([slotStr, stream]) => {
              const sNum = Number(slotStr);
              const vTracks = stream?.getVideoTracks?.() || [];
              if (vTracks.length > 0 && vTracks[0].readyState === 'live') {
                activeSlots.push(sNum);
              }
            });

            if (activeSlots.length > 0) {
              window.api.startIsoRecording({
                slots: activeSlots,
                projectName: topic || 'Proyecto_General',
              }).then(isoRes => {
                if (isoRes?.success) {
                  activeSlots.forEach(sNum => {
                    const stream = camStreamsMap[sNum];
                    if (!stream) return;
                    try {
                      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                        ? 'video/webm;codecs=vp8,opus'
                        : 'video/webm';
                      const rec = new MediaRecorder(stream, { mimeType });
                      isoChunkQueuesRef.current.set(sNum, Promise.resolve());
                      rec.ondataavailable = (e) => {
                        if (!e.data || e.data.size === 0 || !window.api?.sendIsoChunk) return;
                        const pending = isoChunkQueuesRef.current.get(sNum) || Promise.resolve();
                        isoChunkQueuesRef.current.set(sNum, pending
                          .then(() => e.data.arrayBuffer())
                          .then(chunk => window.api.sendIsoChunk({ slot: sNum, chunk }))
                          .catch(err => logger.warn(`[ISO] Error enviando CAM ${sNum}:`, err)));
                      };
                      rec.start(1000);
                      isoRecordersRef.current.set(sNum, rec);
                    } catch (err) {
                      logger.warn(`[ISO] Error iniciando recorder para CAM ${sNum}:`, err);
                    }
                  });
                }
              }).catch(e => logger.warn('[ISO] Fallo al iniciar ISO:', e));
            }
          }
      } catch (err) {
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsStartingRecording(false);
        recordingStartTimeRef.current = null;
        if (!isStreamingRef.current) { stopBroadcastEngine(); stopProgramFlow(); }
        try { await window.api?.cancelRecording?.(); } catch (cancelError) {}
        logger.error('[handleRecord] Error general al iniciar grabación:', err);
        showToast('Error al iniciar grabación: ' + (err?.message || 'Desconocido'), 'error', 6000);
      } finally {
        recordingStartPendingRef.current = false;
        setIsStartingRecording(false);
      }
    } else {
      if (recordingStopPendingRef.current) return;
      recordingStopPendingRef.current = true;
      setIsStoppingRecordingUI(true);
      setFinalizeProgress(null);
      try {
        // Captura del fotograma para la miniatura: SOLO la copia del
        // canvas (un drawImage). La codificación JPEG ya NO ocurre aquí:
        // era síncrona a 1920×1080 en el camino del clic de Detener
        // (v1.7.0, Raíz A); se genera asíncrona y reducida tras finalizar
        // el MP4 (canvasToJpegDataUrl, más abajo).
        const snapshotCanvas = captureMasterCanvasSnapshot();
        let thumbnailDataUrl = null;

        // Detener y finalizar grabadores ISO multicanal (P4.1)
        const stopIsoPromises = Array.from(isoRecordersRef.current.entries()).map(([sNum, rec]) => new Promise((resolve) => {
          if (!rec || rec.state === 'inactive') return resolve();
          rec.addEventListener('stop', resolve, { once: true });
          try { rec.stop(); } catch (e) { resolve(); }
        }));
        isoRecordersRef.current.clear();
        if (window.api?.stopIsoRecording) {
          try {
            await Promise.all(stopIsoPromises);
            await Promise.all(isoChunkQueuesRef.current.values());
            isoChunkQueuesRef.current.clear();
            await window.api.stopIsoRecording();
          } catch (e) {
            logger.warn('[ISO] Error al detener grabación ISO:', e);
          }
        } else {
          await Promise.all(stopIsoPromises);
        }

        let stopRes = null;
        // v2.0.0: la grabación vive en el núcleo (proceso principal); no
        // hay grabador en el renderer que vaciar ni entregas que esperar:
        // stopRecording() del núcleo cierra el consumidor y finaliza el
        // MP4 (y reporta él mismo si no recibió datos). Si no hay directo
        // al aire, también se apaga el motor y el flujo.
        if (!isStreamingRef.current) {
          await stopBroadcastEngine();
          stopProgramFlow();
        }
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsRecordingPaused(false);
        isRecordingPausedRef.current = false;

        if (window.api) {
          try {
            const flushRes = await window.api.flushRecordingChunks?.();
            if (flushRes && !flushRes.success) throw new Error(flushRes.error || 'FFmpeg no pudo escribir todos los segmentos.');
            stopRes = await window.api.stopRecording();
            if (!stopRes?.success || !stopRes.path) {
              recordingChunksRef.current = [];
              showToast('No se pudo finalizar el MP4: ' + (stopRes?.error || 'No se generó un archivo válido.') + (stopRes?.partialPath ? `\nSe conservó un parcial para diagnóstico: ${stopRes.partialPath}` : ''), 'error', 6000);
              return;
            }
            if (stopRes.blackWarning) {
              showToast('ADVERTENCIA: la grabación finalizada salió en negro (90% o más de fotogramas negros). Revísala antes de usarla; no es un éxito limpio.', 'warning', 9000);
            }
          } catch (e) {
            logger.warn('Error parando grabación FFmpeg:', e);
            recordingChunksRef.current = [];
            showToast('No se pudo finalizar la grabación: ' + (e.message || 'Error desconocido'), 'error', 6000);
            return;
          }
        }
        // v1.7.0 (Raíz A): la miniatura se codifica AQUÍ — el MP4 ya
        // finalizó — de forma asíncrona y a 640 px (canvasToJpegDataUrl),
        // fuera del camino síncrono del clic de Detener.
        if (!thumbnailDataUrl && snapshotCanvas) {
          thumbnailDataUrl = await canvasToJpegDataUrl(snapshotCanvas, 640);
          if (thumbnailDataUrl && window.api?.saveRecordingThumbnail && stopRes?.path) {
            const thumbRes = await window.api.saveRecordingThumbnail({
              projectName: topic || 'Proyecto_General',
              base64Data: thumbnailDataUrl
            }).catch(e => ({ success: false, error: e.message }));
            if (!thumbRes?.success) logger.warn('[App] Error guardando miniatura:', thumbRes?.error);
          }
        }
        const chunks = recordingChunksRef.current;
        const recBlob = chunks.length > 0 ? new Blob(chunks, { type: 'video/webm' }) : null;
        recordingChunksRef.current = [];
        const recUrl = recBlob ? URL.createObjectURL(recBlob) : null;

        const cleanTopicName = (topic || 'Episodio').replace(/[^\w\d-_]/g, '_');
        setRecordedVideoData({
          blob: recBlob,
          url: recUrl,
          snapshotCanvas,
          thumbnailDataUrl,
          filePath: stopRes?.path || null,
          blackWarning: !!stopRes?.blackWarning,
          recordedDurationSec: stopRes?.durationSec || null,
          projectName: stopRes?.projectName || topic || 'Proyecto_General',
          name: `PodcaStudio_${cleanTopicName}_${Date.now()}`,
          duration: recordingTime || 1,
        });
        setShowExportModal(true);
      } catch (error) {
        logger.error('[handleRecord] Error finalizando grabación:', error);
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsRecordingPaused(false);
        isRecordingPausedRef.current = false;
        recordingChunksRef.current = [];
        if (!stopRes?.success) {
          try { await window.api?.cancelRecording?.(); } catch (cancelError) {}
        }
        showToast('No se pudo finalizar la grabación: ' + (error?.message || 'Error desconocido'), 'error', 6000);
      } finally {
        recordingStopPendingRef.current = false;
        recordingStartPendingRef.current = false;
        setIsStoppingRecordingUI(false);
        setFinalizeProgress(null);
        setIsStartingRecording(false);
      }
    }
  };

  const handlePauseRecording = () => {
    const next = !isRecordingPausedRef.current;
    isRecordingPausedRef.current = next;
    setIsRecordingPaused(next);
    // Pausa (v2.0.0): el núcleo deja de alimentar al consumidor de
    // grabación; el directo sigue intacto. En modo web (sin Electron) la
    // pausa descarta fragmentos en handleMasterChunk (respaldo histórico).
    if (window.api?.setRecordingPaused) {
      window.api.setRecordingPaused(next).catch(() => {});
    }
  };

  const handleCancelRecording = async () => {
    if (!isRecordingRef.current || isCancelingRecordingRef.current || recordingStopPendingRef.current) return;
    isCancelingRecordingRef.current = true;
    recordingStopPendingRef.current = true;
    setIsStoppingRecordingUI(true);
    isRecordingRef.current = false;
    isRecordingPausedRef.current = false;
    setIsRecording(false);
    setIsStartingRecording(false);
    setIsRecordingPaused(false);
    recordingChunksRef.current = [];
    try {
      if (!isStreamingRef.current) { await stopBroadcastEngine(); stopProgramFlow(); }
      const isoStops = Array.from(isoRecordersRef.current.values()).map(rec => new Promise(resolve => {
        if (!rec || rec.state === 'inactive') return resolve();
        rec.addEventListener('stop', resolve, { once: true });
        try { rec.stop(); } catch { resolve(); }
      }));
      isoRecordersRef.current.clear();
      await Promise.all(isoStops);
      await Promise.all(isoChunkQueuesRef.current.values());
      isoChunkQueuesRef.current.clear();
      await window.api?.stopIsoRecording?.();
      const result = await window.api?.cancelRecording?.();
      setRecordedVideoData(null);
      if (result && !result.success) showToast(`No se pudo descartar la grabación: ${result.error || 'error desconocido'}`, 'error');
    } catch (error) {
      showToast(`No se pudo descartar la grabación: ${error.message || 'error desconocido'}`, 'error');
    } finally {
      isCancelingRecordingRef.current = false;
      recordingStopPendingRef.current = false;
      setIsStoppingRecordingUI(false);
      setIsStartingRecording(false);
    }
  };

  const handleCleanNewProject = useCallback(() => {
    setShowExportModal(false);
    setRecordedVideoData(null);
    recordingChunksRef.current = [];
    recordingChunkCountRef.current = 0;
    setRecordingTime(0);
    setIsRecording(false);
    setIsRecordingPaused(false);
    isRecordingRef.current = false;
    isRecordingPausedRef.current = false;
    clearHighlights?.();
    setTopic('');
    showToast('¡Estudio limpio y listo para un nuevo proyecto!', 'success', 5000);
  }, [clearHighlights]);

  const updateStreamConfig = (field, value, destination = activeStreamTab) => { setStreamConfigs(prev => ({ ...prev, [destination]: { ...prev[destination], [field]: value } })); };
  const toggleDestination = (destination = activeStreamTab) => { setStreamConfigs(prev => ({ ...prev, [destination]: { ...prev[destination], enabled: !prev[destination].enabled } })); };

  const handleStream = async () => {
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_STREAM');
      return;
    }
    if (isStreamStartingRef.current) return;
    if (!isStreaming) {
      let activeTargets;
      try {
        activeTargets = buildStreamDestinations(streamConfigs);
      } catch (error) {
        showToast(error.message, 'error', 6000);
        return;
      }

      if (activeTargets.length === 0) {
        showToast('Para emitir en vivo, debes habilitar al menos un destino (Facebook, YouTube, TikTok o RTMP) y escribir su Clave de Transmisión (Stream Key).', 'info', 6000);
        return;
      }

      // HITO 3 (v3.2.0): con GStreamer disponible, la transmisión la
      // hace el MOTOR NATIVO con las URL que YA compuso
      // buildStreamDestinations (servidor+clave una sola vez). Si el
      // motor no está, aviso visible y cadena anterior.
      if (window.api && nativeGstAvailable) {
        await iniciarTransmisionNativa(activeTargets);
        return;
      }
      if (window.api && nativeGstUnavailable) {
        showToast('Motor nativo no disponible: se usa la cadena anterior.', 'warning', 6000);
      }

      // 1. Asegurar que el compositor broadcast esté activo y generando el
      // Master, con el flujo del núcleo v2.0.0 decidido (WebCodecs si la
      // plataforma lo soporta; WebM histórico si no).
      const flowMode = await decideProgramFlowMode();
      const masterStream = startBroadcastEngine({
        activeCam,
        pvwCam,
        pipCam,
        camSlots,
        cameraCrops,
        cameraBadges,
        layoutMode,
        chromaKeyActive,
        virtualBg,
        logoBase64,
        logoConfig,
        cintillosVisible,
        cintillo,
        topic,
        voiceEffect,
        voiceTarget,
        getCamStream,
        localStream,
        remoteCams,
        camStreamsMap,
        camMuted,
      }, handleMasterChunk, { chunkSource: flowMode === 'webcodecs' ? 'external' : 'mediarecorder' });
      if (flowMode === 'webcodecs' && masterStream && !programFlowRef.current.pump) {
        const flowOk = await startWebcodecsFlow(masterStream);
        if (!flowOk) {
          switchEngineToWebmChunks();
          programFlowRef.current.mode = 'webm';
        }
      } else if (flowMode === 'webm') {
        programFlowRef.current.mode = 'webm';
      }
      notifyProgramFlowMode(programFlowRef.current.mode || flowMode);

      if (window.api) {
        isStreamStartingRef.current = true;
        setIsStreamStarting(true);
        let nativeStarted = false;

        // FASE 4: Iniciar emisión directa con codificación por hardware si está habilitado
        if (isNativeEngineEnabled() && window.api.nativeEngine) {
          try {
            const nativeRes = await startNativeEngineBroadcast(activeTargets, getNativeEngineConfig());
            if (nativeRes?.success) {
              nativeStarted = true;
            } else if (!FEATURE_FLAGS.NATIVE_ENGINE_FALLBACK) {
              throw new Error(nativeRes?.error || 'Error iniciando motor nativo');
            }
          } catch (neErr) {
            logger.warn('[handleStream] Fallback automático a pipeline v1.3.2:', neErr);
          }
        }

        try {
          let res = { success: true };
          if (!nativeStarted) {
            res = await window.api.startStreaming({
              destinations: activeTargets,
            });
          }
          if (res.success || nativeStarted) {
            isStreamStartingRef.current = false;
            isStreamingRef.current = true;
            setIsStreamStarting(false);
            setIsStreaming(true);
            setActiveLiveDestinations(res.connectedDestinations || activeTargets);
            setShowStreamModal(false);
            if (res.failures?.length) {
              showToast(`Transmisión parcial. Conectados: ${(res.connectedDestinations || []).map(target => target.name).join(', ')}`, 'warning', 7000);
            }
          } else {
            isStreamStartingRef.current = false;
            isStreamingRef.current = false;
            setIsStreamStarting(false);
            setIsStreaming(false);
            if (!isRecordingRef.current) { await stopBroadcastEngine(); stopProgramFlow(); }
            // D-ui: userMessage del payload (kind 'url') manda sobre el
            // texto genérico y sobre el «Server error» crudo del destino.
            const friendlyStreamError = res.userMessage || (Array.isArray(res.failures) ? res.failures.map(f => f?.userMessage).find(Boolean) : null);
            showToast(friendlyStreamError || ('No se pudo conectar con el servidor de transmisión.\n' + (res.error || 'Verifica que la transmisión esté activa en la plataforma y revisa la clave y la URL.')), 'error', 7000);
          }
        } catch (error) {
          isStreamStartingRef.current = false;
          isStreamingRef.current = false;
          setIsStreamStarting(false);
          setIsStreaming(false);
          if (!isRecordingRef.current) { await stopBroadcastEngine(); stopProgramFlow(); }
          showToast('No se pudo iniciar la conexión RTMP/RTMPS: ' + (error.message || 'Error de red desconocido.'), 'error', 7000);
        }
      } else {
        isStreamingRef.current = true;
        setIsStreaming(true);
        setActiveLiveDestinations(activeTargets);
        setShowStreamModal(false);
      }
    } else {
      // HITO 3: si la transmisión en curso es del motor nativo, la
      // detiene el motor (y la grabación combinada se gobierna ahí).
      if (nativeFlagsRef.current.forStream) {
        await detenerTransmisionNativa();
        return;
      }
      isStreamingRef.current = false;
      if (window.api) {
        await stopNativeEngineBroadcast();
        await window.api.stopStreaming();
      }
      setIsStreaming(false);
      setActiveLiveDestinations([]);
      if (!isRecordingRef.current) { stopBroadcastEngine(); stopProgramFlow(); }
    }
  };

  const handleTeleprompterFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result || '';
        setTeleprompterText(content);
        setIsTeleprompterPlaying(false);
        if (rightPrompterScrollRef.current) rightPrompterScrollRef.current.scrollTop = 0;
        teleprompterYRef.current = 0;
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const arrayBuffer = evt.target.result;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          setTeleprompterText(result.value || '');
          setIsTeleprompterPlaying(false);
          if (rightPrompterScrollRef.current) rightPrompterScrollRef.current.scrollTop = 0;
          teleprompterYRef.current = 0;
        } catch (error) { showToast("Error al leer archivo Word (.docx).", "error"); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = null; 
  };

  const handleWordUpload = handleTeleprompterFileUpload;

  const handlePrompterReset = () => {
    teleprompterYRef.current = 0;
    if (rightPrompterScrollRef.current) {
      rightPrompterScrollRef.current.scrollTop = 0;
    }
    projectTeleprompterOverlay();
  };

  const handleCopyPrompterLink = () => {
    const targetUrl = qrCodeUrl || `http://${window.location.hostname || 'localhost'}:3001/control`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(targetUrl).then(() => {
        setPrompterCopiedLink(true);
        setTimeout(() => setPrompterCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };

  const handleClearTeleprompter = () => {
    setTeleprompterText('');
    setIsTeleprompterPlaying(false);
    if (rightPrompterScrollRef.current) {
      rightPrompterScrollRef.current.scrollTop = 0;
    }
    teleprompterYRef.current = 0;
    projectTeleprompterOverlay();
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) { 
      const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|webm|mov|mkv)$/i));
      const reader = new FileReader(); 
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        setLogoBase64(dataUrl);
        setLogoConfig(prev => {
          const updated = {
            ...prev,
            url: dataUrl,
            mediaType: isVideo ? 'video' : 'image',
          };
          try { localStorage.setItem('podcastudio_logo_config', JSON.stringify(updated)); } catch (_) {}
          return updated;
        });
      };
      reader.readAsDataURL(file); 
    }
  };

  const handleRemoveLogo = () => {
    setLogoBase64(null);
    setLogoConfig(prev => {
      const updated = { ...prev, url: null };
      try { localStorage.setItem('podcastudio_logo_config', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  };

  const handleUpdateLogoSetting = (key, value) => {
    setLogoConfig(prev => {
      const updated = { ...prev, [key]: value };
      try { localStorage.setItem('podcastudio_logo_config', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  };

  // Dispositivos de video USB: consultar solo cuando se abre el modal o cambia el hardware
  useEffect(() => {
    let timer = null;
    const fetchDevices = async () => {
      try {
        const devs = await navigator.mediaDevices?.enumerateDevices?.() || [];
        const cams = devs.filter(d => d.kind === 'videoinput');
        setCameraDevices(cams);
      } catch (e) {}
    };

    if (showConnectModal) {
      fetchDevices();
    }

    const onDeviceChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fetchDevices, 400);
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      if (timer) clearTimeout(timer);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [showConnectModal]);

  // Apertura USB SECUENCIAL: handleUsbConnect encola cada apertura tras la
  // anterior; una cámara se estabiliza antes de abrir la siguiente. Nunca
  // llamarla desde dentro de la propia cola.
  const enqueueUsbOpen = (task) => {
    const run = usbOpenQueueRef.current.then(task, task);
    usbOpenQueueRef.current = run.then(() => {}, () => {});
    return run;
  };

  const handleUsbConnectSequential = async (deviceId, slot, label) => {
    // Si la cámara ya está activa en este slot con el mismo deviceId, mantenerla
    const currentStream = slotStreamsRef.current[slot] || slotStreams[slot] || (slot === 0 ? localStreamRef.current || localStream : null);
    const activeVideoTrack = currentStream?.getVideoTracks()?.[0];
    const activeDevId = activeVideoTrack?.getSettings?.()?.deviceId;

    if (activeVideoTrack && activeVideoTrack.readyState === 'live' && (activeDevId === deviceId || !deviceId)) {
      setSlotStreams(prev => ({ ...prev, [slot]: currentStream }));
      setCameraMeta(prev => ({ ...prev, [slot]: { deviceId, label: label || 'Cámara USB', type: 'usb' } }));
      if (slot === 0) setLocalStream(currentStream);
      return currentStream;
    }

    // A source may not replace a live USB camera implicitly. Stopping UVC
    // tracks from a click handler is exactly what caused driver deadlocks when
    // adding CAM 2 while CAM 1 was still on the air.
    if (activeVideoTrack && activeVideoTrack.readyState === 'live' && activeDevId !== deviceId) {
      throw new Error(`CAM ${slot + 1} ya está en uso. Desconéctala primero o selecciona una ranura libre.`);
    }

    // A physical UVC device must have exactly one owner. Never stop and move a
    // live device from another slot in the middle of a click: the user must
    // explicitly disconnect it first.
    for (const [sKey, meta] of Object.entries(cameraMetaRef.current || {})) {
      const sIdx = Number(sKey);
      if (sIdx !== slot && meta && meta.deviceId === deviceId) {
        const assignedTrack = slotStreamsRef.current[sIdx]?.getVideoTracks?.()[0];
        if (assignedTrack?.readyState === 'live') {
          throw new Error(`Esta cámara ya está conectada en CAM ${sIdx + 1}. Desconéctala antes de moverla.`);
        }
      }
    }

    // Guardia anti-encolamiento: un getUserMedia NO se puede cancelar, y un
    // timeout solo abandona la promesa mientras la petición sigue viva sobre
    // el driver. Si ya hay un intento en curso para esta cámara, otro clic no
    // debe encolar una segunda apertura: es la cadena que congelaba la app
    // por minutos al conectar la segunda cámara.
    const flightKey = deviceId || `slot-${slot}`;
    if (usbConnectInFlightRef.current.has(flightKey)) {
      throw new Error('Esa cámara ya se está conectando. Espera a que termine el intento anterior antes de volver a hacer clic.');
    }
    usbConnectInFlightRef.current.add(flightKey);

    let stream = null;
    let lastError = null;

    // Apertura con presupuesto de bus (v2.0.0, Raíz B): el escalón se
    // decide ANTES de abrir desde los formatos ya negociados por las
    // cámaras vivas (máx. 2 a 1080p simultáneas; la tercera en adelante
    // abre a 720p). Sin medir fps y sin persistir la rebaja: si una
    // cámara 1080p se desconecta, la próxima apertura vuelve a evaluarse.
    const liveFormats = Object.entries(slotStreamsRef.current || {})
      .filter(([sKey, s]) => Number(sKey) !== slot && s?.getVideoTracks?.().length)
      .map(([, s]) => {
        const st = s.getVideoTracks()[0]?.getSettings?.() || {};
        return { width: st.width || 0, height: st.height || 0 };
      });
    const openTier = decideUsbOpenTier(liveFormats, slot === 0 ? programProfileId : '1080p');
    try {
      stream = await openProvenUsbStream(deviceId, getUserMediaWithTimeout, openTier);
    } catch (err) {
      lastError = err;
    }
    if (stream && openTier === '720p') {
      showToast(`CAM ${slot + 1} abrió en 720p por presupuesto de bus USB (máximo 2 cámaras a 1080p a la vez). No es un fallo de la cámara: al liberar una 1080p, la próxima apertura vuelve a ser 1080p.`, 'info', 8000);
    }

    if (stream) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack && 'contentHint' in vTrack) {
        vTrack.contentHint = 'motion';
      }
      usbConnectInFlightRef.current.delete(flightKey);
      slotStreamsRef.current = { ...slotStreamsRef.current, [slot]: stream };
      const videoInfo = getVideoTrackInfo(stream);
      cameraMetaRef.current = { ...cameraMetaRef.current, [slot]: { deviceId, resolution: getVideoTrackResolution(stream), videoInfo, label: label || 'Cámara USB', type: 'usb' } };
      setSlotStreams(prev => ({ ...prev, [slot]: stream }));
      setCameraMeta(prev => ({ ...prev, [slot]: { deviceId, resolution: getVideoTrackResolution(stream), videoInfo, label: label || 'Cámara USB', type: 'usb' } }));
      if (slot >= camSlots.length && slot < 12) {
        const expandedSlots = Array.from({ length: slot + 1 }, (_, i) => i + 1);
        setCamSlots(expandedSlots);
        camSlotsRef.current = expandedSlots;
      }
      saveCameraToHistory({ deviceId, label: label || 'Cámara USB', type: 'usb', slot });
      if (videoInfo && ((videoInfo.height > 0 && videoInfo.height < 1080) || (videoInfo.frameRate > 0 && videoInfo.frameRate < 24))) {
        showToast(`CAM ${slot + 1} (${label || 'Cámara USB'}) entregó ${videoInfo.label} en vez de 1920×1080 · 30 fps. Con varias cámaras 1080p el bus USB se satura: prueba un puerto directo sin hub o baja la carga.`, 'error', 9000);
      }
      if (slot === 0) {
        try {
          localStorage.setItem('podcastudio_master_camera_device', deviceId);
          if (label) localStorage.setItem('podcastudio_master_camera_label', label);
        } catch {}
        setLocalStream(stream);
      }

      // Adjuntar micrófono emparejado en segundo plano sin frenar el flujo de video en pantalla.
      // v1.7.0 (Raíz C): attachSlotAudio respeta la fuente elegida por el
      // usuario; sin micro emparejado la ranura queda SIN audio (antes la
      // máster recibía el micro por defecto de la PC inyectado).
      attachSlotAudio(slot, stream, deviceId);

      return stream;
    } else {
      usbConnectInFlightRef.current.delete(flightKey);
      const errName = lastError?.name || '';
      const errMsg = lastError?.message || '';
      logger.error("Error al abrir cámara USB:", errName, errMsg);
      if (errName === 'NotReadableError' || errMsg.includes('Device in use') || errMsg.includes('could not start')) {
        throw new Error(`La cámara "${label || 'USB'}" está bloqueada o en uso por otra ventana en tu PC (ej. Chrome con Facebook Live, Zoom o la app Cámara de Windows). Ciérrala en esa ventana para que PodcastStudio pueda tomarla.`);
      }
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        throw new Error(`Permiso denegado para la cámara "${label || 'USB'}". Revisa la privacidad de cámaras en Windows.`);
      }
      if (errName === 'OverconstrainedError') {
        throw new Error(`La cámara "${label || 'USB'}" no soporta los formatos de video solicitados.`);
      }
      throw new Error(`No se pudo abrir la cámara "${label || 'USB'}". Verifica que no esté abierta en otra aplicación o vuelve a conectar el cable.`);
    }
  };

  // Punto de entrada público: serializa TODAS las aperturas USB (modal de
  // conexión y restauración de cámaras guardadas vía handleReconnectSavedCamera,
  // que delega aquí) en la cola global. Puntos NO adaptados a propósito:
  // handleWifiConnect/createWifiMediaStream (IP/RTSP/MJPEG, sin getUserMedia
  // USB), handleScreenConnect (captura de escritorio de Electron),
  // handleAssignRemoteStream y los slots cloud/WebRTC (streams ya abiertos
  // por el transporte), y attachCameraAudio (solo audio, sin vídeo).
  const handleUsbConnect = (deviceId, slot, label) => enqueueUsbOpen(() => handleUsbConnectSequential(deviceId, slot, label));

  const createWifiMediaStream = async (url) => {
    return new Promise((resolve, reject) => {
      let effectiveUrl = url;
      const isRtsp = url && url.startsWith('rtsp://');
      if (isRtsp) {
        const host = window.location.hostname || 'localhost';
        effectiveUrl = `http://${host}:3001/api/rtsp-stream?url=${encodeURIComponent(url)}`;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let isAlive = true;
      let animId = null;
      let resolved = false;

      const isMjpegStream = isRtsp || (effectiveUrl && (effectiveUrl.includes('/api/rtsp-stream') || effectiveUrl.includes('.mjpg') || effectiveUrl.includes('.mjpeg')));

      const video = !isMjpegStream ? document.createElement('video') : null;
      if (video) {
        video.crossOrigin = 'anonymous';
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      let checkInterval = null;

      const finishConnect = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(failTimeout);
        if (checkInterval) clearInterval(checkInterval);

        let lastDraw = 0;
        const renderFrame = () => {
          if (!isAlive) return;
          const now = performance.now();
          // Limitar a ~30fps reales para evitar barrido y retraso acumulado
          if (now - lastDraw >= 32) {
            if (!isMjpegStream && video && video.readyState >= 2) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            } else if (img && img.naturalWidth > 0) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            lastDraw = now;
          }
          animId = requestAnimationFrame(renderFrame);
        };
        animId = requestAnimationFrame(renderFrame);

        const stream = canvas.captureStream(30);
        const track = stream.getVideoTracks()[0];
        if (track) {
          const origStop = track.stop.bind(track);
          track.stop = () => {
            isAlive = false;
            if (animId) cancelAnimationFrame(animId);
            if (checkInterval) clearInterval(checkInterval);
            try { if (video) { video.pause(); video.src = ''; } } catch (e) {}
            try { img.src = ''; } catch (e) {}
            origStop();
          };
        }
        resolve(stream);
      };

      if (video) {
        video.oncanplay = () => finishConnect();
        video.onerror = () => {
          if (!resolved) {
            // Reintentar vía Image como fallback MJPEG
            img.src = effectiveUrl;
          }
        };
      }

      img.onload = () => finishConnect();
      img.onerror = (e) => {
        logger.warn('[WiFi Stream Image Error]:', e);
        if (!resolved) {
          resolved = true;
          isAlive = false;
          if (checkInterval) clearInterval(checkInterval);
          clearTimeout(failTimeout);
          try { img.src = ''; } catch (err) {}
          reject(new Error('La cámara rechazó la conexión. Prueba paths comunes: /live, /stream1, /Streaming/Channels/101, /cam/realmonitor?channel=1&subtype=0, /h264Preview_01_main. Verifica usuario y contraseña.'));
        }
      };

      checkInterval = setInterval(() => {
        if (!resolved) {
          if (img.naturalWidth > 0) {
            finishConnect();
          } else if (video && video.readyState >= 2) {
            finishConnect();
          }
        }
      }, 300);

      const failTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          isAlive = false;
          if (checkInterval) clearInterval(checkInterval);
          try { if (video) { video.pause(); video.src = ''; } } catch (e) {}
          try { img.src = ''; } catch (e) {}
          reject(new Error('Tiempo de espera agotado. Verifica que la cámara esté encendida en la misma red Wi-Fi, con usuario y contraseña correctos.'));
        }
      }, 15000);

      try {
        if (isMjpegStream) {
          img.src = effectiveUrl;
        } else if (video) {
          video.src = effectiveUrl;
        }
      } catch (err) {
        clearTimeout(failTimeout);
        if (checkInterval) clearInterval(checkInterval);
        reject(err);
      }
    });
  };

  const handleWifiConnect = async (url, slot, label) => {
    if (slotStreams[slot]) {
      try { slotStreams[slot].getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    if (slot === 0 && localStream) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    }

    try {
      let stream = null;
      let lastErr = null;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          stream = await createWifiMediaStream(url);
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (!stream) throw (lastErr || new Error('No se pudo conectar'));
      if (stream) {
        setSlotStreams(prev => ({ ...prev, [slot]: stream }));
        if (slot === 0) setLocalStream(stream);
      }
      setCameraMeta(prev => ({
        ...prev,
        [slot]: { url, label: label || `WiFi Cam ${slot + 1}`, type: 'wifi' }
      }));
      saveCameraToHistory({ url, label: label || `WiFi Cam ${slot + 1}`, type: 'wifi', slot });
      return stream;
    } catch (err) {
      logger.error('Error conectando cámara WiFi:', err);
      throw err;
    }
  };

  const handleScreenConnect = async (sourceId, slot, label) => {
    if (slotStreams[slot]) {
      try { slotStreams[slot].getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    if (slot === 0 && localStream) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080
            }
          }
        });
      } catch (err) {
        // Fallback moderno para Chrome 107+
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: sourceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });
      }
      if (stream) {
        setSlotStreams(prev => ({ ...prev, [slot]: stream }));
        setCameraMeta(prev => ({
          ...prev,
          [slot]: { deviceId: sourceId, label: label || `Ventana PC (CAM ${slot + 1})`, type: 'screen' }
        }));
        saveCameraToHistory({ deviceId: sourceId, label: label || `Ventana PC (CAM ${slot + 1})`, type: 'screen' });
        if (slot === 0) setLocalStream(stream);
        return stream;
      }
      return null;
    } catch (err) {
      logger.error('Error conectando ventana de escritorio:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Permiso denegado para captura de pantalla. Autoriza en la configuración del navegador.');
      }
      if (err.name === 'NotFoundError') {
        throw new Error('Fuente de pantalla no encontrada. Vuelve a seleccionar la ventana/pantalla.');
      }
      throw err;
    }
  };

  const handleAssignRemoteStream = (remoteStream, slot, label, meta = {}) => {
    // v3.3.1 (defecto 1): asignar una remota NUNCA expulsa a la
    // ocupante (la v3.3.0 detenía sus tracks y pisaba la ranura). Si
    // la ranura pedida está ocupada por otra fuente, la remota se
    // reubica a la primera libre y se avisa; sin ranuras libres, no se
    // asigna y se devuelve null. Devuelve la ranura donde quedó.
    //
    // v3.3.3 (defecto A): REUTILIZACIÓN por identidad — si ESTE stream
    // o ESTE dispositivo remoto ya quedó colocado en una ranura, la
    // llamada es una actualización de ESA colocación (los caminos que
    // re-emiten la llegada de una remota ya conectada no pueden
    // re-colocarla contra la ocupación de hoy, igual que en el
    // transporte cloud).
    // v3.3.4: la ocupación se juzga con las fuentes COMPLETAS del
    // predicado único (fuentesDeOcupacion): hasta la v3.3.3 este
    // camino solo miraba el stream de la ranura pedida (y la señal
    // local de CAM 1) — una ranura sin stream en ese instante (su
    // cámara prestada al motor, o readquirida «a medias» sin meta)
    // se leía libre y la remota la pisaba. Ahora cuentan también la
    // meta, la reserva del auto-despacho y el registro de liberadas
    // al motor. Toda decisión queda en el instrumento ([ranura]).
    const fuentesModal = {
      streams: slotStreams,
      cameraMeta,
      assignedSlots: assignedSlotsRef.current,
      liberadasAlMotor: nativeReleasedCamsRef.current,
      localStreamActive: Boolean(localStream),
      requestingDeviceId: meta.id,
    };
    if (remoteStream) {
      const yaColocada = Object.keys(slotStreams).find(k => slotStreams[k] === remoteStream)
        ?? (meta.id ? Object.keys(slotStreams).find(k => slotStreams[k]?.mobileId && slotStreams[k].mobileId === meta.id) : undefined)
        ?? (meta.id ? Object.keys(cameraMeta).find(k => cameraMeta[k]?.deviceId === meta.id && (cameraMeta[k]?.type === 'remote' || cameraMeta[k]?.type === 'mobile')) : undefined);
      if (yaColocada !== undefined) {
        const idx = Number(yaColocada);
        ventanaDiagSend('ranura', `camino=modal dispositivo=${meta.id || 'remota'} pedida=CAM ${slot + 1} decision=reutilizar (ya colocada) destino=CAM ${idx + 1}`);
        setSlotStreams(prev => ({ ...prev, [idx]: remoteStream }));
        return idx;
      }
    }
    let targetSlot = slot;
    const ocupadaPorOtra = fuentesDeOcupacion(slot, fuentesModal).length > 0;
    if (ocupadaPorOtra) {
      targetSlot = findAvailableRemoteCameraSlot({
        slotsCount: camSlots.length,
        streams: slotStreams,
        cameraMeta,
        assignedSlots: assignedSlotsRef.current,
        liberadasAlMotor: nativeReleasedCamsRef.current,
        localStreamActive: Boolean(localStream),
        requestingDeviceId: meta.id,
      });
      if (targetSlot === null) {
        ventanaDiagSend('ranura', `camino=modal dispositivo=${meta.id || 'remota'} pedida=CAM ${slot + 1} ocupacionPedida=[${fuentesDeOcupacion(slot, fuentesModal).join(',') || 'libre'}] decision=rechazar destino=ninguna`);
        showToast(`CAM ${slot + 1} está ocupada y no hay ranuras libres: la cámara remota NO reemplazó a ninguna cámara.`, 'error', 8000);
        return null;
      }
      ventanaDiagSend('ranura', `camino=modal dispositivo=${meta.id || 'remota'} pedida=CAM ${slot + 1} ocupacionPedida=[${fuentesDeOcupacion(slot, fuentesModal).join(',') || 'libre'}] decision=reubicar destino=CAM ${targetSlot + 1}`);
      showToast(`CAM ${slot + 1} está ocupada: la cámara remota se asignó a CAM ${targetSlot + 1} sin desconectar la que estaba.`, 'info', 7000);
    } else {
      ventanaDiagSend('ranura', `camino=modal dispositivo=${meta.id || 'remota'} pedida=CAM ${slot + 1} ocupacionPedida=[libre] decision=asignar destino=CAM ${targetSlot + 1}`);
    }
    setSlotStreams(prev => ({ ...prev, [targetSlot]: remoteStream }));
    setCameraMeta(prev => ({
      ...prev,
      [targetSlot]: { deviceId: meta.id || `remote_${targetSlot}`, label: label || `Cámara ${targetSlot + 1}`, type: 'remote', ...meta }
    }));
    saveCameraToHistory({ deviceId: meta.id || `remote_${targetSlot}`, label: label || `Cámara ${targetSlot + 1}`, type: 'remote', slot: targetSlot });
    if (targetSlot === 0) setLocalStream(remoteStream);
    return targetSlot;
  };

  const handleReconnectSavedCamera = useCallback(async (savedCam) => {
    if (!savedCam) return;
    // v3.3.1 (defecto 2, reglas b y c): una cámara conocida recupera
    // SU ranura anterior si está libre; si no, la primera libre. Nunca
    // la última/mayor por defecto (la v3.3.0 abría en CAM 4 con CAM 2
    // libre). Sin ninguna libre se conserva el último recurso de
    // siempre (la ranura activa), que la apertura USB protege con su
    // error explícito si está ocupada.
    const chosen = chooseReconnectCameraSlot({
      previousSlot: Number.isInteger(savedCam.slot) ? savedCam.slot : null,
      camSlots,
      streams: slotStreams,
      cameraMeta,
      // v3.3.4: una ranura con cámara prestada al motor no está libre
      // tampoco para reconectar una guardada: su dueña volverá a ella.
      liberadasAlMotor: nativeReleasedCamsRef.current,
    });
    const targetIdx = chosen !== null ? chosen : (activeCam - 1);
    if (savedCam.type === 'wifi' && savedCam.url) {
      await handleWifiConnect(savedCam.url, targetIdx, savedCam.name || savedCam.label);
    } else if (savedCam.type === 'usb' && savedCam.deviceId) {
      await handleUsbConnect(savedCam.deviceId, targetIdx, savedCam.name || savedCam.label);
    }
  }, [camSlots, slotStreams, cameraMeta, activeCam, handleWifiConnect, handleUsbConnect]);

  const handleDisconnectSlot = async (slot) => {
    // 1. Desconectar y liberar transporte WebRTC cloud si existe
    if (cloudTransportRef.current) {
      try {
        await cloudTransportRef.current.disconnectSlot(slot);
        // Volver a reconectar la ranura en modo escucha para aceptar una nueva conexión limpia
        const roomCode = `studio_cam_${slot + 1}`;
        cloudTransportRef.current.connectSlot(slot, roomCode);
      } catch (e) {
        logger.warn(`[handleDisconnectSlot] Error en disconnectSlot:`, e);
      }
    }

    // 2. Liberar WebRTC peer connection de celular local si existía
    const localStreamId = slotStreams[slot]?.mobileId;
    if (localStreamId && peerConnections.current[localStreamId]) {
      try { peerConnections.current[localStreamId].close(); } catch (e) {}
      delete peerConnections.current[localStreamId];
      delete candidateBuffers.current[localStreamId];
    }

    // 3. Detener tracks y limpiar MediaStream
    if (slotStreams[slot]) {
      try { slotStreams[slot].getTracks().forEach(t => t.stop()); } catch (e) {}
      setSlotStreams(prev => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
    }
    if (slot === 0 && localStream) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      setLocalStream(null);
    }

    // 4. Limpiar metadatos y listas de cámaras remotas
    delete assignedSlotsRef.current[slot];
    setRemoteCams(prev => prev.filter(r => r.id !== `cloud_${slot}` && (!localStreamId || r.id !== localStreamId)));
    setCameraMeta(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });

    // 4b. v3.3.4: si la cámara de esta ranura estaba PRESTADA al motor
    // nativo (sin stream en la ventana), la desconexión manual cancela
    // el préstamo: el registro de liberada y su foto fija se retiran,
    // la ranura queda libre de verdad y la cámara NO se readquiere al
    // apagarse el motor. Es la única vía legítima de liberar una
    // ranura bloqueada (regla de Luis) — sin esto, el registro
    // sobrevivía a la desconexión y la ranura quedaba bloqueada para
    // siempre (o la cámara «resucitaba» al volver del motor).
    if (nativeReleasedCamsRef.current?.[slot]) {
      const sinLiberada = { ...nativeReleasedCamsRef.current };
      delete sinLiberada[slot];
      nativeReleasedCamsRef.current = sinLiberada;
      setNativeReleasedPhotos(prev => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      ventanaDiagSend('ranura', `camino=desconexión-manual pedida=CAM ${slot + 1} decision=liberar (préstamo al motor cancelado por el usuario) destino=CAM ${slot + 1}`);
    }

    // 5. Si la cámara desconectada estaba activa en PGM (Programa), conmutar a CAM 1 para no dejar pantalla negra
    if (activeCamRef.current === slot + 1) {
      setActiveCam(1);
      updateBroadcastState({ activeCam: 1 });
    }
    if (pvwCam === slot + 1) setPvwCam(null);
    if (pipCam === slot + 1) setPipCam(null);
  };

  const handleRenameSlot = (slot, label) => {
    const camId = slot + 1;
    setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], label } }));
    setCameraBadges(prev => {
      const next = {
        ...prev,
        [camId]: {
          ...(prev[camId] || {}),
          name: label,
          enabled: Boolean(label && label.trim().length > 0),
          position: prev[camId]?.position || 'bottom-left'
        }
      };
      try { localStorage.setItem('podcastudio_camera_badges', JSON.stringify(next)); } catch (e) {}
      updateBroadcastState({ cameraBadges: next });
      return next;
    });
  };

  const handleDeleteOrDisconnectCam = (camId) => {
    if (camId === 1) {
      // CAM 1 es Master / Host: si tiene señal se apaga, pero la ranura principal se conserva
      handleDisconnectSlot(0);
      return;
    }
    // Ranuras secundarias: detener stream, eliminar ranura y renumerar consecutivamente (CAM 1, CAM 2, CAM 3...)
    removeCam(camId);
  };

  const handleSelectMasterCam = (rawCamId) => {
    const camId = Number(rawCamId);
    const nextMuted = { ...camMuted };
    camSlots.forEach(id => { nextMuted[id] = (id !== camId); });
    setActiveCam(camId);
    if (layoutMode === 'pip') {
      if (pipCam === camId) {
        const altPip = camSlots.find(id => id !== camId) || (camId === 1 ? 2 : 1);
        setPipCam(altPip);
        updateBroadcastState({ activeCam: camId, pipCam: altPip, camMuted: nextMuted });
      } else {
        updateBroadcastState({ activeCam: camId, camMuted: nextMuted });
      }
    } else {
      setLayoutMode('1');
      updateBroadcastState({ activeCam: camId, layoutMode: '1', camMuted: nextMuted });
    }
    setCamMuted(nextMuted);
    if (!isElectronMaster) {
      dispatchRemoteCommand('SET_ACTIVE_CAM', { camId });
    }
  };

  const handleTogglePip = (rawCamId) => {
    const camId = Number(rawCamId);
    if (layoutMode === 'pip' && pipCam === camId) {
      setLayoutMode('1');
      if (!isElectronMaster) {
        dispatchRemoteCommand('SET_LAYOUT', { mode: '1' });
      }
      return;
    }
    if (activeCam === camId) {
      const altMaster = camSlots.find(id => id !== camId) || (camId === 1 ? 2 : 1);
      const nextMuted = { ...camMuted };
      camSlots.forEach(id => { nextMuted[id] = (id !== altMaster); });
      setActiveCam(altMaster);
      setCamMuted(nextMuted);
      updateBroadcastState({ activeCam: altMaster, camMuted: nextMuted });
    }
    setPipCam(camId);
    setLayoutMode('pip');
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_PIP', { camId });
    }
  };

  // SINCRONIZACIÓN Y BROADCAST EN VIVO CON CONTROL REMOTO IPAD (LAN WEBSOCKET & SUPABASE)
  const broadcastStudioState = useCallback(() => {
    const statePayload = {
      type: 'STATE_UPDATE',
      activeCam,
      pvwCam,
      pipCam,
      layoutMode,
      isRecording: isRecordingRef.current,
      recordingTime: recordingTimeRef.current,
      isStreaming: isStreamingRef.current,
      streamDuration: streamDurationRef.current,
      topic,
      cintillosVisible,
      cintillo,
      camSlots,
      tBarPosition,
      isReplaying: !!instantReplay.isReplaying,
      musicPlaying: !!music.isPlaying,
      camMuted,
      teleprompter: {
        text: teleprompterText,
        speed: teleprompterSpeed,
        fontSize: teleprompterFontSize,
        isPlaying: isTeleprompterPlaying,
      }
    };

    // 1. Enviar a través de Electron IPC a clientes de la Red Local (iPad / Tablets vía WebSocket LAN)
    if (window.api?.sendStudioState) {
      window.api.sendStudioState(statePayload);
    }

    // 2. Enviar a través de canal Supabase si está disponible
    if (controlChannelRef.current) {
      try {
        controlChannelRef.current.send({
          type: 'broadcast',
          event: 'studio_state',
          payload: statePayload
        }).catch(() => {});
      } catch {}
    }
  }, [activeCam, pvwCam, pipCam, layoutMode, topic, cintillosVisible, cintillo, camSlots, tBarPosition, instantReplay.isReplaying, music.isPlaying, camMuted, teleprompterText, teleprompterSpeed, teleprompterFontSize, isTeleprompterPlaying]);

  // DISPATCHER UNIFICADO DE COMANDOS DE CONTROL REMOTO
  const handleRemoteStudioCommand = useCallback((payload) => {
    if (!payload || !payload.type) return;
    const cmd = String(payload.type).toUpperCase();

    if (cmd === 'REQUEST_STATE') {
      broadcastStudioState();
    } else if (cmd === 'SET_ACTIVE_CAM' || cmd === 'SET-ACTIVE-CAM') {
      if (payload.camId !== undefined) handleSelectMasterCam(Number(payload.camId));
    } else if (cmd === 'SET_PVW_CAM' || cmd === 'SET-PVW-CAM') {
      if (payload.camId !== undefined) setPvwCam(Number(payload.camId));
    } else if (cmd === 'TRIGGER_CUT' || cmd === 'CUT') {
      handleCutTransition();
    } else if (cmd === 'TRIGGER_AUTO' || cmd === 'AUTO') {
      handleAutoTransition();
    } else if (cmd === 'SET_TBAR' || cmd === 'SET-TBAR') {
      if (typeof payload.position === 'number') handleTBarChange(payload.position);
    } else if (cmd === 'TOGGLE_PIP') {
      handleTogglePip(Number(payload.camId || pipCam));
    } else if (cmd === 'SET_PIP_CAM') {
      if (payload.camId !== undefined) {
        setPipCam(Number(payload.camId));
        setLayoutMode('pip');
      }
    } else if (cmd === 'SET_LAYOUT' || cmd === 'SET-LAYOUT') {
      if (payload.mode) setLayoutMode(payload.mode);
    } else if (cmd === 'TOGGLE_RECORD') {
      handleRecord();
    } else if (cmd === 'START_RECORD') {
      if (!isRecordingRef.current) handleRecord();
    } else if (cmd === 'STOP_RECORD') {
      if (isRecordingRef.current) handleRecord();
    } else if (cmd === 'TOGGLE_STREAM') {
      handleStream();
    } else if (cmd === 'START_STREAM') {
      if (!isStreamingRef.current) handleStream();
    } else if (cmd === 'STOP_STREAM') {
      if (isStreamingRef.current) handleStream();
    } else if (cmd === 'TOGGLE_CINTILLO') {
      setCintillosVisible(v => !v);
    } else if (cmd === 'SET_CINTILLO_PRESET') {
      if (payload.presetId) {
        showManual(payload.presetId);
        setCintillosVisible(true);
      }
    } else if (cmd === 'SET_CUSTOM_CINTILLO') {
      if (payload.text) {
        showCustom({
          tag: payload.tag || 'EN VIVO',
          text: payload.text,
          subtitle: payload.subtitle || '',
          color: '#e8612a'
        });
        setCintillosVisible(true);
      }
    } else if (cmd === 'TRIGGER_SFX') {
      const sfxId = payload.sfxId || payload.id;
      const sfxItem = (combinedSfx || []).find(s => s.id === sfxId || s.category === payload.category) ||
                      (MUSIC_SFX || []).find(s => s.id === sfxId || s.category === payload.category);
      if (sfxItem) playSfx(sfxItem);
    } else if (cmd === 'TOGGLE_MUSIC') {
      music.toggle();
    } else if (cmd === 'TOGGLE_MIC_MUTE') {
      const cId = Number(payload.camId || 1);
      setCamMuted(prev => ({ ...prev, [cId]: !prev[cId] }));
    } else if (cmd === 'MUTE_ALL') {
      setCamMuted(prev => {
        const next = { ...prev };
        camSlots.forEach(id => { next[id] = true; });
        return next;
      });
    } else if (cmd === 'UNMUTE_ALL') {
      setCamMuted(prev => {
        const next = { ...prev };
        camSlots.forEach(id => { next[id] = false; });
        return next;
      });
    } else if (cmd === 'TOGGLE_PROMPTER') {
      setIsTeleprompterPlaying(p => !p);
    } else if (cmd === 'PLAY_PROMPTER') {
      setIsTeleprompterPlaying(true);
    } else if (cmd === 'PAUSE_PROMPTER') {
      setIsTeleprompterPlaying(false);
    } else if (cmd === 'SET_PROMPTER_SPEED') {
      if (typeof payload.speed === 'number') setTeleprompterSpeed(payload.speed);
    } else if (cmd === 'SET_PROMPTER_FONT_SIZE') {
      if (typeof payload.fontSize === 'number') setTeleprompterFontSize(payload.fontSize);
    } else if (cmd === 'SET_PROMPTER_TEXT') {
      if (payload.text !== undefined) setTeleprompterText(payload.text);
    } else if (cmd === 'ADD_CAM_SLOT') {
      addCam();
    } else if (cmd === 'REMOVE_CAM_SLOT') {
      if (payload.camId !== undefined) removeCam(Number(payload.camId));
    }

    setTimeout(() => {
      broadcastStudioState();
    }, 40);
  }, [broadcastStudioState, handleSelectMasterCam, handleCutTransition, handleAutoTransition, handleTBarChange, handleTogglePip, pipCam, handleRecord, handleStream, showManual, combinedSfx, playSfx, music, camSlots, addCam, removeCam]);


  useEffect(() => {
    if (isElectronMaster) {
      broadcastStudioState();
    }
  }, [broadcastStudioState, isElectronMaster]);

  // Listener para comandos de red local LAN provenientes de Electron WebSocket
  useEffect(() => {
    if (window.api?.onRemoteStudioCommand) {
      const unsub = window.api.onRemoteStudioCommand((cmd) => {
        handleRemoteStudioCommand(cmd);
      });
      return () => { if (unsub) unsub(); };
    }
  }, [handleRemoteStudioCommand]);

  // Conexión de red local WebSocket cuando corre en iPad / Navegador
  useEffect(() => {
    if (isElectronMaster) return;

    let socket = null;
    let isUnmounted = false;
    let retryTimer = null;

    function connectWs() {
      if (isUnmounted) return;
      const host = window.location.hostname || '127.0.0.1';
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = window.location.port || (window.location.protocol === 'https:' ? '3000' : '3001');
      const wsUrl = `${proto}//${host}:${port}`;

      try {
        socket = new WebSocket(wsUrl);
        remoteWsRef.current = socket;

        socket.onopen = () => {
          logger.log('[RemoteExtension] Conectado a Master PC en:', wsUrl);
          socket.send(JSON.stringify({ type: 'identify', role: 'remote-control' }));
          socket.send(JSON.stringify({ type: 'request-state' }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'studio-state' && data.state) {
              applyRemoteStudioState(data.state);
            } else if (data.type === 'pgm-frame' && data.data) {
              window.dispatchEvent(new CustomEvent('podcastudio_pgm_feed_frame', { detail: data.data }));
            } else if (data.type === 'cam-thumbnails' && data.thumbnails) {
              setCamThumbnails(prev => ({ ...prev, ...data.thumbnails }));
            }
          } catch (e) {}
        };

        socket.onclose = () => {
          if (!isUnmounted) retryTimer = setTimeout(connectWs, 2000);
        };
        socket.onerror = () => {
          try { socket.close(); } catch (e) {}
        };
      } catch (e) {
        retryTimer = setTimeout(connectWs, 3000);
      }
    }

    connectWs();
    return () => {
      isUnmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket) socket.close();
    };
  }, [isElectronMaster, applyRemoteStudioState]);

  // Canal Supabase Cloud bidireccional (Master emite estado; iPad emite comandos)
  useEffect(() => {
    if (!supabase) return;

    const channelName = 'studio_control_master_studio';
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    controlChannelRef.current = channel;

    channel.on('broadcast', { event: 'studio_command' }, (event) => {
      hasCloudClientsRef.current = true;
      const payload = event?.payload;
      if (payload && isElectronMaster) handleRemoteStudioCommand(payload);
    });

    channel.on('broadcast', { event: 'studio_state' }, (event) => {
      const payload = event?.payload;
      if (payload && !isElectronMaster) applyRemoteStudioState(payload);
    });

    channel.on('broadcast', { event: 'pgm_cloud_frame' }, (event) => {
      const payload = event?.payload;
      if (payload?.dataUrl && !isElectronMaster) {
        window.dispatchEvent(new CustomEvent('podcastudio_pgm_feed_frame', { detail: payload.dataUrl }));
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (isElectronMaster) {
          broadcastStudioState();
        } else {
          channel.send({
            type: 'broadcast',
            event: 'studio_command',
            payload: { type: 'REQUEST_STATE', sender: 'ipad_extension' }
          }).catch(() => {});
        }
      }
    });

    return () => {
      channel.unsubscribe().catch(() => {});
    };
  }, [broadcastStudioState, handleRemoteStudioCommand, isElectronMaster, applyRemoteStudioState]);

  const renderMonitorLayout = (overrideCam = null) => {
    const effectiveActiveCam = overrideCam || activeCam;

    // Si corre como extensión remota en iPad/Browser, SIEMPRE mostrar la señal Master espejo de la PC
    if (!isElectronMaster) {
      return (
        <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
          <PgmFeedCanvas />
        </div>
      );
    }

    const getTileProps = (id) => {
      const idx = camSlots.indexOf(id);
      return {
        camId: id,
        stream: getCamStream(id),
        label: null, // ELIMINADO de la pantalla master para no estorbar logos ni cintillos
        isLocal: id === 1,
        muted: true, // Monitor Master siempre silenciado para que el navegador nunca bloquee la reproducción con pantallas o flashes negros (el audio se procesa en el Audio Mixer)
        speakerMuted: undefined,
        onToggleSpeaker: null, // ELIMINADO de la pantalla master (los controles van en los recuadros inferiores)
        micMuted: undefined,
        onToggleMic: null, // ELIMINADO de la pantalla master (los controles van en los recuadros inferiores)
        style: getVideoStyle(id, true),
        chromaKey: chromaKeyActive,
        bgImage: virtualBg,
        isActive: (layoutMode === '1' && id === effectiveActiveCam) || 
                  (layoutMode === 'pip' && (id === effectiveActiveCam || id === effectivePipCam)) ||
                  (layoutMode === '2' && (idx === 0 || idx === 1)) ||
                  (layoutMode === 'two-shot' && (idx === 0 || idx === 1)) ||
                  (layoutMode === '3' && idx < 3) ||
                  (layoutMode === '4' && idx < 4) ||
                  (layoutMode === '6' && idx < 6) ||
                  (layoutMode === '8' && idx < 8) ||
                  (layoutMode === '10' && idx < 10) ||
                  (layoutMode === 'speaker' && id === effectiveActiveCam) ||
                  (layoutMode === 'gallery')
      };
    };

    const effectivePipCam = (pipCam && pipCam !== effectiveActiveCam)
      ? pipCam
      : (camSlots.find(id => id !== effectiveActiveCam) || (effectiveActiveCam === 1 ? 2 : 1));
    const layoutCameraLimit = { '1': 1, '2': 2, 'two-shot': 2, '3': 3, '4': 4, '6': 6, '6-lead': 6, '8': 8, '10': 10 }[layoutMode];

    return (
      <div className="w-full h-full relative overflow-hidden bg-[#050505]">
        {camSlots.map((id) => {
          let tileClass = "absolute transition-none";
          let tileStyle = {};
          const idx = camSlots.indexOf(id);
          // MANTENER SIEMPRE MONTADOS TODOS LOS ELEMENTOS EN EL DOM:
          // Si un slot se desmonta con return null, al conmutar a esa cámara el elemento <video>
          // se crea desde cero y el decodificador de video tarda 200-400ms en calentarse,
          // produciendo el desagradable "parche/cuadro negro" en medio del cambio.
          // Al mantenerlos vivos en el DOM con z-0 y opacity-0, el cambio es instantáneo (cero negro).

          if (layoutMode === '1') {
            if (id === effectiveActiveCam) {
              tileClass += " inset-0 w-full h-full z-20 pointer-events-auto opacity-100";
            } else if (id === prevActiveCamRef.current) {
              // La toma anterior se conserva al 100% en z-10 debajo para CERO parche negro durante la conmutación
              tileClass += " inset-0 w-full h-full z-10 pointer-events-none opacity-100";
            } else if (id === pvwCam && tBarPosition > 0 && !overrideCam) {
              tileClass += " inset-0 w-full h-full z-30 pointer-events-auto";
              tileStyle.opacity = tBarPosition;
            } else {
              // Mantener vivas en z-0 con opacity-100 para que Chromium NUNCA suspenda el decodificador de video
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === 'pip') {
            if (id === effectiveActiveCam) {
              tileClass += " inset-0 w-full h-full z-10 pointer-events-auto opacity-100";
            } else if (id === effectivePipCam) {
              tileClass += " top-[3.7%] right-[2.1%] w-[24%] aspect-video border-2 border-orange-500 rounded-lg z-20 overflow-hidden shadow-2xl pointer-events-auto opacity-100 bg-black";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '2') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === 'two-shot') {
            if (idx === 0) {
              tileClass += " left-[2%] top-[8%] w-[47%] h-[84%] rounded-xl overflow-hidden shadow-2xl border border-orange-500/40 z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-[2%] top-[8%] w-[47%] h-[84%] rounded-xl overflow-hidden shadow-2xl border border-orange-500/40 z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '3') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-0 top-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else if (idx === 2) {
              tileClass += " right-0 bottom-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '4') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-0 top-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else if (idx === 2) {
              tileClass += " left-0 bottom-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else if (idx === 3) {
              tileClass += " right-0 bottom-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '6') {
            if (idx < 6) {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              tileStyle = {
                left: `calc(${col * 33.333}% + ${col > 0 ? 2 : 0}px)`,
                top: row === 0 ? 0 : 'calc(50% + 2px)',
                width: 'calc(33.333% - 3px)',
                height: 'calc(50% - 3px)'
              };
              tileClass += " z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '6-lead') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(60%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else if (idx >= 1 && idx <= 5) {
              const sub = idx - 1;
              const col = sub % 2;
              const row = Math.floor(sub / 2);
              tileStyle = {
                left: `calc(60% + ${col * 20}% + 2px)`,
                top: `calc(${row * 33.333}% + ${row > 0 ? 2 : 0}px)`,
                width: 'calc(20% - 3px)',
                height: 'calc(33.333% - 3px)'
              };
              tileClass += " z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '8') {
            if (idx < 8) {
              const col = idx % 4;
              const row = Math.floor(idx / 4);
              tileStyle = {
                left: `calc(${col * 25}% + ${col > 0 ? 2 : 0}px)`,
                top: row === 0 ? 0 : 'calc(50% + 2px)',
                width: 'calc(25% - 3px)',
                height: 'calc(50% - 3px)'
              };
              tileClass += " z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === '10') {
            if (idx < 10) {
              const col = idx % 5;
              const row = Math.floor(idx / 5);
              tileStyle = {
                left: `calc(${col * 20}% + ${col > 0 ? 2 : 0}px)`,
                top: row === 0 ? 0 : 'calc(50% + 2px)',
                width: 'calc(20% - 3px)',
                height: 'calc(50% - 3px)'
              };
              tileClass += " z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          } else if (layoutMode === 'speaker') {
            if (id === effectiveActiveCam) {
              tileClass += " left-0 top-0 w-full h-[76%] z-10 pointer-events-auto opacity-100";
            } else {
              const other = camSlots.filter(c => c !== effectiveActiveCam);
              const oIdx = other.indexOf(id);
              if (oIdx >= 0) {
                const w = 100 / Math.max(1, other.length);
                tileStyle = {
                  left: `${oIdx * w}%`,
                  bottom: 0,
                  width: `calc(${w}% - 2px)`,
                  height: '24%'
                };
                tileClass += " z-15 pointer-events-auto opacity-100 border border-[#333]";
              } else {
                tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
              }
            }
          } else if (layoutMode === 'gallery') {
            const count = camSlots.length;
            const cols = count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : count <= 8 ? 4 : 5;
            const rows = Math.ceil(count / cols);
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const colW = 100 / cols;
            const rowH = 100 / rows;
            tileStyle = {
              left: `${col * colW}%`,
              top: `${row * rowH}%`,
              width: `calc(${colW}% - 2px)`,
              height: `calc(${rowH}% - 2px)`
            };
            tileClass += " z-10 pointer-events-auto opacity-100 border border-[#222]";
          } else {
            if (id === effectiveActiveCam) {
              tileClass += " inset-0 w-full h-full z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-100";
            }
          }

          return (
            <div key={`cam-persistent-slot-${id}`} className={tileClass} style={tileStyle} data-pgm-tile={id === effectiveActiveCam ? '1' : undefined}>
              <VideoTile {...getTileProps(id)} className="w-full h-full" />
            </div>
          );
        })}
        {/* PGM real: canvas maestro encima cuando ya presentó fotogramas;
            si no, quedan visibles los VideoTile directos de arriba.
            v3.3.0 D1/D3: en modo motor el canvas no compone (dieta), así
            que el monitor de canvas no se monta: el programa se ve en
            los VideoTile directos y en la ventana nativa de vista
            previa. */}
        {!enModoMotor && <MasterProgramMonitor />}
      </div>
    );
  };

  const handleApplyCintilloFromModal = (data) => {
    setCintillosVisible(true);
    if (data.styleId) setCintilloStyle(data.styleId);
    showCustom({
      tag: data.tag,
      text: data.text,
      subtitle: data.subtitle,
      color: data.color,
      styleId: data.styleId,
      logoUrl: data.logoUrl || null,
      position: cintilloPosition,
    });
  };

  const handleSaveCustomCintillo = (data) => {
    setCustomCintillosList(prev => [data, ...prev]);
  };

  const switchSocialTarget = (target) => {
    setSocialTarget(target);
    if (cintillosVisible && cintillo?.active && cintillo?.presetId?.startsWith('social_')) {
      setTimeout(() => {
        showManual(cintillo.presetId);
      }, 50);
    }
  };

  const triggerConductorCintillo = (idx) => {
    const cond = conductores[idx];
    if (!cond) return;
    setActiveConductorIdx(idx);
    switchSocialTarget('program');
    setCintillosVisible(true);
    showCustom({
      tag: `CONDUCTOR ${conductores.length > 1 ? idx + 1 : ''}`.trim(),
      text: cond.name,
      subtitle: cond.role,
      color: '#ea580c',
      presetId: `conductor_${idx}`
    });
  };

  const triggerInvitadoCintillo = (idx) => {
    const inv = invitados[idx];
    if (!inv) return;
    setActiveInvitadoIdx(idx);
    switchSocialTarget('guest');
    setCintillosVisible(true);
    showCustom({
      tag: `INVITADO ${invitados.length > 1 ? idx + 1 : ''}`.trim(),
      text: inv.name,
      subtitle: inv.role,
      color: '#059669',
      presetId: `invitado_${idx}`
    });
  };

  const addConductor = () => {
    const nextNum = conductores.length + 1;
    setConductores(prev => [
      ...prev,
      { id: Date.now(), name: `Conductor ${nextNum}`, role: 'Conductor', instagram: '', youtube: '', tiktok: '', facebook: '' }
    ]);
    setActiveConductorIdx(conductores.length);
  };

  const removeConductor = (idx) => {
    if (conductores.length <= 1) return;
    setConductores(prev => prev.filter((_, i) => i !== idx));
    if (activeConductorIdx >= idx) {
      setActiveConductorIdx(Math.max(0, activeConductorIdx - 1));
    }
  };

  const addInvitado = () => {
    const nextNum = invitados.length + 1;
    setInvitados(prev => [
      ...prev,
      { id: Date.now(), name: `Invitado ${nextNum}`, role: 'Invitado Especial', instagram: '', youtube: '', tiktok: '', facebook: '' }
    ]);
    setActiveInvitadoIdx(invitados.length);
  };

  const removeInvitado = (idx) => {
    if (invitados.length <= 1) return;
    setInvitados(prev => prev.filter((_, i) => i !== idx));
    if (activeInvitadoIdx >= idx) {
      setActiveInvitadoIdx(Math.max(0, activeInvitadoIdx - 1));
    }
  };

  return (
    <div 
      className="fixed inset-0 flex min-h-0 min-w-0 flex-col bg-[#0a0a0a] text-[#e0e0e0] font-sans overflow-hidden text-[13px] select-none"
    >
      
      {/* ÁREA DE TRABAJO PRINCIPAL */}
      <div className="flex-1 flex min-h-0 flex-row overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        
        {/* TOP BAR */}
        <div 
          className="h-[46px] min-h-[46px] max-h-[46px] flex justify-between items-center bg-[#0a0a0a] px-2.5 sm:px-3 border-b border-[#222] shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitAppRegion: 'drag' }}
        >
          <div className="flex items-center gap-3 sm:gap-6" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-orange-500/20 border border-orange-400/30 flex-shrink-0">
                <Mic size={15} className="text-white" />
              </div>
              <h1 className="text-base font-extrabold tracking-tight text-white">Podca<span className="text-orange-500">Studio</span></h1>
            </div>


          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 text-xs" style={{ WebkitAppRegion: 'no-drag' }}>
            {music.playing && (
              <div className="hidden sm:flex items-center gap-1.5 bg-orange-950/40 border border-orange-500/40 text-orange-400 px-2 py-0.5 rounded text-[11px] animate-pulse shrink-0">
                <Music size={12} /> <span className="font-semibold">{music.currentTrack?.name}</span>
                {music.duckingEnabled && micLevel > 14 && <span className="text-[9px] bg-orange-600 text-white px-1 rounded ml-1">Ducking</span>}
              </div>
            )}
            <span className="hidden md:inline text-gray-500 font-bold tracking-wider shrink-0 text-[11px]">CALIDAD</span>
            <span className="text-orange-500 font-extrabold text-xs shrink-0">{cameraMeta[activeCam - 1]?.videoInfo?.label || 'Midiendo señal…'}</span>

            {/* ZOOM DINÁMICO & ENCUADRE (TEXTO PLANO LIMPIO SIN RECUADROS NI LÍNEAS) */}
            {(() => {
              const currentActiveZoom = ((cameraCrops[activeCam - 1]?.zoom) || 1.0);
              return (
                <div 
                  className="hidden md:flex items-center gap-1.5 text-xs select-none shrink-0"
                  title="Control de Zoom Dinámico & Encuadre: Usa la rueda del mouse para Zoom, y arrastra con clic izquierdo para mover la imagen"
                >
                  <Search size={13} className="text-orange-500" />
                  <span className="text-orange-500 font-bold">ZOOM DINÁMICO</span>
                  <span className="text-white font-extrabold text-[11px]">
                    {currentActiveZoom.toFixed(1)}x
                  </span>
                  {currentActiveZoom > 1.01 && (
                    <div className="flex items-center gap-1.5 ml-1">
                      <span className="text-[10px] text-gray-400 font-medium hidden lg:inline">
                        Arrastra para centrar
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const resetProfile = { ...(cameraCrops[activeCam - 1] || {}), zoom: 1.0, focusX: 0.5, focusY: 0.42 };
                          handleSaveSlotProfile(activeCam - 1, resetProfile);
                          updateBroadcastState({ cameraCrops: { ...cameraCrops, [activeCam - 1]: resetProfile } });
                        }}
                        className="text-orange-400 hover:text-orange-300 font-bold text-[10px] cursor-pointer transition-colors"
                        title="Restablecer zoom a 1.0x y centrar toma"
                      >
                        [Reset]
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* BOTÓN TALLY LIGHTS (TEXTO PLANO LIMPIO SIN RECUADROS NI LÍNEAS) */}
            <button
              onClick={() => setShowTallyModal(true)}
              className="px-1.5 py-1 text-xs font-bold flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Configurar Tally Lights Broadcast (Móviles Wi-Fi y Puertos Seriales USB)"
            >
              <Radio size={14} className="text-red-500 animate-pulse" />
              <span className="hidden sm:inline">Tally Lights</span>
              <span className="text-[11px] font-black text-red-400">
                P{activeCam}
              </span>
            </button>

            {/* BOTÓN OCULTAR / MOSTRAR PANEL LATERAL (TEXTO PLANO LIMPIO SIN RECUADROS NI LÍNEAS) */}
            <button
              onClick={() => setIsRightPanelOpen(p => !p)}
              className="px-1.5 py-1 text-xs font-bold flex items-center gap-1.5 text-gray-300 hover:text-orange-400 transition-colors cursor-pointer shrink-0"
              title={isRightPanelOpen ? "Ocultar panel lateral derecho" : "Mostrar panel lateral derecho"}
            >
              <PanelRight size={14} className={isRightPanelOpen ? 'text-orange-400' : 'text-gray-400'} />
              <span className="hidden sm:inline">{isRightPanelOpen ? 'Ocultar Panel' : 'Mostrar Panel'}</span>
            </button>

            {/* BOTÓN MANDO IPAD (TEXTO PLANO LIMPIO SIN RECUADROS NI LÍNEAS) */}
            <button
              onClick={() => setShowRemoteControlModal(true)}
              className="px-1.5 py-1 text-xs font-bold flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
              title="Conectar iPad, Tablet o Móvil como Mando Switcher a distancia"
            >
              <Smartphone size={14} className="text-amber-400" />
              <span>🎮 Mando iPad</span>
            </button>
          </div>
          <div className="flex gap-1.5 sm:gap-2 items-center pr-1 sm:pr-2" style={{ WebkitAppRegion: 'no-drag' }}>
             {/* INDICADOR DE GRABACIÓN MASTER A LA DERECHA */}
             {isRecording && (
               <button
                 onClick={handleRecord}
                 className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-bold text-xs shadow-lg shadow-red-900/50 animate-pulse cursor-pointer border border-red-500"
                 title="Detener grabación en vivo"
               >
                 <div className="w-2 h-2 bg-white rounded-full"></div>
                 <span>REC MASTER</span>
                 <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px]">{formatTime(recordingTime)}</span>
               </button>
             )}

             {/* BOTÓN MARCAR HIGHLIGHT EN VIVO (P3.1) */}
             {isRecording && (
               <button
                 onClick={() => addHighlight('Highlight Manual [Conductor]', 'manual', 30)}
                 className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-2.5 py-1.5 rounded font-extrabold text-xs shadow-md shadow-orange-900/40 cursor-pointer border border-amber-400/50 transition-transform active:scale-95"
                 title="Marcar momento destacado (Atajo: tecla [H] o [M])"
               >
                 <Sparkles size={13} className="text-amber-200" />
                 <span>HIGHLIGHT</span>
                 {highlightCount > 0 && (
                   <span className="font-mono bg-black/50 text-amber-300 px-1.5 py-0.2 rounded text-[10px]">
                     {highlightCount}
                   </span>
                 )}
               </button>
             )}

             {/* INDICADOR EN VIVO / AL AIRE VERDE CON BOTÓN CIRCULAR TITILANDO */}
             {isStreaming && (
               <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 px-3 py-1 rounded-full text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.4)] select-none">
                 <span className="relative flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                 </span>
                 <span className="tracking-wider">AL AIRE · EN VIVO</span>
                 <span className="font-mono bg-black/60 text-emerald-300 px-1.5 py-0.5 rounded text-[11px] border border-emerald-500/40">
                   {formatTime(streamDuration)}
                 </span>
               </div>
             )}

             {/* BOTÓN DE TRANSMISIÓN EN VIVO A LA DERECHA */}
             {isStreaming ? (
               <button
                 onClick={handleStream}
                 className="px-3.5 py-1.5 rounded font-bold text-xs flex items-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 animate-pulse border border-red-500 transition-all"
                 title="Clic para Detener transmisión en vivo de inmediato"
               >
                 <Square size={13} className="fill-white" />
                 <span>DETENER EN VIVO</span>
               </button>
             ) : (
               <button
                 onClick={() => setShowStreamModal(true)}
                 className="px-4 py-1.5 rounded font-bold text-xs flex items-center gap-2 cursor-pointer bg-red-700 hover:bg-red-600 text-white shadow-md transition-all"
                 title="Configurar y comenzar transmisión en vivo a Facebook, YouTube, TikTok"
               >
                 <Wifi size={14} />
                 <span>TRANSMITIR EN VIVO</span>
               </button>
             )}
             {!isRightPanelOpen && <button onClick={() => setIsRightPanelOpen(true)} className="ml-2 p-1.5 bg-[#222] rounded text-gray-400 hover:text-white cursor-pointer"><PanelRight size={16} /></button>}
          </div>
        </div>

        {/* ÁREA DE MONITOREO Y SWITCHING (DUAL PVW/PGM O MASTER ÚNICO) */}
        <div className="flex-1 min-h-0 bg-black relative flex p-1.5 gap-2 overflow-hidden items-center justify-center">
          {dualMonitorMode && (
            <>
              {/* MONITOR PREVIEW (PVW) */}
              <div className="flex-1 h-full relative rounded-lg overflow-hidden flex flex-col bg-[#07090d] border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/20 select-none">
                {/* Header PVW con Tally Verde y Selector de Cámaras */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1612] border-b border-emerald-500/40 text-emerald-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                    <span className="text-[11px] font-black uppercase tracking-wider">PREVIEW (PVW)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {camSlots.map(cid => (
                      <button
                        key={`pvw-sel-${cid}`}
                        onClick={() => setPvwCam(cid)}
                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                          pvwCam === cid
                            ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                            : 'bg-[#15231c] text-emerald-300/70 hover:text-emerald-200 hover:bg-[#1e3228]'
                        }`}
                        title={`Seleccionar CAM ${cid} en Preview`}
                      >
                        CAM {cid}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video PVW */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
                  {getCamStream(pvwCam) ? (
                    <VideoTile
                      camId={pvwCam}
                      stream={getCamStream(pvwCam)}
                      label={null}
                      isLocal={pvwCam === 1}
                      muted={true}
                      style={getVideoStyle(pvwCam, true)}
                      chromaKey={chromaKeyActive}
                      bgImage={virtualBg}
                      className="w-full h-full"
                    />
                  ) : camThumbnails[pvwCam] ? (
                    <img src={camThumbnails[pvwCam]} className="w-full h-full object-cover" alt={`PVW CAM ${pvwCam}`} />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 w-full h-full bg-[#111]">
                      <Video size={28} className="mb-2 opacity-50" />
                      <span className="text-[10px] uppercase tracking-wider font-bold">CAM {pvwCam}</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold">
                    PRÓXIMA TOMA: CAM {pvwCam}
                  </div>
                </div>
              </div>

              {/* CONSOLA CENTRAL DE TRANSICIÓN: CUT, AUTO, T-BAR */}
              <div className="w-[110px] h-full flex flex-col items-center justify-between bg-[#0e1017] border border-[#232738] rounded-lg p-2 shadow-2xl shrink-0 select-none z-30">
                <div className="w-full text-center border-b border-[#202434] pb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Switcher</span>
                  <span className="text-[8px] text-amber-400 font-mono">T-Bar Mix</span>
                </div>

                {/* Botón CUT */}
                <button
                  type="button"
                  onClick={handleCutTransition}
                  className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 active:scale-95 transition-all border border-red-400 cursor-pointer"
                  title="Corte Directo Instantáneo (Conmuta PVW y PGM)"
                >
                  CUT
                </button>

                {/* Botón AUTO con Duración */}
                <button
                  type="button"
                  onClick={handleAutoTransition}
                  disabled={isTransitioning}
                  className={`w-full py-2.5 rounded-lg text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all border cursor-pointer ${
                    isTransitioning 
                      ? 'bg-amber-600 border-amber-300 animate-pulse' 
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-300 shadow-amber-500/30'
                  }`}
                  title="Disolvencia Automática (Mix suave)"
                >
                  {isTransitioning ? 'MIXING' : 'AUTO'}
                </button>

                {/* Selector de Tiempo de AUTO */}
                <div className="w-full grid grid-cols-3 gap-0.5 bg-[#161822] p-0.5 rounded border border-[#252a3a]">
                  {[300, 500, 1000].map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setTransitionDuration(dur)}
                      className={`text-[8.5px] py-0.5 rounded font-bold cursor-pointer ${
                        transitionDuration === dur
                          ? 'bg-amber-500 text-black'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {dur === 1000 ? '1s' : `${dur}m`}
                    </button>
                  ))}
                </div>

                {/* T-BAR VERTICAL BROADCAST INTERACTIVO */}
                <div className="flex-1 w-full flex flex-col items-center justify-center my-1.5 min-h-[140px]">
                  <span className="text-[8px] font-mono text-emerald-400 mb-0.5 font-bold">PVW</span>
                  <div className="h-28 flex items-center relative">
                    <input
                      type="range"
                      orient="vertical"
                      min="0"
                      max="1"
                      step="0.01"
                      value={tBarPosition}
                      onChange={(e) => handleTBarChange(parseFloat(e.target.value))}
                      className="h-24 w-6 cursor-pointer accent-orange-500 bg-[#161822] rounded appearance-none"
                      style={{ WebkitAppearance: 'slider-vertical' }}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-red-400 mt-0.5 font-bold">PGM</span>
                </div>

                <div className="w-full text-center pt-1 border-t border-[#202434]">
                  <span className="text-[8px] text-gray-400 font-mono">
                    {Math.round(tBarPosition * 100)}%
                  </span>
                </div>
              </div>
            </>
          )}

          {/* MONITOR PROGRAM (PGM) / PRINCIPAL */}
          <div 
            ref={masterMonitorRef}
            className={`flex-1 h-full relative rounded-lg overflow-hidden flex flex-col bg-[#050505] select-none ${
              dualMonitorMode 
                ? 'border-2 border-red-600/90 shadow-lg shadow-red-950/20' 
                : 'w-full border border-[#333]'
            } ${
              isDraggingMaster 
                ? 'cursor-grabbing' 
                : (((cameraCrops[activeCam - 1]?.zoom) || 1.0) > 1.01 ? 'cursor-grab' : 'cursor-default')
            }`}
            title="Pantalla Master: Gira la rueda del mouse para Zoom, y arrastra con clic izquierdo presionado para mover y centrar la toma como una ventana"
          >
            {dualMonitorMode && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a0e0e] border-b border-red-500/40 text-red-300 shrink-0 z-30">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_#ef4444]" />
                  <span className="text-[11px] font-black uppercase tracking-wider">PROGRAM (PGM) · AL AIRE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 text-[9px] font-bold bg-red-950/80 border border-red-600/60 text-red-200 rounded uppercase">
                    Layout: {layoutMode}
                  </span>
                  <span className="text-[10px] font-black text-white bg-red-600 px-2 py-0.2 rounded shadow">
                    CAM {activeCam}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden flex items-center justify-center p-1.5 bg-[#050505]">
              {/* CONTENEDOR MAESTRO BROADCAST CALIBRADO EXACTO (1080p / 16:9) */}
              <div
                className="relative h-full max-w-full max-h-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#222530] shadow-2xl flex-none"
                style={{ height: '100%', width: 'auto', aspectRatio: '16 / 9', maxWidth: '100%', maxHeight: '100%' }}
              >
                {renderMonitorLayout()}
                
                {countdown !== null && <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"><span className="text-white text-9xl font-bold animate-ping">{countdown}</span></div>}
              
              {/* CUADRÍCULA PROFESIONAL DE ENCUADRE Y REGLA DE TERCIOS */}
              {showMasterGrid && (
                <div className="absolute inset-0 pointer-events-none z-30 select-none">
                  {/* Líneas verticales regla de tercios */}
                  <div className="absolute top-0 bottom-0 left-1/3 w-px border-l border-dashed border-cyan-400/40"></div>
                  <div className="absolute top-0 bottom-0 left-2/3 w-px border-l border-dashed border-cyan-400/40"></div>
                  {/* Líneas horizontales regla de tercios */}
                  <div className="absolute left-0 right-0 top-1/3 h-px border-t border-dashed border-cyan-400/40"></div>
                  <div className="absolute left-0 right-0 top-2/3 h-px border-t border-dashed border-cyan-400/40"></div>
                  {/* Margen Seguro de Broadcast */}
                  <div className="absolute inset-[6%] border border-dotted border-cyan-300/35 rounded-sm"></div>
                  {/* Cruz central de centrado de rostro/toma */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/70"></div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/70"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-cyan-400/80"></div>
                  </div>
                  {/* Badge en esquina superior */}
                  <div className="absolute top-3 right-3 bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow pointer-events-none">
                    GUÍA DE ENCUADRE MASTER
                  </div>
                </div>
              )}
              
              {/* LOGO OFICIAL DEL PROYECTO O VIDEO 3D ANIMADO */}
              {isElectronMaster && (logoConfig.url || logoBase64) && (
                (() => {
                  const url = logoConfig.url || logoBase64;
                  const isVideo = logoConfig.mediaType === 'video' || (typeof url === 'string' && (url.startsWith('data:video') || url.match(/\.(mp4|webm|mov|mkv)($|\?)/i)));
                  const pos = logoConfig.position || 'top-left';
                  const scale = Math.max(0.4, Math.min(2.5, (logoConfig.scale || 100) / 100));
                  const opacity = Math.max(0.2, Math.min(1.0, (logoConfig.opacity || 100) / 100));

                  const posClasses = {
                    'top-left': 'top-4 left-4',
                    'top-right': 'top-4 right-4',
                    'bottom-left': 'bottom-16 left-4',
                    'bottom-right': 'bottom-16 right-4',
                  }[pos] || 'top-4 left-4';

                  const baseH = 64 * scale;

                  return isVideo ? (
                    <video
                      src={url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className={`absolute ${posClasses} z-30 drop-shadow-2xl pointer-events-none select-none transition-all duration-200`}
                      style={{ height: `${baseH}px`, maxWidth: '35%', opacity }}
                    />
                  ) : (
                    <img
                      src={url}
                      alt="Logo Oficial del Proyecto"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className={`absolute ${posClasses} z-30 drop-shadow-2xl object-contain pointer-events-none select-none transition-all duration-200`}
                      style={{ height: `${baseH}px`, maxWidth: '35%', opacity }}
                    />
                  );
                })()
              )}


              {/* v1.6.1: el cintillo ya NO se dibuja como overlay DOM sobre el
                  programa (era la copia «diseñada» que duplicaba al del
                  canvas). La única representación visible y emitida es la
                  que el motor dibuja en el canvas desde el estado
                  sincronizado (engineCintillo): monitor, grabación y
                  streaming muestran exactamente lo mismo. */}

              {/* TELEPROMPTER HUD SOBRE EL PROGRAMA (v3.2.1; reconstruido
                  en la v3.3.2): SOLO el texto en desplazamiento,
                  directamente encima de la cámara máster. Fondo
                  COMPLETAMENTE transparente: sin ventana, sin vidrio, sin
                  borde, sin barra ni controles (los controles viven solo
                  en el panel lateral). El montaje lo decide UNA sola
                  función pura sobre el ÚNICO estado del teleprompter —
                  debeMontarOverlayPrompter({ hudOn }) —: se monta si y
                  solo si el interruptor HUD está encendido, sin depender
                  de la sección activa del panel, de si el panel está
                  colapsado, de la fase del motor nativo ni de si se está
                  grabando. (Hasta la v3.3.1 el montaje tenía una segunda
                  compuerta invisible, «ocultar al grabar» siempre activa
                  y sin control, que lo suprimía en grabación aunque el
                  HUD estuviera encendido.) La franja NO es una franja
                  fija del contenedor: la proyección la coloca sobre la
                  REGIÓN REAL de la cámara de programa (el tile con
                  data-pgm-tile, medido en el DOM) en CUALQUIER modalidad
                  — una cámara, PiP o mosaico de 2/3/4+ — y el texto
                  entra por el borde INFERIOR de esa región y sube.
                  Comparte el reloj único con el recuadro del panel.
                  NUNCA A LA MEZCLA: esto es una capa DOM por encima del
                  monitor, fuera de todo canvas; la composición heredada
                  dibuja solo desde elementos <video> y el estado que la
                  app publica al motor de composición lleva el
                  teleprompter EXCLUIDO (ver la sincronización de estado:
                  teleprompterText '' e isTeleprompterPlaying false), y
                  el máster nativo es limpio por diseño (la tubería
                  GStreamer no ve el DOM). z-[45]: sobre los tiles, la
                  guía y el logo (z-30) y sobre el video compuesto del
                  monitor (z-40); bajo la cuenta atrás (z-50). */}
              {debeMontarOverlayPrompter({ hudOn: showFloatingPrompter }) && (
                  <div ref={teleprompterOverlayRef} className="absolute left-0 top-0 w-full h-full overflow-hidden z-[45] pointer-events-none">
                    <div
                      ref={teleprompterTextRef}
                      className="absolute top-0 w-[90%] left-[5%] text-center font-bold text-white whitespace-pre-wrap leading-relaxed"
                      style={{
                        textShadow: '2px 2px 6px rgba(0,0,0,0.9)',
                        fontSize: `${teleprompterFontSize}px`
                        // v3.2.4: SIN transform fijo. La posición la escribe
                        // projectTeleprompterOverlay() desde el reloj único
                        // al montar y en cada fotograma de la reproducción.
                      }}
                    >
                      {teleprompterText}
                    </div>
                  </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM MULTI-CAM BAR (CARRUSEL Y GRILLA ENVOLVENTE CON MÁXIMA VISIBILIDAD 100% Y SIN FRANJAS NEGRAS) */}
        <div 
          className="min-h-[148px] max-h-[305px] bg-[#0c0c0e] border-t border-[#222] px-3 py-2 flex items-start gap-2.5 overflow-y-auto overflow-x-hidden shrink-0 [scrollbar-width:thin] flex-wrap"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {camSlots.map((camId) => {
            const isActive = activeCam === camId;
            const isPvw = pvwCam === camId;
            const camStream = getCamStream(camId);
            const style = getVideoStyle(camId);
            return (
              <div 
                key={camId} 
                className={`w-[230px] h-[135px] rounded-xl border-2 flex flex-col shrink-0 relative group overflow-hidden transition-all shadow-md ${
                  isActive 
                    ? 'border-red-500 shadow-red-950/40 ring-1 ring-red-500/50' 
                    : (dualMonitorMode && isPvw ? 'border-emerald-500 shadow-emerald-950/40 ring-1 ring-emerald-500/50' : 'border-[#282828] hover:border-[#444] bg-[#080808]')
                }`}
              >
                {/* VIDEO A PANTALLA COMPLETA DENTRO DEL RECUADRO (SIN FRANJAS NEGRAS SÓLIDAS) */}
                <div 
                  className="absolute inset-0 w-full h-full cursor-pointer z-0 bg-[#080808]" 
                  onClick={() => {
                    if (dualMonitorMode) {
                      setPvwCam(camId);
                      if (!isElectronMaster) dispatchRemoteCommand('SET_PVW_CAM', { camId });
                    } else {
                      handleSelectMasterCam(camId);
                    }
                  }}
                  title={dualMonitorMode ? `Seleccionar CAM ${camId} en PREVIEW (PVW) · Clic en CUT para conmutar a PROGRAM` : `Seleccionar CAM ${camId} como Cámara Master`}
                >
                   {nativeReleasedPhotos[camId - 1] !== undefined ? (
                     /* v3.3.0 D2: cámara liberada al motor nativo — foto
                        fija + rótulo mientras la sesión siga activa. Si
                        la foto no se pudo capturar, el valor es null y
                        se muestra solo el rótulo (declarado). */
                     <div className="relative w-full h-full">
                       {nativeReleasedPhotos[camId - 1] ? (
                         <img src={nativeReleasedPhotos[camId - 1]} className="w-full h-full object-cover" alt={`CAM ${camId}`} />
                       ) : null}
                       <div className="absolute inset-x-0 bottom-7 flex justify-center pointer-events-none">
                         <span className="px-2 py-0.5 rounded bg-cyan-950/85 border border-cyan-500/50 text-cyan-200 text-[9px] font-black tracking-wider uppercase">En el motor nativo</span>
                       </div>
                     </div>
                   ) : camStream ? (
                     /* v3.3.3 (defecto B): presentación sin deformar — una
                        fuente REMOTA se muestra con objectFit 'contain'
                        (fotograma completo: el recorte 'cover' con el
                        sensor 4:3 del teléfono presentado en 16:9 recorta
                        y «acerca» la imagen — diagnóstico del 2026-11-12);
                        las locales conservan su 'cover' de siempre. El
                        mosaico NO alimenta la composición (eso va por el
                        feed de programa / el motor nativo), así que su
                        ajuste de presentación no entra a la grabación. */
                     <VideoTile camId={camId} registerWithEngine frozen={!!frozenCams[camId]} stream={camStream} isLocal={camId === 1} muted={camSpeakerMuted[camId] !== false} objectFit={(cameraMeta[camId - 1]?.type === 'remote' || cameraMeta[camId - 1]?.type === 'mobile' || remoteCams.some(r => r.stream === camStream)) ? 'contain' : 'cover'} className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" style={style} chromaKey={chromaKeyActive} bgImage={virtualBg} />
                   ) : camThumbnails[camId] ? (
                     <img src={camThumbnails[camId]} className="w-full h-full object-cover" alt={`CAM ${camId}`} />
                   ) : (!isElectronMaster && isActive) ? (
                     <PgmFeedCanvas className="w-full h-full object-cover opacity-85" />
                   ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center bg-[#101014] text-gray-500 font-mono text-[11px]">
                       <Video size={18} className={`mb-1 ${isActive ? 'text-red-400 opacity-80' : 'text-gray-600 opacity-40'}`} />
                       <span className="font-bold">CAM {camId}</span>
                     </div>
                   )}

                    {/* MINI RÓTULO DE NOMBRE SOBRE EL VIDEO EN LA MINIATURA */}
                    {cameraBadges[camId]?.enabled && cameraBadges[camId]?.name && (
                      <div 
                        className={`absolute z-10 px-1.5 py-0.5 rounded bg-slate-950/85 border border-white/20 text-white font-bold text-[8.5px] leading-tight shadow-md pointer-events-none select-none max-w-[85%] truncate ${
                          cameraBadges[camId].position === 'bottom-right' ? 'bottom-7 right-1.5' :
                          cameraBadges[camId].position === 'top-left' ? 'top-6 left-1.5' :
                          cameraBadges[camId].position === 'top-right' ? 'top-6 right-1.5' :
                          'bottom-7 left-1.5'
                        }`}
                      >
                        {cameraBadges[camId].name}
                      </div>
                    )}
                </div>

                {/* BARRA SUPERIOR FLOTANTE TRASLÚCIDA (CASI IMPERCEPTIBLE, 100% VISIBILIDAD) */}
                <div className="absolute top-0 inset-x-0 z-20 flex justify-between items-center px-1.5 py-1 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-auto select-none gap-1">
                  {/* CAM IDENTIFIER CON TALLY BROADCAST + BOTÓN DE MICRÓFONO Y BOCINA (SIEMPRE VISIBLES Y CLICABLES) */}
                  <div className="flex items-center gap-1 shrink-0 drop-shadow">
                    <span className={`text-[10px] font-black ${isActive ? 'text-red-400' : (dualMonitorMode && isPvw ? 'text-emerald-400' : 'text-gray-200')}`}>
                      CAM {camId}
                    </span>
                    {isActive ? (
                      <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[8px] font-black tracking-wider uppercase shadow-sm">
                        PGM
                      </span>
                    ) : (dualMonitorMode && isPvw ? (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black tracking-wider uppercase shadow-sm">
                        PVW
                      </span>
                    ) : null)}

                    {/* BOTÓN MICRÓFONO CON VU-METER - SIEMPRE VISIBLE Y CLICABLE */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMuteCam(camId);
                      }}
                      className={`px-1.5 py-0.5 rounded flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                        camMuted[camId]
                          ? 'bg-red-950/90 text-red-400 border border-red-600/80 shadow-sm'
                          : 'bg-black/60 hover:bg-[#222] text-emerald-400 border border-emerald-500/70 shadow-sm'
                      }`}
                      title={
                        camMuted[camId]
                          ? `Micrófono CAM ${camId} SILENCIADO · Clic para activar micrófono`
                          : `Micrófono CAM ${camId} ACTIVO · Clic para silenciar`
                      }
                    >
                      {camMuted[camId] ? (
                        <>
                          <MicOff size={10} className="text-red-400 shrink-0" />
                          <span className="text-[7.5px] font-bold text-red-400">MUTE</span>
                        </>
                      ) : (
                        <>
                          <Mic size={10} className="text-emerald-400 shrink-0" />
                          {/* VUMETRO DE PERCEPCIÓN DE AUDIO */}
                          <div className="w-5 h-1 bg-[#141414] rounded-full overflow-hidden flex items-center border border-[#2a2a2a] shrink-0">
                            <div 
                              className={`h-full rounded-full transition-all duration-75 ${
                                (camAudioLevels[camId]?.level || 0) > 70
                                  ? 'bg-red-500'
                                  : (camAudioLevels[camId]?.level || 0) > 35
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-400'
                              }`} 
                              style={{ width: `${Math.max(10, camAudioLevels[camId]?.level || 0)}%` }} 
                            />
                          </div>
                        </>
                      )}
                    </button>

                    {/* BOTÓN DE BOCINA DE RETORNO / MONITOREO LOCAL */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSpeakerCam(camId);
                      }}
                      className={`p-1 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                        camSpeakerMuted[camId]
                          ? 'bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-600/60 shadow-sm'
                          : 'bg-black/60 text-emerald-400 hover:bg-[#222] border border-emerald-500/70 shadow-sm'
                      }`}
                      title={
                        camSpeakerMuted[camId]
                          ? `Bocina local de CAM ${camId} SILENCIADA · Clic para escuchar en altavoces`
                          : `Bocina local de CAM ${camId} ACTIVA · Clic para silenciar en tus altavoces`
                      }
                    >
                      {camSpeakerMuted[camId] ? (
                        <VolumeX size={11} className="text-red-400 shrink-0" />
                      ) : (
                        <Volume2 size={11} className="text-emerald-400 shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* HERRAMIENTAS Y ACCIONES DE CÁMARA */}
                  <div className="flex items-center gap-0.5 shrink-0 drop-shadow">
                    {/* BOTÓN CONEXIONES (USB / WIFI / QR) */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConnectModalSlot(camId - 1); setShowConnectModal(true); }} 
                      className="text-gray-300 hover:text-orange-400 hover:bg-black/60 rounded p-1 transition-colors" 
                      title="Configurar Entrada de Video (USB / WiFi IP / QR Celular)"
                    >
                      <Video size={11} />
                    </button>

                    {/* BOTÓN ENGRANE DE CONFIGURACIÓN Y CALIBRACIÓN COMPLETA */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openCalibrator(camId); }} 
                      className="text-gray-300 hover:text-white hover:bg-black/60 rounded p-1 transition-colors" 
                      title="Configuración y Ajustes de Cámara (Zoom, Enfoque, LUTs, Color, Guías)"
                    >
                      <Settings size={11} />
                    </button>

                    {/* BOTÓN BLOQUEO DE ENFOQUE (ANTI-DESENFOQUE PARA MANOS Y ROSTRO)
                        v1.7.0 (Raíz D): el estado que se pinta es el CONFIRMADO
                        por la pista; si la cámara no expone control de foco, el
                        botón se marca en rojo y el título lo dice, sin fingir. */}
                    {camStream && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFocusLock(camId); }}
                        className={`p-1 rounded transition-colors ${
                          camFocusStatus[camId]?.supported === false
                            ? 'text-red-400 bg-red-950/70 hover:bg-red-900 border border-red-500/60'
                            : camFocusLocked[camId]
                              ? 'text-amber-400 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50'
                              : 'text-gray-300 hover:text-amber-300 hover:bg-black/60'
                        }`}
                        title={
                          camFocusStatus[camId]?.supported === false
                            ? camFocusStatus[camId].message
                            : camFocusStatus[camId]?.message
                              ? `${camFocusStatus[camId].message} · Clic para ${camFocusLocked[camId] ? 'reactivar auto-enfoque' : 'bloquear enfoque'}`
                              : camFocusLocked[camId] ? 'Enfoque BLOQUEADO (confirmado por la cámara) · Clic para reactivar auto-enfoque' : 'Bloquear enfoque en tu posición actual (Evita que desenfoque cuando muevas las manos o el cuerpo)'
                        }
                      >
                        {camFocusLocked[camId] ? <Lock size={11} className="text-amber-400" /> : <Focus size={11} />}
                      </button>
                    )}

                    {/* BOTÓN RÓTULO DE NOMBRE (ESTILO RESTREAM / INVITADOS / CLASES) */}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setBadgeModalSlot(camId); 
                        setShowBadgeModal(true); 
                      }} 
                      className={`p-1 rounded transition-colors ${
                        cameraBadges[camId]?.enabled && cameraBadges[camId]?.name
                          ? 'text-orange-400 bg-orange-950/60 hover:bg-orange-900/80 border border-orange-500/40' 
                          : 'text-gray-300 hover:text-orange-400 hover:bg-black/60'
                      }`} 
                      title={
                        cameraBadges[camId]?.enabled && cameraBadges[camId]?.name
                          ? `Rótulo activo: "${cameraBadges[camId].name}" (${cameraBadges[camId].position || 'abajo-izq'}) · Clic para editar`
                          : `Asignar Rótulo de Nombre a CAM ${camId} (Invitado / Profesor / Alumno)`
                      }
                    >
                      <Tag size={11} />
                    </button>

                    {/* BOTÓN BOTE DE BASURA / APAGAR / DESCONECTAR / ELIMINAR CÁMARA */}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDeleteOrDisconnectCam(camId); 
                      }} 
                      className="text-gray-300 hover:text-red-400 hover:bg-red-500/20 rounded p-1 transition-colors" 
                      title={camStream ? `Apagar y desconectar señal de CAM ${camId}` : (camId !== 1 ? `Eliminar ranura de CAM ${camId}` : `Restablecer señal de CAM ${camId}`)}
                    >
                      <Trash2 size={11} className={camStream ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-red-400"} />
                    </button>
                  </div>
                </div>

                {/* BARRA INFERIOR FLOTANTE TRASLÚCIDA (BOTONES FLOTANTES SIN FRANJA SÓLIDA) */}
                <div className="absolute bottom-0 inset-x-0 z-20 flex items-center px-1.5 py-1 bg-gradient-to-t from-black/80 via-black/30 to-transparent gap-1 pointer-events-auto select-none">
                  {dualMonitorMode ? (
                    <>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setPvwCam(camId); 
                          if (!isElectronMaster) dispatchRemoteCommand('SET_PVW_CAM', { camId });
                        }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          isPvw ? 'bg-emerald-600 text-white shadow-sm' : 'bg-black/50 text-emerald-400/90 hover:bg-black/80 hover:text-emerald-200 border border-emerald-900/30'
                        }`}
                        title={`Poner CAM ${camId} en PREVIEW`}
                      >
                        PVW
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSelectMasterCam(camId); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          isActive ? 'bg-red-600 text-white shadow-sm' : 'bg-black/50 text-red-400/90 hover:bg-black/80 hover:text-red-200 border border-red-900/30'
                        }`}
                        title={`Poner CAM ${camId} directamente en PROGRAM (Al Aire)`}
                      >
                        PGM
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTogglePip(camId); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          layoutMode === 'pip' && pipCam === camId 
                            ? 'bg-orange-600 text-white shadow-sm' 
                            : 'bg-black/50 text-gray-300 hover:bg-black/80 hover:text-white border border-white/10'
                        }`}
                        title={`Colocar CAM ${camId} en recuadro PiP`}
                      >
                        PIP
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTogglePip(camId); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          layoutMode === 'pip' && pipCam === camId 
                            ? 'bg-orange-600 text-white shadow-sm' 
                            : 'bg-black/50 text-gray-300 hover:bg-black/80 hover:text-white border border-white/10'
                        }`}
                        title={`Colocar CAM ${camId} en recuadro PiP`}
                      >
                        PIP
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLayoutMode('2'); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          layoutMode === '2' ? 'bg-orange-600 text-white' : 'bg-black/50 text-gray-300 hover:bg-black/80 hover:text-white border border-white/10'
                        }`}
                        title="Modo pantalla dividida 2 cámaras"
                      >
                        2
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLayoutMode('3'); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          layoutMode === '3' ? 'bg-orange-600 text-white' : 'bg-black/50 text-gray-300 hover:bg-black/80 hover:text-white border border-white/10'
                        }`}
                        title="Modo pantalla 3 cámaras"
                      >
                        3
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLayoutMode('4'); }} 
                        className={`flex-1 text-[9px] py-0.5 rounded font-bold backdrop-blur-[2px] transition-all ${
                          layoutMode === '4' ? 'bg-orange-600 text-white' : 'bg-black/50 text-gray-300 hover:bg-black/80 hover:text-white border border-white/10'
                        }`}
                        title="Modo cuadrícula 4 cámaras"
                      >
                        4
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {/* BOTÓN + CÁMARA (SIEMPRE DISPONIBLE Y VISIBLE, ENVUELVE ABAJO SI SE LLENA LA FILA) */}
          <button 
            onClick={addCam} 
            disabled={camSlots.length >= 12}
            className={`w-[210px] h-[130px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center shrink-0 transition-all ${
              camSlots.length >= 12
                ? 'border-[#222] bg-[#0a0a0a] text-gray-600 cursor-not-allowed opacity-40'
                : 'border-[#333] hover:border-orange-500/70 bg-[#0c0c0e]/80 hover:bg-[#161618] text-gray-400 hover:text-white cursor-pointer shadow-sm group'
            }`}
            title={camSlots.length >= 12 ? 'Límite máximo de 12 cámaras alcanzado' : `Agregar ranura para CAM ${camSlots.length + 1}`}
          >
            <div className={`p-2 rounded-full mb-1.5 transition-transform group-hover:scale-110 ${camSlots.length >= 12 ? 'bg-[#181818] text-gray-600' : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'}`}>
              <Plus size={20} />
            </div>
            <span className="text-[11.5px] font-black tracking-wider uppercase">
              {camSlots.length >= 12 ? 'MÁXIMO 12 CAMS' : `+ CÁMARA ${camSlots.length + 1}`}
            </span>
            <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">({camSlots.length}/12 ranuras)</span>
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      {isRightPanelOpen && (
        <div className={`bg-[#111] border-l border-[#222] flex flex-col z-20 shrink-0 transition-all duration-300 ${isRightPanelCollapsed ? 'w-[50px]' : 'w-[290px] xl:w-[350px]'}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#0a0a0a]">
            {!isRightPanelCollapsed && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estudio Broadcast</span>}
            <div className={`flex items-center gap-1 ${isRightPanelCollapsed ? 'mx-auto flex-col' : 'ml-auto'}`}>
              <button onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)} className="p-1.5 text-gray-500 hover:text-white hover:bg-[#222] rounded">{isRightPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</button>
              <button onClick={() => setIsRightPanelOpen(false)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-[#222] rounded"><X size={14} /></button>
            </div>
          </div>

          {!isRightPanelCollapsed && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

              {/* CARD: LOGO OFICIAL DEL PROYECTO O VIDEO 3D ANIMADO */}
              <div className="border border-[#222] rounded bg-[#161616] p-2.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-orange-500" /> Logo Oficial / Video 3D
                  </span>
                  {(logoConfig.url || logoBase64) && (
                    <span className="text-[9px] bg-green-900/60 text-green-300 font-bold px-1.5 py-0.5 rounded border border-green-700/40">
                      {logoConfig.mediaType === 'video' ? '🎬 3D Video Activo' : '🖼️ Imagen Activa'}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">
                  Sube tu logo en imagen (PNG, JPG, WebP) o en video animado 3D (MP4, WebM transparente). Ajusta esquina y tamaño libremente.
                </p>

                <div className="flex gap-2 items-center">
                  <label className="flex-1 bg-[#222] hover:bg-[#2c2c2c] text-xs text-center py-1.5 rounded cursor-pointer flex items-center justify-center gap-1.5 border border-[#444] text-gray-200 font-bold transition-colors">
                    <Upload size={12}/> {(logoConfig.url || logoBase64) ? 'Cambiar Logo / Video 3D' : 'Subir Logo / Video 3D'}
                    <input 
                      type="file" 
                      accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" 
                      className="hidden" 
                      onChange={handleLogoUpload} 
                    />
                  </label>
                  {(logoConfig.url || logoBase64) && (
                    <button 
                      onClick={handleRemoveLogo} 
                      className="p-1.5 bg-[#222] hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded border border-[#333]" 
                      title="Quitar logo o video"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* CONTROLES DE ESQUINA, TAMAÑO Y OPACIDAD */}
                {(logoConfig.url || logoBase64) && (
                  <div className="bg-[#0f0f11] p-2 rounded border border-[#26262a] space-y-2 mt-1">
                    {/* SELECTOR DE ESQUINAS */}
                    <div>
                      <span className="text-[9.5px] font-semibold text-gray-400 block mb-1">Ubicación / Esquina:</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'top-left', label: '↖ Arriba Izq' },
                          { id: 'top-right', label: '↗ Arriba Der' },
                          { id: 'bottom-left', label: '↙ Abajo Izq' },
                          { id: 'bottom-right', label: '↘ Abajo Der' },
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => handleUpdateLogoSetting('position', pos.id)}
                            className={`text-[10px] py-1 px-1.5 rounded font-bold border transition-all ${
                              (logoConfig.position || 'top-left') === pos.id
                                ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                                : 'bg-[#18181c] border-[#2c2c34] text-gray-400 hover:text-white hover:bg-[#202026]'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TAMAÑO / ESCALA */}
                    <div>
                      <div className="flex justify-between items-center text-[9.5px] text-gray-400 mb-1">
                        <span>Tamaño / Escala</span>
                        <span className="font-bold text-orange-400">{logoConfig.scale || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="220"
                        step="5"
                        value={logoConfig.scale || 100}
                        onChange={(e) => handleUpdateLogoSetting('scale', parseInt(e.target.value, 10))}
                        className="w-full accent-orange-500 h-1 bg-[#222] rounded cursor-pointer"
                      />
                    </div>

                    {/* OPACIDAD */}
                    <div>
                      <div className="flex justify-between items-center text-[9.5px] text-gray-400 mb-1">
                        <span>Opacidad</span>
                        <span className="font-bold text-gray-300">{logoConfig.opacity ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={logoConfig.opacity ?? 100}
                        onChange={(e) => handleUpdateLogoSetting('opacity', parseInt(e.target.value, 10))}
                        className="w-full accent-orange-500 h-1 bg-[#222] rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL 1: CINTILLOS & GRÁFICOS BROADCAST */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('cintillos')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors">
                  <span className="flex items-center gap-2 font-bold text-white"><Type size={15} className="text-orange-500"/> Cintillos & Gráficos TV</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${cintillosVisible && cintillo?.active ? 'bg-orange-600 text-white' : 'bg-[#222] text-gray-400'}`}>
                      {cintillosVisible && cintillo?.active ? 'AL AIRE' : 'Oculto'}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${activePanel === 'cintillos' ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {activePanel === 'cintillos' && (
                  <div className="p-3 border-t border-[#222] bg-[#0f0f0f] space-y-3">
                    
                    {/* SWITCHES PRINCIPALES */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                        <span className="text-[11px] font-bold text-gray-200">En Pantalla</span>
                        <input 
                          type="checkbox" 
                          checked={cintillosVisible} 
                          onChange={e => {
                            setCintillosVisible(e.target.checked);
                            if (e.target.checked && !cintillo.active) showManual('host');
                          }} 
                          className="accent-orange-500 w-4 h-4 cursor-pointer" 
                        />
                      </div>
                      <div className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded border border-[#2a2a2a]">
                        <span className="text-[11px] font-bold text-gray-200">Rotación Auto</span>
                        <input 
                          type="checkbox" 
                          checked={autoRotateCintillos} 
                          onChange={e => {
                            const val = e.target.checked;
                            setAutoRotateCintillos(val);
                            if (val) {
                              setCintillosVisible(true);
                            }
                          }} 
                          className="accent-orange-500 w-4 h-4 cursor-pointer" 
                          title="Rotar automáticamente tema, invitado, conductor y redes uno por uno"
                        />
                      </div>
                    </div>

                    {autoRotateCintillos && (
                      <div className="flex items-center justify-between bg-[#18181b] px-3 py-2 rounded-lg border border-[#2e2e33] text-[11px] mb-3">
                        <span className="text-gray-300 font-semibold">Modo de pase:</span>
                        <div className="flex items-center gap-1.5 bg-[#101012] p-1 rounded-md border border-[#333]">
                          <button
                            type="button"
                            onClick={() => setRandomRotateCintillos(false)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              !randomRotateCintillos
                                ? 'bg-orange-500 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                            }`}
                            title="Pasa los cintillos uno por uno en orden secuencial"
                          >
                            Uno por Uno
                          </button>
                          <button
                            type="button"
                            onClick={() => setRandomRotateCintillos(true)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              randomRotateCintillos
                                ? 'bg-orange-500 text-white shadow'
                                : 'text-gray-400 hover:text-white'
                            }`}
                            title="Pasa los cintillos de forma aleatoria"
                          >
                            Aleatorio
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SELECTOR DE ESTILOS (13 ESTILOS BROADCAST EN ESPAÑOL) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Estilo Visual (13 Estilos TV)</label>
                        <span className="text-[10px] text-orange-400 font-semibold">{getCintilloStyle(cintilloStyle)?.name}</span>
                      </div>
                      <select 
                        value={cintilloStyle} 
                        onChange={e => setCintilloStyle(e.target.value)} 
                        className="w-full bg-[#18181b] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-orange-500"
                      >
                        {CINTILLO_STYLES.map(s => (
                          <option key={s.id} value={s.id}>{s.name} — {s.desc.slice(0, 36)}</option>
                        ))}
                      </select>
                    </div>

                    {/* POSICIÓN EN PANTALLA */}
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">Posición en Pantalla</label>
                      <div className="grid grid-cols-6 gap-1">
                        {[
                          { id: 'bl', label: 'Ab. Izq' },
                          { id: 'bc', label: 'Ab. Ctr' },
                          { id: 'br', label: 'Ab. Der' },
                          { id: 'tl', label: 'Ar. Izq' },
                          { id: 'tc', label: 'Ar. Ctr' },
                          { id: 'tr', label: 'Ar. Der' },
                        ].map(pos => (
                          <button
                            key={pos.id}
                            onClick={() => setCintilloPosition(pos.id)}
                            className={`py-1 text-[9px] font-bold rounded border transition-colors ${cintilloPosition === pos.id ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white'}`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SELECTOR DE PERFIL ACTIVO AL AIRE (CONDUCTOR VS INVITADO) */}
                    <div className="pt-2 border-t border-[#2a2a2a]">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-gray-300">
                          Perfil y Variables al Aire:
                        </label>
                        <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border ${
                          socialTarget === 'guest' 
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50' 
                            : 'bg-orange-950 text-orange-400 border-orange-500/50'
                        }`}>
                          {socialTarget === 'guest' ? 'MODO INVITADOS' : 'MODO CONDUCTORES'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#14151b] rounded-lg border border-[#272a36] mb-2.5">
                        <button
                          type="button"
                          onClick={() => switchSocialTarget('program')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            socialTarget === 'program' 
                              ? 'bg-orange-600 text-white shadow-md shadow-orange-900/30' 
                              : 'text-gray-400 hover:text-white hover:bg-[#20222b]'
                          }`}
                        >
                          <Mic size={13} />
                          <span>🎙️ Conductores ({conductores.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => switchSocialTarget('guest')}
                          className={`py-1.5 px-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            socialTarget === 'guest' 
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' 
                              : 'text-gray-400 hover:text-white hover:bg-[#20222b]'
                          }`}
                        >
                          <Users size={13} />
                          <span>👤 Invitados ({invitados.length})</span>
                        </button>
                      </div>

                      {/* CAMPOS VARIABLES EDITABLES EN VIVO SEGÚN EL PERFIL SELECCIONADO */}
                      {socialTarget === 'program' ? (
                        <div className="p-2.5 rounded-lg bg-[#181512] border border-orange-500/40 space-y-2.5 animate-fadeIn">
                          {/* PESTAÑAS DE CONDUCTORES (2, 3, 4 O MÁS) */}
                          <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                            {conductores.map((c, idx) => (
                              <button
                                key={c.id || idx}
                                type="button"
                                onClick={() => setActiveConductorIdx(idx)}
                                className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 ${
                                  activeConductorIdx === idx
                                    ? 'bg-orange-600 text-white border border-orange-400'
                                    : 'bg-[#221c17] text-orange-300 hover:bg-[#2e241c] border border-orange-900/40'
                                }`}
                              >
                                <span>🎤 {c.name ? c.name.split(' ')[0] : `Cond ${idx + 1}`}</span>
                                {conductores.length > 1 && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeConductor(idx);
                                    }}
                                    className="ml-1 text-orange-200 hover:text-red-400 text-[10px]"
                                    title="Eliminar conductor"
                                  >
                                    ×
                                  </span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={addConductor}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-[#1e2029] hover:bg-[#282b37] text-orange-400 border border-dashed border-orange-500/50 shrink-0 transition-colors"
                              title="Agregar otro conductor a la mesa"
                            >
                              + Conductor
                            </button>
                          </div>

                          <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Conductor #{activeConductorIdx + 1} de {conductores.length}</span>
                            <span className="text-[9px] text-orange-400/80 font-normal">Editando perfil activo</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-orange-300 block mb-0.5">NOMBRE CONDUCTOR</label>
                              <input 
                                type="text" 
                                value={conductores[activeConductorIdx]?.name || ''} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setConductores(prev => prev.map((c, i) => i === activeConductorIdx ? { ...c, name: val } : c));
                                }} 
                                placeholder="Nombre Conductor" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1.5 text-xs text-white outline-none focus:border-orange-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 block mb-0.5">ROL / CARGO</label>
                              <input 
                                type="text" 
                                value={conductores[activeConductorIdx]?.role || ''} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setConductores(prev => prev.map((c, i) => i === activeConductorIdx ? { ...c, role: val } : c));
                                }} 
                                placeholder="Conductor & Productor" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1.5 text-xs text-white outline-none focus:border-orange-500" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[9px] font-bold text-pink-400 flex items-center gap-1 mb-0.5"><Instagram size={10} /> INSTAGRAM</label>
                              <input 
                                type="text" 
                                value={socialInstagram} 
                                onChange={e => setSocialInstagram(e.target.value)} 
                                placeholder="@canal_oficial" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1 text-xs text-white outline-none focus:border-pink-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-red-400 flex items-center gap-1 mb-0.5"><Youtube size={10} /> YOUTUBE</label>
                              <input 
                                type="text" 
                                value={socialYoutube} 
                                onChange={e => setSocialYoutube(e.target.value)} 
                                placeholder="@canal_oficial" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1 text-xs text-white outline-none focus:border-red-500" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-cyan-400 flex items-center gap-1 mb-0.5"><Music size={10} /> TIKTOK</label>
                              <input 
                                type="text" 
                                value={socialTiktok} 
                                onChange={e => setSocialTiktok(e.target.value)} 
                                placeholder="@canal_oficial" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1 text-xs text-white outline-none focus:border-cyan-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-blue-400 flex items-center gap-1 mb-0.5"><Facebook size={10} /> FACEBOOK</label>
                              <input 
                                type="text" 
                                value={socialFacebook} 
                                onChange={e => setSocialFacebook(e.target.value)} 
                                placeholder="/canal_oficial" 
                                className="w-full bg-[#121110] border border-[#3a2e26] rounded p-1 text-xs text-white outline-none focus:border-blue-500" 
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-[#0e1714] border border-emerald-500/50 space-y-2.5 animate-fadeIn">
                          {/* PESTAÑAS DE INVITADOS (1, 2, 3 O MÁS) */}
                          <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                            {invitados.map((inv, idx) => (
                              <button
                                key={inv.id || idx}
                                type="button"
                                onClick={() => setActiveInvitadoIdx(idx)}
                                className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 ${
                                  activeInvitadoIdx === idx
                                    ? 'bg-emerald-600 text-white border border-emerald-400'
                                    : 'bg-[#12221b] text-emerald-300 hover:bg-[#1a3026] border border-emerald-900/40'
                                }`}
                              >
                                <span>👤 {inv.name ? inv.name.split(' ')[0] : `Inv ${idx + 1}`}</span>
                                {invitados.length > 1 && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeInvitado(idx);
                                    }}
                                    className="ml-1 text-emerald-200 hover:text-red-400 text-[10px]"
                                    title="Eliminar invitado"
                                  >
                                    ×
                                  </span>
                                )}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={addInvitado}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-[#1e2029] hover:bg-[#282b37] text-emerald-400 border border-dashed border-emerald-500/50 shrink-0 transition-colors"
                              title="Agregar otro invitado al programa"
                            >
                              + Invitado
                            </button>
                          </div>

                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Invitado #{activeInvitadoIdx + 1} de {invitados.length}</span>
                            <span className="text-[9px] text-emerald-400/80 font-normal">Editando perfil activo</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-emerald-300 block mb-0.5">NOMBRE INVITADO</label>
                              <input 
                                type="text" 
                                value={invitados[activeInvitadoIdx]?.name || ''} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setInvitados(prev => prev.map((g, i) => i === activeInvitadoIdx ? { ...g, name: val } : g));
                                }} 
                                placeholder="Nombre Invitado" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 block mb-0.5">ESPECIALIDAD / ROL</label>
                              <input 
                                type="text" 
                                value={invitados[activeInvitadoIdx]?.role || ''} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setInvitados(prev => prev.map((g, i) => i === activeInvitadoIdx ? { ...g, role: val } : g));
                                }} 
                                placeholder="Especialista / Cargo" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[9px] font-bold text-pink-400 flex items-center gap-1 mb-0.5"><Instagram size={10} /> INSTAGRAM</label>
                              <input 
                                type="text" 
                                value={guestInstagram} 
                                onChange={e => setGuestInstagram(e.target.value)} 
                                placeholder="@usuario_invitado" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1 text-xs text-white outline-none focus:border-pink-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-red-400 flex items-center gap-1 mb-0.5"><Youtube size={10} /> YOUTUBE</label>
                              <input 
                                type="text" 
                                value={guestYoutube} 
                                onChange={e => setGuestYoutube(e.target.value)} 
                                placeholder="@canal_invitado" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1 text-xs text-white outline-none focus:border-red-500" 
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-cyan-400 flex items-center gap-1 mb-0.5"><Music size={10} /> TIKTOK</label>
                              <input 
                                type="text" 
                                value={guestTiktok} 
                                onChange={e => setGuestTiktok(e.target.value)} 
                                placeholder="@tiktok_invitado" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1 text-xs text-white outline-none focus:border-cyan-500" 
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-blue-400 flex items-center gap-1 mb-0.5"><Facebook size={10} /> FACEBOOK</label>
                              <input 
                                type="text" 
                                value={guestFacebook} 
                                onChange={e => setGuestFacebook(e.target.value)} 
                                placeholder="/facebook_invitado" 
                                className="w-full bg-[#0a120f] border border-[#1f362c] rounded p-1 text-xs text-white outline-none focus:border-blue-500" 
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TEMA DEL EPISODIO GLOBAL */}
                      <div className="mt-2.5">
                        <label className="text-[9.5px] font-bold text-blue-400 block mb-0.5 tracking-wide">
                          TEMA PRINCIPAL DEL EPISODIO
                        </label>
                        <input 
                          type="text" 
                          value={topic} 
                          onChange={e => setTopic(e.target.value)} 
                          placeholder="Tema o titular del programa de hoy" 
                          className="w-full bg-[#18181b] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" 
                        />
                      </div>
                    </div>

                    {/* LANZAMIENTO RÁPIDO DE PRESETS AL AIRE (MULTI-CONDUCTOR & MULTI-INVITADO) */}
                    <div className="pt-2 border-t border-[#2a2a2a]">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                          Lanzamiento Rápido 1-Clic al Aire:
                        </label>
                      </div>

                      {/* BOTONES DIRECTOS PARA CADA CONDUCTOR */}
                      <div className="mb-2">
                        <div className="text-[9px] font-bold text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Mic size={10} /> Conductores en vivo ({conductores.length}):
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {conductores.map((c, idx) => (
                            <button
                              key={`launch-cond-${idx}`}
                              type="button"
                              onClick={() => triggerConductorCintillo(idx)}
                              className="p-1.5 bg-[#1e1510] hover:bg-[#2b1c13] border border-orange-600/50 hover:border-orange-500 rounded text-[10px] font-bold flex items-center justify-between text-orange-300 cursor-pointer shadow-sm transition-all"
                              title={`Lanzar cintillo de ${c.name} al aire`}
                            >
                              <span className="truncate">🎤 {c.name || `Conductor ${idx + 1}`}</span>
                              <span className="text-[9px] text-orange-400 font-extrabold bg-orange-950/70 px-1 py-0.2 rounded border border-orange-500/30 shrink-0">
                                C{idx + 1}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* BOTONES DIRECTOS PARA CADA INVITADO */}
                      {invitados.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Users size={10} /> Invitados Especiales ({invitados.length}):
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {invitados.map((inv, idx) => (
                              <button
                                key={`launch-inv-${idx}`}
                                type="button"
                                onClick={() => triggerInvitadoCintillo(idx)}
                                className="p-1.5 bg-[#0e1c16] hover:bg-[#152a21] border border-emerald-600/50 hover:border-emerald-500 rounded text-[10px] font-bold flex items-center justify-between text-emerald-300 cursor-pointer shadow-sm transition-all"
                                title={`Lanzar cintillo de ${inv.name} al aire`}
                              >
                                <span className="truncate">👤 {inv.name || `Invitado ${idx + 1}`}</span>
                                <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-950/70 px-1 py-0.2 rounded border border-emerald-500/30 shrink-0">
                                  I{idx + 1}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TEMAS Y REDES */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#222]">
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('topic'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-blue-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-blue-400 cursor-pointer"
                        >
                          💡 Tema
                        </button>
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('social_youtube'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-red-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-red-400 cursor-pointer" 
                          title={`Lanzar YouTube (${socialTarget === 'guest' ? 'Invitado' : 'Conductor'})`}
                        >
                          <Youtube size={12} className="text-red-500" /> YouTube
                        </button>
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('social_instagram'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-pink-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-pink-400 cursor-pointer" 
                          title={`Lanzar Instagram (${socialTarget === 'guest' ? 'Invitado' : 'Conductor'})`}
                        >
                          <Instagram size={12} className="text-pink-500" /> Instagram
                        </button>
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('social_tiktok'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-cyan-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-cyan-400 cursor-pointer" 
                          title={`Lanzar TikTok (${socialTarget === 'guest' ? 'Invitado' : 'Conductor'})`}
                        >
                          <Music size={12} className="text-cyan-400" /> TikTok
                        </button>
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('social_facebook'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-blue-600/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-blue-500 cursor-pointer" 
                          title={`Lanzar Facebook (${socialTarget === 'guest' ? 'Invitado' : 'Conductor'})`}
                        >
                          <Facebook size={12} className="text-blue-500" /> Facebook
                        </button>
                        <button 
                          onClick={() => { setCintillosVisible(true); showManual('contact'); }} 
                          className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-amber-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-amber-400 cursor-pointer"
                        >
                          📞 Contacto
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* PANEL 2: MÚSICA & EFECTOS DE SONIDO (Importado de PODCASTUDIO) */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('musica')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors">
                  <span className="flex items-center gap-2 font-bold text-white"><Music size={15} className="text-orange-500"/> Música & Efectos SFX</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${music.playing ? 'bg-green-900 text-green-300' : 'bg-[#222] text-gray-400'}`}>
                      {music.playing ? 'Sonando' : 'Listo'}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${activePanel === 'musica' ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {activePanel === 'musica' && (
                  <div className="p-2 border-t border-[#222] bg-[#0f0f0f]">
                    <MusicBank
                      tracks={combinedTracks}
                      sfxList={combinedSfx}
                      currentTrack={music.currentTrack}
                      playing={music.playing}
                      loading={music.loading}
                      error={music.error}
                      volume={music.volume}
                      onVolumeChange={music.setVolume}
                      duckingEnabled={music.duckingEnabled}
                      onToggleDucking={music.toggleDucking}
                      onSelectTrack={(id, autoPlay) => music.selectTrackById(id, autoPlay)}
                      onTogglePlay={music.toggle}
                      onPlaySfx={playSfx}
                      playingSfxId={playingSfxId}
                      sfxError={sfxError}
                      podcastGenre="general"
                      onAddCustomTrack={handleAddCustomTrack}
                      onAddCustomSfx={handleAddCustomSfx}
                    />
                  </div>
                )}
              </div>

              {/* PANEL 3: MODULADOR & EFECTOS DE VOZ (DSP) */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('voz')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors">
                  <span className="flex items-center gap-2 font-bold text-white"><AudioLines size={15} className="text-purple-400"/> Efectos de Voz & Modulador</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${voiceEffect !== 'normal' ? 'bg-purple-900 text-purple-200' : 'bg-[#222] text-gray-400'}`}>
                      {VOICE_EFFECTS.find(v => v.id === voiceEffect)?.name || 'Natural'}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${activePanel === 'voz' ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {activePanel === 'voz' && (
                  <div className="p-3 border-t border-[#222] bg-[#0f0f0f] space-y-3">
                    {/* Botón de Retorno de Voz en Vivo con Efectos */}
                    <button
                      type="button"
                      onClick={toggleVoiceMonitor}
                      className={`w-full py-2 px-3 rounded-lg flex items-center justify-between text-xs font-bold border transition-all cursor-pointer ${
                        voiceMonitorActive 
                          ? 'bg-purple-900/60 border-purple-400 text-purple-200 shadow-md shadow-purple-950' 
                          : 'bg-[#181818] border-[#333] text-gray-300 hover:text-white hover:bg-[#222]'
                      }`}
                      title="Escuchar en vivo tu voz modulada a través de tus auriculares (recomendado con audífonos)"
                    >
                      <div className="flex items-center gap-2">
                        <Headphones size={15} className={voiceMonitorActive ? 'text-purple-400 animate-pulse' : 'text-gray-400'} />
                        <span>🎧 Retorno de Voz en Auriculares</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        voiceMonitorActive ? 'bg-purple-600 text-white' : 'bg-[#2a2a2a] text-gray-400'
                      }`}>
                        {voiceMonitorActive ? 'ACTIVO' : 'OFF'}
                      </span>
                    </button>

                    {/* Destino de modulación */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">
                        Aplicar Efecto Vocal En:
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectVoiceTarget('all')}
                          className={`py-1.5 px-2 text-[11px] rounded font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                            voiceTarget === 'all'
                              ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                              : 'bg-[#181818] border-[#333] text-gray-400 hover:bg-[#222]'
                          }`}
                        >
                          <Users size={12} /> Todos los micros
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectVoiceTarget('master')}
                          className={`py-1.5 px-2 text-[11px] rounded font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                            voiceTarget === 'master'
                              ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                              : 'bg-[#181818] border-[#333] text-gray-400 hover:bg-[#222]'
                          }`}
                        >
                          <Mic size={12} /> Solo Master (CAM 1)
                        </button>
                      </div>
                    </div>

                    {/* Selector de efectos vocales */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">
                        Efectos Disponibles (DSP Tiempo Real):
                      </label>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {VOICE_EFFECTS.map((fx) => {
                          const isSelected = voiceEffect === fx.id;
                          return (
                            <button
                              key={fx.id}
                              type="button"
                              onClick={() => handleSelectVoiceEffect(fx.id)}
                              className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2.5 ${
                                isSelected
                                  ? 'bg-gradient-to-r from-purple-950/70 to-[#1e1333] border-purple-500 shadow-sm shadow-purple-950'
                                  : 'bg-[#181818] border-[#2c2c2c] hover:border-[#444] hover:bg-[#202020]'
                              }`}
                            >
                              <div
                                className="w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5"
                                style={{ backgroundColor: `${fx.color}22`, border: `1px solid ${fx.color}55` }}
                              >
                                {fx.id === 'normal' && <Mic size={14} style={{ color: fx.color }} />}
                                {fx.id === 'radio' && <Radio size={14} style={{ color: fx.color }} />}
                                {fx.id === 'stadium' && <Tv size={14} style={{ color: fx.color }} />}
                                {fx.id === 'echo' && <AudioLines size={14} style={{ color: fx.color }} />}
                                {fx.id === 'martian' && <Sparkles size={14} style={{ color: fx.color }} />}
                                {fx.id === 'telephone' && <Smartphone size={14} style={{ color: fx.color }} />}
                                {fx.id === 'monster' && <Sliders size={14} style={{ color: fx.color }} />}
                                {fx.id === 'chipmunk' && <Music size={14} style={{ color: fx.color }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                    {fx.name}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[9px] px-1.5 py-0.2 bg-purple-600 text-white rounded font-bold uppercase tracking-wider">
                                      ACTIVO
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                  {fx.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-2 rounded bg-purple-950/20 border border-purple-900/40 text-[10px] text-purple-300 flex items-center gap-2">
                      <AudioLines size={14} className="shrink-0 text-purple-400" />
                      <span>Modulación DSP activa en tiempo real para transmisión en vivo y grabación Master.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL 4: TELEPROMPTER BROADCAST (ESTRUCTURA COMPLETA PROFESIONAL) */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('teleprompter')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors">
                  <span className="flex items-center gap-2 font-bold text-white"><BookOpen size={15} className="text-sky-400"/> Teleprompter Broadcast</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${isTeleprompterPlaying ? 'bg-green-900 text-green-400 border border-green-700/50' : 'bg-[#222] text-gray-400 border border-[#333]'}`}>{isTeleprompterPlaying ? 'Leyendo' : 'En Espera'}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${activePanel === 'teleprompter' ? 'rotate-180' : ''}`}/>
                  </div>
                </button>
                {activePanel === 'teleprompter' && (
                  <div className="p-3 border-t border-[#222] bg-[#0c0d12] space-y-3">
                    {/* Barra de Estadísticas y Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400 bg-black/50 border border-[#2a2e3d] px-2 py-0.5 rounded">
                        {prompterWordCount} palabras • ~{prompterEstMins} min
                      </span>
                      <button
                        onClick={() => setShowFloatingPrompter(p => !p)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                          showFloatingPrompter 
                            ? 'bg-sky-950 text-sky-400 border-sky-500' 
                            : 'bg-[#181a22] text-gray-400 hover:text-white border-[#333]'
                        }`}
                        title="Interruptor HUD — el ÚNICO que monta el texto del teleprompter sobre la cámara máster (solo el texto, sin ventana). Encendido: el texto se ve sobre el programa siempre, también grabando."
                      >
                        <Monitor size={10} /> {showFloatingPrompter ? 'HUD Activo' : 'HUD Inactivo'}
                      </button>
                    </div>

                    {/* Barra de Transporte Principal */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleToggleTeleprompterPlay}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all text-white shadow-md cursor-pointer ${
                          isTeleprompterPlaying 
                            ? 'bg-red-600 hover:bg-red-700 border border-red-500 shadow-red-950/50' 
                            : 'bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 shadow-emerald-950/50'
                        }`}
                        title="Iniciar o pausar desplazamiento del guión (Espacio)"
                      >
                        {isTeleprompterPlaying ? <Pause size={13} /> : <Play size={13} />}
                        <span>{isTeleprompterPlaying ? 'PAUSAR' : 'INICIAR'}</span>
                      </button>

                      <button
                        onClick={handlePrompterReset}
                        title="Volver al inicio del guión (Tecla R)"
                        className="p-1.5 px-2 rounded-lg bg-[#181a22] hover:bg-[#252834] text-gray-300 hover:text-white border border-[#2a2e3d] transition-colors cursor-pointer"
                      >
                        <RotateCcw size={13} />
                      </button>

                      <button
                        onClick={() => setPrompterMirrorH(m => !m)}
                        title="Modo Espejo Horizontal para cristal divisor (Beam Splitter)"
                        className={`p-1.5 px-2 rounded-lg border transition-colors cursor-pointer ${
                          prompterMirrorH 
                            ? 'bg-sky-600 text-white border-sky-400' 
                            : 'bg-[#181a22] hover:bg-[#252834] text-gray-300 border-[#2a2e3d]'
                        }`}
                      >
                        <FlipHorizontal size={13} />
                      </button>

                      <button
                        onClick={() => setPrompterEyeline(e => !e)}
                        title="Alternar guía horizontal de contacto visual con la cámara"
                        className={`p-1.5 px-2 rounded-lg border transition-colors cursor-pointer ${
                          prompterEyeline 
                            ? 'bg-sky-500/25 text-sky-400 border-sky-500/50' 
                            : 'bg-[#181a22] hover:bg-[#252834] text-gray-300 border-[#2a2e3d]'
                        }`}
                      >
                        <Eye size={13} />
                      </button>

                      <button
                        onClick={() => setPrompterEditMode(e => !e)}
                        title={prompterEditMode ? "Guardar y ver lectura" : "Editar guión"}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                          prompterEditMode 
                            ? 'bg-orange-600 text-white border-orange-500' 
                            : 'bg-[#181a22] hover:bg-[#252834] text-gray-300 border-[#2a2e3d]'
                        }`}
                      >
                        {prompterEditMode ? 'Listo' : 'Editar'}
                      </button>

                      <button
                        onClick={handleClearTeleprompter}
                        disabled={!teleprompterText}
                        title="Limpiar texto del teleprompter"
                        className="p-1.5 px-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Sliders de Ajuste Rápido: Velocidad y Tamaño de Letra */}
                    <div className="space-y-1.5 pt-2 border-t border-[#222530]">
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="w-12 text-gray-300">Velocidad:</span>
                        <input
                          type="range"
                          min="0.5"
                          max="8.0"
                          step="0.1"
                          value={teleprompterSpeed}
                          onChange={e => setTeleprompterSpeed(parseFloat(e.target.value))}
                          className="flex-1 accent-sky-400 cursor-pointer"
                        />
                        <span className="w-10 text-right font-extrabold text-sky-400 font-mono">{teleprompterSpeed.toFixed(1)}x</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="w-12 text-gray-300">Letra:</span>
                        <input
                          type="range"
                          min="18"
                          max="60"
                          step="2"
                          value={teleprompterFontSize}
                          onChange={e => setTeleprompterFontSize(parseInt(e.target.value))}
                          className="flex-1 accent-sky-400 cursor-pointer"
                        />
                        <span className="w-10 text-right font-extrabold text-sky-400 font-mono">{teleprompterFontSize}px</span>
                      </div>
                    </div>

                    {/* Acciones de Archivo y Enlace a iPad / Tablet */}
                    <div className="flex gap-2 items-center pt-2 border-t border-[#222530]">
                      <label className="flex-1 bg-[#181a22] hover:bg-[#252834] text-[11px] font-bold py-1.5 px-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 border border-[#2a2e3d] hover:border-sky-500/50 text-sky-400 transition-colors">
                        <Upload size={12} />
                        <span>Cargar .docx / .txt</span>
                        <input type="file" accept=".docx,.txt" className="hidden" onChange={handleTeleprompterFileUpload} />
                      </label>
                      <button
                        onClick={handleCopyPrompterLink}
                        className="bg-[#181a22] hover:bg-[#252834] text-[11px] font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 border border-[#2a2e3d] hover:border-sky-500/50 text-gray-200 transition-colors cursor-pointer"
                        title="Copiar enlace para abrir el teleprompter en un iPad o tableta externa en la red LAN"
                      >
                        <Tablet size={12} className="text-sky-400" />
                        <span>{prompterCopiedLink ? '¡Copiado!' : 'Link iPad/Tablet'}</span>
                      </button>
                    </div>

                    {/* Área de Visualización / Edición del Guión */}
                    {prompterEditMode ? (
                      <textarea
                        value={teleprompterText}
                        onChange={(e) => setTeleprompterText(e.target.value)}
                        placeholder="Escribe o pega aquí el guión del programa, o sube un archivo Word (.docx) o texto (.txt)..."
                        className="w-full bg-[#0a0b10] border border-sky-500/40 focus:border-sky-400 rounded-lg p-2.5 text-xs text-gray-100 placeholder-gray-600 h-44 resize-none outline-none font-mono"
                      />
                    ) : (
                      <div className="h-52 bg-[#07080c] border border-[#222530] rounded-xl overflow-hidden relative select-none flex flex-col shadow-inner">
                        {prompterEyeline && (
                          <div className="px-2 py-0.5 bg-sky-950/80 border-b border-sky-500/30 text-[9px] font-extrabold text-sky-300 text-center tracking-wider uppercase select-none z-10 shrink-0">
                            ▲ MIRAR AQUÍ (LENTE DE CÁMARA)
                          </div>
                        )}
                        <div
                          ref={rightPrompterScrollRef}
                          onClick={handleToggleTeleprompterPlay}
                          onScroll={() => {
                            // En pausa, si Luis arrastra la caja a mano, el
                            // reloj único adopta esa posición: una sola
                            // verdad de lectura para las dos superficies.
                            if (!isTeleprompterPlaying && rightPrompterScrollRef.current) {
                              teleprompterYRef.current = rightPrompterScrollRef.current.scrollTop;
                              projectTeleprompterOverlay();
                            }
                          }}
                          className="flex-1 overflow-y-auto p-4 text-center font-bold text-white leading-relaxed cursor-pointer [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                          style={{
                            fontSize: `${teleprompterFontSize}px`,
                            transform: prompterMirrorH ? 'scaleX(-1)' : 'none',
                            textShadow: '0 2px 8px rgba(0,0,0,0.9)'
                          }}
                          title="Clic para pausar / reanudar lectura"
                        >
                          <div className="whitespace-pre-wrap py-2">
                            {teleprompterText || 'Sin texto en el teleprompter. Haz clic en "Editar" o sube un archivo Word (.docx).'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PANEL 4: TRANSMISIÓN Y REDES */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('transmision')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors"><span className="flex items-center gap-2 font-bold text-white"><Share2 size={15} className="text-red-400"/> Transmisión y Redes</span><ChevronDown size={14} className="text-gray-400"/></button>
                {activePanel === 'transmision' && (
                   <div className="p-3 border-t border-[#222] bg-[#0f0f0f]">
                     <button onClick={() => setShowStreamModal(true)} className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-bold flex items-center justify-center gap-2 text-xs text-white cursor-pointer shadow-md">
                       <Wifi size={14}/> Configurar Transmisión
                     </button>

                     {/* BOTÓN SOLICITADO: CÁMARAS CONECTADAS Y EN USO CON GESTIÓN DE DESCONEXIÓN [X] */}
                     <button 
                       type="button"
                       onClick={() => setShowConnectedCamerasModal(true)} 
                       className="w-full mt-2.5 py-2.5 px-3 bg-[#181a24] hover:bg-[#222534] border border-[#2f3448] hover:border-orange-500/60 rounded-lg text-xs font-bold text-gray-100 flex items-center justify-between transition-all group shadow-sm cursor-pointer"
                       title="Ver todas las cámaras conectadas, en uso y guardadas, y desconectar u olvidar con la X"
                     >
                       <span className="flex items-center gap-2">
                         <Video size={14} className="text-orange-400 group-hover:scale-110 transition-transform" />
                         <span>📹 Cámaras Conectadas & en Uso</span>
                       </span>
                       <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-950/80 text-orange-400 border border-orange-500/40 font-bold">
                         {camSlots.filter(s => slotStreams[s - 1] || cameraMeta[s - 1]).length} Activas
                       </span>
                     </button>

                     {/* MOTOR PODCASTUDIO (v3.0.0): motor propio — perfil
                         de programa, lectura real del canvas y autoprueba. */}
                     <div className="mt-3 border border-purple-500/40 rounded-lg bg-[#14101d] p-3">
                       <div className="flex items-center justify-between">
                         <span className="flex items-center gap-2 text-xs font-black text-purple-200">
                           <Monitor size={14} className="text-purple-400" /> Motor PodcastStudio
                         </span>
                         <span className="text-[10px] font-bold text-gray-400">
                           Programa: {programProfile.width}×{programProfile.height}
                         </span>
                       </div>

                       <div className="mt-2.5">
                         <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Perfil de programa</div>
                         <div className="grid grid-cols-3 gap-2 mt-1.5">
                           {PROGRAM_PROFILE_IDS.map((id) => {
                             const prof = getProgramProfile(id);
                             return (
                               <button key={id} type="button" onClick={() => setProgramProfileId(id)} className={`py-1.5 rounded font-bold text-[11px] cursor-pointer ${programProfileId === id ? 'bg-purple-700 text-white' : 'bg-[#23232e] hover:bg-[#2c2c3a] text-gray-200'}`}>
                                 {prof.label}
                               </button>
                             );
                           })}
                         </div>
                         {isUplinkCapped(programProfile) && (
                           <p className="mt-2 text-[11px] font-semibold text-amber-300">
                             Grabas en {programProfile.label} · transmites en 1080p
                           </p>
                         )}
                       </div>

                       <div className="mt-3 border-t border-[#2a2438] pt-2.5">
                         <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Autoprueba del motor</div>
                         <button type="button" disabled={selfTestBusy} onClick={handleRunSelfTest} className="w-full mt-1.5 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded font-bold text-xs text-white cursor-pointer">
                           {selfTestBusy ? 'Ejecutando autoprueba…' : 'Ejecutar autoprueba'}
                         </button>
                         {!selfTest ? (
                           <p className="mt-2 text-[11px] text-gray-500">Sin autoprueba todavía en esta sesión</p>
                         ) : selfTest.ok ? (
                           <div className="mt-2 text-[11px] leading-relaxed text-green-300 bg-[#0d1a12] border border-green-900/60 rounded px-2 py-1.5">
                             <div>Modo: <b className="text-green-100">{selfTest.mode || '—'}</b></div>
                             <div>Codificador real: <b className="text-green-100">{selfTest.encoderLabel || selfTest.codec || '—'}</b></div>
                             <div>Resolución medida: <b className="text-green-100">{selfTest.width || '—'}×{selfTest.height || '—'}</b></div>
                             <div>fps medidos: <b className="text-green-100">{selfTest.fpsMeasured != null ? Number(selfTest.fpsMeasured).toFixed(1) : '—'}</b>{selfTest.fpsNominal ? ` (nominal ${selfTest.fpsNominal})` : ''}</div>
                           </div>
                         ) : (
                           <div className="mt-2 text-[11px] leading-relaxed text-red-300 bg-[#1a0d0d] border border-red-900/60 rounded px-2 py-1.5">
                             <div className="font-bold">{selfTest.error || 'La autoprueba falló.'}</div>
                             {selfTest.stderrTail && (
                               <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-red-200/80">{String(selfTest.stderrTail).split('\n').slice(-6).join('\n')}</pre>
                             )}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* MOTOR NATIVO (Hito 2, v3.1.0; Hito 3, v3.2.0): la
                         app gobierna la tubería GStreamer fuera de la
                         ventana. Los botones reales (Grabar/Transmitir)
                         usan este motor; este panel es su tablero y
                         conserva la transmisión local de prueba. */}
                     <div className="mt-3 border border-cyan-500/40 rounded-lg bg-[#0d1618] p-3">
                       <div className="flex items-center justify-between">
                         <span className="flex items-center gap-2 text-xs font-black text-cyan-200">
                           <Monitor size={14} className="text-cyan-400" /> Motor Nativo
                         </span>
                         <span className="text-[10px] font-bold text-cyan-300/80">Hito 3 · v3.2.0</span>
                       </div>
                       <div className="mt-2 text-[11px] leading-relaxed text-gray-300 space-y-0.5">
                         <div>Fase: <b className="text-cyan-100">{nativeEngineState?.phase || '—'}</b></div>
                         <div>Cámara: <b className="text-cyan-100">{nativeEngineState?.cameraName || '—'}</b></div>
                         <div>Formato negociado: <b className="text-cyan-100">{nativeEngineState?.caps ? `${nativeEngineState.caps.width}×${nativeEngineState.caps.height} @ ${nativeEngineState.caps.framerate ?? '—'} fps${nativeEngineState.caps.format ? ` (${nativeEngineState.caps.format})` : ''}` : '—'}</b></div>
                         <div>Codificador: <b className="text-cyan-100">{nativeEngineState?.encoder || '—'}{nativeEngineState?.presetUsed ? ` · preset: ${nativeEngineState.presetUsed}` : ''}</b></div>
                         <div>Audio: <b className="text-cyan-100">{nativeEngineState?.audioDevice?.matched ? `micrófono de la cámara (${nativeEngineState.audioDevice.name || 'coincidente'})` : 'dispositivo por defecto de Windows (sin coincidencia con la cámara)'}</b></div>
                         {nativeEngineState?.streamCount > 0 && (
                           <div>Destinos en vivo: <b className="text-cyan-100">{nativeEngineState.streamCount}</b></div>
                         )}
                         {nativeEngineState?.lastError && (
                           <div className="text-red-300">{nativeEngineState.lastError}</div>
                         )}
                       </div>
                       <div className="mt-2.5 space-y-1.5">
                         <button type="button" disabled={['encendiendo', 'vista-previa', 'grabando', 'grabando-transmitiendo', 'transmitiendo', 'validando'].includes(nePhase)} onClick={() => handleNativeEngineStart('preview')} className="w-full py-2 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-50 rounded font-bold text-xs text-white cursor-pointer">Vista previa</button>
                         <button type="button" disabled={['encendiendo', 'vista-previa', 'grabando', 'grabando-transmitiendo', 'transmitiendo', 'validando'].includes(nePhase)} onClick={() => handleNativeEngineStart('record')} className="w-full py-2 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-50 rounded font-bold text-xs text-white cursor-pointer">Grabar</button>
                         <button type="button" disabled={['encendiendo', 'vista-previa', 'grabando', 'grabando-transmitiendo', 'transmitiendo', 'validando'].includes(nePhase)} onClick={() => handleNativeEngineStart('recordStream')} className="w-full py-2 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-50 rounded font-bold text-xs text-white cursor-pointer">Grabar + Transmitir (prueba local)</button>
                         <p className="text-[10px] leading-snug text-amber-300/90">Este botón sigue siendo la transmisión LOCAL de prueba (rtmp://127.0.0.1:1935/live/prueba). Los destinos REALES salen del botón TRANSMITIR EN VIVO, que desde el Hito 3 también gobierna este motor.</p>
                         <button type="button" disabled={['apagado', 'validando'].includes(nePhase)} onClick={handleNativeEngineStop} className="w-full py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 rounded font-bold text-xs text-white cursor-pointer">Detener</button>
                       </div>
                       {nePhase === 'grabando-transmitiendo' && nativeEngineState?.streamFile && (
                         <div className="mt-2 text-[11px] text-cyan-200">Bytes recibidos del stream: <b>{formatMotorBytes(nativeEngineState?.streamBytes)}</b></div>
                       )}
                       {nativeEngineState?.validation && (
                         nativeEngineState.validation.valid ? (
                           <div className="mt-2 text-[11px] leading-relaxed text-green-300 bg-[#0d1a12] border border-green-900/60 rounded px-2 py-1.5">
                             <div>✅ Grabación VÁLIDA — {formatMotorDur(nativeEngineState.validation.durationSec)} · {nativeEngineState.validation.width || '—'}×{nativeEngineState.validation.height || '—'} · {formatMotorBytes(nativeEngineState.validation.bytes)}</div>
                             {nativeEngineState.outFile && (<div className="break-all text-green-200/80">{nativeEngineState.outFile}</div>)}
                           </div>
                         ) : (
                           <div className="mt-2 text-[11px] leading-relaxed text-red-300 bg-[#1a0d0d] border border-red-900/60 rounded px-2 py-1.5">
                             <div>❌ Grabación NO válida{nativeEngineState.validation.error ? ` — ${nativeEngineState.validation.error}` : ''}</div>
                             {nativeEngineState.outFile && (<div className="break-all text-red-200/80">{nativeEngineState.outFile}</div>)}
                           </div>
                         )
                       )}
                       {nativeEngineState?.streamValidation && (
                         nativeEngineState.streamValidation.valid ? (
                           <div className="mt-2 text-[11px] leading-relaxed text-green-300 bg-[#0d1a12] border border-green-900/60 rounded px-2 py-1.5">
                             <div>✅ Stream local VÁLIDO — {formatMotorDur(nativeEngineState.streamValidation.durationSec)} · {nativeEngineState.streamValidation.width || '—'}×{nativeEngineState.streamValidation.height || '—'} · {formatMotorBytes(nativeEngineState.streamValidation.bytes)}</div>
                           </div>
                         ) : (
                           <div className="mt-2 text-[11px] leading-relaxed text-red-300 bg-[#1a0d0d] border border-red-900/60 rounded px-2 py-1.5">
                             <div>❌ Stream local NO válido{nativeEngineState.streamValidation.error ? ` — ${nativeEngineState.streamValidation.error}` : ''}</div>
                           </div>
                         )
                       )}
                     </div>
                   </div>
                )}
              </div>

              {/* PANEL 5: ESCENARIOS VIRTUALES */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('escenarios')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors"><span className="flex items-center gap-2 font-bold text-white"><Layers size={15} className="text-emerald-400"/> Escenarios Virtuales</span><ChevronDown size={14} className="text-gray-400"/></button>
                {activePanel === 'escenarios' && (
                  <div className="p-3 border-t border-[#222] bg-[#0f0f0f] space-y-2">
                     <div className="flex justify-between items-center bg-[#1a1a1a] p-2 rounded"><span className="text-xs">Croma Key (Fondo Verde)</span><input type="checkbox" checked={chromaKeyActive} onChange={e => setChromaKeyActive(e.target.checked)} className="accent-orange-500" /></div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <img src="https://images.unsplash.com/photo-1598550476439-6847785fce6b?auto=format&fit=crop&w=150&q=80" onClick={() => setVirtualBg('https://images.unsplash.com/photo-1598550476439-6847785fce6b?auto=format&fit=crop&w=1920&q=80')} className="w-full h-16 object-cover rounded cursor-pointer border border-[#333] hover:border-orange-500" alt="Set 1" />
                      <img src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=150&q=80" onClick={() => setVirtualBg('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1920&q=80')} className="w-full h-16 object-cover rounded cursor-pointer border border-[#333] hover:border-orange-500" alt="Set 2" />
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÓN DIRECTO: CONFIGURAR ENTRADA DE VIDEO */}
              <button 
                onClick={() => handleOpenConnectModal()} 
                className="w-full p-2.5 bg-[#161616] hover:bg-[#202025] border border-[#2a2a32] hover:border-blue-500/50 rounded flex items-center justify-between text-xs font-bold text-white transition-all cursor-pointer shadow-sm group"
                title="Configurar cámaras USB, Wi-Fi y celulares remotos"
              >
                <span className="flex items-center gap-2">
                  <Radio size={15} className="text-blue-400 group-hover:scale-110 transition-transform"/>
                  <span>Configurar Entrada de Video</span>
                </span>
                <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded font-semibold">
                  Abrir
                </span>
              </button>

              {/* BOTÓN DIRECTO: MANDO IPAD / TABLETS (SWITCHER) */}
              <button 
                onClick={() => setShowRemoteControlModal(true)} 
                className="w-full p-2.5 bg-gradient-to-r from-[#1c1608] to-[#261c0a] hover:from-[#2a200e] hover:to-[#382810] border border-amber-500/50 hover:border-amber-400 rounded flex items-center justify-between text-xs font-bold text-amber-300 transition-all cursor-pointer shadow-md group"
                title="Abrir código QR y enlace para controlar el switcher de cámaras desde tu iPad o Tablet"
              >
                <span className="flex items-center gap-2">
                  <Smartphone size={15} className="text-amber-400 group-hover:scale-110 transition-transform"/>
                  <span>🎮 Mando iPad (Switcher)</span>
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-semibold">
                  Abrir Mando
                </span>
              </button>

            </div>
          )}

          {/* BOTÓN INFERIOR DE GRABACIÓN */}
          {!isRightPanelCollapsed && (
            <div className="p-3 border-t border-[#222] bg-[#0a0a0a] flex flex-col gap-2 shrink-0">
              {/* TOGGLE GRABACIÓN ISO MULTICANAL (P4.1) */}
              <div className="flex items-center justify-between px-1 text-[11px]">
                <span className="text-gray-400 font-bold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isoRecordingEnabled ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' : 'bg-gray-600'}`} />
                  Grabación ISO Multicanal
                </span>
                <button
                  type="button"
                  onClick={() => setIsoRecordingEnabled(v => !v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer border ${
                    isoRecordingEnabled
                      ? 'bg-red-950/80 border-red-500 text-red-300'
                      : 'bg-[#18181b] border-[#333] text-gray-500 hover:text-gray-300'
                  }`}
                  title="Grabar pistas de video limpias e independientes por cada cámara para edición multicam en Premiere / DaVinci"
                >
                  {isoRecordingEnabled ? 'ISO ACTIVO' : 'ISO APAGADO'}
                </button>
              </div>

              <button 
                onClick={handleRecord}
                disabled={isStartingRecording || isStoppingRecordingUI}
                className={`w-full py-3.5 px-4 rounded-xl font-black flex items-center justify-center gap-2.5 text-xs tracking-wide uppercase transition-all duration-150 transform select-none cursor-pointer active:scale-95 active:brightness-90 ${
                  isStoppingRecordingUI
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50 cursor-wait'
                    : isStartingRecording
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50 cursor-wait animate-pulse'
                      : isRecording 
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/60 ring-2 ring-red-400/50' 
                        : countdown !== null 
                          ? 'bg-orange-600 hover:bg-orange-500 text-white animate-pulse shadow-lg' 
                          : 'bg-gradient-to-r from-red-600 via-red-700 to-red-600 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-950/60 hover:shadow-red-900/50 border border-red-500/30'
                }`}
                title={isRecording ? 'Finalizar grabación y abrir selector de formatos' : 'Iniciar grabación broadcast master'}
              >
                {isStoppingRecordingUI ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>{finalizeProgress?.stage ? `${finalizeProgress.stage}${finalizeProgress.percent != null ? ` · ${Math.round(finalizeProgress.percent)}%` : ''}` : 'FINALIZANDO Y PROCESANDO FORMATOS...'}</span>
                  </>
                ) : isStartingRecording ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>INICIANDO GRABACIÓN MASTER...</span>
                  </>
                ) : isRecording ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <Square size={14} className="fill-white" />
                    <span>FINALIZAR Y ELEGIR FORMATOS</span>
                    <span className="font-mono bg-black/60 px-2 py-0.5 rounded text-[11px] font-black border border-white/20 tracking-wider ml-1">
                      {formatTime(recordingTime)}
                    </span>
                  </>
                ) : countdown !== null ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>INICIANDO EN {countdown} · CLIC PARA CANCELAR</span>
                  </>
                ) : (
                  <>
                    <Play size={15} className="fill-white translate-x-0.5" />
                    <span>INICIAR GRABACIÓN MASTER</span>
                  </>
                )}
              </button>
              {nativeNotice ? (
                <div className="mt-1.5 px-1 text-[10px] font-bold leading-snug text-cyan-300">{nativeNotice}</div>
              ) : null}
              {isStoppingRecordingUI && finalizeProgress && (
                <div className="px-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold text-amber-300">
                    <span>{finalizeProgress.stage || 'Finalizando…'}</span>
                    {finalizeProgress.percent != null && <span>{Math.round(finalizeProgress.percent)}%</span>}
                  </div>
                  {finalizeProgress.percent != null && (
                    <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, finalizeProgress.percent))}%` }} />
                    </div>
                  )}
                </div>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={() => {
                    const paused = !isRecordingPausedRef.current;
                    isRecordingPausedRef.current = paused;
                    setIsRecordingPaused(paused);
                    if (window.api?.setRecordingPaused) {
                      window.api.setRecordingPaused(paused).catch(() => {});
                    }
                  }}
                  className="w-full py-2 rounded-lg border border-[#444] bg-[#18181b] hover:bg-[#242428] text-gray-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  title={isRecordingPaused ? 'Continuar la grabación' : 'Pausar temporalmente la grabación'}
                >
                  {isRecordingPaused ? <Play size={13} /> : <PauseCircle size={13} />}
                  {isRecordingPaused ? 'CONTINUAR GRABACIÓN' : 'PAUSAR GRABACIÓN'}
                </button>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  disabled={isCancelingRecordingRef.current}
                  className="w-full py-2 rounded-lg border border-red-900/70 bg-red-950/30 hover:bg-red-900/50 text-red-300 font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Detener y descartar el archivo parcial de esta grabación"
                >
                  <X size={13} /> CANCELAR Y DESCARTAR GRABACIÓN
                </button>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* LÍNEA Y BARRA INFERIOR DE DELIMITACIÓN DEL PROYECTO Y VERSIÓN */}
      <footer className="h-6 bg-[#08080a] border-t border-[#262626] px-4 flex justify-between items-center text-[10.5px] text-gray-400 shrink-0 z-30 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
          <span className="font-bold text-gray-200 tracking-wider">{`PODCASTUDIO v${APP_VERSION}`}</span>
          <span className="text-[#333]">|</span>
          <span className="text-gray-400">Estudio Broadcast Pro</span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-400">Motor: <b className="text-gray-300">WebRTC + Master Canvas</b></span>
          <span className="text-[#333]">|</span>
          <span className="text-gray-400">Salida: <b className="text-gray-300">1080p @ 30fps</b></span>
          <span className="text-[#333]">|</span>
          <span className="text-orange-500 font-bold">Oficial 2026</span>
        </div>
      </footer>

      {/* MODAL DISEÑADOR Y GENERADOR DE CINTILLOS (Importado de PODCASTUDIO) */}
      <CintilloEditorModal
        open={showCintilloModal}
        onClose={() => setShowCintilloModal(false)}
        onApplyLive={handleApplyCintilloFromModal}
        onSaveCustom={handleSaveCustomCintillo}
        initialData={{
          tag: cintillo.tag || 'TEMA',
          text: cintillo.text || topic,
          subtitle: cintillo.subtitle || '',
          color: cintillo.color || '#e8612a',
          styleId: cintilloStyle,
          logoUrl: cintillo.logoUrl || null,
        }}
        project={projectConfig}
      />

      {/* MODAL CONFIGURADOR DE REDES SOCIALES (PROGRAMA E INVITADOS) */}
      {showSocialsModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSocialsModal(false); }}
        >
          <div className="bg-[#111318] border border-[#2a2b35] rounded-xl w-[640px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            
            {/* HEADER */}
            <div className="flex justify-between items-center p-4 border-b border-[#222] bg-[#161820]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-pink-600/20 rounded-lg text-pink-400 border border-pink-500/30">
                  <Share2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Configurar Redes Sociales & Contacto</h2>
                  <p className="text-[10px] text-gray-400">Edita los usuarios (@handles) y textos en pantalla para invitados y canal</p>
                </div>
              </div>
              <button 
                type="button" 
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowSocialsModal(false); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSocialsModal(false); }} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-red-600 transition-all duration-100 hover:scale-105 cursor-pointer"
                title="Cerrar ventana (Esc)"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* PESTAÑAS: INVITADO VS CANAL */}
            <div className="flex px-4 pt-3 gap-2 border-b border-[#222] bg-[#14161f]">
              <button 
                onClick={() => setActiveSocialTab('guest')} 
                className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-colors ${activeSocialTab === 'guest' ? 'border-emerald-500 text-emerald-400 bg-[#1c1f2b]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <Users size={14} className="text-emerald-400" /> Redes del Invitado ({guestName || 'Invitado'})
              </button>
              <button 
                onClick={() => setActiveSocialTab('program')} 
                className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-colors ${activeSocialTab === 'program' ? 'border-orange-500 text-orange-400 bg-[#1c1f2b]' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              >
                <Tv size={14} className="text-orange-400" /> Redes Oficiales del Programa
              </button>
            </div>

            {/* CONTENIDO SCROLLABLE */}
            <div className="p-4 overflow-y-auto space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {activeSocialTab === 'guest' ? (
                <div className="space-y-3">
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-300">Invitado Actual: {guestName}</div>
                      <div className="text-[10px] text-emerald-500/80">Estas redes se mostrarán al pulsar los botones de redes en modo "Invitado"</div>
                    </div>
                    <button 
                      onClick={() => { switchSocialTarget('guest'); }} 
                      className={`px-2.5 py-1 text-[10px] font-bold rounded ${socialTarget === 'guest' ? 'bg-emerald-600 text-white' : 'bg-[#222] text-gray-300 hover:text-white'}`}
                    >
                      {socialTarget === 'guest' ? '✓ Activo al Aire' : 'Activar al Aire'}
                    </button>
                  </div>

                  {/* INSTAGRAM INVITADO */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-pink-400">
                      <Instagram size={14} /> Instagram del Invitado
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Usuario / Handle (@)</label>
                        <input type="text" value={guestInstagram} onChange={e => setGuestInstagram(e.target.value)} placeholder="@usuario_invitado" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-pink-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={guestInstagramSub} onChange={e => setGuestInstagramSub(e.target.value)} placeholder="Instagram oficial del invitado" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-pink-500" />
                      </div>
                    </div>
                  </div>

                  {/* YOUTUBE INVITADO */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                      <Youtube size={14} /> YouTube del Invitado
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Canal / Usuario (@)</label>
                        <input type="text" value={guestYoutube} onChange={e => setGuestYoutube(e.target.value)} placeholder="@canal_invitado" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-red-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={guestYoutubeSub} onChange={e => setGuestYoutubeSub(e.target.value)} placeholder="Canal oficial en YouTube" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-red-500" />
                      </div>
                    </div>
                  </div>

                  {/* TIKTOK INVITADO */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <Music size={14} /> TikTok del Invitado
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Usuario (@)</label>
                        <input type="text" value={guestTiktok} onChange={e => setGuestTiktok(e.target.value)} placeholder="@tiktok_invitado" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={guestTiktokSub} onChange={e => setGuestTiktokSub(e.target.value)} placeholder="Contenido diario en TikTok" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500" />
                      </div>
                    </div>
                  </div>

                  {/* FACEBOOK INVITADO */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                      <Facebook size={14} /> Facebook del Invitado
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Página / Usuario (/)</label>
                        <input type="text" value={guestFacebook} onChange={e => setGuestFacebook(e.target.value)} placeholder="/pagina_invitado" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={guestFacebookSub} onChange={e => setGuestFacebookSub(e.target.value)} placeholder="Comunidad oficial en Facebook" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-2.5 bg-orange-950/30 border border-orange-800/40 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-orange-300">Canal / Podcast Oficial</div>
                      <div className="text-[10px] text-orange-400/80">Estas redes se mostrarán al pulsar los botones de redes en modo "Programa"</div>
                    </div>
                    <button 
                      onClick={() => { switchSocialTarget('program'); }} 
                      className={`px-2.5 py-1 text-[10px] font-bold rounded ${socialTarget === 'program' ? 'bg-orange-600 text-white' : 'bg-[#222] text-gray-300 hover:text-white'}`}
                    >
                      {socialTarget === 'program' ? '✓ Activo al Aire' : 'Activar al Aire'}
                    </button>
                  </div>

                  {/* YOUTUBE PROGRAMA */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                      <Youtube size={14} /> YouTube del Programa
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Canal Oficial (@)</label>
                        <input type="text" value={socialYoutube} onChange={e => setSocialYoutube(e.target.value)} placeholder="@podcaststudio" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-red-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subYoutube} onChange={e => setSubYoutube(e.target.value)} placeholder="Canal oficial · Suscríbete" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-red-500" />
                      </div>
                    </div>
                  </div>

                  {/* INSTAGRAM PROGRAMA */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-pink-400">
                      <Instagram size={14} /> Instagram del Programa
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Usuario Oficial (@)</label>
                        <input type="text" value={socialInstagram} onChange={e => setSocialInstagram(e.target.value)} placeholder="@podcaststudio" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-pink-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subInstagram} onChange={e => setSubInstagram(e.target.value)} placeholder="Síguenos en Instagram" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-pink-500" />
                      </div>
                    </div>
                  </div>

                  {/* TIKTOK PROGRAMA */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <Music size={14} /> TikTok del Programa
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Usuario Oficial (@)</label>
                        <input type="text" value={socialTiktok} onChange={e => setSocialTiktok(e.target.value)} placeholder="@podcaststudio" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subTiktok} onChange={e => setSubTiktok(e.target.value)} placeholder="Contenido exclusivo en TikTok" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-cyan-500" />
                      </div>
                    </div>
                  </div>

                  {/* FACEBOOK PROGRAMA */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                      <Facebook size={14} /> Facebook del Programa
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Página Oficial (/)</label>
                        <input type="text" value={socialFacebook} onChange={e => setSocialFacebook(e.target.value)} placeholder="/podcaststudio" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subFacebook} onChange={e => setSubFacebook(e.target.value)} placeholder="Comunidad oficial en Facebook" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* CONTACTO & WHATSAPP */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <Smartphone size={14} /> Contacto & WhatsApp
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Teléfono / WhatsApp</label>
                        <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+52 667 491 2221" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subContact} onChange={e => setSubContact(e.target.value)} placeholder="Atención directa & Consultas en vivo" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-amber-500" />
                      </div>
                    </div>
                  </div>

                  {/* PROMO / CÓDIGO */}
                  <div className="p-3 bg-[#181a22] border border-[#2a2c36] rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                      <Sparkles size={14} /> Promoción o Código de Descuento
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Texto / Código</label>
                        <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Código: PODCAST24" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-purple-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 block mb-0.5">Bajada / Subtítulo</label>
                        <input type="text" value={subPromo} onChange={e => setSubPromo(e.target.value)} placeholder="Aprovecha la promoción de hoy" className="w-full bg-[#101218] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-purple-500" />
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="p-3.5 border-t border-[#222] bg-[#14161f] flex justify-between items-center">
              <span className="text-[11px] text-gray-400">
                Modo actual al aire: <strong className={socialTarget === 'guest' ? 'text-emerald-400' : 'text-orange-400'}>{socialTarget === 'guest' ? 'Redes del Invitado' : 'Redes del Programa'}</strong>
              </span>
              <button 
                onClick={() => {
                  setShowSocialsModal(false);
                  if (cintillosVisible && cintillo?.active && cintillo?.presetId?.startsWith('social_')) {
                    showManual(cintillo.presetId);
                  }
                }} 
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded font-bold text-xs shadow-lg transition-colors"
              >
                Guardar y Aplicar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CALIBRADOR Y MONITOR PREVIEW (P/VW) */}
      {showSettingsModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
        >
          <div className="bg-[#0d0d0d] border border-[#2a2b30] rounded-xl w-[900px] h-[600px] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-[#2a2b30] bg-[#16171b]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600/20 rounded-lg text-orange-500 border border-orange-500/50"><Sliders size={20} /></div>
                <div><h2 className="text-lg font-bold text-white">Calibrador y Monitor Preview (P/VW)</h2><p className="text-[10px] text-gray-400">Ajusta zoom independiente, encuadre, color y audio antes de enviar a Master</p></div>
              </div>
              <button 
                type="button"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowSettingsModal(false); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowSettingsModal(false); }} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-red-600 transition-all duration-100 hover:scale-105 cursor-pointer"
                title="Cerrar ventana (Esc)"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 p-2 bg-[#111] border-b border-[#222]">{camSlots.map(id => (<button key={id} onClick={() => setEditingCamId(id)} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${editingCamId === id ? 'bg-[#222] text-white border border-[#444]' : 'text-gray-500 hover:text-gray-300'}`}><div className={`w-2 h-2 rounded-full ${getCamStream(id) ? 'bg-green-500' : 'bg-red-500'}`}></div>CAM {id}</button>))}</div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-4 bg-black flex flex-col items-center justify-center relative border-r border-[#222]"><div className="w-full max-w-2xl aspect-video bg-[#050505] border border-[#333] rounded relative overflow-hidden"><VideoTile stream={getCamStream(editingCamId)} isLocal={editingCamId === 1} className="w-full h-full" style={getVideoStyle(editingCamId)} /></div></div>
              <div className="w-[400px] overflow-y-auto p-4 space-y-6 bg-[#111] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-orange-500 flex items-center gap-2"><Search size={12}/> ZOOM / ENCUADRE</span></div><div className="grid grid-cols-4 gap-1 mb-2">{[1.0, 1.25, 1.5, 2.0].map(z => (<button key={z} onClick={() => updateSetting('zoom', z)} className={`py-1 text-[10px] rounded border ${camSettings[editingCamId].zoom === z ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#222] border-[#333] text-gray-400'}`}>{z}x</button>))}</div><input type="range" min="1.0" max="4.0" step="0.05" value={camSettings[editingCamId].zoom} onChange={e => updateSetting('zoom', Math.max(1.0, parseFloat(e.target.value)))} className="w-full accent-orange-500" /></div>
                {/* FUENTE DE AUDIO DE LA RANURA (v1.7.0, Raíz C): elección
                    explícita y visible. 'camera' = micro emparejado de la
                    propia cámara; un deviceId = micrófono externo elegido;
                    'none' = sin audio (bloqueado). El micro por defecto de
                    la PC NUNCA se inyecta solo en una cámara. */}
                <div>
                  <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-orange-500 flex items-center gap-2"><Mic size={12}/> FUENTE DE AUDIO · CAM {editingCamId}</span></div>
                  <select
                    value={getSlotAudioChoice(editingCamId - 1)}
                    onFocus={() => refreshAudioInputDevices()}
                    onChange={e => handleAudioSourceChange(editingCamId - 1, e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 cursor-pointer"
                  >
                    <option value="camera">Micrófono de la cámara (emparejado)</option>
                    <option value="none">Sin audio — bloqueado</option>
                    {audioInputDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || 'Micrófono externo'}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                    {cameraMeta[editingCamId - 1]?.audioSourceBlocked
                      ? 'Esta ranura está bloqueada: no entra ningún micrófono.'
                      : cameraMeta[editingCamId - 1]?.audioDeviceId
                        ? 'Fuente activa: la elegida/emparejada de esta cámara. El micrófono de la computadora solo entra si lo eliges aquí.'
                        : 'Sin fuente activa: la cámara no trajo micrófono emparejado. Elige uno externo o déjala bloqueada; la app ya no mete el micro de la PC por su cuenta.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-[#16171b] border-t border-[#2a2b30] flex justify-between items-center"><button onClick={resetSettings} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white flex items-center gap-2 text-xs"><Disc size={14}/> Restablecer</button><button onClick={() => setShowSettingsModal(false)} className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg">Guardar y Cerrar</button></div>
          </div>
        </div>
      )}

      {/* MODAL STREAMING */}
      {showStreamModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStreamModal(false); }}
        >
          <div className="bg-[#0f1115] border border-[#2a2b30] rounded-xl w-[850px] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-between items-center p-5 border-b border-[#2a2b30]">
              <div className="flex items-center gap-3"><div className="p-2 bg-red-600/20 rounded-lg text-red-500"><Share2 size={24} /></div><div><h2 className="text-lg font-bold text-white">Transmisión En Vivo Multi-Streaming</h2><p className="text-[11px] text-gray-400">Emite tu señal Master simultáneamente en YouTube, Facebook y TikTok.</p></div></div>
              <button 
                type="button" 
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowStreamModal(false); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowStreamModal(false); }} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-red-600 transition-all duration-100 hover:scale-105 cursor-pointer"
                title="Cerrar ventana (Esc)"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mx-5 mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              <b>Salida Master:</b> esta ventana envía el Programa compuesto de PodcastStudio por RTMPS. En Facebook selecciona <b>Software de streaming</b>; la opción <b>Cámara web</b> sólo enumera dispositivos físicos de Windows. Para usarla como webcam, enruta la URL LAN Master a un software de cámara virtual y actívala.
            </div>

            <div className="flex px-5 gap-2 pt-3 bg-[#0f1115] border-b border-[#2a2b30]">
              {['facebook', 'youtube', 'tiktok', 'custom'].map((tab) => {
                const isEnabled = streamConfigs[tab]?.enabled;
                const hasKey = streamConfigs[tab]?.key?.trim()?.length > 0;
                const isReady = isEnabled && hasKey;
                return (
                  <button key={tab} onClick={() => setActiveStreamTab(tab)} className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 ${activeStreamTab === tab ? 'border-orange-500 text-white bg-[#1a1d24]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    {tab === 'facebook' && <Facebook size={14} className="text-blue-500"/>}
                    {tab === 'youtube' && <Youtube size={14} className="text-red-500"/>}
                    {tab === 'tiktok' && <Music size={14} className="text-cyan-400"/>}
                    {tab === 'custom' && <Settings size={14} className="text-purple-400"/>}
                    {tab === 'facebook' ? 'Facebook Live' : tab === 'youtube' ? 'YouTube Live' : tab === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado'}
                    {isReady && <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded font-semibold ml-1">Listo</span>}
                  </button>
                );
              })}
            </div>

            <div className="p-6 flex flex-col gap-4">
              {Object.entries(streamConfigs).map(([destinationId, config]) => (
                <StreamDestinationEditor
                  key={destinationId}
                  destinationId={destinationId}
                  config={config}
                  active={destinationId === activeStreamTab}
                  onCommit={(field, value) => updateStreamConfig(field, value, destinationId)}
                  onToggle={() => toggleDestination(destinationId)}
                  showKey={showKey}
                  onToggleKey={() => setShowKey(value => !value)}
                />
              ))}
            </div>

            <div className="p-5 border-t border-[#2a2b30] flex justify-between items-center bg-[#111317]">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-green-400 font-bold">
                   <CheckCircle size={14}/> {Object.values(streamConfigs).filter(c => c.enabled && c.key && c.key.trim().length > 0).length} destino(s) configurado(s) y listos
                </div>
                <div className="text-[10px] text-gray-400">
                  {Object.entries(streamConfigs).filter(([_, c]) => c.enabled && c.key && c.key.trim().length > 0).map(([k]) => k.toUpperCase()).join(' · ') || 'Pega tu clave en cada red para emitir simultáneamente'}
                </div>
              </div>
              {(nativeNotice || nativeStreamError) ? (
                <div className="flex max-w-xs flex-col gap-1 text-[11px] font-bold leading-snug">
                  {nativeNotice ? <div className="text-cyan-300">{nativeNotice}</div> : null}
                  {nativeStreamError ? <div className="text-red-300">Motor nativo: {nativeStreamError}</div> : null}
                </div>
              ) : null}
              <button onClick={handleStream} disabled={isStreamStarting} className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-wait text-white rounded font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/20 transition-colors">
                 <Wifi size={14}/> {isStreamStarting ? 'Conectando con RTMP…' : isStreaming ? 'Detener Transmisión' : 'Iniciar Transmisión En Vivo'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Aviso persistente por destino del directo (v1.5.0): nunca en silencio */}
      {Object.values(streamDestStatuses).filter(d => d.status && d.status !== 'live').length > 0 && (
        <div className="fixed top-4 right-4 z-[130] flex flex-col gap-2 max-w-sm">
          {Object.values(streamDestStatuses).filter(d => d.status && d.status !== 'live').map(d => (
            <div key={d.targetId} className={`px-3 py-2 rounded-lg border text-xs font-bold shadow-lg ${d.status === 'failed' ? 'bg-red-950/90 border-red-500 text-red-200' : 'bg-amber-950/90 border-amber-500 text-amber-200'}`}>
              {d.targetName || 'Destino'}: {d.status === 'failed' ? 'TRANSMISIÓN PERDIDA tras 5 intentos de reconexión' : d.status === 'down' ? 'la transmisión cayó' : `reconectando (intento ${d.attempt || 1} de 5)…`}
              {(d.userMessage || d.error) ? <div className="font-normal opacity-80 mt-0.5">{d.userMessage || d.error}</div> : null}
            </div>
          ))}
        </div>
      )}

      {/* MODAL CONFIGURADOR DE CONEXIONES Y ENTRADAS DE VIDEO (Importado de PODCASTUDIO) */}
      <CameraConnectModal
        open={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        initialSlot={connectModalSlot}
        slotsCount={camSlots.length}
        onAddSlot={addCam}
        devices={cameraDevices}
        cameraMeta={cameraMeta}
        streams={slotStreams}
        liberatedSlots={nativeReleasedCamsRef.current}
        remoteCams={remoteCams}
        masterCameraSlot={activeCam - 1}
        onSetMaster={(slot) => setActiveCam(slot + 1)}
        onUsbConnect={handleUsbConnect}
        onWifiConnect={handleWifiConnect}
        onScreenConnect={handleScreenConnect}
        onAssignRemoteStream={handleAssignRemoteStream}
        onDisconnect={handleDisconnectSlot}
        onRenameSlot={handleRenameSlot}
        localQrUrl={qrCodeUrl}
        onOpenRemoteControl={() => {
          setShowConnectModal(false);
          setShowRemoteControlModal(true);
        }}
      />

      {/* MODAL MONITOR PREVIEW (PVW) Y CALIBRADOR DE CÁMARAS INDEPENDIENTES (Importado de PODCASTUDIO) */}
      <CameraCalibratorModal
        isOpen={showCalibratorModal}
        onClose={() => setShowCalibratorModal(false)}
        initialSlot={Math.max(0, Math.min(Math.max(camSlots.length - 1, 0), calibratorTargetSlot || 0))}
        slotsCount={camSlots.length}
        streams={camSlots.map(id => getCamStream(id))}
        cameraMeta={cameraMeta || {}}
        crops={cameraCrops || {}}
        masterCameraSlot={Math.max(0, activeCam - 1)}
        onSaveSlotProfile={handleSaveSlotProfile}
        onPromoteToMaster={(slotIdx) => {
          setActiveCam(slotIdx + 1);
        }}
      />

      {/* MODAL QR PARA CELULAR */}
      {showQRModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowQRModal(false); }}
        >
          <div className="bg-[#16171b] border border-[#2a2b30] rounded-xl w-[500px] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-[#2a2b30]">
              <div className="flex items-center gap-2 text-lg font-bold text-white"><Video size={18} className="text-orange-500" /> Conectar Celular</div>
              <button 
                type="button"
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowQRModal(false); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowQRModal(false); }} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-red-600 transition-all duration-100 hover:scale-105 cursor-pointer"
                title="Cerrar ventana (Esc)"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 items-center">
              <div className="bg-white p-2 rounded-lg">
                {qrCodeImage ? <img src={qrCodeImage} className="w-[200px] h-[200px]" alt="QR Code" /> : <div className="w-[200px] h-[200px] flex items-center justify-center text-black">Generando QR...</div>}
              </div>
              {mobileStatus && <p className="text-xs text-green-400 font-semibold">{mobileStatus}</p>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTROL REMOTO IPAD / TABLETS */}
      {showRemoteControlModal && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRemoteControlModal(false); }}
        >
          <div className="bg-[#14161b] border border-[#262832] rounded-2xl w-full max-w-[640px] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-[#262832] bg-[#0d0f13]">
              <div className="flex items-center gap-2.5 text-base font-extrabold text-white">
                <Smartphone size={18} className="text-amber-400" />
                <span>Control Remoto iPad y Tablets</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowRemoteControlModal(false)} 
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#252834] transition-all cursor-pointer"
                title="Cerrar ventana (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* SELECTOR DE ENLACE: WEB (PREDETERMINADO) VS RED LOCAL LAN */}
            <div className="grid grid-cols-2 p-2 bg-[#0a0b0e] border-b border-[#262832] gap-1.5">
              <button
                type="button"
                onClick={() => setRemoteControlTab('web')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  remoteControlTab === 'web'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1c24]'
                }`}
              >
                <span>🌐 Enlace Web Oficial</span>
                <span className="text-[9px] bg-black/40 px-1.5 py-0.2 rounded font-mono">Recomendado</span>
              </button>
              <button
                type="button"
                onClick={() => setRemoteControlTab('lan')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  remoteControlTab === 'lan'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1c24]'
                }`}
              >
                <span>🏠 Red Local LAN</span>
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-amber-500/30">
                {remoteControlQrImage ? (
                  <img src={remoteControlQrImage} className="w-[210px] h-[210px]" alt="QR Control Remoto iPad" />
                ) : (
                  <div className="w-[210px] h-[210px] flex items-center justify-center text-black text-xs font-bold">Generando QR...</div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-100 mb-1">
                  Escanea con la cámara de tu iPad o Tablet
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                  {remoteControlTab === 'web' 
                    ? 'Abre directamente el proyecto en podcastudio.mx sin necesidad de configuración ni puertos locales.'
                    : 'Conexión ultrarrápida punto a punto dentro de tu red Wi-Fi local.'}
                </p>
              </div>

              <div className="w-full flex items-center gap-2 bg-[#0b0c10] border border-[#222530] p-2 rounded-xl text-xs text-gray-300">
                <span className="truncate flex-1 font-mono text-[11px] text-gray-400">{activeQrTargetUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeQrTargetUrl);
                    showToast('¡Enlace del Control Remoto copiado al portapapeles!', 'info');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shrink-0 flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Copy size={13} />
                  <span>Copiar Enlace</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CÁMARAS CONECTADAS & GUARDADAS (SOLICITADO POR EL USUARIO) */}
      <ConnectedCamerasModal
        open={showConnectedCamerasModal}
        onClose={() => setShowConnectedCamerasModal(false)}
        camSlots={camSlots}
        cameraMeta={cameraMeta}
        slotStreams={slotStreams}
        savedCameras={savedCameras}
        onDisconnectSlot={handleDisconnectSlot}
        onReconnectCamera={handleReconnectSavedCamera}
        onForgetCamera={handleForgetCamera}
        onOpenConnectModal={() => handleOpenConnectModal()}
      />

      {/* MODAL DE EXPORTACIÓN Y DESCARGA MULTI-FORMATO (FACEBOOK, YOUTUBE, TIKTOK, INSTAGRAM) */}
      <MultiFormatExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        recording={recordedVideoData}
        highlights={highlights}
        onCleanNewProject={handleCleanNewProject}
        onDownloadMp4={async (rec) => {
          if (window.api?.openRecordingsFolder) {
            window.api.openRecordingsFolder(rec?.projectName || topic || 'Proyecto_General');
            showToast(`El video Master MP4 está guardado en tu carpeta de proyecto (${rec?.projectName || 'proyectos'})`, 'success');
            return;
          }

          // Fallback solo para navegador web puro
          if (rec?.blob) {
            const url = URL.createObjectURL(rec.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${rec.name || 'PodcaStudio_Master'}.mp4`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }}
      />

      {/* CONSOLA DE AUDIO BROADCAST PROFESIONAL (P0.4) */}
      <AudioMixerDesk
        isOpen={showAudioMixerModal}
        onClose={() => setShowAudioMixerModal(false)}
        camSlots={camSlots}
      />

      {/* MODAL CONFIGURACIÓN TALLY LIGHTS BROADCAST (P2.4) */}
      <TallySettingsModal
        open={showTallyModal}
        onClose={() => setShowTallyModal(false)}
        activeCam={activeCam}
        pvwCam={pvwCam}
        dualMode={dualMonitorMode}
        totalSlots={camSlots.length}
        onSelectCam={handleSelectMasterCam}
        onSelectPvw={(c) => { setPvwCam(c); updateBroadcastState({ pvwCam: c }); }}
      />

      {/* v3.2.1: la VENTANA flotante del teleprompter (BroadcastTeleprompter,
          con fondo de vidrio y controles propios) ya NO se monta sobre el
          programa: por corrección de Luis, el «HUD» es SOLO el texto en
          desplazamiento directamente sobre la cámara máster (ver el
          overlay «TELEPROMPTER HUD SOBRE EL PROGRAMA» junto al monitor),
          y los controles quedan únicamente en el panel lateral. El
          componente queda en el repo sin montar aquí; el teleprompter
          para iPad/tablet por LAN lo sirve main.js por su propia ruta. */}



      {/* SALA DE INVITADOS REMOTOS & RETORNO MIX-MINUS (P3.3) */}
      <MultiGuestRoomModal
        open={showMultiGuestModal}
        onClose={() => setShowMultiGuestModal(false)}
        localIp={qrCodeUrl ? (qrCodeUrl.match(/https?:\/\/([^:/]+)/) || [])[1] || 'localhost' : 'localhost'}
        cameraSlots={camSlots}
        cameraMeta={cameraMeta}
        onUpdateCameraMeta={(slot, meta) => {
          setCameraMeta(prev => ({
            ...prev,
            [slot]: meta,
          }));
        }}
        cameraLevels={camAudioLevels}
        slotStreams={slotStreams}
        onDisconnectSlot={(slot) => {
          if (slotStreams[slot]) {
            slotStreams[slot].getTracks().forEach(t => t.stop());
            setSlotStreams(prev => {
              const copy = { ...prev };
              delete copy[slot];
              return copy;
            });
          }
        }}
        autoCintilloEnabled={autoSpeakerCintilloEnabled}
        onToggleAutoCintillo={() => setAutoSpeakerCintilloEnabled(v => !v)}
        onTriggerSpeakerCintillo={(slotNum) => {
          if (slotNum === 1) {
            showManual('host');
          } else {
            const meta = cameraMeta[slotNum] || cameraMeta[slotNum - 1];
            const name = meta?.guestName || (slotNum === 2 ? guestName : `Invitado CAM ${slotNum}`);
            const role = meta?.guestRole || (slotNum === 2 ? guestRole : 'Participante en Vivo');
            showCustom({
              tag: 'INVITADO',
              text: name,
              subtitle: role,
              color: '#06b6d4',
              presetId: 'guest',
              targetSlot: slotNum - 1,
            });
          }
        }}
      />

      {/* MODAL DE RÓTULO DE NOMBRE INDIVIDUAL POR CÁMARA (ESTILO RESTREAM / CLASES) */}
      <CameraNameBadgeModal
        isOpen={showBadgeModal}
        onClose={() => setShowBadgeModal(false)}
        camId={badgeModalSlot}
        badge={badgeModalSlot ? cameraBadges[badgeModalSlot] : null}
        onSave={handleSaveCameraBadge}
      />

      {/* NOTIFICACIÓN FLOTANTE TOAST GLOBAL NO BLOQUEANTE */}
      {toastNotification && (
        <div style={{
          position: 'fixed',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: toastNotification.type === 'error' ? 'rgba(220, 38, 38, 0.95)' : toastNotification.type === 'success' ? 'rgba(22, 101, 52, 0.95)' : toastNotification.type === 'warning' ? 'rgba(217, 119, 6, 0.95)' : 'rgba(30, 41, 59, 0.95)',
          color: '#fff',
          border: `1px solid ${toastNotification.type === 'error' ? '#f87171' : toastNotification.type === 'success' ? '#4ade80' : toastNotification.type === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.25)'}`,
          padding: '10px 20px',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 600,
          maxWidth: '90vw',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <span>{toastNotification.message}</span>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() { return <ErrorBoundary><PodcastStudioApp /></ErrorBoundary>; }
