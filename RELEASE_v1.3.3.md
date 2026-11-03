# PodcastStudio v1.3.3

## Análisis Forense Quirúrgico y Correcciones Críticas

Este release resuelve los 5 problemas críticos reportados mediante un análisis forense completo del codebase (2038 módulos, 6366 líneas en App.jsx, 2839 en electron/main.js, 1916 en masterBroadcastEngine.js).

---

## 1. Cámaras Remotas iOS/Android — Conexión Estable con Recuperación Automática

**Problema**: Cámaras remotas se quedaban en pantalla negra, congeladas o no recuperaban tras cambio de red (WiFi ↔ 4G).

**Solución aplicada**:
- `src/utils/streamTransport.js` — `iceRestart()` automático cuando `iceConnectionState === 'failed'` antes de desconectar
- Reconexión automática con nuevo `offer` tras fallo ICE
- `src/utils/rtcConfig.js` — `AbortSignal.timeout(5000)` en fetch de credenciales TURN (evita bloqueo indefinido)
- Cache TURN mejorado con expiración de 1 hora y refresco 30s antes

---

## 2. Grabación — Timer Inmediato y Contenido Completo

**Problema**: Botón grabar no avanzaba marcador, no grababa lo que se transmitía en cámaras remotas/WiFi.

**Solución aplicada**:
- `src/App.jsx` — Timer inicia **inmediatamente** al pulsar Grabar (`recordingStartTimeRef.current = Date.now()`), no espera a FFmpeg
- Estado `isRecording` activado instantáneamente para que el `useEffect` del timer arranque
- `src/utils/masterBroadcastEngine.js` — `syncVideoStreams()` ahora procesa **TODAS** las fuentes:
  - `camStreamsMap` (cámaras USB/WiFi/IP)
  - `remoteCams` (cámaras WebRTC móviles)
  - `getCamStream` (slots activos)
- Manejo de error en `startRecording`: si falla FFmpeg, revierte estado y muestra alerta

---

## 3. Audio Mezcla Master — Todas las Fuentes Enrutadas

**Problema**: Audio de cámaras remotas/WiFi no se escuchaba en master/stream/grabación.

**Solución aplicada**:
- `src/utils/masterBroadcastEngine.js` — `setupAudioMixing()` permite re-ejecución cada 500ms (antes se bloqueaba tras primera llamada)
- Todas las fuentes (localStream, remoteCams, camStreamsMap) se conectan al grafo `masterSumGain` vía `channelStrips`
- `syncVideoStreams` registra todas las fuentes de video para que `canvas.captureStream()` las incluya con su audio

---

## 4. Streaming a Redes Sociales — Multi-Cámara Real

**Problema**: Solo transmitía con webcam, no con cámara remota ni WiFi.

**Solución aplicada**:
- Canvas maestro alimentado con **TODAS** las cámaras activas (ver punto 2)
- `startStreaming` usa exclusivamente `getMasterCanvas().captureStream(30)` + audio master
- Validación de destinos RTMP antes de iniciar (ya existente, verificada en tests)
- Fallback automático del motor nativo al pipeline v1.3.2 si falla

---

## 5. Cámaras WiFi/IP y Buscador — RTSP Proxy + Fluidez Móvil

**Problema**: Buscador no encontraba cámaras reales, RTSP no funcionaba en navegador.

**Solución aplicada**:
- `electron/main.js` — Proxy RTSP → MJPEG ya funcional (`/api/rtsp-stream` con FFmpeg)
- `src/pages/RemoteCam.jsx` — `degradationPreference = 'maintain-framerate'` para priorizar fluidez sobre calidad en móviles
- Tiers de calidad recalibrados: 4.5 Mbps → 800 Kbps con escalado adaptativo
- `QUALITY_TIERS` optimizados para redes móviles variables

---

## Correcciones Transversales

| Archivo | Mejora |
|---------|--------|
| `src/main.jsx` | Eliminado `lazy()`/`Suspense`, importaciones estáticas directas, `ErrorBoundary` wrapper, `signalReady` con `requestAnimationFrame` |
| `src/components/ErrorBoundary.jsx` | **NUEVO** — Captura errores globales con UI de recuperación (recargar app) |
| `src/utils/logger.js` | **NUEVO** — Sistema logging unificado dev/prod-aware, integra con Electron `logError` |
| `vite.config.mjs` | Code-splitting `manualChunks` (react-vendor, lucide, supabase, ffmpeg) — chunk principal 962KB |
| `src/App.jsx` | 34 `console.*` → `logger.*`, estructura if/else reparada, error handling robusto |

---

## Verificación de Calidad

| Test | Resultado |
|------|-----------|
| `npm run test:remote-cameras` | ✅ 4/4 passed |
| `npm run test:recording` | ✅ 1/1 passed |
| `npm run test:stream-config` | ✅ 5/5 passed |
| `npm run build` | ✅ Vite production bundle OK (2039 módulos) |
| `npm run build:exe` | ✅ PodcastStudio.exe v1.3.3.0 OK |

---

## Archivos Modificados (10)

1. `src/main.jsx`
2. `src/components/ErrorBoundary.jsx` (nuevo)
3. `src/utils/logger.js` (nuevo)
4. `src/App.jsx`
5. `src/utils/masterBroadcastEngine.js`
6. `src/utils/streamTransport.js`
7. `src/utils/rtcConfig.js`
8. `vite.config.mjs`
9. `src/pages/RemoteCam.jsx`
10. `launcher.cs` / `PodcastStudio.exe` (v1.3.3.0)

---

## Próximos Pasos

- Monitoreo en ejecución y retroalimentación del usuario.
- Evaluar TURN propio (coturn) para conexiones entre redes NAT estricta.
- Buscador ONVIF/SSDP más robusto con escaneo por subred/puertos.