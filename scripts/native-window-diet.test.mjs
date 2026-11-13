// ============================================================================
// v3.3.0 — DIETA DE LA VENTANA + FUENTES DEL MOTOR + TELEPROMPTER NATIVO.
//
// (A-renderer) Los botones reales (iniciarGrabacionNativa /
// iniciarTransmisionNativa) componen las fuentes locales (programa
// primero, máx. 3) y las pasan al start del motor como
// { sources, programIndex: 0 } — solo con 2+ cámaras; con una sola no
// se pasa sources y manda el camino de una cámara probado por la
// compuerta smoke (decisión declarada en App.jsx).
//
// v3.3.1 (defecto 4, orden de Luis): la composición se mudó a la
// función pura componerFuentesPrograma (src/utils/nativeProgramSources
// .mjs, probada por unidad en scripts/camera-slots-v331.test.mjs) y la
// regla cambió en dos puntos que SUPERSEDEN las aserciones originales
// de la sección A: (i) la fuente de programa es la del tally PGM y, si
// no tiene cámara local elegible, la composición devuelve programa
// null y los botones se detienen ANTES (errorPrograma) — ya no vale
// «la activa primero entre las elegibles» porque eso promovía a otra
// cámara en silencio; (ii) con una sola cámara ya no manda la elección
// por defecto del motor: la app pasa su nombre EXPLÍCITO (cameraName)
// para que el motor la empareje o se niegue (PROGRAMA_NO_DISPONIBLE)
// en vez de sustituirla. Las aserciones de la sección A se reescriben
// a la nueva semántica declarada; las de dieta (D1/D2) y teleprompter
// (C) NO se tocan: el blindaje sigue intacto.
//
// (D1) Mapa de evidencia del bucle de composición por canvas: NO nace
// solo de los caminos heredados. El monitor siempre encendido también
// lo arranca — el efecto de sincronización de App.jsx llama
// updateBroadcastState() al montar y ante cualquier cambio, y en el
// motor updateBroadcastState -> ensureMasterCanvas -> startRenderLoop
// (Worker a 30/s) aunque nadie grabe/transmita por la cadena heredada;
// syncVideoStreams solo lo apaga sin consumidores, y con cámaras
// conectadas siempre hay. Ese monitor SÍ es separable: en modo motor
// (nativeGstAvailable && !isoRecordingEnabled) la dieta bloquea el
// arranque del Worker salvo que haya salida de canvas en curso, y
// startBroadcastEngine vuelve a arrancarlo tras marcar la salida
// activa: la cadena heredada (sin GStreamer, o ISO) compone igual.
//
// (D2) Al confirmarse la sesión nativa, las cámaras locales de
// sourceNames se liberan (tracks detenidos, fuera del mapa de
// streams) y el mosaico muestra su imagen + «En el motor nativo»; al
// apagarse el motor se readquieren por handleUsbConnect.
//
// v3.4.0 (Área 2): la liberación YA NO captura foto fija — la foto
// (drawImage + toDataURL a 1920×1080 y la espera de un <video>
// desechable de hasta 1200 ms por cámara) caía en plena transición
// de sesión y es la firma de los hipos de ~1,5 s medidos el
// 2026-11-13; en sesión, el mosaico y el máster muestran el MONITOR
// VIVO del motor (los JPEG que su tubería sirve por HTTP local). Y
// la readquisición ganó un VIGILANTE (política pura en
// src/utils/reacquirePolicy.mjs, probada en
// scripts/reacquire-policy-v340.test.mjs): reintenta cada 2 s hasta
// que la cámara vuelva o agote 6 intentos declarados. Las
// aserciones D2 de la foto se reescriben a la nueva semántica,
// declaradas aquí como hizo la v3.3.1 con la sección A.
//
// (C-renderer) Con concurrentPreview === true y el teleprompter
// reproduciendo, el tramo visible (~6 líneas desde teleprompterYRef)
// se envía por nativeEngine.setPreviewText SOLO cuando cambia; al
// pausar o perder la concurrencia se envía '' una vez.
//
// Como el resto de invariantes de este repo, se verifican sobre el
// código fuente. Uso: node --test scripts/native-window-diet.test.mjs
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'masterBroadcastEngine.js'), 'utf8');
// v3.3.1: la lógica de composición vive en este módulo puro desde el
// defecto 4; sus reglas se verifican aquí por fuente y por unidad en
// scripts/camera-slots-v331.test.mjs.
const fuentesSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'nativeProgramSources.mjs'), 'utf8');

