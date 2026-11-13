# Corrección del Hito 2 (v3.1.0) — parser contra la salida REAL del monitor y pruebas multiplataforma

Este paquete corrige los 5 fallos de la suite que detuvieron la aplicación
de la v3.1.0 en el PASO 2, y el hueco de producto que el quinto fallo
destapó. Cambian SOLO dos archivos: `electron/native-engine.js` y
`scripts/native-engine.test.mjs`. La corrección se escribió contra la
salida íntegra y real de `gst-device-monitor-1.0.exe Video/Source` de la
máquina de Luis (GStreamer 1.28.8.1, 2026-11-12), no contra suposiciones.

## Por qué — un párrafo por defecto

**1. `parseUnCaps` exigía la sintaxis tipada de GstCaps y la salida real no la trae.**
El parser solo aceptaba `width=(int)1920` y `framerate=(fraction)30/1`,
pero el monitor real imprime los valores SIN tipo: `width=1920`,
`framerate=30/1`. Resultado: en la máquina real TODOS los caps parseaban a
null y cualquier cámara declaraba «ningún caps usable». Ahora los tipos
son opcionales en ancho, alto y framerate (incluida la forma de lista);
los rangos (`width=(int)[ 640, 1920 ]`) siguen devolviendo null: nunca se
inventa una resolución.

**2. El parser descartaba las entradas de MediaFoundation, que son las que usa el motor.**
`parseDeviceMonitorOutput` solo conservaba bloques con clase
`Video/Source` (las entradas KS/DirectShow), pero las entradas de
MediaFoundation — las que traen los caps NV12 buenos y la ruta que
`mfvideosrc` usa — declaran la clase invertida: `Source/Video`. Se
aceptan ambas clases y ahora se captura además `device.path = …` de la
sección `properties:` (queda como `devicePath`, el selector por ruta) y
`device.api` (queda como `api`).

**3. El stderr de un proveedor se cuela dentro de un caps y lo corrompe.**
En la salida real, la línea de ERROR del proveedor NDI quedó incrustada
en medio de un caps de la EasyCamera: su `framerate=30/1` quedó pegado a
la marca de tiempo del error y parseaba como `30/10` = 3 fps.
`agregarCapsDesdeTexto` ahora descarta entero cualquier fragmento que
contenga ` ERROR `, ` WARNING ` o `ndideviceprovider`.

**4. Sin cámara pedida, el anfitrión elegía la primera enumerada: la EasyCamera KS.**
`chooseDevice` devolvía `dispositivos[0]` a ciegas. La elección ahora es
determinista: con nombre pedido, entre las coincidencias se prefiere la
entrada con `devicePath` (la de MediaFoundation); sin nombre, (a) la
primera cuyo formato elegido alcance al menos 1920×1080, prefiriendo la
de `devicePath`; (b) la primera con algún formato utilizable; (c) la
primera enumerada (el error del llamador sigue siendo honesto). En la
máquina de Luis la elección por defecto pasa a ser la Steren COM-126 por
su entrada MediaFoundation.

**5. La elección de formato consideraba caps image/jpeg y tenía 1080p como techo y único objetivo.**
Los caps `image/jpeg` no pueden alimentar la tubería (que arranca en
`video/x-raw` hacia `d3d11upload`) y sin embargo competían en la
elección. Ahora solo cuentan los `video/x-raw`. Y por directiva de Luis
(«debes crearlo para soportar cualquier cámara desde 1080 hasta 4K») la
regla ya no busca «el 1080p30 exacto»: entre los crudos con framerate
≈30 (29–31) y área ≤ 3840×2160 elige el de MAYOR área (desempate NV12 >
YUY2 > otro); si ninguno llega a ≈30 fps, el mayor ≤ 4K sin exigir fps;
si todos exceden 4K, el menor de ellos (nunca se descarta la cámara). Si
el formato elegido queda bajo 1920×1080 se usa igual, pero la declaración
del anfitrión lo dice: «por debajo del piso 1080 del producto». El
bitrate de codificación escala con la resolución negociada: 1080p →
12 Mbps, 1440p → 20 Mbps, 4K → 40 Mbps (antes fijo en 12). La prueba de
4K es por fixture SINTÉTICA declarada en las pruebas (Luis aún no tiene
cámara 4K; su Steren prueba el peldaño 1080 en vivo).

**6. Las pruebas nuevas eran ciegas de plataforma (los 5 fallos de la suite).**
Los stubs eran scripts POSIX con shebang y sin extensión: inejecutables
en Windows, y al no correr, un stub ausente dejó pasar la enumeración
REAL de la máquina. Ahora: la escalera de codificadores se prueba con
funciones de inspección inyectadas (sin ejecutables); la prueba de
localización crea los archivos CON la extensión de la plataforma (.exe
en Windows, como los reales); y el flujo del anfitrión usa stubs
multiplataforma (script Node `.js` + archivo localizable por plataforma,
con un `spawnImpl` que en Windows redirige al script vía
`process.execPath`). El flujo además afirma la hermeticidad: la cámara
elegida es la Steren de la fixture, no una instalación real.

## Ampliación declarada (enmienda de Luis, 2026-11-12)

El motor negocia el mejor formato de CUALQUIER cámara entre 1080p y 4K,
con bitrate escalado (12/20/40 Mbps) y preset de calidad en NVENC. La
cobertura 4K/1440p se prueba por fixtures sintéticas declaradas como
tales en `scripts/native-engine.test.mjs`; la fixture del monitor es la
salida REAL de la máquina de Luis.

## Aplicación (Antigravity)

El árbol ya trae la v3.1.0 aplicada y SIN commitear (la detención fue en
el PASO 2). No hay que re-descomprimir el paquete del Hito 2.

1. Reemplaza los 2 archivos del ZIP sobre la raíz del repo, en sus rutas:
   `electron/native-engine.js` y `scripts/native-engine.test.mjs`. El
   `LEEME-correccion-hito2.md` va en la raíz.
2. Compuerta de conteos con `(Get-Content <archivo>).Count`:
   - `electron/native-engine.js` → **786**
   - `scripts/native-engine.test.mjs` → **533**
   Regla del último byte: si un conteo difiere en EXACTAMENTE 1 del
   esperado, verifica el último byte del archivo antes de detenerte (los
   archivos terminan en salto de línea; la diferencia de 1 puede ser
   artefacto de conteo). Cualquier otra diferencia: DETENTE y reporta.
3. `git status --short` debe mostrar el MISMO conjunto esperado de la
   aplicación del Hito 2 (los 4 modificados + los nuevos del paquete),
   más este `LEEME-correccion-hito2.md` como nuevo sin rastrear. Ningún
   archivo fuera de ese conjunto.
4. Re-corre SOLO la compuerta de la suite:
   `node --test scripts/*.test.mjs`
   Esperado en Windows: **98 tests, 98 pass, 0 fail** (la suite crece de
   93 a 98: el archivo del motor pasa de 12 a 17 pruebas).
   Si algo no cuadra, DETENTE y pega la salida exacta.
5. Con la suite en verde, CONTINÚA con el PASO 3 del LEEME-hito2.md
   original: commit con el mensaje exacto
   «v3.1.0: motor nativo hospedado (Hito 2) — la app gobierna la tubería GStreamer: vista previa nativa, grabación y transmisión local de prueba»,
   push, instalador «PodcastStudio Setup 3.1.0.exe» con su tamaño exacto,
   e instalación; y cierra con el reporte del PASO 4. La prueba en vivo la
   hace Luis, no Antigravity.
