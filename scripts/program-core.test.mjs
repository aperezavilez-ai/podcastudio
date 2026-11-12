// ============================================================================
// Pruebas del núcleo de programa del Motor PodcastStudio
// (electron/program-core.js).
//
// JUSTIFICACIÓN DE REESCRITURA (v3.0.0, el disco es la fuente de verdad).
//
// La v2.0.0 repartía el flujo FLV EN MEMORIA a consumidores FFmpeg
// alimentados por stdin y murió en vivo: la grabación se enganchaba a un
// FFmpeg con `-map 0:v:0` (no opcional) contra un tubo aún vacío y
// FFmpeg rechazó el arranque con EINVAL; no se produjo nada grabado.
// Mantener la integración v2 tal cual (destino y grabación creados
// DESPUÉS de que el flujo ya corre y unidos por el buffer en memoria)
// no reproduciría jamás la condición que la mató.
//
// La Parte 1 se CONSERVA intacta: FlvJoinBuffer sigue exportado por el
// núcleo con la misma semántica de resellado.
//
// La Parte 2 reproduce, contra la costura nueva (electron/master-file.js),
// las condiciones exactas del fallo en vivo:
//   (a) el destino se crea ANTES de que exista ningún chunk de flujo y
//       el generador alimenta writeWebmChunk re-troceado en lonchas de
//       1–7 KB con micro-esperas: el destino no puede lanzar su FFmpeg
//       hasta que el archivo maestro supere la compuerta, y debe
//       conectar y recibir un FLV válido (nada de EINVAL);
//   (b) la grabación se designa ANTES del flujo y stopRecording() debe
//       derivar un MP4 válido file→file, sin ningún pipe en vivo;
//   (c) el archivo de sesión en sessionsDir contiene la secuencia
//       completa (cabecera FLV + compuerta superada con FlvGateScanner).
//
// Resolución de FFmpeg: ffmpeg-static primero VERIFICANDO que ejecuta
// (spawnSync -version); si no, /usr/bin/ffmpeg; si ninguno ejecuta, la
// Parte 2 se salta declarándolo (skip), no fingiendo. ffprobe análogo;
// sin ffprobe se valida la duración con la sonda `ffmpeg -i`.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { FlvJoinBuffer } = require('../electron/program-core.js');
const { createProgramCore } = require('../electron/program-core.js');
const { createStreamEncoderSession } = require('../electron/stream-encoder.js');
const { FlvGateScanner } = require('../electron/master-file.js');
const { classifyStreamError } = require('../electron/stream-error.js');

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// ---------- constructores de FLV sintético ----------
function flvHeader() {
  return Buffer.from([0x46, 0x4c, 0x56, 0x01, 0x05, 0, 0, 0, 9, 0, 0, 0, 0]);
}
function flvTag(type, timestamp, payload) {
  const size = payload.length;
  const head = Buffer.alloc(11);
  head[0] = type;
  head.writeUIntBE(size, 1, 3);
  head.writeUIntBE(timestamp & 0xffffff, 4, 3);
  head[7] = (timestamp >>> 24) & 0xff;
  const prev = Buffer.alloc(4);
  prev.writeUInt32BE(11 + size, 0);
  return Buffer.concat([head, payload, prev]);
}
const avcSeqPayload = Buffer.from([0x17, 0x00, 0, 0, 0, 0x01, 0x64, 0x00, 0x1f]);
const aacSeqPayload = Buffer.from([0xaf, 0x00, 0x11, 0x90]);
const keyPayload = Buffer.from([0x17, 0x01, 0, 0, 0, 0x65, 0x88]);
const framePayload = Buffer.from([0x27, 0x01, 0, 0, 0, 0x41, 0x9a]);
const audioPayload = Buffer.from([0xaf, 0x01, 0x22, 0x33]);

test('FlvJoinBuffer: sin keyframe todavía no hay snapshot (unirse sería inválido)', () => {
  const jb = new FlvJoinBuffer();
  jb.push(flvHeader());
  jb.push(flvTag(9, 0, avcSeqPayload));
  jb.push(flvTag(8, 0, aacSeqPayload));
  jb.push(flvTag(9, 500, framePayload)); // interframe sin keyframe previo
  assert.equal(jb.snapshot(), null);
});

