# LEEME — v3.2.3: el motor abre la cámara por índice (forma probada)

Incluye las correcciones v3.2.1 y v3.2.2 (ya pegadas en el árbol, sin commitear):
esta es la ÚNICA publicación. Antes de ella manda la compuerta de humo.

## La evidencia (dos corridas del smoke en la máquina de Luis)

La compuerta `node scripts/smoke-motor.mjs` se corrió DOS veces (la segunda con
la cámara comprobadamente libre: sin Chrome, sin app Cámara, sin procesos
huérfanos). Las dos terminaron en «SMOKE RESULTADO: NO PASA» con el mismo
cuadro:

- Herramientas GStreamer: OK. Enumeración: OK (Steren COM-126 a 1920×1080@30
  NV12). Las tuberías enlazan SIN error: la topología restaurada de la v3.2.1
  está sana (el `could not link queue2 to nvh264enc0` de la v3.2.0 no volvió).
- Las 3 sesiones (preview, record, recordStream) murieron a los ~2 s en la
  FUENTE, antes de grabar un solo byte:

      ERROR mfvideosrc gstmfvideosrc.cpp:288:gst_mf_video_src_start:<mfvideosrc0> Couldn't create capture object
      Failed to start — ERROR: pipeline doesn't want to preroll.
      GStreamer se cerró sin orden de parada (código 4294967295).

La hipótesis «cámara ocupada» quedó descartada por el reintento limpio: no era
eso. La fuente no puede CREAR el objeto de captura al abrir por la ruta que el
motor le pasa.

## La causa

El motor hospedado abría la cámara con `mfvideosrc device-path=<la ruta del
monitor>` (buildPipelineArgs prefería device-path siempre que existiera). Esa
forma NUNCA se había probado en vivo: la enumeración por el monitor funciona,
pero la ACTIVACIÓN por ruta muere en `gst_mf_video_src_start`.

La forma que SÍ funcionó en esta misma máquina es la de la Prueba B del Hito 1
(`02-motor-gst.ps1`): `mfvideosrc device-index=0` — con ella la Steren grabó y
transmitió válido.

Había además un segundo error latente: el `deviceIndex` que el parser
asignaba era la posición GLOBAL entre todas las entradas del monitor (KS y
MF mezcladas). En la enumeración real de esta máquina (EasyCamera-KS,
Steren-KS, Steren-MF, EasyCamera-MF) la Steren MF quedaba con índice 2, que
para MediaFoundation es OTRO dispositivo: aunque se hubiera usado el índice,
habría sido el equivocado.

## El arreglo (solo electron/native-engine.js + sus pruebas)

1. **Numeración corregida**: el parser asigna a cada fuente de vídeo
   MediaFoundation (clase «Source/Video») su posición 0-based DENTRO de su
   clase, en el orden del monitor. En la máquina de Luis: Steren MF = 0 (el
   índice probado del Hito 1 B), EasyCamera MF = 1. Las entradas KS llevan
   `deviceIndex: null`.
2. **Índice como forma principal**: buildPipelineArgs emite
   `device-index=<n>` siempre que el dispositivo trae índice MF válido;
   `device-path=` solo se usa cuando NO hay índice. El estado del motor
   expone `addressingMode: 'device-index' | 'device-path'` y el registro
   declara cuándo se usa el respaldo.
3. **Reintento único declarado**: si una sesión muere al nacer (≤ 4 s) con la
   firma exacta «Couldn't create capture object» y existe el modo alterno,
   el motor relanza la sesión UNA vez con el otro modo, dejando constancia
   en el registro («La apertura por <modo> falló; reintentando con <otro
   modo>…») y en el estado. Otra firma de error no dispara reintento, y si
   el reintento también muere, sigue el camino de error normal.
4. La topología de la tubería, App.jsx y `scripts/smoke-motor.mjs` NO se
   tocan: la compuerta ejercita el motor real tal cual quedó.

## Secuencia de aplicación y publicación (única)

Reglas: ante cualquier dato que no cuadre, DETENTE y reporta el dato exacto;
no improvises. Si el PASO 2 no pasa, NO publiques.

PASO 0 — Base y reemplazos: el HEAD debe ser `c9f40f8`. El árbol ya trae
pegados a mano los archivos de la v3.2.1 y la v3.2.2 sin commitear;
descomprime este paquete (podcastudio-v323-fix.zip) en la raíz del repo y
reemplaza SOLO estos archivos: `package.json`, `electron/native-engine.js`,
`scripts/native-engine.test.mjs` y crea `LEEME-v323.md` (raíz).
`src/App.jsx` debe medir 8166 y NO se toca en este paquete.

PASO 1 — Conteos del árbol completo, con `(Get-Content <archivo>).Count`:
package.json 83 (solo cambia "version": "3.2.3") · electron/native-engine.js
1059 · scripts/native-engine.test.mjs 1044 · src/App.jsx 8166 ·
scripts/smoke-motor.mjs 191 · scripts/native-session-upgrade.test.mjs 98 ·
LEEME-hito3-fix.md 151 · LEEME-v322.md 103 · LEEME-v323.md 118 (el de este
paquete). electron/main.js, electron/preload.js y
electron/export-args.js NO deben aparecer modificados en git status.

PASO 2 — COMPUERTA DE HUMO (obligatoria, antes de publicar): cierra la app
por completo (ningún proceso de PodcastStudio vivo) y desde la raíz del
repo corre: `node scripts/smoke-motor.mjs`. Debe terminar en
«SMOKE RESULTADO: PASA». Si NO pasa, DETENTE: no commitees ni publiques
nada y reporta la salida COMPLETA del script, textual.

PASO 3 — Suite y build: `node --test` → esperado 134 = 133 pass + 0 fail +
1 skip (el skip es la prueba de integración RTMP local, como siempre).
`npx vite build` en verde.

PASO 4 — Publicación: commit con el mensaje exacto «v3.2.3: el motor abre
la cámara por índice (forma probada) — incluye las correcciones v3.2.1 y
v3.2.2», push a main, genera el instalador, reporta el tamaño exacto de
«PodcastStudio Setup 3.2.3.exe» e instálalo.

PASO 5 — Lanzador raíz (obligatorio): `npm run build:exe` y verifica que
`D:\PROGRAMAS IA\PODCASTUDIO\PodcastStudio.exe` quede en versión de archivo
3.2.3.0, igual a la versión de la app instalada (3.2.3). Commitea la
sincronización del lanzador con el mensaje «build: sync PodcastStudio.exe
launcher to v3.2.3.0» y push.

PASO 6 — Reporta: HEAD antes y después, conteos, la salida del smoke paso
por paso y su línea final, totales de la suite, tamaño del instalador,
versión del lanzador y de la app instalada. NO pruebes la app: la prueba en
vivo la hace Luis.

## Sin verificar (solo la máquina de Luis lo prueba)

- Que el smoke pase con la apertura por índice (es la compuerta: por eso va
  antes de publicar, no después).
- El handshake RTMPS contra Facebook/YouTube reales con la sesión abierta
  por índice, y el comportamiento en vivo del reintento declarado si la
  apertura principal fallara en la app ya instalada.
