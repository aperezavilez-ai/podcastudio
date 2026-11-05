# PodcastStudio v1.3.6

## Hotfix de señal USB Full HD

- Se elimina la renegociación posterior a `getUserMedia`; el modo que abre la
  cámara ya no se cambia en segundo plano.
- Las entradas USB solicitan 1920 × 1080 de forma exacta antes de ofrecer un
  fallback explícito a 1280 × 720. Esto impide aceptar silenciosamente un
  perfil 640p del controlador UVC.
- PodcastStudio deja de abrir una webcam predeterminada distinta de la elegida
  por el operador. CAM 1 memoriza únicamente la fuente Master seleccionada
  expresamente en el configurador.
- Las calibraciones heredadas no aplican filtros, LUT ni ajustes de color al
  Master hasta que el operador realiza una corrección y la guarda de nuevo.
- La barra de calidad y la vista de conexión muestran la resolución y fps
  negociados realmente por la pista de vídeo; ya no anuncian 1080p fijo.

## Verificación

- `npm run build`
- `npm run test:recording`
- `npm run test:remote-cameras`
- `npm run test:stream-config`
- `npm run build:exe` — `PodcastStudio.exe` 1.3.6.0
