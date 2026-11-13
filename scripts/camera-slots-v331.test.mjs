// ============================================================================
// Pruebas v3.3.1 — procesos de ranuras de cámara y emparejamiento de
// nombres del motor. Los tres defectos que fijan, de la sesión en vivo
// de Luis con la v3.3.0 (2026-11-13):
//   1) la remota del celular se autoconectaba en CAM 2 EXPULSANDO a la
//      cámara que estaba ahí → la remota va a la primera ranura libre;
//   2) al reconectar la cámara de CAM 2, la app la abrió en CAM 4 con
//      CAM 2 libre y el modal diciendo «Destino seleccionado: CAM 2» →
//      el destino explícito manda, la conocida recupera su ranura y,
//      si no, la primera libre;
//   3) el motor no encontró la cámara de programa «EasyCamera
//      (04f2:b57e)» entre las enumeradas por MF («EasyCamera» a secas)
//      → el emparejamiento normaliza el sufijo VID:PID;
//   4) la sesión nativa debe salir de la cámara de PROGRAMA (tally
//      PGM), nunca de la primera elegible, y si la de programa no está
//      disponible la composición lo dice (programa null) en vez de
//      promover a otra en silencio.
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  findAvailableRemoteCameraSlot,
  resolveRemoteCameraSlot,
  chooseReconnectCameraSlot,
} from '../src/utils/remoteCameraSlots.mjs';
import { componerFuentesPrograma } from '../src/utils/nativeProgramSources.mjs';

const require = createRequire(import.meta.url);
const { normalizarNombreCamara, nombresCamaraCoinciden, chooseDevice } = require('../electron/native-engine.js');

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const streamFalso = (label, extra = {}) => ({
  getVideoTracks: () => [{ label, readyState: 'live' }],
  ...extra,
});

// ---------------------------------------------------------------------------
// Defecto 1 — la remota nunca expulsa: explícita ocupada → primera libre
// ---------------------------------------------------------------------------

test('v3.3.1 · defecto 1: explícita ocupada (CAM 2) → primera libre, sin expulsar', () => {
  const ocupante = { stream: 'usb-cam2' };
  const slot = resolveRemoteCameraSlot({
    explicitSlot: 1,
    slotsCount: 4,
    streams: { 0: { stream: 'local' }, 1: ocupante },
    cameraMeta: { 0: { deviceId: 'steren' }, 1: { deviceId: 'easy' } },
    localStreamActive: true,
    requestingDeviceId: 'phone-1',
  });
  assert.equal(slot, 2, 'debió ir a CAM 3, la primera libre, no quedarse en CAM 2');
});

test('v3.3.1 · defecto 1: explícita libre manda, incluida CAM 1 sin señal local', () => {
  assert.equal(resolveRemoteCameraSlot({
    explicitSlot: 2, slotsCount: 4, streams: {}, cameraMeta: {}, requestingDeviceId: 'p',
  }), 2);
  assert.equal(resolveRemoteCameraSlot({
    explicitSlot: 0, slotsCount: 4, streams: {}, cameraMeta: {}, localStreamActive: false, requestingDeviceId: 'p',
  }), 0, 'el QR abierto desde CAM 1 libre manda a CAM 1');
});

test('v3.3.1 · defecto 1: CAM 1 con la señal local viva no se entrega a la remota', () => {
  const slot = resolveRemoteCameraSlot({
    explicitSlot: 0,
    slotsCount: 4,
    streams: {},
    cameraMeta: {},
    localStreamActive: true,
    requestingDeviceId: 'p',
  });
  assert.equal(slot, 1, 'con el anfitrión en CAM 1, la remota va a la primera libre (CAM 2)');
});

test('v3.3.1 · defecto 1: ranura reservada por el despacho para OTRO celular cuenta como ocupada', () => {
  const slot = resolveRemoteCameraSlot({
    explicitSlot: 1,
    slotsCount: 4,
    streams: { 0: {} },
    cameraMeta: { 0: { deviceId: 'steren' } },
    assignedSlots: { 1: 'otro-celular' },
    localStreamActive: true,
    requestingDeviceId: 'phone-nuevo',
  });
  assert.equal(slot, 2);
});

test('v3.3.1 · defecto 1: todo ocupado → null (nadie es expulsado)', () => {
  const slot = resolveRemoteCameraSlot({
    explicitSlot: 1,
    slotsCount: 2,
    streams: { 0: {}, 1: {} },
    cameraMeta: { 0: { deviceId: 'a' }, 1: { deviceId: 'b' } },
    localStreamActive: true,
    requestingDeviceId: 'p',
  });
  assert.equal(slot, null);
});

test('v3.3.1 · defecto 1: sin explícita se comporta como la búsqueda de siempre', () => {
  const args = {
    slotsCount: 4,
    streams: { 0: {} },
    cameraMeta: { 0: { deviceId: 'steren' } },
    localStreamActive: true,
    requestingDeviceId: 'p',
  };
  assert.equal(resolveRemoteCameraSlot({ explicitSlot: null, ...args }), findAvailableRemoteCameraSlot(args));
  assert.equal(resolveRemoteCameraSlot({ explicitSlot: null, ...args }), 1);
});

