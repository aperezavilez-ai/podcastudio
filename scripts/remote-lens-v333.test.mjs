// ============================================================================
// v3.3.3 (defecto B) — el OJO DE PEZ de la cámara remota.
// Investigación: fixes/INVESTIGACION-v333-remota.md §1. La página del
// celular (src/pages/RemoteCam.jsx) NUNCA elegía lente: pedía solo
// `facingMode: { ideal: 'environment' }` con 720p, y con esa petición
// laxa el navegador/SO puede satisfacerla con la lente ULTRA GRAN
// ANGULAR (0,5×) — la que curva paredes y piso en la captura
// image-134 de Luis —. Tampoco se registraba la lente servida.
// La corrección: elegir la cámara ESTÁNDAR (1×) por etiqueta tras
// enumerateDevices y pedirla por deviceId exacto (módulo puro
// src/utils/remoteCameraLens.mjs), con caída declarada a facingMode
// si no hay elección segura, y la lente servida registrada y visible.
// Declarado: lo que SOLO se prueba con el iPhone de Luis en la mano
// es qué lente sirve Safari iOS con cada petición — por eso la página
// ahora muestra la etiqueta real de la lente en uso.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elegirCamaraEstandar, esEtiquetaLenteNoEstandar, lenteServidaEsNoEstandar } from '../src/utils/remoteCameraLens.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const remoteSource = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'RemoteCam.jsx'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');

