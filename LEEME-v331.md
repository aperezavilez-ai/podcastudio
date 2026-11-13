# PodcastStudio v3.3.1 — ranuras de cámara y programa

Arregla los PROCESOS de ranuras que Luis reportó en vivo sobre la v3.3.0
(aceptada: la ventana ya no se traba) y blinda lo que ya funciona. No
toca el transporte remoto (WebRTC/señalización/TURN, confirmado por
Luis), ni destinos/exportación, ni la geometría ni las sesiones del
motor (solo su emparejamiento de nombres y la negativa de programa).

## BLINDAJE (nuevo: BLINDAJE.md en la raíz)

Por orden de Luis («ya no rompas eso que funciona, blíndalo»), quedan
CONGELADOS, byte-idénticos a la v3.3.0 (verificado con SHA-256 antes y
después de esta construcción):

- `src/utils/masterBroadcastEngine.js` (dieta de ventana + gobernador
  de foco: la cura de la traba) — sha256 `b270214b…58e`, 2577 líneas.
- `electron/ventana-diag-core.js` — sha256 `5e94cd54…7e7`, 59 líneas.
- `electron/main.js` (ganchos del instrumento) — sha256 `adc3d932…488`,
  3356 líneas.
- Las regiones del instrumento ventana-diag dentro de `src/App.jsx`
  (ping, `[foco]`, `[muestra]`, `[prompter]`, `setNativeWindowDiet`):
  el diff de App.jsx de esta versión se revisó región por región y no
  las toca.

Regla permanente (en BLINDAJE.md): tocar algo congelado exige suite
completa + compuerta + aceptación en vivo de nuevo, declarado en el
paquete que lo toque.

## Defecto 1 — la remota ya no expulsa a la ocupante

Evidencia: al conectar el celular, la remota se colocaba sola en CAM 2
desconectando la cámara que estaba ahí. Había TRES caminos que pisaban
la ranura sin mirar la ocupación:

- `assignSlotOnce` (oferta WebRTC del celular): la ranura que traía la
  oferta se honraba sin comprobar nada.
- El receptor cloud por salas (`setupSlot`): escribía directo sobre la
  ranura de la sala; en CAM 1 hasta detenía los tracks de la cámara
  local.
- `handleAssignRemoteStream` (cámaras descubiertas del modal):
  detenía los tracks de la ocupante y sobrescribía la ranura.

Regla aplicada en los tres: la ranura pedida es una PETICIÓN — manda
solo si está libre (predicado único de ocupación en
`remoteCameraSlots.mjs`: señal, metadatos, reserva del despacho o la
señal local en CAM 1); si está ocupada, la remota va a la **primera
ranura libre** y la interfaz lo muestra (estado del celular / toast);
sin ranuras libres no se asigna y nadie es expulsado. La desconexión
cloud limpia la ranura donde el stream quedó colocado de verdad.

## Defecto 2 — la reconexión ya no manda la cámara a otra ranura

Evidencia: Luis desconectó CAM 2, abrió el modal con «Destino
seleccionado: CAM 2» y la EasyCamera quedó en CAM 4. La causa estaba
en `CameraConnectModal.handleConnectUsb`: si la ranura pedida «tenía
otra fuente», el modal reubicaba la cámara EN SILENCIO a su
`nextFreeSlot` (cuyo escaneo contaba cualquier metadato como
ocupación, así que saltaba hasta CAM 4).

Reglas aplicadas:

- (a) El destino seleccionado en el modal MANDA: el override silencioso
  desapareció; la apertura va a la ranura pedida y, si está ocupada
  por otra fuente, App la rechaza con el motivo visible («CAM N ya
  está en uso. Desconéctala primero o selecciona una ranura libre.»)
  en vez de mover la cámara a escondidas.
- (b) Una cámara conocida recupera SU ranura anterior si está libre:
  el historial guardado ahora registra la ranura de cada conexión y
  `handleReconnectSavedCamera` usa `chooseReconnectCameraSlot`
  (anterior libre → esa; si no → primera libre).