const cuerpo = (desde, hasta) => {
  const i = appSource.indexOf(desde);
  const j = appSource.indexOf(hasta);
  assert.ok(i >= 0, `no se encontró ${desde}`);
  assert.ok(j > i, `no se encontró ${hasta} después de ${desde}`);
  return appSource.slice(i, j);
};

const grabar = cuerpo('const iniciarGrabacionNativa', 'const detenerGrabacionNativa');
const transmitir = cuerpo('const iniciarTransmisionNativa', 'const detenerTransmisionNativa');
const ayudante = cuerpo('const componerFuentesLocalesNativas', 'const iniciarGrabacionNativa');

// ---------------------------------------------------------------------------
// A-renderer: fuentes locales al motor
// ---------------------------------------------------------------------------

test('v3.3.1 A: el ayudante delega en la función pura con la de programa = tally PGM (activeCam)', () => {
  assert.ok(ayudante.includes('componerFuentesPrograma({'), 'la composición vive en componerFuentesPrograma');
  assert.ok(ayudante.includes('programaCamId: activeCamRef.current || 1'), 'la de programa es la del tally PGM (activeCam, defecto CAM 1)');
  assert.ok(
    fuentesSource.includes('sources = [etiquetaPrograma]'),
    'en la función pura, la de programa abre la lista (programIndex 0)',
  );
});

test('v3.4.0 A: las fuentes son programa + SOLO la PiP fijada, y la etiqueta sale de la pista, la ranura o la liberación', () => {
  // v3.4.0: fuera la PiP automática en orden de ranura (máx. 3) — la
  // sesión lleva la de programa y, solo si Luis la fijó, su PiP.
  assert.ok(fuentesSource.includes('pipCamId'), 'la composición recibe la PiP fijada (pipCamId)');
  assert.ok(ayudante.includes('pipCamId: pipCamRef.current'), 'la app pasa la PiP fijada vigente');
  assert.ok(fuentesSource.includes('vTrack.label'), 'etiqueta del track vivo (primera candidata)');
  assert.ok(fuentesSource.includes('meta?.label'), 'o el nombre guardado por ranura (cameraMeta)');
  assert.ok(fuentesSource.includes('elegirEtiquetaFuente'), 'las candidatas pasan por el filtro anti-GUID');
  assert.ok(ayudante.includes('releasedLabels'), 'la app aporta las etiquetas de las cámaras liberadas al motor');
});

test('v3.3.1 A: el ayudante excluye las ranuras remotas (type remote / stream con mobileId)', () => {
  assert.ok(fuentesSource.includes("meta?.type === 'remote'"), 'ranura remota fuera por su meta');
  assert.ok(fuentesSource.includes('stream.mobileId'), 'stream del transporte cloud fuera por mobileId');
});

test('v3.3.1 A: grabar prepara las fuentes y se detiene ANTES si la de programa no está', () => {
  assert.ok(grabar.includes('prepararFuentesSesionNativa()'), 'grabar prepara las fuentes');
  assert.ok(grabar.includes('prep.errorPrograma'), 'grabar se detiene antes sin programa disponible');
  assert.ok(grabar.includes('...optsFuentes') || grabar.includes('optsFuentes = prep.opts'), 'grabar pasa las opts preparadas');
  assert.ok(ayudante.includes('programIndex: 0'), 'con 2+ fuentes se pasa programIndex 0');
});

test('v3.3.1 A: transmitir prepara las fuentes y se detiene ANTES si la de programa no está', () => {
  assert.ok(transmitir.includes('prepararFuentesSesionNativa()'), 'transmitir prepara las fuentes');
  assert.ok(transmitir.includes('prep.errorPrograma'), 'transmitir se detiene antes sin programa disponible');
  assert.ok(transmitir.includes('...prep.opts'), 'transmitir pasa las opts preparadas');
});

test('v3.3.1 A: con una sola cámara se pasa su nombre EXPLÍCITO (cameraName), no la elección por defecto', () => {
  assert.ok(ayudante.includes('cameraName: comp.etiquetaPrograma'), 'una sola fuente → cameraName explícito de la de programa');
  assert.ok(grabar.includes('PROGRAMA_NO_DISPONIBLE'), 'grabar reconoce la negativa previa del motor');
  assert.ok(transmitir.includes('PROGRAMA_NO_DISPONIBLE'), 'transmitir reconoce la negativa previa del motor');
});

