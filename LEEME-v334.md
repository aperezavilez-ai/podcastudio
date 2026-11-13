# LEEME — PodcastStudio v3.3.4 (la ranura prestada al motor queda bloqueada + el HUD recuerda su estado)

Dos correcciones: **Principal** — una cámara local prestada al motor
nativo (vista previa / grabación / transmisión en marcha) deja de
leerse «libre» para las cámaras remotas: su ranura queda OCUPADA y
BLOQUEADA hasta que vuelve o hasta que Luis la desconecta a mano.
**Menor** — el interruptor HUD del teleprompter conserva su estado
entre sesiones. La v3.3.3 se publicó y en vivo la remota volvió a caer
en CAM 2, que estaba ocupada por una cámara local (la ocupante terminó
reubicada en CAM 3): esta versión cierra la clase que lo permitió.

## La regla de Luis (la que manda en este paquete)

> Una ranura con una cámara conectada está OCUPADA y BLOQUEADA —
> también mientras su cámara está prestada al motor nativo. Ningún
> camino puede conectar otra cámara en ella ni expulsar a la
> ocupante. La única vía para liberar una ranura es la desconexión
> manual del usuario.

## Defecto principal — el mecanismo, citado en el código entregado (v3.3.3)

1. **La guarda no veía las cámaras prestadas al motor.** El efecto D2
   de la dieta de ventana (`src/App.jsx`, ~líneas 1770-1910) libera
   las cámaras locales cuando el motor entra en marcha: detiene sus
   tracks y las SACA de `slotStreams`, guardando el registro en
   `nativeReleasedCamsRef`. El predicado único de ocupación
   (`src/utils/remoteCameraSlots.mjs`) decidía sobre
   streams/cameraMeta/assignedSlots y **no consultaba ese registro**:
   en el instante en que tampoco había meta que sostuviera la ranura
   (una readquisición anterior «a medias» bastaba), la ranura se leía
   «libre» y la colocación remota la abordaba. Al apagarse el motor,
   la cámara volvía y encontraba su ranura tomada: terminaba
   desplazada — CAM 2 → CAM 3 en la sesión de Luis.
2. **La readquisición por respaldo volvía «a medias» y a ciegas.** La
   rama de respaldo de `readquirirLiberadas` (getUserMedia directo,
   ~línea 1804 de la base) escribía el stream en `slotStreams` SIN
   registrar `cameraMeta` y SIN comprobar ocupación: sin meta, la
   mitad del predicado quedaba ciega para esa cámara en adelante, y
   la escritura era incondicional sobre su ranura original.
3. **`handleAssignRemoteStream` juzgaba la ranura pedida solo por su
   stream**: sin stream en ese instante (cámara prestada al motor),
   la daba por libre y escribía la remota encima.

## La corrección (la clase completa, no el síntoma)

- **Nueva fuente de ocupación de primera clase**: el predicado único
  se construye ahora sobre `fuentesDeOcupacion(slot, …)`
  (`src/utils/remoteCameraSlots.mjs`), que devuelve las fuentes que
  marcan la ranura: `stream`, `meta`, **`liberada-al-motor`**,
  `reserva`, `local`. Todas las funciones puras
  (`decidirColocacionRemotaCloud`, `resolveRemoteCameraSlot`,
  `findAvailableRemoteCameraSlot`, `chooseReconnectCameraSlot`)
  reciben `liberadasAlMotor` y la respetan.
- **Todos los caminos alimentan el registro** desde
  `nativeReleasedCamsRef.current`: el handler cloud (`setupSlot`), el
  auto-despacho de Supabase, la oferta WebRTC del QR/enlace
  (`assignSlotOnce`), `handleAssignRemoteStream` (que además juzga la
  pedida con las fuentes completas y reutiliza también por `mobileId`
  y meta `mobile`), la reconexión de cámaras guardadas, la sugerencia
  de destino al abrir el modal y las sugerencias del propio modal de
  conexión (nueva prop `liberatedSlots` en `CameraConnectModal.jsx`:
  búsqueda de libre y enlaces de invitado).
- **La readquisición vuelve completa y con disciplina**
  (`readquirirLiberadas`): el destino se decide con la función pura
  nueva `elegirRanuraReadquisicion` — su ranura si está libre; si otra
  fuente la ocupó mientras tanto (tras esta versión ya no puede ser
  una remota: la guarda la bloquea; sí puede ser una conexión manual
  del usuario), la primera libre con aviso visible, **jamás
  sobrescribe**; sin libres, el registro se restaura y reintenta en
  el próximo apagado, con aviso. La rama USB sigue usando la
  adquisición probada (`handleUsbConnect`, que ya registra stream +
  meta y se niega a pisar una pista viva). La rama de respaldo ahora
  registra la cámara **COMPLETA** (stream + `cameraMeta` con deviceId
  si se conoce, label y type, + historial) y re-chequea la ocupación
  en el momento de escribir: si el destino se ocupó durante la
  reapertura asíncrona, re-decide en vez de pisar.