- (c) Nada de asignar a la última/mayor ranura por defecto.

## Defecto 3 — el motor empareja el nombre con sufijo VID:PID

Evidencia (captura de Luis): al transmitir, el motor respondió «No se
encontró la cámara de programa "EasyCamera (04f2:b57e)" entre las
enumeradas por Media Foundation» — la enumeración la conoce como
«EasyCamera» a secas, y el `includes` de siempre no emparejaba nunca
un nombre pedido más largo que el enumerado.

Corrección (solo el emparejamiento, en `electron/native-engine.js`):
`normalizarNombreCamara` quita el sufijo «(xxxx:xxxx)», unifica
espacios y minúsculas; `nombresCamaraCoinciden` compara ya normalizado
(igualdad o contención en cualquier sentido). Lo usan el resolvedor
multicámara y `chooseDevice`. Si tras normalizar emparejan varias
entradas, manda la de Media Foundation y la ambigüedad queda declarada
en el registro del motor.

## Defecto 4 — la sesión nativa sale de la cámara de PROGRAMA

Orden de Luis: la transmisión/grabación debe salir DESDE LA CÁMARA
MASTER — la que lleva el tally PGM. La v3.3.0 componía «la activa
primero» sobre las elegibles: si la de programa no pasaba un filtro en
ese instante, la primera elegible ocupaba su lugar EN SILENCIO (así
salió la EasyCamera como programa).

- (a) La composición vive ahora en la función pura
  `componerFuentesPrograma` (`src/utils/nativeProgramSources.mjs`):
  sources[0] es SIEMPRE la cámara del tally PGM (activeCam; por
  defecto CAM 1) y las demás entran como PiP en orden de ranura
  (máx. 3). Las cámaras liberadas al motor durante una sesión cuentan
  como elegibles con su etiqueta guardada, para que las subidas y los
  reinicios compongan igual que el arranque en frío. Los cuatro
  arranques (grabar, transmitir y los dos reinicios de bajada) usan la
  misma preparación (`prepararFuentesSesionNativa`): con 2+ fuentes,
  `sources` + programIndex 0; con una sola, su nombre EXPLÍCITO en
  `cameraName`.
- (b) Si la de programa no está disponible, NO se arranca ni se
  sustituye: en la app, la preparación se detiene ANTES (sin tocar la
  sesión en curso) con el motivo en la banda del motor; en el motor,
  si el nombre de programa no empareja con la enumeración MF tras la
  normalización, el arranque se niega con código
  `PROGRAMA_NO_DISPONIBLE`, la fase vuelve a «apagado» (no queda en
  «error»: la sesión nunca arrancó) y el motivo queda en
  `state.programUnavailable` y en el registro. La sustitución
  silenciosa de `chooseDevice` («se usa la primera enumerada») murió:
  sin nombre pedido manda la elección por defecto de siempre.

## Pruebas

- Nuevas: `scripts/camera-slots-v331.test.mjs` (23) — las tres reglas
  de ranuras, la composición de programa y la normalización con la
  cadena exacta «EasyCamera (04f2:b57e)», más aserciones de fuente de
  que los caminos reales usan las reglas; y 4 en
  `scripts/native-engine.test.mjs` — emparejamiento con sufijo por
  sources y por cameraName, y la negativa PROGRAMA_NO_DISPONIBLE sin
  fase de error ni tubería lanzada (motor: 55/55).
- Actualizadas CON JUSTIFICACIÓN ESCRITA (la semántica nueva las
  supersede; no se debilitaron): 6 aserciones de la sección A de
  `scripts/native-window-diet.test.mjs` (la composición se mudó a la
  función pura; con una cámara ahora va cameraName explícito) y la
  expectativa de fase de la prueba multicámara de programa sin
  resolver en `scripts/native-engine.test.mjs` («error» →
  «apagado» + código). Las aserciones de DIETA y GOBERNADOR (lo
  blindado) no se tocaron: focus-governor 17/17, ventana-diag 6/6,
  dieta 23/23.
