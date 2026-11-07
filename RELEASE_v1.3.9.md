# PodcastStudio v1.3.9

Fecha: 7 de noviembre de 2026

## Conexión RTMP Inmediata y Robusta (Facebook Live / YouTube / Restream)

- Conexión handshake instantánea en <1.5s gracias a la reducción optimizada de probesize (`2M`), analyzeduration (`1000000`), `-fpsprobesize 0` y flags de baja latencia en FFmpeg (`+discardcorrupt+nobuffer`).
- Inyección anticipada de la cabecera EBML WebM (`cachedInitHeader` / `initialHeader`) en el arranque de la transmisión para sincronización inmediata de codecs sin esperar acumulación de fragmentos.
- Normalización automática de destinos RTMPS (Facebook Live, YouTube, Restream) y soporte para URLs completas pegadas directamente en el campo de clave.

## Integridad Absoluta de Grabación Master MP4

- Protección del proceso de finalización: `cancel-recording` ahora valida que el proceso FFmpeg esté activo antes de cualquier acción en disco, evitando que grabaciones válidas completadas sean eliminadas por error.
- Limpieza garantizada del estado interno `currentRecordingPath` en todas las rutas de salida (éxito de miniatura, advertencia de miniatura, timeout o validación de MP4).
- Preservación íntegra de la pista Master en alta definición 1080p con audio mezclado en tiempo real (todas las cámaras, micrófonos, efectos de sonido y música de fondo).

## Almacenamiento Único y Centralizado por Proyecto

- Se eliminó la carpeta duplicada `grabaciones` y la exportación redundante a la carpeta `Descargas` del sistema.
- Todos los archivos generados (video Master MP4, miniatura JPEG, clips destacados y formatos sociales) se guardan única y exclusivamente dentro de `D:\PROGRAMAS IA\PODCASTUDIO\proyectos\[NombreDelProyecto]\`.
- El botón de apertura de carpeta en la interfaz abre directamente el directorio del proyecto correspondiente.

## Barra de Progreso en Exportación Multi-Formato

- Telemetría en tiempo real desde stderr de FFmpeg (`export-progress` IPC): la barra de progreso en la ventana modal avanza de forma continua (20% → 95% → 100%) sin congelarse.
- Cadena de resolución segura de ruta para el archivo fuente (`masterPath`), previniendo fallos cuando el objeto de grabación tiene diferentes esquemas de nombres.
- Reporte veraz de estado de entrega en el pack social completo.

## Validación

- `npm run test:recording` (100% aprobado)
- `npm run test:remote-cameras` (100% aprobado)
- `npm run test:stream-config` (100% aprobado)
- `npm run build` (Vite production bundle OK)
- `npm run build:exe` — `PodcastStudio.exe` 1.3.9.0 generado correctamente
