# PodcastStudio v3.2.0 — Hito 3: el motor nativo detrás de los botones reales

## Qué cambia y por qué

En la v3.1.0 el motor nativo (GStreamer, el que SÍ funciona en tu
máquina) quedó en un panel lateral, y los botones grandes que usas —
TRANSMITIR EN VIVO e INICIAR GRABACIÓN MASTER — seguían gobernados por
la cadena anterior, que es la que congela la app, no conecta a Facebook
y exporta re-codificando por software durante minutos. Este hito mueve
el motor nativo DETRÁS de esos botones:

1. **Grabar (botón real)** → sesión nativa `record`: la tubería
   GStreamer graba el máster en la carpeta del proyecto con el nombre
   de siempre (`<Proyecto>_<fecha>_<hora>_Master_<alto>p.mp4`). Al
   detener, el motor valida el máster y SOLO si es válido se abre el
   mismo modal de exportación de siempre; si no valida, verás el error
   (toast + panel), sin modal.
2. **Transmitir (botón real)** → sesión nativa `stream` (o
   `recordStream` si ya estás grabando): las URL de tus destinos
   guardados las compone el MISMO compositor de siempre
   (`buildStreamDestinations`: servidor + clave una sola vez) y cada
   destino es una rama FLV→RTMPS de la tubería (multi-destino por tee).
   Tope de los destinos: 1920×1080 — si la cámara negocia más (1440p o
   4K), la grabación conserva la resolución completa y el stream baja
   a 1080p en GPU con su propio codificador. Si el motor falla al
   arrancar, el error se muestra EN el modal (sin respaldo silencioso).
3. **Grabar mientras transmites y viceversa**: pulsar Grabar durante
   un directo sube la sesión a `recordStream`; detener la grabación
   la baja a `stream` (la transmisión continúa). Detener la
   transmisión durante una grabación combinada entrega el máster al
   modal y la grabación SIGUE en un máster nuevo. Las transiciones
   REINICIAN la tubería (puede notarse un corte breve del directo):
   la pantalla lo dice mientras ocurre («Reconectando sesión…»).
4. **Audio de las sesiones nativas**: el micrófono es el que COINCIDE
   con la cámara elegida (p. ej. «Micrófono (Steren COM-126)») y
   wasapi2src lo captura por su identificador. Si no hay coincidencia
   utilizable, se usa el dispositivo por defecto de Windows Y QUEDA
   DECLARADO en el registro y en el panel — nunca en silencio.
5. **Exportación desde el máster nativo** (el modal no cambia): el
   handler usa ahora la función pura `electron/export-args.js` —
   · 16:9 al mismo tamaño que el máster = COPIA de flujos +
     `+faststart` (segundos, sin re-codificar; el faststart hace que
     el Explorador de Windows SÍ genere la miniatura del MP4).
   · 9:16 / 1:1 / 4:5 = filtro de siempre + codificador por hardware
     de la escalera sondeada una vez (h264_nvenc → h264_qsv →
     h264_mf → libx264) con el bitrate del motor (1080p→12 Mbps).
   · Se escribe SOLO lo que pides (cada «Descargar Video» genera solo
     ese formato; el pack, solo los marcados). NINGÚN JPG automático:
     la miniatura JPG sigue solo en su botón, bajo demanda. Sin
     segunda copia del máster.
6. **Si GStreamer no estuviera** en la máquina, los botones usan la
   cadena anterior CON AVISO VISIBLE («Motor nativo no disponible: se
   usa la cadena anterior»). La cadena anterior queda intacta como
   respaldo. Con la grabación ISO por cámara activa manda también la
   cadena anterior (es la que sabe grabar por cámara).

## Frontera de alcance (en palabras llanas)

- La señal nativa es, por ahora, la **cámara principal LIMPIA**: sin
  cintillos, sin logos y sin cambio de cámaras DENTRO de la señal
  nativa. Esas capas del compositor son el hito siguiente.
