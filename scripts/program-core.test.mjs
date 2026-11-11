// ============================================================================
// Pruebas del núcleo de programa v2.0.0 (electron/program-core.js).
//
// Parte 1 — FlvJoinBuffer con etiquetas FLV sintéticas: la unión tardía de
// un destino o de la grabación debe entregar cabecera + etiquetas de
// secuencia RESELLADAS al timestamp del último keyframe (mismo reloj que
// el directo, exigencia del muxer FLV) + todo lo posterior al keyframe.
//
// Parte 2 — Integración con el FFmpeg real del sistema: un flujo WebM
// (VP8) generado en vivo entra al núcleo; el núcleo lo transcodifica UNA
// vez (sonda: h264_mf no existe en Linux → libx264) y lo reparte con
// COPIA a un destino RTMP local y al consumidor de grabación, que produce
// un MP4 válido. Si en este Linux /usr/bin/ffmpeg no existe, la parte 2
// se salta declarándolo (skip), no fingiendo.
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
  // Cabecera FLV presente
  assert.equal(snap.subarray(0, 3).toString('ascii'), 'FLV');
  // Las dos etiquetas de secuencia aparecen con timestamp 2000 (reselladas)
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

// ---------- integración con FFmpeg real ----------
const hasSystemFfmpeg = fs.existsSync('/usr/bin/ffmpeg');

test('integración: WebM entra, UNA transcodificación, copia a RTMP y a la grabación MP4', { skip: !hasSystemFfmpeg, timeout: 90000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-core-'));
  const partialPath = path.join(tmp, 'programa.partial.mp4');
  const rtmpOut = path.join(tmp, 'destino.flv');
  const session = createStreamEncoderSession({ ffmpegPath: '/usr/bin/ffmpeg' });
  const logs = [];
  const telemetry = [];
  const { classifyStreamError } = require('../electron/stream-error.js');
  const core = createProgramCore({
    spawnImpl: spawn,
    ffmpegPath: '/usr/bin/ffmpeg',
    sessionEncoder: session,
    classifyError: classifyStreamError,
    log: (line) => logs.push(String(line)),
    onTelemetry: (d) => telemetry.push(d),
  });

  // Oyente RTMP local que vuelca lo recibido a un archivo.
  const listener = spawn('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error',
    '-listen', '1', '-f', 'flv', '-i', 'rtmp://127.0.0.1:1937/live',
    '-c', 'copy', '-f', 'flv', '-y', rtmpOut], { stdio: ['ignore', 'ignore', 'pipe'] });
  let listenerErr = '';
  listener.stderr.on('data', (d) => { listenerErr += d.toString(); });
  await new Promise((r) => setTimeout(r, 800));

  // Generador WebM VP8+Opus en vivo (el «MediaRecorder» de esta prueba).
  const gen = spawn('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error',
    '-re', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30',
    '-re', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-c:v', 'libvpx', '-b:v', '800k', '-deadline', 'realtime', '-cpu-used', '5',
    '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });

  // Limpieza garantizada: si una aserción falla a mitad, ningún FFmpeg
  // hijo debe quedar vivo manteniendo abierto el proceso de pruebas.
  t.after(async () => {
    try { gen.kill('SIGKILL'); } catch {}
    try { listener.kill('SIGKILL'); } catch {}
    try { await core.shutdown(); } catch {}
  });

  core.setSessionActive(true);
  gen.stdout.on('data', (chunk) => core.writeWebmChunk(Buffer.from(chunk)));

  const flow = await core.waitForFlow(8000);
  assert.equal(flow, true, `el núcleo debe producir flujo; logs: ${logs.slice(-4).join(' | ')}`);

  const attach = await core.attachRecording({ partialPath });
  assert.equal(attach.success, true, JSON.stringify(attach));

  const dest = await core.addDestination({ id: 'test-rtmp', service: 'Prueba', url: 'rtmp://127.0.0.1:1937/live/streamkey' });
  assert.equal(dest.success, true, JSON.stringify(dest));

  await new Promise((r) => setTimeout(r, 9000));
  const recState = core.getRecordingState();
  const stopRes = await core.stopRecording();
  core.removeAllDestinations();
  gen.kill('SIGKILL');
  listener.kill('SIGKILL');
  await core.shutdown();

  assert.equal(stopRes.code, 0, `stop: ${JSON.stringify(stopRes)}; logs: ${logs.slice(-6).join(' | ')}`);
  assert.ok(!stopRes.timedOut, 'el cierre no debe agotar el tiempo');
  // Contrato real del núcleo: los bytes se leen de getRecordingState()
  // antes de detener (así lo consume electron/main.js).
  assert.ok(recState && recState.bytesWritten > 20000, `la grabación recibió bytes del flujo (real: ${recState?.bytesWritten})`);
  assert.ok(fs.existsSync(partialPath), 'el MP4 de grabación existe');
  const probe = spawnSync('/usr/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', partialPath], { encoding: 'utf8' });
  const duration = parseFloat(probe.stdout.trim());
  assert.ok(duration > 3, `el MP4 dura >3 s (real: ${duration})`);
  assert.ok(fs.existsSync(rtmpOut) && fs.statSync(rtmpOut).size > 20000,
    `el destino RTMP recibió la copia (bytes: ${fs.existsSync(rtmpOut) ? fs.statSync(rtmpOut).size : 0}); listener: ${listenerErr.slice(0, 200)}`);
  assert.ok(telemetry.length > 0, 'hubo telemetría real del proceso único');
  assert.ok(telemetry.every((d) => Number.isFinite(d.fps) && typeof d.bitrate === 'string' && d.bitrate.length > 0), 'la telemetría es medida, sin rellenos');
  // El codificador de sesión en este Linux debe ser libx264 (h264_mf no existe)
  assert.equal(await session.getEncoder(), 'libx264');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('el árbol contiene el núcleo y main ya no crea workers por destino', () => {
  const core = fs.readFileSync(path.join(repoRoot, 'electron', 'program-core.js'), 'utf8');
  const main = fs.readFileSync(path.join(repoRoot, 'electron', 'main.js'), 'utf8');
  assert.ok(!main.includes('spawnStreamWorker'), 'main.js ya no genera procesos por destino');
  assert.ok(!main.includes('buildStreamWorkerArgs'), 'main.js ya no construye argumentos por destino');
  assert.ok(core.includes("'-c', 'copy'"), 'el reparto a destinos es con copia');
  assert.ok(main.includes('createProgramCore'), 'main instancia el núcleo');
});
