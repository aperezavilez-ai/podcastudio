# PodcastStudio v3.4.0 — Área 2: sesión nativa completa

Base: `main` = **89b5440** (v3.3.6 publicada). Esta versión NO toca nada
congelado: los cuatro archivos blindados quedan byte-idénticos (hashes al
final). La transmisión de la v3.3.6 ya funcionaba (la señal quedó); lo que
se corrige aquí es la EXPERIENCIA dentro de la app durante la sesión y la
vuelta de las cámaras al detener.

## Qué falla en vivo (citas) y qué lo corrige

1. **En sesión, el monitor máster dice SIN SEÑAL para las cámaras del
   motor y los mosaicos muestran foto fija** — veredicto de Luis sobre la
   v3.3.6 (~15:17 MST, capturas image-158/159/160): la señal llegó a
   Facebook correcta, pero dentro de la app no podía verificar lo que
   transmitía sin salir a Facebook. → **Monitor vivo** (pieza 1 y 2-i).
2. **Al detener, CAM 1 y CAM 3 NO volvieron** (solo CAM 2) y grabar con
   PGM en CAM 2 fue rechazado — veredicto ~15:19 MST (image-161/162).
   Causa leída en código: `readquirirLiberadas` intentaba UNA sola vez;
   si la apertura fallaba porque el proceso del motor aún no soltaba el
   dispositivo, el registro se restauraba «para reintentar al próximo
   apagado»… pero el motor ya estaba apagado y ningún cambio de estado
   volvía a disparar el efecto. → **Vigilante de readquisición** (2-iii).
3. **La cámara de programa se resolvía por un GUID** — en el
   `streaming.log` de la sesión de las 21:32 UTC: «Fuente PiP
   25203b73-1f2a-439d-a5f6-689e9b16d2cf OMITIDA» (no casó contra la
   enumeración MF). El emparejador de liberación sí usaba la etiqueta de
   la pista como candidata; el compositor de fuentes no. → **Identidad
   por etiqueta de pista** (2-iv).
4. **La PiP entraba sola a la sesión** — en el Facebook de Luis se vio
   una PiP que no pidió. Su regla (~15:19 MST): «la PiP NO debe estar
   fija ni auto-seleccionada — entra SOLO cuando yo la activo». →
   **PiP solo manual** (2-v): `pipCam` nace en `null` y la composición
   solo incluye la PiP fijada.
5. **Hipos de ~1,5 s en las transiciones de sesión** — medidos el
   2026-11-13 a las 15:09, 15:16 y 15:18 MST (1354/1505/1262 ms),
   coincidiendo con cambios de ventana/programa. Mecanismo en código: el
   camino de liberación capturaba la foto fija con drawImage+toDataURL a
   1920×1080 y esperaba un `<video>` desechable hasta 1200 ms por
   cámara, en plena transición. → **Fuera la foto del camino de
   liberación** (2-ii).

## Las piezas

### 1. `electron/native-engine.js` — monitor vivo del motor
- En las tuberías de sesión (record / recordStream / multicam), SOLO si
  hay directorio de monitor: (i) rama de **programa** desde `tprog`:
  queue → d3d11download → videoscale 640×360 → framerate 10/1 →
  videoconvert → jpegenc quality=70 → multifilesink
  `program-%05d.jpg` (max-files=3); (ii) por cada **fuente**, un tee
  `tsrc<n>` antes del compositor con su rama gemela a 480×270, 8 fps,
  `cam-<n+1>-%05d.jpg`. La rama **fakesink de la v3.3.6 queda intacta** y
  sin directorio de monitor la tubería es byte-idéntica a la v3.3.6 (sin
  ventana nueva: sigue sin haber `d3d11videosink` en sesión).
- El motor levanta un servidor HTTP **solo en 127.0.0.1**, puerto
  efímero, que sirve el JPEG completo más reciente:
  `/monitor/program.jpg` y `/monitor/cam-<n>.jpg` (si el archivo más
  nuevo está a medio escribir, sirve el anterior válido —
  `leerJpegVigenteEn`/`esJpegCompleto`). El puerto viaja en el estado
  existente como `monitorPort`. El servidor nace con la primera sesión
  y muere al apagarse el motor (stop, error o cierre del proceso).
- `electron/main.js` NO se tocó (congelado): el estado ya fluía entero
  por el canal existente.

