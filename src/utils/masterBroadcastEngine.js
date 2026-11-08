/**
 * masterBroadcastEngine.js
 * Motor de Composición Broadcast Master para Transmisión en Vivo y Grabación Real
 * 
 * Correcciones aplicadas:
 * - Renderizado mediante Web Worker para evitar congelamiento (Black Screen) en segundo plano.
 * - Limpieza profunda de elementos <video> y DOM en stopBroadcastEngine.
 * - Prevención de duplicación de Event Listeners en streams.
 */

import { applyVoiceEffectChain } from './voiceEffectsProcessor.js';
import { applyLutOverlay, buildCanvasFilter, drawVignette } from './videoLook.js';

let canvas = null;
let ctx = null;
let animFrameId = null;
let renderWorker = null; // Nuevo Web Worker para renderizado sin throttling
let mediaRecorder = null;
let teleprompterStartedAt = 0;
let teleprompterLayoutCache = { key: '', lines: [] };
let masterStream = null;
let audioContext = null;
let audioDestination = null;
let connectedAudioSources = new Map();
let activeVoiceFxNodes = new Map();
let isCanvasRenderLoopActive = false;
let isBroadcastEngineActive = false;

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

const channelStrips = new Map();
let soloCount = 0;

const mixMinusBuses = new Map();

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
  teleprompterText: '',
  teleprompterSpeed: 2,
  teleprompterFontSize: 36,
  isTeleprompterPlaying: false,
  cameraBadges: {},
};

const videoElements = new Map();
let virtualBgImage = null;
let logoImage = null;
let logoVideoElement = null;
let lastStreamSync = 0;
let lastReadyProgramCam = 1;
let isNativeEngineActive = false;
let nativeAudioProcessor = null;

export function isNativeEngineBroadcasting() {
  return isNativeEngineActive;
}

export function ensureNativeAudioTap() {
  if (!audioContext || !masterLimiterNode) return;
  if (nativeAudioProcessor) return;
  try {
    nativeAudioProcessor = audioContext.createScriptProcessor(4096, 2, 2);
    nativeAudioProcessor.onaudioprocess = (e) => {
      if (!isNativeEngineActive || !window.api?.nativeEngine) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      const len = left.length;
      const pcm16 = new Int16Array(len * 2);
      for (let i = 0; i < len; i++) {
        const sL = Math.max(-1, Math.min(1, left[i]));
        const sR = Math.max(-1, Math.min(1, right[i]));
        pcm16[i * 2] = sL < 0 ? sL * 32768 : sL * 32767;
        pcm16[i * 2 + 1] = sR < 0 ? sR * 32768 : sR * 32767;
      }
      window.api.nativeEngine.writeAudio(pcm16.buffer);
    };
    const silentSink = audioContext.createGain();
    silentSink.gain.value = 0;
    masterLimiterNode.connect(nativeAudioProcessor);
    nativeAudioProcessor.connect(silentSink);
    silentSink.connect(audioContext.destination);
  } catch (err) {
    console.warn('[NativeEngine] No se pudo conectar captura de audio PCM:', err);
  }
}

