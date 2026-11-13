// ============================================================================
// v3.2.4 — GOBERNADOR DE FOCO/VISIBILIDAD + RELOJ ÚNICO DEL TELEPROMPTER.
//
// (R1) El atasco al volver del navegador: el Worker de render del motor
// maestro postea un tick cada ~33 ms PARA SIEMPRE (los timers de Worker no
// se estrangulan con la visibilidad) y el manejador componía una imagen
// 1080p por CADA mensaje recibido. Con el hilo principal despriorizado, la
// cola de ticks crecía sin límite y al volver había que ejecutar todas las
// composiciones atrasadas antes de atender un clic. El arreglo: decisión
// por marcas de tiempo (compositionMode / compositionTickDecision, puras,
// aquí probadas de verdad) — sin foco ni salida, máximo 1 composición cada
// 500 ms y el resto de ticks se descarta SIN trabajo: la cola se drena en
// O(1) por mensaje y jamás se reproduce trabajo acumulado.
//
// (R2) El teleprompter invisible sobre el programa: el overlay compartía un
// offset nacido de window.innerHeight y decrementado sin suelo — si el
// HUD se encendía después de INICIAR, el texto ya había cruzado la franja
// y no volvía. El arreglo: reloj único (teleprompterYRef = píxeles de
// guion recorridos, CRECE) y dos proyecciones con la geometría de cada
// superficie. Como el resto de invariantes de App.jsx en este repo, se
// verifican sobre el código fuente.
//
// Uso: node --test scripts/focus-governor.test.mjs
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compositionMode,
  compositionTickDecision,
  RENDER_MAINTENANCE_INTERVAL_MS,
} from '../src/utils/masterBroadcastEngine.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'masterBroadcastEngine.js'), 'utf8');

// ---------------------------------------------------------------------------
// Gobernador: modos
// ---------------------------------------------------------------------------

test('gobernador: con salida de canvas en curso SIEMPRE es full, aunque la ventana esté oculta y sin foco', () => {
  assert.equal(compositionMode({ outputActive: true, visible: false, focused: false }), 'full');
  assert.equal(compositionMode({ outputActive: true, visible: true, focused: true }), 'full');
});

test('gobernador: visible y con foco (sin salida) es full; oculta o sin foco es maintenance', () => {
  assert.equal(compositionMode({ outputActive: false, visible: true, focused: true }), 'full');
  assert.equal(compositionMode({ outputActive: false, visible: false, focused: true }), 'maintenance');
  assert.equal(compositionMode({ outputActive: false, visible: true, focused: false }), 'maintenance');
  assert.equal(compositionMode({ outputActive: false, visible: false, focused: false }), 'maintenance');
});

// ---------------------------------------------------------------------------
// Gobernador: decisión por tick
// ---------------------------------------------------------------------------

test('gobernador: en full cada tick compone', () => {
  for (const now of [0, 1, 33, 34, 100000]) {
    assert.equal(compositionTickDecision({ now, lastRenderAt: now, mode: 'full' }), true);
  }
});

test('gobernador: en maintenance el primer tick compone y luego manda el intervalo de 500 ms', () => {
  assert.equal(RENDER_MAINTENANCE_INTERVAL_MS, 500);
  assert.equal(compositionTickDecision({ now: 1000, lastRenderAt: 0, mode: 'maintenance' }), true);
  assert.equal(compositionTickDecision({ now: 1200, lastRenderAt: 1000, mode: 'maintenance' }), false);
  assert.equal(compositionTickDecision({ now: 1499, lastRenderAt: 1000, mode: 'maintenance' }), false);
  assert.equal(compositionTickDecision({ now: 1500, lastRenderAt: 1000, mode: 'maintenance' }), true);
});

