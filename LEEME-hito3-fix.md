# LEEME — v3.2.1: corrección del Hito 3 (fallo en vivo de la v3.2.0)

## Qué falló EN VIVO en la v3.2.0 (las 3 evidencias de Luis)

1. **La grabación y la transmisión morían al nacer.** El banner de la app:
   «El máster nativo no superó la validación: GStreamer se cerró sin orden
   de parada (código 1)… could not link queue2 to nvh264enc0». Causa: el
   constructor de la tubería (Hito 2, nunca probado en vivo) metía entre el
   compositor y el tee de programa un `d3d11convert` + un caps FORZADO
   `video/x-raw(memory:D3D11Memory),format=NV12,colorimetry=bt709`. Con
   esos caps fijados, el enlace queue→codificador no cierra y gst-launch
   muere al parsear. La tubería PROBADA del Hito 1 B — la que grabó y
   transmitió de verdad en esta misma máquina — iba directa:
   compositor → queue → tee → queue → codificador, sin convert ni caps.
2. **«AL AIRE — EN VIVO» falso.** La app encendía el letrero y el
   temporizador con el clic, sin esperar la confirmación del motor, y
   nada lo apagaba cuando el motor caía a «Fase: error»: Facebook recibía
   NADA (Live Producer en negro: «conecta el software») mientras la app
   decía estar al aire. El motor sí decía la verdad; la UI no lo miraba.
3. **El teleprompter no llegaba al programa como HUD.** Con «HUD Activo»
   se abría una VENTANA flotante con fondo de vidrio y controles propios
   («TELEPROMPTER HUD BROADCAST») encima de la cámara máster. Luis: debe
   salir SOLO EL TEXTO directamente encima de la cámara máster, sin
   ventana y sin fondo, con los controles solo en el panel lateral.

## Qué cambia en la v3.2.1 y por qué

- **electron/native-engine.js — topología probada.** Tras
  `d3d11compositor name=mix` la cadena vuelve a ser EXACTAMENTE la del
  Hito 1 B: `mix. ! queue ! tee name=tprog` (fuera el convert y el caps
  forzado). Las ramas quedan como estaban (preview, record y stream
  ≤1080 cuelgan del tee vía queue). La rama >1080 (stream con escala)
  cambia su patrón equivalente por la ruta de memoria de sistema:
  `d3d11download ! videoscale ! videoconvert ! video/x-raw,format=NV12,
  width=1920,height=1080` → codificador (caps plano que todo codificador
  acepta). No se toca nada más del motor: enumeración, audio, IPC,
  validación y API pública quedan intactos.
- **src/App.jsx — «al aire» = la fase real del motor.** El OK de
  `start()` ahora solo significa «proceso lanzado»: el arranque queda
  PENDIENTE y `isStreaming`/`isRecording` solo se encienden cuando la
  fase real del motor (transmitiendo / grabando /
  grabando-transmitiendo) se sostiene 2 s (sondeo cada 500 ms). Si la
  fase cae a «error» antes, o no se confirma en 10 s, el arranque se
  declara FALLIDO con el `lastError` del motor (en el modal y en toast)
  y la app jamás muestra «AL AIRE». Además, un VIGILANTE apaga la UI y
  avisa («La transmisión se detuvo: …» / «La grabación se detuvo: …») si
  el motor muere a mitad de sesión sin orden de parada. Las transiciones
  ordenadas (detener, subir/bajar de sesión) están marcadas y el
  vigilante no las confunde con una muerte. La vía heredada (sin
  GStreamer) no cambia.
- **src/App.jsx — HUD del teleprompter = solo texto.** El botón
  «HUD Cámara / HUD Activo» del panel ahora enciende un overlay de SOLO
  TEXTO sobre la parte superior del monitor de programa: fondo
  completamente transparente, sin ventana, sin vidrio, sin borde y sin
  controles, `pointer-events: none`, texto blanco en negrita con la
  letra del estado del panel (36 px por defecto) y sombra fuerte, bajo
  la línea «▲ Mirar aquí (lente de cámara)». La ventana flotante
  `BroadcastTeleprompter` deja de montarse (el componente queda en el
  repo sin usar aquí; la ruta iPad/LAN de main.js no se toca). El
  desplazamiento es UNA sola fuente: el mismo bucle rAF que ya movía el
  recuadro del panel mueve también el transform del overlay, y el offset
  compartido avanza aunque el overlay esté desmontado (sin desfase al
  volver a mostrarlo). El overlay es ayuda de lectura en pantalla: NO se
  quema en el máster ni sale en el stream.
