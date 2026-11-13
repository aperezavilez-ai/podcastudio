# PodcastStudio v3.3.0 — Consolidación: la ventana deja de componer y el motor mezcla las cámaras locales

## La arquitectura resultante (una página)

- **El motor nativo es el centro.** Las sesiones aceptan `sources`
  (1–3 cámaras locales): la de programa va a pantalla completa en el
  compositor GPU y las demás entran como PiP en la esquina inferior
  derecha (25 % del ancho, apiladas), con layout fijo al lanzar. Cambiar
  la cámara de programa = reinicio de sesión con el orden cambiado, con
  la maquinaria de transiciones vigente (corte breve declarado). El
  audio sigue siendo el micrófono que coincide con la cámara de
  programa. Los botones reales pasan las fuentes (programa primero,
  máx. 3); con una sola cámara no se pasa `sources` y manda el camino
  unicámara ya probado por la compuerta.
- **Sonda de la vista previa independiente (significado corregido
  tras la compuerta).** Al primer arranque de una sesión de VISTA
  PREVIA, el motor intenta UNA vez abrir la misma cámara de programa
  en un proceso de vista previa independiente. Si vive (~3 s), ese
  proceso ES la vista previa (`concurrentPreview=true` en el estado y
  el panel) — y el veredicto significa exactamente eso: «la vista
  previa independiente puede vivir FUERA de sesión». Si muere,
  `concurrentPreview=false` y la vista previa es la tubería integrada
  de siempre. El veredicto se reutiliza todo el arranque de la app;
  no hay reintentos en bucle.
  **Lo que la compuerta cazó antes de publicar:** la primera versión
  de esta sonda hacía vivir ese proceso EN PARALELO a la sesión de
  grabación (la sesión nacía sin su rama de preview integrada), y
  record, recordStream y multicam murieron a los ~2 s con «Failed to
  read sample» del lector Media Foundation: el driver de la Steren NO
  sirve a dos lectores de la misma cámara — la sonda había medido la
  convivencia contra la sesión de vista previa, que es un solo
  lector. Corregido dentro de esta misma v3.3.0: ningún arranque de
  grabación/transmisión lanza ni mantiene vivo el proceso
  independiente; si quedara uno (vivo o cerrándose), se detiene y se
  ESPERA su salida completa antes de lanzar la tubería de la sesión;
  y en sesión la vista previa es la rama integrada de siempre (la
  forma probada de la v3.2.3).
- **Teleprompter sobre la vista previa (solo FUERA de sesión, y solo
  si la sonda dio true).** El proceso independiente de la vista
  previa lleva un `textoverlay` SIN fondo con el tramo visible del
  guion (~6 líneas); la app envía el tramo nuevo por IPC
  (`native-engine:set-preview-text`) solo cuando cambia y solo fuera
  de sesión, y el motor relanza únicamente ese proceso. DURANTE una
  grabación/transmisión el texto sobre la vista previa NO existe: el
  sondeo de la app se detiene en esas fases y el motor trata
  cualquier llamada como un no-op declarado (queda anotado en el
  estado); en sesión manda el teleprompter de hoy — recuadro del
  panel con su desplazamiento propio + overlay en la ventana —. Si la
  sonda dio false, el teleprompter queda como hoy en todo momento.
  La banda de estado del motor lo dice tal cual: «Teleprompter:
  sobre la vista previa» fuera de sesión con sonda true; «el de la
  ventana» en sesión o sin concurrencia.
- **Dieta de la ventana.** Con GStreamer presente («modo motor»), el
  bucle de composición de programa por canvas NO arranca: el Worker de
  composición queda en reposo y el monitor de programa de la ventana ya
  no se monta (mandan la vista nativa del motor y los mosaicos). Sin
  GStreamer, o con ISO activo, la cadena heredada se comporta
  EXACTAMENTE como hoy. Durante una sesión nativa, la ventana LIBERA
  las cámaras que el motor está usando (detiene sus tracks de
  getUserMedia) y sus mosaicos muestran la última foto fija + el rótulo
  «En el motor nativo»; al terminar la sesión, las readquiere por el
  camino de siempre. Las cámaras remotas nunca se liberan ni se tocan.
  El área de programa en modo motor muestra una banda con el estado
  real del motor (fase, cámaras, formato, modo de apertura,
  concurrencia) y el botón «Ver vista previa».
- **El instrumento ventana-diag se queda** (llegó local con la
  diagnóstica y esta versión lo incorpora): sigue registrando en
  `%APPDATA%\PodcastStudio\logs\ventana-diag.log` el latido del main,
  el retraso de los pings del renderer ([ping], agregado 1 Hz), los
  eventos de foco y las muestras de composición. Es la aceptación del
  atasco: la meta es que durante las ausencias de Luis ningún segundo
  registre maxLag > 1000 ms.

