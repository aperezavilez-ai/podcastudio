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
import { buildCanvasFilter } from './videoLook.js';

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

// NODOS DEL MEZCLADOR DE AUDIO BROADCAST PROFESIONAL
let masterSumGain = null;
let masterLimiterNode = null;
let masterOutputGain = null;
let monitorSumGain = null;
let monitorOutputGain = null;
let masterAnalyserNode = null;
let localMicMonitorNode = null;

// Bus de Música de Fondo (BGM)
let bgmGainNode = null;
let bgmDuckingGainNode = null;
let bgmAnalyserNode = null;
const connectedBgmElements = new WeakSet();
let bgmMediaElement = null;

// Bus de Efectos de Sonido (SFX)
let sfxGainNode = null;
let sfxAnalyserNode = null;
const sfxBufferCache = new Map();
const activeSfxSources = new Set();

// Tiras de canal de mezcla (Channel Strips)
// key: 'cam_1', 'cam_2', etc. -> { id, label, src, trimGain, faderGain, muteGain, soloGain, analyser, isSolo, isMuted, fader, gainDb }
const channelStrips = new Map();
let soloCount = 0;

// Buses de Retorno Limpio Mix-Minus (N-1) para invitados remotos y conferencias
// targetChannelId -> { targetChannelId, destination, busGain, connectedSources: Set<string> }
const mixMinusBuses = new Map();

// Estado reactivo del compositor
let currentState = {
  activeCam: 1,
  camSlots: [1, 2, 3, 4],
  layoutMode: '1',
  chromaKeyActive: false,
  virtualBg: null,
  logoBase64: null,
  logoConfig: null,
  cintillosVisible: false,
  cintillo: null,
  topic: '',
  voiceEffect: 'normal',
  voiceTarget: 'all',
  getCamStream: null,
  localStream: null,
  remoteCams: [],
  pvwCam: 2,
  transitionProgress: 0,
  transitionFromCam: null,
  transitionToCam: null,
  isReplaying: false,
  replayVideoElement: null,
  replayOverlay: { active: false, label: 'REPLAY', speed: 0.5, progress: 0 },
  cameraBadges: {},
};

const videoElements = new Map();
let virtualBgImage = null;
let logoImage = null;
let logoVideoElement = null;
let lastStreamSync = 0;

let offscreenVideoContainer = null;
function getOffscreenContainer() {
  if (typeof document === 'undefined') return null;
  if (!offscreenVideoContainer) {
    offscreenVideoContainer = document.getElementById('broadcast-offscreen-videos');
    if (!offscreenVideoContainer && document.body) {
      offscreenVideoContainer = document.createElement('div');
      offscreenVideoContainer.id = 'broadcast-offscreen-videos';
      offscreenVideoContainer.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;';
      document.body.appendChild(offscreenVideoContainer);
    }
  }
  return offscreenVideoContainer;
}

function getOrCreateVideo(camId, stream) {
  if (!videoElements.has(camId)) {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.defaultMuted = true;
    v.preservesPitch = false;
    v.defaultPlaybackRate = 1.0;
    try {
      const container = getOffscreenContainer();
      if (container) container.appendChild(v);
    } catch {}
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

let thumbCanvas = null;
let thumbCtx = null;

export function getCameraSnapshots() {
  if (typeof document === 'undefined') return {};
  if (!thumbCanvas) {
    thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = 180;
    thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
  }
  if (!thumbCtx || !currentState.camSlots) return {};

  const snapshots = {};
  currentState.camSlots.forEach((camId) => {
    const v = videoElements.get(camId);
    if (v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
      try {
        thumbCtx.drawImage(v, 0, 0, 320, 180);
        snapshots[camId] = thumbCanvas.toDataURL('image/jpeg', 0.50);
      } catch (_) {}
    }
  });
  return snapshots;
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

  const logoUrl = currentState.logoConfig?.url || currentState.logoBase64;
  const isVideoLogo = currentState.logoConfig?.mediaType === 'video' || (typeof logoUrl === 'string' && (logoUrl.startsWith('data:video') || logoUrl.match(/\.(mp4|webm|mov|mkv)($|\?)/i)));

  if (logoUrl) {
    if (isVideoLogo) {
      logoImage = null;
      if (!logoVideoElement || logoVideoElement.src !== logoUrl) {
        if (logoVideoElement) {
          try { logoVideoElement.pause(); logoVideoElement.src = ''; } catch {}
        }
        logoVideoElement = document.createElement('video');
        logoVideoElement.src = logoUrl;
        logoVideoElement.autoplay = true;
        logoVideoElement.loop = true;
        logoVideoElement.muted = true;
        logoVideoElement.playsInline = true;
        logoVideoElement.crossOrigin = 'anonymous';
        logoVideoElement.play().catch(() => {});
      }
    } else {
      if (logoVideoElement) {
        try { logoVideoElement.pause(); logoVideoElement.src = ''; } catch {}
        logoVideoElement = null;
      }
      if (!logoImage || logoImage.src !== logoUrl) {
        logoImage = new Image();
        logoImage.crossOrigin = 'anonymous';
        logoImage.src = logoUrl;
      }
    }
  } else {
    logoImage = null;
    if (logoVideoElement) {
      try { logoVideoElement.pause(); logoVideoElement.src = ''; } catch {}
      logoVideoElement = null;
    }
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

    // Aplicar Zoom dinámico, punto focal y calibración de color/nitidez si existen para este camId
    let hasFilter = false;
    if (camId && currentState.cameraCrops) {
      const crop = currentState.cameraCrops[camId - 1];
      if (crop) {
        const filterStr = crop.filter || buildCanvasFilter(crop);
        if (filterStr && filterStr !== 'none') {
          ctx.save();
          ctx.filter = filterStr;
          hasFilter = true;
        }

        const zoom = Math.max(1.0, crop.zoom || 1.0);
        const focusX = crop.focusX != null ? crop.focusX : 0.5;
        const focusY = crop.focusY != null ? crop.focusY : 0.42;

        if (zoom > 1.005) {
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
    if (hasFilter) ctx.restore();
    drawCameraNameBadge(x, y, w, h, camId);
  } else {
    // Señal no disponible
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a3f50';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIN SEÑAL', x + w / 2, y + h / 2);
    drawCameraNameBadge(x, y, w, h, camId);
  }
}

// RÓTULOS DE NOMBRE INDIVIDUALES POR CÁMARA (RESTREAM / LOWER THIRDS PARA INVITADOS O CLASES)
function drawCameraNameBadge(x, y, w, h, camId) {
  if (!camId || !currentState.cameraBadges) return;
  const badge = currentState.cameraBadges[camId];
  if (!badge || !badge.enabled || !badge.name || !badge.name.trim()) return;

  const name = badge.name.trim();
  const subtitle = (badge.subtitle || '').trim();
  const position = badge.position || 'bottom-left';

  ctx.save();

  // Escalar el rótulo armónicamente según el tamaño del cuadro (ej. plano completo vs 4-shot)
  const scale = Math.max(0.65, Math.min(1.25, w / 960));
  const fontSizeName = Math.round(18 * scale);
  const fontSizeSub = Math.round(12 * scale);
  const padX = Math.round(14 * scale);
  const padY = Math.round(8 * scale);
  const radius = Math.round(6 * scale);

  ctx.font = `bold ${fontSizeName}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const nameWidth = ctx.measureText(name).width;

  let subWidth = 0;
  if (subtitle) {
    ctx.font = `500 ${fontSizeSub}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    subWidth = ctx.measureText(subtitle).width;
  }

  const badgeW = Math.max(nameWidth, subWidth) + padX * 2;
  const badgeH = (subtitle ? fontSizeName + fontSizeSub + 6 : fontSizeName) + padY * 2;

  const margin = Math.round(20 * scale);
  let bx = x + margin;
  let by = y + h - margin - badgeH;

  if (position === 'bottom-right') {
    bx = x + w - margin - badgeW;
    by = y + h - margin - badgeH;
  } else if (position === 'top-left') {
    bx = x + margin;
    by = y + margin;
  } else if (position === 'top-right') {
    bx = x + w - margin - badgeW;
    by = y + margin;
  }

  // Sombra suave para despegar el rótulo del fondo de video
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = Math.round(10 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(3 * scale);

  // Fondo glassmorphism oscuro y elegante estilo Restream
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, radius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();
  } else {
    ctx.fillRect(bx, by, badgeW, badgeH);
  }

  // Quitar sombra para el texto
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Dibujar Nombre Principal
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSizeName}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, bx + padX, by + padY);

  // Dibujar Subtítulo / Cargo si existe
  if (subtitle) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 ${fontSizeSub}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(subtitle, bx + padX, by + padY + fontSizeName + Math.round(4 * scale));
  }

  ctx.restore();
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

  // Fondo translúcido profesional de cristal templado (Glassmorphism)
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, 'rgba(16, 20, 32, 0.72)');
  bgGrad.addColorStop(1, 'rgba(25, 30, 46, 0.62)');
  ctx.fillStyle = bgGrad;
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

