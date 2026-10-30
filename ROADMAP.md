# PODCASTUDIO — ROADMAP

Fuente de verdad del proceso del proyecto para el agente. LEER ESTO ANTES de cualquier tool.
PROHIBIDO reexplorar el repo entero si este documento cubre la tarea. Solo read_file de lo que vas a editar.
EditCore actualiza este archivo tras cambios. No pedirlo al usuario. No pegar codigo largo.

## Proceso
- Fase: implementacion
- Estado: Patch OK: electron/media-engine/bridge.js (2026-10-30 23:46)
- Actualizado: 2026-10-30 23:46
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
- te paso todo lo que estamos haciendo que veo que olvidaste......   Tú

## Bloqueos / bugs conocidos
- Ninguno registrado

## Decisiones
- Ninguna registrada

## Cambios recientes
- electron/media-engine/bridge.js — archivo escrito (kernel) (2026-10-30 23:46)
- electron/media-engine/index.js — archivo escrito (kernel) (2026-10-30 23:46)
- src/config/featureFlags.js — archivo escrito (kernel) (2026-10-30 23:45)
- docs/media-engine/ARCHITECTURE.md — archivo escrito (kernel) (2026-10-30 23:45)
- docs/baseline-v1.3.1.md — archivo escrito (kernel) (2026-10-30 23:44)
- lib/livepeer/client.js
- lib/mercadopago/client.js
- lib/mux/client.js
- api/mercadopago/webhook.js
- src/utils/exportVideo.js
- package.json
- electron/media-engine/index.js
- docs/baseline-v1.3.1.md
- src/utils/masterBroadcastEngine.js
- lib/supabase/serverLogin.js
- electron/media-engine/index.js — parche aplicado (kernel) (2026-10-30 22:26)
- electron/media-engine/index.js — archivo escrito (kernel) (2026-10-30 22:26)
- docs/baseline-v1.3.1.md — archivo escrito (kernel) (2026-10-30 22:26)

## Verificado
- Pendiente

## Siguiente
- Proponer optimización o nueva funcionalidad.

## Regla anti-reexploracion
- Si el pedido del usuario apunta a un archivo ya listado arriba: ve DIRECTO a read_file/replace_in_file de ese path.
- PROHIBIDO list_files('.') / project_discovery / codebase_map del repo completo en el mismo turno si el Mapa ya tiene >= 5 entradas utiles.
- Tras mutar: EditCore refresca este ROADMAP; continua desde aqui en el siguiente mensaje.