- **La desconexión manual libera el préstamo**: `handleDisconnectSlot`
  retira el registro de liberada y la foto fija de la ranura — es la
  única vía legítima de desbloquearla, y la cámara desconectada ya no
  «resucita» al apagarse el motor.
- **Instrumento**: cada decisión de colocación de una remota (y de
  readquisición) se anota vía `ventanaDiagSend` en el canal propio
  **`[ranura]`** de `ventana-diag.log` — el instrumento congelado no
  se toca; se usa su canal existente como ya hacen las líneas
  `[prompter]` — con camino (`cloud sala N` / `auto-despacho` /
  `oferta-webrtc` / `modal` / `readquisición-motor` /
  `desconexión-manual`), ranura pedida, ocupación vista (las fuentes
  de `fuentesDeOcupacion`) y decisión final. Si mañana falla en vivo,
  el log dice por qué se decidió así.

## Defecto menor — el teleprompter «desaparece» entre sesiones

`showFloatingPrompter` era `useState(false)` sin persistencia
(`src/App.jsx:499` en la base): cada arranque nacía con el HUD
apagado aunque Luis lo hubiera dejado encendido, y en vivo se leyó
como «el teleprompter desapareció de la cámara máster». Ahora el
estado se lee y se guarda en `localStorage`
(`podcastudio_teleprompter_hud`, mismo patrón que los rótulos de
cámara): al reabrir la app, el interruptor conserva su último estado.
Primera vez en la vida de la app: apagado. Nada más del teleprompter
se tocó (geometría, reloj y montaje de la v3.3.2 intactos).

## Pruebas

- **Nuevas** `scripts/remote-released-v334.test.mjs` (15): la
  regresión del escenario exacto de Luis — cámara local en CAM 2 →
  el motor la libera (ranura sin stream ni meta, solo el registro) →
  el celular llega por el camino cloud pidiendo esa sala → la
  decisión lo manda a la primera libre y la prestada queda intacta →
  al volver, la cámara recupera CAM 2 —; la variante de la
  readquirida por respaldo (con meta registrada, su ranura lee
  ocupada); rechazo sin libres; re-emisión que reutiliza su
  colocación; reubicación sin sobrescritura; dos vueltas en la misma
  pasada sin colisión; reconexión de guardada que no aterriza en una
  liberada; y el cableado (alimentaciones, canal `[ranura]`,
  persistencia del HUD) sobre el código fuente.
- **Actualizada** `scripts/native-window-diet.test.mjs` (1 prueba): la
  que fijaba la vuelta incondicional a la ranura original
  (`handleUsbConnect(info.deviceId, slotIdx, …)`) ahora fija la nueva
  invariante (destino decidido por `elegirRanuraReadquisicion`), con
  la justificación escrita en la propia prueba.
- Suite completa en la VM de Lu: **269 = 268 pass + 1 fallo ambiental**
  (`recording-pipeline.integration`, ffmpeg-static ENOENT en Linux;
  en Windows es el skip). Suites tocadas, deterministas:
  ranuras nuevas v3.3.4 15/15, cloud v3.3.3 + ranuras v3.3.1 +
  ranuras base 50/50 en conjunto, dieta de ventana 23/23, motor
  58/58, teleprompter 15/15, streaming-chain 12/12 en solitario (en
  una corrida combinada bajo carga de la VM, su prueba RTMP con
  FFmpeg del sistema falló una vez por tiempo y pasó al repetir:
  intermitencia de temporizadores de esta VM, documentada desde la
  v3.3.1; no la toca este paquete). `npx vite build` en verde.

## Archivos del paquete (8)

- `package.json` — versión 3.3.4 (83 líneas).
- `src/App.jsx` — 8891 → 9100.
- `src/utils/remoteCameraSlots.mjs` — 203 → 284.
- `src/components/CameraConnectModal.jsx` — 2123 → 2131.
- `scripts/remote-released-v334.test.mjs` — NUEVO, 283.
- `scripts/native-window-diet.test.mjs` — 259 → 268 (1 prueba
  actualizada, ver arriba).
- `BLINDAJE.md` — 70 → 93 (declaración de no-regresión de la v3.3.4).
- `LEEME-v334.md` — este archivo (raíz).

