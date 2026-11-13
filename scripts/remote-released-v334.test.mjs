// ===========================================================================
// v3.3.4 — la ranura de una cámara PRESTADA al motor nativo queda
// BLOQUEADA, y la readquisición devuelve la cámara completa a su
// ranura. Escenario real (en vivo, v3.3.3 publicada): CAM 1 con la
// Steren, CAM 2 con una cámara local de la computadora; Luis abre la
// vista previa del motor ⇒ la dieta D2 LIBERA la cámara de CAM 2 (la
// saca de slotStreams y detiene sus tracks: el motor la está usando);
// con el motor en marcha llega el celular y cae EN CAM 2; al volver,
// la ocupante aparece DESPLAZADA en CAM 3.
//
// La caza en el código entregado encontró la clase completa:
//   (1) la guarda de ocupación (remoteCameraSlots.mjs) decidía sobre
//       streams/cameraMeta/assignedSlots y NO consultaba el registro
//       de liberadas (nativeReleasedCamsRef): en el instante en que
//       tampoco había meta que sostuviera la ranura, esta se leía
//       «libre» y la remota la abordaba;
//   (2) la rama de respaldo de la readquisición (getUserMedia directo)
//       escribía el stream SIN registrar cameraMeta y SIN comprobar
//       ocupación: la cámara volvía «a medias» — sin meta, la mitad
//       del predicado quedaba ciega para ella en adelante — y la
//       escritura era incondicional sobre su ranura original;
//   (3) handleAssignRemoteStream juzgaba la ranura pedida SOLO por su
//       stream: sin stream en ese instante, la daba por libre.
//
// La corrección cierra la clase, no el síntoma:
//   - «liberada-al-motor» es fuente de ocupación de primera clase del
//     predicado ÚNICO (fuentesDeOcupacion), y TODOS los caminos la
//     alimentan desde nativeReleasedCamsRef (cloud, auto-despacho,
//     oferta WebRTC, modal, reconexión de guardadas, sugerencias del
//     modal de conexión);
//   - la readquisición decide su destino con el mismo predicado
//     (elegirRanuraReadquisicion): su ranura si está libre, si no la
//     primera libre con aviso — jamás sobrescribe — y ambas ramas
//     registran la cámara COMPLETA (stream + cameraMeta);
//   - la desconexión manual retira el registro de liberada: es la
//     única vía de liberar una ranura bloqueada (regla de Luis);
//   - cada decisión de colocación se anota en el instrumento
//     ([ranura] en ventana-diag.log) con camino, ranura pedida,
//     ocupación vista y decisión final.
//
// REGLA DE LUIS (la que estas pruebas blindan): una ranura con una
// cámara conectada — incluida una prestada al motor — está OCUPADA y
// BLOQUEADA; ningún camino conecta otra cámara en ella ni expulsa a
// la ocupante; la única vía es la desconexión manual del usuario.
// ===========================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decidirColocacionRemotaCloud,
  resolveRemoteCameraSlot,
  findAvailableRemoteCameraSlot,
  chooseReconnectCameraSlot,
  elegirRanuraReadquisicion,
  fuentesDeOcupacion,
} from '../src/utils/remoteCameraSlots.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
const modalSource = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'CameraConnectModal.jsx'), 'utf8');

const SALA_CAM2 = 1; // studio_cam_2 ⇒ slotIdx 1 (la sala del escenario)
const streamSteren = { id: 'stream-steren-cam1' };
const streamCelular = { id: 'stream-celular' };
const registroLiberadaCam2 = { 1: { deviceId: 'usb-easy', label: 'EasyCamera', type: 'usb' } };

test('v3.3.4: ESCENARIO DE LUIS — CAM 2 prestada al motor (sin stream ni meta) y el celular cae en la primera libre, no en CAM 2', () => {
  // El instante ciego de la v3.3.3: la dieta liberó CAM 2 ⇒ no hay
  // stream NI meta que la sostenga; solo existe el registro de
  // liberada. La guarda vieja leía «libre»; la nueva la ve bloqueada.
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: streamSteren },
    cameraMeta: { 0: { deviceId: 'usb-steren', label: 'Steren COM-126', type: 'usb' } },
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.accion, 'colocar');
  assert.equal(d.placedSlot, 2, 'el celular va a CAM 3 (primera libre), jamás a la prestada CAM 2');
  assert.equal(d.reubicada, true);
});

test('v3.3.4: la ranura liberada bloquea aunque la meta siga presente (fuentes redundantes)', () => {
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: streamSteren },
    cameraMeta: { 1: { deviceId: 'usb-easy', label: 'EasyCamera', type: 'usb' } },
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.placedSlot, 2);
  const fuentes = fuentesDeOcupacion(1, {
    streams: { 0: streamSteren },
    cameraMeta: { 1: { deviceId: 'usb-easy' } },
    liberadasAlMotor: registroLiberadaCam2,
  });
  assert.deepEqual(fuentes, ['meta', 'liberada-al-motor'], 'el instrumento nombra ambas fuentes');
});

