# LEEME — PodcastStudio v3.3.3 (frente remoto + cesión de la vista previa)

Tres correcciones: **A** — la remota ya no expulsa a la ocupante por el
cuarto camino (la re-emisión del transporte cloud); **B** — la remota
deja de verse con ojo de pez (se elige la lente estándar del teléfono y
la servida queda registrada); **C** — la vista previa del motor CEDE
ante Grabar/Transmitir (ya no bloquea la grabación). La investigación
previa vive en `fixes/INVESTIGACION-v333-remota.md` y el plan aprobado
en `fixes/plan-v333.md`.

## La regla de Luis (la que manda en este paquete)

> Una ranura con una cámara conectada está OCUPADA y BLOQUEADA.
> Ningún camino puede conectar otra cámara en ella ni expulsar a la
> ocupante. La única vía para cambiar la cámara de una ranura es la
> desconexión manual del usuario y luego la nueva conexión.

## Defecto A — el cuarto camino, citado

El transporte cloud emite «streamConnected» en CADA actualización de
pistas, no una vez por conexión: `src/utils/streamTransport.js`,
`dispatchStreamUpdate()` (línea ~177; emisión en ~210), invocado desde
`track.onunmute`, `track.onended`, la renegociación (~236–245) y el
camino de recepción (~298). El handler del estudio
(`src/App.jsx`, `cloudTransport.on('streamConnected', …)` dentro de
`setupSlot`, línea ~3528 en la base v3.3.2) ejecutaba la colocación
COMPLETA en cada emisión, claveada por la ranura de la SALA y SOLO
contra la foto de ocupación de ese instante: en una re-emisión, si la
ocupante no se veía en `slotStreamsRef`/`cameraMetaRef` (transición,
readquisición, pista sin registrar), el handler volvía a «colocar» y
pisaba la ranura — y su rama `placedSlot === 0` todavía detenía los
tracks de la cámara local. La v3.3.1 había cubierto la primera
colocación de tres caminos, pero no la re-emisión de este.

Corrección (una sola guarda, consultada por todos los caminos cloud):

- Nueva función pura `decidirColocacionRemotaCloud`
  (`src/utils/remoteCameraSlots.mjs`, junto al predicado único de
  ocupación de la v3.3.1):
  - si la sala ya tiene colocación viva ⇒ **actualizar**: la
    re-emisión solo refresca el stream EN ESA ranura; jamás reevalúa
    ocupación, jamás escribe en otra ranura, jamás detiene tracks;
  - si no hay colocación ⇒ manda `resolveRemoteCameraSlot` de la
    v3.3.1 (la explícita solo si está libre; si no, la primera libre;
    la colocación queda registrada para las re-emisiones);
  - sin libres ⇒ **rechazar**: no se conecta y se declara en la
    interfaz («sin ranuras libres: no se desconectó ninguna cámara»).
- El handler de `setupSlot` pasa entero por esa decisión; la rama que
  detenía los tracks locales en CAM 1 SALIÓ del handler (ninguna
  emisión de conexión puede parar la señal de otra fuente).
- `streamDisconnected` también respeta la guarda: limpia la ranura
  colocada SOLO si sigue ocupada por ese celular; si hoy la ocupa
  otra fuente, la desconexión de la sala no la toca.
- `handleAssignRemoteStream` (asignación manual) reutiliza por
  identidad: mismo stream o mismo dispositivo ya colocado ⇒ actualiza
  SU ranura en vez de re-colocar contra la ocupación de hoy.

Pruebas: `scripts/remote-cloud-v333.test.mjs` (8) — incluye la doble
emisión `streamConnected` de la misma sala con CAM 2 ocupada: la
ocupante queda intacta y el celular en su primera colocación, sin
segunda escritura sobre la sala; rechazo declarado sin libres;
intento directo sobre ocupada sin abordar.

## Defecto B — ojo de pez (la lente del teléfono)

Causa en código: `src/pages/RemoteCam.jsx` NUNCA elegía lente (no
había `enumerateDevices` en el archivo); `startCamera` pedía solo
`facingMode: { ideal: 'environment' }` con 720p, y con esa petición
laxa el sistema puede servir la lente ULTRA GRAN ANGULAR (0,5×) — la
que curva paredes y piso en la captura de Luis —. La etiqueta de la
lente servida no se registraba en ninguna parte.

Corrección:

- Nuevo módulo puro `src/utils/remoteCameraLens.mjs`:
  `elegirCamaraEstandar(devices, facing)` elige la cámara ESTÁNDAR
  (1×) del facing pedido por etiqueta (excluye ultra/gran angular/
  0.5/tele/zoom/macro; «wide» a secas NO se excluye: es la 1× en
  muchos teléfonos) y `esEtiquetaLenteNoEstandar` para declarar la
  que haya entrado. Sin elección segura devuelve null (no adivina:
  dos candidatas sin etiqueta de lado ⇒ null).
