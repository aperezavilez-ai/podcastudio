/**
 * masterBroadcastEngine.js
 * Motor de Composición Broadcast Master para Transmisión en Vivo y Grabación Real
 * 
 * Genera una señal limpia de 1080p a 30fps combinando:
 * - Composición de cámaras según el switcher (1, PIP, 2, 3, 4)
 * - Fondo virtual y croma key
 * - Logo oficial del proyecto
 * - Cintillos y títulos informativos
 * - Mezcla de audio en tiempo real (Micrófonos locales + Celulares WebRTC + Música + SFX)
 */

import { applyVoiceEffectChain } from './voiceEffectsProcessor.js';

let canvas = null;
let ctx = null;
let animFrameId = null;
let mediaRecorder = null;
let masterStream = null;
let audioContext = null;
let audioDestination = null;
let connectedAudioSources = new Map();
let activeVoiceFxNodes = new Map();
let isRunning = false;

// Estado reactivo del compositor
let currentState = {
  activeCam: 1,
  camSlots: [1, 2, 3, 4],
  layoutMode: '1',
  chromaKeyActive: false,
  virtualBg: null,
  logoBase64: null,
  cintillosVisible: true,
  cintillo: null,
  topic: '',
  voiceEffect: 'normal',
  voiceTarget: 'all',
  getCamStream: null,
  localStream: null,
  remoteCams: [],
};

const videoElements = new Map();
let virtualBgImage = null;
let logoImage = null;
let lastStreamSync = 0;

function getOrCreateVideo(camId, stream) {
  if (!videoElements.has(camId)) {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    videoElements.set(camId, v);
  }
  const v = videoElements.get(camId);
  if (stream && v.srcObject !== stream) {
    v.srcObject = stream;
    v.play().catch(() => {});
  } else if (!stream && v.srcObject) {
    v.srcObject = null;
  }
  return v;
}

function syncVideoStreams() {
  if (currentState.getCamStream) {
    currentState.camSlots.forEach((id) => {
      const stream = currentState.getCamStream(id);
      getOrCreateVideo(id, stream);
    });
  }
}

function updateImages() {
  if (currentState.virtualBg) {
    if (!virtualBgImage || virtualBgImage.src !== currentState.virtualBg) {
      virtualBgImage = new Image();
      virtualBgImage.crossOrigin = 'anonymous';
      virtualBgImage.src = currentState.virtualBg;
    }
  } else {
    virtualBgImage = null;
  }

  if (currentState.logoBase64) {
    if (!logoImage || logoImage.src !== currentState.logoBase64) {
      logoImage = new Image();
      logoImage.src = currentState.logoBase64;
    }
  } else {
    logoImage = null;
  }
}

function drawCameraCover(video, x, y, w, h, camId = null) {
  if (video && video.readyState >= 2) {
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const videoRatio = vw / vh;
    const targetRatio = w / h;
    let sx = 0, sy = 0, sw = vw, sh = vh;

    if (videoRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }

    // Aplicar Zoom dinámico y punto focal si existen para este camId
    if (camId && currentState.cameraCrops) {
      const crop = currentState.cameraCrops[camId - 1];
      if (crop) {
        const zoom = Math.max(1.0, crop.zoom || 1.0);
        const focusX = crop.focusX != null ? crop.focusX : 0.5;
        const focusY = crop.focusY != null ? crop.focusY : 0.42;

        if (zoom > 1.01) {
          const origSw = sw;
          const origSh = sh;
          sw = origSw / zoom;
          sh = origSh / zoom;
          const maxShiftX = origSw - sw;
          const maxShiftY = origSh - sh;
          sx += maxShiftX * focusX;
          sy += maxShiftY * focusY;
        }
      }
    }

    ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
  } else {
    // Señal no disponible
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a3f50';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIN SEÑAL', x + w / 2, y + h / 2);
  }
}

function drawCintillo(cintillo, topic) {
  if (!cintillo) return;
  const tag = (cintillo.tag || 'TEMA').toUpperCase();
  const title = cintillo.text || topic || 'Programa en Vivo';
  const subtitle = cintillo.subtitle || '';
  const color = cintillo.color || '#e8612a';

  const x = 70;
  const y = 1080 - 190;
  const w = Math.min(1050, Math.max(550, title.length * 20 + 200));
  const h = subtitle ? 115 : 85;
  const radius = 16;

  ctx.save();

  // Sombra del cintillo
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;

  // Fondo translúcido tipo Glassmorphism
  ctx.fillStyle = 'rgba(12, 14, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Borde sutil
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Barra de acento izquierda
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 8, h, [radius, 0, 0, radius]);
  ctx.fill();

  // Tag Pill superior
  const tagW = Math.max(80, tag.length * 10 + 24);
  const tagH = 26;
  const tagX = x + 24;
  const tagY = y + 16;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagW, tagH, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, tagX + tagW / 2, tagY + tagH / 2 + 1);

  // Título principal
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const textX = x + 24;
  const textY = y + (subtitle ? 72 : 58);
  ctx.fillText(title, textX, textY);

  // Bajada / Subtítulo
  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 16px sans-serif';
    ctx.fillText(subtitle, textX, textY + 26);
  }

  ctx.restore();
}

