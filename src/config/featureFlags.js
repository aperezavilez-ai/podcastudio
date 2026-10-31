// Feature flags para PodcastStudio v2
// Controla activación del motor nativo sin tocar código de producción

export const FEATURE_FLAGS = {
  // Motor de medios nativo (FFmpeg rawvideo input, una sola codificación por Hardware)
  // false = v1.3.1 (canvas.captureStream + MediaRecorder + FFmpeg re-encode)
  // true  = v2 (frames raw -> FFmpeg rawvideo -> H.264 directo por hardware)
  USE_NATIVE_ENGINE: false,

  // Logging detallado del motor nativo
  NATIVE_ENGINE_DEBUG: false,

  // Fallback automático si el motor nativo falla al arrancar
  NATIVE_ENGINE_FALLBACK: true,

  // Resolución y FPS del motor nativo (debe coincidir con canvas)
  NATIVE_ENGINE_WIDTH: 1920,
  NATIVE_ENGINE_HEIGHT: 1080,
  NATIVE_ENGINE_FPS: 30,

  // Bitrate video (kbps)
  NATIVE_ENGINE_VIDEO_BITRATE: 4500,
  NATIVE_ENGINE_VIDEO_MAXRATE: 5000,
  NATIVE_ENGINE_VIDEO_BUFSIZE: 5000,

  // Audio
  NATIVE_ENGINE_AUDIO_BITRATE: 160,
  NATIVE_ENGINE_AUDIO_SAMPLE_RATE: 48000,
  NATIVE_ENGINE_AUDIO_CHANNELS: 2,
};

export function isNativeEngineEnabled() {
  return FEATURE_FLAGS.USE_NATIVE_ENGINE === true;
}

export function getNativeEngineConfig() {
  return {
    width: FEATURE_FLAGS.NATIVE_ENGINE_WIDTH,
    height: FEATURE_FLAGS.NATIVE_ENGINE_HEIGHT,
    fps: FEATURE_FLAGS.NATIVE_ENGINE_FPS,
    videoBitrate: FEATURE_FLAGS.NATIVE_ENGINE_VIDEO_BITRATE,
    videoMaxrate: FEATURE_FLAGS.NATIVE_ENGINE_VIDEO_MAXRATE,
    videoBufsize: FEATURE_FLAGS.NATIVE_ENGINE_VIDEO_BUFSIZE,
    audioBitrate: FEATURE_FLAGS.NATIVE_ENGINE_AUDIO_BITRATE,
    audioSampleRate: FEATURE_FLAGS.NATIVE_ENGINE_AUDIO_SAMPLE_RATE,
    audioChannels: FEATURE_FLAGS.NATIVE_ENGINE_AUDIO_CHANNELS,
    debug: FEATURE_FLAGS.NATIVE_ENGINE_DEBUG,
    fallback: FEATURE_FLAGS.NATIVE_ENGINE_FALLBACK,
  };
}