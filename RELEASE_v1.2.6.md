# PodcastStudio v1.2.6

## Cámaras remotas Android e iOS

- El estudio espera la primera pista de video activa antes de mostrar la cámara remota en una ranura.
- Se corrigió la configuración de parámetros WebRTC para el bitrate y la tasa de cuadros del emisor móvil.
- Se eliminó el endpoint TURN que no resuelve en DNS y se retiró la credencial compartida del cliente.
- Se añadió `/api/turn-credentials`, que puede generar credenciales TURN temporales para un relay Coturn configurado con `TURN_URLS` y `TURN_SHARED_SECRET` en el servidor.
- Se corrigió un `await` fuera de una función asíncrona que bloqueaba el build de producción.

## Configuración del relay TURN

Para admitir redes móviles/NAT que bloquean la conexión directa, configura un servidor Coturn accesible y agrega estas variables al entorno de producción:

- `TURN_URLS`: lista separada por comas de URLs TURN/TURNS del relay.
- `TURN_SHARED_SECRET`: secreto compartido Coturn REST; se mantiene solo en el servidor.

Sin esas variables, el sistema conserva STUN para conexiones directas. Se requiere un relay TURN operativo para garantizar conexión en redes restrictivas.

## Verificación

- Build de producción Vite: aprobado.
- Sintaxis de la ruta TURN y del proceso Electron: aprobada.
- Compilación del launcher Windows: aprobada; versión de archivo/producto `1.2.6.0`.
- Prueba con dispositivos físicos Android/iOS en redes móviles: no disponible en el entorno de desarrollo.
- El DNS actual no contiene un host TURN operativo; hace falta configurar el relay y las variables de producción indicadas para garantizar conexiones detrás de NAT restrictivo.