- La **cámara remota / invitados NO se tocó en absoluto** (orden de
  Luis: funciona; ni siquiera refactorizar).
- El botón «Grabar + Transmitir (prueba local)» del panel sigue
  existiendo y sigue siendo la prueba local de siempre.
- Lo que SOLO puede probarse en tu máquina (aquí no hay Windows ni tu
  Facebook): que el RTMPS de GStreamer llegue a Facebook y que la
  selección del micrófono por `device=` acierte con tu Steren. Por
  eso la prueba en vivo de abajo es la que manda.

## Secuencia de aplicación (Antigravity, sobre el árbol v3.1.0)

**PASO 0 — antes de tocar nada:**
- `git status` y `git log -1`: el HEAD debe ser `099a774` (v3.1.0
  publicada). Si no cuadra, DETENERSE y reportar exacto.
- Descomprimir `podcastudio-hito3-v320.zip` sobre la raíz del repo
  (reemplaza 6 archivos y crea 2).

**PASO 1 — conteos con la regla del último byte.** Conteos esperados
(PowerShell `(Get-Content).Count` == `awk 'END{print NR}'` si el
archivo termina en salto de línea; si difiere en exactamente 1,
verificar el ÚLTIMO byte antes de detenerse):

| Archivo | Líneas |
|---|---|
| electron/native-engine.js | 955 |
| electron/main.js | 3265 |
| electron/export-args.js (NUEVO) | 147 |
| src/App.jsx | 7899 |
| scripts/native-engine.test.mjs | 787 |
| scripts/export-args.test.mjs (NUEVO) | 126 |
| package.json | 83 (solo cambia `"version"` a `"3.2.0"`) |
| LEEME-hito3.md (NUEVO) | 133 |

- `git status` debe listar SOLO este conjunto (8 archivos). Si aparece
  algo más, DETENERSE y reportar.
- Suite: `node --test scripts/*.test.mjs` → esperado **118 pruebas:
  117 pass + 1 skip, 0 fail** (el skip es el ambiental conocido de
  ffmpeg; en la máquina de Lu la suite dio 117 pass + 1 fail SOLO
  ambiental por ffmpeg-static ausente en su Linux).
- Build: `npx vite build` en verde (2.044 módulos transformados).

**PASO 2 — publicar:**
- Commit con el mensaje exacto:
  `v3.2.0: el motor nativo detrás de los botones reales (Hito 3) — Grabar y Transmitir con el motor nativo, exportación desde el máster nativo`
- `git push`.
- Generar el instalador: debe llamarse `PodcastStudio Setup 3.2.0.exe`
  y reportar su tamaño EXACTO en bytes.
- Instalarlo.

## Prueba en vivo de Luis (la que manda)

Antes de abrir la app: cerrar procesos colgados con
`CerrarProcesoPodcastStudio.bat`.

1. **Transmitir de verdad.** Abre la app → TRANSMITIR EN VIVO → tu
   destino de Facebook → Iniciar Transmisión En Vivo. Debe verse tu
   cámara llegando en el Live Producer de Facebook y la app NO debe
   congelarse. Detén desde la app (DETENER EN VIVO).
2. **Grabar y exportar.** INICIAR GRABACIÓN MASTER, graba 60 s →
   detener → se abre el modal de exportación. «Descargar Video 16:9»
   debe completar en SEGUNDOS (es copia, no re-codificación). Luego
   genera el de TikTok 9:16 y cronométralo. Abre la carpeta del
   proyecto: deben estar SOLO los archivos que generaste y cada MP4
   debe tener miniatura en el Explorador.
3. **Opcional (combinado).** Transmitiendo, pulsa Grabar (la sesión
   sube a grabar+transmitir), 30 s, y Detener grabación (la
   transmisión debe continuar).

**Reportar:** tus veredictos de cada paso, el tiempo de cada
exportación, el listado de la carpeta del proyecto y cualquier error
VERBATIM (copia el texto exacto). Como siempre: NO pegues claves de
transmisión en el chat.
