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
