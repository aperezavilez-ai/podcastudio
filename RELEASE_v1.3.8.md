# PodcastStudio v1.3.8

Fecha: 5 de noviembre de 2026

## Grabación Master reparada

- El botón `INICIAR GRABACIÓN` cambia inmediatamente a `FINALIZAR Y ELEGIR FORMATOS` y muestra el contador real `HH:MM:SS`.
- El inicio ya no se cancela si el primer fragmento del navegador tarda en llegar; la grabación sólo se rechaza si el Master no tiene una pista de video válida.
- Al finalizar, el sistema espera el último fragmento y vacía la cola hacia FFmpeg antes de cerrar el MP4.
- El video Master y su miniatura se guardan automáticamente en `D:\PROGRAMAS IA\PODCASTUDIO\proyectos`, sin ocultarlos dentro de una subcarpeta.
- El Master usa la misma línea de tiempo para canvas de video y mezcla de audio, a 12 Mbps de captura y MP4 H.264/AAC de hasta 16 Mbps.

## Entregables sociales

- Al finalizar se abre el selector para Facebook 1920x1080, YouTube 1920x1080, TikTok/Reels 1080x1920 e Instagram Feed 1080x1080.
- Cada formato se genera desde el MP4 Master y se guarda junto a él en la carpeta `proyectos`.

## Validación

- `npm run test:recording`
- `npm run test:remote-cameras`
- `npm run test:stream-config`
- `npm run build`
- `npm run build:exe` — `PodcastStudio.exe` 1.3.8.0