### 2. `src/App.jsx`
- **(i) Monitor en los recuadros:** componente `NativeMonitorImg` (junto
  a VideoTile): un `<img>` que refresca con marca de tiempo cada 500 ms
  SOLO si la ventana está visible (`document.hidden` detiene el
  refresco: disciplina del gobernador) y conserva el último fotograma
  si un refresco falla. En sesión, el recuadro de programa (el máster)
  muestra `/monitor/program.jpg` y cada mosaico de cámara liberada su
  `/monitor/cam-<n>.jpg` (n = su posición en `sourceNames`, casada por
  la etiqueta), con el rótulo «En el motor nativo». El overlay del
  teleprompter NO se tocó: sigue montándose sobre la misma región, por
  encima (z-45 sobre z-5).
- **(ii) Liberación sin foto:** liberar = registrar el préstamo +
  stopTracks + retirar el stream. Fuera drawImage/toDataURL y la
  espera del `<video>` desechable. El estado `nativeReleasedPhotos` se
  renombra a **`nativeReleasedTiles`** (ranura → { label }).
- **(iii) Vigilante de readquisición:** política pura nueva en
  `src/utils/reacquirePolicy.mjs` (decide intentar/esperar/imposible
  por cámara y fase). Un intervalo de **2 s** mientras haya registro
  pendiente y la fase sea apagado/error re-ejecuta
  `readquirirLiberadas` hasta vaciar el registro o agotar **6 intentos
  por cámara**; al agotar: aviso UNA vez (toast + línea `[ranura]` en
  ventana-diag) y el registro queda para el próximo ciclo del motor,
  declarado. Un préstamo nuevo reinicia la contabilidad de esa cámara.
- **(iv) Identidad por etiqueta de pista:** la composición usa las
  MISMAS candidatas del emparejador de liberación (etiqueta de la pista
  de vídeo, luego `meta.label`, luego `meta.videoInfo.label`) y un
  filtro que **rechaza nombres con forma de GUID o iguales al
  deviceId**: si todas las candidatas son el GUID, la ranura no es
  elegible (y si es la de programa, la app se detiene antes, como
  manda la regla).
- **(v) PiP solo manual:** `pipCam` inicia en `null`; entra a la sesión
  únicamente la ranura fijada por Luis (nuevo `pipCamRef` alimentando
  `componerFuentesPrograma`). NOTA DECLARADA: quien tuviera la PiP
  «siempre en CAM 2» por el defecto anterior la verá ahora apagada al
  arrancar la app: hay que fijarla una vez cuando se quiera (un layout
  guardado que la declare sigue aplicándola, como hasta hoy).

### 3. `scripts/smoke-motor.mjs` — paso nuevo de compuerta
Tras recordStream local: una sesión local nueva debe servir
`/monitor/program.jpg` con un JPEG válido (>2 KB, cabecera FFD8) en
menos de 10 s de sondeo, con la sesión viva. Si no, la compuerta
**NO PASA** (paso «monitor», bloqueante como los demás).

### 4. `package.json` → 3.4.0

## Pruebas

- Suite acotada en el clon (Linux): `node --test "scripts/*.test.mjs"`
  → **287 pruebas, 287 pasan, 0 fallos, 0 omitidas**. Vite build verde.
- Nuevas: monitor por tokens (programa 640×360@10, por fuente
  480×270@8, fakesink intacto, sin monitor = tubería v3.3.6, preview
  sin ramas) y unitarias de `esJpegCompleto`/`leerJpegVigenteEn`
  (native-engine.test.mjs, +6); política de readquisición completa
  (reacquire-policy-v340.test.mjs, 7); identidad GUID y PiP
  (camera-slots-v331.test.mjs, +3).
- **Pruebas viejas ACTUALIZADAS (declarado):**
  - `camera-slots-v331.test.mjs`: los 4 tests del defecto 4 que
    afirmaban la PiP automática en orden de ranura pasan a la regla
    nueva (PiP solo fijada); el de «máximo 3 fuentes» se reescribe.
  - `native-window-diet.test.mjs`: el test de la foto de liberación se
    invierte (afirma que el camino YA NO contiene drawImage/toDataURL
    ni `<video>` desechable); el del mosaico pasa de foto a monitor
    vivo; el marcador del bloque D2 pasa a `nativeReleasedTiles`; el
    test de la sección A pasa de «máx. 3 fuentes» a «programa + PiP
    fijada» y de `vTrack.label` a las candidatas con filtro
    (`elegirEtiquetaFuente`). Ninguna otra prueba vieja se tocó.

## Archivos del paquete (conteos `awk 'END{print NR}'`, bytes Linux LF)

