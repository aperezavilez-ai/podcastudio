# PodcastStudio v1.2.10

## Respuesta de la cabina

- Los niveles de audio de cada cámara ahora se publican como máximo cada 200 ms, con valores agrupados y sin renderizar toda la cabina en cada frame.
- El medidor del micrófono principal limita de igual forma sus actualizaciones de UI. Se conserva el análisis de audio para Ducking y detección de voz.
- Los medidores reutilizan el contexto del mezclador broadcast en vez de abrir contextos de audio adicionales.
- Detener una grabación apaga video y limpia las pistas de cámara, pero conserva el contexto y track del mezclador para que música y monitor no queden conectados a un contexto cerrado.

## Cámara remota y sincronía

- El teléfono solicita Full HD cuando el dispositivo lo permite.
- El codificador empieza con un límite de 3.5 Mbps y prioriza mantener 30 fps. Ante congestión reduce bitrate y escala de forma adaptativa a 720p y luego 540p para evitar acumular segundos de video y separar voz e imagen.
- La reducción ocurre después de dos mediciones consecutivas de congestión.

## Verificación

- Build web y EXE v1.2.10.0 completados.
- Grabación/exportación: 1/1; destinos RTMP: 4/4; asignación de cámaras 1–12: 4/4.
- La frecuencia de actualización de los medidores se redujo en código; la fluidez final y el lip-sync deben confirmarse en la PC y los teléfonos físicos del estudio.
