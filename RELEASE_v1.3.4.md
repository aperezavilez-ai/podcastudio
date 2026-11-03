# PodcastStudio v1.3.4

## Optimización de Arranque Instantáneo y Actualización de Versión

Este release se enfoca en resolver la lentitud y bloqueos en el arranque de la aplicación, eliminando esperas artificiales en Electron y sincronizando el ciclo de vida del launcher nativo con el motor de renderizado.

---

## 1. Corrección de Arranque Instantáneo (Fast Startup)

**Problema**: La aplicación tardaba en abrir y en ocasiones se quedaba congelada en la pantalla de carga (Splash Screen) durante 8 a 15 segundos.

**Causas identificadas**:
- `electron/main.js` contenía un `setTimeout(..., 8000)` dentro de `mainWindow.once('ready-to-show')` que demoraba la visualización de la ventana de forma innecesaria.
- El listener `ipcMain.once('app-ui-ready')` utilizaba `.once()`, lo que provocaba que si se presentaba un reintento o re-renderizado antes del registro del handler, el evento fuera descartado.
- La señalización entre `launcher.cs` (`podcaststudio_ready.signal`) dependía exclusivamente de ese temporizador de 8 segundos, reteniendo el SplashForm en pantalla.

**Solución aplicada**:
- `electron/main.js`: Eliminado el retraso de 8 segundos en `ready-to-show`. La ventana se muestra y maximiza inmediatamente en cuanto Chromium completa el renderizado inicial del DOM.
- `electron/main.js`: Cambiado a `ipcMain.on('app-ui-ready')` para procesar cualquier señal emitida desde el renderer.
- `electron/main.js`: Añadido fallback rápido en `did-finish-load` (300ms) para garantizar que la ventana se muestre de inmediato bajo cualquier circunstancia.
- `launcher.cs`: Sincronización instantánea con la señal de arranque, permitiendo cerrar el SplashForm en milisegundos tras el inicio de Electron.

---

## 2. Actualización de Versión a v1.3.4

- `package.json`: Versión actualizada a `1.3.4`.
- `launcher.cs`: Versiones de ensamblado actualizadas a `1.3.4.0` (`AssemblyVersion`, `AssemblyFileVersion`, `AssemblyInformationalVersion`).
- `src/App.jsx`: Etiqueta del pie de página sincronizada a `PODCASTUDIO v1.3.4`.
- `PodcastStudio.exe`: Recompilado en versión `1.3.4.0` con firma y fecha/hora de creación actualizada.

---

## Verificación de Calidad

| Test | Resultado |
|------|-----------|
| `npm run test:remote-cameras` | ✅ 4/4 passed |
| `npm run test:recording` | ✅ 1/1 passed |
| `npm run test:stream-config` | ✅ 5/5 passed |
| `npm run build` | ✅ Vite production bundle OK |
| `npm run build:exe` | ✅ PodcastStudio.exe v1.3.4.0 OK |

---

## Archivos Modificados

1. `electron/main.js` — Eliminado retardo de 8s, visualización instantánea en `ready-to-show`, `app-ui-ready` y `did-finish-load`.
2. `src/App.jsx` — Actualizada etiqueta de versión a v1.3.4 en pie de página.
3. `package.json` — Versión 1.3.4.
4. `launcher.cs` — Ensamblado versión 1.3.4.0.
5. `ROADMAP.md` — Documentación y estado actualizado a v1.3.4.
6. `RELEASE_v1.3.4.md` — Registro oficial del release v1.3.4.
7. `PodcastStudio.exe` — Binario compilado versión 1.3.4.0.
