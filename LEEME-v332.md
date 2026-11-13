# PodcastStudio v3.3.2 — Teleprompter reconstruido

**Qué es:** la reconstrucción del teleprompter pedida por Luis («reconstruye
todo eso de teleprompter, hazlo realmente funcional»), con el alcance
revisado tras su evidencia en vivo sobre la v3.3.1 y su orden de limpieza
del recuadro de la cámara máster. Un solo estado, un solo reloj acotado al
final del texto, el overlay sobre la región de la cámara de programa en
CUALQUIER modalidad, el texto entrando por el borde inferior, jamás dentro
de la mezcla de grabación/stream, y el recuadro máster limpio.

**Base:** v3.3.1 publicada (HEAD `1446712`). Al aplicar, el árbol llega a
versión **3.3.2**.

---

## 1. La evidencia (corregida)

Del `ventana-diag.log` real de la sesión de Luis con la v3.3.0 (556 líneas
`[prompter]`): en las 551 muestras periódicas el HUD estuvo **OFF** y el
overlay **AUSENTE** el 100 % del tiempo, mientras el reloj de
desplazamiento avanzaba de `y=0` a `y=12437` y los INICIAR/PAUSAR sí se
registraban. El recuadro del panel desplazaba y saturó en 94 px con un
guion de 29 palabras.

**Corrección con la evidencia en vivo de la v3.3.1 (capturas de Luis):**
el overlay SÍ se monta y se ve sobre el programa cuando el interruptor
**«HUD Activo»** está encendido. El HUD=OFF eterno del log se explica
porque en aquella sesión Luis pulsaba el botón **«HUD Cámara»** — el
residuo de la ventana flotante de vidrio retirada en la v3.2.1 — que
alternaba otro estado y jamás tocaba el que el overlay lee. Los defectos
reales que Luis dictó tras verlo funcionar son los cuatro blancos del
§3, más la limpieza del §4.

## 2. Causas raíz encontradas EN CÓDIGO (numeración v3.3.1)

1. **Dos interruptores para dos estados distintos.** El botón «HUD
   Cámara» alternaba `showPrompterHUD` (residuo de la ventana de vidrio)
   y el overlay leía `showFloatingPrompter`, gobernado por el botón
   «HUD». La etiqueta de este último además cambiaba con el estado
   («HUD Cámara» apagado / «HUD Activo» encendido), invitando al error.
2. **Segunda compuerta invisible del montaje** (`src/App.jsx:6278`):
   `{showFloatingPrompter && (!isRecording || !teleprompterHideInRec) &&
   (…)}`, con `teleprompterHideInRec = useState(true)` (`:810`) y su
   setter sin ningún uso en el archivo: grabando, el overlay no se
   montaba ni con el HUD encendido.
3. **El manejador bueno era código muerto.** `handlePlayTeleprompter`
   (`src/App.jsx:3226`), el único con guarda de fin de guion, no lo
   llamaba nadie; el botón de transporte alternaba el estado a pelo.
4. **El reloj avanzaba sin cota** (`teleprompterYRef.current +=
   moveAmount`, ~`:3061`, con el comentario «avanza SIEMPRE… esté
   montada la superficie que esté montada») → `y=12437` con un guion
   de 29 palabras.
5. **Dos relojes divergentes y un acumulador zombi:** el reloj del
   overlay y un segundo rAF («puerto seguro») que desplazaba la caja
   del panel con acumulador propio; `panelPrompterScrollRef` (`:833`)
   se escribía en los resets y no se leía en ninguna parte.
6. **El texto SÍ podía entrar a la mezcla heredada.**
   `masterBroadcastEngine.js:1498-1541` dibuja el texto del
   teleprompter en el canvas de composición (`ctx.fillText`, con su
   propio scroll por tiempo) si el estado publicado trae
   `isTeleprompterPlaying && teleprompterText`. Ese canvas es la señal
   grabada/transmitida del camino heredado. El archivo está congelado
   por el BLINDAJE, así que la exclusión se construye desde `App.jsx`
   (blanco 3 del §3) sin tocarlo.

## 3. Los cuatro blancos de la revisión de alcance