## Lo que se queda intacto

- La página del invitado remoto (`RemoteCam.jsx`), las ranuras remotas
  (`remoteCameraSlots.mjs`), el modal de invitados
  (`MultiGuestRoomModal.jsx`) y el backend: byte a byte como estaban.
- El compositor de destinos de transmisión y sus URL, la exportación
  desde el máster nativo, los paneles y la lógica de la app que no se
  nombra arriba.
- El motor en lo ya probado: direccionamiento por device-index con su
  reintento declarado, la topología del Hito 1 B, la regla de audio,
  las subidas/bajadas de sesión de la v3.2.2 y el vigilante de la
  v3.2.1.

## Frontera declarada

El invitado remoto DENTRO de la señal del programa queda fuera también
de esta consolidación: su conexión y su página siguen como están, y su
video no entra todavía a la mezcla del motor.

## Secuencia de publicación (Antigravity, sobre HEAD 0e8acc8)

Reglas: ante cualquier dato que no cuadre, DETENTE y reporta el dato
exacto; no improvises. Si la compuerta de humo no pasa, NO publiques.

PASO 0 — El HEAD debe ser 0e8acc8. Descomprime
podcastudio-v330.zip en la raíz del repo y reemplaza/crea. Conteos con
(Get-Content <archivo>).Count:
- package.json 83 (solo cambia "version": "3.3.0")
- electron/native-engine.js 1568
- electron/main.js 3356
- electron/preload.js 152
- electron/ventana-diag-core.js NUEVO 59
- src/App.jsx 8625
- src/utils/masterBroadcastEngine.js 2577
- scripts/smoke-motor.mjs 264
- scripts/native-engine.test.mjs 1647
- scripts/native-window-diet.test.mjs NUEVO 235
- scripts/ventana-diag.test.mjs NUEVO 79
- scripts/focus-governor.test.mjs 201
- LEEME-v330.md NUEVO (este archivo)
src/pages/RemoteCam.jsx, src/utils/remoteCameraSlots.mjs y
src/components/MultiGuestRoomModal.jsx NO deben aparecer en git status.

PASO 1 — COMPUERTA DE HUMO AMPLIADA (obligatoria): cierra la app por
completo (ningún proceso de PodcastStudio vivo) y desde la raíz del
repo corre: node scripts/smoke-motor.mjs. Debe terminar en
«SMOKE RESULTADO: PASA», incluyendo el paso multicam si la máquina
enumera ≥2 cámaras Media Foundation (con 1 cámara, «SMOKE multicam:
SKIP» declarado es válido). La línea «SMOKE concurrencia: OK|INFO» se
reporta tal cual: es informativa y no bloquea; su significado es que
la vista previa independiente puede vivir FUERA de sesión (la sonda
corre en el paso preview), nunca en paralelo a una grabación. Si el
resultado NO es PASA, DETENTE: no commitees ni publiques nada y
repórtame la salida COMPLETA del script, textual.

PASO 2 — Suite y build: node --test → esperado 194 = 193 pass + 0 fail
+ 1 skip. npx vite build en verde.

PASO 3 — Publicación: commit con el mensaje exacto «v3.3.0:
consolidación — la ventana deja de componer y el motor mezcla las
cámaras locales», push a main, genera el instalador, reporta el tamaño
exacto de «PodcastStudio Setup 3.3.0.exe» e instálalo.

PASO 4 — Lanzador raíz (obligatorio): npm run build:exe y verifica que
D:\PROGRAMAS IA\PODCASTUDIO\PodcastStudio.exe quede en versión de
archivo 3.3.0.0, igual a la versión de la app instalada (3.3.0).
Commitea la sincronización del lanzador con el mensaje «build: sync
PodcastStudio.exe launcher to v3.3.0.0» y push.

PASO 5 — Reporta: HEAD antes y después, conteos, la salida del smoke
paso por paso (incluidas las líneas de concurrencia y multicam) y su
línea final, totales de la suite, tamaño del instalador, versión del
lanzador y de la app instalada. NO pruebes la app: la prueba en vivo
la hace Luis.

## Aceptación posterior (con la app instalada, la hace Luis)

1. Abre la app con las cámaras conectadas, sin grabar ni transmitir.
2. Vete al navegador (u otra ventana) durante 1 minuto y regresa a
   PodcastStudio. Repite una segunda vez.
3. Comprueba en el acto: la app responde al primer clic, sin ponerse
   al día con trabajo atrasado.
4. Antigravity lee %APPDATA%\PodcastStudio\logs\ventana-diag.log y
   reporta el mayor retraso [ping] registrado durante esas ausencias.
   META: ningún segundo con maxLag mayor de 1000 ms. Si la meta no se
   cumple, se reporta el número real, sin maquillarlo.
