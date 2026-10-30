# Baseline v1.3.1 — Medición de referencia

Fecha: 2026-10-30
Rama: feature/native-media-engine
Versión de referencia: v1.3.1 (tag pendiente)

## Cadena actual (confirmada en código)

1. `src/utils/masterBroadcastEngine.js:1637` — `canvas.captureStream(30)` captura el Master a 30 fps.
2. `MediaRecorder` (VP8/Opus WebM, 8 Mbps) empaqueta la señal.
3. `electron/main.js:2559` — FFmpeg `libx264` ultrafast re-codifica WebM → FLV/RTMP.
4. Un proceso FFmpeg por destino RTMP.

**Doble codificación + re-empaquetado** = cuello de CPU y latencia.

## Métricas a capturar (Fase 0)

| Métrica | OBS Studio | PodcastStudio v1.3.1 | Objetivo v2 |
|---|---|---|---|
| CPU % (idle, 1 cam) | | | |
| CPU % (4 cams + música) | | | |
| Latencia end-to-end (voz→stream) | | | |
| Dropped frames / 60s | | | |
| GPU % (si HW encode) | | | |
| RAM MB | | | |

## Procedimiento

1. Abrir OBS Studio y PodcastStudio en la misma PC.
2. Stream a un endpoint de prueba (YouTube/Twitch test o servidor RTMP local).
3. Anotar métricas con Task Manager / OBS Stats.
4. Guardar capturas en `docs/baseline-v1.3.1/`.

## Criterio de éxito para v2

- CPU % ≤ 50% del valor de v1.3.1 con la misma carga.
- Latencia end-to-end ≤ 2s (vs ~4-6s actual estimado).
- Dropped frames = 0 en 5 min continuos.
- Una sola codificación H.264 (sin MediaRecorder ni FFmpeg intermedio).