function drawLiveSubtitle(text, style = {}) {
  if (!text || typeof text !== 'string') return;
  const trimmed = text.trim();
  if (!trimmed) return;

  const width = 1920;
  const height = 1080;

  ctx.save();
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(trimmed);
  const textW = metrics.width;
  const paddingX = 32;
  const boxW = Math.min(width - 160, Math.max(280, textW + paddingX * 2));
  const boxH = 64;
  const boxX = (width - boxW) / 2;
  const boxY = height - 95; // Zona inferior central segura

  // Fondo translúcido con desenfoque simulado
  ctx.fillStyle = 'rgba(10, 10, 15, 0.88)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Texto blanco de alto contraste con sombra de lectura
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(trimmed, width / 2, boxY + boxH / 2 + 1);

  ctx.restore();
}

function drawAudioVisualizer(width, height) {
  if (!masterAnalyserNode || !ctx) return;
  const bufferLength = masterAnalyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  masterAnalyserNode.getByteFrequencyData(dataArray);

  const barCount = 42;
  const barWidth = 10;
  const barGap = 6;
  const totalW = barCount * (barWidth + barGap);
  const startX = (width - totalW) / 2;
  const bottomY = height - 30;

  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 10;

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * (bufferLength / 2));
    const val = dataArray[dataIdx] || 0;
    const barHeight = Math.max(4, Math.round((val / 255) * 80));
    const x = startX + i * (barWidth + barGap);
    const y = bottomY - barHeight;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 4);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Distintivo Broadcast Oficial de Repetición Instantánea / Replay en Vivo (P4.3)
 * Muestra el bug de repetición con baliza roja pulsante, velocidad y barra de progreso
 */
function drawReplayOverlay(replayInfo, width, height) {
  if (!ctx) return;
  const speed = replayInfo.speed || 0.5;
  const label = replayInfo.label || 'REPLAY';
  const progress = typeof replayInfo.progress === 'number' ? Math.max(0, Math.min(1, replayInfo.progress)) : 0;

  ctx.save();

  // Animación de pulso para la baliza roja (Broadcast Live / Replay Bug)
  const pulse = Math.sin(Date.now() / 200) * 0.25 + 0.75; // entre 0.5 y 1.0

  const badgeX = width - 340;
  const badgeY = 45;
  const badgeW = 290;
  const badgeH = 54;
  const radius = 10;

  // Fondo translúcido oscuro con borde rojo broadcast
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, radius);
  } else {
    ctx.rect(badgeX, badgeY, badgeW, badgeH);
  }
  ctx.fill();
  ctx.stroke();

  // Luz indicadora roja pulsante (Punto REC/REPLAY)
  const dotX = badgeX + 22;
  const dotY = badgeY + badgeH / 2 - 2;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 12 * pulse;
  ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Texto "REPLAY"
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + 38, dotY + 1);

  // Texto velocidad "· 0.5x SLOW"
  ctx.fillStyle = '#f87171';
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`· ${speed}x SLOW`, badgeX + 130, dotY + 1);

  // Barra de progreso de la repetición en la parte inferior del badge
  if (progress > 0) {
    const barY = badgeY + badgeH - 5;
    const barW = badgeW - 16;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(badgeX + 8, barY, barW, 3);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(badgeX + 8, barY, barW * progress, 3);
  }

  ctx.restore();
}