function renderFrame() {
  if (!isRunning || !ctx) return;

  const width = 1920;
  const height = 1080;

  // 1. Fondo base
  if (currentState.chromaKeyActive && virtualBgImage && virtualBgImage.complete && virtualBgImage.naturalWidth > 0) {
    ctx.drawImage(virtualBgImage, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, width, height);
  }

  // Actualizar streams de video en elementos auxiliares solo si es necesario (evita llamadas continuas a play() en cada frame)
  if (!lastStreamSync || (Date.now() - lastStreamSync > 1000)) {
    lastStreamSync = Date.now();
    syncVideoStreams();
  }

  // 2. Renderizado de cámaras según Layout del switcher
  const mode = currentState.layoutMode || '1';
  const activeCam = currentState.activeCam || 1;
  const slots = currentState.camSlots;

  if (mode === 'pip') {
    // Fondo: Cámara activa
    const mainVideo = videoElements.get(activeCam);
    drawCameraCover(mainVideo, 0, 0, width, height, activeCam);

    // PIP superior derecho
    const pipW = 460;
    const pipH = 260;
    const pipX = width - pipW - 40;
    const pipCamId = (currentState.pipCam && currentState.pipCam !== activeCam)
      ? currentState.pipCam
      : (slots.find(id => id !== activeCam) || (activeCam === 1 ? 2 : 1));
    const pipVideo = videoElements.get(pipCamId);

    ctx.save();
    ctx.strokeStyle = '#e8612a';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 16;
    ctx.strokeRect(pipX, pipY, pipW, pipH);
    ctx.restore();

    drawCameraCover(pipVideo, pipX, pipY, pipW, pipH, pipCamId);
  } else if (mode === '2') {
    const gap = 12;
    const halfW = (width - gap) / 2;
    const v1 = videoElements.get(slots[0] || 1);
    const v2 = videoElements.get(slots[1] || 2);
    drawCameraCover(v1, 0, 0, halfW, height, slots[0] || 1);
    drawCameraCover(v2, halfW + gap, 0, halfW, height, slots[1] || 2);
  } else if (mode === '3') {
    const gap = 12;
    const halfW = (width - gap) / 2;
    const halfH = (height - gap) / 2;
    const v1 = videoElements.get(slots[0] || 1);
    const v2 = videoElements.get(slots[1] || 2);
    const v3 = videoElements.get(slots[2] || 3);
    drawCameraCover(v1, 0, 0, halfW, height, slots[0] || 1);
    drawCameraCover(v2, halfW + gap, 0, halfW, halfH, slots[1] || 2);
    drawCameraCover(v3, halfW + gap, halfH + gap, halfW, halfH, slots[2] || 3);
  } else if (mode === '4') {
    const gap = 12;
    const halfW = (width - gap) / 2;
    const halfH = (height - gap) / 2;
    const v1 = videoElements.get(slots[0] || 1);
    const v2 = videoElements.get(slots[1] || 2);
    const v3 = videoElements.get(slots[2] || 3);
    const v4 = videoElements.get(slots[3] || 4);
    drawCameraCover(v1, 0, 0, halfW, halfH, slots[0] || 1);
    drawCameraCover(v2, halfW + gap, 0, halfW, halfH, slots[1] || 2);
    drawCameraCover(v3, 0, halfH + gap, halfW, halfH, slots[2] || 3);
    drawCameraCover(v4, halfW + gap, halfH + gap, halfW, halfH, slots[3] || 4);
  } else {
    // Modo 1 (Cámara Principal a Pantalla Completa)
    const v = videoElements.get(activeCam);
    drawCameraCover(v, 0, 0, width, height, activeCam);
  }

  // 3. Logo Oficial del Proyecto (Superior Izquierda)
  if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    const maxLogoH = 80;
    const aspect = logoImage.naturalWidth / logoImage.naturalHeight;
    const logoW = maxLogoH * aspect;
    ctx.drawImage(logoImage, 50, 45, logoW, maxLogoH);
  }

  // 4. Cintillo informativo al aire
  if (currentState.cintillosVisible && currentState.cintillo?.active) {
    drawCintillo(currentState.cintillo, currentState.topic);
  }

  animFrameId = requestAnimationFrame(renderFrame);
}

