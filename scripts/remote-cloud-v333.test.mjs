// ============================================================================
// v3.3.3 (defecto A) — el 4º camino de la remota: la RE-EMISIÓN del
// transporte cloud. La investigación (fixes/INVESTIGACION-v333-remota.md)
// localizó el camino que la v3.3.1 no cubrió: el transporte cloud
// (src/utils/streamTransport.js, dispatchStreamUpdate ~línea 177/210)
// emite «streamConnected» en CADA actualización de pistas (ontrack de
// video, luego de audio, renegociaciones, onunmute), no una sola vez por
// conexión, y el handler del estudio (src/App.jsx, setupSlot) ejecutaba
// la colocación COMPLETA en cada emisión, claveada por la ranura de la
// SALA (App.jsx:3526-3579 en la base v3.3.1/v3.3.2), sin preguntar
// «¿este celular ya quedó colocado?»: en una re-emisión, si la ocupante
// no se veía en slotStreams/cameraMeta en ese instante, el handler
// volvía a evaluar la ranura de la sala como nueva y pisaba a la
// ocupante — el síntoma que Luis siguió viendo en vivo (captura
// image-134: la remota en CAM 2 como PGM con CAM 4 vacía).
//
// La corrección: la decisión de colocación vive en UNA función pura
// (decidirColocacionRemotaCloud en src/utils/remoteCameraSlots.mjs) que
// el handler consulta en TODAS las emisiones:
//   - con colocación viva ⇒ 'actualizar' EN ESA ranura: nunca se
//     reevalúa ocupación ni se escribe en otra ranura;
//   - sin colocación ⇒ manda resolveRemoteCameraSlot (la explícita solo
//     si está libre; si no, la primera libre; la ocupante intacta);
//   - sin libres ⇒ 'rechazar' declarado.
// Y el handler queda cableado a esa decisión: las pruebas de abajo
// fijan la función pura (comportamiento) y el cableado en App.jsx
// (código fuente, como las demás invariantes del renderer en este repo:
// ver native-session-upgrade.test.mjs).
//
// REGLA DE LUIS (la que estas pruebas blindan): una ranura con una
// cámara conectada está OCUPADA y BLOQUEADA — ningún camino conecta
// otra cámara en ella ni expulsa a la ocupante; la única vía es la
// desconexión manual del usuario.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidirColocacionRemotaCloud } from '../src/utils/remoteCameraSlots.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');

const SALA_CAM2 = 1; // studio_cam_2 ⇒ slotIdx 1 (la sala de la captura)
const streamOcupante = { id: 'stream-camara-local-cam2' };
const streamCelular = { id: 'stream-celular' };

test('v3.3.3-A: la primera conexión con la sala ocupada va a la primera libre y la ocupante queda intacta', () => {
  // Escenario de la captura image-134 ANTES de la corrección: CAM 2
  // ocupada por una cámara local, CAM 4 libre; el celular llega a la
  // sala studio_cam_2 pidiendo su ranura.
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: { id: 'cam1' }, 1: streamOcupante, 2: { id: 'cam3' } },
    cameraMeta: { 1: { deviceId: 'usb-cam-2' } },
    localStreamActive: true,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.accion, 'colocar');
  assert.equal(d.placedSlot, 3, 'el celular debe caer en CAM 4, la primera libre');
  assert.equal(d.reubicada, true);
});

test('v3.3.3-A: doble streamConnected de la misma sala ⇒ la re-emisión SOLO actualiza en su colocación (la ocupante intacta)', () => {
  // La secuencia real del transporte: ontrack de video (1ª emisión,
  // colocación inicial con la ocupante de CAM 2 aún no visible en los
  // mapas — puesta en CAM 2, como pasaba antes), luego ontrack de
  // audio (2ª emisión) cuando la ocupante YA se ve en los mapas.
  // Sin la guarda, la 2ª emisión reevaluaba la sala y pisaba a la
  // ocupante; con la guarda, solo actualiza el stream en la ranura ya
  // colocada y jamás escribe en ninguna otra.
  const colocaciones = {};
  const primera = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones,
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: { id: 'cam1' } },
    cameraMeta: {},
    localStreamActive: true,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(primera.accion, 'colocar');
  colocaciones[SALA_CAM2] = primera.placedSlot; // el handler registra la colocación

  // 2ª emisión — ahora SÍ se ve una ocupante en la ranura de la sala
  // (distinto stream, metadatos de USB): el escenario exacto de la
  // expulsión. La decisión debe ser actualizar en la colocación.
  const segunda = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones,
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: { id: 'cam1' }, 1: streamOcupante },
    cameraMeta: { 1: { deviceId: 'usb-cam-2' } },
    localStreamActive: true,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(segunda.accion, 'actualizar');
  assert.equal(segunda.placedSlot, primera.placedSlot, 'la re-emisión no mueve al celular de su colocación');
  assert.equal(segunda.reemision, true);

  // Y aunque luego la colocación misma parezca «ocupada por otra»
  // (los mapas cambiaron del todo), la re-emisión NUNCA reevalúa:
  const tercera = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones,
    explicitSlot: 0,
    slotsCount: 4,
    streams: { 0: streamOcupante, 1: streamOcupante, 2: streamOcupante, 3: streamOcupante },
    cameraMeta: { 1: { deviceId: 'otra-cosa' } },
    localStreamActive: true,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(tercera.accion, 'actualizar');
  assert.equal(tercera.placedSlot, primera.placedSlot);
});

