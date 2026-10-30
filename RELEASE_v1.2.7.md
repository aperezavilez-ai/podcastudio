# PodcastStudio v1.2.7

## Corrección de cámaras móviles por QR

- Se corrigió el error de inicialización en `/remote-cam` que podía abortar el render de la página y dejar la pantalla del teléfono negra.
- `/remote-cam` y el mando se separaron en módulos de carga bajo demanda, para que el teléfono no descargue primero el código de la cabina completa; aparece un indicador mientras abre la interfaz.
- El selector móvil permite elegir CAM 2 a CAM 12.
- La autoasignación usa solamente las ranuras activas del estudio (4–12), conserva las reservas por teléfono y ya no pisa CAM 2 cuando se llena el estudio.
- Cuando no hay ranuras libres o el estudio no responde, el teléfono muestra un mensaje en vez de habilitar una conexión sin canal asignado.
- La creación y selección de ranuras no excede CAM 12.

## Verificación

- `npm run test:remote-cameras`: verifica asignaciones únicas con capacidades de 4 a 12 cámaras, capacidad llena, reintento del mismo teléfono y límite de ranuras activas.
- `RemoteCam` renderizada mediante SSR para detectar errores de inicialización durante el render.
- `npm run build`: compilación de producción Vite.
- `npm run build:exe`: compilación del launcher `PodcastStudio.exe` v1.2.7.0.
- La negociación final de video debe comprobarse en teléfonos Android/iOS físicos y en redes reales; las herramientas de este entorno no tienen cámaras móviles conectadas.
