import React, { useState, useRef, useEffect, useMemo, useCallback, Component } from 'react';
import { 
  Video, Mic, MicOff, Sparkles, Settings, Play, Pause, Square, QrCode, Share2, Camera, 
  Sliders, Volume2, Users, LayoutGrid, Plus, Headphones, Wifi, Search, 
  Grid, Eye, EyeOff, X, Copy, Link, Mail, MessageCircle, Globe, Sun, Disc, Smartphone, 
  CheckCircle, Download, UploadCloud, Image as ImageIcon, FileVideo, AudioLines, Monitor,
  BookOpen, Type, Layers, Music, ChevronRight, ChevronLeft, PanelRight, ChevronDown,
  PlayCircle, PauseCircle, Upload, Facebook, Youtube, Instagram, VolumeX, Sparkle, RefreshCw,
  Radio, Tv, Trash2, Loader2, Pencil, HelpCircle, RotateCcw, Zap, FlipHorizontal, Tablet, Tag
} from 'lucide-react';
import QRCode from 'qrcode';
import mammoth from 'mammoth';
import './index.css';

// Componentes y Configuración de Cintillos importados desde PODCASTUDIO
import CintilloOverlay from './components/CintilloOverlay.jsx';
import CintilloStylePicker from './components/CintilloStylePicker.jsx';
import CintilloEditorModal from './components/CintilloEditorModal.jsx';
import CameraConnectModal from './components/CameraConnectModal.jsx';
import CameraCalibratorModal from './components/CameraCalibratorModal.jsx';
import MultiFormatExportModal from './components/MultiFormatExportModal.jsx';
import AudioMixerDesk from './components/AudioMixerDesk.jsx';
import { BROADCAST_LAYOUTS } from './config/cameraSlots.js';
import { useCameraAudioLevels } from './hooks/useCameraAudioLevels.js';
import { buildCanvasFilter } from './utils/videoLook.js';
import { CINTILLO_STYLES, getCintilloStyle } from './config/cintilloStyles.js';
import { CINTILLO_PRESETS, resolveCintilloText, resolveCintilloSubtitle } from './config/cintilloPresets.js';
import { CINTILLO_POSITION_OPTIONS } from './config/cintilloCameraMap.js';
import { useCintilloRotation } from './hooks/useCintilloRotation.js';

// Componentes y Configuración de Música y Efectos importados desde PODCASTUDIO
import MusicBank from './components/MusicBank.jsx';
import { MUSIC_TRACKS, MUSIC_SFX, MUSIC_GENRES, SFX_CATEGORIES } from './config/musicTracks.js';
import { useBackgroundMusic } from './hooks/useBackgroundMusic.js';
import { useSoundEffect } from './hooks/useSoundEffect.js';
import { 
  startBroadcastEngine, updateBroadcastState, stopBroadcastEngine, 
  getInitHeader, captureMasterCanvasSnapshot, getMasterCanvas,
  setVoiceMonitor, syncStudioAudio, getCameraSnapshots,
  createMasterRecordingSession
} from './utils/masterBroadcastEngine.js';
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
import BroadcastTeleprompter from './components/BroadcastTeleprompter.jsx';
import SoundboardQuickPad from './components/SoundboardQuickPad.jsx';

// Componentes y Configuración de Fase P3.3 (Sala Multi-Invitados & Auto-Cintillo por Voz)
import MultiGuestRoomModal from './components/MultiGuestRoomModal.jsx';
import { useAutoSpeakerCintillo } from './hooks/useAutoSpeakerCintillo.js';