export async function startNativeEngineBroadcast(destinations, config) {
  if (!window.api?.nativeEngine) return { success: false, error: 'API nativa no disponible' };
  try {
    const res = await window.api.nativeEngine.start({ destinations, config });
    if (res.success) {
      isNativeEngineActive = true;
      ensureNativeAudioTap();
    }
    return res;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function stopNativeEngineBroadcast() {
  isNativeEngineActive = false;
  if (window.api?.nativeEngine) {
    try { await window.api.nativeEngine.stop(); } catch (e) {}
  }
  return { success: true };
}

function getReadyProgramVideo(camId) {
  const target = videoElements.get(camId);
  if (target && target.videoWidth > 0 && (target.readyState >= 1 || !target.paused)) {
    lastReadyProgramCam = camId;
    return target;
  }
  // Si el video de fondo aún no reporta readyState, buscar elemento DOM activo con el mismo stream
  if (typeof document !== 'undefined') {
    const domVideos = document.querySelectorAll('video');
    for (const dv of domVideos) {
      if (dv !== target && dv.videoWidth > 0 && (dv.readyState >= 1 || !dv.paused)) {
        if (dv.srcObject && target && target.srcObject && dv.srcObject === target.srcObject) {
          lastReadyProgramCam = camId;
          return dv;
        }
      }
    }
  }
  const previous = videoElements.get(lastReadyProgramCam);
  if (previous && previous.videoWidth > 0 && (previous.readyState >= 1 || !previous.paused)) {
    return previous;
  }
  return target || previous;
}

let offscreenVideoContainer = null;
function getOffscreenContainer() {
  if (typeof document === 'undefined') return null;
  if (!offscreenVideoContainer) {
    offscreenVideoContainer = document.getElementById('broadcast-offscreen-videos');
    if (!offscreenVideoContainer && document.body) {
      offscreenVideoContainer = document.createElement('div');
      offscreenVideoContainer.id = 'broadcast-offscreen-videos';
      // Mantener dentro del viewport activo con dimensiones reales (320x180) para que Chromium NUNCA suspenda ni desacelere la decodificación de cuadros
      offscreenVideoContainer.style.cssText = 'position:fixed;bottom:0;right:0;width:320px;height:180px;opacity:0.01;pointer-events:none;z-index:-9999;overflow:hidden;';
      document.body.appendChild(offscreenVideoContainer);
    }
  }
  return offscreenVideoContainer;
}

// Inicializa el Worker de renderizado para saltar el límite de requestAnimationFrame
// Inicializa el Worker de renderizado para saltar el límite de requestAnimationFrame
function fallbackRafLoop() {
  const loop = () => {
    if (!isCanvasRenderLoopActive) return;
    try { renderFrame(); } catch (e) {}
    animFrameId = requestAnimationFrame(loop);
  };
  animFrameId = requestAnimationFrame(loop);
}

function startRenderLoop() {
  isCanvasRenderLoopActive = true;
  try {
    if (!renderWorker) {
      const blob = new Blob([`
        let interval;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            interval = setInterval(() => self.postMessage('tick'), 1000 / 30);
          } else if (e.data === 'stop') {
            if (interval) { clearInterval(interval); interval = null; }
          }
        };
      `], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      renderWorker = new Worker(url);
      renderWorker.onmessage = () => { if (isCanvasRenderLoopActive) { try { renderFrame(); } catch(e) {} } };
      renderWorker.onerror = () => {
        console.warn('Render worker failed, falling back to RAF');
        try { URL.revokeObjectURL(url); } catch(e){}
        renderWorker = null;
        fallbackRafLoop();
      };
    }
    renderWorker.postMessage('start');
  } catch (e) {
    console.warn('Worker init failed:', e);
    fallbackRafLoop();
  }
}

function stopRenderLoop() {
  isCanvasRenderLoopActive = false;
  if (renderWorker) renderWorker.postMessage('stop');
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function getOrCreateVideo(camId, stream) {
  if (!videoElements.has(camId)) {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.defaultMuted = true;
    v.width = 320;
    v.height = 180;
    v.style.cssText = 'width:320px;height:180px;position:absolute;bottom:0;right:0;object-fit:cover;';
    v.preservesPitch = false;
    v.defaultPlaybackRate = 1.0;
    v.hasTrackListeners = false; // Bandera para evitar fuga de listeners
    try {
      const container = getOffscreenContainer();
      if (container) container.appendChild(v);
    } catch {}
    videoElements.set(camId, v);
  }
  const v = videoElements.get(camId);
  if (stream) {
    if (v.srcObject !== stream) {
      v.srcObject = stream;
      if (!v.hasTrackListeners) {
        v.hasTrackListeners = true;
        const triggerPlay = () => {
          if (v && v.paused) {
            v.play().catch((e) => {
              if (!v.playWarned) { v.playWarned = true; console.warn('[Master] El video offscreen no pudo reproducir:', e?.message || e); }
            });
          }
        };
        v.addEventListener('loadedmetadata', triggerPlay);
        v.addEventListener('canplay', triggerPlay);
        if (stream.addEventListener) {
          stream.addEventListener('addtrack', triggerPlay);
        }
        const vTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
        vTracks.forEach(t => {
          t.addEventListener('unmute', triggerPlay);
        });
      }
    }
    if (v.paused) {
      v.play().catch((e) => {
        if (!v.playWarned) { v.playWarned = true; console.warn('[Master] El video offscreen no pudo reproducir:', e?.message || e); }
      });
    }
  } else if (v.srcObject) {
    v.srcObject = null;
  }
  return v;
}

function syncVideoStreams() {
  // Procesar todos los slots activos
  if (currentState.getCamStream && currentState.camSlots) {
    currentState.camSlots.forEach((id) => {
      const stream = currentState.getCamStream(id);
      getOrCreateVideo(id, stream);
    });
  }
  // Asegurar que streams de camStreamsMap también se registren
  if (currentState.camStreamsMap) {
    Object.entries(currentState.camStreamsMap).forEach(([idStr, stream]) => {
      const id = Number(idStr);
      if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
        getOrCreateVideo(id, stream);
      }
    });
  }
  // Procesar remoteCams que puedan tener streams adicionales
  if (Array.isArray(currentState.remoteCams)) {
    currentState.remoteCams.forEach((rc) => {
      if (rc.stream && rc.stream.getVideoTracks && rc.stream.getVideoTracks().length > 0) {
        const slotId = rc.slot ? rc.slot + 1 : 2;
        getOrCreateVideo(slotId, rc.stream);
      }
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

// Guardia contra cuadros NEGROS en programa/grabación/streaming:
// un track USB saturado se marca 'muted' y su <video> pinta negro puro con
// readyState y videoWidth normales; tampoco sirve un elemento cuyo
// currentTime dejó de avanzar. En ambos casos se conserva el último cuadro
// bueno de esa cámara en vez de copiar el negro al canvas Master.
const camFrameHealth = new Map(); // camId -> { lastTime, lastAdvanceAt, stuck }
const camLastGoodFrame = new Map(); // camId -> { canvas, at }

function getVideoTrackOf(video) {
  try { return video?.srcObject?.getVideoTracks?.()[0] || null; } catch (e) { return null; }
}

function isFrameUsable(video, camId) {
  if (!video) return false;
  const track = getVideoTrackOf(video);
  if (track && (track.readyState !== 'live' || track.muted)) return false;
  if (camId != null) {
    const now = performance.now();
    const t = video.currentTime || 0;
    let health = camFrameHealth.get(camId);
    if (!health) { health = { lastTime: t, lastAdvanceAt: now, stuck: false }; camFrameHealth.set(camId, health); }
    if (t > health.lastTime + 0.001) { health.lastTime = t; health.lastAdvanceAt = now; health.stuck = false; }
    else if (now - health.lastAdvanceAt > 1500) { health.stuck = true; }
    if (health.stuck && video.readyState >= 2) return false;
  }
  return true;
}

function cacheGoodFrame(video, camId) {
  if (camId == null || !video || !video.videoWidth) return;
  const now = performance.now();
  const prev = camLastGoodFrame.get(camId);
  if (prev && now - prev.at < 500) return; // respaldo 2 veces por segundo basta
  let entry = prev;
  if (!entry) { entry = { canvas: document.createElement('canvas'), at: 0 }; camLastGoodFrame.set(camId, entry); }
  const scale = Math.min(1, 1280 / video.videoWidth);
  entry.canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
  entry.canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
  try { entry.canvas.getContext('2d').drawImage(video, 0, 0, entry.canvas.width, entry.canvas.height); entry.at = now; } catch (e) {}
}

function drawCameraCover(video, x, y, w, h, camId = null) {
  const isVideoReady = Boolean(
    video && isFrameUsable(video, camId) && (
      video.readyState >= 2 ||
      (video.readyState >= 1 && video.videoWidth > 0 && !video.paused) ||
      (video.videoWidth > 0 && video.currentTime > 0)
    )
  );
  if (isVideoReady) {
    cacheGoodFrame(video, camId);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
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

    let hasFilter = false;
    if (camId && currentState.cameraCrops) {
      const crop = currentState.cameraCrops[camId - 1];
      if (crop) {
      const baseFilter = crop.colorEnabled === true ? (crop.filter || buildCanvasFilter(crop)) : 'none';
        // Never blur a 1080p source to simulate noise reduction: it destroys
        // real detail and makes the image look like a lower resolution feed.
        const filterStr = baseFilter;
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
    // LUTs and vignette must run after the source is composited. Applying them
    // to the preview alone made the calibration buttons decorative in PGM,
    // recording and RTMP output.
    const crop = camId && currentState.cameraCrops ? currentState.cameraCrops[camId - 1] : null;
    if (crop?.colorEnabled === true && crop.lutId && crop.lutId !== 'none') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x, y);
      applyLutOverlay(ctx, w, h, crop.lutId);
      ctx.restore();
    }
    if (crop?.colorEnabled === true && crop.lookPreset === 'cinematic-film') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x, y);
      drawVignette(ctx, w, h, 12, 78);
      ctx.restore();
    }
    drawCameraNameBadge(x, y, w, h, camId);
  } else {
    const lastGood = camId != null ? camLastGoodFrame.get(camId) : null;
    if (lastGood && lastGood.canvas.width > 0) {
      // Señal interrumpida (track muteado o cuadro congelado): se mantiene el
      // último cuadro bueno en vez de irse a negro, que era lo que terminaba
      // en las grabaciones cuando el bus USB se saturaba.
      ctx.drawImage(lastGood.canvas, x, y, w, h);
    } else {
      ctx.fillStyle = '#0c0e14';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#3a3f50';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SIN SEÑAL', x + w / 2, y + h / 2);
    }
    drawCameraNameBadge(x, y, w, h, camId);
  }
}

function drawCameraNameBadge(x, y, w, h, camId) {
  if (!camId) return;
  const badges = currentState.cameraBadges || {};
  const badge = badges[camId];

  let name = '';
  let subtitle = '';
  let position = 'bottom-left';

  if (badge && badge.name && badge.name.trim() && badge.enabled !== false) {
    name = badge.name.trim();
    subtitle = (badge.subtitle || '').trim();
    position = badge.position || 'bottom-left';
  } else if (!badge || badge.enabled !== false) {
    const slotIdx = camId - 1;
    const meta = currentState.cameraMeta ? (currentState.cameraMeta[slotIdx] || currentState.cameraMeta[camId]) : null;
    if (meta && meta.guestName && meta.guestName.trim()) {
      name = meta.guestName.trim();
      subtitle = (meta.guestRole || '').trim();
    } else if (meta && meta.label && !meta.label.startsWith('CAM') && !meta.label.startsWith('Cámara') && !meta.label.startsWith('Celular')) {
      name = meta.label.trim();
    } else if (camId === 1 && currentState.hostName && currentState.hostName.trim()) {
      name = currentState.hostName.trim();
      subtitle = (currentState.hostRole || '').trim();
    } else if (camId === 2 && currentState.guestName && currentState.guestName.trim() && currentState.guestName !== 'Invitado Especial') {
      name = currentState.guestName.trim();
      subtitle = (currentState.guestRole || '').trim();
    }
  }

  if (!name) return;

  ctx.save();
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

  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = Math.round(10 * scale);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(3 * scale);
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

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSizeName}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, bx + padX, by + padY);

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
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;

  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, 'rgba(16, 20, 32, 0.72)');
  bgGrad.addColorStop(1, 'rgba(25, 30, 46, 0.62)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, 8, h, [radius, 0, 0, radius]);
  ctx.fill();

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

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const textX = x + 24;
  const textY = y + (subtitle ? 72 : 58);
  ctx.fillText(title, textX, textY);

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
  const boxY = height - 95; 

  ctx.fillStyle = 'rgba(10, 10, 15, 0.88)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 12);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

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

function drawReplayOverlay(replayInfo, width, height) {
  if (!ctx) return;
  const speed = replayInfo.speed || 0.5;
  const label = replayInfo.label || 'REPLAY';
  const progress = typeof replayInfo.progress === 'number' ? Math.max(0, Math.min(1, replayInfo.progress)) : 0;

  ctx.save();
  const pulse = Math.sin(Date.now() / 200) * 0.25 + 0.75; 

  const badgeX = width - 340;
  const badgeY = 45;
  const badgeW = 290;
  const badgeH = 54;
  const radius = 10;

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

  const dotX = badgeX + 22;
  const dotY = badgeY + badgeH / 2 - 2;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 12 * pulse;
  ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + 38, dotY + 1);

  ctx.fillStyle = '#f87171';
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`· ${speed}x SLOW`, badgeX + 130, dotY + 1);

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

// Función de chroma key real (green screen)
function applyChromaKey(ctx, videoFrame, bgImage, width, height, options = {}) {
  // Dibujar frame de video primero
  ctx.drawImage(videoFrame, 0, 0, width, height);
  
  if (!bgImage || !bgImage.complete || bgImage.naturalWidth === 0) return;
  
  const threshold = options.threshold || 120;
  const similarity = options.similarity || 0.3;
  const smoothness = options.smoothness || 0.1;
  const spill = options.spill || 0.2;
  
  // Obtener datos de píxeles del video
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Dibujar fondo en canvas temporal para obtener píxeles
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(bgImage, 0, 0, width, height);
  const bgPixels = tempCtx.getImageData(0, 0, width, height).data;
  
  // Chroma key: detectar verde fuerte
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Detectar píxeles verdes (chroma key)
    // Usar diferencia de color: g > r + threshold && g > b + threshold
    const isGreen = g > r + threshold && g > b + threshold && g > 100;
    
    if (isGreen && a > 0) {
      // Reemplazar con fondo
      data[i] = bgPixels[i];
      data[i + 1] = bgPixels[i + 1];
      data[i + 2] = bgPixels[i + 2];
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

function renderFrame() {
  if (!ctx) return;
  if (!sceneNeedsRedraw()) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const width = 1920;
  const height = 1080;

  if (currentState.chromaKeyActive && virtualBgImage && virtualBgImage.complete && virtualBgImage.naturalWidth > 0) {
    ctx.drawImage(virtualBgImage, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, width, height);
  }

  // Si hay chroma key activo, aplicarlo al video principal
  const hasChromaKey = currentState.chromaKeyActive && virtualBgImage && virtualBgImage.complete && virtualBgImage.naturalWidth > 0;
  const activeVideo = videoElements.get(currentState.activeCam || 1);
  if (hasChromaKey && activeVideo && activeVideo.readyState >= 2) {
    applyChromaKey(ctx, activeVideo, virtualBgImage, width, height);
  }

  if (!lastStreamSync || (Date.now() - lastStreamSync > 1000)) {
    lastStreamSync = Date.now();
    syncVideoStreams();
  }

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
      const transitionProgress = typeof currentState.transitionProgress === 'number'
        ? Math.max(0, Math.min(1.0, currentState.transitionProgress)) : 0;
      const fromCam = currentState.transitionFromCam || activeCam;
      const toCam = currentState.transitionToCam || currentState.pvwCam || (activeCam === 1 ? 2 : 1);

      if (transitionProgress > 0 && fromCam !== toCam) {
        const vFrom = videoElements.get(fromCam);
        drawCameraCover(vFrom, 0, 0, width, height, fromCam);
        ctx.save();
        ctx.globalAlpha = transitionProgress;
        const vTo = getReadyProgramVideo(toCam);
        drawCameraCover(vTo, 0, 0, width, height, toCam);
        ctx.restore();
      } else {
        const mainVideo = getReadyProgramVideo(activeCam);
        drawCameraCover(mainVideo, 0, 0, width, height, activeCam);
      }

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
    } else if (mode === 'gallery') {
      const total = Math.max(1, slots.length);
      let cols = 1, rows = 1;
      if (total === 2) { cols = 2; rows = 1; }
      else if (total <= 4) { cols = 2; rows = 2; }
      else if (total <= 6) { cols = 3; rows = 2; }
      else if (total <= 8) { cols = 4; rows = 2; }
      else if (total <= 9) { cols = 3; rows = 3; }
      else if (total <= 12) { cols = 4; rows = 3; }
      else if (total <= 16) { cols = 4; rows = 4; }
      else { cols = Math.ceil(Math.sqrt(total)); rows = Math.ceil(total / cols); }

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
      const mainVideo = getReadyProgramVideo(activeCam);
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
      const transitionProgress = typeof currentState.transitionProgress === 'number'
        ? Math.max(0, Math.min(1.0, currentState.transitionProgress)) : 0;
      const fromCam = currentState.transitionFromCam || activeCam;
      const toCam = currentState.transitionToCam || currentState.pvwCam || (activeCam === 1 ? 2 : 1);

      if (transitionProgress > 0 && fromCam !== toCam) {
        const vFrom = videoElements.get(fromCam);
        drawCameraCover(vFrom, 0, 0, width, height, fromCam);
        ctx.save();
        ctx.globalAlpha = transitionProgress;
        const vTo = getReadyProgramVideo(toCam);
        drawCameraCover(vTo, 0, 0, width, height, toCam);
        ctx.restore();
      } else {
        const v = getReadyProgramVideo(activeCam);
        drawCameraCover(v, 0, 0, width, height, activeCam);
      }
    }
  }

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
    let posX = 50, posY = 45;

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
    if (lOpacity < 1.0) ctx.globalAlpha = lOpacity;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(logoDrawable, posX, posY, logoW, logoH);
    ctx.restore();
  }

  if (currentState.cintillosVisible && currentState.cintillo?.active) {
    drawCintillo(currentState.cintillo, currentState.topic);
  }

  if (currentState.subtitlesVisible && currentState.liveSubtitleText) {
    drawLiveSubtitle(currentState.liveSubtitleText, currentState.subtitleStyle);
  }

  if (currentState.whiteboardCanvas) {
    ctx.drawImage(currentState.whiteboardCanvas, 0, 0, width, height);
  }

  if (currentState.showAudioVisualizer) {
    drawAudioVisualizer(width, height);
  }

  if (currentState.replayOverlay?.active) {
    drawReplayOverlay(currentState.replayOverlay, width, height);
  }

  if (currentState.isTeleprompterPlaying && currentState.teleprompterText) {
    const text = String(currentState.teleprompterText).trim();
    const fontSize = Math.max(24, Math.min(64, Number(currentState.teleprompterFontSize) || 36));
    const lineHeight = Math.round(fontSize * 1.42);
    ctx.save();
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxWidth = width - 220;
    const layoutKey = `${fontSize}:${text}`;
    if (teleprompterLayoutCache.key !== layoutKey) {
      const lines = [];
      let line = '';
      for (const word of text.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      if (line) lines.push(line);
      teleprompterLayoutCache = { key: layoutKey, lines };
    }
    const lines = teleprompterLayoutCache.lines;
    const clipTop = 160;
    const clipHeight = height - clipTop - 90;
    ctx.beginPath();
    ctx.rect(70, clipTop, width - 140, clipHeight);
    ctx.clip();
    const elapsed = Math.max(0, (Date.now() - (teleprompterStartedAt || Date.now())) / 1000);
    const speed = Math.max(0.5, Math.min(6, Number(currentState.teleprompterSpeed) || 2));
    let y = height - ((elapsed * speed * 28) % (height + lines.length * lineHeight));
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 7;
    for (const item of lines) {
      ctx.fillText(item, width / 2, y, maxWidth);
      y += lineHeight;
    }
    ctx.restore();
  }

  // Emisión nativa v2: enviar fotograma crudo RGBA al motor nativo sin recodificar en WebM
  if (isNativeEngineActive && window.api?.nativeEngine) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      window.api.nativeEngine.writeFrame(imgData.data.buffer);
    } catch (e) {}
  }
}

function initMixerBuses() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext || audioContext.state === 'closed') {
    try { audioContext?.close(); } catch (e) {}
    audioContext = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
    // Reset node references if recreated
    masterSumGain = null;
    masterLimiterNode = null;
    masterOutputGain = null;
    monitorSumGain = null;
    monitorOutputGain = null;
    masterAnalyserNode = null;
    localMicMonitorNode = null;
    bgmGainNode = null;
    bgmDuckingGainNode = null;
    bgmAnalyserNode = null;
    sfxGainNode = null;
    sfxAnalyserNode = null;
    channelStrips.clear();
    mixMinusBuses.clear();
    connectedAudioSources.clear();
    activeVoiceFxNodes.clear();
    audioDestination = null;
  }
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }

  if (!masterSumGain) {
    masterSumGain = audioContext.createGain();
    masterSumGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    masterLimiterNode = audioContext.createDynamicsCompressor();
    masterLimiterNode.threshold.setValueAtTime(-1.5, audioContext.currentTime);
    masterLimiterNode.knee.setValueAtTime(3.0, audioContext.currentTime);
    masterLimiterNode.ratio.setValueAtTime(20.0, audioContext.currentTime);
    masterLimiterNode.attack.setValueAtTime(0.002, audioContext.currentTime);
    masterLimiterNode.release.setValueAtTime(0.05, audioContext.currentTime);

    masterOutputGain = audioContext.createGain();
    masterOutputGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    masterAnalyserNode = audioContext.createAnalyser();
    masterAnalyserNode.fftSize = 256;
    masterAnalyserNode.smoothingTimeConstant = 0.6;

    if (!audioDestination) {
      audioDestination = audioContext.createMediaStreamDestination();
    }

    monitorSumGain = audioContext.createGain();
    monitorSumGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    monitorOutputGain = audioContext.createGain();
    monitorOutputGain.gain.setValueAtTime(1.0, audioContext.currentTime);

    masterSumGain.connect(masterOutputGain);
    masterOutputGain.connect(masterLimiterNode);
    masterLimiterNode.connect(audioDestination);
    masterLimiterNode.connect(masterAnalyserNode);

    monitorSumGain.connect(monitorOutputGain);
    monitorOutputGain.connect(audioContext.destination);

    if (!localMicMonitorNode) {
      localMicMonitorNode = audioContext.createGain();
      localMicMonitorNode.gain.setValueAtTime(0, audioContext.currentTime); 
      localMicMonitorNode.connect(monitorSumGain);
    }

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
  if (channelStrips.has(channelId)) return channelStrips.get(channelId);

  const trimGain = audioContext.createGain();
  trimGain.gain.setValueAtTime(1.0, audioContext.currentTime);

  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.setValueAtTime(10, audioContext.currentTime); 
  highPassFilter.Q.setValueAtTime(0.707, audioContext.currentTime);

  const noiseGateNode = audioContext.createDynamicsCompressor();
  noiseGateNode.threshold.setValueAtTime(0, audioContext.currentTime);
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
    try { if (entry?.src) entry.src.disconnect(); } catch (e) {}
    connectedAudioSources.delete(key);
  }
  if (activeVoiceFxNodes.has(key)) {
    const nodes = activeVoiceFxNodes.get(key);
    if (Array.isArray(nodes)) {
      nodes.forEach((n) => {
        try { n.disconnect(); } catch (e) {}
        if (typeof n.stop === 'function') { try { n.stop(); } catch (e) {} }
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

    if (isMasterCam && localMicMonitorNode) {
      try { strip.analyser.disconnect(localMicMonitorNode); } catch (e) {}
      try { strip.analyser.connect(localMicMonitorNode); } catch (e) {}
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
  const activePgm = currentState.activeCam || 1;
  const currentEntries = Array.from(connectedAudioSources.entries());
  currentEntries.forEach(([key, entry]) => {
    if (entry && entry.stream) {
      const camNum = parseInt(key.replace(/\D/g, ''), 10) || 1;
      const isMaster = (camNum === activePgm);
      connectAudioSourceWithFx(key, entry.stream, isMaster, entry.strip?.label);
    }
  });
}
function pruneDeadAudioSources() {
  for (const [key, entry] of connectedAudioSources.entries()) {
    const tracks = entry.stream?.getAudioTracks?.() || [];
    const alive = tracks.some(t => t.readyState === 'live');
    if (!alive) {
      try { disconnectAudioSource(key); } catch (e) {}
      connectedAudioSources.delete(key);
    }
  }
}



let isMixing = false;
function setupAudioMixing(localStream, remoteCams, camStreamsMap = {}, camMutedMap = {}) {
  // Permitir re-ejecución si pasaron más de 500ms desde la última llamada
  if (isMixing && Date.now() - (window.__lastAudioMix || 0) < 500) {
    return audioDestination?.stream?.getAudioTracks?.()?.[0] || null;
  }
  window.__lastAudioMix = Date.now();
  isMixing = true;
  try {
    initMixerBuses();
    pruneDeadAudioSources();
    if (!audioContext || !audioDestination) return null;
    const activePgm = currentState.activeCam || 1;
    // Audio-follow-video is deliberately independent of the visual layout.
    const layout = currentState.layoutMode || '1';
    const isMultiCamLayout = layout !== '1';
    const isProgramCamera = (camId) => {
      const id = Number(camId);
      if (id === Number(activePgm)) return true;
      if (isMultiCamLayout) {
        if (layout === '2' && (id === 1 || id === 2)) return true;
        if (layout === '3' && (id === 1 || id === 2 || id === 3)) return true;
        if (layout === '4' && (id === 1 || id === 2 || id === 3 || id === 4)) return true;
        if (layout === 'pip' && (id === Number(activePgm) || id === Number(currentState.pipCam || 2))) return true;
      }
      return false;
    };

    const masterAudioStream = (camStreamsMap && camStreamsMap[1]) || localStream;
    const isMasterMuted = Boolean(camMutedMap[1]) || !isProgramCamera(1);
    const isCam1Master = (activePgm === 1);
    if (masterAudioStream && masterAudioStream.getAudioTracks().length > 0) {
      const masterKey = 'cam_1';
      if (!isMasterMuted) {
        if (!connectedAudioSources.has(masterKey) || connectedAudioSources.get(masterKey)?.stream !== masterAudioStream) {
          connectAudioSourceWithFx(masterKey, masterAudioStream, isCam1Master, 'Master Mic (CAM 1)');
        } else {
          const entry = connectedAudioSources.get(masterKey);
          if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
        }
      } else {
        const entry = connectedAudioSources.get(masterKey);
        if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
      }
    }

    const processedStreams = new Set();
    if (masterAudioStream) processedStreams.add(masterAudioStream);

    if (camStreamsMap && Object.keys(camStreamsMap).length > 0) {
      Object.entries(camStreamsMap).forEach(([camIdStr, stream]) => {
        const camId = Number(camIdStr);
        if (camId === 1) return;
        if (stream) processedStreams.add(stream);
        const isCamMuted = Boolean(camMutedMap[camId]) || !isProgramCamera(camId);
        const isCamMaster = (camId === activePgm);
        if (stream && stream.getAudioTracks().length > 0) {
          const key = `cam_${camId}`;
          if (!isCamMuted) {
            if (!connectedAudioSources.has(key) || connectedAudioSources.get(key)?.stream !== stream) {
              connectAudioSourceWithFx(key, stream, isCamMaster, `Cámara ${camId}`);
            } else {
              const entry = connectedAudioSources.get(key);
              if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
            }
          } else {
            const entry = connectedAudioSources.get(key);
            if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
          }
        }
      });
    }

    if (Array.isArray(remoteCams)) {
      remoteCams.forEach((rc) => {
        if (!rc.stream || processedStreams.has(rc.stream)) return;
        const rcCamId = rc.slot ? rc.slot + 1 : 2;
        const isMuted = Boolean(camMutedMap[rcCamId]) || !isProgramCamera(rcCamId);
        const isRcMaster = (rcCamId === activePgm);
        if (rc.stream && rc.stream.getAudioTracks().length > 0) {
          const key = `remote_${rc.id || rcCamId}`;
          if (!isMuted) {
            if (!connectedAudioSources.has(key) || connectedAudioSources.get(key)?.stream !== rc.stream) {
              connectAudioSourceWithFx(key, rc.stream, isRcMaster, `Remoto (${rc.name || rcCamId})`);
            } else {
              const entry = connectedAudioSources.get(key);
              if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(1.0, audioContext.currentTime);
            }
          } else {
            const entry = connectedAudioSources.get(key);
            if (entry?.strip?.muteGain) entry.strip.muteGain.gain.setValueAtTime(0, audioContext.currentTime);
          }
        }
      });
    }
    return audioDestination.stream.getAudioTracks()[0];
  } catch (err) {
    console.warn('Audio mixing setup fallback:', err);
    return null;
  } finally {
    isMixing = false;
  }
}

export function connectBgmAudioElement(audioEl) {
  initMixerBuses();
  if (!audioEl || !audioContext || !bgmGainNode) return;
  if (connectedBgmElements.has(audioEl)) return;
  try {
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      audioEl.crossOrigin = 'anonymous';
    }
    const sourceNode = audioContext.createMediaElementSource(audioEl);
    sourceNode.connect(bgmGainNode);
    connectedBgmElements.add(audioEl);
    bgmMediaElement = audioEl;
    syncAllMixMinusBuses();
  } catch (err) {}
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

export function setHostPriorityDucking(isHostSpeaking, { duckGuests = true, duckLevel = 0.38, duckMusic = true } = {}) {
  initMixerBuses();
  if (!audioContext) return;
  const target = isHostSpeaking ? Math.max(0.1, Math.min(1.0, duckLevel)) : 1.0;
  const timeConst = isHostSpeaking ? 0.05 : 0.45;
  if (duckMusic && bgmDuckingGainNode) {
    const bgmTarget = isHostSpeaking ? Math.min(target, 0.2) : 1.0;
    bgmDuckingGainNode.gain.setTargetAtTime(bgmTarget, audioContext.currentTime, timeConst);
  }
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
    if (audioContext.state === 'suspended') await audioContext.resume();
    let buffer = sfxBufferCache.get(sfxUrl);
    if (!buffer) {
      try {
        const resp = await fetch(sfxUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        buffer = await audioContext.decodeAudioData(arrayBuf);
        sfxBufferCache.set(sfxUrl, buffer);
      } catch (fetchErr) {
        // Si fetch o decodeAudioData fallan (CORS o red), retornar null para que useSoundEffect
        // use el fallback HTMLAudioElement nativo sin mutear
        return null;
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
    return null;
  }
}

export function stopBroadcastSfx() {
  activeSfxSources.forEach(s => {
    try { s.stop(); s.disconnect(); } catch (e) {}
  });
  activeSfxSources.clear();
}

function getOrCreateMixMinusBus(targetChannelId) {
  initMixerBuses();
  if (mixMinusBuses.has(targetChannelId)) return mixMinusBuses.get(targetChannelId);
  const destination = audioContext.createMediaStreamDestination();
  const busGain = audioContext.createGain();
  busGain.gain.setValueAtTime(1.0, audioContext.currentTime);
  busGain.connect(destination);
  const bus = { targetChannelId, destination, busGain, connectedSources: new Set() };
  mixMinusBuses.set(targetChannelId, bus);
  syncMixMinusBus(bus);
  return bus;
}

function syncMixMinusBus(bus) {
  if (!audioContext || !bus) return;
  const targetId = bus.targetChannelId;
  for (const [id, strip] of channelStrips.entries()) {
    if (id !== targetId) {
      if (!bus.connectedSources.has(id)) {
        try { strip.analyser.connect(bus.busGain); bus.connectedSources.add(id); } catch (e) {}
      }
    }
  }
  if (bgmAnalyserNode && !bus.connectedSources.has('bgm')) {
    try { bgmAnalyserNode.connect(bus.busGain); bus.connectedSources.add('bgm'); } catch (e) {}
  }
  if (sfxAnalyserNode && !bus.connectedSources.has('sfx')) {
    try { sfxAnalyserNode.connect(bus.busGain); bus.connectedSources.add('sfx'); } catch (e) {}
  }
}

export function syncAllMixMinusBuses() {
  for (const bus of mixMinusBuses.values()) {
    syncMixMinusBus(bus);
  }
}

export function getMixMinusStream(targetChannelId) {
  const bus = getOrCreateMixMinusBus(targetChannelId);
  syncMixMinusBus(bus);
  return bus.destination.stream;
}

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
  return { totalBuses: mixMinusBuses.size, buses: list };
}

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
  return { rms: Math.round(rms * 100), peak: Math.round(peak * 100), db: Math.round(db * 10) / 10, pct, clip: peak >= 0.98 };
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
let pendingMediaChunkDelivery = Promise.resolve();

export function addChunkListener(listener) {
  if (typeof listener === 'function') {
    if (chunkListeners.has(listener)) return;
    chunkListeners.add(listener);
    // Solo enviar cabecera previa si el grabador YA estaba grabando activamente en segundo plano
    if (cachedInitHeader && isBroadcastEngineActive && mediaRecorder && mediaRecorder.state === 'recording') {
      try { listener(cachedInitHeader.slice(0)); } catch (e) {}
    }
  }
}

export function removeChunkListener(listener) {
  chunkListeners.delete(listener);
}

export function getInitHeader() {
  return cachedInitHeader ? cachedInitHeader.slice(0) : null;
}

// Cabecera SOLO si pertenece a la sesión de MediaRecorder que sigue activa.
// Una cabecera de una sesión anterior ya detenida no sirve: el EBML describe
// otra grabación y corrompería la nueva. Usar al empezar a grabar con el
// motor ya encendido (p. ej. después de transmitir).
export function getActiveInitHeader() {
  if (isBroadcastEngineActive && mediaRecorder && mediaRecorder.state === 'recording') {
    return cachedInitHeader ? cachedInitHeader.slice(0) : null;
  }
  return null;
}

export async function getOrWaitForInitHeader(timeoutMs = 1500) {
  if (cachedInitHeader) return cachedInitHeader.slice(0);
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try { mediaRecorder.requestData(); } catch (e) {}
  }
  const start = Date.now();
  while (!cachedInitHeader && (Date.now() - start < timeoutMs)) {
    await new Promise((r) => setTimeout(r, 25));
  }
  return cachedInitHeader ? cachedInitHeader.slice(0) : null;
}

export function startBroadcastEngine(initialState, onChunk) {
  currentState = { ...currentState, ...initialState };
  updateImages();
  ensureMasterCanvas();

  // Si ya está activo y grabando con chunks fluyendo, devolver el masterStream
  if (isBroadcastEngineActive && mediaRecorder && mediaRecorder.state === 'recording') {
    updateBroadcastState(initialState);
    if (onChunk) addChunkListener(onChunk);
    return masterStream;
  }

  // Si no estaba activo, reiniciar cabecera e inicializar listener limpio
  cachedInitHeader = null;
  if (onChunk) {
    chunkListeners.clear();
    chunkListeners.add(onChunk);
  }

  // Si el mediaRecorder previo existe pero no está grabando activamente, detenerlo
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (e) {}
  }

  if (audioContext && audioContext.state === 'suspended') {
    try { audioContext.resume(); } catch (e) {}
  }

  const canvasStream = canvas.captureStream(30);
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack && 'contentHint' in videoTrack) {
    videoTrack.contentHint = 'motion';
  }

  let audioTrack = setupAudioMixing(
    currentState.localStream,
    currentState.remoteCams,
    currentState.camStreamsMap,
    currentState.camMuted
  );
  if (!audioTrack) {
    initMixerBuses();
    audioTrack = audioDestination?.stream?.getAudioTracks?.()?.[0] || null;
    if (!audioTrack && audioContext && masterSumGain && audioDestination) {
      try {
        const osc = audioContext.createOscillator();
        const silentGain = audioContext.createGain();
        silentGain.gain.setValueAtTime(0.00001, audioContext.currentTime);
        osc.connect(silentGain);
        silentGain.connect(masterSumGain);
        osc.start();
        audioTrack = audioDestination.stream?.getAudioTracks?.()?.[0] || null;
      } catch (e) {}
    }
  }

  const tracks = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  masterStream = new MediaStream(tracks);

  const hasAudioTrack = masterStream.getAudioTracks().length > 0;
  const preferredMimes = hasAudioTrack
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4'
      ]
    : [
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4'
      ];

  let chosenMime = preferredMimes.find((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  }) || '';

  try {
    // El canvas Master es la única fuente de video y audio del archivo final.
    // 12 Mbps preserva detalle de una composición 1080p sin forzar a la cámara
    // USB a renegociar su propia resolución.
    const recOptions = { videoBitsPerSecond: 12000000, audioBitsPerSecond: 192000 };
    if (chosenMime) recOptions.mimeType = chosenMime;
    mediaRecorder = new MediaRecorder(masterStream, recOptions);
  } catch (instantiationErr) {
    console.warn('[MasterRecorder] Falló con mimeType preferido:', chosenMime, instantiationErr);
    try {
      mediaRecorder = new MediaRecorder(masterStream);
    } catch (fatalErr) {
      console.error('[MasterRecorder] Error irrecuperable al instanciar MediaRecorder:', fatalErr);
      mediaRecorder = null;
    }
  }

  if (mediaRecorder) {
    mediaRecorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      pendingMediaChunkDelivery = pendingMediaChunkDelivery.then(async () => {
        const buffer = await e.data.arrayBuffer();
        if (!cachedInitHeader) cachedInitHeader = buffer.slice(0);
        chunkListeners.forEach((listener) => { try { listener(buffer); } catch (err) {} });
      }).catch((err) => {
        console.warn('[MasterRecorder] Error procesando segmento:', err?.message || err);
      });
    };
    try {
      mediaRecorder.start(250);
      try { mediaRecorder.requestData(); } catch (e) {}
    } catch (startErr) {
      console.error('[MasterRecorder] Error al ejecutar mediaRecorder.start():', startErr);
    }
  }

  isBroadcastEngineActive = true;
  return masterStream;
}

