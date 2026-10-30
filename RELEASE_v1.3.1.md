# PodcastStudio v1.3.1

## Grabación y control

- La cuenta regresiva de REC se puede cancelar desde el botón principal.
- Se añadió pausa y reanudación de la grabación. El Master sigue alimentando la transmisión cuando REC está pausado.
- Se añadió cancelar y descartar el archivo parcial, incluida la limpieza del proceso de FFmpeg.
- El contador se detiene durante la pausa.

## Master y cámaras

- El compositor conserva el último cuadro de cámara disponible al hacer un corte hasta que la nueva cámara esté lista, evitando un cuadro de «Sin señal» durante el cambio.
- El teleprompter ahora envía texto, tamaño y velocidad al compositor Master.
- Las miniaturas obedecen el control de bocina/monitor individual.

## Transmisión

- La validación separa el servidor RTMP de la clave y codifica la clave como un segmento opaco de ruta, evitando que caracteres reservados se interpreten como fragmento o consulta.

## Verificación

- Build web y sintaxis de Electron.
- Grabación MP4 y exportación a cuatro relaciones de aspecto: 1/1.
- Asignación de cámaras remotas 1–12 y capacidades de 4–12 cámaras: 4/4.
- Configuración de destinos RTMP: 5/5.
- La conexión real a Facebook, la sincronía con Android/iOS, la latencia sostenida y el hardware de estudio requieren validación con los equipos y credenciales del usuario.