test('gobernador: una cola atrasada de 9000 ticks en maintenance se drena con UNA sola composición', () => {
  // Simula el regreso a la app: miles de ticks encolados llegan de golpe
  // (mismo now). El llamador solo actualiza lastRenderAt cuando compone.
  let lastRenderAt = 0;
  let renders = 0;
  const now = 60000; // tras un minuto fuera, en maintenance
  for (let i = 0; i < 9000; i++) {
    if (compositionTickDecision({ now, lastRenderAt, mode: 'maintenance' })) {
      renders++;
      lastRenderAt = now;
    }
  }
  assert.equal(renders, 1, 'la cola atrasada NO se reproduce: 1 composición, no 9000');
});

test('gobernador: en maintenance sostenida la cadencia es ~2 fps, no 30', () => {
  let lastRenderAt = 0;
  let renders = 0;
  for (let now = 0; now <= 10000; now += 33) {
    if (compositionTickDecision({ now, lastRenderAt, mode: 'maintenance' })) {
      renders++;
      lastRenderAt = now;
    }
  }
  assert.ok(renders >= 19 && renders <= 21, `esperadas ~20 composiciones en 10 s, hubo ${renders}`);
});

test('gobernador: recuperar el foco (marca a 0) reanuda AL INSTANTE, sin esperar el intervalo', () => {
  // lastRenderAt = 0 es exactamente lo que hacen los listeners de
  // visibilitychange/focus al volver: el siguiente tick ya compone.
  assert.equal(compositionTickDecision({ now: 12345, lastRenderAt: 0, mode: 'maintenance' }), true);
  assert.equal(compositionTickDecision({ now: 12345, lastRenderAt: 0, mode: 'full' }), true);
});

// ---------------------------------------------------------------------------
// Gobernador: cableado en el motor (código fuente)
// ---------------------------------------------------------------------------

test('gobernador: los ticks del Worker y el rAF de respaldo pasan por governedRenderFrame', () => {
  // Build diagnóstica post-v3.2.4: el handler del Worker suma además el
  // contador de SOLO LECTURA del instrumento ventana-diag; la invariante
  // (todo tick pasa por governedRenderFrame) no cambia.
  assert.match(engineSource, /renderWorker\.onmessage = \(\) => \{ diagTicksReceived \+= 1; if \(isCanvasRenderLoopActive\) governedRenderFrame\(\) \};/);
  const fallback = engineSource.slice(engineSource.indexOf('function fallbackRafLoop'));
  assert.ok(fallback.slice(0, 400).includes('governedRenderFrame()'), 'el fallback rAF también está gobernado');
});

test('gobernador: los listeners de visibilidad/foco reinician la marca al volver', () => {
  assert.ok(engineSource.includes("addEventListener('visibilitychange'"), 'escucha visibilitychange');
  assert.ok(engineSource.includes("addEventListener('focus'"), 'escucha focus');
  assert.ok(engineSource.includes("addEventListener('blur'"), 'escucha blur');
  const resets = engineSource.split('lastGovernedRenderAt = 0').length - 1;
  assert.ok(resets >= 3, `la marca vuelve a 0 al recuperar visibilidad/foco (halladas ${resets} asignaciones)`);
});

