# BASELINE v1.3.1 (REFERENCIA) — PodcastStudio

Fecha: 2026-10-30
Rama: feature/native-media-engine
Commit base: (ver `git log -1 --oneline`)

## Cadena actual confirmada
1. `src/utils/masterBroadcastEngine.js:1637` → `canvas.captureStream(30)`
2. `src/utils/masterBroadcastEngine.js` → `MediaRecorder` (VP8/Opus WebM ~8 Mbps) graba/emite composición
3. `electron/main.js:2559` → FFmpeg `libx264 ultrafast` re-codifica WebM→FLV para RTMP

**Problema:** doble codificación + re-empaquetado. Consumo CPU + latencia acumulada.

## Métricas a medir (OBLIGATORIAS)
| Prueba | CPU (promedio) | Latencia percibida | Dropped frames | Notas |
|---|---|---|---|---|
| 1 destino RTMP (1080p30) | TBD | TBD | TBD | Baseline |
| 2 destinos simultáneos | TBD | TBD | TBD | Baseline |
| 4 cámaras remotas + local | TBD | TBD | TBD | Baseline |
| Grabación local + emisión | TBD | TBD | TBD | Baseline |

## Entorno
- OS: Windows
- Node: v24.18.0
- Electron: ^29.1.0
- FFmpeg: ffmpeg-static ^5.2.0 + fluent-ffmpeg ^2.1.2

## Cómo reproducir
```bash
npm run dev
# Emitir a endpoint RTMP de prueba
# Medir con Task Manager/Resource Monitor + OBS/monitoreo destino
```

**NOTA:** v1.3.1 se mantiene intacto como referencia hasta validar v2 con métricas mejores o iguales.
