# PodcastStudio v1.3.2

## Arranque y rendimiento

- **Eliminación de bloqueo en arranque**: 
  - Se sustituyó la carga diferida con `lazy()` por importación estática directa en `src/main.jsx`, eliminando la pantalla negra/Suspense intermedia.
  - Sincronización exacta del splash screen con `app-ui-ready` emitido tras el primer montaje del DOM de React.
  - Cierre y limpieza de ciclo de vida en `electron/main.js`: `mainWindow.on('closed')`, `app.on('window-all-closed')` y `before-quit` para evitar procesos zombie de Electron que retenían el single-instance lock y causaban que la app tardara 3 minutos o no abriera.
  - Tolerancia a colisiones de puerto: Detección de puerto 3000 ocupado (Docker/WSL) con fallback dinámico y transparente a puerto 3002.
  - Conexión escalonada de canales en `App.jsx`: Ranuras 1 a 4 conectan inmediatamente al inicio y ranuras 5 a 12 de forma diferida, eliminando saturación inicial de WebSockets y desbloqueando el arranque.

## Conexión de cámaras y WebRTC

- **Pestaña Móvil / Remota QR y Preview**: Corrección de unidad en `jitterBufferTarget` (50 ms) y `playoutDelayHint` (0.05 s) en `streamTransport.js`. Esto soluciona la falla donde la cámara remota decía conectada pero el recuadro de video quedaba en negro sin decodificar cuadros.
- **Handshake ultrarrápido sin retrasos**: Uso directo de servidores STUN de Google y Cloudflare en `rtcConfig.js` (<100 ms de negociación ICE), eliminando servidores TURN públicos sobrecargados que demoraban la conexión por más de 30 segundos.
- **Adaptación suave de calidad en celular**: Calibración de umbrales RTT en `RemoteCam.jsx` para evitar degradaciones y reconexiones espurias durante el arranque de la cámara en dispositivos iOS y Android.
- **Validación robusta de slots**: Función `clampSlotIndex` en `remoteCameraSlots.mjs` que previene excepciones por índices fuera de rango al reconectar cámaras en caliente.

## Verificación de calidad

- Pruebas automatizadas ejecutadas y superadas al 100%:
  - Asignación y slots de cámaras remotas: 4/4 (`test:remote-cameras`).
  - Pipeline de grabación y exportación a distintas relaciones de aspecto: 1/1 (`test:recording`).
  - Configuración y validación de destinos de streaming RTMP: 5/5 (`test:stream-config`).
- Compilación de producción con Vite superada exitosamente.
- Binario nativo `PodcastStudio.exe` compilado y actualizado a versión 1.3.2.0.
