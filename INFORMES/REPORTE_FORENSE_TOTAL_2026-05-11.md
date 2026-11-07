# REPORTE FORENSE TOTAL — PODCASTUDIO VIRTUAL PRODUCTION STUDIO

**Fecha del análisis:** 11 de Mayo de 2026  
**Ruta analizada:** `D:\PROGRAMAS IA\PODCASTUDIO`  
**Versión del proyecto:** v1.3.8 (package.json)  
**Stack:** React 18.2 + Vite 5.1 + Electron 29.1 + Node/Express + WebRTC/WS + FFmpeg  
**Alcance:** Análisis código por código de todos los módulos funcionales: cámaras, audio, grabación, música, efectos, teleprompter, transmisión en vivo a redes sociales y formatos de grabación.

## 1. ARQUITECTURA GENERAL

- **Frontend (SPA React)**: `src/App.jsx` (~6.589 líneas) es un monolito central que orquesta todo el estado global, cámaras, audio, grabación, streaming, cintillos, teleprompter, etc.
- **Motor broadcast**: `src/utils/masterBroadcastEngine.js` (~2.007 líneas) compositor Canvas 2D (1920×1080 @30fps), mezclador Web Audio (48kHz estéreo), MediaRecorder y puente nativo FFmpeg/RTMP.
- **Host nativo**: `electron/main.js` (~2.929 líneas) levanta Express HTTPS (3000) + HTTP (3001) + WebSocket + FFmpeg para RTMP y grabación a disco.
- **Transporte remoto**: `src/utils/streamTransport.js` (P2P WebRTC vía Supabase Broadcast + SFU mock).
- **Exportación post**: `src/utils/exportVideo.js`, `multiFormatExporter.js`, `fixWebmDuration.js`.

## 2. ÁREA: CÁMARAS (Locales, USB, Wi-Fi/IP, Remotas)

### Archivos clave
- `src/config/cameraSlots.js` — MAX_CAMERA_SLOTS=20, DEFAULT=4, layouts hasta 10 cámaras.
- `src/utils/videoStream.js` — keep-alive y requestVideoFrameCallback.
- `src/utils/rtcConfig.js` — STUN (Google/Cloudflare), TURN vía `/api/turn-credentials`.
- `src/utils/remoteCameraSlots.mjs` — hasta 12 slots remotos, reutilización de reservas.
- `src/utils/streamTransport.js` — P2P WebRTC + SFU mock.
- Componentes: `CameraConnectModal.jsx`, `CameraCalibratorModal.jsx`, `ConnectedCamerasModal.jsx`, `CameraNameBadgeModal.jsx`.