// ---------------------------------------------------------------------------
// Defecto 2 — reconexión: (b) su ranura si está libre; (c) si no, la primera
// ---------------------------------------------------------------------------

test('v3.3.1 · defecto 2: la conocida recupera SU ranura libre (CAM 2, no CAM 4)', () => {
  // El caso de Luis: CAM 1 ocupada, CAM 2 libre (su ranura anterior),
  // CAM 3 con metadatos de la remota, y la app la mandó a CAM 4.
  const slot = chooseReconnectCameraSlot({
    previousSlot: 1,
    camSlots: [1, 2, 3, 4],
    streams: { 0: { s: 1 } },
    cameraMeta: { 0: { deviceId: 'steren' }, 2: { deviceId: 'cloud_2' } },
  });
  assert.equal(slot, 1, 'debió recuperar CAM 2');
});

test('v3.3.1 · defecto 2: la ranura anterior manda sobre una libre de índice menor', () => {
  const slot = chooseReconnectCameraSlot({
    previousSlot: 3,
    camSlots: [1, 2, 3, 4],
    streams: {},
    cameraMeta: {},
  });
  assert.equal(slot, 3, 'regla (b): su ranura anterior si está libre');
});

test('v3.3.1 · defecto 2: anterior ocupada → primera libre en orden de ranuras', () => {
  const slot = chooseReconnectCameraSlot({
    previousSlot: 1,
    camSlots: [1, 2, 3, 4],
    streams: { 0: {}, 1: {} },
    cameraMeta: { 0: { deviceId: 'a' }, 1: { deviceId: 'b' } },
  });
  assert.equal(slot, 2);
});

test('v3.3.1 · defecto 2: sin ranura anterior → primera libre; un meta con deviceId NO es libre aunque no haya stream', () => {
  const slot = chooseReconnectCameraSlot({
    previousSlot: null,
    camSlots: [1, 2, 3],
    streams: {},
    cameraMeta: { 0: { deviceId: 'reservada' } },
  });
  assert.equal(slot, 1);
});

test('v3.3.1 · defecto 2: ninguna libre → null (nunca la mayor por defecto)', () => {
  const slot = chooseReconnectCameraSlot({
    previousSlot: 1,
    camSlots: [1, 2],
    streams: { 0: {}, 1: {} },
    cameraMeta: { 0: { deviceId: 'a' }, 1: { deviceId: 'b' } },
  });
  assert.equal(slot, null);
});

// ---------------------------------------------------------------------------
// Defecto 4 (a) — la composición sale de la de programa (tally PGM)
// ---------------------------------------------------------------------------

test('v3.3.1 · defecto 4: sources[0] es la de programa (PGM CAM 1) y las PiP van en orden de ranura', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 2, 3, 4],
    programaCamId: 1,
    cameraMeta: { 0: { type: 'usb' }, 3: { type: 'usb' } },
    slotStreams: {
      0: streamFalso('Steren COM-126 (09da:2704)'),
      3: streamFalso('EasyCamera (04f2:b57e)'),
    },
    localStream: null,
  });
  assert.equal(comp.programa.etiqueta, 'Steren COM-126 (09da:2704)');
  assert.deepEqual(comp.sources, ['Steren COM-126 (09da:2704)', 'EasyCamera (04f2:b57e)']);
});

test('v3.3.1 · defecto 4: si el tally PGM está en CAM 4, la de programa es la de CAM 4', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 2, 3, 4],
    programaCamId: 4,
    cameraMeta: { 0: { type: 'usb' }, 3: { type: 'usb' } },
    slotStreams: {
      0: streamFalso('Steren COM-126 (09da:2704)'),
      3: streamFalso('EasyCamera (04f2:b57e)'),
    },
    localStream: null,
  });
  assert.equal(comp.sources[0], 'EasyCamera (04f2:b57e)');
  assert.equal(comp.sources[1], 'Steren COM-126 (09da:2704)', 'la PiP entra en orden de ranura');
});

test('v3.3.1 · defecto 4: PGM en una ranura REMOTA → programa null, sin promover a otra', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 2, 3],
    programaCamId: 2,
    cameraMeta: { 0: { type: 'usb' }, 1: { type: 'remote' } },
    slotStreams: {
      0: streamFalso('Steren COM-126 (09da:2704)'),
      1: streamFalso('Celular', { mobileId: 'phone-9' }),
    },
    localStream: null,
  });
  assert.equal(comp.programa, null);
  assert.deepEqual(comp.sources, [], 'sin programa no hay sources: la app se detiene antes');
});

test('v3.3.1 · defecto 4: PGM sin señal (track terminado) → programa null, no la siguiente elegible', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 2],
    programaCamId: 1,
    cameraMeta: { 0: { type: 'usb' }, 1: { type: 'usb' } },
    slotStreams: {
      0: { getVideoTracks: () => [{ label: 'Steren COM-126', readyState: 'ended' }] },
      1: streamFalso('EasyCamera (04f2:b57e)'),
    },
    localStream: null,
  });
  assert.equal(comp.programa, null);
});

