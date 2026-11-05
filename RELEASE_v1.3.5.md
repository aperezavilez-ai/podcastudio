# PodcastStudio v1.3.5

## Estabilidad multicámara, Master y grabación

Esta versión corrige la degradación de respuesta observada al conectar varias
cámaras USB y termina el flujo de Master para audio, grabación y transmisión.

### Cambios incluidos

- El conmutador de cámaras USB deja de reactivar las pistas de hardware cada
  300 ms. Esto evita renegociaciones UVC que congelaban botones y vistas previas.
- La negociación de vídeo prefiere hasta 1920 × 1080 a 30 fps cuando la cámara
  lo soporta, sin forzar 60 fps ni límites incompatibles que bloqueen un hub USB.
- Audio-follow-video real: sólo la cámara activa en Program/Master llega a la
  mezcla Master; las demás permanecen silenciadas sin deshabilitar el hardware.
- Se reparó la cola de segmentos entre MediaRecorder, Electron y FFmpeg para
  que REC sólo inicie con una cabecera válida y espere el último segmento al parar.
- Se añadieron looks Sepia Film y Cinematográfico, aplicados en el compositor
  Master. Se eliminó el desenfoque que simulaba reducción de ruido y reducía
  detalle de la señal 1080p.
- El monitor LAN/iPad se limita a una vista de control de 960 × 540 / 3 fps.
  El encoder de grabación y RTMP sigue siendo el Master 1080p30 independiente;
  esta separación evita que el monitor bloquee la interfaz.
- Las claves RTMPS se validan y codifican correctamente para la transmisión a
  Facebook y otros destinos.

### Verificación

- `npm run build`
- `npm run test:recording`
- `npm run test:remote-cameras`
- `npm run test:stream-config`
- `npm run build:exe` — `PodcastStudio.exe` 1.3.5.0

### Distribución

- Commit y push a `main`.
- Release de GitHub `v1.3.5` con `PodcastStudio.exe` adjunto.
- Despliegue de producción Vercel desde el mismo commit.
