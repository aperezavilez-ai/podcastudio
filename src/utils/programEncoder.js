// ============================================================================
// Codificador de programa WebCodecs (núcleo en vivo v2.0.0, Raíz A).
//
// Es la ÚNICA codificación con pérdida del programa en la ruta primaria:
// el canvas compuesto se codifica UNA vez en H.264 (Annex B) con
// aceleración por hardware cuando la plataforma la ofrece, y el flujo
// resultante se reparte en el proceso principal con copia (grabación +
// destinos RTMPS). Sustituye la cadena MediaRecorder VP8 → transcodes
// libx264 por destino/grabación.
//
// La bomba NO tiene bucle propio: el motor la alimenta con
// captureFrame(canvas) desde su tick de composición (setProgramFrameTap),
// así hereda el ritmo del Worker a 30 fps y no depende de que la ventana
// se esté presentando. Si la cola del codificador crece (máquina
// saturada), se DESCARTAN fotogramas en la bomba — nunca se bloquea la
// composición esperando al codificador.
// ============================================================================

import { getProgramProfile, DEFAULT_PROGRAM_PROFILE_ID } from './programProfiles.mjs';

const supportPromises = new Map();

// Sonda de capacidad: cacheada POR PERFIL (v3.0.0). Devuelve
// { supported, hardware } — hardware=true si la configuración con
// 'prefer-hardware' es soportada. Usa codec/dimensiones/bitrate del
// perfil pedido (default: 1080p con los valores históricos).
export function probeProgramEncoderSupport(profileId = DEFAULT_PROGRAM_PROFILE_ID) {
  const profile = getProgramProfile(profileId);
  const key = profile.id;
  if (supportPromises.has(key)) return supportPromises.get(key);
  const promise = (async () => {
    try {
      if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
        return { supported: false, hardware: false };
      }
      const base = {
        codec: profile.avcCodec,
        width: profile.width,
        height: profile.height,
        bitrate: profile.masterBitrateBps,
        framerate: profile.fps || 30,
        latencyMode: 'realtime',
        avc: { format: 'annexb' },
      };
      const hw = await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: 'prefer-hardware' });
      if (hw && hw.supported) return { supported: true, hardware: true, bitrate: base.bitrate };
      const sw = await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: 'prefer-software' });
      if (sw && sw.supported) return { supported: true, hardware: false, bitrate: base.bitrate };
      // v3.0.1: peldaño de bitrate. Si el códec se rechaza al bitrate
      // del perfil (10 Mbps en 1080p), reintentar a 6 Mbps antes de
      // declarar WebCodecs imposible y caer al WebM por software: hay
      // controladores que aceptan el códec pero no el bitrate alto.
      // Se devuelve el bitrate GANADOR y la bomba configura con él.
      if (base.bitrate > 6_000_000) {
        const lower = { ...base, bitrate: 6_000_000 };
        const hw2 = await VideoEncoder.isConfigSupported({ ...lower, hardwareAcceleration: 'prefer-hardware' });
        if (hw2 && hw2.supported) return { supported: true, hardware: true, bitrate: 6_000_000 };
        const sw2 = await VideoEncoder.isConfigSupported({ ...lower, hardwareAcceleration: 'prefer-software' });
        if (sw2 && sw2.supported) return { supported: true, hardware: false, bitrate: 6_000_000 };
      }
      return { supported: false, hardware: false };
    } catch (e) {
      return { supported: false, hardware: false };
    }
  })();
  supportPromises.set(key, promise);
  return promise;
}

export function createProgramEncoderPump({ onChunk, onError, profile = null, width, height, fps, bitrate } = {}) {
  // v3.0.0: con perfil, codec/dimensiones/bitrate salen de él; sin
  // perfil se conservan los valores históricos (1920×1080, 4_500_000).
  const resolvedProfile = profile ? getProgramProfile(profile.id || profile) : null;
  const encWidth = width ?? resolvedProfile?.width ?? 1920;
  const encHeight = height ?? resolvedProfile?.height ?? 1080;
  const encFps = fps ?? resolvedProfile?.fps ?? 30;
  const encBitrate = bitrate ?? (resolvedProfile ? resolvedProfile.masterBitrateBps : 4_500_000);
  const encCodec = resolvedProfile?.avcCodec || 'avc1.640028';
  const profileId = resolvedProfile?.id || DEFAULT_PROGRAM_PROFILE_ID;
  width = encWidth; height = encHeight; fps = encFps; bitrate = encBitrate;
  let encoder = null;
  let running = false;
  let startTs = 0;
  let lastCaptureMs = 0;
  let frameIndex = 0;
  const frameIntervalMs = 1000 / fps;
  const gopFrames = fps * 2; // GOP de 2 s, como la ruta histórica (g=60)

  async function start() {
    const support = await probeProgramEncoderSupport(profileId);
    if (!support.supported) return false;
    try {
      encoder = new VideoEncoder({
        output: (chunk) => {
          try {
            const buf = new ArrayBuffer(chunk.byteLength);
            chunk.copyTo(buf);
            if (onChunk) onChunk(buf);
          } catch (e) {}
        },
        error: (e) => {
          if (onError) onError(e);
        },
      });
      encoder.configure({
        codec: encCodec,
        width,
        height,
        bitrate: support.bitrate || bitrate,
        framerate: fps,
        latencyMode: 'realtime',
        hardwareAcceleration: support.hardware ? 'prefer-hardware' : 'prefer-software',
        avc: { format: 'annexb' },
      });
      running = true;
      startTs = performance.now();
      lastCaptureMs = 0;
      frameIndex = 0;
      return true;
    } catch (e) {
      encoder = null;
      running = false;
      if (onError) onError(e);
      return false;
    }
  }

  // Alimentada por el tick de composición del motor. Descarta sin
  // bloquear: fuera de ritmo, codificador no listo, o cola llena.
  function captureFrame(canvas) {
    if (!running || !encoder || encoder.state !== 'configured') return;
    const now = performance.now();
    if (now - lastCaptureMs < frameIntervalMs - 2) return;
    if (encoder.encodeQueueSize > 3) return;
    lastCaptureMs = now;
    let frame = null;
    try {
      frame = new VideoFrame(canvas, {
        timestamp: Math.max(0, Math.round((now - startTs) * 1000)),
        duration: Math.round(1_000_000 / fps),
      });
      const keyFrame = frameIndex % gopFrames === 0;
      frameIndex += 1;
      encoder.encode(frame, { keyFrame });
    } catch (e) {
      // Un fotograma que no se pudo construir no detiene la bomba.
    } finally {
      try { frame?.close(); } catch (e) {}
    }
  }

  function stop() {
    running = false;
    if (encoder) {
      try { encoder.close(); } catch (e) {}
      encoder = null;
    }
  }

  return {
    start,
    captureFrame,
    stop,
    isRunning: () => running,
  };
}