test('v3.3.3-A: sin ranuras libres ⇒ rechazo declarado (no se conecta y nadie sale)', () => {
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: { id: 'a' }, 1: streamOcupante, 2: { id: 'c' }, 3: { id: 'd' } },
    cameraMeta: {},
    localStreamActive: true,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.accion, 'rechazar');
  assert.equal(d.placedSlot, null);
});

test('v3.3.3-A: intento directo sobre una ranura ocupada sin ser re-emisión ⇒ no la aborda (primera libre o rechazo)', () => {
  // Un camino NUEVO (sin colocación previa de esta sala) que pide la
  // ranura ocupada: la guarda lo manda a la primera libre; la ocupante
  // no se toca. Es la regla de Luis aplicada a cualquier camino.
  const d = decidirColocacionRemotaCloud({
    sala: 2,
    colocaciones: {},
    explicitSlot: 1, // pide CAM 2, ocupada
    slotsCount: 4,
    streams: { 0: { id: 'a' }, 1: streamOcupante, 3: { id: 'd' } },
    cameraMeta: { 1: { deviceId: 'usb-cam-2' } },
    localStreamActive: true,
    requestingDeviceId: 'cloud_2',
  });
  assert.equal(d.accion, 'colocar');
  assert.equal(d.placedSlot, 2, 'CAM 3 es la primera libre: ahí va, sin abordar CAM 2');
});

// --- Cableado en App.jsx (fuente): el handler pasa por la guarda ---

const iSetup = appSource.indexOf("cloudTransport.on('streamConnected'");
const iSetupFin = appSource.indexOf("cloudTransport.on('streamDisconnected'", iSetup);
const setupBody = appSource.slice(iSetup, iSetupFin);

test('v3.3.3-A (cableado): el handler cloud decide con decidirColocacionRemotaCloud en CADA emisión', () => {
  assert.ok(iSetup >= 0 && iSetupFin > iSetup, 'se localizó el handler streamConnected del transporte cloud');
  assert.ok(setupBody.includes('decidirColocacionRemotaCloud('), 'la colocación pasa por la función única con reutilización');
  assert.ok(setupBody.includes('colocacionCloudRef.current[slotIdx]'), 'la colocación se lee/registra por sala: es la memoria de la reutilización');
});

test('v3.3.3-A (cableado): en una re-emisión el handler no detiene pistas de otra fuente ni reubica la colocación', () => {
  assert.ok(setupBody.includes('if (decision.reemision)'), 'la re-emisión tiene su rama propia y temprana');
  const iReemision = setupBody.indexOf('if (decision.reemision)');
  const iResto = setupBody.indexOf('const decisionDespues', iReemision);
  const rama = setupBody.slice(iReemision, iResto > iReemision ? iResto : iReemision + 1800);
  assert.ok(!rama.includes('.stop()'), 'la rama de re-emisión no detiene tracks de nadie');
  assert.ok(!rama.includes('findAvailableRemoteCameraSlot'), 'la rama de re-emisión NO reevalúa ocupación');
  assert.ok(rama.includes('setSlotStreams'), 'la re-emisión sí actualiza el stream en su ranura ya colocada');
});

test('v3.3.3-A (cableado): la rama placedSlot===0 ya no detiene los tracks locales en emisiones de conexión', () => {
  assert.ok(
    !setupBody.includes('localStreamRef.current.getTracks().forEach'),
    'ninguna emisión de streamConnected puede detener los tracks de la cámara local (eso expulsaba a la ocupante de CAM 1)',
  );
});

test('v3.3.3-A (cableado): el rechazo sin ranuras libres se declara en la interfaz y no escribe ninguna ranura', () => {
  assert.ok(setupBody.includes("decision.accion === 'rechazar'"), 'el handler contempla el rechazo de la guarda');
  const iRechazo = setupBody.indexOf("decision.accion === 'rechazar'");
  const iColocar = setupBody.indexOf('setSlotStreams', iRechazo);
  const ramaRechazo = setupBody.slice(iRechazo, iColocar);
  assert.ok(ramaRechazo.includes('setMobileStatus'), 'el rechazo se declara visible al usuario');
  assert.ok(ramaRechazo.includes('return;'), 'el rechazo corta el handler: no hay escritura posterior');
});
