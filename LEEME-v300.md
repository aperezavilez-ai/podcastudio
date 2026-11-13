# PodcastStudio v3.0.0 — «Motor PodcastStudio» (motor propio, costura por archivo)

Paquete autocontenido aplicable sobre la **v2.0.0 publicada** (commit `f35a192`).
La v2.1.0 (puente a un programa externo) quedó **vetada por Luis y NO se aplica**:
PodcastStudio es un producto propio y autónomo, pensado para venderse. Esta
versión estrena el motor de la casa con la arquitectura de un motor de
transmisión completo: captura → composición → UNA codificación → salidas,
donde **el disco es la fuente de verdad** y ningún byte viaja por un tubo
ciego de JavaScript.

## Qué cambia, por raíz

- **Costura nueva (la que mató a la v1.5, la v1.6.1 y la v2.0)**: el
  codificador del programa escribe a un **archivo maestro en crecimiento**
  (`electron/master-file.js`). La grabación **es** ese archivo (rangos
  byte-exactos del maestro; al detener se deriva el MP4 desde archivos
  completos y seekables). El streaming **lee del archivo** con un lector
  que solo entrega bytes tras superar una **compuerta** comprobada sobre el
  propio archivo (cabecera válida + secuencia + primer keyframe + mínimo
  de bytes): ningún FFmpeg nace ya contra un tubo vacío, y todo mapeo que
  puede no tener flujo es opcional (`?`).
- **Arranque observable**: el stderr de TODOS los procesos (también el de
  la derivación de grabación) se vuelca a `userData/logs/streaming.log`, y
  el núcleo anuncia su modo y su codificador activo.
- **Autoprueba integrada**: al arrancar la app (y con el botón «Ejecutar
  autoprueba» en Transmisión » Motor PodcastStudio) el motor graba ~3 s,
  valida el archivo y publica el veredicto **en la interfaz**: modo
  (WebCodecs/WebM), codificador real, resolución y fps **medidos**. Si
  falla, se ve en rojo con la causa antes de grabar en serio.
- **Escalera 1080 → 4K**: perfiles de programa 1920×1080 (mínimo de diseño
  y por defecto), 2560×1440 y 3840×2160, con bitrates de máster 10/20/40
  Mbps. El streaming sale como máximo a 1080p («Grabas en 4K · transmites
  en 1080p», declarado en la UI). La UI muestra la resolución/fps reales
  negociados, no rótulos.
- **Presupuesto USB extendido**: una cámara 2160p consume el presupuesto
  de dos de 1080p (decisión previa por formato, sin medir fps bajo carga
  y sin persistir rebajas — la escalera adaptativa de la v1.6.0 sigue
  prohibida y no vuelve).
- **Fuera la rama OBS**: se retiran `electron/obs-bridge.js`, sus handlers
  y su sección de UI, dejando esas superficies como estaban en la v2.0.0.
  Se conserva todo lo demás de la v2.0.0 (audio explícito por ranura,
  autoenfoque verificado, teleprompter, badge/cintillo).

## Aplicación (para Antigravity)

El ZIP contiene 15 archivos de código/tests + este LEEME (que NO entra al
commit). Ante cualquier dato que no cuadre: DETENERSE y reportar exacto.

PASO 0 — El árbol parte de la v2.0.0 publicada (HEAD `f35a192`, limpio).
`electron\obs-bridge.js` y `scripts\obs-bridge.test.mjs` **no deben
existir** (eran de la rama vetada, nunca publicada); si existieran,
reportarlo antes de seguir. Reemplazar los 15 archivos del paquete.

PASO 1 — Conteos (PowerShell, EXACTOS, `(Get-Content <archivo>).Count`):
```
package.json = 82                          (version: "3.0.0")
electron\main.js = 3162
electron\preload.js = 132
electron\program-core.js = 1314
electron\master-file.js = 484              (nuevo)
src\App.jsx = 7516
src\utils\masterBroadcastEngine.js = 2428
src\utils\programEncoder.js = 154
src\utils\programProfiles.mjs = 64         (nuevo)
src\utils\usbBudget.mjs = 82
scripts\program-core.test.mjs = 350
scripts\streaming-chain.test.mjs = 172
scripts\master-file.test.mjs = 274         (nuevo)
scripts\program-profiles.test.mjs = 66     (nuevo)
scripts\usb-budget-ladder.test.mjs = 70    (nuevo)
```
Si alguno difiere en EXACTAMENTE 1, verificar el último byte con
`[System.IO.File]::ReadAllBytes` y reportarlo tal cual, sin «corregirlo».

PASO 2 — Tests: `node --test scripts/*.test.mjs` → esperado **80
registrados, 0 fallos**; son válidos los SKIP de las pruebas que buscan un
FFmpeg de sistema si en Windows no resuelven (la app usa su FFmpeg
empaquetado; en el Linux de Lu la suite dio 79 pass + el fallo ambiental
conocido de recording-pipeline por ffmpeg-static, que en Windows pasa).
Reportar la salida real completa.

PASO 3 — Build: `npm run build` en verde. Después `npm run build:app` y
reportar ruta y tamaño exacto de «PodcastStudio Setup 3.0.0.exe».

PASO 4 — Commit y push: commit «v3.0.0 motor PodcastStudio propio:
costura por archivo, autoprueba y escalera 1080-4K»; reportar el hash.

## Batería de prueba de vida (Luis, corta y en orden)

- **B0 · Autoprueba**: instala el Setup 3.0.0, abre la app y espera unos
  segundos: en Transmisión » **Motor PodcastStudio** la autoprueba corre
  sola al arrancar. Debe quedar en **verde** con modo, codificador real,
  resolución y fps medidos. **Manda captura de ese panel** (si sale en
  rojo, la captura con la causa escrita vale igual: es el diagnóstico).
- **B1 · Grabar 60 s**: con tus dos cámaras vivas, graba 60 segundos,
  detén y verifica: el MP4 máster está en la carpeta del proyecto, se
  reproduce con imagen y audio, dura ~60 s, y la app NO se alentó durante
  la grabación.
- **B2 · Grabar + transmitir 60 s a la vez** (la prueba reina): transmite
  a Facebook (audiencia de prueba) **mientras grabas** durante 60 s.
  Facebook recibe el video en vivo y, al detener ambas cosas, el MP4
  máster es válido y completo.
- **B3 · Perfil 4K (solo si tienes una cámara que entregue 4K de
  verdad)**: elige el perfil 2160p en «Perfil de programa», graba 30 s y
  verifica que la lectura del programa y el archivo corresponden a 4K
  real; la transmisión sigue saliendo a 1080p, como declara la UI.

Reporta por letra (B0–B3). Como siempre: nada se da por corregido hasta
que esta batería pase en tu máquina.
