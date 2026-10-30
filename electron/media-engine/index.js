// electron/media-engine/index.js
// Punto de entrada del motor nativo de medios (v2).
// STUB: la implementación real se hará en C++/Media Foundation.
// Por ahora expone la interfaz que la UI espera, delegando al motor actual (v1.3.1).

const USE_NATIVE_ENGINE = process.env.USE_NATIVE_ENGINE === '1'

let nativeEngine = null

function isNativeEngineEnabled() {
  return USE_NATIVE_ENGINE
}

async function initNativeEngine(config = {}) {
  if (!USE_NATIVE_ENGINE) {
    console.log('[media-engine] Modo nativo desactivado. Usando motor v1.3.1 (canvas.captureStream + MediaRecorder).')
    return { mode: 'legacy', ok: true }
  }
  console.warn('[media-engine] Motor nativo aún no implementado. Fallback a v1.3.1.')
  return { mode: 'legacy', ok: true }
}

function sendFrame(rgbaBuffer, width, height) {
  if (!nativeEngine) return false
  return false
}

function sendAudio(pcmBuffer, sampleRate, channels) {
  if (!nativeEngine) return false
  return false
}

function startOutput({ rtmpUrl, recordPath }) {
  if (!nativeEngine) return { ok: false, reason: 'native-engine-not-available' }
  return { ok: false, reason: 'not-implemented' }
}

function stopOutput() {
  if (!nativeEngine) return { ok: false, reason: 'native-engine-not-available' }
  return { ok: false, reason: 'not-implemented' }
}

function shutdown() {
  if (nativeEngine) {
    nativeEngine = null
  }
}

module.exports = {
  isNativeEngineEnabled,
  initNativeEngine,
  sendFrame,
  sendAudio,
  startOutput,
  stopOutput,
  shutdown,
}