test('v3.3.0 A: el arranque del panel «Motor Nativo» NO cambia (sin sources)', () => {
  const panel = cuerpo('const handleNativeEngineStart', 'const handleNativeEngineStop');
  assert.ok(!panel.includes('sources'), 'el panel arranca como hoy, sin sources');
});

// ---------------------------------------------------------------------------
// D1: dieta del bucle de composición en modo motor
// ---------------------------------------------------------------------------

test('v3.3.0 D1: el modo motor es la condición vigente (GStreamer presente y sin ISO)', () => {
  assert.ok(
    appSource.includes('const enModoMotor = nativeGstAvailable && !isoRecordingEnabled;'),
    'enModoMotor = nativeGstAvailable && !isoRecordingEnabled',
  );
});

test('v3.3.0 D1: App aplica la dieta del motor según el modo motor', () => {
  assert.ok(appSource.includes('setNativeWindowDiet(enModoMotor)'), 'el efecto pasa enModoMotor a setNativeWindowDiet');
});

test('v3.3.0 D1: en el motor, startRenderLoop no arranca el Worker con la dieta activa y sin salida de canvas', () => {
  const i = engineSource.indexOf('export function startRenderLoop()');
  assert.ok(i >= 0, 'existe startRenderLoop');
  const cuerpoLoop = engineSource.slice(i, i + 500);
  const gate = cuerpoLoop.indexOf('nativeWindowDietActive && !isCanvasOutputActive()');
  assert.ok(gate >= 0, 'la compuerta de dieta existe en startRenderLoop');
  assert.ok(gate < cuerpoLoop.indexOf("renderWorker.postMessage('start')") || !cuerpoLoop.includes("postMessage('start')"),
    'la compuerta va ANTES de postear start al Worker');
  assert.ok(engineSource.includes('export function setNativeWindowDiet(active)'), 'existe setNativeWindowDiet');
  assert.ok(engineSource.includes('if (nativeWindowDietActive && !isCanvasOutputActive()) stopRenderLoop();'),
    'activar la dieta detiene el bucle en reposo');
});

test('v3.3.0 D1: la cadena heredada conserva el bucle — startBroadcastEngine lo rearranca con la salida activa', () => {
  const i = engineSource.indexOf('export function startBroadcastEngine');
  const j = engineSource.indexOf('function createMasterMediaRecorder');
  assert.ok(i >= 0 && j > i, 'se localiza startBroadcastEngine');
  const cuerpoStart = engineSource.slice(i, j);
  const marca = cuerpoStart.indexOf('isBroadcastEngineActive = true;');
  const rearranque = cuerpoStart.indexOf('startRenderLoop();', marca);
  assert.ok(marca >= 0 && rearranque > marca,
    'tras marcar la salida activa se llama startRenderLoop() (la dieta no lo bloquea con salida en curso)');
});

test('v3.3.0 D1: en modo motor el monitor de programa por canvas no se monta', () => {
  assert.ok(appSource.includes('{!enModoMotor && <MasterProgramMonitor />}'),
    'MasterProgramMonitor queda fuera en modo motor: mandan los VideoTile directos');
});

// ---------------------------------------------------------------------------
// D2: liberación (v3.4.0: sin foto — monitor vivo; vigilante de vuelta)
// ---------------------------------------------------------------------------

const liberacion = cuerpo('const [nativeReleasedTiles, setNativeReleasedTiles]', '// C-renderer: teleprompter');

test('v3.3.0 D2: la liberación busca las cámaras por nativeEngineState.sourceNames', () => {
  assert.ok(liberacion.includes('st.sourceNames'), 'la liberación itera sourceNames del estado del motor');
  assert.ok(liberacion.includes('nombre.includes(c) || c.includes(nombre)'), 'coincidencia laxa en ambos sentidos');
  assert.ok(liberacion.includes("['vista-previa', 'grabando', 'transmitiendo', 'grabando-transmitiendo']"),
    'solo con la sesión confirmada en fases de marcha');
});

