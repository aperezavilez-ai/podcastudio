# PodcastStudio v1.2.8

## Correcciones de grabación y ventana

- Se eliminó el segundo `MediaRecorder` del programa Master para evitar doble codificación y carga excesiva durante la grabación.
- Los segmentos se entregan secuencialmente al proceso FFmpeg con control de flujo; Electron no conserva la grabación completa en memoria.
- Se espera el último segmento del grabador y el cierre efectivo de FFmpeg antes de informar que la grabación terminó. Los MP4 inválidos muestran un error.
- La grabación ISO queda apagada de forma predeterminada para proteger el rendimiento de la transmisión; puede activarse cuando se requieran pistas aisladas.
- Las grabaciones se guardan en la carpeta del proyecto con miniatura. Facebook y YouTube 16:9 producen archivos distintos; las exportaciones incluyen miniatura propia.
- La ventana maximiza el área de trabajo al abrirse para quitar el espacio negro restante a la derecha.

## Verificación

- Pruebas de cámaras remotas y asignación de ranuras 4–12.
- Prueba de integración FFmpeg con video y audio sintéticos: MP4 Master válido, cinco exportaciones (16:9 Facebook, 16:9 YouTube, 9:16, 1:1 y 4:5), decodificación y miniaturas JPEG.
- La verificación sintética no sustituye las pruebas físicas con teléfonos Android/iOS ni una transmisión real desde la instalación del usuario.
