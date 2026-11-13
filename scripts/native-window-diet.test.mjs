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
// sourceNames se liberan con foto fija (tracks detenidos, fuera del
// mapa de streams) y el mosaico muestra la foto + «En el motor
// nativo»; al apagarse el motor se readquieren por handleUsbConnect.
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

test('v3.3.0 A: el ayudante pone la cámara de programa PRIMERO y luego el orden de ranura', () => {
  assert.ok(ayudante.includes('idsOrdenados.push(activa)'), 'la de programa (activeCam) entra primero');
  assert.ok(
    ayudante.indexOf('idsOrdenados.push(activa)') < ayudante.indexOf('camSlotsRef.current'),
    'el resto sigue el orden de ranura (camSlots) DESPUÉS de la de programa',
  );
  assert.ok(ayudante.includes('activeCamRef.current'), 'la de programa sale de activeCam');
});

test('v3.3.0 A: el ayudante limita a 3 fuentes y etiqueta por track o por ranura', () => {
  assert.ok(ayudante.includes('fuentes.length >= 3'), 'máximo 3 fuentes');
  assert.ok(ayudante.includes('vTrack.label'), 'etiqueta del track vivo');
  assert.ok(ayudante.includes('meta?.label'), 'o el nombre guardado por ranura (cameraMeta)');
});

test('v3.3.0 A: el ayudante excluye las ranuras remotas (type remote / stream con mobileId)', () => {
  assert.ok(ayudante.includes("meta?.type === 'remote'"), 'ranura remota fuera por su meta');
  assert.ok(ayudante.includes('stream.mobileId'), 'stream del transporte cloud fuera por mobileId');
});

test('v3.3.0 A: grabar pasa sources/programIndex al start del motor', () => {
  assert.ok(grabar.includes('componerFuentesLocalesNativas()'), 'grabar compone las fuentes');
  assert.ok(grabar.includes('sources: fuentesNativas'), 'grabar pasa sources');
  assert.ok(grabar.includes('programIndex: 0'), 'grabar pasa programIndex 0');
});

test('v3.3.0 A: transmitir pasa sources/programIndex al start del motor', () => {
  assert.ok(transmitir.includes('componerFuentesLocalesNativas()'), 'transmitir compone las fuentes');
  assert.ok(transmitir.includes('sources: fuentesNativas'), 'transmitir pasa sources');
  assert.ok(transmitir.includes('programIndex: 0'), 'transmitir pasa programIndex 0');
});

test('v3.3.0 A: con una sola cámara NO se pasa sources (camino probado por la compuerta)', () => {
  assert.ok(grabar.includes('fuentesNativas.length > 1'), 'grabar: sources solo con 2+ fuentes');
  assert.ok(transmitir.includes('fuentesNativas.length > 1'), 'transmitir: sources solo con 2+ fuentes');
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
// D2: liberación con foto fija
// ---------------------------------------------------------------------------

const liberacion = cuerpo('const [nativeReleasedPhotos, setNativeReleasedPhotos]', '// C-renderer: teleprompter');

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

test('v3.3.0 D2: la foto sale de un <video> de la ventana o de uno desechable, y sin foto se libera igual', () => {
  assert.ok(liberacion.includes("document.querySelectorAll('video')"), 'busca el <video> que ya muestra el stream');
  assert.ok(liberacion.includes("document.createElement('video')"), 'respaldo: <video> desechable con el stream');
  assert.ok(liberacion.includes('setNativeReleasedPhotos'), 'la foto (o null) se guarda por ranura');
});

test('v3.3.0 D2: al apagarse el motor, las liberadas se readquieren por la adquisición existente', () => {
  assert.ok(liberacion.includes('handleUsbConnect(info.deviceId, slotIdx, info.label)'),
    'readquisición por handleUsbConnect (getUserMedia existente)');
  assert.ok(liberacion.includes("phase === 'apagado' || phase === 'error'"), 'la readquisición mira la fase apagado/error');
  assert.ok(liberacion.includes('nativeBusyRef.current'), 'las transiciones ordenadas no readquieren en el apagado intermedio');
});

test('v3.3.0 D2: el mosaico muestra la foto y el rótulo «En el motor nativo» de la ranura liberada', () => {
  assert.ok(appSource.includes('nativeReleasedPhotos[camId - 1] !== undefined'), 'el mosaico consulta la foto por ranura');
  assert.ok(appSource.includes('En el motor nativo'), 'rótulo «En el motor nativo»');
});

// ---------------------------------------------------------------------------
// D3: banda de estado en el área de programa
// ---------------------------------------------------------------------------

test('v3.3.0 D3: la banda de estado existe solo en modo motor y muestra la verdad del motor', () => {
  const banda = cuerpo('{enModoMotor && (', '{/* BOTTOM MULTI-CAM BAR');
  assert.ok(banda.includes('nePhase'), 'muestra la fase');
  assert.ok(banda.includes('sourceNames'), 'muestra la(s) cámara(s) de sourceNames');
  assert.ok(banda.includes('nativeEngineState?.caps'), 'muestra el formato de caps');
  assert.ok(banda.includes('addressingMode'), 'muestra el modo de apertura');
  assert.ok(banda.includes('concurrentPreview'), 'muestra la concurrencia cuando aplica');
});

test('v3.3.0 D3: «Ver vista previa» avisa con sesión en curso y arranca preview en reposo', () => {
  const banda = cuerpo('{enModoMotor && (', '{/* BOTTOM MULTI-CAM BAR');
  assert.ok(banda.includes('Ver vista previa'), 'botón «Ver vista previa»');
  assert.ok(banda.includes('La ventana nativa de vista previa ya está abierta'), 'con sesión: aviso de que ya está abierta');
  assert.ok(banda.includes("handleNativeEngineStart('preview')"), 'en reposo: arranca la preview por el camino existente');
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
