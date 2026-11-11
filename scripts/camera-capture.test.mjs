// Test de la lógica pura de captura de cámaras (src/utils/cameraCapture.mjs).
//
// Regresión cubierta (informe-1-camaras-usb.md §1): sin escalera de
// perfiles ni presupuesto de bus, cada cámara se pedía a 1080p «ideal»
// con piso de 15 fps y se aceptaba lo que el driver entregara.
//
// Uso: node --test scripts/camera-capture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTURE_PROFILES,
  MAX_CAMERAS_1080,
  profileById,
  profileIndex,
  chooseInitialProfile,
  evaluateMeasurement,
  nextProfileDown,
  buildVideoConstraints,
} from '../src/utils/cameraCapture.mjs';

test('orden de la escalera: 1080p30 → 720p30 → 480p30 y suelo en 480p30', () => {
  assert.deepEqual(CAPTURE_PROFILES.map((p) => p.id), ['1080p30', '720p30', '480p30']);
  assert.equal(profileIndex('1080p30'), 0);
  assert.equal(profileIndex('720p30'), 1);
  assert.equal(profileIndex('480p30'), 2);
  assert.equal(profileIndex('inexistente'), -1);
  assert.equal(profileById('720p30').width, 1280);
  assert.equal(profileById('inexistente'), null);
  assert.equal(nextProfileDown('1080p30').id, '720p30');
  assert.equal(nextProfileDown('720p30').id, '480p30');
  assert.equal(nextProfileDown('480p30'), null);
  assert.equal(MAX_CAMERAS_1080, 2);
});

test('presupuesto: la 3ª cámara sin perfil guardado arranca en 720p30', () => {
  const first = chooseInitialProfile({ savedProfileId: null, idsAt1080: [], camId: 1 });
  assert.equal(first.id, '1080p30');
  const second = chooseInitialProfile({ savedProfileId: null, idsAt1080: [1], camId: 2 });
  assert.equal(second.id, '1080p30');
  const third = chooseInitialProfile({ savedProfileId: null, idsAt1080: [1, 2], camId: 3 });
  assert.equal(third.id, '720p30');
});

test('guardado 1080p30 con presupuesto lleno por otras cámaras → 720p30', () => {
  const profile = chooseInitialProfile({ savedProfileId: '1080p30', idsAt1080: [1, 2], camId: 3 });
  assert.equal(profile.id, '720p30');
});

test('guardado respetado si hay presupuesto (y si la cámara ya está en 1080)', () => {
  const withBudget = chooseInitialProfile({ savedProfileId: '1080p30', idsAt1080: [9], camId: 3 });
  assert.equal(withBudget.id, '1080p30');
  const alreadyIn = chooseInitialProfile({ savedProfileId: '1080p30', idsAt1080: [1, 3], camId: 3 });
  assert.equal(alreadyIn.id, '1080p30');
  const saved720 = chooseInitialProfile({ savedProfileId: '720p30', idsAt1080: [1, 2], camId: 3 });
  assert.equal(saved720.id, '720p30');
  const saved480 = chooseInitialProfile({ savedProfileId: '480p30', idsAt1080: [], camId: 1 });
  assert.equal(saved480.id, '480p30');
});

test('downgrade por fps bajo: pide 30 y entrega 15', () => {
  const result = evaluateMeasurement({
    profile: profileById('1080p30'),
    measuredFps: 15,
    measuredWidth: 1920,
    measuredHeight: 1080,
  });
  assert.equal(result.action, 'downgrade');
  assert.equal(result.nextProfile.id, '720p30');
  assert.equal(result.reason, 'fps-bajo');
});

test('downgrade por resolución menor: pide 1920 y entrega 1280', () => {
  const result = evaluateMeasurement({
    profile: profileById('1080p30'),
    measuredFps: 30,
    measuredWidth: 1280,
    measuredHeight: 720,
  });
  assert.equal(result.action, 'downgrade');
  assert.equal(result.nextProfile.id, '720p30');
  assert.equal(result.reason, 'resolucion-menor');
});

test('downgrade por 0 fotogramas en la ventana de medición', () => {
  const result = evaluateMeasurement({
    profile: profileById('720p30'),
    measuredFps: 0,
    measuredWidth: 0,
    measuredHeight: 0,
  });
  assert.equal(result.action, 'downgrade');
  assert.equal(result.nextProfile.id, '480p30');
  assert.equal(result.reason, 'sin-fotogramas');
});

test('keep con medición buena: 30 fps y 1920 de ancho', () => {
  const result = evaluateMeasurement({
    profile: profileById('1080p30'),
    measuredFps: 30,
    measuredWidth: 1920,
    measuredHeight: 1080,
  });
  assert.equal(result.action, 'keep');
  assert.equal(result.nextProfile.id, '1080p30');
  assert.equal(result.reason, 'ok');
});

test('suelo: en 480p30 con fps 10 se mantiene (no hay escalón inferior)', () => {
  const result = evaluateMeasurement({
    profile: profileById('480p30'),
    measuredFps: 10,
    measuredWidth: 854,
    measuredHeight: 480,
  });
  assert.equal(result.action, 'keep');
  assert.equal(result.nextProfile.id, '480p30');
  const noFrames = evaluateMeasurement({
    profile: profileById('480p30'),
    measuredFps: 0,
    measuredWidth: 0,
    measuredHeight: 0,
  });
  assert.equal(noFrames.action, 'keep');
});

test('constraints exactos: width/height exact, deviceId exact, fps ideal+max', () => {
  const constraints = buildVideoConstraints(profileById('720p30'), 'device-abc');
  assert.deepEqual(constraints, {
    deviceId: { exact: 'device-abc' },
    width: { exact: 1280 },
    height: { exact: 720 },
    frameRate: { ideal: 30, max: 30 },
  });
  const noDevice = buildVideoConstraints(profileById('1080p30'), '');
  assert.equal('deviceId' in noDevice, false);
  assert.deepEqual(noDevice.width, { exact: 1920 });
  assert.deepEqual(noDevice.height, { exact: 1080 });
});
