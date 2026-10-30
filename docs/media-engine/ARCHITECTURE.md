# Arquitectura del Motor de Medios Nativo (v2)

## Objetivo
Eliminar la doble codificación de v1.3.1:
- v1.3.1: `canvas.captureStream(30)` → `MediaRecorder` (VP8/Opus WebM) → pipe → FFmpeg `libx264` → RTMP
- v2: frames raw (RGBA) + audio PCM → FFmpeg `rawvideo` → H.264 (una sola codificación) → RTMP

## Componentes
1. **Renderer (React/Electron)**: compone el canvas 1920×1080. En lugar de `captureStream`, extrae frames con `canvas.toBlob`/`getImageData` y los envía al main process.
2. **Main process (`electron/media-engine/index.js`)**: spawnea un proceso FFmpeg con entrada `rawvideo` (pix_fmt rgba, 1920×1080, 30fps) + audio PCM (s16le, 48kHz, stereo). Codifica una sola vez H.264 + AAC → RTMP/FLV. También graba MP4 simultáneo.
3. **Feature flag**: `USE_NATIVE_ENGINE` en `src/config/featureFlags.js`. Si false, usa v1.3.1 intacto.

## Bloqueo actual
No hay toolchain C++ (cl/g++/cmake) en esta máquina. Por eso el motor nativo se implementa como proceso FFmpeg dedicado con entrada raw (sin re-codificar WebM), que ya elimina la doble codificación. Un binario C++ con Media Foundation (HW encode) queda como mejora futura cuando haya toolchain.

## API del motor (IPC)
- `native-engine:start` → { success, error }
- `native-engine:write-frame` → ArrayBuffer (RGBA, 1920×1080×4 bytes)
- `native-engine:write-audio` → ArrayBuffer (PCM s16le)
- `native-engine:stop` → { success }

## Métricas esperadas vs baseline
Ver `docs/baseline-v1.3.1.md`.