test('gobernador: la salida de canvas (grabar/transmitir) se detecta desde el estado real del motor', () => {
  assert.match(engineSource, /function isCanvasOutputActive\(\) \{\s*return isBroadcastEngineActive \|\| !!mediaRecorder;/);
});

// ---------------------------------------------------------------------------
// Teleprompter: reloj único y proyecciones (código fuente de App.jsx)
// ---------------------------------------------------------------------------

test('teleprompter: ningún reset usa ya window.innerHeight ni el JSX fija translateY(100vh)', () => {
  assert.ok(!appSource.includes('teleprompterYRef.current = window.innerHeight'), 'fuera el nacimiento en window.innerHeight');
  assert.ok(!appSource.includes('translateY(${window.innerHeight}px)'), 'fuera el transform directo con window.innerHeight');
  assert.ok(!appSource.includes('transform: `translateY(100vh)`'), 'fuera el transform fijo del overlay');
});

test('teleprompter: el bucle AVANZA el reloj (+=) y proyecta ambas superficies desde él', () => {
  const i = appSource.indexOf('const animate = (time) =>');
  assert.ok(i >= 0, 'existe el bucle animate del teleprompter');
  const animate = appSource.slice(i, i + 3500);
  assert.ok(animate.includes('teleprompterYRef.current += moveAmount'), 'el reloj crece con el avance');
  assert.ok(!animate.includes('teleprompterYRef.current -= moveAmount'), 'el reloj ya no decrece sin suelo');
  assert.ok(animate.includes('projectTeleprompterOverlay()'), 'el bucle proyecta el overlay desde el reloj');
});

test('teleprompter: la caja del panel es INDEPENDIENTE del reloj (puerto seguro, build diagnóstica post-v3.2.4)', () => {
  // La v3.2.4 acoplaba la caja al reloj único (resincronización panel →
  // reloj) y en vivo el recuadro dejó de desplazarse. La build
  // diagnóstica lo DESACOPLA a propósito: el bucle compartido ya no lee
  // ni escribe la caja, y el panel se desplaza con su mecanismo simple
  // propio (rAF + acumulador + scrollTop), como en la v3.2.0.
  const i = appSource.indexOf('const animate = (time) =>');
  const animate = appSource.slice(i, i + 3500);
  assert.ok(!animate.includes('teleprompterYRef.current = panel.scrollTop'), 'fuera la resincronización panel → reloj');
  assert.ok(!animate.includes('panelPrompterScrollRef.current = panel.scrollTop'), 'fuera la escritura del reloj sobre la caja');
  assert.ok(appSource.includes('rightPrompterScrollPos.current += speed'), 'el panel avanza su propio acumulador');
  assert.ok(appSource.includes('panel.scrollTop = target'), 'el panel aplica su propio scrollTop');
});

test('teleprompter: la proyección del overlay usa la altura real de la franja y topa en -alturaTexto', () => {
  const i = appSource.indexOf('const projectTeleprompterOverlay');
  assert.ok(i >= 0, 'existe projectTeleprompterOverlay');
  const helper = appSource.slice(i, i + 900);
  assert.ok(helper.includes('el.parentElement.clientHeight'), 'mide la franja (su contenedor)');
  assert.ok(helper.includes('el.scrollHeight'), 'mide el texto');
  assert.ok(helper.includes('stripH - teleprompterYRef.current'), 'translateY = franja − desplazamiento');
  assert.ok(helper.includes('Math.max(-textH'), 'tope inferior = −altura del texto');
});

test('teleprompter: al montar el HUD o cambiar el guion se aplica la proyección (orden de clics indiferente)', () => {
  const i = appSource.indexOf('if (showFloatingPrompter) projectTeleprompterOverlay();');
  assert.ok(i >= 0, 'hay efecto de montaje del HUD que proyecta');
  const deps = appSource.slice(i, i + 200);
  assert.ok(deps.includes('[showFloatingPrompter, teleprompterText]'), 'depende del HUD y del texto');
});

test('teleprompter: cargar/reiniciar/limpiar el guion deja el reloj a 0', () => {
  const resets = appSource.split('teleprompterYRef.current = 0;').length - 1;
  assert.ok(resets >= 4, `esperados ≥4 resets a 0 (carga ×2, reiniciar, limpiar…), hallados ${resets}`);
  const reset = appSource.slice(appSource.indexOf('const handlePrompterReset'), appSource.indexOf('const handleCopyPrompterLink'));
  assert.ok(reset.includes('projectTeleprompterOverlay()'), 'reiniciar también proyecta el overlay');
});

// ---------------------------------------------------------------------------
// Gobernador en App.jsx: el medidor de micrófono no trabaja con la página oculta
// ---------------------------------------------------------------------------

test('gobernador: updateVolume salta su trabajo cuando document.hidden', () => {
  const i = appSource.indexOf('const updateVolume = () =>');
  assert.ok(i >= 0, 'existe updateVolume');
  const body = appSource.slice(i, i + 700);
  assert.ok(body.includes("document.hidden"), 'comprueba document.hidden');
  assert.ok(body.indexOf('document.hidden') < body.indexOf('getByteFrequencyData'), 'la guarda va ANTES de analizar');
});