test('v3.3.1 · defecto 4: la de programa liberada al motor (sin stream en ventana) sigue siendo la de programa', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 4],
    programaCamId: 1,
    cameraMeta: { 0: { type: 'usb', deviceId: 'steren' }, 3: { type: 'usb' } },
    slotStreams: { 3: streamFalso('EasyCamera (04f2:b57e)') },
    localStream: null,
    releasedLabels: { 0: 'Steren COM-126 (09da:2704)' },
  });
  assert.equal(comp.programa.etiqueta, 'Steren COM-126 (09da:2704)');
  assert.deepEqual(comp.sources, ['Steren COM-126 (09da:2704)', 'EasyCamera (04f2:b57e)']);
});

test('v3.3.1 · defecto 4: máximo 3 fuentes y sin duplicar etiquetas', () => {
  const comp = componerFuentesPrograma({
    camSlots: [1, 2, 3, 4, 5],
    programaCamId: 1,
    cameraMeta: {},
    slotStreams: {
      0: streamFalso('Cam A'),
      1: streamFalso('Cam B'),
      2: streamFalso('Cam C'),
      3: streamFalso('Cam D'),
      4: streamFalso('Cam E'),
    },
    localStream: null,
  });
  assert.deepEqual(comp.sources, ['Cam A', 'Cam B', 'Cam C']);
});

// ---------------------------------------------------------------------------
// Defecto 3 — normalización de nombres (la cadena exacta del fallo)
// ---------------------------------------------------------------------------

test('v3.3.1 · defecto 3: normalizarNombreCamara quita el sufijo «(04f2:b57e)»', () => {
  assert.equal(normalizarNombreCamara('EasyCamera (04f2:b57e)'), 'easycamera');
  assert.equal(normalizarNombreCamara('EasyCamera'), 'easycamera');
  assert.equal(normalizarNombreCamara('  Steren   COM-126 '), 'steren com-126');
  assert.equal(normalizarNombreCamara('Steren COM-126 (09da:2704)'), 'steren com-126');
});

test('v3.3.1 · defecto 3: «EasyCamera (04f2:b57e)» coincide con «EasyCamera» y no con otra cámara', () => {
  assert.equal(nombresCamaraCoinciden('EasyCamera (04f2:b57e)', 'EasyCamera'), true);
  assert.equal(nombresCamaraCoinciden('EasyCamera (04f2:b57e)', 'Steren COM-126'), false);
  assert.equal(nombresCamaraCoinciden('', 'EasyCamera'), false);
});

test('v3.3.1 · defecto 3: chooseDevice resuelve el nombre con sufijo a la entrada de Media Foundation', () => {
  const dispositivos = [
    { name: 'Steren COM-126', class: 'Video/Source', devicePath: null, deviceIndex: null, caps: [] },
    { name: 'Steren COM-126', class: 'Source/Video', devicePath: 'mf-steren', deviceIndex: 0, caps: [] },
    { name: 'EasyCamera', class: 'Video/Source', devicePath: null, deviceIndex: null, caps: [] },
    { name: 'EasyCamera', class: 'Source/Video', devicePath: 'mf-easy', deviceIndex: 1, caps: [] },
  ];
  const chosen = chooseDevice(dispositivos, 'EasyCamera (04f2:b57e)');
  assert.equal(chosen.devicePath, 'mf-easy');
  assert.equal(chosen.deviceIndex, 1);
});

// ---------------------------------------------------------------------------
// Aserciones de fuente: los caminos reales usan las reglas nuevas
// ---------------------------------------------------------------------------

test('v3.3.1 · fuente: el modal ya NO reubica en silencio (fuera el override a nextFreeSlot)', () => {
  const modal = leer('src/components/CameraConnectModal.jsx');
  assert.ok(!modal.includes('requestedHasOtherSource ? nextFreeSlot'), 'el override silencioso debe haber desaparecido');
  assert.ok(modal.includes('const effSlot = requestedSlot;'), 'el destino seleccionado manda tal cual');
});

test('v3.3.1 · fuente: App.jsx resuelve remotas con la regla y declara la negativa de programa', () => {
  const app = leer('src/App.jsx');
  assert.ok(app.includes('resolveRemoteCameraSlot({'), 'assignSlotOnce debe resolver la explícita contra la ocupación');
  assert.ok(app.includes('chooseReconnectCameraSlot({'), 'la reconexión debe usar las reglas (b)/(c)');
  assert.ok(app.includes('PROGRAMA_NO_DISPONIBLE'), 'la app debe reconocer la negativa previa del motor');
  assert.ok(app.includes('componerFuentesPrograma({'), 'la composición de fuentes debe salir de la función pura');
});

test('v3.3.1 · fuente: el motor declara PROGRAMA_NO_DISPONIBLE y normaliza nombres', () => {
  const motor = leer('electron/native-engine.js');
  assert.ok(motor.includes("code: 'PROGRAMA_NO_DISPONIBLE'"));
  assert.ok(motor.includes('normalizarNombreCamara'));
  assert.ok(!motor.includes('se usa la primera enumerada'), 'la sustitución silenciosa debe haber desaparecido');
});