- `RemoteCam.jsx`: tras el permiso se enumeran los dispositivos y la
  elegida se pide por `deviceId: { exact: … }` (cascada compartida
  `pedirVideoConLente` para arranque y volteo; si el exact falla, se
  cae — declarado — a la petición por facingMode de siempre). El
  volteo usa la MISMA cascada con el facing contrario real (el cambio
  a frontal reportado roto en 2026-11-12 repetía solo el ideal).
- La lente REALMENTE servida (`track.label`) queda registrada: se
  muestra en la página del celular (con aviso «LENTE NO ESTÁNDAR» si
  entró una no estándar), viaja en el payload de presencia
  (`lensLabel`) y el estudio la lee del track recibido al asignar y
  la muestra en la etiqueta de la cámara (con «⚠ lente no estándar»
  si aplica). La aceptación en vivo pasa a ser verificable: la
  etiqueta debe decir la lente estándar.
- Presentación sin deformar (corrección diagnosticada el
  2026-11-12 y no aplicada entonces): `VideoTile` gana prop
  `objectFit` (defecto `cover`, sin cambio para locales) y el mosaico
  pasa `contain` cuando la fuente de la ranura es remota: el
  fotograma completo del teléfono, sin el recorte 4:3→16:9 que
  «acercaba» la toma. El mosaico no alimenta la composición (eso va
  por el feed de programa / el motor nativo), así que el ajuste no
  entra a la grabación.
- DECLARADO: tocar `RemoteCam.jsx` en este paquete es un cambio de
  alcance respecto a v3.3.0/v3.3.1 (allí era intocable; NO es archivo
  de BLINDAJE.md). No se tocó el transporte WebRTC/señalización/TURN.

Incertidumbre honesta: qué lente sirve Safari iOS con cada petición
solo se prueba con el iPhone de Luis en la mano; por eso la lente
servida ahora se muestra — si en vivo la etiqueta dijera la ultra,
habría que pasar a plan B con ese dato, no a ciegas.

## Defecto C — la vista previa cede ante grabar/transmitir

Reportado por Luis (captura image-135): con la vista previa del motor
abierta (fase «vista-previa»), INICIAR GRABACIÓN devolvía «Ya hay una
sesión del motor nativo en curso.» y no grababa. La vista previa es
un estado de espera, no una sesión con derechos.

Corrección en `electron/native-engine.js` — SOLO la puerta de
`start()` (línea ~1168): si lo que hay en curso es una sesión
`preview` — servida por el proceso independiente o por la tubería
integrada — y el arranque pedido es `record` o `recordStream`, el
motor la detiene PRIMERO con la maquinaria de parada de siempre
(`await stop()`, que espera el cierre real del proceso) y LUEGO
arranca: orden stop→start, cero errores, y la cesión queda declarada
en el registro. El error «Ya hay una sesión del motor nativo en
curso.» queda SOLO para conflictos reales: grabar/transmitir contra
grabar/transmitir (las subidas de los botones reales ya las reinician
desde la v3.2.2 — `scripts/native-session-upgrade.test.mjs` sigue
fijando esa mitad en el renderer) y la vista previa contra cualquier
sesión viva. Transmitir solo (`stream`) desde la vista previa sigue
rechazado como hasta hoy. Nada de geometría ni de sesiones se tocó
fuera de esa puerta.

Pruebas nuevas en `scripts/native-engine.test.mjs` (3, con los stubs
del motor): preview viva + `start(record)` ⇒ cede y graba (validación
del máster incluida); preview + `start(recordStream)` ⇒ cede y queda
grabando-transmitiendo; conflictos reales ⇒ el error textual sigue
ahí y la sesión en curso no se toca. Blindaje de transiciones: las
transiciones de sesión del motor quedan fijadas por estas pruebas
junto a las de un solo lector (v3.3.0) y las subidas (v3.2.2); los
paquetes futuros deben declarar sus chequeos de no-regresión contra
lo ya aceptado (traba de ventana, sesiones tras la compuerta,
ranuras v3.3.1).

## Archivos del paquete (12)

- `package.json` — versión 3.3.3 (83 líneas).
- `src/App.jsx` — 8807 → 8891.
- `src/utils/remoteCameraSlots.mjs` — 136 → 203.
- `src/utils/remoteCameraLens.mjs` — NUEVO, 115.
- `src/pages/RemoteCam.jsx` — 1030 → 1098.
- `electron/native-engine.js` — 1621 → 1644 (solo la puerta de start).
- `scripts/remote-cloud-v333.test.mjs` — NUEVO, 193.
- `scripts/remote-lens-v333.test.mjs` — NUEVO, 114.
- `scripts/native-engine.test.mjs` — 1750 → 1850.
- `scripts/camera-slots-v331.test.mjs` — sin cambios (319; sus
  aserciones de fuente no citaban el handler cloud).
