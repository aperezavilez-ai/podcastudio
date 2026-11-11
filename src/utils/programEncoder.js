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

let supportPromise = null;

// Sonda de capacidad: una sola vez por sesión de renderer, cacheada.
// Devuelve { supported, hardware } — hardware=true si la configuración
// con 'prefer-hardware' es soportada.
export function probeProgramEncoderSupport() {
  if (supportPromise) return supportPromise;
  supportPromise = (async () => {
    try {
      if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
        return { supported: false, hardware: false };
      }
      const base = {
        codec: 'avc1.640028', // H.264 High @ 4.0
        width: 1920,
        height: 1080,
        bitrate: 4_500_000,
        framerate: 30,
        latencyMode: 'realtime',
        avc: { format: 'annexb' },
      };
      const hw = await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: 'prefer-hardware' });
      if (hw && hw.supported) return { supported: true, hardware: true };
      const sw = await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: 'prefer-software' });
      if (sw && sw.supported) return { supported: true, hardware: false };
      return { supported: false, hardware: false };
    } catch (e) {
      return { supported: false, hardware: false };
    }
  })();
  return supportPromise;
}

export function createProgramEncoderPump({ onChunk, onError, width = 1920, height = 1080, fps = 30, bitrate = 4_500_000 } = {}) {
  let encoder = null;
  let running = false;
  let startTs = 0;
  let lastCaptureMs = 0;
  let frameIndex = 0;
  const frameIntervalMs = 1000 / fps;
  const gopFrames = fps * 2; // GOP de 2 s, como la ruta histórica (g=60)

  async function start() {
    const support = await probeProgramEncoderSupport();
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
        codec: 'avc1.640028',
        width,
        height,
        bitrate,
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
