import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  STREAM_ENCODER_PROBE_ORDER,
  otherStreamEncoder,
  buildStreamEncoderArgs,
  buildEncoderProbeArgs,
  probeEncoderOnce,
  createStreamEncoderSession,
} = require('../electron/stream-encoder.js');

// Proceso falso mínimo: EventEmitter con stderr drenable y kill().
function fakeProc({ closeCode = 0, neverClose = false } = {}) {
  const proc = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = () => { proc.killed = true; };
  if (!neverClose) {
    setImmediate(() => proc.emit('close', closeCode));
  }
  return proc;
}

test('el orden de sonda es h264_mf primero y libx264 de respaldo', () => {
  assert.deepEqual(STREAM_ENCODER_PROBE_ORDER, ['h264_mf', 'libx264']);
  assert.equal(otherStreamEncoder('h264_mf'), 'libx264');
  assert.equal(otherStreamEncoder('libx264'), 'h264_mf');
});

test('los argumentos por encoder conservan la receta histórica', () => {
  const mf = buildStreamEncoderArgs('h264_mf', 3);
  assert.deepEqual(mf, ['-c:v', 'h264_mf', '-b:v', '4500k']);
  const x264 = buildStreamEncoderArgs('libx264', 3);
  assert.ok(x264.includes('libx264'));
  assert.ok(x264.includes('zerolatency'));
  assert.ok(x264.includes('high'));
  assert.equal(x264[x264.indexOf('-threads') + 1], '3');
});

test('la sonda codifica 1 s de testsrc2 hacia null con el encoder a probar', () => {
  const args = buildEncoderProbeArgs('h264_mf');
  assert.ok(args.includes('testsrc2=size=320x180:rate=30:duration=1'));
  assert.equal(args[args.indexOf('-c:v') + 1], 'h264_mf');
  assert.equal(args[args.lastIndexOf('-f') + 1], 'null');
});

test('probeEncoderOnce: código 0 = encoder sano; código != 0 o timeout = no sano', async () => {
  const okSpawn = () => fakeProc({ closeCode: 0 });
  assert.equal(await probeEncoderOnce({ spawnImpl: okSpawn, ffmpegPath: 'ffmpeg', encoder: 'h264_mf' }), true);
  const badSpawn = () => fakeProc({ closeCode: 1 });
  assert.equal(await probeEncoderOnce({ spawnImpl: badSpawn, ffmpegPath: 'ffmpeg', encoder: 'h264_mf' }), false);
  const hangSpawn = () => fakeProc({ neverClose: true });
  assert.equal(await probeEncoderOnce({ spawnImpl: hangSpawn, ffmpegPath: 'ffmpeg', encoder: 'h264_mf', timeoutMs: 30 }), false);
  const throwingSpawn = () => { throw new Error('ENOENT'); };
  assert.equal(await probeEncoderOnce({ spawnImpl: throwingSpawn, ffmpegPath: 'ffmpeg', encoder: 'h264_mf' }), false);
});

test('la sesión sonda UNA vez y cachea h264_mf si la sonda pasa', async () => {
  let spawnCalls = 0;
  const spawnImpl = () => { spawnCalls += 1; return fakeProc({ closeCode: 0 }); };
  const session = createStreamEncoderSession({ spawnImpl, ffmpegPath: 'ffmpeg' });
  assert.equal(await session.getEncoder(), 'h264_mf');
  assert.equal(await session.getEncoder(), 'h264_mf');
  assert.equal(spawnCalls, 1, 'la sonda debe correr una sola vez por sesión');
});

test('la sesión cae a libx264 si la sonda de h264_mf falla (sin sondear libx264)', async () => {
  let spawnCalls = 0;
  const spawnImpl = () => { spawnCalls += 1; return fakeProc({ closeCode: 1 }); };
  const session = createStreamEncoderSession({ spawnImpl, ffmpegPath: 'ffmpeg' });
  assert.equal(await session.getEncoder(), 'libx264');
  assert.equal(spawnCalls, 1, 'libx264 es respaldo garantizado: no se sondea');
});

test('noteEncoderFailure voltea el cache al otro codificador y no re-sondea', async () => {
  let spawnCalls = 0;
  const spawnImpl = () => { spawnCalls += 1; return fakeProc({ closeCode: 0 }); };
  const session = createStreamEncoderSession({ spawnImpl, ffmpegPath: 'ffmpeg' });
  assert.equal(await session.getEncoder(), 'h264_mf');
  session.noteEncoderFailure('h264_mf');
  assert.equal(await session.getEncoder(), 'libx264');
  assert.equal(spawnCalls, 1);
  // Un fallo ajeno al cacheado no lo mueve.
  session.noteEncoderFailure('h264_mf');
  assert.equal(await session.getEncoder(), 'libx264');
});
