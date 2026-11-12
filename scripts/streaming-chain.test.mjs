// ============================================================================
// JUSTIFICACIÓN DE REESCRITURA (v2.0.0, reemplazo del núcleo en vivo).
//
// La versión anterior de este archivo verificaba la cadena histórica:
// un proceso FFmpeg transcodificador POR DESTINO en electron/main.js
// (spawnStreamWorker/buildStreamWorkerArgs), la cabecera WebM guardada
// en main (streamInitHeader) y la disciplina de codificador original.
// Esa cadena es exactamente el defecto de la Raíz A (hasta cuatro
// codificaciones por software del mismo programa) y la v2.0.0 la
// REEMPLAZA por orden expresa: captura → composición → UNA codificación
// → reparto con copia (electron/program-core.js). Mantener las aserciones
// viejas obligaría a conservar el defecto.
//
// Los invariantes que este archivo protegía NO se pierden: se
// re-verifican donde ahora viven —
//   · sonda de codificador (h264_mf primero): electron/stream-encoder.js
//     y scripts/stream-encoder.test.mjs (sin cambios);
//   · una sola codificación + reparto con copia + backoff + cola con
//     tope + telemetría medida: electron/program-core.js y
//     scripts/program-core.test.mjs (incluye una integración real
//     WebM→núcleo→RTMP/MP4 con el FFmpeg del sistema);
//   · clasificación honesta de errores: electron/stream-error.js
//     (tests más abajo, sin cambios de criterio);
//   · el listener RTMP local con el FFmpeg del sistema se conserva como
//     prueba de transporte (abajo), igual que antes.
// ============================================================================
// NOTA DE REESCRITURA v3.0.0 (el disco es la fuente de verdad).
//
// La v3 cambia la costura del núcleo, no su grafo: la salida FLV del
// proceso único ya NO se reparte en memoria a consumidores alimentados
// por stdin (así murió la v2 en vivo: una grabación enganchada con
// `-map 0:v:0` no opcional a un tubo vacío → EINVAL). Cambios en este
// archivo, solo donde la reescritura invalida la aserción:
//   · «reparto con copia»: sigue en program-core.js (los destinos leen
//     con copia), pero la UNIÓN y la compuerta viven ahora en
//     electron/master-file.js (FlvGateScanner + lector que se une en el
//     último keyframe del ARCHIVO). FlvJoinBuffer sigue existiendo en
//     program-core.js con la misma semántica (Parte 1 de
//     program-core.test.mjs), así que su aserción se conserva y se le
//     SUMAN las del archivo maestro.
//   · «grabación»: ya no es un consumidor en vivo del núcleo; son
//     RANGOS del archivo maestro que al detener se derivan file→file.
//     El blackdetect ya no corre en la pasada en vivo: vive en la
//     derivación file→file dentro del núcleo (misma pasada única de
//     derivación: copia al MP4 + blackdetect como segunda salida).
// Las aserciones D-cadena (clasificador) NO se tocan, y tampoco las de
// backoff, tope de cola, telemetría medida, sonda de codificador ni la
// prueba de transporte RTMP local.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyStreamError, STREAM_ERROR_USER_MESSAGES } = require('../electron/stream-error.js');

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const mainSource = fs.readFileSync(path.join(repoRoot, 'electron', 'main.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(repoRoot, 'electron', 'program-core.js'), 'utf8');
const masterSource = fs.readFileSync(path.join(repoRoot, 'electron', 'master-file.js'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'App.jsx'), 'utf8');
const engineSource = fs.readFileSync(path.join(repoRoot, 'src', 'utils', 'masterBroadcastEngine.js'), 'utf8');

// API real de electron/stream-error.js: classifyStreamError(texto)
// devuelve el KIND (string) y el mensaje para el usuario vive en
// STREAM_ERROR_USER_MESSAGES[kind] (así lo compone main.js).
test('D-cadena: URL inválida se clasifica como error de URL con userMessage', () => {
  const kind = classifyStreamError('Error opening output rtmps://...: Invalid URL');
  assert.equal(kind, 'url');
  assert.ok(STREAM_ERROR_USER_MESSAGES[kind].length > 0);
});

test('D-cadena: Publish Rejected (destino caído/expirado) también es error de URL/destino', () => {
  const kind = classifyStreamError('Error opening output rtmps://...: Input/output error\nServer error: Publish Rejected: Invalid URL');
  assert.equal(kind, 'url');
});

test('D-cadena: el fallo de encoder NO se clasifica como error de URL', () => {
  const kind = classifyStreamError('Error initializing output stream: Error while opening encoder for output stream - maybe incorrect parameters');
  assert.equal(kind, 'encoder');
  assert.ok(!/URL|clave/i.test(STREAM_ERROR_USER_MESSAGES[kind]), 'el mensaje no debe culpar a la URL/clave cuando es el encoder');
});

test('D-cadena: texto ajeno cae en la clase genérica', () => {
  const kind = classifyStreamError('Algo inesperado ocurrió en el servidor');
  assert.equal(kind, 'unknown');
});

test('v2-cadena: main ya no transcodifica por destino; el reparto vive en el núcleo y es con copia', () => {
  assert.ok(!mainSource.includes('spawnStreamWorker'), 'fuera el worker por destino');
  assert.ok(!mainSource.includes('buildStreamWorkerArgs'), 'fuera los argumentos por destino');
  assert.ok(!/let streamInitHeader|streamInitHeader =/.test(mainSource), 'fuera la cabecera guardada en main (solo queda mencionada en comentarios históricos)');
  assert.ok(mainSource.includes('programCore.addDestination'), 'los destinos se registran en el núcleo');
  assert.ok(coreSource.includes("'-c', 'copy'"), 'los destinos reciben copia del flujo codificado');
  assert.ok(coreSource.includes('FlvJoinBuffer'), 'la unión tardía usa el buffer de keyframes del núcleo');
  // v3.0.0: el reparto ya no es en memoria — el núcleo escribe el archivo
  // maestro y cada destino lee de él tras la compuerta.
  assert.ok(coreSource.includes('createMasterFileWriter'), 'el núcleo escribe la salida al archivo maestro');
  assert.ok(coreSource.includes('createMasterFileReader'), 'cada destino lee del archivo maestro con su lector');
  assert.ok(masterSource.includes('FlvGateScanner'), 'la compuerta de unión vive en el archivo maestro');
  assert.ok(masterSource.includes('GATE_MIN_BYTES'), 'la compuerta exige un mínimo de bytes en disco');
});

test('v2-cadena: el respaldo con transcodificación es UNO y usa la sesión sondeada', () => {
  assert.ok(mainSource.includes('createStreamEncoderSession'), 'main crea la sesión de codificador sondeada');
  assert.ok(mainSource.includes('sessionEncoder'), 'la sesión se entrega al núcleo');
  assert.ok(coreSource.includes('buildStreamEncoderArgs'), 'el modo WebM del núcleo construye con la receta de la sesión (h264_mf primero)');
});

test('v2-cadena: reconexión con los mismos tiempos y cola con el mismo tope, ahora en el núcleo', () => {
  assert.ok(coreSource.includes('const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 40000, 60000]'), 'backoff histórico conservado');
  assert.ok(coreSource.includes('const QUEUE_CAP_BYTES = 32 * 1024 * 1024'), 'tope de cola histórico conservado (32 MB)');
  assert.ok(coreSource.includes('entry.reconnectAttempts >= RECONNECT_DELAYS_MS.length'), 'máximo de reintentos histórico conservado (5 = longitud de la tabla)');
});

test('v2-cadena: la telemetría sale del stderr del proceso único, sin rellenos fabricados', () => {
  assert.ok(coreSource.includes('parseEncoderTelemetry'), 'el núcleo parsea la telemetría real');
  assert.ok(!mainSource.includes('bitrateKbps: lastTelemetry.bitrateKbps || 4500'), 'sin bitrate inventado en main');
  assert.ok(!/fps:\s*lastTelemetry\.fps \|\| 30/.test(mainSource), 'sin fps inventado en main');
});

test('v2-cadena: el renderer decide el flujo una vez y el motor no crea MediaRecorder en modo WebCodecs', () => {
  assert.ok(appSource.includes('probeProgramEncoderSupport'), 'App sonda WebCodecs H.264');
  assert.ok(appSource.includes("chunkSource: flowMode === 'webcodecs' ? 'external' : 'mediarecorder'"), 'el modo se pasa al motor');
  assert.ok(engineSource.includes('externalChunkMode'), 'el motor conoce el modo externo');
  assert.ok(engineSource.includes('setProgramFrameTap'), 'el motor expone el tap de fotogramas para la bomba');
});

test('v3-cadena: la grabación son rangos del archivo maestro y el blackdetect vive en la derivación file→file', () => {
  assert.ok(mainSource.includes('programCore.attachRecording'), 'main designa la grabación en el núcleo');
  assert.ok(!appSource.includes('startRecordingRecorder('), 'fuera el grabador dedicado del renderer');
  assert.ok(!engineSource.includes('startRecordingRecorder'), 'fuera el grabador dedicado del motor');
  // v3.0.0: no hay FFmpeg de grabación en vivo alimentado por un tubo: la
  // designación abre rangos sobre el archivo maestro y la derivación al
  // detener es file→file, con el blackdetect en ESA pasada única.
  assert.ok(coreSource.includes('rangos del archivo maestro'), 'la grabación se define como rangos del archivo maestro');
  assert.ok(coreSource.includes('blackdetect'), 'la verificación de negro corre en la derivación file→file, en la misma pasada que la copia al MP4');
  assert.ok(coreSource.includes("'-f', 'concat'"), 'varios rangos se derivan con el demuxer concat sobre segmentos del archivo maestro');
});

test('RTMP local: el FFmpeg del sistema acepta y vuelca un flujo publicado', { timeout: 60000 }, async (t) => {
  if (!fs.existsSync('/usr/bin/ffmpeg')) {
    t.skip('sin FFmpeg de sistema en este Linux');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-rtmp-'));
  const outFile = path.join(tmp, 'out.flv');
  const listener = spawn('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error',
    '-listen', '1', '-f', 'flv', '-i', 'rtmp://127.0.0.1:1936/live',
    '-c', 'copy', '-f', 'flv', '-y', outFile], { stdio: ['ignore', 'ignore', 'pipe'] });
  let listenerErr = '';
  listener.stderr.on('data', (d) => { listenerErr += d.toString(); });
  await new Promise((r) => setTimeout(r, 700));
  const pub = spawn('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error',
    '-re', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15',
    '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', '-f', 'flv',
    'rtmp://127.0.0.1:1936/live/streamkey'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let pubErr = '';
  pub.stderr.on('data', (d) => { pubErr += d.toString(); });
  const pubExit = await new Promise((r) => pub.on('close', r));
  await new Promise((r) => setTimeout(r, 700));
  try { listener.kill('SIGKILL'); } catch {}
  assert.equal(pubExit, 0, `el publicador debió salir limpio; stderr: ${pubErr.slice(0, 200)} listener: ${listenerErr.slice(0, 200)}`);
  assert.ok(fs.existsSync(outFile) && fs.statSync(outFile).size > 5000, 'el oyente recibió el flujo');
  fs.rmSync(tmp, { recursive: true, force: true });
});
