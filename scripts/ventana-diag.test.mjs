// ============================================================================
// Pruebas del núcleo puro del instrumento de diagnóstico de ventana
// (build diagnóstica post-v3.2.4) — electron/ventana-diag-core.js.
//
// El instrumento mide la traba al cambiar de ventana SIN tocar el
// comportamiento medido: el renderer manda un ping cada 500 ms y main
// agrega el retraso de LLEGADA una vez por segundo. Todo lo de aquí es
// puro: ningún Electron ni ningún temporizador real se ejecuta.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { formatDiagLine, createPingAggregator } = require('../electron/ventana-diag-core.js');

test('formatDiagLine: forma exacta [ISO] [prefijo] texto', () => {
  assert.equal(
    formatDiagLine('2026-11-13T07:20:00.000Z', 'ping', 'retrasoMaxUltimoSegundo=0ms pingsUltimoSegundo=2'),
    '[2026-11-13T07:20:00.000Z] [ping] retrasoMaxUltimoSegundo=0ms pingsUltimoSegundo=2',
  );
});

test('agregador: pings puntuales cada 500 ms dan retraso máximo 0', () => {
  const agg = createPingAggregator(500);
  agg.push(1000);
  agg.push(1500);
  agg.push(2000);
  const s = agg.flush();
  assert.equal(s.pings, 3);
  assert.equal(s.maxDelayMs, 0);
});

test('agregador: un hueco de 3 s se mide como 2500 ms de retraso', () => {
  const agg = createPingAggregator(500);
  agg.push(1000);
  agg.push(1500);
  // El renderer se cuelga: el siguiente ping tarda 3 s en llegar.
  agg.push(4500);
  agg.push(5000);
  const s = agg.flush();
  assert.equal(s.pings, 4);
  assert.equal(s.maxDelayMs, 2500);
});

test('agregador: flush reinicia la ventana y conserva la marca del último ping', () => {
  const agg = createPingAggregator(500);
  agg.push(1000);
  const s1 = agg.flush();
  assert.equal(s1.pings, 1);
  assert.equal(s1.maxDelayMs, null); // un solo ping: aún no hay hueco medible
  const s2 = agg.flush();
  assert.equal(s2.pings, 0);
  assert.equal(s2.maxDelayMs, null); // ventana vacía: el renderer calló
  // El hueco entre el último ping de antes y el primero de ahora se
  // atribuye a la ventana en la que el ping LLEGA.
  agg.push(4000);
  const s3 = agg.flush();
  assert.equal(s3.pings, 1);
  assert.equal(s3.maxDelayMs, 2500);
});

test('agregador: el primer ping de la historia no inventa retraso', () => {
  const agg = createPingAggregator(500);
  agg.push(999999);
  const s = agg.flush();
  assert.equal(s.pings, 1);
  assert.equal(s.maxDelayMs, null);
});

test('agregador: llegadas más rápidas que el ritmo no dan retraso negativo', () => {
  const agg = createPingAggregator(500);
  agg.push(1000);
  agg.push(1200); // llega «antes de tiempo» respecto al ritmo de 500 ms
  agg.push(1700);
  const s = agg.flush();
  assert.equal(s.maxDelayMs, 0);
});