// Composición por demanda: el canvas Master se redibujaba completo (1080p,
// filtros por cámara) 30 veces por segundo aunque ninguna cámara hubiera
// entregado un cuadro nuevo, y ese trabajo en el hilo principal es lo que
// congela clics y cambios de cámara. Ahora solo se compone cuando algo
// cambió de verdad. Mientras el MediaRecorder graba/transmite NO se salta
// ningún cuadro: la captura recibe su ritmo completo, sin riesgo.
let sceneDirty = true;
const lastPresentedFrames = new Map();

function sceneNeedsRedraw() {
  if (sceneDirty) { sceneDirty = false; return true; }
  if (mediaRecorder && mediaRecorder.state === 'recording') return true;
  if (currentState.transitionFromCam != null) return true;
  if (currentState.showAudioVisualizer) return true;
  const crops = currentState.cameraCrops || {};
  const slots = currentState.camSlots || [];
  for (const id of slots) { if (crops[id - 1]?.pushIn) return true; }
  let advanced = false;
  videoElements.forEach((el, id) => {
    try {
      const q = el.getVideoPlaybackQuality ? el.getVideoPlaybackQuality().totalVideoFrames : Math.round((el.currentTime || 0) * 30);
      if (lastPresentedFrames.get(id) !== q) { lastPresentedFrames.set(id, q); advanced = true; }
    } catch (e) {}
  });
  return advanced;
}