function renderFrame() {
  if (!ctx) return;
  animFrameId = null;

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

  // 2. Renderizado de cámaras según Layout del switcher (Soporte elástico de 1 a 10+ cámaras)
  // SI HAY REPETICIÓN INSTANTÁNEA ACTIVA (P4.3): Renderizar video de repetición a pantalla completa
  if (currentState.isReplaying && currentState.replayVideoElement) {
    drawCameraCover(currentState.replayVideoElement, 0, 0, width, height, 'REPLAY');
  } else {
    const mode = currentState.layoutMode || '1';
    const activeCam = currentState.activeCam || 1;
    const slots = Array.isArray(currentState.camSlots) && currentState.camSlots.length > 0 
      ? currentState.camSlots 
      : [1, 2, 3, 4];
    const gap = 12;

    if (mode === 'pip') {
      // Fondo: Cámara activa con soporte de transición alfa
      const transitionProgress = typeof currentState.transitionProgress === 'number'
        ? Math.max(0, Math.min(1.0, currentState.transitionProgress))
        : 0;
      const fromCam = currentState.transitionFromCam || activeCam;
      const toCam = currentState.transitionToCam || currentState.pvwCam || (activeCam === 1 ? 2 : 1);

    if (transitionProgress > 0 && fromCam !== toCam) {
      const vFrom = videoElements.get(fromCam);
      drawCameraCover(vFrom, 0, 0, width, height, fromCam);
      ctx.save();
      ctx.globalAlpha = transitionProgress;
      const vTo = videoElements.get(toCam);
      drawCameraCover(vTo, 0, 0, width, height, toCam);
      ctx.restore();
    } else {
      const mainVideo = videoElements.get(activeCam);
      drawCameraCover(mainVideo, 0, 0, width, height, activeCam);
    }

    // PIP superior derecho
    const pipW = 460;
    const pipH = 260;
    const pipX = width - pipW - 40;
    const pipY = 40;
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
  } else if (mode === '2' || mode === 'two-shot') {
    const halfW = (width - gap) / 2;
    const v1 = videoElements.get(slots[0] || 1);
    const v2 = videoElements.get(slots[1] || 2);
    drawCameraCover(v1, 0, 0, halfW, height, slots[0] || 1);
    drawCameraCover(v2, halfW + gap, 0, halfW, height, slots[1] || 2);

    if (mode === 'two-shot') {
      ctx.fillStyle = '#e8612a';
      ctx.fillRect(halfW + gap / 2 - 1.5, 0, 3, height);
    }
  } else if (mode === '3') {
    const halfW = (width - gap) / 2;
    const halfH = (height - gap) / 2;
    const v1 = videoElements.get(slots[0] || 1);
    const v2 = videoElements.get(slots[1] || 2);
    const v3 = videoElements.get(slots[2] || 3);
    drawCameraCover(v1, 0, 0, halfW, height, slots[0] || 1);
    drawCameraCover(v2, halfW + gap, 0, halfW, halfH, slots[1] || 2);
    drawCameraCover(v3, halfW + gap, halfH + gap, halfW, halfH, slots[2] || 3);
  } else if (mode === '4') {
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
  } else if (mode === '6') {
    // 6 cámaras: 3 columnas x 2 filas
    const colW = (width - gap * 2) / 3;
    const rowH = (height - gap) / 2;
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = col * (colW + gap);
      const y = row * (rowH + gap);
      const camId = slots[i] || (i + 1);
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, colW, rowH, camId);
    }
  } else if (mode === '6-lead') {
    // 1 Principal superior/centro (70% altura) y 5 abajo
    const mainH = Math.round(height * 0.70);
    const thumbH = height - mainH - gap;
    const mainVideo = videoElements.get(activeCam);
    drawCameraCover(mainVideo, 0, 0, width, mainH, activeCam);

    const auxSlots = slots.filter(id => id !== activeCam).slice(0, 5);
    const count = Math.max(1, auxSlots.length);
    const thumbW = (width - gap * (count - 1)) / count;
    auxSlots.forEach((camId, i) => {
      const x = i * (thumbW + gap);
      const y = mainH + gap;
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, thumbW, thumbH, camId);
    });
  } else if (mode === '8') {
    // 8 cámaras: 4 columnas x 2 filas
    const colW = (width - gap * 3) / 4;
    const rowH = (height - gap) / 2;
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = col * (colW + gap);
      const y = row * (rowH + gap);
      const camId = slots[i] || (i + 1);
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, colW, rowH, camId);
    }
  } else if (mode === '10') {
    // 10 cámaras: 5 columnas x 2 filas
    const colW = (width - gap * 4) / 5;
    const rowH = (height - gap) / 2;
    for (let i = 0; i < 10; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = col * (colW + gap);
      const y = row * (rowH + gap);
      const camId = slots[i] || (i + 1);
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, colW, rowH, camId);
    }
  } else if (mode === 'gallery') {
    const total = Math.max(1, slots.length);
    let cols = 1;
    let rows = 1;
    if (total === 2) { cols = 2; rows = 1; }
    else if (total <= 4) { cols = 2; rows = 2; }
    else if (total <= 6) { cols = 3; rows = 2; }
    else if (total <= 8) { cols = 4; rows = 2; }
    else { cols = 5; rows = 2; }

    const cellW = (width - gap * (cols - 1)) / cols;
    const cellH = (height - gap * (rows - 1)) / rows;

    for (let i = 0; i < total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellW + gap);
      const y = row * (cellH + gap);
      const camId = slots[i] || (i + 1);
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, cellW, cellH, camId);
    }
  } else if (mode === 'speaker') {
    const mainH = Math.round(height * 0.74);
    const thumbH = height - mainH - gap;
    const mainVideo = videoElements.get(activeCam);
    drawCameraCover(mainVideo, 0, 0, width, mainH, activeCam);

    const otherSlots = slots.filter(id => id !== activeCam);
    const count = Math.max(1, otherSlots.length);
    const thumbW = (width - gap * (count - 1)) / count;
    otherSlots.forEach((camId, i) => {
      const x = i * (thumbW + gap);
      const y = mainH + gap;
      const v = videoElements.get(camId);
      drawCameraCover(v, x, y, thumbW, thumbH, camId);
    });
  } else {
    // Modo 1 (Cámara Principal a Pantalla Completa con MEZCLA ALFA REAL de Broadcast)
    const transitionProgress = typeof currentState.transitionProgress === 'number'
      ? Math.max(0, Math.min(1.0, currentState.transitionProgress))
      : 0;
    const fromCam = currentState.transitionFromCam || activeCam;
    const toCam = currentState.transitionToCam || currentState.pvwCam || (activeCam === 1 ? 2 : 1);

    if (transitionProgress > 0 && fromCam !== toCam) {
      // 1. Dibujar cámara base saliente (FROM)
      const vFrom = videoElements.get(fromCam);
      drawCameraCover(vFrom, 0, 0, width, height, fromCam);

      // 2. Dibujar cámara entrante (TO) con mezcla alfa proporcional real
      ctx.save();
      ctx.globalAlpha = transitionProgress;
      const vTo = videoElements.get(toCam);
      drawCameraCover(vTo, 0, 0, width, height, toCam);
      ctx.restore();
    } else {
      const v = videoElements.get(activeCam);
      drawCameraCover(v, 0, 0, width, height, activeCam);
    }
  }
} // Fin bloque layout regular cuando no hay repetición activa

  // 3. Logo Oficial / Video 3D (Posición, Escala y Opacidad configurables)
  const lConfig = currentState.logoConfig || {};
  const lPosition = lConfig.position || 'top-left';
  const lScale = Math.max(0.3, Math.min(3.0, (lConfig.scale || 100) / 100));
  const lOpacity = Math.max(0.1, Math.min(1.0, (lConfig.opacity != null ? lConfig.opacity : 100) / 100));

  let logoDrawable = null;
  let natW = 0, natH = 0;

  if (logoVideoElement && logoVideoElement.readyState >= 2) {
    logoDrawable = logoVideoElement;
    natW = logoVideoElement.videoWidth || 320;
    natH = logoVideoElement.videoHeight || 320;
  } else if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    logoDrawable = logoImage;
    natW = logoImage.naturalWidth;
    natH = logoImage.naturalHeight;
  }

  if (logoDrawable && natW > 0 && natH > 0) {
    const baseH = 80 * lScale;
    const aspect = natW / natH;
    const logoW = baseH * aspect;
    const logoH = baseH;

    let posX = 50;
    let posY = 45;

    if (lPosition === 'top-right') {
      posX = width - 50 - logoW;
      posY = 45;
    } else if (lPosition === 'bottom-left') {
      const cintilloOffset = (currentState.cintillosVisible && currentState.cintillo?.active) ? 140 : 0;
      posX = 50;
      posY = height - 45 - logoH - cintilloOffset;
    } else if (lPosition === 'bottom-right') {
      const cintilloOffset = (currentState.cintillosVisible && currentState.cintillo?.active) ? 140 : 0;
      posX = width - 50 - logoW;
      posY = height - 45 - logoH - cintilloOffset;
    }

    ctx.save();
    if (lOpacity < 1.0) {
      ctx.globalAlpha = lOpacity;
    }
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.drawImage(logoDrawable, posX, posY, logoW, logoH);
    ctx.restore();
  }

  // 4. Cintillo informativo al aire
  if (currentState.cintillosVisible && currentState.cintillo?.active) {
    drawCintillo(currentState.cintillo, currentState.topic);
  }

  // 5. Subtítulos en vivo (Open Captions) quemados en el video PGM (Fase P1.3)
  if (currentState.subtitlesVisible && currentState.liveSubtitleText) {
    drawLiveSubtitle(currentState.liveSubtitleText, currentState.subtitleStyle);
  }

  // 6. Pizarra Virtual / Anotaciones del Docente (Fase P2.1)
  if (currentState.whiteboardCanvas) {
    ctx.drawImage(currentState.whiteboardCanvas, 0, 0, width, height);
  }

  // 7. Visualizador Espectral de Audio para Radio Virtual (Fase P2.3)
  if (currentState.showAudioVisualizer) {
    drawAudioVisualizer(width, height);
  }

  // 8. Distintivo Broadcast de Repetición Instantánea / Replay en Vivo (Fase P4.3)
  if (currentState.replayOverlay?.active) {
    drawReplayOverlay(currentState.replayOverlay, width, height);
  }

  animFrameId = requestAnimationFrame(renderFrame);
}