function disconnectAudioSource(key) {
  if (connectedAudioSources.has(key)) {
    const entry = connectedAudioSources.get(key);
    try {
      if (entry?.src) entry.src.disconnect();
    } catch (e) {}
    connectedAudioSources.delete(key);
  }

  if (activeVoiceFxNodes.has(key)) {
    const nodes = activeVoiceFxNodes.get(key);
    if (Array.isArray(nodes)) {
      nodes.forEach((n) => {
        try { n.disconnect(); } catch (e) {}
        if (typeof n.stop === 'function') {
          try { n.stop(); } catch (e) {}
        }
      });
    }
    activeVoiceFxNodes.delete(key);
  }
}

function connectAudioSourceWithFx(key, stream, isMasterCam = false) {
  disconnectAudioSource(key);

  try {
    const src = audioContext.createMediaStreamSource(stream);
    const shouldApplyFx = currentState.voiceEffect && currentState.voiceEffect !== 'normal' &&
      (currentState.voiceTarget === 'all' || (currentState.voiceTarget === 'master' && isMasterCam));

    if (shouldApplyFx) {
      const fxNodes = applyVoiceEffectChain(audioContext, src, audioDestination, currentState.voiceEffect);
      activeVoiceFxNodes.set(key, fxNodes);
    } else {
      src.connect(audioDestination);
    }
    connectedAudioSources.set(key, { src, stream, isMasterCam });
  } catch (e) {
    console.warn('[masterBroadcastEngine] Error connecting audio track:', key, e);
  }
}

function reapplyVoiceEffects() {
  if (!audioContext || !audioDestination) return;
  const currentEntries = Array.from(connectedAudioSources.entries());
  currentEntries.forEach(([key, entry]) => {
    if (entry && entry.stream) {
      connectAudioSourceWithFx(key, entry.stream, entry.isMasterCam);
    }
  });
}

function setupAudioMixing(localStream, remoteCams, camStreamsMap = {}, camMutedMap = {}) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) {
      audioContext = new AudioCtx({ sampleRate: 48000 });
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    if (!audioDestination) {
      audioDestination = audioContext.createMediaStreamDestination();
    }

    // 1. EL MICRÓFONO MASTER (CAM 1 / MICRÓFONO EXTERNO DEL ESTUDIO) SIEMPRE TIENE PRIORIDAD Y NUNCA SE DESCONECTA
    const masterAudioStream = (camStreamsMap && camStreamsMap[1]) || localStream;
    const isMasterMuted = Boolean(camMutedMap[1]);
    if (masterAudioStream && masterAudioStream.getAudioTracks().length > 0) {
      const masterTrack = masterAudioStream.getAudioTracks()[0];
      masterTrack.enabled = !isMasterMuted;
      const masterKey = 'master_cam_1_' + masterTrack.id;
      if (!isMasterMuted) {
        if (!connectedAudioSources.has(masterKey)) {
          connectAudioSourceWithFx(masterKey, masterAudioStream, true);
        }
      } else {
        disconnectAudioSource(masterKey);
      }
    }

    // 2. CONECTAR DEMÁS CÁMARAS (CAM 2, 3, 4...) RESPETANDO ESTRICTAMENTE SU ESTADO INDIVIDUAL DEL PANEL
    if (camStreamsMap && Object.keys(camStreamsMap).length > 0) {
      Object.entries(camStreamsMap).forEach(([camIdStr, stream]) => {
        const camId = Number(camIdStr);
        if (camId === 1) return; // Ya garantizado como Master arriba

        const isCamMuted = Boolean(camMutedMap[camId]);
        if (stream && stream.getAudioTracks().length > 0) {
          const track = stream.getAudioTracks()[0];
          track.enabled = !isCamMuted;

          const key = `cam_${camId}_${track.id}`;
          if (!isCamMuted) {
            if (!connectedAudioSources.has(key)) {
              connectAudioSourceWithFx(key, stream, false);
            }
          } else {
            disconnectAudioSource(key);
          }
        }
      });
    }

    // 3. Respaldo para cámaras remotas WebRTC si no estaban en el mapa
    if (Array.isArray(remoteCams)) {
      remoteCams.forEach((rc) => {
        const rcCamId = rc.slot ? rc.slot + 1 : 2;
        const isMuted = Boolean(camMutedMap[rcCamId]);
        if (rc.stream && rc.stream.getAudioTracks().length > 0) {
          const track = rc.stream.getAudioTracks()[0];
          track.enabled = !isMuted;
          const key = `remote_${rc.id}_${track.id}`;
          if (!isMuted) {
            if (!connectedAudioSources.has(key)) {
              connectAudioSourceWithFx(key, rc.stream, false);
            }
          } else {
            disconnectAudioSource(key);
          }
        }
      });
    }

    return audioDestination.stream.getAudioTracks()[0];
  } catch (err) {
    console.warn('Audio mixing setup fallback:', err);
    return null;
  }
}

let chunkListeners = new Set();
let cachedInitHeader = null;