- **scripts/smoke-motor.mjs — NUEVO: la compuerta que faltó.** Ver la
  sección siguiente.
- **scripts/native-engine.test.mjs** — las expectativas que afirmaban el
  caps forzado ahora afirman la forma probada, con 3 invariantes nuevos:
  entre el compositor y `tprog` solo hay una queue; ningún caps fija
  `memory:D3D11Memory` ni `colorimetry=bt709` en ninguna sesión; la
  bajada >1080 va por `d3d11download→videoscale→videoconvert` con caps
  de sistema NV12.
- **package.json** — versión 3.2.1.

## LA NUEVA COMPUERTA (obligatoria antes de publicar)

La suite en verde NO prueba que la tubería enlace en la máquina real:
la v3.2.0 murió con 118 tests en verde. Por eso, desde esta versión,
**ninguna publicación del motor nativo sale sin correr antes el smoke
en la máquina de Luis, con la app CERRADA**:

```
node scripts/smoke-motor.mjs
```

Corre las sesiones reales del motor contra la cámara real, sin
Electron: enumeración (elige la cámara por defecto del motor) →
preview 6 s vivo → record 6 s con máster VALIDADO → recordStream local
6 s con máster VALIDADO. Imprime «SMOKE <paso>: OK|FALLA» por paso y
«SMOKE RESULTADO: PASA|NO PASA» al final.

**Si el resultado no es PASA: DETENERSE, NO publicar, y reportar la
salida completa del smoke, textual.** Esta compuerta queda permanente
en el checklist de publicación de PodcastStudio.

## Instrucciones de aplicación y publicación (Antigravity)

Regla de conteo: `(Get-Content <archivo>).Count` de PowerShell debe dar
lo mismo que `wc -l` de Linux SI el archivo termina en salto de línea;
si un conteo difiere en exactamente 1, verifica el último byte del
archivo antes de detenerte (la copia de Windows usa CRLF: el tamaño en
bytes NO es el criterio, el conteo de líneas sí).

**PASO 0 — Punto de partida.** HEAD debe ser `c9f40f8` (v3.2.0 +
lanzador sincronizado). Descomprime el ZIP sobre la raíz del proyecto
(6 entradas, rutas relativas). `electron/preload.js`,
`electron/main.js` y `electron/export-args.js` NO vienen en el paquete
y NO deben aparecer modificados en `git status`.

**PASO 1 — Conteos exactos** de los archivos reemplazados/creados:

- package.json: 83 líneas (solo cambia `"version": "3.2.1"`)
- electron/native-engine.js: 969 líneas
- src/App.jsx: 8099 líneas
- scripts/native-engine.test.mjs: 853 líneas
- scripts/smoke-motor.mjs (nuevo): 191 líneas
- LEEME-hito3-fix.md (nuevo, este archivo): 151 líneas

**PASO 2 — COMPUERTA SMOKE (con la app CERRADA y sin procesos de
PodcastStudio vivos).** `node scripts/smoke-motor.mjs`. Debe terminar
con «SMOKE RESULTADO: PASA» y los 5 pasos en OK. Si no: DETENERSE,
no publicar y reportar la salida completa, textual.

**PASO 3 — Suite y build.** `node --test` → esperado **121 tests =
120 pass + 0 fail + 1 skip** (el skip conocido de
recording-pipeline/ffmpeg en esta máquina). `npx vite build` en verde
(2044 módulos aprox.; la advertencia de tamaño de chunk es conocida y
no bloquea).

**PASO 4 — Commit y push.**
`v3.2.1: corrección del Hito 3 — topología probada del motor, «al aire» atado a la fase real y HUD del teleprompter`
Push a `main`.

**PASO 5 — Instalador e instalación.** `npm run build:electron` (o el
comando habitual del proyecto) → `PodcastStudio Setup 3.2.1.exe`;
reporta su tamaño exacto en bytes e instálalo (modo silencioso /S).
Verifica que no quede ningún proceso de la app abierto.

**PASO 6 — Lanzador raíz (paso permanente, NO omitir).**
`npm run build:exe` para recompilar
`D:\PROGRAMAS IA\PODCASTUDIO\PodcastStudio.exe`.

**PASO 7 — Paridad de versiones.** Reporta las tres: versión del
lanzador raíz (debe ser **3.2.1.0**), versión de la app instalada
(**3.2.1**) y tamaño del instalador. Sin paridad, la publicación NO
está completa.

**PASO 8 — Reportar SIN probar la app.** La prueba en vivo es de Luis:
transmitir a Facebook real (que el Live Producer reciba imagen y la app
no mienta), grabar el máster, y leer el teleprompter con el HUD activo
sobre la cámara máster.