export function updateBroadcastState(updates) {
  sceneDirty = true;
  const voiceUpdated = (updates.voiceEffect !== undefined && updates.voiceEffect !== currentState.voiceEffect) ||
                       (updates.voiceTarget !== undefined && updates.voiceTarget !== currentState.voiceTarget);
  currentState = { ...currentState, ...updates };
  updateImages();
  ensureMasterCanvas();
  if (voiceUpdated) reapplyVoiceEffects();
  if (updates.voiceMonitor !== undefined) setVoiceMonitor(updates.voiceMonitor);
  if (updates.localStream || updates.remoteCams || updates.camStreamsMap || updates.camMuted || updates.camSlots || updates.getCamStream || updates.activeCam !== undefined) {
    syncVideoStreams();
    setupAudioMixing(
      currentState.localStream,
      currentState.remoteCams,
      currentState.camStreamsMap,
      currentState.camMuted
    );
  }
}

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

export function syncStudioAudio(localStream, remoteCams = [], camStreamsMap = {}, camMutedMap = {}) {
  initMixerBuses();
  if (localStream) currentState.localStream = localStream;
  if (remoteCams) currentState.remoteCams = remoteCams;
  if (camStreamsMap) currentState.camStreamsMap = camStreamsMap;
  if (camMutedMap) currentState.camMuted = camMutedMap;
  return setupAudioMixing(currentState.localStream, currentState.remoteCams, currentState.camStreamsMap, currentState.camMuted);
}

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

