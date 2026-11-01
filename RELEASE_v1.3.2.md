# PodcastStudio v1.3.2

## Arranque y rendimiento

- **Eliminación de bloqueo en arranque**: 
  - Se sustituyó la carga diferida con `lazy()` por importación estática directa en `src/main.jsx`, eliminando la pantalla negra/Suspense intermedia.
  - Sincronización exacta del splash screen con `app-ui-ready` emitido tras el primer montaje del DOM de React.
  - Cierre y limpieza de ciclo de vida en `electron/main.js`: `mainWindow.on('closed')`, `app.on('window-all-closed')` y `before-quit` para evitar procesos zombie de Electron que retenían el single-instance lock y causaban que la app tardara 3 minutos o no abriera.
  - Tolerancia a colisiones de puerto: Detección de puerto 3000 ocupado (Docker/WSL) con fallback dinámico y transparente a puerto 3002.
  - Conexión escalonada de canales en `App.jsx`: Ranuras 1 a 4 conectan inmediatamente al inicio y ranuras 5 a 12 de forma diferida, eliminando saturación inicial de WebSockets y desbloqueando el arranque.

## Conexión de cámaras y WebRTC

- **Pestaña Móvil / Remota QR y Preview**: Conexión HTTPS segura predeterminada (`https://www.podcastudio.mx/remote-cam`), eliminando bloqueos de seguridad de Safari en iPhone y Chrome en Android. Parámetros de emisión calibrados a 4.5 Mbps con política `maintain-resolution` para video continuo sin pixelación por movimiento.
- **Grabación Master Instantánea sin Congelamiento**:
  - Eliminada la serialización pesada de `Array.from()` en el paso de la cabecera EBML a través del puente IPC de Electron, reemplazándola por transferencia directa en búfer tipado zero-copy.
  - Corrección de condición de carrera en la alimentación de chunks: los fragmentos sólo se envían a FFmpeg una vez inicializada la grabación, eliminando la escritura duplicada de la cabecera que abortaba el proceso de grabación en disco.
- **Rendimiento de Cámara Local (Webcam CAM 1)**:
  - Activada aceleración de rasterizado por GPU (`enable-gpu-rasterization`, `enable-zero-copy`) y captura directa por hardware con `MediaFoundationVideoCapture`.
  - Restricciones de captura con resolución mínima garantizada (1280x720 / 1920x1080) para evitar que Windows degrade la webcam a 640x480 VGA.
- **Rotación Automática de Cintillos TV**:
  - Reestructurado el ciclo de rotación en `useCintilloRotation.js` para alternar secuencialmente uno por uno (Tema, Conductor, Invitado, Redes Sociales, Contacto) sin detenerse.
  - Sincronización completa de fases de transición (`enter` -> `hold` -> `exit`) con duraciones de guardas limpias de estilo broadcast.

## Verificación de calidad

- Pruebas automatizadas ejecutadas y superadas al 100%:
  - Asignación y slots de cámaras remotas: 4/4 (`test:remote-cameras`).
  - Pipeline de grabación y exportación a distintas relaciones de aspecto: 1/1 (`test:recording`).
  - Configuración y validación de destinos de streaming RTMP: 5/5 (`test:stream-config`).
- Compilación de producción con Vite superada exitosamente.
- Binario nativo `PodcastStudio.exe` compilado y actualizado a versión 1.3.2.0.
