// ============================================================================
// v3.2.2 — SUBIDAS de sesión del motor nativo (grabar mientras se transmite
// y transmitir mientras se graba).
//
// El defecto (preexistente del Hito 3, detectado en la auditoría de la
// v3.2.1): los manejadores de subida de src/App.jsx llamaban bridge.start
// con la sesión combinada 'recordStream' SIN detener la sesión en curso,
// y el motor la rechazaba — correctamente — con «Ya hay una sesión del
// motor nativo en curso» (electron/native-engine.js). El diseño aprobado
// del Hito 3 dice lo contrario: la transición REINICIA la tubería, con el
// mismo orden parar→arrancar que las bajadas ya usaban.
//
// El arreglo vive SOLO en el renderer (el motor no se toca: su rechazo a
// sesiones concurrentes es correcto). Como el resto de invariantes de
// App.jsx en este repo (ver streaming-chain.test.mjs), se verifican sobre
// el código fuente: orden de operaciones dentro de cada manejador.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
const engineSource = fs.readFileSync(path.join(repoRoot, 'electron', 'native-engine.js'), 'utf8');

// Extrae el cuerpo de un manejador: desde su declaración hasta la del
// manejador siguiente (los cuatro viven consecutivos en App.jsx).
const cuerpo = (desde, hasta) => {
  const i = appSource.indexOf(desde);
  const j = appSource.indexOf(hasta);
  assert.ok(i >= 0, `no se encontró ${desde}`);
  assert.ok(j > i, `no se encontró ${hasta} después de ${desde}`);
  return appSource.slice(i, j);
};

const grabar = cuerpo('const iniciarGrabacionNativa', 'const detenerGrabacionNativa');
const transmitir = cuerpo('const iniciarTransmisionNativa', 'const detenerTransmisionNativa');

test('v3.2.2: el motor sigue rechazando sesiones concurrentes (el arreglo NO va en el motor)', () => {
  assert.ok(
    engineSource.includes("Ya hay una sesión del motor nativo en curso."),
    'el rechazo del motor a un segundo start debe seguir existiendo',
  );
});

test('v3.2.2: grabar transmitiendo detiene la sesión ANTES de arrancar la combinada', () => {
  const stop = grabar.indexOf('await bridge.stop()');
  const espera = grabar.indexOf('await esperarMotorApagado()');
  const start = grabar.indexOf("session: 'recordStream'");
  assert.ok(stop >= 0, 'la subida de grabación debe detener la sesión en curso');
  assert.ok(espera > stop, 'debe esperar la fase «apagado» tras la parada');
  assert.ok(start > espera, 'la combinada recordStream arranca DESPUÉS de la parada confirmada');
});

test('v3.2.2: transmitir grabando detiene la sesión ANTES de arrancar la combinada', () => {
  const stop = transmitir.indexOf('await bridge.stop()');
  const espera = transmitir.indexOf('await esperarMotorApagado()');
  const start = transmitir.indexOf("session: conGrabacion ? 'recordStream' : 'stream'");
  assert.ok(stop >= 0, 'la subida de transmisión debe detener la sesión en curso');
  assert.ok(espera > stop, 'debe esperar la fase «apagado» tras la parada');
  assert.ok(start > espera, 'la combinada recordStream arranca DESPUÉS de la parada confirmada');
});

test('v3.2.2: ambas subidas marcan la transición como ordenada (nativeBusyRef) antes de parar', () => {
  for (const [nombre, c] of [['grabar', grabar], ['transmitir', transmitir]]) {
    const busy = c.indexOf('nativeBusyRef.current = true;');
    const stop = c.indexOf('await bridge.stop()');
    assert.ok(busy >= 0 && busy < stop, `${nombre}: nativeBusyRef debe estar en true antes de la parada (el vigilante no debe disparar)`);
  }
});

test('v3.2.2: si la combinada no arranca, el estado es honesto: se apaga el lado anterior y se declara', () => {
  assert.ok(grabar.includes('La sesión combinada no arrancó'), 'grabar: debe declarar que la combinada no arrancó');
  assert.ok(grabar.includes('La transmisión anterior terminó'), 'grabar: debe declarar que la transmisión anterior terminó');
  assert.ok(grabar.includes('setIsStreaming(false)'), 'grabar: la transmisión se apaga en la UI (la sesión ya no existe)');
  assert.ok(transmitir.includes('La sesión combinada no arrancó'), 'transmitir: debe declarar que la combinada no arrancó');
  assert.ok(transmitir.includes('La grabación anterior terminó'), 'transmitir: debe declarar que la grabación anterior terminó');
  assert.ok(transmitir.includes('setIsRecording(false)'), 'transmitir: la grabación se apaga en la UI (la sesión ya no existe)');
});

test('v3.2.2: la confirmación de la combinada reutiliza el pendiente por fase de la v3.2.1', () => {
  assert.ok(
    grabar.includes("armarPendienteNativo('record', ['grabando', 'grabando-transmitiendo'], subiendo)"),
    'grabar: lo nuevo (la grabación) queda pendiente hasta la fase grabando-transmitiendo',
  );
  assert.ok(
    transmitir.includes("armarPendienteNativo('stream', ['transmitiendo', 'grabando-transmitiendo'])"),
    'transmitir: lo nuevo (la transmisión) queda pendiente hasta la fase grabando-transmitiendo',
  );
});

test('v3.2.2: sin sesión confirmada al otro lado no hay reinicio (guarda de arranque pendiente)', () => {
  assert.ok(grabar.includes('subiendo && !isStreamingRef.current'), 'grabar: si la transmisión aún no se confirma, no se reinicia');
  assert.ok(transmitir.includes('conGrabacion && !isRecordingRef.current'), 'transmitir: si la grabación aún no se confirma, no se reinicia');
});