function initMixerBuses() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!audioContext && AudioCtx) {
    audioContext = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
  }
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  if (!masterSumGain) {
    // 1. Sumador Maestro
    masterSumGain = audioContext.createGain();
    masterSumGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    // 2. Limitador Master Broadcast (DynamicsCompressor con corte suave para evitar clipping)
    masterLimiterNode = audioContext.createDynamicsCompressor();
    masterLimiterNode.threshold.setValueAtTime(-1.5, audioContext.currentTime);
    masterLimiterNode.knee.setValueAtTime(3.0, audioContext.currentTime);
    masterLimiterNode.ratio.setValueAtTime(20.0, audioContext.currentTime);
    masterLimiterNode.attack.setValueAtTime(0.002, audioContext.currentTime);
    masterLimiterNode.release.setValueAtTime(0.05, audioContext.currentTime);

    // 3. Fader de Salida Master
    masterOutputGain = audioContext.createGain();
    masterOutputGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    // 4. Analizador Master para Vúmetro
    masterAnalyserNode = audioContext.createAnalyser();
    masterAnalyserNode.fftSize = 256;
    masterAnalyserNode.smoothingTimeConstant = 0.6;

    // 5. Destino de Grabación y Streaming
    if (!audioDestination) {
      audioDestination = audioContext.createMediaStreamDestination();
    }

    // 6. Monitor de Retorno Local (Auriculares / Altavoces del estudio)
    monitorSumGain = audioContext.createGain();
    monitorSumGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    monitorOutputGain = audioContext.createGain();
    monitorOutputGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    // Conexión del Bus Master (Grabación y Transmisión)
    masterSumGain.connect(masterOutputGain);
    masterOutputGain.connect(masterLimiterNode);
    masterLimiterNode.connect(audioDestination);
    masterLimiterNode.connect(masterAnalyserNode);

    // Conexión del Bus Monitor (Altavoces / Auriculares)
    monitorSumGain.connect(monitorOutputGain);
    monitorOutputGain.connect(audioContext.destination);

    // Retorno de voz local (Micrófono Host) para monitoreo en auriculares con efecto
    if (!localMicMonitorNode) {
      localMicMonitorNode = audioContext.createGain();
      localMicMonitorNode.gain.setValueAtTime(0, audioContext.currentTime); // Silenciado por defecto para evitar feedback en altavoces abiertos
      localMicMonitorNode.connect(monitorSumGain);
    }

    // 7. Bus de Música de Fondo (BGM)
    bgmGainNode = audioContext.createGain();
    bgmGainNode.gain.setValueAtTime(0.35, audioContext.currentTime);

    bgmDuckingGainNode = audioContext.createGain();
    bgmDuckingGainNode.gain.setValueAtTime(1.0, audioContext.currentTime);

    bgmAnalyserNode = audioContext.createAnalyser();
    bgmAnalyserNode.fftSize = 128;
    bgmAnalyserNode.smoothingTimeConstant = 0.5;

    bgmGainNode.connect(bgmDuckingGainNode);
    bgmDuckingGainNode.connect(bgmAnalyserNode);
    bgmAnalyserNode.connect(masterSumGain);
    bgmAnalyserNode.connect(monitorSumGain);

    // 8. Bus de Efectos de Sonido (SFX)
    sfxGainNode = audioContext.createGain();
    sfxGainNode.gain.setValueAtTime(0.9, audioContext.currentTime);

    sfxAnalyserNode = audioContext.createAnalyser();
    sfxAnalyserNode.fftSize = 128;
    sfxAnalyserNode.smoothingTimeConstant = 0.4;

    sfxGainNode.connect(sfxAnalyserNode);
    sfxAnalyserNode.connect(masterSumGain);
    sfxAnalyserNode.connect(monitorSumGain);
  }
}

export function getBroadcastAudioContext() {
  initMixerBuses();
  return audioContext;
}