// Componentes y Configuración de Fase P4.3 & P4.4 (Instant Replay & Salida LAN Program / OBS Feed)
import { useInstantReplay } from './hooks/useInstantReplay.js';
import InstantReplayControl from './components/InstantReplayControl.jsx';
import LanProgramOutputModal from './components/LanProgramOutputModal.jsx';
import ConnectedCamerasModal from './components/ConnectedCamerasModal.jsx';
import PgmFeedCanvas from './components/PgmFeedCanvas.jsx';
import CameraNameBadgeModal from './components/CameraNameBadgeModal.jsx';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div style={{ color: 'red', padding: '20px', backgroundColor: 'black', height: '100vh' }}><h1> Error:</h1><pre>{this.state.error.toString()}</pre></div>;
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
  isActive = true 
}, ref) => {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;

  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      if (v.srcObject !== stream) {
        v.srcObject = stream;
      }
      const attemptPlay = () => {
        if (v && v.paused) {
          v.play().catch(() => {});
        }
      };
      attemptPlay();

      v.addEventListener('loadedmetadata', attemptPlay);
      v.addEventListener('canplay', attemptPlay);
      return () => {
        v.removeEventListener('loadedmetadata', attemptPlay);
        v.removeEventListener('canplay', attemptPlay);
      };
    }
  }, [stream, videoRef]);

  const isMuted = muted !== undefined ? muted : isLocal;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (!isMuted && videoRef.current.paused) {
        videoRef.current.play().catch(e => console.log("Audio un-mute play error:", e));
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
          className={`w-full h-full object-cover ${chromaKey ? 'relative z-10 mix-blend-screen' : ''}`} 
          style={{...style, filter: chromaKey ? `${style?.filter || ''} contrast(1.5) brightness(1.1)` : style?.filter }} 
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 w-full h-full bg-[#111] z-10">
          <Camera size={24} className="mb-2 opacity-50" />
          <span className="text-[10px] uppercase tracking-wider">Sin señal</span>
        </div>
      )}
      {label && <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold z-20 border border-[#333] text-white flex items-center gap-1">{label}</div>}

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

const defaultCamSettings = { zoom: 1.0, panX: 50, panY: 50, brightness: 100, contrast: 100, saturation: 100, temp: 0, tint: 0, luts: 'Original' };

function PodcastStudioApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [micLevel, setMicLevel] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMasterGrid, setShowMasterGrid] = useState(false);
  const [recordedVideoData, setRecordedVideoData] = useState(null);
  const recordingChunksRef = useRef([]);

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
      return next;
    });
  };

  const handleSelectVoiceEffect = (effectId) => {
    setVoiceEffect(effectId);
    updateBroadcastState({ voiceEffect: effectId, voiceTarget });
  };

  const handleSelectVoiceTarget = (target) => {
    setVoiceTarget(target);
    updateBroadcastState({ voiceEffect, voiceTarget: target });
  };

  const [camSlots, setCamSlots] = useState([1, 2, 3, 4]); 
  const [activeCam, setActiveCam] = useState(1);
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
  const [showFloatingPrompter, setShowFloatingPrompter] = useState(false);
  const [showSoundboardPad, setShowSoundboardPad] = useState(false);

  // SALA MULTI-INVITADOS & AUTO-CINTILLO (P3.3)
  const [showMultiGuestModal, setShowMultiGuestModal] = useState(false);
  const [autoSpeakerCintilloEnabled, setAutoSpeakerCintilloEnabled] = useState(false);

  // GRABACIÓN ISO MULTICANAL (PISTAS INDEPENDIENTES POR CÁMARA) (P4.1)
  const [isoRecordingEnabled, setIsoRecordingEnabled] = useState(true);
  const isoRecordersRef = useRef(new Map()); // slotNum -> MediaRecorder
  const masterRecorderRef = useRef(null); // Grabador dedicado para el Master limpio en alta fidelidad

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
  const [slotStreams, setSlotStreams] = useState({});
  const slotStreamsRef = useRef(slotStreams);
  useEffect(() => { slotStreamsRef.current = slotStreams; }, [slotStreams]);

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
  const controlChannelRef = useRef(null);
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
          });
        }
        return parsed;
      } catch (e) {}
    }
    return {};
  });
  const [camMuted, setCamMuted] = useState({ 1: false, 2: true, 3: true, 4: true });
  // Control de retorno de audio local (bocina / parlante de monitoreo en estudio para cada cámara)
  const [camSpeakerMuted, setCamSpeakerMuted] = useState({ 1: true, 2: false, 3: false, 4: false });

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
  const [teleprompterHideInRec, setTeleprompterHideInRec] = useState(true);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2.0);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(36);
  const [prompterEditMode, setPrompterEditMode] = useState(false);
  const [prompterMirrorH, setPrompterMirrorH] = useState(false);
  const [prompterEyeline, setPrompterEyeline] = useState(true);
  const [prompterCopiedLink, setPrompterCopiedLink] = useState(false);
  const teleprompterTextRef = useRef(null);
  const teleprompterYRef = useRef(0);
  const rightPrompterScrollRef = useRef(null);
  const rightPrompterScrollPos = useRef(0);

  const prompterWordCount = useMemo(() => {
    return (teleprompterText || '').trim().split(/\s+/).filter(Boolean).length;
  }, [teleprompterText]);
  const prompterEstMins = useMemo(() => {
    return Math.ceil(prompterWordCount / 130) || 1;
  }, [prompterWordCount]);

  // CONFIGURACIÓN DE STREAMING Y MULTI-STREAM
  const [streamConfigs, setStreamConfigs] = useState(() => {
    const saved = localStorage.getItem('podcastStudio_streamConfigs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.facebook && parsed.facebook.server.startsWith('rtmp://')) {
          parsed.facebook.server = parsed.facebook.server.replace('rtmp://', 'rtmps://');
        }
        return parsed;
      } catch(e) {}
    }
    return {
      facebook: { server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: '', enabled: true },
      youtube: { server: 'rtmp://a.rtmp.youtube.com/live2/', key: '', enabled: false },
      tiktok: { server: 'rtmp://live.tiktok.com/live/', key: '', enabled: false },
      custom: { server: 'rtmp://live.twitch.tv/app/', key: '', enabled: false }
    };
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
    displaySec: 10,
    masterPosition: cintilloPosition
  });
  showCustomRef.current = showCustom;

  // Notificar a Electron que la UI está 100% montada (cintillos inician desactivados)
  useEffect(() => {
    if (window.api && window.api.signalReady) {
      window.api.signalReady();
    }
  }, []);

  // ESCENARIOS Y CROMA KEY
  const [chromaKeyActive, setChromaKeyActive] = useState(false);
  const [virtualBg, setVirtualBg] = useState('https://images.unsplash.com/photo-1598550476439-6847785fce6b?auto=format&fit=crop&w=1920&q=80');

  const [isStreaming, setIsStreaming] = useState(false);
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
  const openSettings = (id) => { setEditingCamId(id); setShowSettingsModal(true); };
  const updateSetting = (key, value) => { setCamSettings(prev => ({ ...prev, [editingCamId]: { ...prev[editingCamId], [key]: value } })); };
  const resetSettings = () => { setCamSettings(prev => ({ ...prev, [editingCamId]: { ...defaultCamSettings } })); };

  const addCam = () => { 
    if (camSlots.length >= 12) return;
    const nextCount = camSlots.length + 1;
    const newSlots = Array.from({ length: nextCount }, (_, i) => i + 1);
    setCamSlots(newSlots); 
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
  }, [activeCam, pvwCam, isElectronMaster, dispatchRemoteCommand]);

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
  }, [isTransitioning, transitionDuration, activeCam, pvwCam, isElectronMaster, dispatchRemoteCommand]);

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
  }, [activeCam, pvwCam, isElectronMaster, dispatchRemoteCommand]);
  
  const getCamStream = (id) => { 
    const slotIdx = id - 1;
    if (slotStreams[slotIdx]) return slotStreams[slotIdx];
    if (id === 1 && localStream) return localStream; 
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

  // SALIDA LAN PROGRAM & VIRTUAL FEED OBS / VMIX (Fase P4.4)
  const [showLanProgramModal, setShowLanProgramModal] = useState(false);
  const [lanProgramUrl, setLanProgramUrl] = useState('');

  useEffect(() => {
    if (window.api?.getProgramFeedUrl) {
      window.api.getProgramFeedUrl().then(url => {
        if (url) setLanProgramUrl(url);
      }).catch(() => {});
    }
  }, []);

  // Emisión continua de fotogramas PGM al servidor HTTP/WS para clientes OBS/vMix e iPad en LAN y Cloud (Ultra Baja Latencia)
  useEffect(() => {
    if (!isElectronMaster) return;
    let timer = null;
    let isBroadcasting = true;
    let lastCloudEmit = 0;
    let lastThumbEmit = 0;

    // Canvas auxiliar offscreen de 640x360 para codificación ultrarrápida (1.5ms) y carga liviana (15KB)
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 640;
    previewCanvas.height = 360;
    const previewCtx = previewCanvas.getContext('2d', { alpha: false });

    const streamLoop = () => {
      if (!isBroadcasting) return;
      const now = Date.now();
      const c = getMasterCanvas();
      if (c && c.width > 0 && c.height > 0) {
        try {
          if (previewCtx) {
            previewCtx.drawImage(c, 0, 0, 640, 360);
          }
          const lowLatencyDataUrl = previewCanvas.toDataURL('image/jpeg', 0.60);

          // 1. Enviar a clientes WebSocket LAN (iPad / OBS en red local a 20fps casi 0ms)
          if (window.api?.sendProgramFeedFrame) {
            window.api.sendProgramFeedFrame(lowLatencyDataUrl);
          }

          // 2. Enviar miniaturas en vivo de todas las cámaras activas para Multiviewer en iPad
          if (window.api?.sendCamThumbnails && (now - lastThumbEmit > 100)) {
            lastThumbEmit = now;
            const thumbs = getCameraSnapshots();
            if (thumbs && Object.keys(thumbs).length > 0) {
              window.api.sendCamThumbnails(thumbs);
            }
          }

          // 3. Emitir snapshot ultraliviano (15KB) cada 120ms por Supabase para iPads remotos vía Cloud
          if (controlChannelRef.current && (now - lastCloudEmit > 120)) {
            lastCloudEmit = now;
            controlChannelRef.current.send({
              type: 'broadcast',
              event: 'pgm_cloud_frame',
              payload: { dataUrl: lowLatencyDataUrl }
            }).catch(() => {});
          }
        } catch(e) {}
      }
      timer = setTimeout(streamLoop, 50);
    };

    streamLoop();
    return () => {
      isBroadcasting = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

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
      const stream = getCamStream(camId);
      if (stream) {
        stream.getAudioTracks().forEach(track => {
          track.enabled = !profile.audioMuted;
        });
      }
    }
  };

  // Silenciar / Activar micrófono de cámara individual (para evitar eco con micrófonos externos)
  const toggleMuteCam = (camId) => {
    const nextMuted = !Boolean(camMuted[camId]);
    setCamMuted(prev => ({ ...prev, [camId]: nextMuted }));
    const stream = getCamStream(camId);
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
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

    const filter = buildCanvasFilter({
      brightness: crop.brightness ?? s.brightness,
      contrast: crop.contrast ?? s.contrast,
      saturation: crop.saturation ?? s.saturation,
      warmth: crop.warmth ?? s.temp,
      tint: crop.tint ?? 0,
      sharpness: crop.sharpness ?? s.sharpness ?? 100,
    });

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

  useEffect(() => {
    if (!isElectronMaster) {
      console.log('[PodcastStudio] Cliente remoto / iPad: Modo Switcher Espejo activo. Cámara local desactivada.');
      return;
    }
    const startCamera = async () => {
      try {
        const attempts = [
          { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
          { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: true, audio: false }
        ];

        let stream = null;
        for (const c of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            if (stream) break;
          } catch (e) {}
        }

        if (stream) {
          // Intentar vincular micrófono sin bloquear el video si falla
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (micStream && micStream.getAudioTracks().length > 0) {
              stream.addTrack(micStream.getAudioTracks()[0]);
            }
          } catch (e) {}

          setLocalStream(stream);
          setSlotStreams(prev => ({ ...prev, 0: stream }));
          const videoTrack = stream.getVideoTracks()[0];
          const devId = videoTrack?.getSettings?.()?.deviceId;
          const devLabel = videoTrack?.label || 'Cámara 1 (Principal)';
          setCameraMeta(prev => ({ ...prev, 0: { deviceId: devId, label: devLabel, type: 'usb' } }));

          // Auto-enfoque continuo por hardware al iniciar
          if (videoTrack && videoTrack.applyConstraints) {
            try {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              });
            } catch (_) {}
          }

          if (stream.getAudioTracks().length > 0) {
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const analyser = audioCtx.createAnalyser();
              const source = audioCtx.createMediaStreamSource(stream);
              source.connect(analyser);
              analyser.fftSize = 256;
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const updateVolume = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                setMicLevel(Math.min(100, Math.round((sum / dataArray.length / 128) * 100)));
                requestAnimationFrame(updateVolume);
              };
              updateVolume();
            } catch (e) {}
          }
        }
      } catch (err) { console.error("Error cámara inicial:", err); }
    };
    startCamera();
  }, []);

  // LÓGICA DE SCROLL FLUIDO CON TRANSFORM (TELEPROMPTER HACIA ARRIBA)
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    if (teleprompterTextRef.current && teleprompterYRef.current === 0) {
        teleprompterYRef.current = window.innerHeight;
        teleprompterTextRef.current.style.transform = `translateY(${window.innerHeight}px)`;
    }

    const animate = (time) => {
      if (isTeleprompterPlaying && teleprompterTextRef.current) {
        const delta = time - lastTime;
        const speed = teleprompterSpeed * 2.5;
        const moveAmount = speed * (delta / 16.66);
        
        teleprompterYRef.current -= moveAmount;
        teleprompterTextRef.current.style.transform = `translateY(${teleprompterYRef.current}px)`;
      }
      lastTime = time;
      if (isTeleprompterPlaying) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (isTeleprompterPlaying) {
      animationFrameId = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isTeleprompterPlaying, teleprompterSpeed]);

  const handlePlayTeleprompter = () => {
      if (teleprompterYRef.current < -window.innerHeight) {
          teleprompterYRef.current = window.innerHeight;
      }
      setIsTeleprompterPlaying(true);
  };

  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          if (controlChannelRef.current) {
            controlChannelRef.current.send({
              type: 'broadcast',
              event: 'studio_state',
              payload: { type: 'REC_TICK', recordingTime: next }
            }).catch(() => {});
          }
          return next;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

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
      window.api.onStreamStatus((status) => {
        if (!status.active) {
          setIsStreaming(false);
          setActiveLiveDestinations([]);
        }
      });
    }
  }, []);

  // Sincronización en tiempo real del Master Compositor y Audio Engine
  useEffect(() => {
    if (!isElectronMaster) return;
    // Sincronizar siempre el audio del estudio y los efectos de voz en vivo
    syncStudioAudio(localStream, remoteCams, camStreamsMap, camMuted);
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
      cintillo,
      topic,
      getCamStream,
      remoteCams,
    });
  }, [activeCam, pvwCam, pipCam, camSlots, cameraCrops, cameraBadges, cameraMeta, hostName, hostRole, guestName, guestRole, layoutMode, chromaKeyActive, virtualBg, logoBase64, logoConfig, cintillosVisible, cintillo, topic, voiceEffect, voiceTarget, voiceMonitorActive, localStream, remoteCams, camStreamsMap, camMuted, isStreaming, isRecording]);

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
        [0, 1, 2, 3].forEach(slotIdx => {
          const roomCode = `studio_cam_${slotIdx + 1}`;
          cloudTransport.on('streamConnected', slotIdx, (stream, label) => {
            console.log(`[Cloud WebRTC] Cámara conectada en slot ${slotIdx + 1}:`, label);
            setSlotStreams(prev => ({ ...prev, [slotIdx]: stream }));
            setCameraMeta(prev => ({
              ...prev,
              [slotIdx]: { deviceId: `cloud_${slotIdx}`, label: label || `Celular Remoto (CAM ${slotIdx + 1})`, type: 'remote' }
            }));
            setMobileStatus(`Celular en vivo conectado en CAM ${slotIdx + 1}`);
          });
          cloudTransport.on('streamDisconnected', slotIdx => {
            console.log(`[Cloud WebRTC] Cámara desconectada en slot ${slotIdx + 1}`);
            delete assignedSlotsRef.current[slotIdx];
            setSlotStreams(prev => {
              const next = { ...prev };
              delete next[slotIdx];
              return next;
            });
            setMobileStatus('');
          });
          cloudTransport.connectSlot(slotIdx, roomCode);
        });
      } catch (e) {
        console.warn('Transporte cloud:', e);
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

            let targetSlot = null;
            for (let s = 1; s <= 3; s++) {
              const isBusy = Boolean(slotStreamsRef.current[s]) || (assignedSlotsRef.current[s] && assignedSlotsRef.current[s] !== deviceId);
              if (!isBusy) {
                targetSlot = s;
                break;
              }
            }
            if (targetSlot === null && !localStreamRef.current && !slotStreamsRef.current[0]) {
              targetSlot = 0;
            }
            if (targetSlot === null) targetSlot = 1;

            assignedSlotsRef.current[targetSlot] = deviceId;
            const assignedCam = targetSlot + 1;
            const assignedRoom = `studio_cam_${assignedCam}`;
            console.log(`[Auto-Dispatch Master] Asignando CAM ${assignedCam} (${assignedRoom}) a ${deviceId}`);

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
          console.warn('Error configurando auto-dispatch:', err);
        }
      }
    }

    if (window.api) {
      window.api.onMobileWsConnected((id) => setMobileStatus(`Celular conectado (${id}).`));
      
      window.api.onRemoteOffer(async ({ id, offer, slot, name, role }) => {
        console.log(`[WebRTC] Oferta recibida de celular: ${id}`);
        
        // Cerrar conexión anterior si existía para este ID
        if (peerConnections.current[id]) {
          try { peerConnections.current[id].close(); } catch (e) {}
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        peerConnections.current[id] = pc;

        const trackMap = new Map();
        const updateStream = () => {
          const liveTracks = Array.from(trackMap.values()).filter(t => t && t.readyState !== 'ended');
          if (liveTracks.length === 0) return;

          liveTracks.forEach(t => {
            try {
              if (t.kind === 'video') t.contentHint = 'motion';
              if (t.kind === 'audio') {
                t.contentHint = 'speech';
                t.enabled = true;
              }
            } catch {}
          });

          const stream = new MediaStream(liveTracks);
          stream.mobileId = id;
          console.log(`[WebRTC] Video en vivo recibido y enlazado de celular ${id} (tracks: ${liveTracks.length})`);

          setRemoteCams(prev => {
            const filtered = prev.filter(s => s.id !== id);
            return [...filtered, { id, stream, name: name || `Celular ${id.slice(-4)}` }];
          });

          let targetSlot = null;
          if (slot != null) {
            const parsed = parseInt(slot, 10) - 1;
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) {
              targetSlot = parsed;
            }
          }
          if (targetSlot === null) {
            for (let s = 1; s < 4; s++) {
              if (slotStreamsRef.current[s] && slotStreamsRef.current[s].mobileId === id) {
                targetSlot = s;
                break;
              }
            }
          }
          if (targetSlot === null) {
            for (let s = 1; s < 4; s++) {
              if (!slotStreamsRef.current[s]) {
                targetSlot = s;
                break;
              }
            }
          }
          if (targetSlot === null) targetSlot = 1;

          setSlotStreams(prevStreams => ({ ...prevStreams, [targetSlot]: stream }));
          setCameraMeta(prevMeta => ({
            ...prevMeta,
            [targetSlot]: {
              deviceId: id,
              label: name ? (role === 'student' ? `Alumno: ${name}` : name) : `Celular Wi-Fi (CAM ${targetSlot + 1})`,
              type: 'mobile'
            }
          }));
        };

        pc.ontrack = (event) => {
          if (event.receiver) {
            try {
              if ('playoutDelayHint' in event.receiver) event.receiver.playoutDelayHint = 0;
              if ('jitterBufferTarget' in event.receiver) event.receiver.jitterBufferTarget = 0;
            } catch (e) {}
          }
          if (event.track) {
            trackMap.set(event.track.id, event.track);
            event.track.onunmute = () => updateStream();
            event.track.onended = () => {
              trackMap.delete(event.track.id);
              updateStream();
            };
          }
          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach(t => {
              trackMap.set(t.id, t);
              t.onunmute = () => updateStream();
            });
          }
          updateStream();
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && window.api?.sendCandidate) {
            window.api.sendCandidate(id, e.candidate);
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log(`[WebRTC ${id}] Estado ICE:`, pc.iceConnectionState);
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
          console.log(`[WebRTC] Answer enviado a celular: ${id}`);
        } catch (err) {
          console.error(`[WebRTC] Error negociando conexión con ${id}:`, err);
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
        console.log(`[WebRTC] Celular desconectado: ${id}`);
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

    return () => {
      if (cloudTransport) { try { cloudTransport.destroy(); } catch {} }
      if (dispatchChannel && supabase) { try { supabase.removeChannel(dispatchChannel); } catch {} }
    };
  }, []);

  const handleMasterChunk = (buffer) => {
    if (isStreamingRef.current && window.api?.sendStreamChunk) {
      window.api.sendStreamChunk(buffer);
    }
    if (isRecordingRef.current) {
      recordingChunksRef.current.push(buffer);
      if (window.api?.sendRecordChunk) {
        window.api.sendRecordChunk(buffer);
      }
    }
  };

  const handleRecord = async () => {
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_RECORD');
      return;
    }
    if (!isRecording) {
      recordingChunksRef.current = [];
      setRecordingTime(0);
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(async () => {
        setCountdown(null);

        if (window.api) {
          const res = await window.api.startRecording({ projectName: topic || 'Proyecto_General' });
          if (res.success) {
            isRecordingRef.current = true;
            setIsRecording(true);

            // Inicializar señal master del compositor broadcast con 0 congelamiento
            startBroadcastEngine({
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
            }, handleMasterChunk);

            // Iniciar sesión de grabación dedicada para el Master con cabecera EBML limpia
            if (masterRecorderRef.current && masterRecorderRef.current.state !== 'inactive') {
              try { masterRecorderRef.current.stop(); } catch(e) {}
            }
            masterRecorderRef.current = createMasterRecordingSession((buf) => {
              if (isRecordingRef.current) {
                recordingChunksRef.current.push(buf);
                if (window.api?.sendRecordChunk) {
                  window.api.sendRecordChunk(buf);
                }
              }
            }, 500);

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
                        rec.ondataavailable = async (e) => {
                          if (e.data && e.data.size > 0 && window.api?.sendIsoChunk) {
                            const buf = await e.data.arrayBuffer();
                            window.api.sendIsoChunk({ slot: sNum, chunk: buf });
                          }
                        };
                        rec.start(1000);
                        isoRecordersRef.current.set(sNum, rec);
                      } catch (err) {
                        console.warn(`[ISO] Error iniciando recorder para CAM ${sNum}:`, err);
                      }
                    });
                  }
                }).catch(e => console.warn('[ISO] Fallo al iniciar ISO:', e));
              }
            }
          } else {
            isRecordingRef.current = false;
            if (!isStreamingRef.current) stopBroadcastEngine();
            alert('Error al iniciar grabación: ' + (res.error || 'Desconocido'));
          }
        } else {
          isRecordingRef.current = true;
          setIsRecording(true);
          startBroadcastEngine({
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
          }, handleMasterChunk);
        }
      }, 3000);
    } else {
      isRecordingRef.current = false;
      setIsRecording(false);

      // Capturar miniatura en alta resolución directamente del canvas maestro en vivo
      const snapshotCanvas = captureMasterCanvasSnapshot();
      let thumbnailDataUrl = null;
      if (snapshotCanvas) {
        try {
          thumbnailDataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.92);
        } catch (e) {
          console.warn('[handleRecord] No se pudo obtener toDataURL del canvas:', e);
        }
      }

      // Detener grabador dedicado del Master
      if (masterRecorderRef.current && masterRecorderRef.current.state !== 'inactive') {
        try { masterRecorderRef.current.stop(); } catch (e) {}
        masterRecorderRef.current = null;
      }

      // Detener y finalizar grabadores ISO multicanal (P4.1)
      isoRecordersRef.current.forEach((rec, sNum) => {
        try {
          if (rec.state !== 'inactive') rec.stop();
        } catch (e) {}
      });
      isoRecordersRef.current.clear();
      if (window.api?.stopIsoRecording) {
        try {
          await window.api.stopIsoRecording();
        } catch (e) {
          console.warn('[ISO] Error al detener grabación ISO:', e);
        }
      }

      let stopRes = null;
      if (window.api) {
        try {
          stopRes = await window.api.stopRecording();
          if (thumbnailDataUrl && window.api.saveRecordingThumbnail) {
            window.api.saveRecordingThumbnail({
              projectName: topic || 'Proyecto_General',
              base64Data: thumbnailDataUrl
            }).catch(e => console.warn('[App] Error guardando miniatura:', e));
          }
        } catch (e) {
          console.warn('Error parando grabación FFmpeg:', e);
        }
      }
      if (!isStreamingRef.current) stopBroadcastEngine();

      const chunks = recordingChunksRef.current;
      const recBlob = chunks.length > 0 ? new Blob(chunks, { type: 'video/webm' }) : null;
      const recUrl = recBlob ? URL.createObjectURL(recBlob) : null;

      const cleanTopicName = (topic || 'Episodio').replace(/[^\w\d-_]/g, '_');
      setRecordedVideoData({
        blob: recBlob,
        url: recUrl,
        snapshotCanvas,
        thumbnailDataUrl,
        filePath: stopRes?.path || null,
        projectName: stopRes?.projectName || topic || 'Proyecto_General',
        name: `PodcaStudio_${cleanTopicName}_${Date.now()}`,
        duration: recordingTime || 1,
      });
      setShowExportModal(true);
    }
  };

  const updateStreamConfig = (field, value) => { setStreamConfigs(prev => ({ ...prev, [activeStreamTab]: { ...prev[activeStreamTab], [field]: value } })); };
  const toggleDestination = () => { setStreamConfigs(prev => ({ ...prev, [activeStreamTab]: { ...prev[activeStreamTab], enabled: !prev[activeStreamTab].enabled } })); };

  const handleStream = async () => {
    if (!isElectronMaster) {
      dispatchRemoteCommand('TOGGLE_STREAM');
      return;
    }
    if (!isStreaming) {
      // Recolectar todos los destinos que estén habilitados y tengan clave de transmisión
      const activeTargets = Object.entries(streamConfigs)
        .filter(([_, cfg]) => cfg.enabled && cfg.key && cfg.key.trim().length > 0)
        .map(([id, cfg]) => {
          let server = (cfg.server || '').trim();
          let key = (cfg.key || '').trim();

          // Si el usuario pegó la URL completa en el campo de clave, separarla automáticamente
          if (key.startsWith('rtmp://') || key.startsWith('rtmps://')) {
            const lastSlash = key.lastIndexOf('/');
            if (lastSlash > 8) {
              server = key.substring(0, lastSlash + 1);
              key = key.substring(lastSlash + 1);
            }
          }

          if (id === 'facebook') {
            if (server.startsWith('rtmp://')) {
              server = server.replace('rtmp://', 'rtmps://');
            }
            if (!server) {
              server = 'rtmps://live-api-s.facebook.com:443/rtmp/';
            }
          }
          if (!server.endsWith('/')) server += '/';
          return {
            id,
            name: id === 'facebook' ? 'Facebook Live' : id === 'youtube' ? 'YouTube Live' : id === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado',
            url: server + key
          };
        });

      if (activeTargets.length === 0) {
        return alert('Para emitir en vivo, debes habilitar al menos un destino (Facebook, YouTube, TikTok o RTMP) y escribir su Clave de Transmisión (Stream Key).');
      }

      // 1. Asegurar que el compositor broadcast esté activo y generando el Master con 0 retraso
      startBroadcastEngine({
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
      }, handleMasterChunk);

      const initHeader = getInitHeader();

      if (window.api) {
        const res = await window.api.startStreaming({
          destinations: activeTargets,
          initialHeader: initHeader ? Array.from(new Uint8Array(initHeader)) : null
        });

        if (res.success) {
          isStreamingRef.current = true;
          setIsStreaming(true);
          setActiveLiveDestinations(activeTargets);
          setShowStreamModal(false);
        } else {
          isStreamingRef.current = false;
          if (!isRecordingRef.current) stopBroadcastEngine();
          alert('Error al conectar con Facebook / Servidor RTMP: ' + (res.error || 'Verifica la clave de transmisión y conexión'));
        }
      } else {
        isStreamingRef.current = true;
        setIsStreaming(true);
        setActiveLiveDestinations(activeTargets);
        setShowStreamModal(false);
      }
    } else {
      isStreamingRef.current = false;
      if (window.api) await window.api.stopStreaming();
      setIsStreaming(false);
      setActiveLiveDestinations([]);
      if (!isRecordingRef.current) stopBroadcastEngine();
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
        rightPrompterScrollPos.current = 0;
        if (rightPrompterScrollRef.current) rightPrompterScrollRef.current.scrollTop = 0;
        teleprompterYRef.current = window.innerHeight;
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
          rightPrompterScrollPos.current = 0;
          if (rightPrompterScrollRef.current) rightPrompterScrollRef.current.scrollTop = 0;
          teleprompterYRef.current = window.innerHeight;
        } catch (error) { alert("Error al leer archivo Word (.docx)."); }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = null; 
  };

  const handleWordUpload = handleTeleprompterFileUpload;

  const handlePrompterReset = () => {
    rightPrompterScrollPos.current = 0;
    if (rightPrompterScrollRef.current) {
      rightPrompterScrollRef.current.scrollTop = 0;
    }
    teleprompterYRef.current = window.innerHeight;
    if (teleprompterTextRef.current) {
      teleprompterTextRef.current.style.transform = `translateY(${window.innerHeight}px)`;
    }
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
    rightPrompterScrollPos.current = 0;
    if (rightPrompterScrollRef.current) {
      rightPrompterScrollRef.current.scrollTop = 0;
    }
    teleprompterYRef.current = window.innerHeight;
    if (teleprompterTextRef.current) {
      teleprompterTextRef.current.style.transform = `translateY(${window.innerHeight}px)`;
    }
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

  // Dispositivos de video USB
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === 'videoinput');
        setCameraDevices(cams);
      } catch (e) {}
    };
    fetchDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', fetchDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', fetchDevices);
  }, []);

  const handleUsbConnect = async (deviceId, slot, label) => {
    // Si la cámara ya está activa en este slot con el mismo deviceId, mantenerla
    const currentStream = slotStreams[slot] || (slot === 0 ? localStream : null);
    const activeVideoTrack = currentStream?.getVideoTracks()?.[0];
    const activeDevId = activeVideoTrack?.getSettings?.()?.deviceId;

    if (activeVideoTrack && activeVideoTrack.readyState === 'live' && (activeDevId === deviceId || !deviceId)) {
      setSlotStreams(prev => ({ ...prev, [slot]: currentStream }));
      setCameraMeta(prev => ({ ...prev, [slot]: { deviceId, label: label || 'Cámara USB', type: 'usb' } }));
      if (slot === 0) setLocalStream(currentStream);
      return currentStream;
    }

    // Detener tracks anteriores para liberar el bloqueo exclusivo del driver de Windows
    try {
      if (slotStreams[slot]) {
        slotStreams[slot].getTracks().forEach(t => t.stop());
      }
      if (slot === 0 && localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      // Detener cualquier otro stream que tenga el mismo slot
      Object.entries(slotStreams || {}).forEach(([sKey, sStream]) => {
        if (sStream && Number(sKey) === slot) {
          sStream.getTracks().forEach(t => t.stop());
        }
      });
    } catch (e) {}

    // Pausa breve para que Windows DirectShow libere el hardware
    await new Promise(r => setTimeout(r, 120));

    let stream = null;
    const attempts = [
      // 1. Device ID específico en 1080p ideal (flexible sin 'min' que lance OverconstrainedError)
      { video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
      // 2. Device ID específico en 720p ideal
      { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      // 3. Device ID específico sin restricción de resolución (modo nativo del sensor/driver)
      { video: { deviceId: { exact: deviceId } }, audio: false },
      // 4. Device ID relajado
      { video: { deviceId: deviceId }, audio: false },
      // 5. Con audio si está disponible en el mismo dispositivo
      { video: { deviceId: deviceId }, audio: true },
      // 6. Genérico básico
      { video: true, audio: false }
    ];

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {}
    }

    if (stream) {
      // Si el slot es 0 (Master) y no tiene track de audio, intentar vincular el micrófono por separado sin bloquear el video
      if (slot === 0 && stream.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (micStream && micStream.getAudioTracks().length > 0) {
            stream.addTrack(micStream.getAudioTracks()[0]);
          }
        } catch (e) {}
      }

      const vTrack = stream.getVideoTracks()[0];
      if (vTrack && vTrack.applyConstraints) {
        try {
          await vTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
        } catch (_) {}
      }

      setSlotStreams(prev => ({ ...prev, [slot]: stream }));
      setCameraMeta(prev => ({ ...prev, [slot]: { deviceId, label: label || 'Cámara USB', type: 'usb' } }));
      saveCameraToHistory({ deviceId, label: label || 'Cámara USB', type: 'usb' });
      if (slot === 0) setLocalStream(stream);
      return stream;
    } else {
      console.error("Error: No se pudo abrir la cámara tras intentar todas las combinaciones");
      return null;
    }
  };

  const createWifiMediaStream = async (url) => {
    return new Promise((resolve, reject) => {
      let effectiveUrl = url;
      const isRtsp = url && url.startsWith('rtsp://');
      if (isRtsp) {
        const host = window.location.hostname || 'localhost';
        effectiveUrl = `http://${host}:3001/api/rtsp-stream?url=${encodeURIComponent(url)}`;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
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

        const renderFrame = () => {
          if (!isAlive) return;
          if (!isMjpegStream && video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } else if (img && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
        console.warn('[WiFi Stream Image Error]:', e);
        if (!resolved) {
          resolved = true;
          isAlive = false;
          if (checkInterval) clearInterval(checkInterval);
          clearTimeout(failTimeout);
          try { img.src = ''; } catch (err) {}
          reject(new Error('La cámara rechazó la conexión (Error 404/Sin señal). Consulta la guía Steren o el visor oficial.'));
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
          reject(new Error('Tiempo de espera agotado. Verifica que la cámara esté encendida, con ONVIF activado en la app Steren y contraseña correcta.'));
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
      const stream = await createWifiMediaStream(url);
      if (stream) {
        setSlotStreams(prev => ({ ...prev, [slot]: stream }));
        if (slot === 0) setLocalStream(stream);
      }
      setCameraMeta(prev => ({
        ...prev,
        [slot]: { url, label: label || `WiFi Cam ${slot + 1}`, type: 'wifi' }
      }));
      saveCameraToHistory({ url, label: label || `WiFi Cam ${slot + 1}`, type: 'wifi' });
      return stream;
    } catch (err) {
      console.error('Error conectando cámara WiFi:', err);
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
      const stream = await navigator.mediaDevices.getUserMedia({
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
      console.error('Error conectando ventana de escritorio:', err);
      throw err;
    }
  };

  const handleAssignRemoteStream = (remoteStream, slot, label, meta = {}) => {
    if (slotStreams[slot] && slotStreams[slot] !== remoteStream) {
      try { slotStreams[slot].getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    setSlotStreams(prev => ({ ...prev, [slot]: remoteStream }));
    setCameraMeta(prev => ({
      ...prev,
      [slot]: { deviceId: meta.id || `remote_${slot}`, label: label || `Cámara ${slot + 1}`, type: 'remote', ...meta }
    }));
    saveCameraToHistory({ deviceId: meta.id || `remote_${slot}`, label: label || `Cámara ${slot + 1}`, type: 'remote' });
    if (slot === 0) setLocalStream(remoteStream);
  };

  const handleReconnectSavedCamera = useCallback(async (savedCam) => {
    if (!savedCam) return;
    const freeSlot = camSlots.find(s => !slotStreams[s - 1]) || activeCam;
    const targetIdx = freeSlot - 1;
    if (savedCam.type === 'wifi' && savedCam.url) {
      await handleWifiConnect(savedCam.url, targetIdx, savedCam.name || savedCam.label);
    } else if (savedCam.type === 'usb' && savedCam.deviceId) {
      await handleUsbConnect(savedCam.deviceId, targetIdx, savedCam.name || savedCam.label);
    }
  }, [camSlots, slotStreams, activeCam, handleWifiConnect, handleUsbConnect]);

  const handleDisconnectSlot = (slot) => {
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
    setCameraMeta(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
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
    setActiveCam(camId);
    if (layoutMode === 'pip') {
      if (pipCam === camId) {
        const altPip = camSlots.find(id => id !== camId) || (camId === 1 ? 2 : 1);
        setPipCam(altPip);
      }
    } else {
      setLayoutMode('1');
    }
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
      setActiveCam(altMaster);
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
          console.log('[RemoteExtension] Conectado a Master PC en:', wsUrl);
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

    return (
      <div className="w-full h-full relative overflow-hidden bg-[#050505]">
        {camSlots.map((id) => {
          let tileClass = "absolute transition-none";
          let tileStyle = {};
          const idx = camSlots.indexOf(id);

          if (layoutMode === '1') {
            if (id === effectiveActiveCam) {
              tileClass += " inset-0 w-full h-full z-10 pointer-events-auto opacity-100";
            } else if (id === pvwCam && tBarPosition > 0 && !overrideCam) {
              tileClass += " inset-0 w-full h-full z-20 pointer-events-auto";
              tileStyle.opacity = tBarPosition;
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
            }
          } else if (layoutMode === 'pip') {
            if (id === effectiveActiveCam) {
              tileClass += " inset-0 w-full h-full z-10 pointer-events-auto opacity-100";
            } else if (id === effectivePipCam) {
              tileClass += " top-[3.7%] right-[2.1%] w-[24%] aspect-video border-2 border-orange-500 rounded-lg z-20 overflow-hidden shadow-2xl pointer-events-auto opacity-100 bg-black";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
            }
          } else if (layoutMode === '2') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
            }
          } else if (layoutMode === 'two-shot') {
            if (idx === 0) {
              tileClass += " left-[2%] top-[8%] w-[47%] h-[84%] rounded-xl overflow-hidden shadow-2xl border border-orange-500/40 z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-[2%] top-[8%] w-[47%] h-[84%] rounded-xl overflow-hidden shadow-2xl border border-orange-500/40 z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
            }
          } else if (layoutMode === '3') {
            if (idx === 0) {
              tileClass += " left-0 top-0 w-[calc(50%-3px)] h-full z-10 pointer-events-auto opacity-100";
            } else if (idx === 1) {
              tileClass += " right-0 top-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else if (idx === 2) {
              tileClass += " right-0 bottom-0 w-[calc(50%-3px)] h-[calc(50%-3px)] z-10 pointer-events-auto opacity-100";
            } else {
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
                tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
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
              tileClass += " inset-0 w-full h-full z-0 pointer-events-none opacity-0";
            }
          }

          return (
            <div key={`cam-persistent-slot-${id}`} className={tileClass} style={tileStyle}>
              <VideoTile {...getTileProps(id)} className="w-full h-full" />
            </div>
          );
        })}
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
      className="flex flex-col h-screen h-[100dvh] max-h-screen w-screen max-w-full bg-[#0a0a0a] text-[#e0e0e0] font-sans overflow-hidden text-[13px] select-none"
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
            <span className="text-orange-500 font-extrabold text-xs shrink-0">1080p · 30fps</span>

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
                className="relative w-full h-full max-w-full max-h-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#222530] shadow-2xl"
                style={{
                  aspectRatio: '16 / 9',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
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


              {/* CINTILLO BROADCAST TRANSLÚCIDO 3D (Solo en PC Master; iPad ya lo recibe en el fotograma PGM sin encimar recuadros) */}
              {isElectronMaster && cintillosVisible && cintillo?.active && (
                <CintilloOverlay
                  styleId={cintilloStyle}
                  tag={cintillo.tag || 'TEMA'}
                  text={cintillo.text || topic}
                  subtitle={cintillo.subtitle || ''}
                  accentColor={cintillo.color}
                  logoUrl={cintillo.logoUrl || null}
                  presetId={cintillo.presetId}
                  position={cintilloPosition}
                  size="large"
                  format="16:9"
                  liveOn={isStreaming || isRecording}
                  animPhase={animPhase}
                  animKey={animKey}
                  onClose={() => setCintillosVisible(false)}
                />
              )}

              {/* TELEPROMPTER FLUIDO */}
              {activePanel === 'teleprompter' && (!isRecording || !teleprompterHideInRec) && (
                  <div className="absolute inset-0 overflow-hidden z-30 pointer-events-none">
                    <div 
                      ref={teleprompterTextRef}
                      className="absolute top-0 w-[90%] left-[5%] text-center font-bold text-white whitespace-pre-wrap leading-relaxed"
                      style={{ 
                        textShadow: '2px 2px 6px rgba(0,0,0,0.9)',
                        fontSize: `${teleprompterFontSize}px`,
                        transform: `translateY(100vh)`
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
                className={`w-[210px] h-[130px] rounded-xl border-2 flex flex-col shrink-0 relative group overflow-hidden transition-all shadow-md ${
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
                   {camStream ? (
                     <VideoTile stream={camStream} isLocal={camId === 1} muted={true} className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" style={style} chromaKey={chromaKeyActive} bgImage={virtualBg} />
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
                <div className="absolute top-0 inset-x-0 z-20 flex justify-between items-center px-2 py-1 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-auto select-none">
                  {/* CAM IDENTIFIER CON TALLY BROADCAST */}
                  <div className="flex items-center gap-1.5 drop-shadow">
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
                  </div>

                  {/* INDICADOR DE AUDIO, VUMETRO EN TIEMPO REAL Y BOTONES DE CONTROL */}
                  <div className="flex items-center gap-1 drop-shadow">
                    {(() => {
                      const audioInfo = camAudioLevels[camId] || { hasMic: false, level: 0, isMuted: false };
                      if (!audioInfo.hasMic) {
                        return (
                          <div 
                            className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/40 text-gray-400 cursor-not-allowed select-none" 
                            title="Esta cámara no cuenta con micrófono detectado"
                          >
                            <MicOff size={9} className="opacity-40" />
                            <span className="text-[7.5px] font-semibold opacity-40">Sin mic</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMuteCam(camId);
                          }}
                          className={`px-1 py-0.5 rounded flex items-center gap-1 transition-all ${
                            audioInfo.isMuted 
                              ? 'bg-red-950/80 text-red-400 border border-red-600/70 shadow-sm animate-pulse' 
                              : 'bg-black/50 hover:bg-[#222] text-emerald-400 border border-emerald-900/40'
                          }`}
                          title={
                            audioInfo.isMuted 
                              ? 'Micrófono SILENCIADO · Clic para activar' 
                              : 'Micrófono ACTIVO · Clic para silenciar (ideal si usas micrófono externo para no duplicar sonido)'
                          }
                        >
                          {audioInfo.isMuted ? (
                            <>
                              <MicOff size={9} className="text-red-400" />
                              <span className="text-[7.5px] font-bold text-red-400">MUTE</span>
                            </>
                          ) : (
                            <>
                              <Mic size={9} className="text-emerald-400 shrink-0" />
                              {/* VUMETRO DE PERCEPCIÓN DE AUDIO */}
                              <div className="w-5 h-1 bg-[#141414] rounded-full overflow-hidden flex items-center border border-[#2a2a2a]">
                                <div 
                                  className={`h-full rounded-full transition-all duration-75 ${
                                    audioInfo.level > 70 ? 'bg-red-500' : audioInfo.level > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`} 
                                  style={{ width: `${Math.max(8, audioInfo.level)}%` }} 
                                />
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })()}

                    {/* BOTÓN DE BOCINA DE RETORNO / MONITOREO LOCAL */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSpeakerCam(camId);
                      }}
                      className={`p-1 rounded flex items-center justify-center transition-all ${
                        camSpeakerMuted[camId]
                          ? 'bg-red-950/70 text-red-400 hover:bg-red-900/80 border border-red-700/50'
                          : 'bg-black/50 text-emerald-400 hover:bg-[#222] border border-emerald-800/40'
                      }`}
                      title={
                        camSpeakerMuted[camId]
                          ? `Bocina local de CAM ${camId} SILENCIADA · Clic para escuchar`
                          : `Bocina local de CAM ${camId} ACTIVA · Clic para silenciar en tus altavoces`
                      }
                    >
                      {camSpeakerMuted[camId] ? (
                        <VolumeX size={10} className="text-red-400" />
                      ) : (
                        <Volume2 size={10} className="text-emerald-400" />
                      )}
                    </button>

                    {/* BOTÓN CONEXIONES (USB / WIFI / QR) */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConnectModalSlot(camId - 1); setShowConnectModal(true); }} 
                      className="text-gray-300 hover:text-orange-400 hover:bg-black/60 rounded p-0.5 transition-colors" 
                      title="Configurar Entrada de Video (USB / WiFi IP / QR Celular)"
                    >
                      <Video size={11} />
                    </button>

                    {/* BOTÓN ENGRANE DE CONFIGURACIÓN Y CALIBRACIÓN COMPLETA */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openCalibrator(camId); }} 
                      className="text-gray-300 hover:text-white hover:bg-black/60 rounded p-0.5 transition-colors" 
                      title="Configuración y Ajustes de Cámara (Zoom, Enfoque, LUTs, Color, Guías)"
                    >
                      <Settings size={11} />
                    </button>

                    {/* BOTÓN RÓTULO DE NOMBRE (ESTILO RESTREAM / INVITADOS / CLASES) */}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setBadgeModalSlot(camId); 
                        setShowBadgeModal(true); 
                      }} 
                      className={`p-0.5 rounded transition-colors ${
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
                      className="text-gray-300 hover:text-red-400 hover:bg-red-500/20 rounded p-0.5 transition-colors" 
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
                          onChange={e => setAutoRotateCintillos(e.target.checked)} 
                          className="accent-orange-500 w-4 h-4 cursor-pointer" 
                          title="Rotar automáticamente tema, invitado, conductor y redes cada 10 segundos"
                        />
                      </div>
                    </div>

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
                        title="Proyectar ventana HUD de lectura sobre la toma de cámara"
                      >
                        <Monitor size={10} /> {showFloatingPrompter ? 'HUD Activo' : 'HUD Cámara'}
                      </button>
                    </div>

                    {/* Barra de Transporte Principal */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsTeleprompterPlaying(p => !p)}
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
                          onClick={() => setIsTeleprompterPlaying(p => !p)}
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
                onClick={() => { 
                  setConnectModalSlot(activeCam - 1); 
                  setShowConnectModal(true); 
                }} 
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
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 text-xs transition-all cursor-pointer ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 animate-pulse' 
                    : countdown !== null 
                      ? 'bg-orange-600 text-white animate-pulse' 
                      : 'bg-red-700 hover:bg-red-600 text-white shadow-md'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square size={14} className="fill-white" />
                    <span>DETENER GRABACIÓN</span>
                    <span className="font-mono bg-black/40 px-2 py-0.5 rounded text-[11px] ml-1">
                      {formatTime(recordingTime)}
                    </span>
                  </>
                ) : countdown !== null ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>INICIANDO EN {countdown}...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-white" />
                    <span>INICIAR GRABACIÓN</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* LÍNEA Y BARRA INFERIOR DE DELIMITACIÓN DEL PROYECTO Y VERSIÓN */}
      <footer className="h-6 bg-[#08080a] border-t border-[#262626] px-4 flex justify-between items-center text-[10.5px] text-gray-400 shrink-0 z-30 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
          <span className="font-bold text-gray-200 tracking-wider">PODCASTUDIO v1.2.5</span>
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
              <div className="border border-[#2a2b30] rounded-lg p-5 bg-[#161920]">
                
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-bold text-white flex items-center gap-2 capitalize">
                     {activeStreamTab === 'facebook' && <Facebook size={18} className="text-blue-500"/>}
                     {activeStreamTab === 'youtube' && <Youtube size={18} className="text-red-500"/>}
                     {activeStreamTab === 'tiktok' && <Music size={18} className="text-cyan-400"/>}
                     {activeStreamTab === 'custom' && <Settings size={18} className="text-purple-400"/>}
                     {activeStreamTab === 'custom' ? 'RTMP Personalizado (Twitch/Kick)' : `${activeStreamTab} Live`}
                  </h3>
                  <div className="flex items-center gap-2 cursor-pointer" onClick={toggleDestination}>
                    <div className={`w-8 h-4 rounded-full relative transition-colors ${streamConfigs[activeStreamTab].enabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${streamConfigs[activeStreamTab].enabled ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                    <span className="text-xs text-white font-bold">Destino Habilitado</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 mb-1 block">URL del Servidor RTMP / RTMPS:</label>
                    <input type="text" value={streamConfigs[activeStreamTab].server} onChange={e => updateStreamConfig('server', e.target.value)} className="w-full bg-[#0a0c10] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 mb-1 flex justify-between">
                      <span>Clave de Transmisión (Stream Key):</span>
                      <button onClick={() => setShowKey(!showKey)} className="text-gray-500 hover:text-white flex items-center gap-1"><Eye size={12}/> {showKey ? 'Ocultar' : 'Mostrar'}</button>
                    </label>
                    <input type={showKey ? 'text' : 'password'} placeholder="Pega aquí tu Stream Key secreta..." value={streamConfigs[activeStreamTab].key} onChange={e => updateStreamConfig('key', e.target.value)} className="w-full bg-[#0a0c10] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="mt-4 p-3 bg-[#0a0c10] border border-[#222] rounded flex items-start gap-2">
                   <div className="mt-0.5 text-orange-500"><CheckCircle size={14}/></div>
                   <div className="text-[10px] text-gray-400 leading-relaxed">
                      {activeStreamTab === 'facebook' && "Dónde encontrar tu clave de Facebook Live: Ve a Meta Business Suite > Live Producer. Selecciona \"Usar clave de transmisión\" y copia tu URL RTMPS y Clave de stream permanente."}
                      {activeStreamTab === 'youtube' && "Dónde encontrar tu clave de YouTube Live: Entra a YouTube Studio > Crear > Emitir en directo. En la pestaña \"Emisión\" copia tu Clave de emisión y pégala arriba."}
                      {activeStreamTab === 'tiktok' && "Dónde encontrar tu clave de TikTok Live: Disponible en TikTok Live Studio o para cuentas con acceso a RTMP Streaming en el Centro de Creadores Live de TikTok."}
                      {activeStreamTab === 'custom' && "Servidor RTMP Personalizado: Compatible con Twitch (rtmp://live.twitch.tv/app/), Kick, Twitter/X o retransmisores locales como OBS Studio."}
                   </div>
                </div>

              </div>
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
              <button onClick={handleStream} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-900/20 transition-colors">
                 <Wifi size={14}/> {isStreaming ? 'Detener Transmisión' : 'Iniciar Transmisión En Vivo'}
              </button>
            </div>

          </div>
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
        initialSlot={calibratorTargetSlot}
        slotsCount={camSlots.length}
        streams={camSlots.map(id => getCamStream(id))}
        cameraMeta={cameraMeta}
        crops={cameraCrops}
        masterCameraSlot={activeCam - 1}
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
                    alert('¡Enlace del Control Remoto copiado al portapapeles!');
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
        onOpenConnectModal={() => {
          setConnectModalSlot(activeCam - 1);
          setShowConnectModal(true);
        }}
      />

      {/* MODAL DE EXPORTACIÓN Y DESCARGA MULTI-FORMATO (FACEBOOK, YOUTUBE, TIKTOK, INSTAGRAM) */}
      <MultiFormatExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        recording={recordedVideoData}
        highlights={highlights}
        onDownloadMp4={async (rec) => {
          if (window.api?.openRecordingsFolder) {
            window.api.openRecordingsFolder(rec?.projectName || topic || 'Proyecto_General');
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
        onSelectCam={(c) => { setActiveCam(c); updateBroadcastState({ activeCam: c }); }}
        onSelectPvw={(c) => { setPvwCam(c); updateBroadcastState({ pvwCam: c }); }}
      />

      {/* TELEPROMPTER HUD FLOTANTE BROADCAST (P3.2) */}
      <BroadcastTeleprompter
        isOpen={showFloatingPrompter}
        onClose={() => setShowFloatingPrompter(false)}
        initialText={teleprompterText}
        lanUrl={qrCodeUrl}
      />



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
    </div>
  );
}

export default function App() { return <ErrorBoundary><PodcastStudioApp /></ErrorBoundary>; }