test('FlvJoinBuffer: el snapshot resella las secuencias al timestamp del keyframe y conserva el directo', () => {
  const jb = new FlvJoinBuffer();
  jb.push(flvHeader());
  jb.push(flvTag(9, 0, avcSeqPayload));
  jb.push(flvTag(8, 0, aacSeqPayload));
  jb.push(flvTag(9, 1000, framePayload)); // interframe viejo: queda fuera
  jb.push(flvTag(9, 2000, keyPayload));   // último keyframe
  jb.push(flvTag(8, 2040, audioPayload));
  jb.push(flvTag(9, 2066, framePayload));
  const snap = jb.snapshot();
  assert.ok(Buffer.isBuffer(snap));
  assert.equal(snap.subarray(0, 3).toString('ascii'), 'FLV');
  const timestamps = [];
  let off = 13;
  while (off + 11 <= snap.length) {
    const type = snap[off];
    const size = snap.readUIntBE(off + 1, 3);
    const ts = snap.readUIntBE(off + 4, 3) | (snap[off + 7] << 24);
    timestamps.push([type, ts]);
    off += 11 + size + 4;
  }
  assert.deepEqual(timestamps[0], [9, 2000], 'secuencia AVC resellada al keyframe');
  assert.deepEqual(timestamps[1], [8, 2000], 'secuencia AAC resellada al keyframe');
  assert.deepEqual(timestamps[2], [9, 2000], 'el propio keyframe');
  assert.deepEqual(timestamps[3], [8, 2040], 'audio posterior intacto');
  assert.deepEqual(timestamps[4], [9, 2066], 'interframe posterior intacto');
  assert.equal(timestamps.length, 5, 'el interframe viejo (1000) no viaja');
});

test('FlvJoinBuffer: push con trozos partidos a mitad de etiqueta no pierde datos', () => {
  const jb = new FlvJoinBuffer();
  const all = Buffer.concat([
    flvHeader(),
    flvTag(9, 0, avcSeqPayload),
    flvTag(9, 300, keyPayload),
    flvTag(9, 333, framePayload),
  ]);
  for (let i = 0; i < all.length; i += 7) {
    jb.push(all.subarray(i, Math.min(all.length, i + 7)));
  }
  const snap = jb.snapshot();
  assert.ok(snap && snap.length > 13, 'snapshot construido tras trozos partidos');
});