test('v3.3.4: resolveRemoteCameraSlot y findAvailableRemoteCameraSlot respetan la liberada', () => {
  const viaResolve = resolveRemoteCameraSlot({
    explicitSlot: 1,
    slotsCount: 4,
    streams: { 0: streamSteren },
    cameraMeta: {},
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'celular-x',
  });
  assert.equal(viaResolve, 2, 'la explícita liberada no manda: primera libre');
  const viaFind = findAvailableRemoteCameraSlot({
    slotsCount: 4,
    preferredSlot: 1,
    streams: { 0: streamSteren },
    cameraMeta: {},
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'celular-x',
  });
  assert.equal(viaFind, 2, 'la preferida liberada se salta');
});

test('v3.3.4: sin ranuras libres de verdad (streams + liberadas) la decisión es rechazar, sin tocar a nadie', () => {
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 3,
    streams: { 0: streamSteren, 2: { id: 'stream-cam3' } },
    cameraMeta: {},
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.accion, 'rechazar');
  assert.equal(d.placedSlot, null);
});

test('v3.3.4: la re-emisión con colocación viva sigue reutilizando SU ranura aunque la pedida esté liberada', () => {
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: { 1: 2 }, // este celular ya quedó en CAM 3
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: { 0: streamSteren, 2: streamCelular },
    cameraMeta: {},
    liberadasAlMotor: registroLiberadaCam2,
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.accion, 'actualizar');
  assert.equal(d.placedSlot, 2, 'la re-emisión no reevalúa: actualiza en su colocación');
});

test('v3.3.4: al apagarse el motor, la cámara liberada RECUPERA su ranura (CAM 2) si está libre', () => {
  // Motor apagado: el registro de liberadas ya se retiró y su ranura
  // no la ocupó nadie (la guarda la protegió) ⇒ vuelve a CAM 2.
  const r = elegirRanuraReadquisicion({
    ranuraOriginal: 1,
    slotsCount: 4,
    streams: { 0: streamSteren },
    cameraMeta: { 0: { deviceId: 'usb-steren' } },
    liberadasAlMotor: {},
  });
  assert.deepEqual(r, { slot: 1, reubicada: false });
});

test('v3.3.4: si una conexión manual ocupó su ranura mientras estaba prestada, la readquisición se reubica y NO sobrescribe', () => {
  const streamManual = { id: 'stream-manual-cam2' };
  const r = elegirRanuraReadquisicion({
    ranuraOriginal: 1,
    slotsCount: 4,
    streams: { 0: streamSteren, 1: streamManual },
    cameraMeta: { 1: { deviceId: 'usb-otra', type: 'usb' } },
    liberadasAlMotor: {},
  });
  assert.equal(r.slot, 2, 'primera libre en orden de ranura');
  assert.equal(r.reubicada, true);
});

test('v3.3.4: dos cámaras que vuelven en la misma pasada no eligen la misma ranura (reserva del destino)', () => {
  // La primera vuelve desplazada a CAM 3 (índice 2) y su destino queda
  // reservado en el mapa de trabajo; la segunda, con su original
  // también ocupada, debe caer en CAM 4 (índice 3), no en la misma.
  const reservadasTrasLaPrimera = { 2: { deviceId: 'readquiriendo', label: 'Cam A' } };
  const r = elegirRanuraReadquisicion({
    ranuraOriginal: 1,
    slotsCount: 4,
    streams: { 0: streamSteren, 1: { id: 'stream-manual' } },
    cameraMeta: {},
    liberadasAlMotor: reservadasTrasLaPrimera,
  });
  assert.equal(r.slot, 3);
  assert.equal(r.reubicada, true);
});

test('v3.3.4: sin ninguna ranura libre, la readquisición declara slot null (no vuelve todavía, no pisa a nadie)', () => {
  const r = elegirRanuraReadquisicion({
    ranuraOriginal: 1,
    slotsCount: 2,
    streams: { 0: streamSteren, 1: { id: 'stream-otra' } },
    cameraMeta: {},
    liberadasAlMotor: {},
  });
  assert.equal(r.slot, null);
});

test('v3.3.4: VARIANTE RESPALDO — la cámara readquirida por el respaldo (con meta registrada) lee ocupada para la siguiente decisión', () => {
  // Estado que deja la readquisición por respaldo tras la v3.3.4:
  // stream Y meta (deviceId puede venir null si el track no lo
  // declara; la ocupación la sostiene el stream, y la meta aporta
  // label/type para las decisiones que miran identidad).
  const streamsTrasRespaldo = { 0: streamSteren, 1: { id: 'stream-readquirido' } };
  const metaTrasRespaldo = { 1: { deviceId: null, label: 'EasyCamera', type: 'usb' } };
  const d = decidirColocacionRemotaCloud({
    sala: SALA_CAM2,
    colocaciones: {},
    explicitSlot: SALA_CAM2,
    slotsCount: 4,
    streams: streamsTrasRespaldo,
    cameraMeta: metaTrasRespaldo,
    liberadasAlMotor: {},
    requestingDeviceId: 'cloud_1',
  });
  assert.equal(d.placedSlot, 2, 'la readquirida no se aborda: el celular va a la primera libre');
  assert.deepEqual(
    fuentesDeOcupacion(1, { streams: streamsTrasRespaldo, cameraMeta: metaTrasRespaldo }),
    ['stream'],
    'el instrumento nombra la fuente que la sostiene',
  );
  assert.deepEqual(fuentesDeOcupacion(3, { streams: streamsTrasRespaldo, cameraMeta: metaTrasRespaldo }), [], 'una ranura libre no reporta fuentes');
});

