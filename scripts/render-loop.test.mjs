// Test del bucle de render del motor maestro (Frente fluidez, v1.5.0).
//
// Regresión cubierta: la fuga C-5.1 — cada mensaje 'start' al Worker de
// render creaba un setInterval de 30 fps NUEVO sin limpiar el anterior, y
// ensureMasterCanvas() disparaba un 'start' en cada updateBroadcastState().
// Tras N clics había N intervalos componiendo 1080p en paralelo.
//
// Aquí se ejecuta la fuente REAL del Worker (RENDER_WORKER_SOURCE, exportada
// por masterBroadcastEngine.js) en un contexto node:vm con setInterval /
// clearInterval instrumentados, y se cuentan los intervalos vivos.
//
// Uso: node --test scripts/render-loop.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { RENDER_WORKER_SOURCE } from '../src/utils/masterBroadcastEngine.js';

function createSimulatedWorker() {
  const liveIntervals = new Map();
  let nextId = 1;
  let ticks = 0;

  const sandbox = {
    setInterval: (fn, _ms) => {
      const id = nextId++;
      liveIntervals.set(id, fn);
      return id;
    },
    clearInterval: (id) => {
      liveIntervals.delete(id);
    },
    postMessage: () => {
      ticks++;
    },
  };
  // En un Worker real, `self` es el global y a él se cuelgan onmessage y
  // postMessage; en la simulación el sandbox hace de global.
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(RENDER_WORKER_SOURCE, sandbox);

  assert.equal(typeof sandbox.onmessage, 'function', 'el Worker debe registrar onmessage');

  return {
    dispatch: (data) => sandbox.onmessage({ data }),
    liveIntervalCount: () => liveIntervals.size,
    fireIntervalsOnce: () => {
      liveIntervals.forEach((fn) => fn());
    },
    tickCount: () => ticks,
  };
}

test("29 mensajes 'start' dejan exactamente 1 intervalo vivo", () => {
  const worker = createSimulatedWorker();
  for (let i = 0; i < 29; i++) {
    worker.dispatch('start');
  }
  assert.equal(worker.liveIntervalCount(), 1);
});

test("el único intervalo vivo emite ticks y 'stop' lo deja en 0", () => {
  const worker = createSimulatedWorker();
  worker.dispatch('start');
  worker.dispatch('start');
  worker.fireIntervalsOnce();
  assert.equal(worker.tickCount(), 1, 'un solo intervalo = un solo tick por ciclo');

  worker.dispatch('stop');
  assert.equal(worker.liveIntervalCount(), 0);
});

test("'stop' sin 'start' previo no falla y 'start' tras 'stop' revive 1 intervalo", () => {
  const worker = createSimulatedWorker();
  worker.dispatch('stop');
  assert.equal(worker.liveIntervalCount(), 0);

  worker.dispatch('start');
  worker.dispatch('stop');
  worker.dispatch('start');
  assert.equal(worker.liveIntervalCount(), 1);
});

test('startRenderLoop es idempotente y stopRenderLoop queda conectado en el apagado del motor', () => {
  const source = readFileSync(new URL('../src/utils/masterBroadcastEngine.js', import.meta.url), 'utf8');

  // La guarda se comprueba sobre el cuerpo real de startRenderLoop.
  const startBody = source.slice(source.indexOf('export function startRenderLoop()'));
  const guardAndStartPost = startBody.slice(0, startBody.indexOf("postMessage('start')"));
  assert.match(guardAndStartPost, /if \(isCanvasRenderLoopActive\) return;/);

  // stopRenderLoop exportado y llamado desde la ruta de apagado del motor
  // y desde el apagado por contador de consumidores.
  assert.match(source, /export function stopRenderLoop\(\)/);
  const stopEngineBody = source.slice(source.indexOf('export async function stopBroadcastEngine()'));
  assert.match(stopEngineBody.slice(0, stopEngineBody.indexOf('\n}\n')), /stopRenderLoop\(\);/);
  assert.match(source, /export function stopRenderLoopIfNoConsumers\(\)/);
});
