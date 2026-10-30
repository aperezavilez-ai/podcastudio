# PodcastStudio v1.2.9

## Cámaras remotas Android/iOS

- Solicita captura 1080p a 30 fps y conserva 720p/perfil del dispositivo como fallback cuando el teléfono no ofrece Full HD.
- La etiqueta de calidad usa las dimensiones reales de la pista de cámara.
- Cada negociación WebRTC incluye un ID de conexión. El estudio descarta candidatos ICE, respuestas y desconexiones que pertenecen a una sesión vieja después de una recarga.
- Al reemplazar la conexión se limpian temporizadores, pistas y decodificadores anteriores. El monitor revisa el avance de cuadros y pide una nueva oferta si el video se estanca.
- El monitor master conserva la relación 16:9 para que la previsualización no amplíe ni recorte el encuadre remoto.
- El selector admite las ranuras remotas de CAM 1 a CAM 12.

## Redes y envío RTMP

- Los campos de destino editan su estado local y persisten al perder el foco, evitando recalcular toda la cabina en cada tecla.
- RTMP espera el primer video procesado por FFmpeg, distingue destinos conectados de destinos fallidos y no registra la URL con la clave.
- La validación acepta `rtmp://` y `rtmps://`, también permite pegar una URL de publicación completa y no muestra claves en errores de entrada.

## Verificación y límites

- Pruebas automatizadas de destinos RTMP: 4/4.
- Pruebas de asignación de cámaras 1–12 y capacidades 4–12: 4/4.
- Revisiones de sintaxis Electron/transport y build web.
- El build reporta una advertencia existente de chunk principal superior a 500 kB.
- No se pudo verificar transmisión física con Android/iOS ni iniciar una emisión real de Facebook desde este entorno. Una clave de Facebook se compartió en el chat; debe revocarse y reemplazarse antes de transmitir.