export async function stopBroadcastEngine() {
  isBroadcastEngineActive = false;

  const recorderToStop = mediaRecorder;
  if (recorderToStop && recorderToStop.state !== 'inactive') {
    await new Promise((resolve) => {
      let timeout = null;
      const finish = () => {
        if (timeout) clearTimeout(timeout);
        resolve();
      };
      timeout = setTimeout(finish, 5000);
      recorderToStop.addEventListener('stop', finish, { once: true });
      try { recorderToStop.stop(); } catch (e) { finish(); }
    });
  }
  await pendingMediaChunkDelivery;
  if (mediaRecorder === recorderToStop) mediaRecorder = null;

  if (masterStream) {
    masterStream.getVideoTracks().forEach((track) => track.stop());
    masterStream = null;
  }

  chunkListeners.clear();
  cachedInitHeader = null;
}

// Handler de visibilidad para pausar renderizado en background
let visibilityHandler = null;

function setupVisibilityHandler() {
  if (typeof document === 'undefined') return;
  if (visibilityHandler) return;
  visibilityHandler = () => {
    // Si la emisión o grabación está activa, NUNCA detener el renderizado en segundo plano
    if (document.hidden && !isBroadcastEngineActive && !mediaRecorder) {
      isCanvasRenderLoopActive = false;
      if (renderWorker) {
        try { renderWorker.postMessage('stop'); } catch (e) {}
      }
    } else {
      isCanvasRenderLoopActive = true;
      if (renderWorker) {
        try { renderWorker.postMessage('start'); } catch (e) {}
      } else if (!animFrameId) {
        startRenderLoop();
      }
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}

function cleanupVisibilityHandler() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

export function ensureMasterCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }
  setupVisibilityHandler();
  startRenderLoop();
  return canvas;
}

export function getMasterCanvas() {
  return ensureMasterCanvas();
}

export function setReplayOverlay(active, label = 'REPLAY', speed = 0.5, progress = 0) {
  currentState.replayOverlay = { active: !!active, label, speed, progress };
}
