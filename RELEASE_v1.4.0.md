# PodcastStudio v1.4.0

Fecha: 8 de noviembre de 2026

## Novedades y Mejoras Principales

### 1. Arranque Ultrarrápido (<3 segundos)
- **Eliminación de Bloqueos por Procesos Huérfanos:** Limpieza instantánea y no bloqueante (<10ms) de instancias residuales de `PodcastStudio`, `electron` y `ffmpeg` en el arranque.
- **Sincronización Reactiva con Señal de Listo:** Detección instantánea de `podcaststudio_ready.signal` emitida por Electron para cerrar la pantalla de inicio y enfocar la ventana principal sin esperas artificiales.
- **Cero Tiempos Muertos:** Ventana principal visible y lista de inmediato tras el montaje de la interfaz React.

### 2. Conexión de Cámaras USB, WiFi y Móviles (Hasta 12 Canales)
- **Negociación Adaptativa Directa:** Se eliminó el bucle de reintentos concurrentes que cancelaba y bloqueaba drivers UVC en Windows (`NotReadableError`). Solicitud adaptativa única (ideal 1080p, mín 320x240) con tiempo de espera seguro de 6s.
- **Asignación Automática de Ranura Libre:** Cuando CAM 1 está activa, el modal de conexión y el botón *"Configurar Entrada de Video"* apuntan automáticamente a la siguiente ranura libre (**CAM 2**).
- **Progresión Inteligente:** Al conectar exitosamente una cámara, el selector avanza automáticamente a la siguiente ranura libre (**CAM 3**, **CAM 4**, hasta **CAM 12**) permitiendo configurar múltiples cámaras con un solo clic.
- **Expansión Dinámica:** Si se asigna un canal superior al número visible, el switcher añade y renderiza la ranura inmediatamente.

### 3. Grabación Master MP4 e Integridad de Archivos
- **Compositor Master 1080p Continuo:** Prevención de suspensión de decodificadores de Chromium en segundo plano; cero cuadros negros en Program y grabación.
- **Cierre Limpio de Contenedor MP4:** Finalización atómica con `+faststart` que garantiza que el archivo siempre quede reproducible sin corrupción.
- **Almacenamiento Centralizado:** Todos los videos, miniaturas y formatos sociales se almacenan de forma exclusiva en `proyectos/[NombreDelProyecto]/`.

### 4. Audio en Vivo y Exportador Multi-Formato
- **Reactivación Inmediata de AudioContext:** Desbloqueo síncrono del contexto de audio en cada interacción del usuario para música de fondo (BGM) y efectos de sonido (SFX).
- **Exportador Multi-Formato Sin Descargas No Solicitadas:** Descarga individual bajo demanda o en pack completo, con opción de reinicio limpio para nuevos proyectos en un solo clic.

---

## Validación y Pruebas
- `npm run test:recording` (100% aprobado)
- `npm run test:remote-cameras` (100% aprobado)
- `npm run test:stream-config` (100% aprobado)
- `npm run build` (Bundle de producción generado)
- `npm run build:exe` (Ejecutable nativo v1.4.0.0 generado)