1. **Entrada desde abajo.** La franja anterior cubría solo el 48 %
   inferior y el texto emergía «desde el medio». Ahora la proyección
   cubre la región de programa completa y posiciona el texto con
   `translateY = alturaRegión − desplazamiento`: con desplazamiento 0
   la primera línea está exactamente en el **borde inferior** del
   video y sube al reproducir. El reinicio lleva el reloj a 0, así que
   INICIAR tras REINICIAR también entra desde abajo.
2. **En cualquier modalidad.** El tile de la cámara de programa lleva
   la marca `data-pgm-tile="1"` en el único `map` de tiles del monitor.
   La proyección mide ese tile (`getBoundingClientRect` contra el
   contenedor) y coloca la franja del overlay **sobre la región de la
   cámara PGM** en vista máster y en mosaicos de 2/3/4, recolocándose
   al cambiar layout, cámara de programa o tamaño de ventana. Sin tile
   (espejo iPad), el respaldo es el contenedor completo.
3. **Nunca a la mezcla.** Por construcción: (a) el overlay es una capa
   DOM sobre el monitor — no hay html2canvas/dom-to-image en el árbol
   y la captura heredada es `canvas.captureStream` desde elementos
   `<video>`, nunca del contenedor; (b) la app publica al motor de
   composición heredado `teleprompterText: ''` e
   `isTeleprompterPlaying: false`, así que la condición de dibujo del
   motor congelado (`masterBroadcastEngine.js:1498-1541`) queda sin
   alimento sin tocar el archivo blindado — verificado por prueba;
   (c) el máster nativo es limpio por diseño.
4. **Un solo interruptor.** Queda UN solo control de HUD: el botón de
   la sección Teleprompter, etiquetado «HUD Activo» / «HUD Inactivo»,
   que escribe el estado único. El botón muerto «HUD Cámara» y el
   estado `showPrompterHUD` fueron eliminados (el setter del estado
   único aparece exactamente 2 veces en `App.jsx`: declaración + ese
   botón). El instrumento `[prompter]` registra ese control real.

Y el diseño de fondo (encargo original): **un solo estado** (se
conservan los nombres existentes: `showFloatingPrompter`,
`isTeleprompterPlaying`, `teleprompterSpeed`, `teleprompterFontSize`,
`teleprompterText`); **montaje por función pura**
`debeMontarOverlayPrompter(estado)` en `src/utils/teleprompter.mjs` —
el overlay se monta si y solo si el HUD está encendido, sin recibir la
sección del panel, el colapso, la fase del motor ni la grabación;
**un solo reloj** `teleprompterYRef`, avanzado por un único rAF solo
si hay superficie montada y **acotado** por
`maximoDesplazamientoPrompter`/`acotarDesplazamientoPrompter` al
recorrido real (overlay: alto de franja + alto de texto, para que la
última línea salga por arriba; panel: `scrollHeight − clientHeight`,
su saturación probada); un solo manejador
`handleToggleTeleprompterPlay` para transporte y clic en la caja, con
guarda de fin de guion; en pausa, arrastrar la caja sincroniza el
reloj. El efecto «puerto seguro» y su acumulador se eliminaron, y la
muestra `[prompter]` de 1 Hz sigue saliendo del instrumento intacto.

## 4. Limpieza del recuadro de la cámara máster (orden de Luis)

**El recuadro de la cámara máster queda limpio: nada debajo, nada fijo
dentro.**

- Eliminada la **banda de estado** de la v3.3.0 bajo el monitor
  («MOTOR NATIVO · Fase · Cámara(s) · Formato · Apertura ·
  Teleprompter» y su botón «Ver vista previa»). Esa información sigue
  visible en la sección Motor Nativo del panel derecho; la acción de
  vista previa vive en ese panel. No se pierde nada.
- Eliminada la **franja fija «▲ Mirar aquí (lente de cámara)»** de
  dentro del recuadro máster (la que llevaba el overlay). El texto del
  teleprompter en desplazamiento NO es un elemento fijo y se queda.
- Revisado el resto del contenedor: fuera de los mosaicos (que llevan
  sus rótulos) y de la barra superior de la app, dentro del programa
  solo quedan la cuenta atrás (transitoria), la guía de encuadre
  (activable por el usuario, apagada por defecto) y el logo (contenido
  del usuario). Las dos pruebas D3 de la v3.3.0 que fijaban la banda se
  reescribieron como pruebas de su ausencia, con esta orden como
  justificación.