| Archivo | Líneas | Bytes |
|---|---:|---:|
| electron/native-engine.js | 1855 | 99297 |
| src/App.jsx | 9285 | 477288 |
| src/utils/nativeProgramSources.mjs | 127 | 6227 |
| src/utils/reacquirePolicy.mjs (NUEVO) | 71 | 3448 |
| scripts/smoke-motor.mjs | 321 | 15789 |
| scripts/native-engine.test.mjs | 1984 | 105066 |
| scripts/camera-slots-v331.test.mjs | 375 | 16622 |
| scripts/native-window-diet.test.mjs | 308 | 20134 |
| scripts/reacquire-policy-v340.test.mjs (NUEVO) | 92 | 4965 |
| package.json | 83 | 2360 |
| LEEME-v340.md | este archivo | — |

## Blindaje verificado (sha256, deben coincidir tras aplicar)

- `src/utils/masterBroadcastEngine.js` = b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e
- `electron/ventana-diag-core.js` = 5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7
- `electron/main.js` = adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488
- `src/utils/teleprompter.mjs` = e1b5f868a8907da4f9d91bf160ac30ee3b5e76a239d4b0c16f72d948c3bbd630

## Secuencia de publicación (PowerShell, en D:\PROGRAMAS IA\PODCASTUDIO)

Todos los bloques dicen SE CORRE salvo el que dice SOLO LECTURA.

**PASO 0 — SE CORRE** (descargar el ZIP a Descargas y expandirlo SOBRE la
carpeta del proyecto; cierra la app antes):

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\podcastudio-v340.zip" -DestinationPath "D:\PROGRAMAS IA\PODCASTUDIO" -Force
```

**PASO 1 — SE CORRE** (suite acotada; esperado: 287 pasan, 0 fallos):

```powershell
cd "D:\PROGRAMAS IA\PODCASTUDIO"
node --test "scripts/*.test.mjs"
```

**PASO 2 — SE CORRE** (compuerta del motor, con la APP CERRADA; esperado:
todos los pasos OK incluido «SMOKE monitor: OK» y «SMOKE RESULTADO:
PASA»; si algo dice FALLA, NO se sigue y se pega la salida):

```powershell
node scripts/smoke-motor.mjs
```

**PASO 3 — SE CORRE** (commit y push de la versión):

```powershell
git add electron/native-engine.js src/App.jsx src/utils/nativeProgramSources.mjs src/utils/reacquirePolicy.mjs scripts/smoke-motor.mjs scripts/native-engine.test.mjs scripts/camera-slots-v331.test.mjs scripts/native-window-diet.test.mjs scripts/reacquire-policy-v340.test.mjs package.json LEEME-v340.md
git commit -m "v3.4.0: monitor vivo del motor en sesion, vigilante de readquisicion, identidad por etiqueta de pista y PiP solo manual"
git push
```

**PASO 4 — SE CORRE** (compilar e instalar):

```powershell
npm run build:app
& ".\dist\PodcastStudio Setup 3.4.0.exe" /S
```

**PASO 5 — SE CORRE** (lanzador raíz y paridad de versiones):

```powershell
npm run build:exe
git add -A
git commit -m "sync lanzador 3.4.0.0"
git push
```

**PASO 6 — SOLO LECTURA** (verificación: ambas deben decir 3.4.0 / 3.4.0.0;
pegar la salida si no cuadra):

```powershell
(Get-Item ".\PodcastStudio.exe").VersionInfo.FileVersion
node -p "require('./package.json').version"
```

## Aceptación en vivo (la juzga Luis en su máquina)

1. **Transmitir 2 min a Facebook** cambiando de programa y cambiando de
   ventana (al navegador y de vuelta): dentro de la app, el máster y los
   mosaicos de las cámaras del motor se MUEVEN EN VIVO (ya no «Sin
   señal» ni fotos fijas); Facebook recibe el programa correcto.
2. **Detener la transmisión** y comprobar que TODAS las cámaras vuelven
   solas en ≤15 s (el vigilante reintenta cada 2 s).
3. **Grabar 30 s con PGM en CAM 2** (la cámara de la computadora): debe
   grabar sin el rechazo «no tiene señal local conectada».
4. **Una sesión SIN PiP**: ninguna PiP aparece en la señal salvo que Luis
   la fije; y con la PiP fijada, entra solo esa.

Fuera de esta vuelta (declarado): el cambio de programa por reinicio de
sesión (límite actual del motor por gst-launch), la capa de emisión
sobre la señal nativa (cintillos/música/efectos = Área 3, v3.5.0) y la
cámara remota (Área 4).
