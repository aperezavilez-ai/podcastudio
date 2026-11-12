// ============================================================================
// Pruebas del archivo maestro del Motor PodcastStudio (núcleo v3,
// electron/master-file.js): la costura nueva es el DISCO.
//
// (a) El escritor es byte-exacto con trozos partidos irregulares y cierra
//     con fsync limpio.
// (b) El scanner solo abre la compuerta con cabecera + secuencia de vídeo
//     + keyframe + mínimo de bytes, y su prefijo re-sella las secuencias
//     al timestamp del keyframe.
// (c) El lector comprueba la compuerta leyendo el propio archivo (que
//     CRECE por trozos pequeños e irregulares durante la prueba) y luego
//     entrega prefijo + bytes desde el keyframe, byte-exactos.
// (d) validateMasterFile valida un FLV real generado por FFmpeg (skip
//     declarado si no se resuelve ningún FFmpeg ejecutable).
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createMasterFileWriter,
  createMasterFileReader,
  FlvGateScanner,
  validateMasterFile,
  GATE_MIN_BYTES,
} = require('../electron/master-file.js');

// ---------- constructores de FLV sintético (mismos que program-core) ----------
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

// Flujo sintético completo: cabecera + secuencias + keyframe + suficientes
// interframes para superar el mínimo de la compuerta. Devuelve también el
// offset y el timestamp del keyframe.
function syntheticStream({ withSeq = true, withKeyframe = true, frames = 260 } = {}) {
  const parts = [flvHeader()];
  let offset = 13;
  if (withSeq) {
    parts.push(flvTag(9, 0, avcSeqPayload)); offset += 11 + avcSeqPayload.length + 4;
    parts.push(flvTag(8, 0, aacSeqPayload)); offset += 11 + aacSeqPayload.length + 4;
  }
  const keyframeOffset = offset;
  const keyframeTs = 2000;
  if (withKeyframe) {
    parts.push(flvTag(9, keyframeTs, keyPayload));
    offset += 11 + keyPayload.length + 4;
  }
  for (let i = 0; i < frames; i += 1) {
    const bigFrame = Buffer.concat([framePayload, Buffer.alloc(96, i % 251)]);
    parts.push(flvTag(9, keyframeTs + 33 * (i + 1), bigFrame));
    if (i % 3 === 0) parts.push(flvTag(8, keyframeTs + 33 * (i + 1) + 10, audioPayload));
  }
  return { buf: Buffer.concat(parts), keyframeOffset, keyframeTs };
}

function parseTags(buf, from = 13) {
  const tags = [];
  let off = from;
  while (off + 11 <= buf.length) {
    const size = buf.readUIntBE(off + 1, 3);
    const ts = buf.readUIntBE(off + 4, 3) | (buf[off + 7] << 24);
    tags.push({ type: buf[off], ts, offset: off });
    off += 11 + size + 4;
  }
  return tags;
}

async function waitUntil(cond, timeoutMs = 8000, stepMs = 25) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return cond();
}

