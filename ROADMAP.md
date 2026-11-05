# PODCASTUDIO — ROADMAP

Fuente de verdad del proceso del proyecto para el agente. LEER ESTO ANTES de cualquier tool.
PROHIBIDO reexplorar el repo entero si este documento cubre la tarea. Solo read_file de lo que vas a editar.
EditCore actualiza este archivo tras cambios. No pedirlo al usuario. No pegar codigo largo.

## Proceso
- Fase: release
- Estado: Hotfix v1.3.7 de estabilidad USB y retorno de ventana en preparación (2026-11-05)
- Actualizado: 2026-11-04 08:15
- Stack: React + Vite + Electron + Supabase
- Entry: index.html
- Entry: src/main.jsx
- Entry: src/App.jsx
- Scripts: dev, build, build:exe, build:electron, test:remote-cameras, test:recording, test:stream-config
- Preview: desconocido — usa el preview del IDE, no inventes puertos

## Mapa
- electron/media-engine/bridge.js
- electron/media-engine/index.js
- src/config/featureFlags.js
- docs/media-engine/ARCHITECTURE.md
- docs/baseline-v1.3.1.md
- package.json — podcaststudio · scripts: dev, build, build:exe, build:electron, test:remote-cameras, test:recording, test:stream-config
- stack: React + Vite + Electron + Supabase
- entry: index.html
- entry: src/main.jsx
- entry: src/App.jsx
- .env.example
- .env.local
- .gitignore
- api/
- dist_electron/
- docs/
- docs/AUDIT-PODCASTUDIO.md
- docs/P0-FORENSIC-VALIDATION.md
- docs/releases/
- electron/
- grabaciones/
- icon.ico
- icon.png
- index.html
- launcher.cs
- lib/
- lib/ai/
- lib/email/
- lib/integrations/
- lib/livepeer/
- lib/mercadopago/
- lib/mux/
- lib/restream/
- lib/supabase/
- lib/youtube/
- package-lock.json
- PodcastStudio.exe
- proyectos/
- public/
- public/favicon.svg
- public/icon.ico
- public/icon.png
- public/music/
- public/registerSW.js
- public/sw.js
- RELEASE_v1.2.9.md
- RELEASE_v1.3.0.md
- RELEASE_v1.3.1.md
- RELEASE_v1.3.2.md
- RELEASE_v1.3.3.md
- RELEASE_v1.3.4.md
- RELEASE_v1.3.5.md
- RELEASE_v1.3.6.md
- RELEASE_v1.3.7.md

## Archivos clave (no reexplorar)
- electron/media-engine/bridge.js
- electron/media-engine/index.js
- src/config/featureFlags.js
- docs/media-engine/ARCHITECTURE.md
- docs/baseline-v1.3.1.md
- lib/livepeer/client.js
- lib/mercadopago/client.js
- lib/mux/client.js
- api/mercadopago/webhook.js
- src/utils/exportVideo.js
- package.json
- src/utils/masterBroadcastEngine.js
- lib/supabase/serverLogin.js
- electron/main.js
- index.html
- src/main.jsx

## Tarea activa
- Corrección completa de cámaras remotas iOS/Android, grabación con timer inmediato, audio master con todas las fuentes, streaming multi-cámara y buscador WiFi robusto. COMPLETADA.

## Bloqueos / bugs conocidos
- Ninguno registrado

## Decisiones
- Se mantiene el motor en base Chromium/Electron: Tauri usa WebView2 (mismo motor Chromium) pero carece de Node.js nativo, lo que obligaría a reescribir todo el backend FFmpeg/WebRTC en Rust sin aportar ventajas de renderizado.
- Corrección de `jitterBufferTarget` (50ms en milisegundos) y `playoutDelayHint` (0.05s) en WebRTC: restaura decodificación de cuadros en cámaras remotas evitando pantalla negra.
- Limpieza de procesos en `electron/main.js`: `mainWindow.on('closed')` y `app.on('window-all-closed')` garantizan que no queden procesos zombie en segundo plano bloqueando arranques posteriores.
- ErrorBoundary global + Logger unificado para captura de errores en producción.
- iceRestart automático en WebRTC para recuperación de conexiones móviles tras fallo de red.

