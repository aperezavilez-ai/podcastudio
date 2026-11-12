// ===========================================================================
// Pruebas del puente OBS (Plan B, hito de prueba de vida v2.1.0) —
// electron/obs-bridge.js. Todo puro o contra un cliente OBS falso con
// estado: ningún test necesita un OBS real.
//   (a) Autenticación del handshake obs-websocket 5.x contra un vector
//       calculado A MANO (Python hashlib, fuera de este repo):
//         password  = 'podcast-test-password'
//         salt      = 'PZd2m7nJ8kL4pQ6rS1tVxW3y'
//         challenge = 'xY9aB3cD5eF7gH9jK1mN4pQ6'
//         secret    = base64(sha256(password + salt))
//         auth      = base64(sha256(secret + challenge))
//                   = 'S0SII+PimLitKZnv2MXVjOInNOFWW3zo57TfM3x8Pe0='
//   (b) Aprovisionamiento idempotente contra el cliente falso: la primera
//       corrida crea escena/fuentes/dispositivos; la segunda no crea NADA
//       (ni una sola petición mutante) y reutiliza todo.
//   (c) Traducción del destino guardado (construido con el constructor
//       endurecido real, buildStreamDestinations) a los ajustes de
//       servicio RTMP de OBS: servidor normalizado, clave exactamente
//       una vez.
// ===========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  OBS_SCENE_FALLBACK,
  OBS_CINTILLO_INPUT_NAME,
  obsCameraInputName,
  computeAuthentication,
  buildRtmpCustomSettings,
  renderCintilloHtml,
  provisionObs,
} = require('../electron/obs-bridge.js');
const { buildStreamDestinations } = await import('../src/utils/streamDestinations.mjs');

// --- (a) autenticación ------------------------------------------------------

test('auth obs-websocket: vector conocido calculado a mano (sha256 encadenado)', () => {
  const auth = computeAuthentication(
    'podcast-test-password',
    'PZd2m7nJ8kL4pQ6rS1tVxW3y',
    'xY9aB3cD5eF7gH9jK1mN4pQ6',
  );
  assert.equal(auth, 'S0SII+PimLitKZnv2MXVjOInNOFWW3zo57TfM3x8Pe0=');
});

test('auth obs-websocket: cambiar contraseña, sal o challenge cambia el resultado', () => {
  const base = computeAuthentication('p', 's', 'c');
  assert.notEqual(computeAuthentication('p2', 's', 'c'), base);
  assert.notEqual(computeAuthentication('p', 's2', 'c'), base);
  assert.notEqual(computeAuthentication('p', 's', 'c2'), base);
  // Formato: base64 de un resumen sha256 (32 bytes).
  assert.equal(Buffer.from(base, 'base64').length, 32);
});

// --- (c) destino guardado -> ajustes RTMP de OBS ----------------------------

test('destino Facebook guardado -> rtmp_custom con servidor y clave separados, clave una sola vez', () => {
  const [dest] = buildStreamDestinations({
    facebook: { server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: 'FB-TESTKEY-123', enabled: true },
  });
  const res = buildRtmpCustomSettings(dest);
  assert.equal(res.streamServiceType, 'rtmp_custom');
  assert.deepEqual(res.streamServiceSettings, {
    server: 'rtmps://live-api-s.facebook.com:443/rtmp',
    key: 'FB-TESTKEY-123',
  });
  const recombined = `${res.streamServiceSettings.server}/${res.streamServiceSettings.key}`;
  assert.equal(recombined, dest.url);
  assert.equal(recombined.split('FB-TESTKEY-123').length - 1, 1);
});

test('destino con la clave ya pegada al servidor no la duplica en los ajustes de OBS', () => {
  const [dest] = buildStreamDestinations({
    facebook: { server: 'rtmps://live-api-s.facebook.com:443/rtmp/FB-DUP-9', key: 'FB-DUP-9', enabled: true },
  });
  const res = buildRtmpCustomSettings(dest);
  assert.equal(res.streamServiceSettings.key, 'FB-DUP-9');
  assert.ok(!res.streamServiceSettings.server.includes('FB-DUP-9'));
  const recombined = `${res.streamServiceSettings.server}/${res.streamServiceSettings.key}`;
  assert.equal(recombined.split('FB-DUP-9').length - 1, 1);
});

