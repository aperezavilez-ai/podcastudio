# LEEME — PodcastStudio v3.1.0 · Hito 2: Motor Nativo hospedado

## Qué cambia y por qué

Hasta la v3.0.1 la captura y la composición viven DENTRO de la ventana de
la app, en el mismo proceso que los clics: esa es la raíz estructural de
la lentitud en vivo. El Hito 1 demostró en la máquina de Luis, fuera de
la ventana, que una tubería de GStreamer captura a 1920×1080, compone,
codifica por hardware y reparte a MP4 + stream con la PC responsiva.
Este Hito 2 HOSPEDA esa tubería probada dentro de PodcastStudio: la app
la gobierna (arranca, muestra su estado, detiene y valida), pero ningún
fotograma pasa por el canvas ni por el proceso de la ventana.

### Archivos nuevos

- `electron/native-engine.js` — Anfitrión del motor nativo, sin imports
  de Electron y con dependencias inyectables (mismo patrón factory que
  `electron/program-core.js`). Responsabilidades:
  - Localizar GStreamer (`gst-launch-1.0`, `gst-inspect-1.0`,
    `gst-device-monitor-1.0`) en este orden declarado:
    `PODCASTUDIO_GST_BIN` → `PATH` → `%LOCALAPPDATA%\Programs\gstreamer\1.0\msvc_x86_64\bin`
    → `C:\gstreamer\1.0\msvc_x86_64\bin` → `C:\Program Files\gstreamer\1.0\msvc_x86_64\bin`.
    Si falta algo, lo declara: «GStreamer no instalado».
  - Enumerar cámaras con `gst-device-monitor-1.0 Video/Source` y parsear
    su salida; elegir cámara (por nombre si se pide; si no, la primera) y
    caps: el exacto 1920×1080 a 30 fps si existe; si no, el mayor
    disponible LOGUEANDO la diferencia (la verdad declarada, nunca
    silenciosa). Si no se pudo parsear `device-path`, se selecciona por
    `device-index` y también queda logueado.
  - Escalera de codificadores `nvh264enc → qsvh264enc → mfh264enc → x264enc`
    verificada con `gst-inspect-1.0`. `bitrate=12000` son kbit/s en los
    cuatro. `nvh264enc` lleva `preset=hq`; si una sesión con preset muere
    en menos de 2500 ms nombrando al codificador, se reintenta UNA vez
    sin preset y la rebaja queda declarada en el estado (`presetUsed`).
  - Tubería (la del script probado del Hito 1): `mfvideosrc →
    d3d11upload/d3d11convert → d3d11compositor → tee de programa →
    d3d11videosink` (vista previa nativa, siempre) y, según la sesión,
    codificador → `h264parse` → MP4 fragmentado (`fragment-duration=2000`,
    válido aunque el cierre sea forzado) y/o FLV. Audio WASAPI → AAC solo
    si `wasapi2src` y `avenc_aac` existen al inspeccionar; si falta algo,
    la sesión va sin audio y queda declarado.
  - Sesiones `preview` / `record` / `recordStream` con estado emitido en
    cada cambio: fase, cámara, caps, codificador, archivos, validación.
    Al detener una grabación, la app VALIDA el MP4 (y el FLV) con la
    sonda de FFmpeg y el veredicto queda en el panel.
- `scripts/native-engine.test.mjs` — 12 pruebas en Node puro: parser del
  monitor con dos cámaras, construcción de la tubería en las tres
  sesiones, escalera de codificadores con `gst-inspect-1.0` stub, y flujo
  completo del anfitrión con stubs de gst-launch / gst-device-monitor /
  ffmpeg (cada stub declara en comentarios qué sustituye).

### Archivos modificados

- `electron/main.js` — Instancia el anfitrión junto al núcleo de programa
  (`nativeEngineHost`), emite su estado al renderer por el evento
  `native-engine-state` y registra el canal nuevo
  `native-engine:get-state`. Nada más.
- `electron/preload.js` — Al final, SIN tocar lo existente, un segundo
  bloque expone `window.electronAPI.nativeEngine` (`getState`, `start`,
  `stop`, `onState`).
- `src/App.jsx` — Panel nuevo «Motor Nativo» (distintivo «Hito 2 ·
  v3.1.0») justo después del panel «Motor PodcastStudio», en Transmisión
  y Redes: fase, cámara, formato negociado, codificador, botones de
  Vista previa / Grabar / Grabar + Transmitir (prueba local) / Detener,
  bytes del stream en vivo y veredictos de validación. Los paneles
  existentes no se alteran. El `outDir` va `undefined` a propósito: la
  carpeta de grabaciones del proyecto la resuelve el proceso principal
  y no está expuesta al renderer; aplica el defecto del anfitrión
  (`userData/motor-nativo`).
- `package.json` — Solo la versión `3.0.1 → 3.1.0` y el script nuevo
  `test:native-engine`. Sin dependencias nuevas.

### La colisión IPC y su resolución (verificada)

`electron/media-engine/bridge.js` ya registraba al arrancar los canales
`native-engine:start` y `native-engine:stop` con el payload LEGADO
`{ destinations, config }` del media-engine histórico, y también
`native-engine:write-frame`, `native-engine:write-audio` y
`native-engine:status`, guardados por su bandera interna de «corriendo».
Electron no admite dos handlers por canal. Resolución SIN tocar
bridge.js, documentada en un comentario extenso en `electron/main.js`:
se retiran esos cinco handlers (`ipcMain.removeHandler`, en try/catch) y
se re-registran como ENRUTADORES — `start` con `session` va al Hito 2 y
sin `session` va al legado (`electron/media-engine`); write-frame /
write-audio / status delegan en el legado con una bandera local que
reproduce la de bridge.js; `stop` detiene el Hito 2 si no está
«apagado» y si lo está, para el legado. El setup de bridge.js queda así
sustituido por una re-registración equivalente más el enrutador.

