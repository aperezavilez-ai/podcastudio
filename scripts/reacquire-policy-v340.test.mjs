// ============================================================================
// v3.4.0 — POLÍTICA DE READQUISICIÓN CON VIGILANTE (src/utils/
// reacquirePolicy.mjs). El fallo que fija, en vivo con la v3.3.6
// (2026-11-13): al DETENER la transmisión, CAM 1 y CAM 3 no volvieron
// — readquirirLiberadas intentaba UNA sola vez y, si la apertura
// fallaba porque el proceso del motor aún no soltaba el dispositivo,
// el registro restaurado «para reintentar al próximo apagado» nunca
// se redisparaba (el motor ya estaba apagado: ningún cambio de estado
// volvía a disparar el efecto). La política pura decide por cámara:
// intentar / esperar / imposible tras 6 intentos declarados; el
// vigilante de App.jsx la consume cada 2 s.
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirReintentoReadquisicion,
  entradaIntentos,
  sumarIntentoReadquisicion,
  marcarReadquisicionAvisada,
  olvidarIntentosReadquisicion,
  REACQUIRE_INTERVAL_MS,
  REACQUIRE_MAX_ATTEMPTS,
  FASES_READQUISICION,
} from '../src/utils/reacquirePolicy.mjs';

test('v3.4.0 · política: las constantes declaradas son 2 s y 6 intentos', () => {
  assert.equal(REACQUIRE_INTERVAL_MS, 2000);
  assert.equal(REACQUIRE_MAX_ATTEMPTS, 6);
  assert.deepEqual(FASES_READQUISICION, ['apagado', 'error']);
});

test('v3.4.0 · política: en apagado/error con intentos disponibles → intentar', () => {
  assert.equal(decidirReintentoReadquisicion({ fase: 'apagado', intentos: 0 }), 'intentar');
  assert.equal(decidirReintentoReadquisicion({ fase: 'apagado', intentos: 5 }), 'intentar');
  assert.equal(decidirReintentoReadquisicion({ fase: 'error', intentos: 3 }), 'intentar');
});

test('v3.4.0 · política: en fases de marcha → esperar (jamás readquirir contra el motor)', () => {
  for (const fase of ['vista-previa', 'grabando', 'transmitiendo', 'grabando-transmitiendo', 'arrancando', 'deteniendo']) {
    assert.equal(decidirReintentoReadquisicion({ fase, intentos: 0 }), 'esperar', `fase ${fase}`);
  }
  assert.equal(decidirReintentoReadquisicion({ fase: undefined, intentos: 0 }), 'esperar');
});

test('v3.4.0 · política: al llegar al tope declarado → imposible (el registro queda para el próximo ciclo)', () => {
  assert.equal(decidirReintentoReadquisicion({ fase: 'apagado', intentos: 6 }), 'imposible');
  assert.equal(decidirReintentoReadquisicion({ fase: 'error', intentos: 9 }), 'imposible');
  assert.equal(decidirReintentoReadquisicion({ fase: 'apagado', intentos: 2, maxIntentos: 2 }), 'imposible', 'el tope es parametrizable');
});

test('v3.4.0 · política: reintenta hasta el éxito — la secuencia de decisiones de una cámara que vuelve al 4.º intento', () => {
  // Simula el vigilante: cada pasada suma un intento y vuelve a
  // decidir; la cámara «vuelve» (sale del registro) en la pasada 4.
  let intentos = {};
  const decisiones = [];
  for (let pasada = 1; pasada <= 6; pasada++) {
    const d = decidirReintentoReadquisicion({ fase: 'apagado', intentos: entradaIntentos(intentos, 0).count });
    decisiones.push(d);
    if (d !== 'intentar') break;
    intentos = sumarIntentoReadquisicion(intentos, 0);
    if (pasada === 4) { intentos = olvidarIntentosReadquisicion(intentos, 0); break; } // volvió
  }
  assert.deepEqual(decisiones, ['intentar', 'intentar', 'intentar', 'intentar']);
  assert.deepEqual(intentos, {}, 'al volver, su contabilidad se olvida');
});

test('v3.4.0 · política: una cámara que nunca vuelve agota en la 7.ª decisión y avisa una sola vez', () => {
  let intentos = {};
  const decisiones = [];
  for (let i = 0; i < 8; i++) {
    const d = decidirReintentoReadquisicion({ fase: 'apagado', intentos: entradaIntentos(intentos, 2).count });
    decisiones.push(d);
    if (d === 'intentar') intentos = sumarIntentoReadquisicion(intentos, 2);
  }
  assert.deepEqual(decisiones, ['intentar', 'intentar', 'intentar', 'intentar', 'intentar', 'intentar', 'imposible', 'imposible']);
  // Aviso único: la marca sobrevive entre pasadas.
  intentos = marcarReadquisicionAvisada(intentos, 2);
  assert.equal(entradaIntentos(intentos, 2).avisado, true);
  assert.equal(entradaIntentos(intentos, 2).count, 6, 'avisar no altera el conteo');
});

test('v3.4.0 · política: los ayudantes son inmutables y por ranura', () => {
  const a = {};
  const b = sumarIntentoReadquisicion(a, 0);
  assert.deepEqual(a, {}, 'no muta el mapa original');
  assert.deepEqual(b, { 0: { count: 1, avisado: false } });
  const c = sumarIntentoReadquisicion(b, 1);
  assert.deepEqual(c, { 0: { count: 1, avisado: false }, 1: { count: 1, avisado: false } }, 'ranuras independientes');
  const d = olvidarIntentosReadquisicion(c, 0);
  assert.deepEqual(d, { 1: { count: 1, avisado: false } });
  assert.deepEqual(entradaIntentos(d, 5), { count: 0, avisado: false }, 'ranura desconocida: entrada por defecto');
});
