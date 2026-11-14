# LEEME v3.4.1 — la sesión vuelve a la forma probada v3.3.6 (fuera el monitor)

## Por qué existe esta versión

La v3.4.0 fue REPROBADA en vivo por Luis el 2026-11-13 (~17:46 MST,
capturas image-170/171) con dos fallos:

1. **La transmisión murió.** Banner de la app: «La transmisión se
   detuvo: GStreamer se cerró sin orden de parada (código 1). Últimas
   líneas: ../libs/gst/base/gstbasesrc.c(3187): gst_base_src_loop ():
   /GstPipeline:pipeline0/GstMFVideoSrc:mfvideosrc0: | streaming
   stopped, reason error (-5)». Es la misma clase de fallo que la
   ventana `d3d11videosink` de la v3.3.5: un camino acoplado a la
   tubería de sesión que puede matar la sesión desde fuera del
   programa. En la v3.4.0 ese camino fueron las ramas del monitor.
2. **Los cintillos quedaron tapados en la app.** El panel decía «AL
   AIRE / En Pantalla» y en el máster no se veía ningún cintillo.

Decisión (ya tomada, no se reabre): la sesión queda EXACTA a la forma
v3.3.6 — la que transmitió ~2 minutos a Facebook sin morir — y de la
v3.4.0 se conserva todo lo que NO toca la tubería.

## El mecanismo de cada fallo (leído en el árbol v3.4.0)

- **Transmisión:** con directorio de monitor, cada fuente de la sesión
  pasaba por un tee `tsrc<N>` ANTES del compositor y de `tprog.`
  colgaba la rama JPEG completa (`d3d11download → videoscale →
  videoconvert → jpegenc → multifilesink`), servida por un servidor
  HTTP local. La sesión real de Luis murió en `mfvideosrc0` con
  flow-return -5; en la captura se ven además la PiP en negro y CAM 2
  en negro. La compuerta smoke de la v3.4.0 exigía un fotograma del
  monitor en una sesión local y PASÓ: no reprodujo la sesión real.
- **Cintillos:** el cintillo se dibuja DENTRO del canvas máster (así
  desde la v1.6.1). En App.jsx v3.4.0 el `<NativeMonitorImg>` del
  programa iba con `absolute inset-0 w-full h-full object-cover
  bg-black z-[5]` ENCIMA del recuadro PGM liberado: tapaba el canvas
  completo, cintillo incluido.

## Qué se revierte (a la forma v3.3.6, byte a byte donde aplica)

1. **`electron/native-engine.js`** → forma v3.3.6 EXACTA (1656 líneas;
   sha256 `84e468b5…`, idéntico al de `89b5440`, verificado con cmp).
   Fuera: los tees `tsrc<N>` por fuente, la rama JPEG de programa
   desde `tprog`, el servidor HTTP del monitor y sus helpers. Todo el
   diff v3.3.6→v3.4.0 de este archivo era del monitor: no se pierde
   ningún otro cambio. La rama `fakesink` de la v3.3.6 queda como
   estaba: ninguna sesión abre ventana.
2. **`scripts/smoke-motor.mjs`** → forma v3.3.6 EXACTA (264 líneas;
   sha256 `b47d1ac6…`). Fuera el paso que exigía un fotograma del
   monitor durante recordStream local.
3. **`src/App.jsx`** — cirugía del monitor, nada más:
   - Fuera el componente `NativeMonitorImg` y su comentario.
   - Fuera `nativeMonitorBase` y `monitorCamUrlDeRanura` (las URLs
     del monitor ya no se resuelven: el motor revertido ni siquiera
     publica `monitorPort`).
   - Fuera el bloque del recuadro PGM que montaba la imagen del
     monitor sobre el VideoTile: el máster vuelve a mostrar el canvas
     — con sus cintillos visibles en la app, como antes de la v3.4.0.
   - En los mosaicos, fuera la imagen del monitor: la ranura liberada
     muestra SOLO el rótulo «En el motor nativo» sobre el fondo.
4. **`scripts/native-engine.test.mjs`** → forma v3.3.6 EXACTA (1893
   líneas, recuperada de `git show 89b5440:…`): salen los 6 tests
   «monitor v3.4.0».

## Qué se CONSERVA de la v3.4.0 (byte-idéntico, verificado por diff)

- **Vigilante de readquisición**: `src/utils/reacquirePolicy.mjs`
  (71 líneas) + su uso en App.jsx — intervalo de 2 s en fase
  apagado/error, tope de 6 intentos por cámara, aviso único al
  agotar y registro conservado para el próximo ciclo. Es la pieza
  que hace que CAM 1 y CAM 3 vuelvan solas al detener.
- **Identidad por etiqueta de pista**: `src/utils/
  nativeProgramSources.mjs` (127 líneas) — las candidatas del
  emparejador de liberación (etiqueta de la pista → meta.label →
  videoInfo.label) con filtro anti-GUID: el deviceId/GUID nunca es
  nombre de fuente; si todas las candidatas son el GUID, la ranura
  no es elegible. Es la pieza que hace grabable a CAM 2.
- **PiP solo manual**: `pipCam` nace en `null`; la composición
  incluye solo la PiP que Luis fijó (campo `pip`). Sin fijarla, la
  sesión es solo la cámara de programa.
- **Liberación sin foto**: el camino de liberación sigue SIN
  drawImage/toDataURL y SIN la espera del `<video>` desechable de
  1200 ms (la firma de los hipos de transición del 2026-11-13). El
  estado espejo sigue llamándose `nativeReleasedTiles`.