export function addChunkListener(listener) {
  if (typeof listener === 'function') {
    chunkListeners.add(listener);
    if (cachedInitHeader) {
      try {
        listener(cachedInitHeader.slice(0));
      } catch (e) {}
    }
  }
}

export function removeChunkListener(listener) {
  chunkListeners.delete(listener);
}

export function getInitHeader() {
  return cachedInitHeader ? cachedInitHeader.slice(0) : null;
}

/**
 * Inicia la composición en tiempo real del Master y la generación de paquetes WebM/H.264
 */
export function startBroadcastEngine(initialState, onChunk) {
  if (onChunk) {
    addChunkListener(onChunk);
  }

  if (isRunning) {
    updateBroadcastState(initialState);
    return masterStream;
  }

  currentState = { ...currentState, ...initialState };
  updateImages();

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    ctx = canvas.getContext('2d', { alpha: false });
  }

  isRunning = true;
  renderFrame();

  // Generar Video Track limpio desde el Canvas
  const canvasStream = canvas.captureStream(30);
  const videoTrack = canvasStream.getVideoTracks()[0];

  // Mezclar Audio Master (Micrófono local + Remotos + Cámaras activas)
  const audioTrack = setupAudioMixing(
    currentState.localStream,
    currentState.remoteCams,
    currentState.camStreamsMap,
    currentState.camMuted
  );

  const tracks = [videoTrack];
  if (audioTrack) tracks.push(audioTrack);
  masterStream = new MediaStream(tracks);

  // Iniciar MediaRecorder: Priorizar códec H.264 por hardware (0% sobrecarga en CPU, sin congelamiento inicial)
  let chosenMime = 'video/webm;codecs=h264,opus';
  if (!MediaRecorder.isTypeSupported(chosenMime)) {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      chosenMime = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      chosenMime = 'video/webm;codecs=vp8,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      chosenMime = 'video/webm';
    }
  }

  try {
    mediaRecorder = new MediaRecorder(masterStream, {
      mimeType: chosenMime,
      videoBitsPerSecond: 3500000, // 3.5 Mbps Full HD
    });

    mediaRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) {
        try {
          const buffer = await e.data.arrayBuffer();
          if (!cachedInitHeader) {
            cachedInitHeader = buffer.slice(0);
          }
          chunkListeners.forEach((listener) => {
            try {
              listener(buffer);
            } catch (err) {}
          });
        } catch (err) {
          console.warn('Error procesando chunk de broadcast:', err);
        }
      }
    };

    // Emitir chunks cada 500ms (equilibrio perfecto entre latencia ultrabaja y 0 congelamiento)
    mediaRecorder.start(500);
  } catch (e) {
    console.error('Error inicializando MediaRecorder de broadcast:', e);
  }

  return masterStream;
}

/**
 * Actualiza en vivo cualquier parámetro del switcher sin detener la transmisión
 */
export function updateBroadcastState(updates) {
  const voiceUpdated = (updates.voiceEffect !== undefined && updates.voiceEffect !== currentState.voiceEffect) ||
                       (updates.voiceTarget !== undefined && updates.voiceTarget !== currentState.voiceTarget);

  currentState = { ...currentState, ...updates };
  updateImages();

  if (voiceUpdated) {
    reapplyVoiceEffects();
  }

  // Si cambiaron los streams o el estado de silencio de cámaras, sincronizar la mezcla de audio y videos
  if (updates.localStream || updates.remoteCams || updates.camStreamsMap || updates.camMuted || updates.camSlots || updates.getCamStream) {
    syncVideoStreams();
    setupAudioMixing(
      currentState.localStream,
      currentState.remoteCams,
      currentState.camStreamsMap,
      currentState.camMuted
    );
  }
}

/**
 * Captura un fotograma instantáneo en 1080p prístino del Master en vivo
 */
export function captureMasterCanvasSnapshot() {
  if (!canvas) return null;
  try {
    const snap = document.createElement('canvas');
    snap.width = canvas.width || 1920;
    snap.height = canvas.height || 1080;
    const sCtx = snap.getContext('2d');
    sCtx.drawImage(canvas, 0, 0);
    return snap;
  } catch (e) {
    return null;
  }
}

/**
 * Detiene el motor de broadcast y libera recursos
 */
export function stopBroadcastEngine() {
  isRunning = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (e) {}
    mediaRecorder = null;
  }

  if (masterStream) {
    masterStream.getTracks().forEach((t) => t.stop());
    masterStream = null;
  }

  videoElements.forEach((v) => {
    v.srcObject = null;
  });
  videoElements.clear();

  const keys = Array.from(connectedAudioSources.keys());
  keys.forEach((k) => disconnectAudioSource(k));
  connectedAudioSources.clear();
  activeVoiceFxNodes.clear();

  chunkListeners.clear();
  cachedInitHeader = null;
}
