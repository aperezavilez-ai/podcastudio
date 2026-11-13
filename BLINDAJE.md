# BLINDAJE — lo que ya funciona NO se toca

Orden de Luis (2026-11-13, tras confirmar en vivo que con la v3.3.0 la ventana
ya no se traba al cambiar al navegador): «ya no rompas eso que funciona,
blíndalo». Este archivo es la constancia del blindaje y su regla.

## La regla

Los archivos y regiones de este documento quedan **CONGELADOS**: ninguna
versión futura edita ni una línea de su comportamiento sin cumplir, todo
junto y declarado en el paquete que lo toque:

1. suite completa en verde,
2. compuerta `scripts/smoke-motor.mjs` en PASA en la máquina de Luis,
3. aceptación en vivo de Luis de nuevo.

Si un paquete necesita tocar algo congelado, lo declara en su LEEME con el
motivo ANTES de aplicarse; en silencio, jamás.

## Archivos congelados completos (byte-idénticos)

Hashes SHA-256 y conteos a la v3.3.0 publicada (HEAD `db16148`), verificados
antes y después de construir la v3.3.1:

| Archivo | Líneas | SHA-256 |
|---|---|---|
| `src/utils/masterBroadcastEngine.js` (dieta de ventana + gobernador de foco: la cura de la traba) | 2577 | `b270214b11fc7f68d05120f0180ed89472de760f55a2b7464cb229d42d98558e` |
| `electron/ventana-diag-core.js` (núcleo del instrumento ventana-diag) | 59 | `5e94cd54c3f60b3816d841881a46609625025265877f30774d207b772c7693e7` |
| `electron/main.js` (ganchos del instrumento ventana-diag en el proceso principal) | 3356 | `adc3d932c233490d03d189c2f0ba7e1ce257e9d7ee37c3672ab067b9821cb488` |

## Regiones congeladas dentro de archivos vivos

`src/App.jsx` sí evoluciona (ranuras, paneles, sesiones), pero sus ganchos del
instrumento ventana-diag quedan congelados con la misma regla: el ping del
renderer cada 500 ms, el `visibilitychange` a `[foco]`, la muestra `[muestra]`
cada 5 s, el registro `[prompter]`, y la llamada de la dieta
(`setNativeWindowDiet`) que deja en reposo el bucle de composición en modo
motor. La v3.3.1 tocó `src/App.jsx` en las ranuras y en la composición de
fuentes nativas SIN tocar esas regiones (diff revisado región por región).

## Por qué estos y no otros

- La **traba al cambiar de ventana** era el defecto que más versiones
  reprobadas costó; su cura (dieta + gobernador) quedó probada EN VIVO por
  Luis el 2026-11-13. Congelarla es lo que impide que un arreglo de otra cosa
  la vuelva a romper, que es exactamente el patrón que Luis denunció.
- El **instrumento ventana-diag** es el juez permanente: su registro
  (`%APPDATA%\PodcastStudio\logs\ventana-diag.log`) es la evidencia con la
  que se acepta o se rechaza cualquier versión futura de la ventana.

## Declaraciones de no-regresión por versión

Cada paquete declara aquí sus chequeos contra lo ya aceptado en vivo por
Luis: la traba de ventana (v3.3.0), las sesiones del motor tras la
compuerta y el diseño de un solo lector (v3.3.0 + su corrección), las
reglas de ranuras y programa (v3.3.1) y el teleprompter (v3.3.2).

- **v3.3.3** (frente remoto + cesión de la vista previa): archivos
  congelados byte-idénticos (sha256 verificados antes y después, arriba en
  el historial de esta serie). Lo aceptado no se tocó: la dieta y el
  gobernador de la ventana no cambian; en el motor solo se movió la PUERTA
  de `start()` para que la vista previa ceda ante record/recordStream
  (defecto C), fijado por 3 pruebas nuevas de transiciones — las suites
  que fijan lo demás (un solo lector, subidas v3.2.2, multicámara,
  programa) corren intactas y en verde —; las reglas de ranuras de la
  v3.3.1 (destino explícito, deviceId recupera su ranura, primera libre)
  no se modifican: la guarda de ocupación de la v3.3.3 las REFUERZA en el
  camino que faltaba (la re-emisión cloud). Chequeos: suite completa en
  verde, compuerta de humo antes de publicar y aceptación en vivo de Luis
  (ocupación, lente y cesión) como en cada versión.

- **v3.3.4** (la ranura prestada al motor queda bloqueada + el HUD
  recuerda su estado): archivos congelados byte-idénticos (sha256
  verificados antes y después de construir: `masterBroadcastEngine.js`
  `b270214b…`, `ventana-diag-core.js` `5e94cd54…`, `main.js` `adc3d932…`)
  y `electron/native-engine.js` intacto. Lo aceptado no se tocó: la dieta
  D2 conserva su comportamiento de liberación/readquisición — solo se le
  añade disciplina de ocupación al decidir el destino de la vuelta y el
  registro completo (stream + meta) en la rama de respaldo —; la cesión
  de la vista previa de la v3.3.3 queda intacta (la puerta de `start()`
  del motor no se editó); las reglas de ranuras de la v3.3.1/v3.3.3 no
  cambian de semántica: el predicado único gana UNA fuente más
  («liberada-al-motor») y todos los caminos la consultan, con las
  suites de ranuras anteriores intactas y en verde; el teleprompter de
  la v3.3.2 no se toca salvo la persistencia de su interruptor HUD
  (localStorage), sin tocar su geometría ni su reloj. El instrumento
  ventana-diag no se modifica: se USA su canal existente con líneas
  nuevas `[ranura]` desde `App.jsx`, como ya hacen las `[prompter]`.
  Chequeos: suite completa en verde (con la prueba de regresión del
  escenario exacto de Luis: CAM 2 prestada al motor + llegada del
  celular), compuerta de humo antes de publicar y aceptación en vivo de
  Luis (ocupación con el motor en marcha, retorno a CAM 2 y HUD que
  conserva su estado al reabrir la app).

## Teleprompter � CONGELADO en v3.3.5 (2026-11-13)
Verificado en vivo por Luis: el texto sale sobre la c�mara m�ster, entra desde abajo y el HUD nace activo. PROHIBIDO tocar el estado del HUD (showFloatingPrompter y su persistencia), projectTeleprompterOverlay, el montaje del overlay y src/utils/teleprompter.mjs sin repetir suite + compuerta + aceptaci�n en vivo de Luis.
