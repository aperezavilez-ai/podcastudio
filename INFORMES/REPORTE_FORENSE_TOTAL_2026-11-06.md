# Plan de Análisis Forense y Corrección — PodcastStudio v1.3.8

Fecha: 2026-11-06
Alcance: código fuente activo (electron/, api/, lib/, src/, scripts/, public/, config root). Excluidos: node_modules/, dist/, dist_electron/, backup_20261105_141602/, .editcore/ (salvo evidencia), artefactos binarios/media, proyectos/.

## 1. Resumen ejecutivo

Se realizó revisión estructural y estática del proyecto activo, validación de pruebas existentes y análisis de superficie de seguridad/media/API. Se identificaron riesgos críticos de higiene de secretos, superficie IPC/Electron, webhooks de pagos, rate limit/CORS probablemente no aplicado en Vercel, inconsistencia ESM/CJS en API, ruta de exportación dependiente de paquetes no instalados, y monolitos de alto riesgo (App.jsx, main.js). Las pruebas existentes de slots, destinos de stream y pipeline de grabación pasan, pero no cubren fallos parciales, seguridad ni E2E.

## 2. Evidencia y validaciones ejecutadas

- npm run test:remote-cameras: 4/4 PASS (scripts/remote-camera-slots.test.mjs)
- npm run test:stream-config: 5/5 PASS (scripts/stream-destinations.test.mjs)
- npm run test:recording: 1/1 PASS (scripts/recording-pipeline.integration.test.mjs, ~9.4s)
- node_modules ausente para: @ffmpeg/ffmpeg, @ffmpeg/util (ruta de exportVideo.js depende de ellos)
- lib/livepeer/client.js, lib/mercadopago/client.js, lib/mux/client.js importan paquetes declarados e instalados (livepeer, mercadopago, @mux/mux-node) OK.
- raw-body instalado y declarado OK.

## 3. Hallazgos por severidad

### P0 — Crítico

P0-1 Secretos en disco
- Archivo: .env.local (presente en workspace) con credenciales/tokens reales.
- Riesgo: exposición local/backups/logs; potencial compromiso.
- Acción: rotar credenciales; mover a gestor de secretos; verificar historial git/remotos/backups; añadir secret scanning; no commitear .env*.

P0-2 Electron open-external sin validación
- Archivos: electron/preload.js (openExternal), electron/main.js:1808.
- Evidencia: ipcMain.on('open-external', (event, url) => shell.openExternal(url));
- Riesgo: abrir protocolos peligrosos si renderer comprometido o enlace malicioso.
- Acción: allowlist http/https (y mailto si aplica), validar con new URL(), bloquear file:/custom handlers.

P0-3 Permisos Electron demasiado permisivos
- Archivo: electron/main.js (setPermissionRequestHandler true, setPermissionCheckHandler true, setDevicePermissionHandler true, auto-selección puerto serial).
- Acción: restringir por origen/sesión, documentar intención.

P0-4 use-fake-ui-for-media-stream
- Archivo: electron/main.js.
- Riesgo: elimina prompts de selección/consentimiento de media stream.
- Acción: confirmar intención de producto y documentar.

P0-5 Mux webhook verificación frágil / posible bypass
- Archivo: api/mux/webhook.js (config bodyParser true; verifyMuxSignature; handler).
- Problemas: firma calculada sobre JSON.stringify(req.body) (no raw body exacto); verifyMuxSignature retorna !secret si falta secreto/firma; handler solo exige firma si secreto existe → sin secreto acepta webhooks sin firma.
- Acción: usar bodyParser false + raw-body; requerir secreto en producción; rechazar payload inválido/no firmado según política; comparación timing-safe.