test('v3.3.0 D2: la liberación solo toca ranuras locales (nunca remotas)', () => {
  assert.ok(liberacion.includes("meta?.type === 'remote'"), 'ranura remota excluida por su meta');
  assert.ok(liberacion.includes('stream.mobileId'), 'stream cloud excluido por mobileId');
});

test('v3.3.0 D2: la liberación detiene TODOS los tracks y retira el stream del mapa de la ventana', () => {
  assert.ok(liberacion.includes('stream.getTracks().forEach'), 'detiene todos los tracks del stream liberado');
  assert.ok(liberacion.includes('delete sinLiberada[slotIdx]'), 'el stream sale de slotStreamsRef');
  assert.ok(liberacion.includes('delete next[slotIdx]'), 'el stream sale del estado slotStreams');
});

test('v3.4.0 D2: la liberación YA NO captura foto — fuera drawImage/toDataURL y el <video> desechable del camino', () => {
  assert.ok(liberacion.includes('// v3.4.0 — SIN captura de foto'), 'la liberación declara la retirada de la foto');
  // El tramo de CÓDIGO entre el registro del préstamo y la parada de
  // tracks (los comentarios históricos que nombran la foto quedan
  // fuera de este corte: se busca desde la línea de código que
  // reinicia la contabilidad del vigilante, justo antes del registro).
  const iCodigo = liberacion.indexOf('reacquireAttemptsRef.current = olvidarIntentosReadquisicion(reacquireAttemptsRef.current, slotIdx);');
  assert.ok(iCodigo >= 0, 'el registro del préstamo reinicia la contabilidad del vigilante');
  const iTracks = liberacion.indexOf('stream.getTracks().forEach', iCodigo);
  assert.ok(iTracks > iCodigo, 'tras el registro se detienen los tracks');
  const camino = liberacion.slice(iCodigo, iTracks);
  assert.ok(!camino.includes('drawImage'), 'sin drawImage en el camino de liberación');
  assert.ok(!camino.includes('toDataURL'), 'sin toDataURL en el camino de liberación');
  assert.ok(!camino.includes("createElement('video')"), 'sin <video> desechable en el camino de liberación');
  assert.ok(!camino.includes("querySelectorAll('video')"), 'sin búsqueda de <video> en el camino de liberación');
  assert.ok(liberacion.includes('setNativeReleasedTiles'), 'el espejo de mosaico es nativeReleasedTiles');
});

test('v3.4.0 D2: el vigilante reintenta la readquisición cada 2 s con la política pura y avisa UNA vez al agotar', () => {
  assert.ok(liberacion.includes('setInterval'), 'hay un intervalo vigilante');
  assert.ok(liberacion.includes('REACQUIRE_INTERVAL_MS'), 'el intervalo es el declarado por la política (2 s)');
  assert.ok(liberacion.includes('decidirReintentoReadquisicion'), 'la decisión la toma la política pura');
  assert.ok(liberacion.includes('marcarReadquisicionAvisada'), 'el aviso de agotada se marca (una sola vez)');
  assert.ok(liberacion.includes('REACQUIRE_MAX_ATTEMPTS'), 'el tope es el declarado por la política (6)');
});

test('v3.3.0 D2 → v3.3.4: al apagarse el motor, las liberadas se readquieren por la adquisición existente, a un destino decidido por ocupación', () => {
  // v3.3.4: la vuelta incondicional a la ranura original
  // (handleUsbConnect(info.deviceId, slotIdx, …), la forma que esta
  // prueba fijaba) quedó sustituida por orden de la corrección: el
  // destino lo decide el predicado único de ocupación — su ranura si
  // está libre; si otra fuente la ocupó mientras estaba prestada, la
  // primera libre — y la readquisición jamás sobrescribe. La
  // adquisición sigue siendo la existente (la cola USB probada).
  assert.ok(liberacion.includes('handleUsbConnect(info.deviceId, destinoIdx, info.label)'),
    'readquisición por handleUsbConnect (getUserMedia existente), al destino decidido por ocupación');
  assert.ok(liberacion.includes('elegirRanuraReadquisicion({'),
    'el destino de la vuelta lo decide elegirRanuraReadquisicion (predicado único)');
  assert.ok(liberacion.includes("phase === 'apagado' || phase === 'error'"), 'la readquisición mira la fase apagado/error');
  assert.ok(liberacion.includes('nativeBusyRef.current'), 'las transiciones ordenadas no readquieren en el apagado intermedio');
});

