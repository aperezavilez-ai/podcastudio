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
- Compilación, verificación integral y despliegue de versión v1.3.2.

## Bloqueos / bugs conocidos
- Ninguno registrado

## Decisiones
- v1.3.2 estabiliza arranque síncrono (eliminación de Suspense/pantalla negra), modal de cámaras remotas (fix copiedSlotNumber) y calidad de streaming/grabación nativa con buffer adaptativo.

## Cambios recientes
- RELEASE_v1.3.2.md — notas de release v1.3.2 (2026-10-31 15:32)
- package.json — bump version a 1.3.2 (2026-10-31 15:32)
- src/App.jsx — footer y logs sincronizados con v1.3.2 (2026-10-31 15:32)
- src/pages/RemoteCam.jsx — adaptación dinámica por pérdida de paquetes y latencia (2026-10-31 15:30)
- src/utils/streamTransport.js — buffer de jitter estabilizado a 60 ms para A/V sincronizado (2026-10-31 15:30)
- src/utils/rtcConfig.js — inclusión de fallback TURN público (2026-10-31 15:30)
- electron/main.js — ajuste de perfiles de codificación FFmpeg a veryfast con control de bitrate (2026-10-31 15:30)
- electron/media-engine/index.js — estabilización de buffers RTMP para baja latencia (2026-10-31 15:30)
- launcher.cs / PodcastStudio.exe — binario ejecutable compilado con assembly version 1.3.2.0

## Verificado
- npm run test:remote-cameras (4/4 passed)
- npm run test:recording (1/1 passed)
- npm run test:stream-config (5/5 passed)
- npm run build (Vite production bundle OK)
- npm run build:exe (PodcastStudio.exe v1.3.2.0 OK)

## Siguiente
- Monitoreo de producción y feedback de usuario.

## Regla anti-reexploracion
- Si el pedido del usuario apunta a un archivo ya listado arriba: ve DIRECTO a read_file/replace_in_file de ese path.
- PROHIBIDO list_files('.') / project_discovery / codebase_map del repo completo en el mismo turno si el Mapa ya tiene >= 5 entradas utiles.
- Tras mutar: EditCore refresca este ROADMAP; continua desde aqui en el siguiente mensaje.
