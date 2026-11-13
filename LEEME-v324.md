# PodcastStudio v3.2.4 — la ventana deja de trabarse al cambiar de foco y el teleprompter se lee sobre el programa

Corrección sobre la v3.2.3 (HEAD esperado: `1f54485`). Dos reportes en vivo de
Luis, atacados en su raíz. El diagnóstico completo va en
`fixes/diag-v324.md` del paquete de revisión; aquí va el resumen y la
secuencia de publicación.

## Qué fallaba y qué cambia

### 1. La ventana se trababa al volver del navegador (R1)

El bucle de composición del programa lo mueve un Web Worker que postea un
tick cada ~33 ms PARA SIEMPRE (los timers de Worker no se estrangulan con la
visibilidad, y los switches anti-oclusión de `main.js` hacen que la ventana
cubierta se trate como visible). El manejador componía una imagen 1080p
completa por CADA mensaje: si el hilo principal no drenaba la cola al mismo
ritmo (Luis en Chrome, el SO despriorizando la app), los ticks se acumulaban
y al volver había que ejecutar TODAS las composiciones atrasadas antes de
atender un clic. Minutos fuera = miles de composiciones pendientes = ventana
trabada, proporcional al tiempo fuera.

**Arreglo — gobernador de foco/visibilidad** (`src/utils/masterBroadcastEngine.js`):

- La decisión de componer pasa a ser por marcas de tiempo (funciones puras
  `compositionMode` / `compositionTickDecision`).
- Ventana visible y con foco, o con SALIDA de canvas en curso (grabando o
  transmitiendo con el motor de ventana): ritmo completo, como siempre.
- Ventana oculta o sin foco y sin salida de canvas: máximo 1 composición
  cada 500 ms; el resto de ticks se descarta SIN trabajo (descartar es
  instantáneo: la cola atrasada se drena sin reproducir ni una composición
  de más).
- Al recuperar foco/visibilidad la marca se reinicia: el primer tick compone
  al instante y no existe atraso que reproducir. Reanudación limpia.
- El mismo portón cubre el bucle rAF de respaldo, y el medidor de micrófono
  de `App.jsx` deja de analizar/publicar con la página oculta.
- **El motor nativo es un proceso aparte y NO se toca**: sigue grabando y
  transmitiendo igual con la ventana sin foco; este gobernador solo manda
  sobre la composición DENTRO de la ventana (monitor y mosaicos).

### 2. El teleprompter no se veía sobre el programa (R2)

El overlay de la v3.2.1 existía, pero su offset nacía de `window.innerHeight`
(la ventana entera) aplicado a una franja del 48 % del monitor, y decrecía
sin suelo ni resincronización: si el HUD se encendía DESPUÉS de pulsar
INICIAR (el orden natural), el texto ya había cruzado la franja y no se veía
nunca; cargar el guion (flujo normal) lo dejaba a ~1000 px, tardando hasta
~18 s en entrar en la franja a baja velocidad.

**Arreglo — un solo reloj, dos proyecciones** (`src/App.jsx`):

- `teleprompterYRef` es ahora el desplazamiento canónico del guion
  (píxeles recorridos, crece) y lo avanza el único bucle rAF reproduzca lo
  que esté montado o no.
- El panel proyecta `scrollTop = desplazamiento` (con resincronización si
  Luis mueve la caja a mano: su posición manda y vuelve al reloj).
- El HUD proyecta `translateY = altura real de la franja − desplazamiento`,
  topado a −altura del texto: el texto entra en la franja en el mismo
  instante en que el panel empieza a subir, pulse Luis INICIAR y «HUD
  Cámara» en el orden que sea.
- Todos los resets (cargar .docx/.txt, reiniciar, limpiar) dejan el reloj a
  0. Sin ventana, sin fondo: solo el texto sobre la cámara máster, controles
  en el panel, como se especificó.

### 3. La «flechita» de la lista lateral (R3) — SIN cambio, con evidencia

La flecha de colapso de la barra derecha (ChevronLeft/ChevronRight sobre
«Estudio Broadcast», junto a la X) está en la v3.2.3 EXACTAMENTE igual que
en la v3.1.0 (mismo bloque, verificado contra GitHub): no se perdió en
ninguna versión y no se inventa UI. Solo desaparece si se cierra la barra
entera con la X; se recupera con «Mostrar Panel» en la barra superior.

## Archivos del paquete

- `package.json` — 83 → 83 (solo cambia la versión a 3.2.4).
- `src/utils/masterBroadcastEngine.js` — 2428 → 2521 (gobernador +
  decisión de ticks).
- `src/App.jsx` — 8166 → 8218 (reloj único del teleprompter + medidor
  gobernado).
- `scripts/focus-governor.test.mjs` — NUEVO, 190 líneas, 17 pruebas.
- `LEEME-v324.md` — NUEVO, este archivo.

INTOCABLES (verificar en git status): `electron/native-engine.js` (1059),
`electron/main.js` (3265), `electron/preload.js`, `electron/export-args.js`,
la ruta remota (`RemoteCam.jsx`, `remoteCameraSlots.mjs`,
`MultiGuestRoomModal.jsx`).

## Secuencia de publicación (Antigravity)

PASO 0 — Base: el HEAD debe ser `1f54485`. Reemplaza/crea SOLO los archivos
del paquete. Conteos con `(Get-Content <archivo>).Count`: package.json 83,
src/App.jsx 8218, src/utils/masterBroadcastEngine.js 2521,
scripts/focus-governor.test.mjs 190 (nuevo), LEEME-v324.md 123 (nuevo). Los
intocables NO deben aparecer en git status.

PASO 1 — COMPUERTA DE HUMO: con la app cerrada por completo, desde la raíz
del repo: `node scripts/smoke-motor.mjs`. Si la salida final NO es «SMOKE
RESULTADO: PASA», DETENTE: no publiques y reporta la salida textual
completa.

PASO 2 — Suite: `node --test scripts/*.test.mjs` → esperado 151 tests =
150 pass + 0 fail + 1 skip (el skip conocido de FFmpeg de sistema en la
prueba RTMP local). Build: `npx vite build` en verde.

PASO 3 — Publicación: commit exacto «v3.2.4: la ventana deja de trabarse al
cambiar de foco y el teleprompter se lee sobre el programa», push a main,
genera el instalador, reporta el tamaño exacto de «PodcastStudio Setup
3.2.4.exe» e instálalo.

PASO 4 — Lanzador raíz (obligatorio): `npm run build:exe`; verifica que
`D:\PROGRAMAS IA\PODCASTUDIO\PodcastStudio.exe` quede en versión de archivo
3.2.4.0, igual a la app instalada (3.2.4). Commitea la sincronización del
lanzador («build: sync PodcastStudio.exe launcher to v3.2.4.0») y push.

PASO 5 — Reporta: HEAD antes/después, conteos, línea final del smoke,
totales de la suite, tamaño del instalador, versión del lanzador y de la app
instalada. NO pruebes la app: la prueba en vivo la hace Luis.

## Sin verificar (solo la máquina de Luis lo prueba)

- Que el atasco al volver del navegador desaparezca en su Windows real (el
  mecanismo está demostrado en código; su magnitud depende de su máquina).
- El HUD del teleprompter en su pantalla, con su guion y su orden de clics.
- Todo lo vivo pendiente de baterías anteriores (handshake RTMPS, etc.).