test('v3.4.0 D2: el mosaico y el máster muestran el MONITOR VIVO de la ranura liberada y el rótulo «En el motor nativo»', () => {
  assert.ok(appSource.includes('nativeReleasedTiles[camId - 1]'), 'el mosaico consulta el espejo de liberadas por ranura');
  assert.ok(appSource.includes('NativeMonitorImg'), 'los recuadros pintan la imagen del monitor vivo');
  assert.ok(appSource.includes('monitorPort'), 'la URL sale del puerto del estado del motor');
  assert.ok(appSource.includes('/monitor/program.jpg'), 'el recuadro de programa muestra la mezcla que va al aire');
  assert.ok(appSource.includes('En el motor nativo'), 'rótulo «En el motor nativo»');
});

// ---------------------------------------------------------------------------
// D3 → v3.3.2: la banda de estado FUE ELIMINADA por orden expresa de Luis
// («agregaste una leyenda debajo del recuadro de la cámara máster — no
// debería salir nada ahí»). El recuadro queda limpio: nada debajo del
// monitor y nada fijo dentro. La verdad del motor (fase, cámara(s),
// formato, apertura, concurrencia) sigue visible en la sección Motor
// Nativo del panel derecho; no se pierde información.
// ---------------------------------------------------------------------------

test('v3.3.2 limpieza: no existe banda de estado bajo el monitor de programa', () => {
  assert.ok(!appSource.includes('Ver vista previa'), 'sin el botón «Ver vista previa» de la banda');
  assert.ok(!appSource.includes('banda de estado'), 'sin el bloque de la banda');
  const entreMonitorYBarra = cuerpo('{debeMontarOverlayPrompter({', '{/* BOTTOM MULTI-CAM BAR');
  assert.ok(!entreMonitorYBarra.includes('Motor nativo</span>'), 'nada de leyenda del motor bajo el recuadro');
});

test('v3.3.2 limpieza: dentro del recuadro máster no queda la franja fija «Mirar aquí»', () => {
  assert.ok(!appSource.includes('▲ Mirar aquí (lente de cámara)'), 'la franja fija del overlay fue eliminada');
  const overlay = cuerpo('{debeMontarOverlayPrompter({', '{/* BOTTOM MULTI-CAM BAR');
  assert.ok(!overlay.includes('Mirar aquí'), 'el overlay solo lleva el texto en desplazamiento');
});

// ---------------------------------------------------------------------------
// C-renderer: teleprompter sobre la vista previa nativa
// ---------------------------------------------------------------------------

const prompterNativo = cuerpo('const previewTextLastSentRef', 'const handleNativeEngineStart');

test('v3.3.0 C: el efecto exige concurrencia del motor y teleprompter reproduciendo', () => {
  assert.ok(prompterNativo.includes('nativeEngineState?.concurrentPreview === true'), 'concurrentPreview === true');
  assert.ok(prompterNativo.includes('!isTeleprompterPlaying'), 'sin reproducción no se envía tramo');
  assert.ok(prompterNativo.includes("typeof bridge?.setPreviewText !== 'function'"), 'guarda opcional del puente (build parcial no rompe)');
});

test('v3.3.0 C: el tramo son ~6 líneas desde la línea estimada por el reloj único', () => {
  assert.ok(prompterNativo.includes('teleprompterYRef.current'), 'la línea se estima desde teleprompterYRef');
  assert.ok(prompterNativo.includes('teleprompterFontSize || 36) * 1.4'), 'con el tamaño de letra vigente');
  assert.ok(prompterNativo.includes('lineas.slice(idx, idx + 6)'), 'tramo de 6 líneas');
});

test('v3.3.0 C: setPreviewText solo se llama cuando el tramo cambia, y al parar se envía vacío una vez', () => {
  assert.ok(prompterNativo.includes('if (tramo === previewTextLastSentRef.current) return;'), 'sin cambio de tramo no hay llamada');
  assert.ok(prompterNativo.includes('bridge.setPreviewText(tramo)'), 'envía el tramo');
  assert.ok(prompterNativo.includes("bridge?.setPreviewText?.('')"), 'al pausar/perder concurrencia envía texto vacío');
  assert.ok(prompterNativo.includes("previewTextLastSentRef.current = '';"), 'el vacío se marca enviado (una sola vez)');
});