// Lista típica de un Android con tres lentes traseras (etiquetas reales
// de Chrome Android) y de un iPhone (Safari iOS).
const ANDROID = [
  { deviceId: 'front-1', kind: 'videoinput', label: 'camera 1, facing front' },
  { deviceId: 'back-main', kind: 'videoinput', label: 'camera 0, facing back' },
  { deviceId: 'back-ultra', kind: 'videoinput', label: 'camera 2, facing back, ultra wide' },
  { deviceId: 'back-tele', kind: 'videoinput', label: 'camera 3, facing back, telephoto' },
];
const IPHONE = [
  { deviceId: 'ios-front', kind: 'videoinput', label: 'Front Camera' },
  { deviceId: 'ios-back', kind: 'videoinput', label: 'Back Camera' },
  { deviceId: 'ios-ultra', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
  { deviceId: 'ios-tele', kind: 'videoinput', label: 'Back Telephoto Camera' },
];

test('v3.3.3-B: con varias lentes traseras elige la ESTÁNDAR (1×), nunca la ultra ni la tele', () => {
  const a = elegirCamaraEstandar(ANDROID, 'environment');
  assert.equal(a.deviceId, 'back-main');
  const i = elegirCamaraEstandar(IPHONE, 'environment');
  assert.equal(i.deviceId, 'ios-back');
  assert.ok(!esEtiquetaLenteNoEstandar(a.label) && !esEtiquetaLenteNoEstandar(i.label));
});

test('v3.3.3-B: el detector de lente no estándar caza ultra/0.5/tele/gran angular y respeta la principal «wide»', () => {
  assert.equal(esEtiquetaLenteNoEstandar('Back Ultra Wide Camera'), true);
  assert.equal(esEtiquetaLenteNoEstandar('Cámara gran angular 0.5x'), true);
  assert.equal(esEtiquetaLenteNoEstandar('camera 3, facing back, telephoto'), true);
  assert.equal(esEtiquetaLenteNoEstandar('Back Camera'), false);
  assert.equal(esEtiquetaLenteNoEstandar('Back Wide Camera'), false, 'la «wide» a secas ES la 1× en muchos teléfonos: no se excluye');
  assert.equal(esEtiquetaLenteNoEstandar(''), false);
  assert.equal(lenteServidaEsNoEstandar('Back Ultra Wide Camera'), true);
});

test('v3.3.3-B: el volteo a frontal elige la frontal estándar (facing contrario REAL)', () => {
  const a = elegirCamaraEstandar(ANDROID, 'user');
  assert.equal(a.deviceId, 'front-1');
  const i = elegirCamaraEstandar(IPHONE, 'user');
  assert.equal(i.deviceId, 'ios-front');
});

test('v3.3.3-B: sin etiquetas aprovechables NO adivina — null y la página cae a facingMode (declarado)', () => {
  // Etiquetas vacías (sin permiso previo) o ambiguas: elegir a ciegas
  // podría fijar la ultra con deviceId exacto, peor que no elegir.
  assert.equal(elegirCamaraEstandar([], 'environment'), null);
  assert.equal(elegirCamaraEstandar([{ deviceId: 'x', kind: 'videoinput', label: '' }], 'environment')?.deviceId, 'x', 'una sola candidata limpia sí se puede pedir');
  assert.equal(elegirCamaraEstandar([
    { deviceId: 'x', kind: 'videoinput', label: '' },
    { deviceId: 'y', kind: 'videoinput', label: '' },
  ], 'environment'), null, 'dos candidatas sin etiqueta de lado: no se adivina el facing');
  assert.equal(elegirCamaraEstandar([
    { deviceId: 'u', kind: 'videoinput', label: 'Back Ultra Wide Camera' },
  ], 'environment'), null, 'si SOLO hay ultra etiquetada, tampoco se fija: manda facingMode y se declara la servida');
});

// --- Cableado en la página y en el estudio (fuente) ---

test('v3.3.3-B (cableado): la página enumera, elige la estándar y la pide por deviceId EXACTO antes que facingMode', () => {
  assert.ok(remoteSource.includes('enumerateDevices'), 'la página enumera dispositivos tras el permiso');
  assert.ok(remoteSource.includes('elegirCamaraEstandar'), 'la elección pasa por el módulo de lente');
  assert.ok(remoteSource.includes('deviceId: { exact: elegida.deviceId }'), 'la elegida se pide por deviceId exacto');
  assert.ok(remoteSource.includes('lenteServida'), 'la lente realmente servida queda registrada (estado/payload)');
});

test('v3.3.3-B (cableado): la lente servida se publica en la presencia y el estudio la muestra (aceptación verificable)', () => {
  assert.ok(remoteSource.includes('lensLabel'), 'el payload de presencia de la página lleva la lente servida (lensLabel)');
  // En el estudio, la lente servida se lee del track recibido al
  // asignar (su label refleja el dispositivo de captura) y queda en
  // la entrada de remoteCams y en la etiqueta de la cámara.
  assert.ok(appSource.includes('const lensLabel = trackVideoVivo?.label'), 'el estudio lee la lente servida del track recibido');
  assert.ok(appSource.includes('lensLabel: lensLabel || undefined'), 'la lente queda guardada con la remota colocada');
  assert.ok(appSource.includes('lente no estándar'), 'si entró una lente no estándar, el estudio lo declara en la etiqueta de la cámara');
});

test('v3.3.3-B (cableado): la presentación del mosaico no deforma la remota — objectFit contain solo para fuentes remotas', () => {
  // VideoTile (la superficie compartida de los mosaicos) acepta
  // objectFit con 'cover' por defecto — las locales no cambian — y el
  // render del mosaico pasa 'contain' cuando la fuente de la ranura es
  // remota (meta remote/mobile o el stream de un celular), para
  // mostrar el fotograma completo sin el recorte que «acerca» la toma
  // (diagnóstico 2026-11-12). El mosaico no alimenta la composición,
  // así que el ajuste no entra a la grabación.
  assert.ok(appSource.includes("objectFit = 'cover'"), 'el defecto de presentación sigue siendo cover');
  assert.ok(appSource.includes("objectFit === 'contain' ? 'object-contain' : 'object-cover'"), 'el tile aplica contain solo cuando se le pide');
  assert.ok(appSource.includes("? 'contain' : 'cover'"), 'el mosaico elige contain para remotas y cover para locales');
  assert.ok(appSource.includes("cameraMeta[camId - 1]?.type === 'remote'"), 'la decisión de contain se toma por el tipo de fuente de la ranura');
});
