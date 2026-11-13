# PodcastStudio v3.2.2 — sesiones combinadas del motor nativo

Corrección de UN solo defecto sobre la v3.2.1. Léelo completo antes de tocar nada.
Regla general: ante cualquier dato que no cuadre, DETENTE y reporta el dato exacto; no improvises.

## El defecto

Con el motor nativo gobernando, las SUBIDAS de sesión a mitad de camino estaban rotas
(preexistente del Hito 3, detectado en la auditoría de la v3.2.1):

- Transmitiendo y pulsar **Grabar** → el motor rechazaba el arranque con
  «Ya hay una sesión del motor nativo en curso» y no pasaba nada más.
- Grabando y pulsar **Transmitir** → el mismo rechazo.

Causa: los manejadores de subida de `src/App.jsx` llamaban `bridge.start({ session: 'recordStream', … })`
con la sesión anterior TODAVÍA EN CURSO. El rechazo del motor es CORRECTO (no admite dos
sesiones) y no se toca. El diseño aprobado del Hito 3 dice lo contrario de lo que hacía el
código: la transición REINICIA la tubería como sesión combinada. Las bajadas (Detener
grabación transmitiendo / Detener transmisión grabando) ya funcionaban porque paran primero.

## El arreglo (solo `src/App.jsx`; el motor NO se toca)

En ambas subidas, con la transición marcada como ORDENADA (`nativeBusyRef`, el mecanismo de
la v3.2.1, para que el vigilante no la confunda con una muerte del motor):

1. Se detiene la sesión actual (`await bridge.stop()`) y se espera la fase «apagado».
2. Se arranca la sesión combinada `'recordStream'` con los parámetros correctos (los destinos
   reales ya compuestos si se sube a transmitir; el nombre de proyecto del máster si se sube
   a grabar), reutilizando la confirmación por fase de la v3.2.1: lo nuevo queda PENDIENTE
   hasta que la fase «grabando-transmitiendo» se sostiene; lo que ya estaba encendido en la
   UI no se apaga ni parpadea durante el reinicio, y el aviso «Reconectando sesión…» se
   muestra mientras tanto.
3. Si la combinada NO arranca (rechazo del lanzamiento): estado honesto — se apaga también
   el lado anterior en la UI y un aviso declara el error del motor y que la sesión anterior
   terminó. Nada de estados falsos ni reintentos en silencio.
4. Guarda: si el otro lado aún está en arranque pendiente de confirmación (todavía no hay
   sesión confirmada), la subida no reinicia nada y pide esperar la confirmación.

Comportamiento declarado de la subida a transmitir: la parada de la grabación cierra y
valida su máster, y la sesión combinada graba un máster NUEVO (igual que en las demás
transiciones declaradas). Durante cualquier reinicio de sesión el directo se reconecta:
los destinos pueden notar un corte breve. La vía heredada (sin GStreamer) y los caminos
ISO no cambian.

Pruebas nuevas: `scripts/native-session-upgrade.test.mjs` (7) verifica sobre el código
fuente el orden parar→esperar→arrancar en ambos manejadores, la marca de transición
ordenada, la limpieza honesta si la combinada falla, la reutilización del pendiente por
fase y que el motor sigue rechazando sesiones concurrentes.

## Archivos del paquete (4)

- `package.json` — 83 líneas; solo cambia `"version": "3.2.2"`.
- `src/App.jsx` — 8166 líneas (v3.2.1: 8099).
- `scripts/native-session-upgrade.test.mjs` — NUEVO, 98 líneas.
- `LEEME-v322.md` — este archivo (raíz del ZIP).

NO deben cambiar ni aparecer en `git status`: `electron/native-engine.js` (969),
`electron/main.js` (3265), `electron/preload.js` (145), `electron/export-args.js` (147),
`scripts/smoke-motor.mjs` (191), `scripts/native-engine.test.mjs` (853).

## Secuencia de aplicación y publicación

**PASO 0 — Base correcta.** Este paquete se aplica SOBRE la v3.2.1 publicada. Verifica con
`git log --oneline -3`: el HEAD debe ser el de la v3.2.1 publicada (su commit de publicación
y/o encima el commit de sincronización del lanzador a 3.2.1.0). Si el HEAD es `c9f40f8`
(v3.2.0) o anterior, DETENTE y repórtalo: la v3.2.1 aún no se publicó y este paquete no
aplica todavía. Descomprime el ZIP en la raíz del repo y reemplaza/crea los 4 archivos.

**PASO 1 — Conteos.** Con `(Get-Content <archivo>).Count`: package.json 83,
src/App.jsx 8166, scripts/native-session-upgrade.test.mjs 98, LEEME-v322.md (este archivo,
en la raíz del repo). Confirma que los archivos intocables listados arriba NO aparecen en
`git status`.

**PASO 2 — COMPUERTA DE HUMO (obligatoria, antes de publicar).** Cierra la app por
completo (ningún proceso de PodcastStudio vivo) y desde la raíz del repo corre:
`node scripts/smoke-motor.mjs`. Arranca el motor real contra la cámara real (preview,
grabación y grabación+transmisión local, ~6 s cada una; la grabación debe salir válida).
Si la salida final NO es «SMOKE RESULTADO: PASA», DETENTE: no commitees ni publiques nada
y reporta la salida COMPLETA del script, textual.

**PASO 3 — Suite y build.** `node --test` → esperado **128 = 127 pass + 0 fail + 1 skip**
(el skip es la prueba de grabación con FFmpeg de sistema, como en la v3.2.1).
`npx vite build` en verde.

**PASO 4 — Publicación.** Commit con el mensaje exacto:
`v3.2.2: sesiones combinadas del motor nativo — grabar mientras se transmite reinicia la sesión`
Push a `main`. Genera el instalador y reporta el tamaño exacto de
`PodcastStudio Setup 3.2.2.exe`. Instálalo.

**PASO 5 — Lanzador raíz (obligatorio).** `npm run build:exe` y verifica que
`D:\PROGRAMAS IA\PODCASTUDIO\PodcastStudio.exe` quede en versión de archivo **3.2.2.0**,
igual a la versión de la app instalada (3.2.2). Commitea la sincronización del lanzador
con el mensaje `build: sync PodcastStudio.exe launcher to v3.2.2.0` y push.

**PASO 6 — Reporte, SIN probar la app** (la prueba en vivo la hace Luis): HEAD antes y
después, conteos, resultado del smoke paso por paso y su línea final, totales de la suite,
tamaño del instalador, versión del lanzador y de la app instalada.

## Sin verificar (solo la máquina de Luis lo prueba)

Las subidas reales contra su cámara y sus destinos (Transmitir → pulsar Grabar en vivo, y
Grabar → pulsar Transmitir), el corte breve de reconexión en los destinos y el
comportamiento del vigilante si la combinada muere a mitad de sesión.