test('v3.3.4: la reconexión de una cámara guardada tampoco aterriza en una ranura liberada', () => {
  const slot = chooseReconnectCameraSlot({
    previousSlot: 1,
    camSlots: [1, 2, 3, 4],
    streams: { 0: streamSteren },
    cameraMeta: {},
    liberadasAlMotor: registroLiberadaCam2,
  });
  assert.equal(slot, 2, 'su ranura anterior está prestada al motor: va a la primera libre');
});

test('v3.3.4: cableado — TODOS los caminos de App.jsx alimentan el registro de liberadas', () => {
  const ocurrencias = appSource.split('liberadasAlMotor: nativeReleasedCamsRef.current').length - 1;
  assert.ok(ocurrencias >= 5, `se esperaban ≥5 alimentaciones directas desde el ref y hay ${ocurrencias} (cloud, auto-despacho, oferta WebRTC, modal ×2, reconexión)`);
  assert.ok(appSource.includes('liberadasAlMotor: fuentesOcupacion.liberadasAlMotor'), 'el handler cloud pasa las liberadas a la decisión');
  assert.ok(appSource.includes('liberadasAlMotor: fuentesDespacho.liberadasAlMotor'), 'el auto-despacho pasa las liberadas');
  assert.ok(appSource.includes('liberadasAlMotor: fuentesOferta.liberadasAlMotor'), 'la oferta WebRTC pasa las liberadas');
  assert.ok(appSource.includes('liberatedSlots={nativeReleasedCamsRef.current}'), 'App entrega el registro al modal de conexión');
  assert.ok(modalSource.includes('liberadasAlMotor: liberatedSlots'), 'el modal decide sus sugerencias con las liberadas');
});

test('v3.3.4: cableado — cada decisión de colocación queda en el instrumento [ranura]', () => {
  const lineas = appSource.split("ventanaDiagSend('ranura'").length - 1;
  assert.ok(lineas >= 8, `se esperaban ≥8 registros [ranura] y hay ${lineas} (cloud ×3, despacho ×2, oferta ×2, modal ×3, readquisición ×2, desconexión ×1)`);
  assert.ok(appSource.includes('camino=cloud sala'), 'el camino cloud se identifica por sala');
  assert.ok(appSource.includes('camino=modal'), 'el camino del modal se identifica');
  assert.ok(appSource.includes('camino=readquisición-motor'), 'la readquisición también declara su decisión');
  assert.ok(appSource.includes('decision=liberar (préstamo al motor cancelado por el usuario)'), 'la desconexión manual declara la liberación del préstamo');
});

test('v3.3.4: cableado — la readquisición registra la cámara COMPLETA y la desconexión manual retira el préstamo', () => {
  assert.ok(appSource.includes('const metaVuelta = {'), 'el respaldo construye la meta completa al volver');
  assert.ok(appSource.includes('setCameraMeta((prev) => ({ ...prev, [escritura]: metaVuelta }))'), 'el respaldo escribe stream Y meta (antes: solo el stream)');
  assert.ok(appSource.includes('elegirRanuraReadquisicion({'), 'el destino de la vuelta se decide con el predicado único');
  const iDisconnect = appSource.indexOf('const handleDisconnectSlot');
  const bloqueDisconnect = appSource.slice(iDisconnect, iDisconnect + 6000);
  assert.ok(bloqueDisconnect.includes('nativeReleasedCamsRef'), 'la desconexión manual consulta el registro de liberadas');
  assert.ok(bloqueDisconnect.includes('delete sinLiberada[slot]'), 'la desconexión manual retira el registro de liberada de su ranura');
});

test('v3.3.4: el HUD del teleprompter persiste su estado entre sesiones (localStorage)', () => {
  assert.ok(appSource.includes("localStorage.getItem('podcastudio_teleprompter_hud')"), 'el estado inicial del HUD se lee de localStorage');
  assert.ok(appSource.includes("localStorage.setItem('podcastudio_teleprompter_hud', showFloatingPrompter ? '1' : '0')"), 'cada cambio del HUD se persiste');
  assert.ok(!appSource.includes('const [showFloatingPrompter, setShowFloatingPrompter] = useState(false);'), 'ya no nace apagado por defecto en cada arranque');
});
