'use strict';
// Selección de codificador H.264 para streaming (v1.7.0, Raíz A).
// Extraído de electron/main.js como módulo puro testeable, con el mismo
// patrón CommonJS que electron/stream-error.js.
//
// DISCIPLINA v1.7.0 (invierte la de v1.5.0):
//   v1.5.0 arrancaba SIEMPRE con libx264 (software) y solo reintentaba con
//   h264_mf (hardware MediaFoundation) si el arranque moría por error de
//   encoder. En la máquina del usuario h264_mf está probado sano (93 fps en
//   la prueba de la Fase 0) y libx264 compite por la misma CPU que compone
//   el canvas: el orden viejo quemaba el primer arranque y dejaba el
//   codificador por software como ruta normal.
//   v1.7.0 SONDEA una vez por sesión: un encode real de 1 s a 320×180 con
//   h264_mf contra el sumidero null. Si el proceso sale con código 0, la
//   sesión usa h264_mf; si no, libx264. El resultado se CACHEA: ni cada
//   destino ni cada reconexión vuelve a sondear. La red de seguridad sigue
//   existiendo al revés: si un destino muere en el arranque con error de
//   encoder usando el codificador sondeado, main.js voltea al otro y llama
//   a noteEncoderFailure() para que la sesión entera aprenda el que sí
//   arrancó.

const STREAM_ENCODER_PROBE_ORDER = ['h264_mf', 'libx264'];

function otherStreamEncoder(encoder) {
  return encoder === 'h264_mf' ? 'libx264' : 'h264_mf';
}

// Argumentos de codificación por encoder, EXACTAMENTE los que usaba
// buildStreamWorkerArgs en main.js: h264_mf recibe el bitrate directo y
// libx264 la receta veryfast/zerolatency con el reparto de hilos.
function buildStreamEncoderArgs(encoder, threadsPerDestination) {
  if (encoder === 'h264_mf') {
    return ['-c:v', 'h264_mf', '-b:v', '4500k'];
  }
  return [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-threads', String(threadsPerDestination),
    '-profile:v', 'high',
    '-level', '4.1',
    '-b:v', '4500k',
  ];
}

// Argumentos de la sonda: 1 s de testsrc2 a 320×180 codificado con el
// encoder a probar hacia el sumidero null. Sin red, sin archivos.
function buildEncoderProbeArgs(encoder) {
  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=320x180:rate=30:duration=1',
    '-c:v', encoder,
    '-pix_fmt', 'yuv420p',
    '-f', 'null',
    '-',
  ];
}

// Ejecuta UNA sonda. Resuelve true si el encoder codificó el segundo de
// prueba (cierre con código 0) dentro del timeout; false en cualquier
// otro caso (error de spawn, código != 0, timeout). Nunca rechaza.
function probeEncoderOnce({ spawnImpl, ffmpegPath, encoder, timeoutMs = 10000 }) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawnImpl(ffmpegPath, buildEncoderProbeArgs(encoder), { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      resolve(false);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill('SIGKILL'); } catch (e) {}
      resolve(false);
    }, timeoutMs);
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    // Drenar stderr para que el pipe no se llene y bloquee al proceso.
    try { proc.stderr?.on('data', () => {}); } catch (e) {}
    proc.once('error', () => done(false));
    proc.once('close', (code) => done(code === 0));
  });
}

// Sesión de codificador: sonda perezosa UNA vez, cachea el resultado y
// aprende del volteo si el arranque real desmiente la sonda.
function createStreamEncoderSession({ spawnImpl, ffmpegPath, log, probeTimeoutMs } = {}) {
  let cachedEncoder = null;
  let probePromise = null;

  async function getEncoder() {
    if (cachedEncoder) return cachedEncoder;
    if (!probePromise) {
      probePromise = (async () => {
        for (const candidate of STREAM_ENCODER_PROBE_ORDER) {
          if (candidate === 'libx264') {
            // libx264 viene compilado en el FFmpeg empaquetado: es el
            // respaldo garantizado y no necesita sonda.
            cachedEncoder = 'libx264';
            if (log) log('Sonda de codificador: h264_mf no respondió; la sesión usa libx264.');
            return cachedEncoder;
          }
          const ok = await probeEncoderOnce({ spawnImpl, ffmpegPath, encoder: candidate, timeoutMs: probeTimeoutMs });
          if (ok) {
            cachedEncoder = candidate;
            if (log) log(`Sonda de codificador: ${candidate} OK; la sesión lo usa para todos los destinos.`);
            return cachedEncoder;
          }
          if (log) log(`Sonda de codificador: ${candidate} falló; probando el siguiente.`);
        }
        cachedEncoder = 'libx264';
        return cachedEncoder;
      })();
    }
    return probePromise;
  }

  // El arranque real con el encoder cacheado murió por error de encoder:
  // la sesión voltea al otro y lo cachea (no se vuelve a sondear).
  function noteEncoderFailure(failedEncoder) {
    if (cachedEncoder && cachedEncoder === failedEncoder) {
      cachedEncoder = otherStreamEncoder(failedEncoder);
      if (log) log(`Codificador ${failedEncoder} falló en el arranque real; la sesión voltea a ${cachedEncoder}.`);
    }
    return cachedEncoder;
  }

  return { getEncoder, noteEncoderFailure };
}

module.exports = {
  STREAM_ENCODER_PROBE_ORDER,
  otherStreamEncoder,
  buildStreamEncoderArgs,
  buildEncoderProbeArgs,
  probeEncoderOnce,
  createStreamEncoderSession,
};
