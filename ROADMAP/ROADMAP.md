# PODCASTUDIO — ROADMAP

Fuente de verdad del proceso del proyecto para el agente. LEER ESTO ANTES de cualquier tool.
PROHIBIDO reexplorar el repo entero si este documento cubre la tarea. Solo read_file de lo que vas a editar.
EditCore actualiza este archivo tras cambios. No pedirlo al usuario. No pegar codigo largo.

## Proceso
- Fase: implementacion
- Estado: Ciclo finalizado.
- Actualizado: 2026-10-13 15:18
- Stack: React + Vite + Supabase
- Entry: index.html
- Entry: src/main.jsx
- Entry: src/App.jsx
- Scripts: dev, build, preview
- Preview: desconocido — usa el preview del IDE, no inventes puertos

## Mapa
- package.json
- supabase/schema.sql
- .env.example
- src/pages/Plans.jsx
- lib/mercadopago/webhooks.js
- vite.config.js
- src/lib/billing.js
- lib/mercadopago/sync.js
- lib/mercadopago/subscriptions.js
- lib/mercadopago/client.js
- src/lib/supabase.js
- package.json — podcastudio · scripts: dev, build, preview
- stack: React + Vite + Supabase
- entry: index.html
- entry: src/main.jsx
- entry: src/App.jsx
- .cursor/
- .cursorrules
- .env.local
- .github/
- .gitignore
- .project-governance/
- AGENTS.md
- api/
- CLAUDE.md
- docs/
- docs/dominio-ssl.md
- index.html
- lib/
- lib/ai/
- lib/email/
- lib/integrations/
- lib/livepeer/
- lib/mux/
- lib/restream/
- lib/stripe/
- lib/supabase/
- lib/youtube/
- package-lock.json
- project-infra.json
- public/
- public/apple-touch-icon.png
- public/editcore-logo.png
- public/favicon.svg
- public/pwa-192x192.png
- public/pwa-512x512.png
- public/robots.txt
- public/site.webmanifest

## Archivos clave (no reexplorar)
- src/lib/billing.js
- src/pages/Plans.jsx
- vite.config.js
- package.json
- .env.example
- supabase/schema.sql
- lib/mercadopago/client.js
- lib/mercadopago/subscriptions.js
- lib/mercadopago/sync.js
- src/config/plans.js
- lib/stripe/client.js
- lib/stripe/plans.js
- lib/mercadopago/webhooks.js
- src/lib/supabase.js
- api/stripe/checkout.js
- api/stripe/status.js

## Tarea activa
- SOLICITUD ORIGINAL:
vamos a eliminar stripe como metodo de pago y agregaremos mercado pago que tenemos la cuenta lista para agregarla

ULTIMO AVANCE DEL AGENTE (no reexplores desde cero):
## ⏸️ Pausa: llegué al límite de

## Bloqueos / bugs conocidos
- Ninguno registrado

## Decisiones
- Ninguna registrada

## Cambios recientes
- [EditCore] api/ai/status.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] lib/mercadopago/webhooks.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] lib/mercadopago/subscriptions.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] lib/mercadopago/sync.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] lib/supabase/auth.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] lib/supabase/admin.js — AUTORIZACION DE EJECUCION (PROCEDE): las reglas de DIAGNOSTICO / NO MODIFICAR del analisis previo qu
- [EditCore] vite.config.js — parche aplicado (kernel) (2026-10-13 15:01)
- [EditCore] lib/ai/claude.cjs — archivo escrito (kernel) (2026-10-13 15:00)
- [EditCore] lib/ai/claude.js — archivo escrito (kernel) (2026-10-13 14:55)
- [EditCore] package.json — parche aplicado (kernel) (2026-10-13 14:51)
- src/lib/billing.js
- src/pages/Plans.jsx
- vite.config.js
- package.json
- .env.example
- supabase/schema.sql
- lib/mercadopago/client.js
- lib/mercadopago/subscriptions.js
- lib/mercadopago/sync.js
- src/config/plans.js
- lib/stripe/client.js
- lib/stripe/plans.js
- lib/mercadopago/webhooks.js
- src/lib/supabase.js
- api/stripe/checkout.js
- api/stripe/status.js
- api/stripe/subscription.js
- api/stripe/webhook.js

## Verificado
- Pendiente

## Siguiente
- Proponer optimización o nueva funcionalidad.

## Regla anti-reexploracion
- Si el pedido del usuario apunta a un archivo ya listado arriba: ve DIRECTO a read_file/replace_in_file de ese path.
- PROHIBIDO list_files('.') / project_discovery / codebase_map del repo completo en el mismo turno si el Mapa ya tiene >= 5 entradas utiles.
- Tras mutar: EditCore refresca este ROADMAP; continua desde aqui en el siguiente mensaje.
