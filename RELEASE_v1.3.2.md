# PodcastStudio v1.3.2

## Arranque y rendimiento

- **Eliminación de bloqueo en arranque**: Se sustituyó la carga diferida con `lazy()` por importación estática directa en `src/main.jsx`, eliminando la pantalla negra/Suspense intermedia.
- **Sincronización de Splash Screen**: La ventana de carga en `electron/main.js` y `launcher.cs` se cierra únicamente tras la confirmación de montaje del DOM (`app-ui-ready`), entregando la interfaz de usuario lista y responsiva de inmediato.

## Conexión de cámaras y control

- **Pestaña Móvil / Remota QR**: Corrección del error de referencia de estado (`copiedSlotNumber`) en `CameraConnectModal.jsx` que impedía visualizar y copiar enlaces o códigos QR para cámaras remotas.
- **Validación robusta de slots**: Función `clampSlotIndex` en `remoteCameraSlots.mjs` que previene excepciones por índices fuera de rango al reconectar cámaras en caliente.

## Streaming y WebRTC

- **Sincronía y Estabilización A/V**: Buffer de jitter configurado en 60 ms en `streamTransport.js` para absorber micro-variaciones de red sin generar retardo acumulado ni desincronización de audio y video.
- **Adaptación dinámica de calidad**: En `RemoteCam.jsx`, el algoritmo de adaptación ahora monitorea tasa de pérdida de paquetes (`packetLoss`) y limitaciones de ancho de banda para conmutar niveles de resolución y bitrate suavemente.
- **Motor de emisión RTMP**: Ajuste en `media-engine/index.js` para optimización de buffer RTMP (`-rtmp_buffer 100`) y control estricto de interleaving para streaming en vivo.

## Verificación de calidad

- Pruebas automatizadas ejecutadas y superadas:
  - Asignación y slots de cámaras remotas: 4/4 (`test:remote-cameras`).
  - Pipeline de grabación y exportación a distintas relaciones de aspecto: 1/1 (`test:recording`).
  - Configuración y validación de destinos de streaming RTMP: 5/5 (`test:stream-config`).
- Compilación de producción con Vite superada exitosamente.
- Binario `PodcastStudio.exe` compilado y actualizado a versión 1.3.2.0.