### Hallazgos
- **FORTALEZA**: Arquitectura elástica de slots (0..19), layouts dinámicos (gallery, speaker, two-shot), soporte WebRTC remoto con Supabase Broadcast, calibrador por cámara (zoom, pan, color/LUT), name badges.
- **FORTALEZA**: `bindVideoKeepAlive` reanuda video sin cerrar el track físico (evita renegociación USB).
- **HALLAZGO (P0)**: `rtcConfig.js` en Electron (file://) cae a STUN-only (sin TURN). Conexiones remotas detrás de NAT simétrico fallarán.
- **HALLAZGO**: `SFUStreamTransport` es un mock (no implementa LiveKit/Mediasoup). Sólo P2P real.
- **HALLAZGO**: `CameraCalibratorModal` (~1.313 líneas) duplica lógica de preview; riesgo de desincronización con master engine.
- **HALLAZGO**: No hay manejo explícito de desconexión de cámara física (UVC unplug) ni re-enumeración automática.
- **HALLAZGO**: `remoteCameraSlots.mjs` permite 12 slots pero `MAX_CAMERA_SLOTS=20`; inconsistencia.
- **RECOMENDACIÓN**: Implementar TURN real para Electron/WAN; añadir `navigator.mediaDevices.ondevicechange`; unificar límites de slots.

## 3. ÁREA: AUDIO (Captura, Mezcla, VU, Mix-Minus)

### Archivos clave
- `src/utils/masterBroadcastEngine.js` — AudioContext 48kHz, masterSumGain, masterLimiter (-1.5 dBFS), monitorSumGain, channelStrips, mixMinusBuses, bgmGain, sfxGain.
- `src/hooks/useCameraAudioLevels.js` — VU por cámara (128 FFT, muestreo 200ms).
- `src/components/AudioMixerDesk.jsx` — consola con faders, mute, solo, VU estéreo.

### Hallazgos
- **FORTALEZA**: Mezclador broadcast profesional con limiter brickwall (-1.5 dBFS true peak), buses de monitor y mix-minus, ganancia por canal, solo/mute.
- **FORTALEZA**: VU muestreado a 5 Hz (evita re-render 60fps) con detección de cambio.
- **HALLAZGO (P0)**: `useCameraAudioLevels` crea `MediaStreamSource` por cámara pero NO los conecta al bus master del engine; el audio de cámaras USB/remotas puede NO llegar a grabación/stream salvo que `syncStudioAudio` los conecte. Verificar en `App.jsx`.
- **HALLAZGO**: `masterBroadcastEngine` usa `createScriptProcessor` (deprecated); considerar `AudioWorklet`.
- **HALLAZGO**: No hay EQ paramétrico por canal ni noise gate.
- **HALLAZGO**: Mix-minus no se valida contra feedback acústico en tiempo real.
- **RECOMENDACIÓN**: Verificar conexión de fuentes de audio al master; migrar a AudioWorklet; añadir EQ/notch por canal.

## 4. ÁREA: GRABACIÓN (Local, Pipeline, Formatos)

### Archivos clave
- `src/utils/masterBroadcastEngine.js` — MediaRecorder sobre masterStream (VP8/Opus WebM ~8Mbps), chunks.
- `electron/main.js` — FFmpeg libx264 ultrafast WebM→FLV/MP4, grabación a disco en `grabaciones/`.
- `src/utils/fixWebmDuration.js` — inyector EBML de duración.
- `src/utils/exportVideo.js` — transcodificación WASM/nativa, multi-formato.
- `src/utils/multiFormatExporter.js` — 9:16, 1:1, 16:9 con smart-crop/blur-fill/split-stack.
- `scripts/recording-pipeline.integration.test.mjs`.

### Hallazgos
- **FORTALEZA**: Doble vía de grabación: MediaRecorder WebM + FFmpeg nativo; fix de duración EBML; exportación multi-formato social.
- **HALLAZGO (P0 CRÍTICO)**: Doble codificación (WebM VP8 → H.264) + re-empaquetado genera alto CPU y latencia (documentado en `docs/baseline-v1.3.1.md`). No se ha migrado a captura directa H.264.
- **HALLAZGO**: `fixWebmDuration` sólo corrige cabecera EBML; no repara clusters corruptos ni timestamps negativos.
- **HALLAZGO**: `exportVideo.js` depende de CDN externo (@ffmpeg/ffmpeg) para WASM; sin internet no funciona en web. En Electron usa nativo.
- **HALLAZGO**: No hay manejo de espacio en disco ni rotación de archivos; grabaciones acumulan en `grabaciones/`.
- **HALLAZGO**: `multiFormatExporter` crea `<video>` DOM oculto y usa MediaRecorder; puede fallar en Electron con CORS.
- **RECOMENDACIÓN**: Migrar a captura H.264 directa (NVENC/QSV); añadir gestión de espacio; validación de integridad post-grabación (ffprobe).

## 5. ÁREA: MÚSICA (BGM, Ducking, Biblioteca)

### Archivos clave
- `src/config/musicTracks.js` — pistas y SFX (Mixkit URLs).
- `src/hooks/useBackgroundMusic.js` — auto-ducking reactivo a micLevel.
- `src/components/MusicBank.jsx` — UI biblioteca.
- `masterBroadcastEngine.js` — bgmGainNode, bgmDuckingGainNode, bgmAnalyserNode, connectBgmAudioElement.

### Hallazgos
- **FORTALEZA**: Auto-ducking por nivel de micrófono (umbral 14, atenuación a 25%, release 900ms); integración al bus BGM; persistencia en localStorage.
- **FORTALEZA**: Soporte de pistas custom vía ObjectURL y fallback URL.
- **HALLAZGO**: URLs de música apuntan a Mixkit (CDN externo) → sin internet no hay música. No hay caché offline.
- **HALLAZGO**: `connectBgmAudioElement` conecta el `<audio>` al graph; si el elemento se recrea, se pierde la conexión.
- **HALLAZGO**: No hay crossfade entre pistas; corte abrupto al cambiar.
- **HALLAZGO**: `bgmDuckingGainNode` se manipula desde hook + engine → posible doble atenuación.
- **RECOMENDACIÓN**: Cachear pistas en IndexedDB/FS; añadir crossfade; centralizar ducking en el engine.

## 6. ÁREA: EFECTOS (SFX, Voice FX, LUTs, Visual)

### Archivos clave
- `src/utils/voiceEffectsProcessor.js` — 8 efectos DSP (radio, stadium, echo, martian, telephone, monster, chipmunk).
- `src/hooks/useSoundEffect.js`, `useNumpadSfx.js` — disparo SFX.
- `src/utils/videoLook.js` — LUTs y filtros Canvas.
- `src/components/SoundboardQuickPad.jsx`.

### Hallazgos
- **FORTALEZA**: Efectos vocales DSP completos con nodos Web Audio encadenados; fallback a conexión directa si falla.
- **FORTALEZA**: LUTs cinematográficos (Kodak, teal-orange, S-Cinetone, etc.) aplicados en Canvas.
- **HALLAZGO**: Efecto `chipmunk` crea un `Oscillator` que nunca se detiene → fuga de recursos si se cambia de efecto repetidamente.
- **HALLAZGO**: `applyVoiceEffectChain` retorna nodos activos pero el caller debe desconectarlos; riesgo de nodos huérfanos.
- **HALLAZGO**: SFX vía `playBroadcastSfx` (engine) con fallback HTMLAudio; el fallback NO llega a la grabación/stream (sólo monitor local).
- **HALLAZGO**: `SoundboardQuickPad` usa IDs de SFX que NO coinciden con `MUSIC_SFX` (usa 'applause','horn', etc. vs 'sfx-appl-01'). Posible desajuste de reproducción.
- **RECOMENDACIÓN**: Detener osciladores al cambiar efecto; unificar IDs de SFX; asegurar que fallback SFX se inyecte al bus master.

## 7. ÁREA: TELEPROMPTER

### Archivos clave
- `src/components/BroadcastTeleprompter.jsx` — scroll 60fps, mammoth .docx, mirror H/V, eyeline marker, LAN sync vía localStorage.
- `masterBroadcastEngine.js` — renderizado del teleprompter en canvas master.

### Hallazgos
- **FORTALEZA**: Soporte de archivos .docx (mammoth), scroll suave calibrado, espejo horizontal/vertical, marcador de mirada a lente.
- **HALLAZGO**: Sincronización LAN se basa en `localStorage` compartido en el mismo navegador → NO funciona entre dispositivos distintos (iPad). Requiere WebSocket/broadcast.
- **HALLAZGO**: Dos fuentes de verdad: `BroadcastTeleprompter` (estado local) y `teleprompterText` del engine.
- **HALLAZGO**: No hay control remoto de play/pause desde iPad; sólo lectura de texto.
- **RECOMENDACIÓN**: Unificar fuente de texto; implementar canal WS para control remoto de play/pause/velocidad.

## 8. ÁREA: TRANSMISIÓN EN VIVO A REDES SOCIALES

### Archivos clave
- `electron/main.js` — FFmpeg RTMP multi-destino (FB, YT, TikTok, custom), telemetría.
- `src/utils/streamDestinations.mjs` — normalización de URLs/keys.
- `src/components/StreamDestinationEditor.jsx`, `StreamingTelemetryPill.jsx`.
- `src/utils/streamTransport.js` — P2P para cámaras remotas (no para salida RTMP).

### Hallazgos
- **FORTALEZA**: Soporte multi-destino simultáneo (FB/IG, YT, TikTok, RTMP custom); telemetría de drops/bitrate/fps; validación de URL RTMP.
- **HALLAZGO (P0)**: Cada destino lanza un proceso FFmpeg separado → N×CPU. No hay muxing a múltiples salidas desde un solo encoder.
- **HALLAZGO**: No hay reconexión automática si cae un destino.
- **HALLAZGO**: `StreamingTelemetryPill` sólo muestra datos si `window.api.onStreamTelemetry` existe; en web no hay telemetría.
- **HALLAZGO**: No hay autenticación/validación de stream key antes de iniciar.
- **RECOMENDACIÓN**: Implementar tee/mux multi-output en FFmpeg; añadir reconexión automática con backoff; validar keys contra endpoints.

## 9. ÁREA: FORMATOS DE GRABACIÓN Y EXPORTACIÓN

### Hallazgos
- **Formatos de salida**: WebM (MediaRecorder VP8/Opus), MP4 (FFmpeg H.264/AAC 48kHz), FLV (RTMP).
- **Exportación social**: 9:16 (TikTok/Reels), 1:1 (IG Feed), 16:9 (FB/YT) con smart-crop/blur-fill/split-stack.
- **HALLAZGO**: WebM generado por Chromium carece de duración → `fixWebmDuration` la inyecta. OK.
- **HALLAZGO**: No hay soporte de ProRes/DNxHD ni audio-only (podcast RSS).
- **RECOMENDACIÓN**: Añadir exportación audio-only (MP3/AAC) para podcast; añadir perfiles de calidad (bajo/medio/alto).

## 10. HALLAZGOS TRANSVERSALES (Código, Seguridad, Rendimiento)

1. **Monolito App.jsx (~6.589 líneas)**: alto acoplamiento; difícil de testear.
2. **Uso de `createScriptProcessor` (deprecated)** en engine.
3. **Sin tests unitarios** para componentes UI; sólo 3 scripts de integración (remote-cameras, recording, stream-config).
4. **Dependencias de CDN** (Mixkit música, @ffmpeg/core WASM) → sin internet degradan funcionalidad.
5. **Versionado inconsistente**: package.json v1.3.8 vs docs v1.1.1 vs P0 doc v1.1.1.
6. **Electron `use-fake-ui-for-media-stream`** auto-acepta permisos de cámara/mic → riesgo de seguridad en producción.
7. **Supabase usado sólo para Broadcast Channels** (no DB) → sin persistencia de proyectos/usuarios.
8. **No hay manejo de errores global** más allá de ErrorBoundary; fallos de stream no se reportan al usuario.
9. **Memory leaks potenciales**: Oscillator en chipmunk no detenido; SFX sources sin cleanup en algunos paths.
10. **Performance**: Canvas 2D @30fps con getImageData para native engine cada frame → alto CPU.

## 11. RESUMEN DE PRIORIDADES

### P0 (Crítico — bloquea producción)
- Doble codificación CPU/latencia en pipeline RTMP.
- Audio de cámaras puede no llegar al master (verificar syncStudioAudio).
- TURN ausente en Electron (conexiones remotas fallan en WAN).
- IDs de SFX desalineados (SoundboardQuickPad vs MUSIC_SFX).

### P1 (Importante)
- Monolito App.jsx → refactor en módulos.
- Teleprompter sync cross-device vía WS.
- Reconexión automática de streams.
- Caché offline de música/SFX.

### P2 (Mejora)
- Crossfade de música, EQ por canal, AudioWorklet.
- Exportación audio-only y perfiles de calidad.
- Gestión de espacio en disco.
- Implementación real de SFU (LiveKit).

## 12. CONCLUSIÓN

PodcastStudio es un sistema broadcast funcional y ambicioso con motor de composición real, mezclador profesional, soporte multicámara (local+remoto), streaming multi-destino y exportación social. Los hallazgos principales se concentran en: (a) rendimiento del pipeline de codificación (doble encode), (b) conectividad remota (TURN), (c) arquitectura monolítica, y (d) consistencia de datos (SFX IDs, versionado). No se detectaron bloqueos de seguridad críticos, pero se recomienda revisar permisos automáticos de cámara/mic en Electron y la dependencia de CDNs externos.

**Estado general:** Apto para uso en LAN y producción controlada; requiere hardening para WAN/producción masiva.