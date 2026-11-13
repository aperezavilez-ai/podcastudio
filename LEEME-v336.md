# PodcastStudio v3.3.6 — la sesión nativa ya no abre ventana

## Qué corrige y por qué (causa probada en el registro de Luis)

Hasta la v3.3.5, la tubería de sesión del motor nativo llevaba una rama
de programa terminada en `d3d11videosink`: una **ventana de video de
GStreamer separada de la app**. En la primera transmisión real a
Facebook (2026-11-13), esa ventana se cerró a los ~14 segundos y mató
la sesión entera. Cita textual de
`C:\Users\apere\AppData\Roaming\PodcastStudio\logs\streaming.log`:

- `21:32:32Z` — la tubería arranca (programa Steren COM-126, nvh264enc,
  destino `rtmps://live-api-s.facebook.com:443/rtmp/…`).
- `21:32:47Z` — `ERROR: from element /GstPipeline:pipeline0/GstD3D11VideoSink:d3d11videosink0: Output window was closed`
- `21:32:48Z` — la queue y `mfvideosrc` mueren detrás (`Internal data stream error`).
- `21:32:50Z` — `GStreamer se cerró sin orden de parada (código 1)`.

El `rtmpsink` a Facebook **no erroró**: la conexión RTMPS sí funciona.
Lo que mató la transmisión fue la ventana. La compuerta nunca lo cazó
porque corre desatendida: nadie cierra esa ventana durante el smoke.

## El cambio (único y quirúrgico)

En `electron/native-engine.js`, la rama de sesión
(`tprog. ! queue ! … sync=false`) termina ahora en **`fakesink`** en
vez de `d3d11videosink`. Es la única línea de tubería que cambia:

```diff
-    tokens.push('tprog.', '!', 'queue', '!', 'd3d11videosink', 'sync=false');
+    tokens.push('tprog.', '!', 'queue', '!', 'fakesink', 'sync=false');
```

Consecuencias declaradas:

- Ninguna sesión (record, stream, recordStream, multicámara) abre
  ventana: **no hay ventana que cerrar y ninguna ventana puede matar
  una grabación o una transmisión**.
- Durante la sesión, el monitor de la app es la foto fija que los
  mosaicos ya muestran (las cámaras del motor están liberadas de la
  ventana, como desde la v3.3.0); la vista en vivo de la transmisión
  es la previa de la propia plataforma (Facebook).
- La **vista previa independiente (fuera de sesión)** NO se toca:
  `buildPreviewArgs` conserva su `d3d11videosink`, con y sin texto
  del teleprompter.
- `omitPreviewBranch` se conserva como opción del constructor: sin
  ella la rama va a `fakesink`; con ella no hay rama, como antes.
- Los comentarios del archivo que describían la rama de sesión
  quedaron actualizados para declarar todo lo anterior.
- `package.json`: versión **3.3.6**.

## Archivos del paquete (conteos con `awk 'END{print NR}'`)

| Archivo | Líneas | Bytes |
|---|---|---|
| `electron/native-engine.js` | 1656 | 89.542 |
| `package.json` | 83 | 2.360 |
| `scripts/native-engine.test.mjs` | 1893 | 99.853 |
| `LEEME-v336.md` | (este archivo) | — |

## Pruebas

`scripts/native-engine.test.mjs` trae el test nuevo
**«v3.3.6 · ninguna sesión abre ventana»**: para record, stream,
recordStream (local y con destino real) y multicámara afirma que los
tokens contienen `fakesink`, que **ningún** token es
`d3d11videosink` y que la rama sigue colgando de `tprog` tras su
queue; y que la vista previa independiente conserva
`d3d11videosink`. Las aserciones históricas de la suite que exigían
`d3d11videosink` en la sesión se actualizaron a la nueva forma (la
historia queda en los comentarios).

Verificado por Lu en el clon (base `be3c05f`):

- `node --test scripts/native-engine.test.mjs` → **59/59 pass, 0 fail**.
- Suite completa: la lista de fallos es **idéntica** a la de la base
  sin cambios (15 scripts auxiliares ambientales de esta VM Linux:
  `forensic-*`, `test-*`, `turn-credentials`,
  `recording-pipeline.integration`); el cambio añade 1 test y
  **cero fallos nuevos**. En Windows el resultado esperado es el de
  siempre: todo verde salvo el skip ambiental conocido.
- No se tocó el renderer: **no hace falta `vite build` por separado**
  (`npm run build:app` ya lo ejecuta como parte del instalador).

## Blindaje — archivos congelados SIN tocar (sha256 del árbol)

| Archivo | sha256 |
|---|---|
| `src/utils/masterBroadcastEngine.js` | `b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e` |
| `electron/ventana-diag-core.js` | `5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7` |
| `electron/main.js` | `adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488` |

Tampoco se tocaron `src/App.jsx` ni el teleprompter (congelado en la
v3.3.5). Si tras copiar los archivos alguno de esos tres hashes
difiere, detente: el paquete se aplicó sobre una base distinta.

## Publicación desde PowerShell (Luis, en `D:\PROGRAMAS IA\PODCASTUDIO`)

1. Cierra la app (si queda colgada, `CerrarProcesoPodcastStudio.bat`).
2. Copia los archivos del ZIP respetando las rutas (`electron\`,
   `scripts\`, `package.json` en la raíz). El LEEME es solo lectura.
3. Suite del motor y suite completa:
   ```
   node --test scripts\native-engine.test.mjs
   node --test
   ```
   Esperado: motor 59/59; suite completa verde salvo el skip
   ambiental conocido. Si algo más falla, detente y pega la salida.
4. Compuerta de humo, con la app cerrada:
   ```
   node scripts\smoke-motor.mjs
   ```
   Esperado: `SMOKE RESULTADO: PASA`.
5. Commit y push de la corrección:
   ```
   git add electron/native-engine.js package.json scripts/native-engine.test.mjs
   git commit -m "v3.3.6: la sesión nativa ya no abre ventana — ninguna ventana puede matar una transmisión"
   git push origin main
   ```
6. Instalador e instalación en silencio:
   ```
   npm run build:app
   & ".\dist_electron\PodcastStudio Setup 3.3.6.exe" /S
   ```
7. Lanzador raíz y su commit:
   ```
   npm run build:exe
   git add -A
   git commit -m "build: sync PodcastStudio.exe launcher to v3.3.6.0"
   git push origin main
   ```
   Paridad: el pie de la app debe decir **v3.3.6** y el lanzador
   **3.3.6.0**.

## Aceptación (la decide Luis en vivo, no la suite)

Abre la app, da **TRANSMITIR EN VIVO** a Facebook y déjala **60
segundos** cambiando al navegador (productor de Facebook) y de
vuelta. La transmisión debe seguir viva al volver — antes moría a
los ~14 s —. Durante la sesión el monitor de la app muestra la foto
fija (declarado arriba); tu vista en vivo es la previa de Facebook.
Al detener, las cámaras deben volver a la ventana como siempre.