// ---------- resolución de FFmpeg para la Parte 2 ----------
function toolExecutes(bin) {
  if (!bin) return false;
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
function resolveFfmpeg() {
  let staticBin = null;
  try { staticBin = require('ffmpeg-static'); } catch (e) {}
  if (toolExecutes(staticBin)) return staticBin;
  if (toolExecutes('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  return null;
}
function resolveFfprobe() {
  if (toolExecutes('/usr/bin/ffprobe')) return '/usr/bin/ffprobe';
  return null;
}
const ffmpegBin = resolveFfmpeg();
const ffprobeBin = resolveFfprobe();

function probeDurationSeconds(filePath) {
  if (ffprobeBin) {
    const probe = spawnSync(ffprobeBin, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], { encoding: 'utf8' });
    const d = parseFloat((probe.stdout || '').trim());
    if (Number.isFinite(d)) return d;
  }
  const r = spawnSync(ffmpegBin, ['-hide_banner', '-i', filePath], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
  return NaN;
}

// Generador WebM VP8+Opus en vivo (el «MediaRecorder» de estas pruebas),
// alimentando el núcleo con re-troceo en lonchas de 1–7 KB y micro-esperas.
function startWebmGenerator(core) {
  const gen = spawn(ffmpegBin, ['-hide_banner', '-loglevel', 'error',
    '-re', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30',
    '-re', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-c:v', 'libvpx', '-b:v', '800k', '-deadline', 'realtime', '-cpu-used', '5',
    '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  gen.stderr.on('data', () => {});
  const sliceSizes = [1024, 3072, 7168, 2048, 5120, 1536, 6144];
  let chain = Promise.resolve();
  let idx = 0;
  gen.stdout.on('data', (chunk) => {
    const buf = Buffer.from(chunk);
    chain = chain.then(async () => {
      let off = 0;
      while (off < buf.length) {
        const len = sliceSizes[idx % sliceSizes.length]; idx += 1;
        core.writeWebmChunk(buf.subarray(off, Math.min(buf.length, off + len)));
        off += len;
        await new Promise((r) => setTimeout(r, 1));
      }
    });
  });
  return gen;
}

function makeCore(tmp, extra = {}) {
  const sessionsDir = path.join(tmp, 'sessions');
  const selfTestDir = path.join(tmp, 'selftest');
  const session = createStreamEncoderSession({ spawnImpl: spawn, ffmpegPath: ffmpegBin });
  const logs = [];
  const core = createProgramCore({
    spawnImpl: spawn,
    ffmpegPath: ffmpegBin,
    sessionEncoder: session,
    classifyError: classifyStreamError,
    log: (line) => logs.push(String(line)),
    sessionsDir,
    selfTestDir,
    ...extra,
  });
  return { core, logs, session, sessionsDir, selfTestDir };
}

test('integración v3 (a): destino creado ANTES del flujo conecta tras la compuerta y recibe un FLV válido', { skip: !ffmpegBin, timeout: 90000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-core-a-'));
  const rtmpOut = path.join(tmp, 'destino.flv');
  const { core, logs } = makeCore(tmp);
  const listener = spawn(ffmpegBin, ['-hide_banner', '-loglevel', 'error',
    '-listen', '1', '-f', 'flv', '-i', 'rtmp://127.0.0.1:1941/live',
    '-c', 'copy', '-f', 'flv', '-y', rtmpOut], { stdio: ['ignore', 'ignore', 'pipe'] });
  let listenerErr = '';
  listener.stderr.on('data', (d) => { listenerErr += d.toString(); });
  let gen = null;
  t.after(async () => {
    try { gen?.kill('SIGKILL'); } catch {}
    try { listener.kill('SIGKILL'); } catch {}
    try { await core.shutdown(); } catch {}
  });
  await new Promise((r) => setTimeout(r, 800));

  core.setSessionActive(true);
  // LA CONDICIÓN QUE MATÓ A LA v2: el destino nace con el tubo (hoy:
  // el archivo) todavía vacío. No se ha enviado NI UN chunk.
  const destPromise = core.addDestination({ id: 'early', name: 'DestinoTemprano', url: 'rtmp://127.0.0.1:1941/live/streamkey' });
  destPromise.catch(() => {});
  gen = startWebmGenerator(core);

  const dest = await destPromise;
  assert.equal(dest.success, true, `el destino temprano debe conectar; resultado: ${JSON.stringify({ error: dest.error, kind: dest.kind })}; logs: ${logs.slice(-6).join(' | ')}`);
  assert.ok(!logs.some((l) => /EINVAL|Invalid argument/i.test(l) && /DestinoTemprano/.test(l)), 'sin EINVAL en el arranque del destino');

  await new Promise((r) => setTimeout(r, 5000));
  await core.removeAllDestinations();
  gen.kill('SIGKILL');
  await new Promise((r) => setTimeout(r, 600));
  try { listener.kill('SIGKILL'); } catch {}
  await core.shutdown();

  assert.ok(fs.existsSync(rtmpOut) && fs.statSync(rtmpOut).size > 20000,
    `el listener debe volcar un FLV >20 KB (real: ${fs.existsSync(rtmpOut) ? fs.statSync(rtmpOut).size : 0}); listener: ${listenerErr.slice(0, 200)}`);
  const scanner = new FlvGateScanner();
  scanner.push(fs.readFileSync(rtmpOut));
  assert.equal(scanner.gatePassed(), true, 'el FLV recibido por el destino supera la compuerta (cabecera+secuencia+keyframe)');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('integración v3 (b)+(c): grabación designada ANTES del flujo deriva un MP4 válido y el archivo de sesión contiene la secuencia completa', { skip: !ffmpegBin, timeout: 90000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-core-b-'));
  const partialPath = path.join(tmp, 'programa.partial.mp4');
  const derivationStderr = [];
  const { core, logs, session } = makeCore(tmp, {
    onRecordingStderr: (text) => derivationStderr.push(String(text)),
  });
  let gen = null;
  t.after(async () => {
    try { gen?.kill('SIGKILL'); } catch {}
    try { await core.shutdown(); } catch {}
  });

  core.setSessionActive(true);
  // LA OTRA CONDICIÓN DEL FALLO: la grabación se designa antes de que
  // exista flujo; su rango abrirá en el primer keyframe del archivo.
  const attach = await core.attachRecording({ partialPath });
  assert.equal(attach.success, true, JSON.stringify(attach));

  gen = startWebmGenerator(core);
  // Presupuesto de flujo alineado con el STARTUP_TIMEOUT_MS del núcleo
  // (20 s): en VMs con CPU compartida/estrangulada la transcodificación
  // inicial tarda más de 8 s en emitir el primer keyframe; la aserción
  // que importa es que el flujo LLEGA y es válido, no cuánto tarda.
  const flow = await core.waitForFlow(20000);
  assert.equal(flow, true, `el archivo maestro debe superar la compuerta; logs: ${logs.slice(-4).join(' | ')}`);
  const sessionFile = core.getState().sessionFile;
  assert.ok(sessionFile && sessionFile.includes('master-'), `hay archivo de sesión: ${sessionFile}`);

  await new Promise((r) => setTimeout(r, 9000));
  const recState = core.getRecordingState();
  assert.ok(recState && recState.bytesWritten > 20000, `los rangos de grabación suman bytes (real: ${recState?.bytesWritten})`);

  const stopRes = await core.stopRecording();
  assert.equal(stopRes.code, 0, `la derivación file→file debe cerrar limpia: ${JSON.stringify(stopRes)}; logs: ${logs.slice(-6).join(' | ')}`);
  assert.ok(!stopRes.timedOut, 'la derivación no debe agotar los 120 s');
  assert.ok(derivationStderr.join('').length > 0, 'todo el stderr de la derivación pasó por onRecordingStderr');
  assert.ok(fs.existsSync(partialPath), 'el MP4 derivado existe');
  const duration = probeDurationSeconds(partialPath);
  assert.ok(duration > 3, `el MP4 dura >3 s (real: ${duration})`);

  // (c) El archivo de sesión, tal cual quedó en sessionsDir.
  assert.ok(fs.existsSync(sessionFile), 'el archivo de sesión existe en sessionsDir');
  const sessionBytes = fs.readFileSync(sessionFile);
  assert.equal(sessionBytes.subarray(0, 3).toString('ascii'), 'FLV');
  assert.ok(sessionBytes.length > recState.bytesWritten, 'el archivo de sesión contiene la secuencia completa (más que el rango grabado)');
  const scanner = new FlvGateScanner();
  scanner.push(sessionBytes);
  assert.equal(scanner.gatePassed(), true, 'el archivo de sesión supera la compuerta con FlvGateScanner');
  assert.ok(['h264_mf', 'libx264'].includes(await session.getEncoder()), 'el codificador debe ser uno válido de la plataforma (h264_mf en Windows, libx264 en Linux)');
  await core.shutdown();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('integración v3: la autoprueba del Motor PodcastStudio valida el flujo en vivo (tee sobre la sesión)', { skip: !ffmpegBin, timeout: 90000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-core-st-'));
  const selfTestResults = [];
  const { core } = makeCore(tmp, { onSelfTestResult: (v) => selfTestResults.push(v) });
  let gen = null;
  t.after(async () => {
    try { gen?.kill('SIGKILL'); } catch {}
    try { await core.shutdown(); } catch {}
  });
  core.setSessionActive(true);
  gen = startWebmGenerator(core);
  assert.equal(await core.waitForFlow(20000), true, 'flujo en vivo antes de la autoprueba');
  const verdict = await core.runSelfTest({ durationMs: 2000 });
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.codec, 'h264');
  assert.equal(verdict.width, 640);
  assert.equal(verdict.height, 360);
  assert.ok(verdict.file && verdict.file.includes('selftest-'), `el veredicto nombra su archivo: ${verdict.file}`);
  assert.ok(fs.existsSync(verdict.file), 'el archivo de autoprueba queda para validar');
  assert.deepEqual(core.getSelfTestState(), verdict);
  assert.equal(selfTestResults.length, 1, 'onSelfTestResult recibió el veredicto');
  gen.kill('SIGKILL');
  await core.shutdown();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('perfil de programa: setProgramProfile guarda el perfil activo y el default es 1080p', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-core-p-'));
  const { core } = makeCore(tmp);
  const before = core.getState().programProfile;
  assert.deepEqual(
    { w: before.width, h: before.height, master: before.masterBitrateBps, sw: before.streamWidth, sh: before.streamHeight, out: before.streamBitrateBps },
    { w: 1920, h: 1080, master: 10000000, sw: 1920, sh: 1080, out: 6000000 },
  );
  const updated = core.setProgramProfile({ id: '2160p', width: 3840, height: 2160, masterBitrateBps: 20000000, streamWidth: 1920, streamHeight: 1080, streamBitrateBps: 6000000 });
  assert.equal(updated.id, '2160p');
  assert.equal(core.getState().programProfile.width, 3840);
  core.shutdown();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('el árbol contiene el núcleo y main ya no crea workers por destino', () => {
  const core = fs.readFileSync(path.join(repoRoot, 'electron', 'program-core.js'), 'utf8');
  const main = fs.readFileSync(path.join(repoRoot, 'electron', 'main.js'), 'utf8');
  assert.ok(!main.includes('spawnStreamWorker'), 'main.js ya no genera procesos por destino');
  assert.ok(!main.includes('buildStreamWorkerArgs'), 'main.js ya no construye argumentos por destino');
  assert.ok(core.includes("'-c', 'copy'"), 'el reparto a destinos es con copia cuando la salida iguala al máster');
  assert.ok(main.includes('createProgramCore'), 'main instancia el núcleo');
});
