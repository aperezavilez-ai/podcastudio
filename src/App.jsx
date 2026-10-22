import React, { useState, useRef, useEffect, useMemo, Component } from 'react';
import { 
  Video, Mic, MicOff, Sparkles, Settings, Play, Square, QrCode, Share2, Camera, 
  Sliders, Volume2, Users, LayoutGrid, Plus, Headphones, Wifi, Search, 
  Grid, Eye, EyeOff, X, Copy, Link, Mail, MessageCircle, Globe, Sun, Disc, Smartphone, 
  CheckCircle, Download, UploadCloud, Image as ImageIcon, FileVideo, AudioLines, Monitor,
  BookOpen, Type, Layers, Music, ChevronRight, ChevronLeft, PanelRight, ChevronDown,
  PlayCircle, PauseCircle, Upload, Facebook, Youtube, Instagram, VolumeX, Sparkle, RefreshCw,
  Radio, Tv, Trash2
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
import { startBroadcastEngine, updateBroadcastState, stopBroadcastEngine } from './utils/masterBroadcastEngine.js';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div style={{ color: 'red', padding: '20px', backgroundColor: 'black', height: '100vh' }}><h1> Error:</h1><pre>{this.state.error.toString()}</pre></div>;
    return this.props.children;
  }
}

const VideoTile = React.forwardRef(({ stream, isLocal, label, className, onClick, style, chromaKey, bgImage }, ref) => {
  const internalRef = useRef(null);
  const videoRef = ref || internalRef;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.log("Play error:", e));
    }
  }, [stream, videoRef]);

  return (
    <div className={`relative overflow-hidden bg-[#050505] flex items-center justify-center ${className} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      {chromaKey && bgImage && <img src={bgImage} className="absolute inset-0 w-full h-full object-cover z-0" alt="Virtual BG" />}
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className={`w-full h-full object-cover transition-all duration-300 ${chromaKey ? 'relative z-10 mix-blend-screen' : ''}`} style={{...style, filter: chromaKey ? `${style?.filter || ''} contrast(1.5) brightness(1.1)` : style?.filter }} />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-500 w-full h-full bg-[#111] z-10">
          <Camera size={24} className="mb-2 opacity-50" />
          <span className="text-[10px] uppercase tracking-wider">Sin señal</span>
        </div>
      )}
      {label && <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold z-20 border border-[#333] text-white">{label}</div>}
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

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState('');
  const togglePanel = (panel) => setActivePanel(activePanel === panel ? '' : panel);

  const [camSlots, setCamSlots] = useState([1, 2, 3, 4]); 
  const [activeCam, setActiveCam] = useState(1);
  const [layoutMode, setLayoutMode] = useState('1'); 
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

  // CALIBRADOR Y MONITOR PREVIEW (PVW) INDEPENDIENTE
  const [showCalibratorModal, setShowCalibratorModal] = useState(false);
  const [calibratorTargetSlot, setCalibratorTargetSlot] = useState(0);
  const [cameraCrops, setCameraCrops] = useState(() => {
    const saved = localStorage.getItem('podcastudio_camera_crops');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });
  const [camMuted, setCamMuted] = useState({ 1: false, 2: false, 3: false, 4: false });

  // TELEPROMPTER
  const [teleprompterText, setTeleprompterText] = useState('Hoy hablamos de: El futuro del podcasting y la IA\n\nCon nosotros: Invitado Especial\n\nIntroduce el tema, desarrolla los puntos clave y cierra con una llamada a la acción.');
  const [isTeleprompterPlaying, setIsTeleprompterPlaying] = useState(false);
  const [teleprompterHideInRec, setTeleprompterHideInRec] = useState(true);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(40);
  const teleprompterTextRef = useRef(null);
  const teleprompterYRef = useRef(0);

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
      youtube: { server: 'rtmp://a.rtmp.youtube.com/live2/', key: '', enabled: true },
      tiktok: { server: 'rtmp://live.tiktok.com/live/', key: '', enabled: true },
      custom: { server: 'rtmp://live.twitch.tv/app/', key: '', enabled: true }
    };
  });
  useEffect(() => { localStorage.setItem('podcastStudio_streamConfigs', JSON.stringify(streamConfigs)); }, [streamConfigs]);

  const [activeLiveDestinations, setActiveLiveDestinations] = useState([]);
  const [streamDuration, setStreamDuration] = useState(0);
  const isStreamingRef = useRef(false);
  const isRecordingRef = useRef(false);

  // SISTEMA DE AUDIO & EFECTOS (Importado de PODCASTUDIO)
  const music = useBackgroundMusic(MUSIC_TRACKS, 25, { micLevel });
  const { playSfx, stopSfx, playingSfxId, sfxError } = useSoundEffect();

  // SISTEMA DE CINTILLOS Y GRÁFICOS BROADCAST (Importado de PODCASTUDIO)
  const [cintillosVisible, setCintillosVisible] = useState(true);
  const [cintilloStyle, setCintilloStyle] = useState('glass');
  const [cintilloPosition, setCintilloPosition] = useState('bl');
  const [autoRotateCintillos, setAutoRotateCintillos] = useState(false);
  const [showCintilloModal, setShowCintilloModal] = useState(false);
  const [showSocialsModal, setShowSocialsModal] = useState(false);
  const [socialTarget, setSocialTarget] = useState('guest'); // 'guest' | 'program'
  const [activeSocialTab, setActiveSocialTab] = useState('guest');

  const [hostName, setHostName] = useState('Luis Avilez');
  const [hostRole, setHostRole] = useState('Conductor & Productor');
  const [guestName, setGuestName] = useState('Invitado Especial');
  const [guestRole, setGuestRole] = useState('Especialista en IA & Media');
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

  const [logoBase64, setLogoBase64] = useState(null);
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

  // Activar cintillo de conductor al iniciar la app
  useEffect(() => {
    if (cintillosVisible && !cintillo.active) {
      showManual('host');
    }
  }, []);

  // ESCENARIOS Y CROMA KEY
  const [chromaKeyActive, setChromaKeyActive] = useState(false);
  const [virtualBg, setVirtualBg] = useState('https://images.unsplash.com/photo-1598550476439-6847785fce6b?auto=format&fit=crop&w=1920&q=80');

  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamTab, setActiveStreamTab] = useState('facebook');
  const [showKey, setShowKey] = useState(false);

  const [localStream, setLocalStream] = useState(null);
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

  const addCam = () => { const nextId = Math.max(...camSlots, 0) + 1; setCamSlots([...camSlots, nextId]); setCamSettings({ ...camSettings, [nextId]: { ...defaultCamSettings } }); };
  const removeCam = (id) => { if (id === 1) return; setCamSlots(camSlots.filter(c => c !== id)); if (activeCam === id) setActiveCam(1); };
  
  const getCamStream = (id) => { 
    const slotIdx = id - 1;
    if (slotStreams[slotIdx]) return slotStreams[slotIdx];
    if (id === 1) return localStream; 
    if (id === 2) return remoteCams[0]?.stream; 
    return remoteCams[camSlots.indexOf(id) - 1]?.stream; 
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
  };
  
  const getVideoStyle = (camId) => {
    const s = camSettings[camId] || defaultCamSettings;
    const crop = cameraCrops[camId - 1] || {};

    const zoom = crop.zoom ?? s.zoom ?? 1.0;
    const focusX = crop.focusX ?? (s.panX != null ? s.panX / 100 : 0.5);
    const focusY = crop.focusY ?? (s.panY != null ? s.panY / 100 : 0.42);

    const filter = buildCanvasFilter({
      brightness: crop.brightness ?? s.brightness,
      contrast: crop.contrast ?? s.contrast,
      saturation: crop.saturation ?? s.saturation,
      warmth: crop.warmth ?? s.temp,
      tint: crop.tint ?? 0,
    });

    const isZoomed = zoom > 1.02 || Math.abs(focusX - 0.5) > 0.02 || Math.abs(focusY - 0.42) > 0.03;
    return {
      transform: isZoomed ? `scale(${zoom})` : 'none',
      transformOrigin: `${Math.round(focusX * 100)}% ${Math.round(focusY * 100)}%`,
      filter: filter !== 'none' ? filter : undefined,
    };
  }; 

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        }).catch(async () => {
          return await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
        });

        if (stream) {
          setLocalStream(stream);
          setSlotStreams(prev => ({ ...prev, 0: stream }));
          const videoTrack = stream.getVideoTracks()[0];
          const devId = videoTrack?.getSettings?.()?.deviceId;
          const devLabel = videoTrack?.label || 'Cámara 1 (Principal)';
          setCameraMeta(prev => ({ ...prev, 0: { deviceId: devId, label: devLabel, type: 'usb' } }));

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
    if (isRecording) timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    else setRecordingTime(0);
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

  // Sincronización en tiempo real del Master Compositor mientras se graba o transmite
  useEffect(() => {
    if (isStreaming || isRecording) {
      updateBroadcastState({
        activeCam,
        camSlots,
        layoutMode,
        chromaKeyActive,
        virtualBg,
        logoBase64,
        cintillosVisible,
        cintillo,
        topic,
        getCamStream,
        localStream,
        remoteCams,
        camStreamsMap,
        camMuted,
      });
    }
  }, [activeCam, camSlots, layoutMode, chromaKeyActive, virtualBg, logoBase64, cintillosVisible, cintillo, topic, localStream, remoteCams, camStreamsMap, camMuted, isStreaming, isRecording]);

  useEffect(() => {
    if (window.api) {
      window.api.getQrUrl().then(url => {
        setQrCodeUrl(url);
        QRCode.toDataURL(url, { width: 250, margin: 2 }).then(img => setQrCodeImage(img));
      });
      window.api.onMobileWsConnected((id) => setMobileStatus(`Celular conectado (${id}).`));
      
      window.api.onRemoteOffer(async ({ id, offer }) => {
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

        // Declarar transceptores en modo recepción exclusivamente (evita que la PC intente enviar video al celular)
        try {
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });
        } catch (e) {}

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const stream = event.streams[0];
            console.log(`[WebRTC] Video en vivo recibido de celular ${id}`);

            setRemoteCams(prev => {
              const filtered = prev.filter(s => s.id !== id);
              return [...filtered, { id, stream }];
            });

            // Asignar automáticamente al slot de CAM 2 (slot 1) o al siguiente slot libre
            setSlotStreams(prevStreams => {
              let targetSlot = 1; // Comenzar en slot 1 (CAM 2)
              while (targetSlot < 4 && prevStreams[targetSlot] && prevStreams[targetSlot].mobileId && prevStreams[targetSlot].mobileId !== id) {
                targetSlot++;
              }
              if (targetSlot > 3) targetSlot = 1;
              stream.mobileId = id;
              return { ...prevStreams, [targetSlot]: stream };
            });

            setCameraMeta(prevMeta => {
              let targetSlot = 1;
              while (targetSlot < 4 && prevMeta[targetSlot] && prevMeta[targetSlot].deviceId && prevMeta[targetSlot].deviceId !== id && prevMeta[targetSlot].type === 'mobile') {
                targetSlot++;
              }
              if (targetSlot > 3) targetSlot = 1;
              return {
                ...prevMeta,
                [targetSlot]: { deviceId: id, label: `Celular (${id.slice(-4)})`, type: 'mobile' }
              };
            });
          }
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
  }, []);

  const handleMasterChunk = (buffer) => {
    if (isStreamingRef.current && window.api?.sendStreamChunk) {
      window.api.sendStreamChunk(buffer);
    }
    if (isRecordingRef.current && window.api?.sendRecordChunk) {
      window.api.sendRecordChunk(buffer);
    }
  };

  const handleRecord = async () => {
    if (!isRecording) {
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(async () => {
        setCountdown(null);

        // Inicializar señal master del compositor broadcast
        startBroadcastEngine({
          activeCam,
          camSlots,
          layoutMode,
          chromaKeyActive,
          virtualBg,
          logoBase64,
          cintillosVisible,
          cintillo,
          topic,
          getCamStream,
          localStream,
          remoteCams,
          camStreamsMap,
          camMuted,
        }, handleMasterChunk);

        if (window.api) {
          const res = await window.api.startRecording();
          if (res.success) {
            setIsRecording(true);
          } else {
            if (!isStreamingRef.current) stopBroadcastEngine();
            alert('Error al iniciar grabación: ' + (res.error || 'Desconocido'));
          }
        } else {
          setIsRecording(true);
        }
      }, 3000);
    } else {
      if (window.api) await window.api.stopRecording();
      setIsRecording(false);
      if (!isStreamingRef.current) stopBroadcastEngine();
      setShowExportModal(true);
    }
  };

  const updateStreamConfig = (field, value) => { setStreamConfigs(prev => ({ ...prev, [activeStreamTab]: { ...prev[activeStreamTab], [field]: value } })); };
  const toggleDestination = () => { setStreamConfigs(prev => ({ ...prev, [activeStreamTab]: { ...prev[activeStreamTab], enabled: !prev[activeStreamTab].enabled } })); };

  const handleStream = async () => {
    if (!isStreaming) {
      // Recolectar todos los destinos que estén habilitados y tengan clave de transmisión
      const activeTargets = Object.entries(streamConfigs)
        .filter(([_, cfg]) => cfg.enabled && cfg.key && cfg.key.trim().length > 0)
        .map(([id, cfg]) => {
          let server = (cfg.server || '').trim();
          if (id === 'facebook' && server.startsWith('rtmp://')) {
            server = server.replace('rtmp://', 'rtmps://');
          }
          if (!server.endsWith('/')) server += '/';
          return {
            id,
            name: id === 'facebook' ? 'Facebook Live' : id === 'youtube' ? 'YouTube Live' : id === 'tiktok' ? 'TikTok Live' : 'RTMP Personalizado',
            url: server + cfg.key.trim()
          };
        });

      if (activeTargets.length === 0) {
        return alert('Para emitir en vivo, debes habilitar al menos un destino (Facebook, YouTube, TikTok o RTMP) y escribir su Clave de Transmisión (Stream Key).');
      }

      // Inicializar el compositor de broadcast en tiempo real
      startBroadcastEngine({
        activeCam,
        camSlots,
        layoutMode,
        chromaKeyActive,
        virtualBg,
        logoBase64,
        cintillosVisible,
        cintillo,
        topic,
        getCamStream,
        localStream,
        remoteCams,
        camStreamsMap,
        camMuted,
      }, handleMasterChunk);

      if (window.api) {
        const res = await window.api.startStreaming({ destinations: activeTargets });
        if (res.success) {
          setIsStreaming(true);
          setActiveLiveDestinations(activeTargets);
          setShowStreamModal(false);
        } else {
          if (!isRecordingRef.current) stopBroadcastEngine();
          alert('Error al iniciar la transmisión: ' + (res.error || 'Verifica tu conexión y claves'));
        }
      } else {
        setIsStreaming(true);
        setActiveLiveDestinations(activeTargets);
        setShowStreamModal(false);
      }
    } else {
      if (window.api) await window.api.stopStreaming();
      setIsStreaming(false);
      setActiveLiveDestinations([]);
      if (!isRecordingRef.current) stopBroadcastEngine();
    }
  };

  const handleWordUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const arrayBuffer = evt.target.result;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          setTeleprompterText(result.value);
          setIsTeleprompterPlaying(false);
          teleprompterYRef.current = window.innerHeight;
          if (teleprompterTextRef.current) {
              teleprompterTextRef.current.style.transform = `translateY(${window.innerHeight}px)`;
          }
        } catch (error) { alert("Error al leer Word."); }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = null; 
    }
  };

  const handleClearTeleprompter = () => {
    setTeleprompterText('');
    setIsTeleprompterPlaying(false);
    teleprompterYRef.current = window.innerHeight;
    if (teleprompterTextRef.current) {
      teleprompterTextRef.current.style.transform = `translateY(${window.innerHeight}px)`;
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) { 
      const reader = new FileReader(); 
      reader.onload = (evt) => setLogoBase64(evt.target.result); 
      reader.readAsDataURL(file); 
    }
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
    if (slotStreams[slot]) {
      try { slotStreams[slot].getTracks().forEach(t => t.stop()); } catch (e) {}
    }
    if (slot === 0 && localStream) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    }

    // Pausa breve para que Windows DirectShow libere el hardware
    await new Promise(r => setTimeout(r, 60));

    let stream = null;
    const attempts = [
      { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
      { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { deviceId: deviceId }, audio: true },
      { video: { deviceId: deviceId }, audio: false },
      { video: true, audio: false }
    ];

    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {}
    }

    if (stream) {
      setSlotStreams(prev => ({ ...prev, [slot]: stream }));
      setCameraMeta(prev => ({ ...prev, [slot]: { deviceId, label: label || 'Cámara USB', type: 'usb' } }));
      if (slot === 0) setLocalStream(stream);
      return stream;
    } else {
      console.error("Error: No se pudo abrir la cámara tras intentar todas las combinaciones");
      return null;
    }
  };

  const handleWifiConnect = async (url, slot, label) => {
    setCameraMeta(prev => ({ ...prev, [slot]: { url, label, type: 'wifi' } }));
  };

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
    setCameraMeta(prev => ({ ...prev, [slot]: { ...prev[slot], label } }));
  };

  const renderMonitorLayout = () => {
    const getTileProps = (id) => ({ stream: getCamStream(id), isLocal: id === 1, style: getVideoStyle(id), chromaKey: chromaKeyActive, bgImage: virtualBg });
    switch (layoutMode) {
      case '1': return <VideoTile {...getTileProps(activeCam)} className="w-full h-full" />;
      case 'pip': return (<div className="w-full h-full relative"><VideoTile {...getTileProps(activeCam)} className="w-full h-full" /><div className="absolute top-4 right-4 w-1/4 h-1/4 border-2 border-orange-500 rounded-lg z-20 overflow-hidden"><VideoTile {...getTileProps(camSlots[0])} className="w-full h-full" /></div></div>);
      case '2': return (<div className="w-full h-full flex gap-2"><div className="w-1/2 h-full"><VideoTile {...getTileProps(camSlots[0])} className="w-full h-full" /></div><div className="w-1/2 h-full"><VideoTile {...getTileProps(camSlots[1])} className="w-full h-full" /></div></div>);
      case '3': return (<div className="w-full h-full flex gap-2"><div className="w-1/2 h-full"><VideoTile {...getTileProps(camSlots[0])} className="w-full h-full" /></div><div className="w-1/2 h-full flex flex-col gap-2"><div className="h-1/2"><VideoTile {...getTileProps(camSlots[1])} className="w-full h-full" /></div><div className="h-1/2"><VideoTile {...getTileProps(camSlots[2])} className="w-full h-full" /></div></div></div>);
      case '4': return (<div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2">{camSlots.slice(0, 4).map(id => <div key={id}><VideoTile {...getTileProps(id)} className="w-full h-full" /></div>)}</div>);
      default: return <VideoTile {...getTileProps(activeCam)} className="w-full h-full" />;
    }
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-[#e0e0e0] font-sans overflow-hidden text-[13px] select-none">
      
      {/* ÁREA DE TRABAJO PRINCIPAL */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP BAR */}
        <div className="flex justify-between items-center bg-[#0a0a0a] px-4 py-2 border-b border-[#222] shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/icon.png" alt="PodcastStudio Logo" className="w-6 h-6 rounded-md object-contain shadow-sm" />
              <h1 className="text-lg font-bold text-orange-500 tracking-tight">Podcast<span className="text-white">Studio</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded shadow-lg animate-pulse mr-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="font-bold">REC MASTER</span>
                <span className="font-mono">{formatTime(recordingTime)}</span>
              </div>
            )}
            {isStreaming && (
              <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded shadow-lg mr-2 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>EN VIVO ({activeLiveDestinations.length} RED{activeLiveDestinations.length > 1 ? 'ES' : ''})</span>
                <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px]">{formatTime(streamDuration)}</span>
              </div>
            )}
            {music.playing && (
              <div className="flex items-center gap-1.5 bg-orange-950/40 border border-orange-500/40 text-orange-400 px-2 py-0.5 rounded text-[11px] animate-pulse">
                <Music size={12} /> <span className="font-semibold">{music.currentTrack?.name}</span>
                {music.duckingEnabled && micLevel > 14 && <span className="text-[9px] bg-orange-600 text-white px-1 rounded ml-1">Ducking</span>}
              </div>
            )}
            <span className="text-gray-400">CALIDAD:</span>
            <span className="text-orange-500 border border-orange-500 rounded px-2 py-0.5 font-bold">1080p · 30fps</span>
          </div>
          <div className="flex gap-2 items-center">
             <button onClick={() => setShowStreamModal(true)} className={`px-4 py-1.5 rounded font-bold text-xs flex items-center gap-2 ${isStreaming ? 'bg-red-800 hover:bg-red-700 text-white shadow-lg shadow-red-900/50' : 'bg-red-700 hover:bg-red-600 text-white'}`}><Wifi size={14}/> {isStreaming ? `GESTIONAR EN VIVO (${activeLiveDestinations.length})` : 'TRANSMITIR EN VIVO'}</button>
             {!isRightPanelOpen && <button onClick={() => setIsRightPanelOpen(true)} className="ml-2 p-1.5 bg-[#222] rounded text-gray-400 hover:text-white"><PanelRight size={16} /></button>}
          </div>
        </div>

        {/* MONITOR PRINCIPAL / PGM */}
        <div className="flex-1 bg-black relative flex p-3 min-h-0">
          <div className="w-full h-full relative rounded-lg overflow-hidden flex items-center justify-center bg-[#050505] border border-[#333]">
            {renderMonitorLayout()}
            
            {countdown !== null && <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"><span className="text-white text-9xl font-bold animate-ping">{countdown}</span></div>}
            
            {/* ZOOM DINÁMICO */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-[#333] z-30 pointer-events-none">
               <span className="text-orange-500 text-[10px] font-bold">ZOOM DINÁMICO</span>
               <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-600 text-white">1.0x</span>
            </div>
            
            {/* LOGO SUPERIOR IZQUIERDO OFICIAL DEL PROYECTO */}
            {logoBase64 && <img src={logoBase64} alt="Logo Oficial del Proyecto" className="absolute top-4 left-4 h-16 object-contain z-30 drop-shadow-lg" />}
            
            {/* CINTILLO BROADCAST TRANSLÚCIDO 3D CON 13 ESTILOS Y ANIMACIONES */}
            {cintillosVisible && cintillo?.active && (
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

            {/* INDICADORES INFERIORES CENTRADOS */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 pointer-events-none">
              <div className="bg-black/80 px-4 py-1.5 rounded-full border border-[#333] text-xs text-gray-300 flex items-center gap-2">
                <Mic size={12}/> CAM {activeCam}
              </div>
              <div className="bg-black/80 px-4 py-1.5 rounded-full border border-[#333] flex items-center">
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-75" style={{ width: `${micLevel}%` }}></div>
                </div>
              </div>
              <div className="bg-black/80 px-4 py-1.5 rounded-full border border-[#333] text-xs font-bold text-white">
                PGM: {layoutMode === '1' ? `CAM ${activeCam}` : layoutMode.toUpperCase()}  MASTER
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM MULTI-CAM BAR */}
        <div className="bg-[#111] border-t border-[#222] p-2 flex flex-wrap gap-2 min-h-[115px] shrink-0">
          {camSlots.map((camId) => {
            const isActive = activeCam === camId;
            const camStream = getCamStream(camId);
            const style = getVideoStyle(camId);
            return (
              <div key={camId} className={`w-[195px] h-[108px] rounded-lg border-2 flex flex-col shrink-0 relative group transition-all ${isActive ? 'border-orange-500 bg-[#1a1a1a] shadow-md shadow-orange-950/20' : 'border-[#262626] bg-[#0c0c0c]'}`}>
                <div className="flex justify-between items-center px-1.5 py-0.5 bg-black/60 border-b border-[#222]">
                  {/* CAM IDENTIFIER */}
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-black ${isActive ? 'text-orange-400' : 'text-gray-300'}`}>CAM {camId}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" title="Al Aire (Master)"></span>}
                  </div>

                  {/* INDICADOR DE AUDIO, VUMETRO EN TIEMPO REAL Y BOTÓN DE MUTE */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const audioInfo = camAudioLevels[camId] || { hasMic: false, level: 0, isMuted: false };
                      if (!audioInfo.hasMic) {
                        return (
                          <div 
                            className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/40 text-gray-500 cursor-not-allowed select-none" 
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

                    {/* BOTÓN CONEXIONES (USB / WIFI / QR) */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConnectModalSlot(camId - 1); setShowConnectModal(true); }} 
                      className="text-gray-400 hover:text-orange-400 hover:bg-[#252525] rounded p-0.5 transition-colors" 
                      title="Configurar Entrada de Video (USB / WiFi IP / QR Celular)"
                    >
                      <Video size={11} />
                    </button>

                    {/* BOTÓN ENGRANE DE CONFIGURACIÓN Y CALIBRACIÓN COMPLETA */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); openCalibrator(camId); }} 
                      className="text-gray-400 hover:text-white hover:bg-[#252525] rounded p-0.5 transition-colors" 
                      title="Configuración y Ajustes de Cámara (Zoom, Enfoque, LUTs, Color, Guías)"
                    >
                      <Settings size={11} />
                    </button>

                    {/* BOTÓN QUITAR RANURA */}
                    {camId !== 1 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeCam(camId); }} 
                        className="text-gray-500 hover:text-red-400 hover:bg-[#252525] rounded p-0.5 transition-colors"
                        title="Quitar ranura"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 relative overflow-hidden cursor-pointer" onClick={() => { setActiveCam(camId); setLayoutMode('1'); }}>
                   <VideoTile stream={camStream} isLocal={camId === 1} className="w-full h-full opacity-80" style={style} chromaKey={chromaKeyActive} bgImage={virtualBg} />
                </div>
                <div className="flex p-0.5 bg-[#111]">
                   <button onClick={() => { setActiveCam(camId); setLayoutMode('pip'); }} className="flex-1 text-[9px] text-gray-400 hover:text-white hover:bg-[#333] rounded">PIP</button>
                   <button onClick={() => { setActiveCam(camId); setLayoutMode('2'); }} className="flex-1 text-[9px] text-gray-400 hover:text-white hover:bg-[#333] rounded">2</button>
                   <button onClick={() => { setActiveCam(camId); setLayoutMode('3'); }} className="flex-1 text-[9px] text-gray-400 hover:text-white hover:bg-[#333] rounded">3</button>
                   <button onClick={() => { setActiveCam(camId); setLayoutMode('4'); }} className="flex-1 text-[9px] text-gray-400 hover:text-white hover:bg-[#333] rounded">4</button>
                </div>
              </div>
            );
          })}
          <button onClick={addCam} className="w-[100px] h-[100px] rounded border-2 border-[#222] border-dashed bg-[#0a0a0a] hover:bg-[#1a1a1a] flex flex-col items-center justify-center text-gray-600 shrink-0"><Plus size={20} className="mb-1" /><span className="text-[10px]">+ CAM</span></button>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      {isRightPanelOpen && (
        <div className={`bg-[#111] border-l border-[#222] flex flex-col z-20 shrink-0 transition-all duration-300 ${isRightPanelCollapsed ? 'w-[50px]' : 'w-[360px]'}`}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#0a0a0a]">
            {!isRightPanelCollapsed && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Estudio Broadcast</span>}
            <div className={`flex items-center gap-1 ${isRightPanelCollapsed ? 'mx-auto flex-col' : 'ml-auto'}`}>
              <button onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)} className="p-1.5 text-gray-500 hover:text-white hover:bg-[#222] rounded">{isRightPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</button>
              <button onClick={() => setIsRightPanelOpen(false)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-[#222] rounded"><X size={14} /></button>
            </div>
          </div>

          {!isRightPanelCollapsed && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

              {/* CARD: LOGO OFICIAL DEL PROYECTO (ARRIBA EN PANTALLA) */}
              <div className="border border-[#222] rounded bg-[#161616] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-orange-500" /> Logo Oficial del Proyecto
                  </span>
                  {logoBase64 && (
                    <span className="text-[9px] bg-green-900/60 text-green-300 font-bold px-1.5 py-0.5 rounded border border-green-700/40">
                      Activo Arriba
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">
                  Se ubica en la esquina superior izquierda del monitor. No altera los cintillos.
                </p>
                <div className="flex gap-2 items-center">
                  <label className="flex-1 bg-[#222] hover:bg-[#2c2c2c] text-xs text-center py-1.5 rounded cursor-pointer flex items-center justify-center gap-1.5 border border-[#444] text-gray-200 font-bold transition-colors">
                    <Upload size={12}/> {logoBase64 ? 'Cambiar Logo Oficial' : 'Subir Logo Oficial'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  {logoBase64 && (
                    <button onClick={() => setLogoBase64(null)} className="p-1.5 bg-[#222] hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded border border-[#333]" title="Quitar logo oficial">
                      <X size={14} />
                    </button>
                  )}
                </div>
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

                    {/* BOTÓN DISEÑADOR Y GENERADOR */}
                    <button 
                      onClick={() => setShowCintilloModal(true)} 
                      className="w-full py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-900/30"
                    >
                      <Sparkles size={14} /> Diseñador & Generador Asistente
                    </button>

                    {/* SELECTOR DE ESTILOS (13 ESTILOS BROADCAST) */}
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

                    {/* LANZAMIENTO RÁPIDO DE PRESETS AL AIRE */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Lanzamiento Rápido al Aire</label>
                        <button 
                          onClick={() => { setActiveSocialTab(socialTarget); setShowSocialsModal(true); }}
                          className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 bg-[#1a1a1a] hover:bg-[#252525] px-2 py-0.5 rounded border border-[#333]"
                          title="Editar enlaces y subtítulos de redes sociales"
                        >
                          <Settings size={11} /> Editar Redes
                        </button>
                      </div>

                      {/* SELECTOR DE MODO DE REDES (INVITADO VS PROGRAMA) */}
                      <div className="flex items-center justify-between bg-[#15171e] p-1.5 rounded border border-[#2a2d38] mb-2">
                        <span className="text-[10px] text-gray-300 font-semibold flex items-center gap-1">
                          <Share2 size={11} className="text-orange-400" /> Redes al aire:
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => switchSocialTarget('guest')}
                            className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded transition-all ${socialTarget === 'guest' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                          >
                            👤 Del Invitado
                          </button>
                          <button
                            type="button"
                            onClick={() => switchSocialTarget('program')}
                            className={`px-2.5 py-0.5 text-[9.5px] font-bold rounded transition-all ${socialTarget === 'program' ? 'bg-orange-600 text-white shadow-sm' : 'bg-[#222] text-gray-400 hover:text-white'}`}
                          >
                            🎙️ Del Programa
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => { setCintillosVisible(true); showManual('host'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-orange-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-orange-400">
                          🎤 Host
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('guest'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-emerald-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-emerald-400">
                          👤 Invitado
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('topic'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-blue-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-blue-400">
                          💡 Tema
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('social_youtube'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-red-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-red-400" title={`Lanzar YouTube (${socialTarget === 'guest' ? 'Invitado' : 'Programa'})`}>
                          <Youtube size={12} className="text-red-500" /> YouTube
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('social_instagram'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-pink-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-pink-400" title={`Lanzar Instagram (${socialTarget === 'guest' ? 'Invitado' : 'Programa'})`}>
                          <Instagram size={12} className="text-pink-500" /> Instagram
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('social_tiktok'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-cyan-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-cyan-400" title={`Lanzar TikTok (${socialTarget === 'guest' ? 'Invitado' : 'Programa'})`}>
                          <Music size={12} className="text-cyan-400" /> TikTok
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('social_facebook'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-blue-600/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-blue-500" title={`Lanzar Facebook (${socialTarget === 'guest' ? 'Invitado' : 'Programa'})`}>
                          <Facebook size={12} className="text-blue-500" /> Facebook
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('contact'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-amber-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-amber-400">
                          📞 Contacto
                        </button>
                        <button onClick={() => { setCintillosVisible(true); showManual('promo'); }} className="p-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] hover:border-purple-500/50 rounded text-[10px] font-bold flex items-center justify-center gap-1 text-purple-400">
                          🏷️ Promo
                        </button>
                      </div>
                    </div>

                    {/* DATOS RÁPIDOS DEL PROGRAMA CON LETRAS CHICAS ARRIBA DE CADA RECUADRO */}
                    <div className="space-y-2.5 pt-2.5 border-t border-[#2a2a2a]">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Datos Rápidos del Programa</span>
                        <span className="text-[9px] text-gray-500 font-normal">Identificadores para cintillos</span>
                      </div>

                      {/* CONDUCTOR */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9.5px] font-bold text-orange-400 block mb-0.5 tracking-wide">
                            NOMBRE CONDUCTOR
                          </label>
                          <input 
                            type="text" 
                            value={hostName} 
                            onChange={e => setHostName(e.target.value)} 
                            placeholder="Nombre del Conductor" 
                            className="w-full bg-[#18181b] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-orange-500" 
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] font-bold text-gray-400 block mb-0.5 tracking-wide">
                            ROL / CARGO CONDUCTOR
                          </label>
                          <input 
                            type="text" 
                            value={hostRole} 
                            onChange={e => setHostRole(e.target.value)} 
                            placeholder="Cargo o Profesión" 
                            className="w-full bg-[#18181b] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-orange-500" 
                          />
                        </div>
                      </div>

                      {/* INVITADO */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9.5px] font-bold text-emerald-400 block mb-0.5 tracking-wide">
                            NOMBRE INVITADO
                          </label>
                          <input 
                            type="text" 
                            value={guestName} 
                            onChange={e => setGuestName(e.target.value)} 
                            placeholder="Nombre del Invitado" 
                            className="w-full bg-[#18181b] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500" 
                          />
                        </div>
                        <div>
                          <label className="text-[9.5px] font-bold text-gray-400 block mb-0.5 tracking-wide">
                            ESPECIALIDAD / ROL
                          </label>
                          <input 
                            type="text" 
                            value={guestRole} 
                            onChange={e => setGuestRole(e.target.value)} 
                            placeholder="Especialidad del Invitado" 
                            className="w-full bg-[#18181b] border border-[#333] rounded p-1.5 text-xs text-white outline-none focus:border-emerald-500" 
                          />
                        </div>
                      </div>

                      {/* TEMA DEL EPISODIO */}
                      <div>
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
                      tracks={MUSIC_TRACKS}
                      sfxList={MUSIC_SFX}
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
                    />
                  </div>
                )}
              </div>

              {/* PANEL 3: TELEPROMPTER */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('teleprompter')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors">
                  <span className="flex items-center gap-2 font-bold text-white"><BookOpen size={15} className="text-blue-400"/> Teleprompter</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${isTeleprompterPlaying ? 'bg-green-900 text-green-400' : 'bg-[#222] text-gray-400'}`}>{isTeleprompterPlaying ? 'Leyendo' : 'En Espera'}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${activePanel === 'teleprompter' ? 'rotate-180' : ''}`}/>
                  </div>
                </button>
                {activePanel === 'teleprompter' && (
                  <div className="p-3 border-t border-[#222] bg-[#0f0f0f] space-y-3">
                    <div className="flex gap-2 items-center">
                      <label className="flex-1 bg-[#222] hover:bg-[#2c2c2c] text-xs text-center py-2 px-3 rounded cursor-pointer flex items-center justify-center gap-1.5 border border-[#444] text-blue-400 font-bold transition-colors">
                        <Upload size={14}/> Subir Word (.docx)
                        <input type="file" accept=".docx" className="hidden" onChange={handleWordUpload} />
                      </label>
                      <button 
                        onClick={handleClearTeleprompter} 
                        disabled={!teleprompterText}
                        title="Eliminar archivo / limpiar teleprompter"
                        className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          teleprompterText 
                            ? 'bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border-red-800/60 cursor-pointer' 
                            : 'bg-[#181818] text-gray-600 border-[#2a2a2a] cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Trash2 size={13}/> Limpiar
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={handlePlayTeleprompter} className={`flex-1 py-1.5 rounded text-xs font-bold flex justify-center items-center gap-1 border ${isTeleprompterPlaying ? 'bg-green-600 text-white border-green-500' : 'bg-[#1a1a1a] text-green-500 border-green-900/50 hover:bg-[#222]'}`}><Monitor size={12}/> Play</button>
                      <button onClick={() => setIsTeleprompterPlaying(false)} className={`flex-1 py-1.5 rounded text-xs font-bold flex justify-center items-center gap-1 border ${!isTeleprompterPlaying ? 'bg-red-700 text-white border-red-500' : 'bg-[#1a1a1a] text-red-500 border-red-900/50 hover:bg-[#222]'}`}><Square size={12}/> Stop</button>
                    </div>
                    <textarea 
                      value={teleprompterText} 
                      onChange={(e) => setTeleprompterText(e.target.value)} 
                      placeholder="Escribe o pega aquí el guión del programa, o sube un archivo Word (.docx)..." 
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded p-2 text-sm text-gray-300 placeholder-gray-600 h-32 resize-none outline-none focus:border-orange-500" 
                    />
                    <div className="space-y-2 pt-2 border-t border-[#333]">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400"><span className="w-8">Vel.</span><input type="range" min="0.1" max="10" step="0.1" value={teleprompterSpeed} onChange={e => setTeleprompterSpeed(parseFloat(e.target.value))} className="flex-1 accent-orange-500" /><span className="w-8 text-right">{teleprompterSpeed.toFixed(1)}x</span></div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400"><span className="w-8">Texto</span><input type="range" min="20" max="100" value={teleprompterFontSize} onChange={e => setTeleprompterFontSize(parseInt(e.target.value))} className="flex-1 accent-orange-500" /><span className="w-8 text-right">{teleprompterFontSize}px</span></div>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2"><span>Dirección</span><span className="bg-orange-900/30 text-orange-500 border border-orange-900/50 px-2 py-0.5 rounded"> Abajo  arriba</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* PANEL 4: TRANSMISIÓN Y REDES */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button onClick={() => togglePanel('transmision')} className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors"><span className="flex items-center gap-2 font-bold text-white"><Share2 size={15} className="text-red-400"/> Transmisión y Redes</span><ChevronDown size={14} className="text-gray-400"/></button>
                {activePanel === 'transmision' && (
                   <div className="p-3 border-t border-[#222] bg-[#0f0f0f]"><button onClick={() => setShowStreamModal(true)} className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-bold flex items-center justify-center gap-2 text-xs text-white"><Wifi size={14}/> Configurar Transmisión</button></div>
                )}
              </div>

              {/* PANEL 5: CONEXIONES */}
              <div className="border border-[#222] rounded bg-[#161616] overflow-hidden">
                <button 
                  onClick={() => {
                    togglePanel('conexiones');
                    setConnectModalSlot(activeCam - 1);
                    setShowConnectModal(true);
                  }} 
                  className="w-full p-2.5 flex justify-between items-center text-xs hover:bg-[#2a2a2a] transition-colors"
                >
                  <span className="flex items-center gap-2 font-bold text-white">
                    <Radio size={15} className="text-purple-400"/> Conexiones
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800/50 px-1.5 py-0.2 rounded font-semibold">Configurar</span>
                    <ChevronDown size={14} className="text-gray-400"/>
                  </div>
                </button>
                {activePanel === 'conexiones' && (
                  <div className="p-3 border-t border-[#222] bg-[#0f0f0f] space-y-2">
                    <button 
                      onClick={() => { setConnectModalSlot(activeCam - 1); setShowConnectModal(true); }} 
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold flex items-center justify-center gap-2 text-xs text-white shadow-lg transition-colors"
                    >
                      <Video size={14} /> Configurar Entrada de Video
                    </button>
                    <button 
                      onClick={() => { setConnectModalSlot(activeCam - 1); setShowConnectModal(true); }} 
                      className="w-full py-1.5 bg-[#181c26] hover:bg-[#202738] border border-blue-500/30 rounded font-bold flex items-center justify-center gap-2 text-[11px] text-blue-400 transition-colors"
                    >
                      <QrCode size={13} /> Invitar Celular / Remoto QR
                    </button>
                  </div>
                )}
              </div>

              {/* PANEL 6: ESCENARIOS VIRTUALES */}
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

            </div>
          )}

          {/* BOTÓN INFERIOR DE GRABACIÓN */}
          {!isRightPanelCollapsed && (
            <div className="p-3 border-t border-[#222] bg-[#0a0a0a] flex flex-col gap-2 shrink-0">
              <button onClick={handleRecord} className={`w-full py-2.5 rounded font-bold flex items-center justify-center gap-2 text-xs transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-[#2a1010] text-red-500 border border-red-900 hover:bg-[#3a1515]'}`}>{isRecording ? <><Square size={14}/> DETENER GRABACIÓN</> : <><Play size={14}/> INICIAR GRABACIÓN</>}</button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* LÍNEA Y BARRA INFERIOR DE DELIMITACIÓN DEL PROYECTO Y VERSIÓN */}
      <footer className="h-6 bg-[#08080a] border-t border-[#262626] px-4 flex justify-between items-center text-[10.5px] text-gray-400 shrink-0 z-30 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
          <span className="font-bold text-gray-200 tracking-wider">PODCASTUDIO v1.0.0</span>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111318] border border-[#2a2b35] rounded-xl w-[640px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
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
              <button onClick={() => setShowSocialsModal(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#222]">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0d0d0d] border border-[#2a2b30] rounded-xl w-[900px] h-[600px] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#2a2b30] bg-[#16171b]"><div className="flex items-center gap-3"><div className="p-2 bg-orange-600/20 rounded-lg text-orange-500 border border-orange-500/50"><Sliders size={20} /></div><div><h2 className="text-lg font-bold text-white">Calibrador y Monitor Preview (P/VW)</h2><p className="text-[10px] text-gray-400">Ajusta zoom independiente, encuadre, color y audio antes de enviar a Master</p></div></div><button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button></div>
            <div className="flex gap-2 p-2 bg-[#111] border-b border-[#222]">{camSlots.map(id => (<button key={id} onClick={() => setEditingCamId(id)} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${editingCamId === id ? 'bg-[#222] text-white border border-[#444]' : 'text-gray-500 hover:text-gray-300'}`}><div className={`w-2 h-2 rounded-full ${getCamStream(id) ? 'bg-green-500' : 'bg-red-500'}`}></div>CAM {id}</button>))}</div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-4 bg-black flex flex-col items-center justify-center relative border-r border-[#222]"><div className="w-full max-w-2xl aspect-video bg-[#050505] border border-[#333] rounded relative overflow-hidden"><VideoTile stream={getCamStream(editingCamId)} isLocal={editingCamId === 1} className="w-full h-full" style={getVideoStyle(editingCamId)} /></div></div>
              <div className="w-[400px] overflow-y-auto p-4 space-y-6 bg-[#111] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div><div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-orange-500 flex items-center gap-2"><Search size={12}/> ZOOM</span></div><div className="grid grid-cols-4 gap-1 mb-2">{[1, 1.35, 1.75, 2.2].map(z => (<button key={z} onClick={() => updateSetting('zoom', z)} className={`py-1 text-[10px] rounded border ${camSettings[editingCamId].zoom === z ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#222] border-[#333] text-gray-400'}`}>{z}x</button>))}</div><input type="range" min="1" max="5" step="0.05" value={camSettings[editingCamId].zoom} onChange={e => updateSetting('zoom', parseFloat(e.target.value))} className="w-full accent-orange-500" /></div>
              </div>
            </div>
            <div className="p-3 bg-[#16171b] border-t border-[#2a2b30] flex justify-between items-center"><button onClick={resetSettings} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white flex items-center gap-2 text-xs"><Disc size={14}/> Restablecer</button><button onClick={() => setShowSettingsModal(false)} className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold flex items-center gap-2 shadow-lg">Guardar y Cerrar</button></div>
          </div>
        </div>
      )}

      {/* MODAL STREAMING */}
      {showStreamModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1115] border border-[#2a2b30] rounded-xl w-[850px] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center p-5 border-b border-[#2a2b30]">
              <div className="flex items-center gap-3"><div className="p-2 bg-red-600/20 rounded-lg text-red-500"><Share2 size={24} /></div><div><h2 className="text-lg font-bold text-white">Transmisión En Vivo Multi-Streaming</h2><p className="text-[11px] text-gray-400">Emite tu señal Master simultáneamente en YouTube, Facebook y TikTok.</p></div></div>
              <button onClick={() => setShowStreamModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
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
        masterCameraSlot={activeCam - 1}
        onSetMaster={(slot) => setActiveCam(slot + 1)}
        onUsbConnect={handleUsbConnect}
        onWifiConnect={handleWifiConnect}
        onDisconnect={handleDisconnectSlot}
        onRenameSlot={handleRenameSlot}
        localQrUrl={qrCodeUrl}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#16171b] border border-[#2a2b30] rounded-xl w-[500px] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#2a2b30]"><div className="flex items-center gap-2 text-lg font-bold text-white"><Video size={18} className="text-orange-500" /> Conectar Celular</div><button onClick={() => setShowQRModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button></div>
            <div className="p-5 flex flex-col gap-4 items-center">
              <div className="bg-white p-2 rounded-lg">
                {qrCodeImage ? <img src={qrCodeImage} className="w-[200px] h-[200px]" alt="QR Code" /> : <div className="w-[200px] h-[200px] flex items-center justify-center text-black">Generando QR...</div>}
              </div>
              {mobileStatus && <p className="text-xs text-green-400 font-semibold">{mobileStatus}</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() { return <ErrorBoundary><PodcastStudioApp /></ErrorBoundary>; }