# PODCASTUDIO — ROADMAP

Fuente de verdad del proceso del proyecto para el agente. LEER ESTO ANTES de cualquier tool.
PROHIBIDO reexplorar el repo entero si este documento cubre la tarea. Solo read_file de lo que vas a editar.
EditCore actualiza este archivo tras cambios. No pedirlo al usuario. No pegar codigo largo.

## Proceso
- Fase: release
- Estado: Release v1.3.2 OK (2026-10-31 15:25)
- Actualizado: 2026-10-31 15:25
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
- Optimización de arranque, resolución de video negro en cámara remota y sincronización de ciclo de vida.

## Bloqueos / bugs conocidos
- Ninguno registrado

## Decisiones
- Se mantiene el motor en base Chromium/Electron: Tauri usa WebView2 (mismo motor Chromium) pero carece de Node.js nativo, lo que obligaría a reescribir todo el backend FFmpeg/WebRTC en Rust sin aportar ventajas de renderizado.
- Corrección de `jitterBufferTarget` (50ms en milisegundos) y `playoutDelayHint` (0.05s) en WebRTC: restaura decodificación de cuadros en cámaras remotas evitando pantalla negra.
- Limpieza de procesos en `electron/main.js`: `mainWindow.on('closed')` y `app.on('window-all-closed')` garantizan que no queden procesos zombie en segundo plano bloqueando arranques posteriores.

## Cambios recientes
- src/components/CameraConnectModal.jsx — predeterminado a Wi-Fi Local Directo (LAN) para latencia <80ms y evitar degradación/barrido sobre internet (2026-11-01 12:45)
- src/App.jsx — receptor móvil calibrado con jitterBufferTarget a 50ms y playoutDelayHint a 0.05s (2026-11-01 12:45)
- electron/main.js — encoder de video local a 30 FPS, 5 Mbps CBR, maintain-resolution y audio 128 kbps (2026-11-01 12:45)
- src/utils/streamTransport.js — corrección de unidad de jitterBufferTarget a 50ms para decodificación fluida sin pantalla negra (2026-11-01 12:08)
- src/utils/rtcConfig.js — STUN de baja latencia directo de Google y Cloudflare sin demoras de servidores TURN saturados (2026-11-01 12:08)
- src/pages/RemoteCam.jsx — umbrales de red calibrados y eliminación de degradaciones espurias en arranque (2026-11-01 12:08)
- electron/main.js — ciclo de vida de cierre completo, fallback a puerto 3002 por colisión con Docker y auto-recreación en second-instance (2026-11-01 12:08)
- src/App.jsx — conexión escalonada de canales en arranque (2026-11-01 12:08)
- src/config/featureFlags.js — USE_NATIVE_ENGINE en false para baseline v1.3.1 ultra estable (2026-11-01 12:08)
- launcher.cs / PodcastStudio.exe — binario ejecutable compilado con assembly version 1.3.2.0

## Verificado
- npm run test:remote-cameras (4/4 passed)
- npm run test:recording (1/1 passed)
- npm run test:stream-config (5/5 passed)
- npm run build (Vite production bundle OK)
- npm run build:exe (PodcastStudio.exe v1.3.2.0 OK)

## Siguiente
- Monitoreo en ejecución y retroalimentación del usuario.

## Regla anti-reexploracion
- Si el pedido del usuario apunta a un archivo ya listado arriba: ve DIRECTO a read_file/replace_in_file de ese path.
- PROHIBIDO list_files('.') / project_discovery / codebase_map del repo completo en el mismo turno si el Mapa ya tiene >= 5 entradas utiles.
- Tras mutar: EditCore refresca este ROADMAP; continua desde aqui en el siguiente mensaje.