## 5. Blindaje — byte-idéntico (SHA-256, antes = después)

| Archivo | Líneas | SHA-256 |
|---|---|---|
| `src/utils/masterBroadcastEngine.js` | 2577 | `b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e` |
| `electron/ventana-diag-core.js` | 59 | `5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7` |
| `electron/main.js` | 3356 | `adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488` |
| `electron/native-engine.js` (no tocado) | 1621 | `b0b9489874d302b25dbd85e9675b973c7ff9c76ca435f849403f1cd2e845f329` |

Sin tocar tampoco: las ranuras de la v3.3.1
(`remoteCameraSlots.mjs`, `nativeProgramSources.mjs`,
`CameraConnectModal.jsx`), el transporte remoto, destinos/exportación,
`lib/supabase/serverLogin.js`, `.env.example`.

## 6. Verificación aquí (Linux)

- Suite completa: **236 pruebas = 235 pass + 1 fallo ambiental**
  (`recording-pipeline.integration`: ffmpeg-static no existe en esta
  VM; en Windows esa prueba se salta → esperado **235 pass + 0 fail +
  1 skip**). Base v3.3.1: 221. Nuevas: 15 del contrato del teleprompter
  (`scripts/teleprompter-v332.test.mjs`), la del «puerto seguro»
  reescrita en `focus-governor.test.mjs` y las 2 D3 reescritas en
  `native-window-diet.test.mjs`.
- `npx vite build` en verde (el aviso de chunk >1000 kB es
  preexistente).
- Conteos (líneas): `package.json` 83 (versión 3.3.1 → **3.3.2**);
  `src/App.jsx` 8767 → **8807**; `src/utils/teleprompter.mjs` NUEVO
  **62**; `scripts/teleprompter-v332.test.mjs` NUEVO **236**;
  `scripts/focus-governor.test.mjs` 201 → **211**;
  `scripts/native-window-diet.test.mjs` 253 → **259**; este LEEME
  **206**.

## 7. Secuencia de publicación (sobre HEAD `1446712`)

**PASO 0 — Aplicar y verificar.** Descomprimir el ZIP sobre el clon.
Conteos esperados: los del §6. Blindaje: `git status` NO debe listar
`src/utils/masterBroadcastEngine.js`, `electron/ventana-diag-core.js`
ni `electron/main.js`. Si algo no cuadra: ALTO y reportar.

**PASO 1 — COMPUERTA (obligatoria; toca el área del motor).** Con la
app CERRADA: `node scripts/smoke-motor.mjs`. Debe decir **PASA**. Si
dice NO PASA: ALTO TOTAL — no se publica; reportar la salida textual
completa.

**PASO 2 — Suite y build.** `node --test scripts/*.test.mjs` →
esperado **236 = 235 pass + 0 fail + 1 skip**; `npx vite build` en
verde.

**PASO 3 — Commit y push.**
`v3.3.2: teleprompter — entra desde abajo, sale en cualquier modalidad y nunca entra a la grabación`
y push a `main`.

**PASO 4 — Instalador y lanzador.** `npm run dist` → instalador
**«PodcastStudio Setup 3.3.2.exe»** (reportar su tamaño exacto en
bytes); instalar; `npm run build:exe`; verificar paridad: lanzador
raíz **3.3.2.0** == app instalada **3.3.2**; commit de sincronización
del lanzador y push.

**PASO 5 — ACEPTACIÓN MEDIBLE (la decide el log, no la suite).** Con
la app instalada: Luis pulsa UNA vez el interruptor **«HUD Activo»** y
luego **INICIAR**. Antigravity lee
`%APPDATA%\PodcastStudio\logs\ventana-diag.log`: las líneas
`[prompter]` deben registrar `HUD=ON` y las muestras deben decir
**`overlay PRESENTE`** (no «AUSENTE»), con `y` avanzando y
**deteniéndose en el final** del guion. Juicio visual de Luis: el
texto entra por el **borde inferior** del video; en mosaico de 2/3/4
se ve sobre la región de la cámara PGM; un máster grabado **NO**
contiene el texto; el recuadro máster está limpio (nada debajo, nada
fijo dentro). **Si el log dice lo contrario, la reconstrucción NO se
da por buena aunque la suite pase.**