Declaración honesta: sin monitor, durante la sesión las cámaras
liberadas no se ven dentro de la app (el máster muestra el canvas y
los mosaicos el rótulo), igual que en la v3.3.6. El monitor vivo
volverá solo por una vía que no acople caminos de fallo a la tubería
ni tape el canvas; no es esta vuelta.

## Tests tocados (declarados, como manda la casa)

- `scripts/native-engine.test.mjs`: restaurado a la forma v3.3.6 —
  salen los 6 tests del monitor (rama de programa, ramas gemelas,
  «sin directorio = tubería v3.3.6», «la vista previa nunca lleva
  monitor», `esJpegCompleto`, `leerJpegVigenteEn`).
- `scripts/native-window-diet.test.mjs`: el test «v3.4.0 D2: el
  mosaico y el máster muestran el MONITOR VIVO…» se sustituye por
  «v3.4.1 D2: el mosaico de la liberada muestra SOLO el rótulo — sin
  foto y sin monitor» (afirma la ausencia de `NativeMonitorImg`,
  `monitorPort`, `/monitor/program.jpg` y `monitorCamUrlDeRanura` en
  App.jsx) y se actualiza el rótulo de la sección D2. Se conservan
  intactas las expectativas de liberación sin foto y del vigilante.
- SIN tocar: `scripts/camera-slots-v331.test.mjs` (identidad por
  pista y PiP manual de la v3.4.0 siguen afirmadas tal cual) y
  `scripts/reacquire-policy-v340.test.mjs` (el vigilante).

## Verificación (en la VM de Lu, sobre este árbol)

- `node --test "scripts/*.test.mjs"`: **281 tests, 281 pass, 0 fail,
  0 skipped**. La v3.4.0 daba 287: la diferencia son exactamente los
  6 tests del monitor que salen. En Windows deben ser 281 en total
  con 0 fallos (uno puede figurar como skip ambiental, como siempre).
- `npx vite build`: verde (solo el aviso preexistente de chunk
  >1000 kB).
- Alcance: contra el árbol v3.4.0 publicado difieren SOLO los 6
  archivos de este paquete + este LEEME.
- Congelados byte-idénticos (sha256, prefijo): 
  `src/utils/masterBroadcastEngine.js` `b270214b…`,
  `electron/ventana-diag-core.js` `5e94cd54…`,
  `electron/main.js` `adc3d932…`,
  `src/utils/teleprompter.mjs` `e1b5f868…` (el teleprompter no se
  tocó: sigue congelado en su estado v3.3.5).
- Nada de esto está publicado ni probado en vivo. La prueba es la
  transmisión de Luis.

## Contenido del paquete (líneas con `awk 'END{print NR}'`)

- `electron/native-engine.js` — 1656 (forma v3.3.6)
- `scripts/smoke-motor.mjs` — 264 (forma v3.3.6)
- `src/App.jsx` — 9224
- `scripts/native-engine.test.mjs` — 1893 (forma v3.3.6)
- `scripts/native-window-diet.test.mjs` — 315
- `package.json` — 83 (versión 3.4.1)
- `LEEME-v341.md` — este archivo

## Secuencia de publicación (PowerShell)

**SE CORRE** — en el PowerShell de PodcastStudio (el prompt debe
decir `PODCASTUDIO`), con la app cerrada. Ojo: ajusta la ruta del ZIP
si tu navegador no lo dejó en Descargas (en la v3.3.6 y la v3.4.0 no
cayó ahí):

```
cd "D:\PROGRAMAS IA\PODCASTUDIO"
Expand-Archive -Path "$env:USERPROFILE\Downloads\podcastudio-v341.zip" -DestinationPath . -Force
node --test "scripts/*.test.mjs"
node scripts\smoke-motor.mjs
```

Debe dar: suite **281 pruebas, 0 fallos** y `SMOKE RESULTADO: PASA`
(la compuerta vuelve a ser la de la v3.3.6, sin paso de monitor).

**SE CORRE** — publicar e instalar:

```
git add electron/native-engine.js scripts/smoke-motor.mjs src/App.jsx scripts/native-engine.test.mjs scripts/native-window-diet.test.mjs package.json LEEME-v341.md
git commit -m "v3.4.1: la sesión vuelve a la forma v3.3.6 — fuera el monitor que mató la transmisión y tapó los cintillos"
git push origin main
npm run build:app
& ".\dist_electron\PodcastStudio Setup 3.4.1.exe" /S
npm run build:exe
git add -A
git commit -m "build: sync PodcastStudio.exe launcher to v3.4.1.0"
git push origin main
```

## Aceptación en vivo (la del área 2, con la app en v3.4.1)

1. Transmitir ~2 minutos a Facebook cambiando de programa y de
   ventana: la señal NO debe morir, y los cintillos deben VERSE en
   el máster de la app (el punto que la v3.4.0 rompió).
2. Detener: TODAS las cámaras vuelven solas en segundos (el
   vigilante de la v3.4.0, conservado).
3. Grabar 30 s con PGM en CAM 2 (la identidad por pista,
   conservada).
4. Una sesión sin fijar la PiP sale solo con la de programa; la PiP
   entra únicamente si Luis la fija.
5. El teleprompter se ve sobre el máster dentro de la app y NO
   aparece en la señal de Facebook (regla permanente).
6. Al cerrar la sesión, extracción de picos ≥500 ms del
   ventana-diag de ESA sesión, para comparar contra la línea base
   del 2026-11-13 (17 segundos malos aislados en todo el día,
   1,2–2,0 s, nunca dos seguidos).

Si la sesión muere otra vez, no se insiste: se pega el
`streaming.log` de esa sesión y se lee el primer error real antes de
tocar nada más.
