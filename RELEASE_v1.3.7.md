# PodcastStudio v1.3.7

## Hotfix de estabilidad al añadir cámaras y volver a la aplicación

- Al agregar una cámara, el configurador selecciona una ranura libre en lugar
  de detener o reemplazar la cámara que está en Program.
- La capa de conexión rechaza reemplazos implícitos y mover una cámara USB viva
  entre ranuras; primero debe desconectarse de forma explícita.
- Se redujo el tiempo máximo de cada intento UVC a 2.2 segundos y se eliminó
  el bloque que detenía pistas de la ranura desde el manejador de clics.
- Las vistas de vídeo reanudan su elemento visual al recuperar el foco de
  PodcastStudio. La pista USB se conserva: no se deshabilita ni renegocia.

## Verificación

- `npm run build`
- `npm run test:recording`
- `npm run test:remote-cameras`
- `npm run test:stream-config`
- `npm run build:exe` — `PodcastStudio.exe` 1.3.7.0