test('destino sin URL RTMP válida se rechaza antes de tocar OBS', () => {
  assert.throws(() => buildRtmpCustomSettings({ id: 'x', url: 'https://example.com/nope' }), /RTMP válida/);
});

// --- cintillo HTML ----------------------------------------------------------

test('cintillo HTML: transparente, con tag/texto/subtítulo y color; inactivo = cuerpo vacío', () => {
  const html = renderCintilloHtml({ active: true, tag: 'TEMA', text: 'El futuro del podcast', subtitle: 'con Luis', color: '#e8612a' });
  assert.match(html, /background: transparent/);
  assert.match(html, /TEMA/);
  assert.match(html, /El futuro del podcast/);
  assert.match(html, /con Luis/);
  assert.match(html, /#e8612a/);
  const off = renderCintilloHtml({ active: false, text: 'no debe verse' });
  assert.ok(!off.includes('no debe verse'));
  const xss = renderCintilloHtml({ active: true, tag: '<script>', text: 'a & b', color: 'red; } body { display:none' });
  assert.ok(!xss.includes('<script>'));
  assert.match(xss, /a &amp; b/);
});

// --- (b) aprovisionamiento idempotente contra un OBS falso ------------------
// Cliente falso con estado: aplica las creaciones a su propio almacén, así
// la segunda corrida «ve» lo que la primera creó — igual que un OBS real.
function createFakeObs() {
  const state = {
    collections: ['Default'],
    currentCollection: 'Default',
    scenes: [],
    inputs: new Map(), // inputName -> { inputKind, inputSettings }
    sceneItems: new Map(), // sceneName -> Set(sourceName)
    dshowDevices: [
      { itemName: 'EasyCamera', itemValue: 'dev-easy-001', itemEnabled: true },
      { itemName: 'USB Webcam Pro', itemValue: 'dev-pro-002', itemEnabled: true },
    ],
  };
  const calls = [];
  const MUTATING = new Set(['SetCurrentSceneCollection', 'CreateScene', 'CreateInput', 'CreateSceneItem', 'SetInputSettings', 'SetCurrentProgramScene']);
  async function call(type, data = {}) {
    calls.push({ type, data });
    switch (type) {
      case 'GetSceneCollectionList':
        return { currentSceneCollectionName: state.currentCollection, sceneCollections: [...state.collections] };
      case 'SetCurrentSceneCollection':
        state.currentCollection = data.sceneCollectionName;
        return {};
      case 'GetSceneList':
        return { currentProgramSceneName: state.scenes[0] || null, scenes: state.scenes.map((sceneName, i) => ({ sceneName, sceneIndex: i })) };
      case 'CreateScene':
        state.scenes.push(data.sceneName);
        state.sceneItems.set(data.sceneName, new Set());
        return { sceneUuid: 'uuid' };
      case 'GetInputList':
        return { inputs: [...state.inputs.entries()].map(([inputName, v]) => ({ inputName, inputKind: v.inputKind })) };
      case 'CreateInput': {
        state.inputs.set(data.inputName, { inputKind: data.inputKind, inputSettings: { ...(data.inputSettings || {}) } });
        if (!state.sceneItems.has(data.sceneName)) state.sceneItems.set(data.sceneName, new Set());
        state.sceneItems.get(data.sceneName).add(data.inputName);
        return { sceneItemId: 1 };
      }
      case 'CreateSceneItem':
        state.sceneItems.get(data.sceneName)?.add(data.sourceName);
        return { sceneItemId: 2 };
      case 'GetSceneItemList':
        return { sceneItems: [...(state.sceneItems.get(data.sceneName) || [])].map((sourceName, i) => ({ sourceName, sceneItemId: i + 1 })) };
      case 'GetInputSettings': {
        const input = state.inputs.get(data.inputName);
        if (!input) throw new Error(`fake OBS: no existe ${data.inputName}`);
        return { inputSettings: { ...input.inputSettings }, inputKind: input.inputKind };
      }
      case 'SetInputSettings': {
        const input = state.inputs.get(data.inputName);
        if (!input) throw new Error(`fake OBS: no existe ${data.inputName}`);
        if (data.overlay === false) input.inputSettings = { ...(data.inputSettings || {}) };
        else Object.assign(input.inputSettings, data.inputSettings || {});
        return {};
      }
      case 'GetInputPropertiesListPropertyItems':
        if (data.propertyName !== 'video_device_id') return { propertyItems: [] };
        return { propertyItems: state.dshowDevices };
      default:
        throw new Error(`fake OBS: petición no modelada ${type}`);
    }
  }
  return { state, calls, call, mutatingCalls: () => calls.filter((c) => MUTATING.has(c.type)) };
}

const PROVISION_CONFIG = {
  cameras: [
    { slot: 0, deviceId: 'gum-device-aaa', label: 'USB Webcam Pro (046d:0825)' },
    { slot: 1, deviceId: 'gum-device-bbb', label: 'EasyCamera (04f2:b57e)' },
    { slot: 4, deviceId: 'gum-device-ccc', label: 'Otra cámara sin pareja' },
  ],
  cintilloUrl: 'file:///C:/Users/test/AppData/Roaming/podcaststudio/cintillo-bridge.html',
};

test('provision: primera corrida crea escena, cámaras de la LISTA y cintillo; empareja dispositivos por etiqueta', async () => {
  const fake = createFakeObs();
  const res = await provisionObs(fake.call, PROVISION_CONFIG);
  // Sin colección «PodcastStudio» en el falso -> respaldo en la colección actual.
  assert.equal(res.collectionFallback, true);
  assert.equal(res.sceneName, OBS_SCENE_FALLBACK);
  assert.ok(fake.state.scenes.includes(OBS_SCENE_FALLBACK));
  // La lista manda: se crean las fuentes de TODAS las cámaras pasadas (3).
  for (const cam of PROVISION_CONFIG.cameras) {
    assert.ok(fake.state.inputs.has(obsCameraInputName(cam.slot)), `falta ${obsCameraInputName(cam.slot)}`);
  }
  assert.ok(fake.state.inputs.has(OBS_CINTILLO_INPUT_NAME));
  // Emparejamiento por etiqueta (no por orden): CAM 1 (slot 0) es la Pro,
  // CAM 2 (slot 1) es la EasyCamera, aunque el falso las lista al revés.
  assert.equal(fake.state.inputs.get(obsCameraInputName(0)).inputSettings.video_device_id, 'dev-pro-002');
  assert.equal(fake.state.inputs.get(obsCameraInputName(1)).inputSettings.video_device_id, 'dev-easy-001');
  const items = fake.state.sceneItems.get(OBS_SCENE_FALLBACK);
  for (const name of [obsCameraInputName(0), obsCameraInputName(1), obsCameraInputName(4), OBS_CINTILLO_INPUT_NAME]) {
    assert.ok(items.has(name), `ítem ${name} en escena`);
  }
});

test('provision: segunda corrida NO crea nada ni muta ajustes (idempotente)', async () => {
  const fake = createFakeObs();
  await provisionObs(fake.call, PROVISION_CONFIG);
  const before = fake.calls.length;
  const res2 = await provisionObs(fake.call, PROVISION_CONFIG);
  const secondRun = fake.calls.slice(before);
  const mutating = secondRun.filter((c) => ['SetCurrentSceneCollection', 'CreateScene', 'CreateInput', 'CreateSceneItem', 'SetInputSettings'].includes(c.type));
  assert.deepEqual(mutating, []);
  assert.equal(res2.created.length, 0);
  assert.ok(res2.reused.length >= 4);
});

test('provision: con colección «PodcastStudio» existente la usa y la escena es «Programa»', async () => {
  const fake = createFakeObs();
  fake.state.collections.push('PodcastStudio');
  const res = await provisionObs(fake.call, { cameras: [], cintilloUrl: PROVISION_CONFIG.cintilloUrl });
  assert.equal(res.collectionFallback, false);
  assert.equal(res.sceneName, 'Programa');
  assert.equal(fake.state.currentCollection, 'PodcastStudio');
  assert.ok(fake.state.scenes.includes('Programa'));
});