## Blindaje — verificación (debe coincidir ANTES y DESPUÉS de aplicar)

- `src/utils/masterBroadcastEngine.js` — sha256
  `b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e`
- `electron/ventana-diag-core.js` — sha256
  `5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7`
- `electron/main.js` — sha256
  `adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488`
- `electron/native-engine.js` — intacto en este paquete (no está en
  el ZIP; su sha256 al construir fue
  `830bb3ff68d75d0ec9fbcea3d5a02e11c8c8a8f24d1affe398553c8a52ba2e1c`).

Los congelados deben seguir byte-idénticos tras aplicar el paquete.
Si alguno cambia, DETENERSE y reportar. El transporte WebRTC/
señalización/TURN y la lente de la v3.3.3 no se tocaron
(`streamTransport.js`, `RemoteCam.jsx`, `remoteCameraLens.mjs` fuera
del ZIP).

## Secuencia de publicación (sobre la v3.3.3)

0. **Base**: el HEAD debe ser el commit con mensaje **«v3.3.3:
   remota sin expulsiones y sin ojo de pez — la vista previa cede al
   grabar»** (o su sincronización del lanzador 3.3.3.0 encima de él).
   Si el HEAD es otro, DETENERSE y reportar cuál es.
1. Aplicar los archivos del ZIP en la raíz del repo.
2. **Blindaje**: verificar los sha256 de arriba. Si alguno no
   coincide, DETENERSE y reportar.
3. **Conteos** con `(Get-Content <archivo>).Count`: package.json 83
   («version»: «3.3.4»), src/App.jsx 9100,
   src/utils/remoteCameraSlots.mjs 284,
   src/components/CameraConnectModal.jsx 2131,
   scripts/remote-released-v334.test.mjs NUEVO 283,
   scripts/native-window-diet.test.mjs 268, BLINDAJE.md 93,
   LEEME-v334.md NUEVO en la raíz.
4. **COMPUERTA** (app cerrada): `node scripts/smoke-motor.mjs` →
   debe imprimir **«SMOKE RESULTADO: PASA»**. Si NO PASA: alto total,
   no publicar y reportar la salida textual.
5. **Suite**: `node --test` (o `node --test scripts/*.test.mjs`) →
   esperado **269 = 268 pass + 0 fail + 1 skip** en Windows (la
   ambiental de ffmpeg-static es el skip).
6. `npx vite build` en verde.
7. **Commit**: `git add -A && git commit -m "v3.3.4: la ranura
   prestada al motor queda bloqueada — y el HUD recuerda su estado"
   && git push origin main`. Reportar el hash.
8. **Instalador**: generar e instalar «PodcastStudio Setup
   3.3.4.exe» (reportar su tamaño exacto); después
   `npm run build:exe`; verificar paridad **lanzador 3.3.4.0 == app
   3.3.4** y commitear+push la sincronización reportando su hash.
9. Reportar sin probar. La aceptación es de Luis, en vivo.

## Aceptación en vivo (la hace Luis; define si la v3.3.4 quedó)

1. **Ocupación con el motor en marcha**: con una cámara local en
   CAM 2 (y otra libre, p. ej. CAM 4), abrir la **vista previa del
   motor** (o grabar) para que la ventana libere las cámaras al
   motor; sin apagar el motor, conectar el celular por su enlace/QR →
   la remota debe caer en la **primera ranura libre** (no en CAM 2)
   y CAM 2 debe seguir mostrando su foto fija con el rótulo «En el
   motor nativo».
2. **Retorno a su ranura**: detener el motor → la cámara local de
   CAM 2 debe **recuperar CAM 2** (no aparecer en otra ranura).
3. **Evidencia en el log**: en
   `C:\Users\apere\AppData\Roaming\PodcastStudio\logs\ventana-diag.log`
   deben aparecer líneas `[ranura]` de esa sesión con la decisión
   (camino, pedida=CAM 2, ocupacionPedida con `liberada-al-motor`,
   destino = la libre). Reportar una de esas líneas tal cual.
4. **HUD con memoria**: encender «HUD Activo», cerrar la app por
   completo y reabrirla → el interruptor debe seguir en «HUD
   Activo» y el texto del teleprompter debe salir sobre la cámara
   máster sin tocar nada.

## No verificado (solo la máquina de Luis)

La compuerta de humo en su máquina (debe decir PASA antes de
publicar); el escenario completo en vivo con su Steren/EasyCamera y
su iPhone (la causa está citada en código y la regresión es
determinista, pero la aceptación es la de la lista de arriba); y que
la persistencia del HUD se lea tras un reinicio real de la app
instalada.