- Suite completa corrida por archivo: **221 tests = 220 pass + 1 fallo
  ambiental conocido** (`recording-pipeline.integration`, ENOENT de
  ffmpeg-static en la VM Linux de Lu; en Windows es el skip esperado →
  allí 220 pass + 1 skip). Nota honesta: corriendo TODOS los archivos
  a la vez en esta VM aparecieron fallos intermitentes por temporizador
  en pruebas del motor que pasan siempre en solitario (55/55 dos
  veces); es contención de la VM, no del código.
- `npx vite build` en verde.

## Conteos (antes → después)

| Archivo | Líneas |
|---|---|
| package.json | 83 → 83 (solo versión 3.3.0 → 3.3.1) |
| BLINDAJE.md | — → 49 (nuevo) |
| src/utils/remoteCameraSlots.mjs | 62 → 136 |
| src/utils/nativeProgramSources.mjs | — → 84 (nuevo) |
| src/App.jsx | 8625 → 8767 |
| src/components/CameraConnectModal.jsx | 2111 → 2123 |
| electron/native-engine.js | 1568 → 1621 |
| scripts/camera-slots-v331.test.mjs | — → 319 (nuevo) |
| scripts/native-engine.test.mjs | 1647 → 1750 |
| scripts/native-window-diet.test.mjs | 235 → 257 |
| Congelados (byte-idénticos) | masterBroadcastEngine.js 2577 · ventana-diag-core.js 59 · main.js 3356 |

Sin tocar (verificado): `src/pages/RemoteCam.jsx`,
`src/utils/remoteCameraSlots.mjs` solo en asignación (el constructor
de URL no cambió), transporte WebRTC/señalización/TURN, destinos y
exportación, geometría y tuberías del motor, `electron/main.js`,
`electron/preload.js`.

## Secuencia de publicación (sobre HEAD db16148)

**PASO 0:** descomprime el ZIP en la raíz del repo y reemplaza/crea
los archivos. Conteos con `(Get-Content <archivo>).Count`:
package.json 83 («version»: «3.3.1»), BLINDAJE.md NUEVO 49,
src/utils/remoteCameraSlots.mjs 136, src/utils/nativeProgramSources
.mjs NUEVO 84, src/App.jsx 8767, src/components/CameraConnectModal.jsx
2123, electron/native-engine.js 1621, scripts/camera-slots-v331.test
.mjs NUEVO 319, scripts/native-engine.test.mjs 1750,
scripts/native-window-diet.test.mjs 257, LEEME-v331.md NUEVO (este).
Verifica además que los congelados NO cambiaron: SHA-256 de
src/utils/masterBroadcastEngine.js =
`b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e` y
de electron/main.js =
`adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488`.

**PASO 1 — COMPUERTA (app cerrada):** `node scripts/smoke-motor.mjs`
debe imprimir «SMOKE RESULTADO: PASA». Si NO PASA: alto total, no
publiques y reporta la salida textual.

**PASO 2:** `node --test` → esperado 221 = 220 pass + 0 fail + 1 skip.
`npx vite build` en verde.

**PASO 3:** `git add -A && git commit -m "v3.3.1: ranuras de cámara y programa — la remota va a la primera libre, cada cámara recupera su ranura y la sesión nativa sale desde la cámara de programa" && git push origin main`. Reporta el hash.

**PASO 4:** genera e instala el instalador «PodcastStudio Setup
3.3.1.exe» (reporta su tamaño exacto); después `npm run build:exe`
para sincronizar el lanzador raíz; verifica que su versión sea
3.3.1.0 (igual a la de la app) y commitea+push esa sincronización
reportando su hash.

**PASO 5 — LECTURA DEL REGISTRO (sin probar nada más):** lee
`C:\Users\apere\AppData\Roaming\PodcastStudio\logs\ventana-diag.log` y
reporta el mayor retraso [ping] registrado durante el uso de la
v3.3.0 (la meta de aceptación era: ningún segundo con maxLag > 1000
ms en las ausencias al navegador), junto con el valor
concurrentPreview que haya quedado registrado.