P0-6 Rate limit/CORS probablemente no aplicado en Vercel
- Archivo: api/_middleware.js (implementa rate limit en memoria y CORS).
- Problema: en Vite + funciones api/*, _middleware.js no se ejecuta automáticamente como middleware global (no Next.js). Implementación en memoria por instancia (no distribuida).
- Acción: validar en despliegue; implementar wrapper compartido por handler o Edge Middleware de Vercel o rate limiting externo; unificar con vercel.json.

P0-7 Inconsistencia ESM/CJS en API
- Archivos: api/ai.js (ESM + top-level await), api/ai/status.js (CommonJS require/module.exports).
- package.json no declara "type":"module".
- Riesgo: fallo de import/runtime según bundling.
- Acción: unificar formato (preferible ESM consistente o CJS consistente) y añadir prueba de arranque/import de handlers.

### P1 — Alto

P1-1 Superficie IPC amplia sin validación
- Archivo: electron/preload.js expone ~30+ canales; electron/main.js handlers.
- Canales críticos: open-external (1808), discover-network-cameras (1498), start-iso-recording (2081), record-iso-chunk (2149), stop-iso-recording (2161), get-iso-status (2188), save-to-downloads (2198), export-social-format (2222), save-recording-thumbnail (2437).
- Acción: validar argumentos (rutas, nombres, URLs, buffers, slot, projectName), bloquear path traversal, limitar tamaños.

P1-2 FFmpeg/exec/PowerShell sin hardening
- Archivo: electron/main.js (spawn ffmpegPath, exec arp, exec PowerShell).
- Riesgo: inyección de comandos, escaping, timeouts, limpieza, concurrencia, backpressure.
- Acción: auditar y endurecer cada spawn/exec; validar entradas; timeouts; cleanup en close/error.

P1-3 Grabación/transmisión robustez
- Archivos: electron/main.js, src/utils/masterBroadcastEngine.js, src/App.jsx.
- Riesgos: race stop vs último chunk, doble stop, recorder/worker muerto con estado UI inconsistente, colas no drenadas, leaks, errores FFmpeg no propagados.
- Acción: auditoría por dominio + pruebas de fallos parciales/cancelación/ISO/RTMP multi-destino/reconexión.

P1-4 Native engine backpressure
- Archivos: electron/media-engine/index.js (writeFrame/writeAudio usan write sin drain), bridge.js (nativeEngineRunning).
- Riesgo: acumulación de memoria/bloqueo en alta carga; estado incoherente.
- Acción: implementar backpressure/drain, estado coherente, estrés corto, fallback seguro.

P1-5 MercadoPago webhook idempotencia/autorización
- Archivos: api/mercadopago/webhook.js, lib/mercadopago/webhooks.js, lib/mercadopago/signature.js.
- Acción: auditar handleMPWebhook, idempotencia por paymentId/eventId, estados duplicados, no confiar en datos no verificados.

P1-6 Auth/validación transversal API
- Endpoints: api/auth/login.js, api/live/*, api/mux/*, api/youtube/*, api/mercadopago/subscription|sync, api/email/send.
- Acción: esquemas de entrada, límites de tamaño, normalización de IDs, errores sin detalles internos, autorización por recurso (sessionId, streamId, recordingId, paymentId pertenecen al usuario).

P1-7 Monolito App.jsx (~331 KB)
- Archivo: src/App.jsx.
- Riesgo: regresiones, listeners/intervalos huérfanos, estado desincronizado, renders costosos.
- Acción: auditoría por dominios y extracción de lógica crítica a hooks/servicios testeables.

P1-8 exportVideo.js ruta dependiente de paquetes no instalados
- Archivo: src/utils/exportVideo.js (fallback dinámico @ffmpeg/ffmpeg, @ffmpeg/util).
- Evidencia: paquetes ausentes en node_modules.
- Acción: instalar/soportar oficialmente o eliminar ruta muerta y mostrar error claro.

P1-9 Supabase cliente fallback hardcodeado
- Archivo: src/lib/supabase.js (URL/anon key fallback).
- Acción: validar import.meta.env explícitamente; fallo controlado en dev/build; no ocultar config incorrecta.

P1-10 vercel.json redirects duplicados y header agresivo
- Archivo: vercel.json.
- Problemas: redirecciones duplicadas para podcastudio.mx; Clear-Site-Data: "cache", "storage" en /sw.js (puede borrar localStorage/sesiones/config/proyectos).
- Acción: limpiar redirects; revisar/retirar Clear-Site-Data tras confirmar impacto; unificar CORS/headers con _middleware.

### P2 — Medio

P2-1 XSS/manual review pendiente
- No se encontraron dangerouslySetInnerHTML/eval/new Function en barrido inicial, pero falta revisión manual de renderizado HTML, innerHTML, URLs remotas, QR/labels, datos de invitados/chat/red.

P2-2 Accesibilidad/UX resiliente
- Modales, foco, Escape/click fuera, estados de carga/error, operaciones largas sin congelar UI.

P2-3 WebRTC/Supabase remote pages
- Archivos: src/pages/RemoteCam.jsx, src/pages/StudioRemoteControl.jsx.
- Revisar señalización, reconexión, permisos cámara/mic, estados desconectados.

P2-4 Documentación/baseline
- .editcore/forensic-last.json marca warnings stale (algunos paquetes sí instalados/declarados). Actualizar baseline tras correcciones.

### P3 — Bajo / mantenibilidad

P3-1 Limpieza y deuda
- Monolitos, tests legacy, artefactos históricos.
- Añadir lint/format y typecheck gradual.

## 4. Plan de ejecución

### Fase 0 — Preparación y control de riesgo
1. Congelar evidencia: registrar commit/estado, versiones, entorno Node/Electron, hallazgos iniciales.
2. Contención de secretos: confirmar .env.local no trackeado; revisar git log/remotos por filtraciones; preparar rotación; añadir secret scanning.
3. Matriz de prioridad: P0 seguridad/pérdida de datos, P1 corrupción media/auth/pagos, P2 funcionales, P3 mantenibilidad.

### Fase 1 — Seguridad (API + Electron)
1. API webhooks/pagos: corregir Mux (raw body, política secreto), auditar MercadoPago idempotencia/firma/eventos, revisar YouTube/Mux/Livepeer/Restream.
2. Rate limit/CORS real: validar si _middleware corre en Vercel; implementar mecanismo efectivo y compartido; unificar headers.
3. Electron hardening: validar openExternal; endurecer IPC; restringir permisos/device handlers; revisar will-navigate/setWindowOpenHandler.
4. Sanitización de paths/procesos: normalizar rutas bajo directorios permitidos, bloquear traversal, validar extensiones/nombres, revisar comandos.

### Fase 2 — Núcleo de media
1. Pipeline de grabación: auditoría main.js + preload + masterBroadcastEngine + flujo UI. Cubrir inicio/pausa/chunks/flush/stop/cancel/errores/thumbnails/persistencia.
2. ISO/multicanal: verificar handlers y pruebas con slots reales/simulados.
3. Streaming RTMP/Livepeer/WebRTC: revisar destinos, workers, reconexión, backpressure, ocultamiento de claves, validación URLs/credenciales.
4. Native engine: backpressure/drain, estado coherente, estrés, fallback.
5. Exportación: resolver @ffmpeg ausente; validar export social/descargas/archivos grandes.

### Fase 3 — Frontend y experiencia
1. Auditoría dirigida de App.jsx por subsistemas: cámaras/slots, audio mixer, teleprompter/subtítulos, cintillos, remote control, workspaces, modales, hotkeys. Buscar race conditions, cleanup useEffect, streams/tracks no detenidos, estado obsoleto.
2. Páginas remotas: señalización, reconexión, permisos, estados desconectados.
3. Supabase/config cliente: eliminar/protector fallback hardcodeado; manejo sesión expirada/red.
4. Regresión UI crítica: pruebas manuales guiadas + smoke automatizado.

### Fase 4 — Calidad, pruebas y cierre
1. Pruebas automatizadas faltantes: unit (utilidades puras), API (handlers con mocks), Electron integration (IPC críticos), smoke E2E si se habilita.
2. Static checks: añadir lint/format (ESLint) y typecheck gradual; corregir hallazgos de alta señal.
3. Limpieza config: vercel.json, sw.js/registerSW.js/index.html coherentes, política Clear-Site-Data.
4. Informe final: hallazgos confirmados, severidad, archivos/líneas, fix aplicado, prueba que lo cubre, riesgos residuales. Actualizar baseline forense en INFORMES/ sin sobrescribir histórico útil.

## 5. Criterios de salida

- P0/P1 de seguridad y media sin exploits/paths inválidos conocidos en revisión estática + pruebas dirigidas.
- Tests existentes siguen en verde; nuevos tests cubren hallazgos corregidos.
- Webhooks/pagos verifican firma/raw body/idempotencia según configuración requerida.
- Grabación/streaming/export no dejan procesos huérfanos ni archivos corruptos en escenarios cubiertos.
- Configuración de despliegue sin headers/reglas que borren datos de usuario accidentalmente.
- Informe forense con evidencia antes/después.

## 6. Limitaciones del análisis actual

- App.jsx y main.js son demasiado grandes para auditoría total en una pasada; se usa auditoría por dominios y prioriza rutas sensibles/media.
- No se ejecutaron E2E de Electron UI completa ni pruebas contra servicios externos reales (Supabase/Mux/MercadoPago/YouTube/RTMP); requieren staging/credenciales de prueba.
- backup_20261105_141602/ y artefactos dist*/test_output no se auditaron como código activo; revisar solo si se reutilizarán (pueden contener divergencias o material sensible).