## Cambios recientes
- src/main.jsx — eliminada carga lazy() + Suspense, importaciones estáticas directas, ErrorBoundary wrapper, signalReady con requestAnimationFrame (2026-11-03 11:00)
- src/components/ErrorBoundary.jsx — nuevo componente captura errores globales con UI de recuperación (2026-11-03 11:00)
- src/utils/logger.js — nuevo sistema logging unificado dev/prod-aware reemplaza 34 console.* (2026-11-03 11:00)
- src/App.jsx — signalReady duplicado eliminado, timer grabación inmediato, estructura if/else reparada, manejo error FFmpeg (2026-11-03 11:00)
- src/utils/masterBroadcastEngine.js — syncVideoStreams incluye camStreamsMap + remoteCams; setupAudioMixing re-ejecutable (2026-11-03 11:05)
- src/utils/streamTransport.js — iceRestart() automático en ICE failed + reconexión automática (2026-11-03 11:10)
- src/utils/rtcConfig.js — AbortSignal.timeout(5000) en fetch TURN + cache mejorado (2026-11-03 11:10)
- vite.config.mjs — code-splitting manualChunks (react, lucide, supabase, ffmpeg) (2026-11-03 11:15)
- src/pages/RemoteCam.jsx — degradationPreference 'maintain-framerate' para fluidez móvil (2026-11-03 11:20)
- launcher.cs / PodcastStudio.exe — binario recompilado versión 1.3.3.0 (2026-11-03 11:25)
- src/main.jsx — sistema robusto signalReady (sendSignalReady + ensureSignalReady + retry interval + error handlers) garantiza app-ui-ready (2026-11-03 11:55)
- electron/main.js — failsafe 8s, logging app-ui-ready, detectores render-process-gone/unresponsive/responsive (2026-11-03 11:50)
- launcher.cs / PodcastStudio.exe — recompilado v1.3.3.0 con fixes arranque (2026-11-03 11:57)
- electron/main.js — eliminado retardo artificial de 8s en ready-to-show, apertura instantánea en ready-to-show y app-ui-ready, did-finish-load fallback 300ms (2026-11-03 12:33)
- src/App.jsx — footer sincronizado a PODCASTUDIO v1.3.4 (2026-11-03 12:33)
- package.json — versión 1.3.4 (2026-11-03 12:33)
- launcher.cs / PodcastStudio.exe — recompilado v1.3.4.0 con ciclo de vida instantáneo y cierre inmediato de splash (2026-11-03 12:35)
- CameraConnectModal.jsx — corrección de targetSlot locking en CAM 1 y selector inteligente de ranuras libres (2026-11-04 07:30)
- streamTransport.js / App.jsx — reconexión asíncrona segura de WebRTC y bind inmediato de stream en slot 0 (2026-11-04 07:45)
- useCintilloRotation.js / App.jsx — rotación continua uno por uno sin congelamiento y selector de modo Secuencial / Aleatorio (2026-11-04 08:00)
- App.jsx — corrección del bloque try/catch de grabación: eliminación de cancelación accidental inmediata que congelaba la app (2026-11-04 08:10)
- electron/main.js / launcher.cs — apertura instantánea en did-finish-load con fallback a 2.5s y timeout de splash optimizado a 5s (2026-11-04 08:12)
- streamTransport.js / RemoteCam.jsx — buffer elástico 150ms + perfiles fluidos 720p 2.4 Mbps balanced eliminan pausas y tirones en móvil (2026-11-04 08:50)
- electron/main.js / App.jsx — toSafeBuffer robusto para cabecera e IPC chunks de grabación; audioContext resume garantizado (2026-11-04 08:52)
- PodcastStudio.exe — recompilado v1.3.4.0 (2026-11-04 08:53)
- src/pages/RemoteCam.jsx — cambio fluido frontal/trasera sin freeze (fallback elástico de resolución y sender.replaceTrack antes de detener pista previa) (2026-11-04 11:30)
- src/utils/masterBroadcastEngine.js — corrección de pantalla negra en cámaras: eliminación de llamadas play() saturantes en render loop y verificación estricta de readyState >= 2 (2026-11-04 13:00)
- launcher.cs / PodcastStudio.exe — solución definitiva de apertura: timeout de detección ampliado a 15s con detección de señal a ~2.2s, previniendo cierres prematuros de splash y reintentos en bucle (2026-11-04 13:00)
- CameraConnectModal / CameraCalibratorModal — corrección de translucidez y borrosidad: eliminación de backdrop-filter blur en Chromium, aislamiento de stacking context (isolation: isolate) y fondos sólidos #12131a 100% opacos (2026-11-04 13:25)
- src/pages/RemoteCam.jsx / src/utils/streamTransport.js — incremento de calidad de streaming remoto a Full HD 1080p: QUALITY_TIERS ampliados hasta 6.0 Mbps, degradación fijada en 'maintain-resolution', e inyección de descriptores SDP b=AS:6000 / b=TIAS:6000000 tanto en Offer como en Answer para desbloquear ancho de banda nativo en WebRTC (2026-11-04 17:33)
- src/utils/masterBroadcastEngine.js — renderizado con interpolación bicúbica de alta precisión (ctx.imageSmoothingEnabled = true y ctx.imageSmoothingQuality = 'high') en el canvas Master 1080p (2026-11-04 17:33)
- PodcastStudio.exe — recompilado v1.3.4.0 (2026-11-04 17:34)
- Vercel — deploy a producción completado y activo en https://www.podcastudio.mx (2026-11-04 17:35)
- launcher.cs / electron/main.js — arranque ultra-rápido: p.WaitForExit(1000) al limpiar instancias previas evitando colisión con el cerrojo single-instance, y emisión anticipada de readySignalPath en app.whenReady() (2026-11-04 17:50)
- src/App.jsx / CameraConnectModal — soporte robusto para hasta 12 cámaras USB y cables de extensión > 10m: getUserMediaWithTimeout (2.8s) para eliminar congelamientos ("Conectando..."), liberación automática de ranuras previas para liberar el hardware lock en Windows DirectShow, eliminación de animación con opacidad en modal, y fallback escalonado a perfiles de ancho de banda compatibles (1080p, 720p, 540p, MJPEG nativo) (2026-11-04 17:51)
- PodcastStudio.exe — recompilado v1.3.4.0 (2026-11-04 17:53)
- Vercel — deploy a producción completado y activo en https://www.podcastudio.mx (2026-11-04 17:54)

## Verificado
- npm run test:remote-cameras (4/4 passed)
- npm run build (Vite production bundle OK)
- compile-exe.ps1 (PodcastStudio.exe v1.3.4.0 OK)
- Deploy Vercel Production OK (https://www.podcastudio.mx)

## Siguiente
- Monitoreo en ejecución y retroalimentación del usuario.

## Regla anti-reexploracion
- Si el pedido del usuario apunta a un archivo ya listado arriba: ve DIRECTO a read_file/replace_in_file de ese path.
- PROHIBIDO list_files('.') / project_discovery / codebase_map del repo completo en el mismo turno si el Mapa ya tiene >= 5 entradas utiles.
- Tras mutar: EditCore refresca este ROADMAP; continua desde aqui en el siguiente mensaje.