function getOrCreateChannelStrip(channelId, label = '') {
  initMixerBuses();
  if (channelStrips.has(channelId)) {
    return channelStrips.get(channelId);
  }

  const trimGain = audioContext.createGain();
  trimGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  // Filtro Paso Alto (80 Hz Butterworth) para eliminar zumbido de AC, retumbos y golpes de mesa
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.setValueAtTime(10, audioContext.currentTime); // 10Hz = Bypass inicial
  highPassFilter.Q.setValueAtTime(0.707, audioContext.currentTime);

  // Puerta de Ruido Dinámica (Noise Gate DSP)
  const noiseGateNode = audioContext.createDynamicsCompressor();
  noiseGateNode.threshold.setValueAtTime(0, audioContext.currentTime); // 0dB = Bypass inicial
  noiseGateNode.knee.setValueAtTime(6, audioContext.currentTime);
  noiseGateNode.ratio.setValueAtTime(1, audioContext.currentTime);
  noiseGateNode.attack.setValueAtTime(0.003, audioContext.currentTime);
  noiseGateNode.release.setValueAtTime(0.2, audioContext.currentTime);

  const faderGain = audioContext.createGain();
  faderGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const duckingGain = audioContext.createGain();
  duckingGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const muteGain = audioContext.createGain();
  muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const soloGain = audioContext.createGain();
  soloGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.5;

  trimGain.connect(highPassFilter);
  highPassFilter.connect(noiseGateNode);
  noiseGateNode.connect(faderGain);
  faderGain.connect(duckingGain);
  duckingGain.connect(muteGain);
  muteGain.connect(soloGain);
  soloGain.connect(analyser);
  analyser.connect(masterSumGain);

  // Invitados remotos y cámaras secundarias también se envían al retorno local para que el conductor los escuche
  if (channelId.startsWith('remote_') || (channelId.startsWith('cam_') && channelId !== 'cam_1')) {
    try {
      analyser.connect(monitorSumGain);
    } catch {}
  }

  const strip = {
    id: channelId,
    label: label || channelId,
    srcNode: null,
    trimGain,
    highPassFilter,
    noiseGateNode,
    faderGain,
    duckingGain,
    muteGain,
    soloGain,
    analyser,
    fader: 1.0,
    gainDb: 0,
    isMuted: false,
    isSolo: false,
    noiseSuppression: false,
  };

  channelStrips.set(channelId, strip);
  return strip;
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

function connectAudioSourceWithFx(key, stream, isMasterCam = false, channelLabel = '') {
  disconnectAudioSource(key);
  initMixerBuses();
  if (!audioContext) return;

  const strip = getOrCreateChannelStrip(key, channelLabel || (isMasterCam ? 'Master Mic (CAM 1)' : `Mic ${key}`));

  try {
    const src = audioContext.createMediaStreamSource(stream);
    const shouldApplyFx = currentState.voiceEffect && currentState.voiceEffect !== 'normal' &&
      (currentState.voiceTarget === 'all' || (currentState.voiceTarget === 'master' && isMasterCam));

    if (shouldApplyFx) {
      const fxNodes = applyVoiceEffectChain(audioContext, src, strip.trimGain, currentState.voiceEffect);
      activeVoiceFxNodes.set(key, fxNodes);
    } else {
      src.connect(strip.trimGain);
    }
    strip.srcNode = src;
    connectedAudioSources.set(key, { src, stream, isMasterCam, strip });

    // Enlazar micrófono principal al nodo de monitoreo de retorno con efectos
    if (isMasterCam && localMicMonitorNode) {
      try {
        strip.analyser.connect(localMicMonitorNode);
      } catch (e) {}
    }

    syncAllMixMinusBuses();
  } catch (e) {
    console.warn('[masterBroadcastEngine] Error conectando pista de audio:', key, e);
  }
}

function reapplyVoiceEffects() {
  initMixerBuses();
  if (!audioContext || !masterSumGain) return;
  if (connectedAudioSources.size === 0 && (currentState.localStream || (currentState.camStreamsMap && currentState.camStreamsMap[1]))) {
    setupAudioMixing(currentState.localStream, currentState.remoteCams, currentState.camStreamsMap, currentState.camMuted);
    return;
  }
  const currentEntries = Array.from(connectedAudioSources.entries());
  currentEntries.forEach(([key, entry]) => {
    if (entry && entry.stream) {
      connectAudioSourceWithFx(key, entry.stream, entry.isMasterCam, entry.strip?.label);
    }
  });
}

function setupAudioMixing(localStream, remoteCams, camStreamsMap = {}, camMutedMap = {}) {
  try {
    initMixerBuses();
    if (!audioContext || !audioDestination) return null;

    // DETERMINAR CÁMARAS PERMITIDAS EN LA MEZCLA MASTER (AUDIO FOLLOWS VIDEO / AFV)
    // En modo '1' (cámara única al aire), ÚNICAMENTE el micrófono de la cámara activa (PGM)
    // ingresa a la mezcla Master. Las demás cámaras (incluido el micrófono de la computadora
    // en CAM 1 cuando no está al aire) se silencian estrictamente para erradicar vicios y eco.
    const layout = currentState.layoutMode || '1';
    const activePgm = currentState.activeCam || 1;
    const slots = Array.isArray(currentState.camSlots) && currentState.camSlots.length > 0 ? currentState.camSlots : [1, 2, 3, 4];
    
    const allowedCams = new Set();
    if (layout === '1') {
      allowedCams.add(activePgm);
    } else if (layout === 'pip') {
      allowedCams.add(activePgm);
      const pipId = currentState.pipCam || (slots.find(id => id !== activePgm) || 2);
      allowedCams.add(pipId);
    } else if (layout === '2' || layout === 'two-shot') {
      allowedCams.add(slots[0] || 1);
      allowedCams.add(slots[1] || 2);
    } else if (layout === '3') {
      allowedCams.add(slots[0] || 1);
      allowedCams.add(slots[1] || 2);
      allowedCams.add(slots[2] || 3);
    } else if (layout === '4') {
      allowedCams.add(slots[0] || 1);
      allowedCams.add(slots[1] || 2);
      allowedCams.add(slots[2] || 3);
      allowedCams.add(slots[3] || 4);
    } else {
      // Modo galería o todos
      slots.forEach(id => allowedCams.add(id));
    }

    // 1. CÁMARA 1 (MICRÓFONO COMPUTADORA / INTERFAZ LOCAL)
    const masterAudioStream = (camStreamsMap && camStreamsMap[1]) || localStream;
    const isCam1Allowed = allowedCams.has(1);
    const isMasterMuted = Boolean(camMutedMap[1]) || !isCam1Allowed;
    if (masterAudioStream && masterAudioStream.getAudioTracks().length > 0) {
      const masterKey = 'cam_1';
      if (!isMasterMuted) {
        if (!connectedAudioSources.has(masterKey) || connectedAudioSources.get(masterKey)?.stream !== masterAudioStream) {
          connectAudioSourceWithFx(masterKey, masterAudioStream, true, 'Master Mic (CAM 1)');
        } else {
          const entry = connectedAudioSources.get(masterKey);
          if (entry?.strip?.muteGain) {
            entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
          }
        }
      } else {
        const entry = connectedAudioSources.get(masterKey);
        if (entry?.strip?.muteGain) {
          entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
        }
      }
    }

    // 2. CONECTAR DEMÁS CÁMARAS (CAM 2 A CAM 12) CON POLÍTICA AFV
    if (camStreamsMap && Object.keys(camStreamsMap).length > 0) {
      Object.entries(camStreamsMap).forEach(([camIdStr, stream]) => {
        const camId = Number(camIdStr);
        if (camId === 1) return;

        const isCamAllowed = allowedCams.has(camId);
        const isCamMuted = Boolean(camMutedMap[camId]) || !isCamAllowed;
        if (stream && stream.getAudioTracks().length > 0) {
          const key = `cam_${camId}`;
          if (!isCamMuted) {
            if (!connectedAudioSources.has(key) || connectedAudioSources.get(key)?.stream !== stream) {
              connectAudioSourceWithFx(key, stream, false, `Cámara ${camId}`);
            } else {
              const entry = connectedAudioSources.get(key);
              if (entry?.strip?.muteGain) {
                entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
              }
            }
          } else {
            const entry = connectedAudioSources.get(key);
            if (entry?.strip?.muteGain) {
              entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
            }
          }
        }
      });
    }

    // 3. CÁMARAS REMOTAS WEBRTC (CON POLÍTICA AFV)
    if (Array.isArray(remoteCams)) {
      remoteCams.forEach((rc) => {
        const rcCamId = rc.slot ? rc.slot + 1 : 2;
        const isRcAllowed = allowedCams.has(rcCamId);
        const isMuted = Boolean(camMutedMap[rcCamId]) || !isRcAllowed;
        if (rc.stream && rc.stream.getAudioTracks().length > 0) {
          const key = `remote_${rc.id || rcCamId}`;
          if (!isMuted) {
            if (!connectedAudioSources.has(key) || connectedAudioSources.get(key)?.stream !== rc.stream) {
              connectAudioSourceWithFx(key, rc.stream, false, `Remoto (${rc.name || rcCamId})`);
            } else {
              const entry = connectedAudioSources.get(key);
              if (entry?.strip?.muteGain) {
                entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
              }
            }
          } else {
            const entry = connectedAudioSources.get(key);
            if (entry?.strip?.muteGain) {
              entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
            }
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

// ============================================================================
// INTEGRACIÓN DE MÚSICA DE FONDO (BGM) & EFECTOS DE SONIDO (SFX) AL MASTER
// ============================================================================

export function connectBgmAudioElement(audioEl) {
  initMixerBuses();
  if (!audioEl || !audioContext || !bgmGainNode) return;
  if (connectedBgmElements.has(audioEl)) return;

  try {
    audioEl.crossOrigin = 'anonymous';
    const sourceNode = audioContext.createMediaElementSource(audioEl);
    sourceNode.connect(bgmGainNode);
    connectedBgmElements.add(audioEl);
    bgmMediaElement = audioEl;
    syncAllMixMinusBuses();
    console.log('[masterBroadcastEngine] Música de Fondo (BGM) conectada a la mezcla Master y buses Mix-Minus');
  } catch (err) {
    console.warn('[masterBroadcastEngine] Conexión BGM MediaElementSource:', err.message);
  }
}

export function setBgmVolume(volumePercent) {
  initMixerBuses();
  if (!bgmGainNode || !audioContext) return;
  const val = Math.max(0, Math.min(1.5, volumePercent / 100));
  bgmGainNode.gain.setTargetAtTime(val, audioContext.currentTime, 0.04);
}

export function setBgmDucking(isDucking, duckLevel = 0.25) {
  initMixerBuses();
  if (!bgmDuckingGainNode || !audioContext) return;
  const target = isDucking ? Math.max(0, Math.min(1.0, duckLevel)) : 1.0;
  const timeConst = isDucking ? 0.06 : 0.35;
  bgmDuckingGainNode.gain.setTargetAtTime(target, audioContext.currentTime, timeConst);
}

// ============================================================================
// AUTO-DUCKING MULTICANAL DINÁMICO POR PRIORIDAD DE CONDUCTOR (P3.2)
// Cuando el Conductor (CAM 1) habla, atenúa BGM y las demás cámaras e invitados
// ============================================================================
export function setHostPriorityDucking(isHostSpeaking, { duckGuests = true, duckLevel = 0.38, duckMusic = true } = {}) {
  initMixerBuses();
  if (!audioContext) return;

  const target = isHostSpeaking ? Math.max(0.1, Math.min(1.0, duckLevel)) : 1.0;
  const timeConst = isHostSpeaking ? 0.05 : 0.45;

  // 1. Atenuación de Música de Fondo
  if (duckMusic && bgmDuckingGainNode) {
    const bgmTarget = isHostSpeaking ? Math.min(target, 0.2) : 1.0;
    bgmDuckingGainNode.gain.setTargetAtTime(bgmTarget, audioContext.currentTime, timeConst);
  }

  // 2. Atenuación de canales secundarios (CAM 2 a CAM 10 y Remotos)
  if (duckGuests) {
    for (const [id, strip] of channelStrips.entries()) {
      if (id !== 'cam_1' && strip && strip.duckingGain) {
        strip.duckingGain.gain.setTargetAtTime(target, audioContext.currentTime, timeConst);
      }
    }
  }
}

export async function playBroadcastSfx(sfxUrl, volume = 0.9) {
  initMixerBuses();
  if (!sfxUrl || !audioContext || !sfxGainNode) return null;

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    let buffer = sfxBufferCache.get(sfxUrl);
    if (!buffer) {
      try {
        const resp = await fetch(sfxUrl);
        const arrayBuf = await resp.arrayBuffer();
        buffer = await audioContext.decodeAudioData(arrayBuf);
        sfxBufferCache.set(sfxUrl, buffer);
      } catch (fetchErr) {
        // Fallback resiliente con MediaElementSource para que siempre ingrese al bus de mezcla y grabación
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = sfxUrl;
        audio.volume = 1.0;
        const mediaElemSource = audioContext.createMediaElementSource(audio);
        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(Math.max(0, Math.min(1.5, volume)), audioContext.currentTime);
        mediaElemSource.connect(gain);
        gain.connect(sfxGainNode);
        activeSfxSources.add(mediaElemSource);
        audio.onended = () => {
          activeSfxSources.delete(mediaElemSource);
          try { mediaElemSource.disconnect(); gain.disconnect(); } catch (e) {}
        };
        await audio.play();
        return audio;
      }
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1.5, volume)), audioContext.currentTime);

    source.connect(gain);
    gain.connect(sfxGainNode);

    activeSfxSources.add(source);
    source.onended = () => {
      activeSfxSources.delete(source);
      try { source.disconnect(); gain.disconnect(); } catch (e) {}
    };

    source.start(0);
    return source;
  } catch (err) {
    console.warn('[masterBroadcastEngine] Error reproduciendo SFX en broadcast:', err.message);
    return null;
  }
}

export function stopBroadcastSfx() {
  activeSfxSources.forEach(s => {
    try { s.stop(); s.disconnect(); } catch (e) {}
  });
  activeSfxSources.clear();
}

// ============================================================================
// BUSES DE RETORNO LIMPIO MIX-MINUS (N-1) (P3.3)
// ============================================================================

function getOrCreateMixMinusBus(targetChannelId) {
  initMixerBuses();
  if (mixMinusBuses.has(targetChannelId)) {
    return mixMinusBuses.get(targetChannelId);
  }

  const destination = audioContext.createMediaStreamDestination();
  const busGain = audioContext.createGain();
  busGain.gain.setValueAtTime(1.0, audioContext.currentTime);
  busGain.connect(destination);

  const bus = {
    targetChannelId,
    destination,
    busGain,
    connectedSources: new Set(),
  };

  mixMinusBuses.set(targetChannelId, bus);
  syncMixMinusBus(bus);
  return bus;
}

function syncMixMinusBus(bus) {
  if (!audioContext || !bus) return;
  const targetId = bus.targetChannelId;

  // 1. Conectar todas las tiras de canal del estudio EXCEPTO targetId
  for (const [id, strip] of channelStrips.entries()) {
    if (id !== targetId) {
      if (!bus.connectedSources.has(id)) {
        try {
          strip.analyser.connect(bus.busGain);
          bus.connectedSources.add(id);
        } catch (e) {}
      }
    }
  }

  // 2. Conectar Música de Fondo (BGM) si existe
  if (bgmAnalyserNode && !bus.connectedSources.has('bgm')) {
    try {
      bgmAnalyserNode.connect(bus.busGain);
      bus.connectedSources.add('bgm');
    } catch (e) {}
  }

  // 3. Conectar Efectos de Sonido (SFX) si existe
  if (sfxAnalyserNode && !bus.connectedSources.has('sfx')) {
    try {
      sfxAnalyserNode.connect(bus.busGain);
      bus.connectedSources.add('sfx');
    } catch (e) {}
  }
}

export function syncAllMixMinusBuses() {
  for (const bus of mixMinusBuses.values()) {
    syncMixMinusBus(bus);
  }
}

/**
 * Obtiene o crea el MediaStream de retorno Mix-Minus para un canal de invitado o cámara.
 * Este stream contiene toda la señal del programa (Conductor, BGM, SFX y demás participantes)
 * EXCLUYENDO el propio micrófono de targetChannelId para evitar eco acústico.
 */
export function getMixMinusStream(targetChannelId) {
  const bus = getOrCreateMixMinusBus(targetChannelId);
  syncMixMinusBus(bus);
  return bus.destination.stream;
}

/**
 * Retorna telemetría y diagnóstico en vivo de todos los buses Mix-Minus activos
 */
export function getMixMinusStatus() {
  const list = [];
  for (const [id, bus] of mixMinusBuses.entries()) {
    list.push({
      targetChannelId: id,
      excludedChannel: id,
      sourcesCount: bus.connectedSources.size,
      connectedSources: Array.from(bus.connectedSources),
      streamId: bus.destination.stream ? bus.destination.stream.id : null,
      active: true,
    });
  }
  return {
    totalBuses: mixMinusBuses.size,
    buses: list,
  };
}

// ============================================================================
// CONTROLES Y TELEMETRÍA DE LA CONSOLA DE AUDIO BROADCAST (P0.4)
// ============================================================================

export function setChannelFader(channelId, val) {
  const strip = channelStrips.get(channelId);
  if (!strip || !audioContext) return;
  strip.fader = Math.max(0, Math.min(1.5, val));
  strip.faderGain.gain.setTargetAtTime(strip.fader, audioContext.currentTime, 0.03);
}

export function setChannelGain(channelId, gainDb) {
  const strip = channelStrips.get(channelId);
  if (!strip || !audioContext) return;
  strip.gainDb = Math.max(-24, Math.min(12, gainDb));
  const linear = Math.pow(10, strip.gainDb / 20);
  strip.trimGain.gain.setTargetAtTime(linear, audioContext.currentTime, 0.03);
}

export function setChannelMute(channelId, isMuted) {
  const strip = channelStrips.get(channelId);
  if (!strip || !audioContext) return;
  strip.isMuted = Boolean(isMuted);
  strip.muteGain.gain.setTargetAtTime(strip.isMuted ? 0.0 : 1.0, audioContext.currentTime, 0.03);
}

export function setChannelSolo(channelId, isSolo) {
  const strip = channelStrips.get(channelId);
  if (!strip || !audioContext) return;
  strip.isSolo = Boolean(isSolo);

  soloCount = 0;
  channelStrips.forEach(s => { if (s.isSolo) soloCount++; });

  channelStrips.forEach(s => {
    const allow = soloCount === 0 || s.isSolo;
    s.soloGain.gain.setTargetAtTime(allow ? 1.0 : 0.0, audioContext.currentTime, 0.03);
  });
}

export function setChannelNoiseSuppression(channelId, enabled, { thresholdDb = -42, highPassHz = 80 } = {}) {
  const strip = channelStrips.get(channelId);
  if (!strip || !audioContext) return;
  strip.noiseSuppression = Boolean(enabled);
  if (strip.noiseSuppression) {
    strip.highPassFilter.frequency.setTargetAtTime(highPassHz, audioContext.currentTime, 0.03);
    strip.noiseGateNode.threshold.setTargetAtTime(thresholdDb, audioContext.currentTime, 0.03);
    strip.noiseGateNode.ratio.setTargetAtTime(12, audioContext.currentTime, 0.03);
  } else {
    strip.highPassFilter.frequency.setTargetAtTime(10, audioContext.currentTime, 0.03);
    strip.noiseGateNode.threshold.setTargetAtTime(0, audioContext.currentTime, 0.03);
    strip.noiseGateNode.ratio.setTargetAtTime(1, audioContext.currentTime, 0.03);
  }
}

export function getChannelNoiseSuppression(channelId) {
  const strip = channelStrips.get(channelId);
  return strip ? Boolean(strip.noiseSuppression) : false;
}

export function setMasterVolume(val) {
  initMixerBuses();
  if (!masterOutputGain || !audioContext) return;
  const fader = Math.max(0, Math.min(1.5, val));
  masterOutputGain.gain.setTargetAtTime(fader, audioContext.currentTime, 0.03);
}

export function setMonitorVolume(val) {
  initMixerBuses();
  if (!monitorOutputGain || !audioContext) return;
  const fader = Math.max(0, Math.min(1.5, val));
  monitorOutputGain.gain.setTargetAtTime(fader, audioContext.currentTime, 0.03);
}

function calculateMeterLevels(analyser) {
  if (!analyser) return { rms: 0, peak: 0, db: -60, clip: false };
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);

  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const val = (data[i] - 128) / 128;
    sum += val * val;
    if (Math.abs(val) > peak) peak = Math.abs(val);
  }
  const rms = Math.sqrt(sum / data.length);
  const db = peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60;
  const pct = Math.min(100, Math.round(((db + 60) / 60) * 100));
  return {
    rms: Math.round(rms * 100),
    peak: Math.round(peak * 100),
    db: Math.round(db * 10) / 10,
    pct,
    clip: peak >= 0.98,
  };
}

export function getAudioMixerTelemetry() {
  const telemetry = {
    channels: {},
    master: calculateMeterLevels(masterAnalyserNode),
    bgm: calculateMeterLevels(bgmAnalyserNode),
    sfx: calculateMeterLevels(sfxAnalyserNode),
    soloActive: soloCount > 0,
  };

  channelStrips.forEach((strip, id) => {
    telemetry.channels[id] = {
      id,
      label: strip.label,
      fader: strip.fader,
      gainDb: strip.gainDb,
      isMuted: strip.isMuted,
      isSolo: strip.isSolo,
      noiseSuppression: Boolean(strip.noiseSuppression),
      meter: calculateMeterLevels(strip.analyser),
    };
  });

  return telemetry;
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
  ensureMasterCanvas();

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

  // Iniciar MediaRecorder: Priorizar WebM estándar con Opus para compatibilidad perfecta con tuberías FFmpeg
  let chosenMime = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(chosenMime)) {
    if (MediaRecorder.isTypeSupported('video/webm')) {
      chosenMime = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
      chosenMime = 'video/webm;codecs=h264,opus';
    } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      chosenMime = 'video/mp4;codecs=avc1';
    }
  }

  try {
    mediaRecorder = new MediaRecorder(masterStream, {
      mimeType: chosenMime,
      videoBitsPerSecond: 10000000, // 10 Mbps Broadcast Full HD nítido
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
 * Obtiene o inicializa el stream compuesto Master 1080p en vivo (Video Canvas + Mezcla Audio)
 */
export function getMasterStream() {
  if (!masterStream || masterStream.getVideoTracks().length === 0 || masterStream.getVideoTracks()[0].readyState === 'ended') {
    ensureMasterCanvas();
    const canvasStream = canvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const audioTrack = setupAudioMixing(
      currentState.localStream,
      currentState.remoteCams,
      currentState.camStreamsMap,
      currentState.camMuted
    );
    const tracks = [videoTrack];
    if (audioTrack) tracks.push(audioTrack);
    masterStream = new MediaStream(tracks);
  }
  return masterStream;
}

/**
 * Crea una sesión de grabación dedicada para el Master con MediaRecorder independiente.
 * Garantiza que el primer chunk contenga la cabecera EBML limpia y completa desde el milisegundo 0,
 * evitando archivos de 0 bytes o corruptos.
 */
export function createMasterRecordingSession(onChunk, timesliceMs = 500) {
  const stream = getMasterStream();
  if (!stream) return null;

  let chosenMime = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(chosenMime)) {
    if (MediaRecorder.isTypeSupported('video/webm')) {
      chosenMime = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
      chosenMime = 'video/webm;codecs=h264,opus';
    } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      chosenMime = 'video/mp4;codecs=avc1';
    }
  }

  try {
    const rec = new MediaRecorder(stream, {
      mimeType: chosenMime,
      videoBitsPerSecond: 10000000,
    });

    rec.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0 && typeof onChunk === 'function') {
        try {
          const buf = await e.data.arrayBuffer();
          onChunk(buf);
        } catch (err) {
          console.warn('[MasterRecorder] Error buffer chunk:', err);
        }
      }
    };

    rec.start(timesliceMs);
    console.log('[MasterRecorder] Sesión de grabación iniciada con MediaRecorder dedicado (mime:', chosenMime, ')');
    return rec;
  } catch (err) {
    console.error('[MasterRecorder] Error iniciando MediaRecorder dedicado:', err);
    return null;
  }
}


/**
 * Actualiza en vivo cualquier parámetro del switcher sin detener la transmisión
 */
export function updateBroadcastState(updates) {
  const voiceUpdated = (updates.voiceEffect !== undefined && updates.voiceEffect !== currentState.voiceEffect) ||
                       (updates.voiceTarget !== undefined && updates.voiceTarget !== currentState.voiceTarget);

  currentState = { ...currentState, ...updates };
  updateImages();
  ensureMasterCanvas();

  if (voiceUpdated) {
    reapplyVoiceEffects();
  }

  if (updates.voiceMonitor !== undefined) {
    setVoiceMonitor(updates.voiceMonitor);
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
 * Activa o desactiva el monitoreo en vivo de la voz del host con efectos en auriculares
 */
export function setVoiceMonitor(enabled, volume = 0.85) {
  initMixerBuses();
  currentState.voiceMonitor = !!enabled;
  if (localMicMonitorNode && audioContext) {
    localMicMonitorNode.gain.setValueAtTime(enabled ? Math.max(0, Math.min(1, volume)) : 0, audioContext.currentTime);
  }
}

export function isVoiceMonitorActive() {
  return !!currentState.voiceMonitor;
}

/**
 * Sincroniza el audio del estudio local en tiempo real sin requerir que la grabación o stream estén activos
 */
export function syncStudioAudio(localStream, remoteCams = [], camStreamsMap = {}, camMutedMap = {}) {
  initMixerBuses();
  if (localStream) currentState.localStream = localStream;
  if (remoteCams) currentState.remoteCams = remoteCams;
  if (camStreamsMap) currentState.camStreamsMap = camStreamsMap;
  if (camMutedMap) currentState.camMuted = camMutedMap;
  return setupAudioMixing(currentState.localStream, currentState.remoteCams, currentState.camStreamsMap, currentState.camMuted);
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

  // Mantener el canvas maestro y los elementos de video activos para que la Salida LAN / OBS y el iPad no se vayan a negro
  ensureMasterCanvas();

  const keys = Array.from(connectedAudioSources.keys());
  keys.forEach((k) => disconnectAudioSource(k));
  connectedAudioSources.clear();
  activeVoiceFxNodes.clear();

  mixMinusBuses.forEach((bus) => {
    try {
      bus.busGain.disconnect();
      if (bus.destination?.stream) {
        bus.destination.stream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {}
  });
  mixMinusBuses.clear();

  chunkListeners.clear();
  cachedInitHeader = null;
}

/**
 * Inicializa y asegura que el Canvas Maestro de 1080p esté siempre activo y renderizando
 */
export function ensureMasterCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    ctx = canvas.getContext('2d', { alpha: false });
  }
  if (!animFrameId) {
    animFrameId = requestAnimationFrame(renderFrame);
  }
  return canvas;
}

/**
 * Obtiene el Canvas Maestro de 1080p para extracción de fotogramas (LAN Feed, OBS, vMix, iPad)
 */
export function getMasterCanvas() {
  return ensureMasterCanvas();
}

/**
 * Controla el overlay de Repetición Instantánea / Replay en Vivo (P4.3)
 */
export function setReplayOverlay(active, label = 'REPLAY', speed = 0.5, progress = 0) {
  currentState.replayOverlay = {
    active: !!active,
    label,
    speed,
    progress,
  };
}