function resolveFfmpeg() {
  const candidates = [];
  try { candidates.push(require('ffmpeg-static')); } catch (e) {}
  candidates.push('/usr/bin/ffmpeg');
  for (const cand of candidates) {
    if (!cand) continue;
    const r = spawnSync(cand, ['-version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cand;
  }
  return null;
}

test('scanner: la compuerta exige cabecera, secuencia de vídeo, keyframe y mínimo de bytes', () => {
  assert.equal(GATE_MIN_BYTES, 16 * 1024);
  const noKey = new FlvGateScanner();
  noKey.push(syntheticStream({ withKeyframe: false }).buf);
  assert.equal(noKey.headerOk, true);
  assert.equal(noKey.gatePassed(), false, 'sin keyframe no hay compuerta');

  const noSeq = new FlvGateScanner();
  noSeq.push(syntheticStream({ withSeq: false }).buf);
  assert.equal(noSeq.sawKeyframe, true);
  assert.equal(noSeq.gatePassed(), false, 'sin secuencia de vídeo no hay compuerta');

  const tooSmall = new FlvGateScanner();
  tooSmall.push(Buffer.concat([flvHeader(), flvTag(9, 0, avcSeqPayload), flvTag(9, 100, keyPayload)]));
  assert.equal(tooSmall.gatePassed(), false, 'bajo el mínimo de bytes no hay compuerta');

  const full = new FlvGateScanner();
  const { buf, keyframeOffset, keyframeTs } = syntheticStream();
  // Trozos partidos en cualquier punto: de 1 a 17 bytes.
  for (let i = 0, n = 1; i < buf.length; n = (n % 17) + 1) {
    full.push(buf.subarray(i, Math.min(buf.length, i + n)));
    i += n;
  }
  assert.equal(full.gatePassed(), true, 'el flujo completo sí supera la compuerta');
  assert.deepEqual(full.keyframes, [{ offset: keyframeOffset, ts: keyframeTs }]);
  assert.equal(full.lastTagEndOffset, buf.length);
  assert.ok(full.videoTags > 100);
});

test('scanner: buildPrefix re-sella las secuencias al timestamp dado', () => {
  const { buf, keyframeTs } = syntheticStream();
  const scanner = new FlvGateScanner();
  scanner.push(buf);
  const prefix = scanner.buildPrefix(4321);
  assert.equal(prefix.subarray(0, 3).toString('ascii'), 'FLV');
  const tags = parseTags(prefix);
  assert.equal(tags.length, 2, 'el prefijo trae cabecera + 2 etiquetas de secuencia');
  assert.deepEqual(tags.map((t) => t.type), [9, 8]);
  assert.ok(tags.every((t) => t.ts === 4321), 'ambas secuencias re-selladas al timestamp dado');
  assert.notEqual(keyframeTs, 4321, 'el resellado no es el timestamp original');
});

test('writer: byte-exacto con trozos irregulares y cierre limpio con fsync', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-master-w-'));
  const filePath = path.join(tmp, 'master.flv');
  const { buf } = syntheticStream();
  const writer = createMasterFileWriter({ filePath, log: () => {} });
  const sizes = [1, 7, 3, 1024, 13, 4096, 5, 8192, 31];
  let off = 0;
  let n = 0;
  const pending = [];
  while (off < buf.length) {
    const len = sizes[n % sizes.length]; n += 1;
    pending.push(writer.write(buf.subarray(off, Math.min(buf.length, off + len))));
    off += len;
  }
  await Promise.all(pending);
  assert.equal(writer.bytesWritten(), buf.length);
  assert.equal(writer.gatePassed(), true);
  assert.equal(writer.keyframeOffsets().length, 1);
  assert.equal(writer.lastCompleteTagEnd(), buf.length);
  await writer.closeSegment();
  assert.equal(writer.closed, true);
  const onDisk = fs.readFileSync(filePath);
  assert.ok(onDisk.equals(buf), 'el archivo es byte-exacto a la concatenación de trozos');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('reader: la compuerta se comprueba sobre el archivo que crece y la entrega es byte-exacta desde el keyframe', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-master-r-'));
  const filePath = path.join(tmp, 'growing.flv');
  const { buf, keyframeOffset, keyframeTs } = syntheticStream();
  fs.writeFileSync(filePath, Buffer.alloc(0));
  const reader = createMasterFileReader({ filePath, log: () => {} });
  t.after(() => { reader.stop(); fs.rmSync(tmp, { recursive: true, force: true }); });

  // Primera hornada: válida pero BAJO el mínimo de la compuerta.
  const firstCut = Math.floor(GATE_MIN_BYTES / 2);
  fs.appendFileSync(filePath, buf.subarray(0, firstCut));
  let gateResolved = false;
  const gatePromise = reader.waitGate(8000).then((ok) => { gateResolved = true; return ok; });
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(gateResolved, false, 'waitGate no resuelve antes de la compuerta');

  // El archivo sigue creciendo por trozos pequeños e irregulares.
  const sizes = [997, 13, 4099, 3, 2048, 77];
  let off = firstCut;
  let n = 0;
  while (off < buf.length) {
    const len = sizes[n % sizes.length]; n += 1;
    fs.appendFileSync(filePath, buf.subarray(off, Math.min(buf.length, off + len)));
    off += len;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(await gatePromise, true, 'la compuerta pasa cuando el archivo la supera');

  const received = [];
  await reader.start((chunk) => {
    received.push(Buffer.from(chunk));
    // Backpressure: el lector debe esperar esta promesa.
    return new Promise((r) => setTimeout(r, 1));
  }, { fromLatestKeyframe: true });
  const expectedTail = buf.subarray(keyframeOffset);
  const okLen = await waitUntil(() => Buffer.concat(received).length >= 13 + (11 + avcSeqPayload.length + 4) + (11 + aacSeqPayload.length + 4) + expectedTail.length, 8000);
  reader.stop();
  assert.ok(okLen, 'el lector entregó prefijo + cola completa');
  const all = Buffer.concat(received);
  const prefixLen = all.length - expectedTail.length;
  const prefix = all.subarray(0, prefixLen);
  const tail = all.subarray(prefixLen);
  assert.ok(tail.equals(expectedTail), 'los bytes desde el keyframe son byte-exactos al archivo');
  assert.equal(prefix.subarray(0, 3).toString('ascii'), 'FLV');
  const prefixTags = parseTags(prefix);
  assert.equal(prefixTags.length, 2, 'el prefijo sustituye a cabecera+secuencias (no se duplican en la cola)');
  assert.ok(prefixTags.every((tg) => tg.ts === keyframeTs), 'las secuencias del prefijo van re-selladas al keyframe');
});

test('reader: followTo drena el archivo actual y continúa en el nuevo tras su compuerta', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-master-f-'));
  const fileA = path.join(tmp, 'a.flv');
  const fileB = path.join(tmp, 'b.flv');
  const a = syntheticStream();
  const b = syntheticStream();
  fs.writeFileSync(fileA, a.buf);
  const reader = createMasterFileReader({ filePath: fileA, log: () => {} });
  t.after(() => { reader.stop(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const received = [];
  await reader.start((chunk) => { received.push(Buffer.from(chunk)); }, { fromLatestKeyframe: true });
  const aDelivered = 13 + (11 + avcSeqPayload.length + 4) + (11 + aacSeqPayload.length + 4) + (a.buf.length - a.keyframeOffset);
  assert.ok(await waitUntil(() => Buffer.concat(received).length >= aDelivered, 8000), 'entrega inicial del archivo A');
  fs.writeFileSync(fileB, b.buf);
  reader.followTo(fileB);
  const totalExpected = aDelivered * 2;
  assert.ok(await waitUntil(() => Buffer.concat(received).length >= totalExpected, 8000), 'tras followTo llega el prefijo y la cola del archivo B');
  reader.stop();
  const all = Buffer.concat(received);
  assert.equal(all.length, totalExpected);
  assert.ok(all.subarray(aDelivered, aDelivered + 3).toString('ascii') === 'FLV', 'el segundo tramo empieza con un prefijo FLV nuevo');
});

test('validateMasterFile: valida un FLV real de FFmpeg y mide su fps', { timeout: 60000 }, async (t) => {
  const ffmpegPath = resolveFfmpeg();
  if (!ffmpegPath) { t.skip('sin FFmpeg ejecutable (ni ffmpeg-static ni /usr/bin/ffmpeg)'); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-master-v-'));
  const filePath = path.join(tmp, 'real.flv');
  const gen = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '30', '-pix_fmt', 'yuv420p',
    '-f', 'flv', '-y', filePath], { encoding: 'utf8' });
  assert.equal(gen.status, 0, `el generador debió salir limpio: ${gen.stderr?.slice(0, 200)}`);
  const verdict = await validateMasterFile({ filePath, ffmpegPath, spawnImpl: (await import('node:child_process')).spawn });
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.codec, 'h264');
  assert.equal(verdict.width, 320);
  assert.equal(verdict.height, 240);
  assert.equal(verdict.fpsNominal, 30);
  assert.ok(verdict.videoTags > 30, `etiquetas de vídeo contadas: ${verdict.videoTags}`);
  assert.ok(verdict.keyframes >= 1);
  assert.ok(verdict.fpsMeasured > 24 && verdict.fpsMeasured < 36, `fps medido razonable: ${verdict.fpsMeasured}`);
  assert.ok(verdict.durationSec > 1.5, `duración medida: ${verdict.durationSec}`);
  assert.equal(verdict.bytes, fs.statSync(filePath).size);
  fs.rmSync(tmp, { recursive: true, force: true });
});
