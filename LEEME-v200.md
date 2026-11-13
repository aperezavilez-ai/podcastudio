# PodcastStudio v2.0.0 — NÚCLEO EN VIVO NUEVO (paquete consolidado)

**Qué es:** el reemplazo completo del núcleo en vivo que Luis autorizó
(«hazlo todo»), más las correcciones de mecanismo verificado de audio,
autoenfoque y teleprompter, y lo ya construido de la v1.6.2 (placa de
cámara sin nombre inventado + cintillo animado en el canvas).

**Sobre qué se aplica:** el repo en el estado de la **v1.6.1 publicada**
(commit `ce74365`). Este paquete YA trae dentro los cambios de la v1.6.2:
no hay que aplicar la v1.6.2 por separado.

**Qué NO toca:** `.env.example` (ni se incluye), `lib/supabase/serverLogin.js`,
ningún test existente salvo `scripts/streaming-chain.test.mjs`, reescrito
con justificación escrita en su propia cabecera (verificaba la cadena
reemplazada; sus invariantes se re-verifican donde ahora viven).

---

## La idea en una frase

Antes: el mismo programa se codificaba por software hasta CUATRO veces
(MediaRecorder de streaming, MediaRecorder dedicado de grabación, un
FFmpeg libx264 por destino y otro para grabar) compitiendo por la misma
CPU que compone el canvas. Por eso todo se trababa.

Ahora: **captura → composición → UNA codificación → reparto con copia.**

- Si la plataforma ofrece WebCodecs H.264 (Chromium/Electron sí, con
  aceleración por hardware cuando el equipo la ofrece), el renderer
  codifica el programa UNA vez y el proceso principal solo mezcla y
  reparte copias: destinos RTMPS y grabación reciben el MISMO flujo.
- Si no, el WebM de siempre entra a UN solo proceso que lo transcodifica
  UNA vez con el codificador sondeado (h264_mf primero — en tu máquina
  rindió 93 fps —, libx264 de respaldo) y reparte igual.
- Grabar mientras se transmite ya no levanta una segunda cadena: la
  grabación es un consumidor más del mismo flujo.
- Los 4 formatos se siguen derivando del máster al exportar, como antes.

## Qué cambia por raíz

**Raíz A (cadena de video/encoders) — núcleo nuevo**
- `electron/program-core.js` (NUEVO): proceso único de programa, buffer
  de unión por keyframes (un destino que reconecta o la grabación que
  arranca a mitad del vivo se unen en el último keyframe, sin historial
  y sin flujo inválido), reparto con `-c copy`, reconexión con los
  mismos tiempos de antes (5/10/20/40/60 s, máx. 5), cola con tope de
  32 MB, telemetría REAL parseada del proceso (sin cifras inventadas).
- `electron/stream-encoder.js` (NUEVO): sonda de codificador — codifica
  1 s real una vez por sesión, h264_mf primero, resultado cacheado; si
  un codificador muere en vivo, la sesión aprende el otro.
- `src/utils/programEncoder.js` (NUEVO): sonda WebCodecs + bomba de
  fotogramas que NUNCA bloquea la composición (si el codificador se
  atrasa, descarta fotogramas en vez de frenar el canvas).
- El grabador dedicado del renderer y los workers por destino
  DESAPARECEN. Detener ya no espera trabajos pesados: el cierre lo hace
  el núcleo y el progreso va por el IPC `finalize-progress` de siempre.
- Si WebCodecs muere a mitad de sesión, la app voltea sola al modo WebM
  sin reiniciar la composición ni cortar el directo.

**Raíz B (segunda cámara)**
- La decodificación por cámara ya era única desde la v1.6.1 (verificado:
  miniatura y motor comparten el mismo elemento `<video>`); eso no se tocó.
- Nuevo presupuesto de bus USB por formato (`src/utils/usbBudget.mjs`):
  máximo 2 cámaras abriendo a 1080p a la vez; la tercera en adelante abre
  a 720p con un aviso que lo explica. Decisión previa a la apertura, SIN
  medir fps y SIN guardar la rebaja (esto NO es la escalera de la v1.6.0):
  si desconectas una 1080p, la próxima apertura vuelve a evaluarse.
  Un solo reintento un escalón abajo si el driver rechaza las constraints.

**Raíz C (audio)**
- Fuera la inyección del micro por defecto de la PC dentro del stream de
  la cámara máster. Cada ranura suena SOLO con: su micro emparejado por
  hardware, o la fuente que TÚ elijas en el modal de la cámara («FUENTE DE
  AUDIO»: emparejado / Sin audio — bloqueado / cualquier micrófono de la
  lista). La elección se guarda por cámara y se puede cambiar en caliente.

**Raíz D (controles honestos)**
- Autoenfoque: ahora comprueba `getCapabilities()` antes y confirma con
  `getSettings()` después. Si la cámara no expone control de foco, el
  botón lo dice en su título y no finge el bloqueo; si el driver ignora
  la orden, el estado refleja lo confirmado, no lo deseado.
- Teleprompter: el bucle de desplazamiento ahora mueve TAMBIÉN la caja de
  lectura del panel (antes solo movía el overlay del programa, que no es
  lo que lees: por eso decía «Leyendo» y el texto no subía).

**v1.6.2 (incluida)**
- La placa con el nombre de la cámara solo se dibuja si tú la configuras.
- El cintillo del canvas recupera su animación de entrada/salida.