- `BLINDAJE.md` — declaración de no-regresión de la v3.3.3 (raíz).
- `LEEME-v333.md` — este archivo (raíz).

## Blindaje — verificación (debe coincidir ANTES y DESPUÉS de aplicar)

- `src/utils/masterBroadcastEngine.js` — sha256
  `b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e`
- `electron/ventana-diag-core.js` — sha256
  `5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7`
- `electron/main.js` — sha256
  `adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488`

Los tres deben seguir byte-idénticos tras aplicar el paquete (no
están en el ZIP). Si alguno cambia, DETENERSE y reportar.

## Secuencia de publicación (sobre la v3.3.2)

0. **Base**: el HEAD debe ser el commit con mensaje **«v3.3.2:
   teleprompter — entra desde abajo, sale en cualquier modalidad y
   nunca entra a la grabación»**. Si el HEAD es otro, DETENERSE y
   reportar cuál es.
1. Aplicar los archivos del ZIP en la raíz del repo.
2. **Blindaje**: verificar los tres sha256 de arriba. Si alguno no
   coincide, DETENERSE y reportar.
3. **Conteos** con `(Get-Content <archivo>).Count`: package.json 83
   («version»: «3.3.3»), src/App.jsx 8891,
   src/utils/remoteCameraSlots.mjs 203, src/utils/remoteCameraLens.mjs
   NUEVO 115, src/pages/RemoteCam.jsx 1098, electron/native-engine.js
   1644, scripts/remote-cloud-v333.test.mjs NUEVO 193,
   scripts/remote-lens-v333.test.mjs NUEVO 114,
   scripts/native-engine.test.mjs 1850,
   scripts/camera-slots-v331.test.mjs 319 (sin cambios en este
   paquete), BLINDAJE.md actualizado, LEEME-v333.md NUEVO en la raíz.
4. **COMPUERTA** (app cerrada): `node scripts/smoke-motor.mjs` →
   debe imprimir **«SMOKE RESULTADO: PASA»**. Si NO PASA: alto total,
   no publicar y reportar la salida textual.
5. **Suite**: `node --test` (o `node --test scripts/*.test.mjs`) →
   esperado **254 = 253 pass + 0 fail + 1 skip** en Windows (la
   ambiental de ffmpeg-static es el skip; en la VM Linux de Lu da
   252 pass + 1 ambiental + 1 fallo intermitente ocasional de
   temporizadores bajo carga, documentado desde la v3.3.1: si en
   Windows una prueba del motor fallara por tiempo, se repite la
   suite una vez y se reporta el resultado de la repetición).
6. `npx vite build` en verde.
7. **Commit**: `git add -A && git commit -m "v3.3.3: frente remoto —
   la remota no expulsa a la ocupante (guarda de ocupación), lente
   estándar sin ojo de pez, y la vista previa cede ante grabar/
   transmitir" && git push origin main`. Reportar el hash.
8. **Instalador**: generar e instalar «PodcastStudio Setup
   3.3.3.exe» (reportar su tamaño exacto); después
   `npm run build:exe`; verificar paridad **lanzador 3.3.3.0 == app
   3.3.3** y commitear+push la sincronización reportando su hash.
9. Reportar sin probar. La aceptación es de Luis, en vivo.

## Aceptación en vivo (la hace Luis; define si la v3.3.3 quedó)

1. **Ocupación**: con una cámara local en CAM 2 y CAM 4 libre,
   conectar el celular por su enlace/QR → la remota debe caer en la
   primera ranura libre (CAM 4), la de CAM 2 queda intacta, y si el
   celular renegocia/reconecta NO debe moverse ni expulsar a nadie.
   Con todas las ranuras ocupadas: no se conecta y la app lo declara.
2. **Ojo de pez**: la toma del celular se ve sin la curvatura de las
   paredes/piso, y la etiqueta de la cámara en el estudio dice la
   lente servida — debe ser la estándar (si dijera «lente no
   estándar», reportarlo TAL CUAL: es el dato para el plan B).
   El botón de volteo cambia entre frontal y trasera de verdad.
3. **Cesión**: con la vista previa del motor abierta, pulsar
   INICIAR GRABACIÓN MASTER → la grabación arranca (sin el mensaje
   rojo «Ya hay una sesión del motor nativo en curso.»).
4. No-regresión: la ventana sigue sin trabarse al ir al navegador y
   volver; el teleprompter sigue entrando desde abajo.