### Declaración obligada: transmisión LOCAL de prueba

La sesión «Grabar + Transmitir» envía a `rtmp://127.0.0.1:1935/live/prueba`,
un destino LOCAL con un oyente FFmpeg de la propia app que guarda el FLV
recibido (`motor-stream-recibido.flv`) para validarlo. NO transmite a
ningún destino real: el destino real se conecta en el hito siguiente.
El panel lo dice con ese texto bajo el botón.

### Lo que NO se tocó

`lib/supabase/`, `.env.example`, `electron/program-core.js`,
`electron/master-file.js` y `src/utils/programEncoder.js` quedan
intactos (hashes md5 verificados idénticos a la base v3.0.1 al cerrar
el paquete).

## Verificación hecha por Lu al construir el paquete (Linux)

- `node --check` en `electron/native-engine.js`, `electron/main.js` y
  `electron/preload.js`: sin errores.
- Suite completa `node --test scripts/*.test.mjs`: **93 tests, 92 pass,
  1 fallo** — el único fallo es el ambiental conocido de la base
  (`recording-pipeline.integration.test.mjs`, ENOENT de ffmpeg-static en
  este Linux). Base conocida: 81 tests, 80 pass, ese mismo fallo; los 12
  nuevos pasan.
- `npx vite build`: verde, **2044 módulos** transformados.

## Secuencia de aplicación para Antigravity (sobre un árbol v3.0.1)

- **PASO 0:** `git status` y comprobar HEAD `e940e77` (árbol v3.0.1
  publicado). Si el HEAD o el estado no coinciden con lo esperado,
  DETENERSE y reportar antes de copiar nada. Descomprimir el ZIP
  `podcastudio-motor-nativo-hito2-v310.zip` SOBRE el repo.
- **PASO 1 — conteos (regla del último byte):** conteos awk de
  referencia (Linux, `awk 'END{print NR}'`):
  - `package.json` — 83
  - `electron/native-engine.js` — 715 (nuevo)
  - `electron/main.js` — 3270
  - `electron/preload.js` — 145
  - `src/App.jsx` — 7628
  - `scripts/native-engine.test.mjs` — 318 (nuevo)
  - `LEEME-hito2.md` — 175 (nuevo, en la raíz)

  En Windows, `(Get-Content).Count` = líneas de texto = el conteo awk
  SI el archivo termina en salto de línea, y awk + 1 si NO termina.
  Los archivos de este paquete SÍ terminan en salto de línea, así que
  los conteos deben coincidir. Si `(Get-Content).Count` difiere en
  exactamente 1 del conteo awk, VERIFICAR EL ÚLTIMO BYTE del archivo
  antes de detenerse: si no termina en salto de línea, la diferencia
  de 1 es esperada y no un daño.
  `git status` debe quedar limitado EXACTAMENTE a este conjunto:
  modificados `package.json`, `electron/main.js`, `electron/preload.js`,
  `src/App.jsx`; nuevos `electron/native-engine.js`,
  `scripts/native-engine.test.mjs`, `LEEME-hito2.md`. Cualquier otro
  archivo en el status: DETENERSE y clasificar antes de commitear.
- **PASO 2:** suite completa: `node --test scripts/*.test.mjs`
  (esperado: 93 tests; en Windows los que ejercitan FFmpeg real pueden
  correr o saltarse según el entorno — reportar el conteo exacto).
- **PASO 3:** build: `npx vite build` (esperado: verde, ~2044 módulos).
- **PASO 4:** commit con el mensaje exacto:
  `v3.1.0: motor nativo hospedado (Hito 2) — la app gobierna la tubería GStreamer: vista previa nativa, grabación y transmisión local de prueba`
  y push.
- **PASO 5:** instalador con electron-builder: debe producir
  `PodcastStudio Setup 3.1.0.exe`; reportar su TAMAÑO EXACTO en bytes.
- **PASO 6:** instalar y abrir la app INSTALADA desde el menú Inicio
  (no el build de desarrollo).

## Prueba en vivo de Luis (la que decide)

Antes de abrir: ejecutar `CerrarProcesosPodcastStudio.bat`.

1. Abrir la app instalada → panel **Transmisión y Redes** → **Motor
   Nativo** → **«Vista previa»**: debe aparecer la VENTANA NATIVA con su
   cámara, fluida (su juicio), y el panel debe mostrar cámara, formato
   negociado y codificador.
2. **«Grabar»** durante 60 s → **«Detener»**: el panel debe mostrar el
   veredicto ✅ de la grabación; abrir el MP4 (la ruta se muestra en el
   panel) y juzgar FLUIDEZ y NITIDEZ contra `prueba-vida.mp4` del Hito 1.
3. **«Grabar + Transmitir (prueba local)»** durante 30 s → **«Detener»**:
   durante la sesión el panel muestra los bytes recibidos del stream
   (deben ser > 0 al detener) y al final el veredicto del FLV local.
4. Durante una grabación, mirar el **Administrador de tareas**: la CPU
   de `gst-launch-1.0` debe ser baja y la PC debe responder.

**Reportar:** sus veredictos visuales (vista previa y MP4), el formato
negociado que mostró el panel, los tamaños de ambos archivos (MP4 y
FLV) y cualquier error textual que aparezca.