## Aplicación (Antigravity, en este orden, DETENERSE ante cualquier diferencia)

1. `git status` primero. Si hay archivos modificados fuera de esta lista,
   detenerse y reportar cuáles (lección del incidente `.env.example`).
2. Copiar los 13 archivos del ZIP respetando rutas. Conteos `awk` /
   `(Get-Content).Count` esperados:
   - `package.json` 82 · `electron/main.js` 3107 · `electron/stream-encoder.js` 146
   - `electron/program-core.js` 858 (nuevo) · `electron/preload.js` 128
   - `src/App.jsx` 7320 · `src/utils/masterBroadcastEngine.js` 2409
   - `src/utils/programEncoder.js` 138 (nuevo) · `src/utils/usbBudget.mjs` 47 (nuevo)
   - `scripts/streaming-chain.test.mjs` 136 · `scripts/stream-encoder.test.mjs` 90
   - `scripts/program-core.test.mjs` 196 (nuevo) · `scripts/usb-budget.test.mjs` 43 (nuevo)
   Si un conteo difiere en EXACTAMENTE 1, verificar el último byte del
   archivo antes de detenerse (regla conocida CRLF/salto final).
3. `node --test scripts/*.test.mjs` — salida COMPLETA en el reporte.
   Esperado en tu Windows: 59/59. (En el Linux de Lu: 58/59; el único
   fallo es `recording-pipeline.integration` por `ffmpeg-static` ENOENT —
   ambiental de ese Linux, también presente en la base.)
4. `npm run build` y commit: `v2.0.0 nucleo en vivo nuevo: una codificacion, reparto con copia`.
5. Generar instalador e instalar UNA vez. El arreglo de entorno de
   remotos (Supabase vivo en `.env.local`) sigue su carril propio: si aún
   no se aplicó, hacerlo ANTES de generar este instalador para reinstalar
   una sola vez en total.

## BATERÍA DE PRUEBA EN VIVO (la única puerta de cierre — numerada)

Corre en orden, en tu máquina, con tus cámaras. Reporta el número y el
resultado exacto de cada punto; si algo falla, captura de pantalla y el
número, sin seguir parchando por tu cuenta.

1. **Arranque y cámaras:** abre la app, conecta CAM 1 y CAM 2. Ambas se
   ven fluidas en miniatura y en programa, sin CONGELADA falsa tras 60 s.
2. **Calidad real:** CAM 1 en programa a pantalla completa: imagen nítida
   de 1080p, sin barrido ni grano de compresión exagerado.
3. **Audio por ranura:** abre el modal de CAM 1 → «FUENTE DE AUDIO» marca
   su micro emparejado o el elegido; habla por el micro de la PC: NO debe
   entrar al programa si no es la fuente elegida. Pon «Sin audio —
   bloqueado»: la ranura queda muda. Vuelve a elegir fuente: se oye.
4. **Autoenfoque:** botón de foco de CAM 1: si la cámara lo soporta, el
   estado cambia y se MANTIENE; si no lo expone, el título del botón lo
   dice («esta cámara no expone…») en vez de fingir el bloqueo.
5. **Teleprompter:** escribe 30+ líneas, pulsa play: el texto del PANEL
   (la caja «▲ MIRAR AQUÍ») se desplaza hacia arriba de forma continua;
   pausa lo detiene; play lo reanuda.
6. **Grabar solo:** graba 2 minutos. Al pulsar Detener, la app responde
   al instante (sin congelarse) y ofrece el video; reprodúcelo: imagen y
   sonido correctos, duración ≈ 2 min.
7. **Transmitir solo:** directo a Facebook 3 minutos: Live Producer
   muestra el video fluido y el panel de la app marca el destino EN VIVO
   con fps/bitrate reales (no fijos).
8. **Grabar MIENTRAS se transmite (la prueba reina):** con el directo del
   punto 7 en curso, pulsa Grabar y graba 3 minutos sin detener el
   directo. Nada se traba; el directo sigue fluido en Facebook. Detén la
   grabación (el directo sigue) y luego detén el directo. El video
   grabado existe y se reproduce completo.
9. **Detener responde siempre:** repite Detener de grabación con la app
   cargada (dos cámaras + directo): la respuesta es inmediata en todos
   los casos; nunca hay que forzar el cierre de la app.
10. **4 formatos:** exporta la grabación del punto 8 en los 4 formatos:
    los 4 archivos se generan con sus miniaturas y se reproducen.
11. **CAM 2 no muere:** con directo + grabación activos 10 minutos, CAM 2
    sigue viva en miniatura y al pasarla a programa se ve su imagen real.
12. **Tercera cámara (si la tienes a mano):** conecta una tercera USB:
    abre en 720p con el aviso de presupuesto USB; desconecta una de las
    1080p y reconecta la tercera: ahora abre en 1080p.
13. **Recuperación:** en pleno directo, desconecta y reconecta internet
    (o cierra y reabre el directo en Facebook): el destino se reconecta
    solo en segundos y Facebook vuelve a recibir video.
14. **Equipo completo:** con directo + grabación, abre el Administrador
    de tareas: la PC sigue usable (esta captura, ordenada por CPU, es la
    evidencia que faltaba de la Raíz A: envíala sea cual sea el resultado).

**Cierre:** el proyecto se cierra SOLO si los 14 puntos pasan en vivo.
Un fallo en un punto no se tapa con un parche rápido: se reporta con su
número y se corrige sobre este núcleo.
