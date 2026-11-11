import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mainSrc = fs.readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
const streamBlock = mainSrc.slice(mainSrc.indexOf('STREAMING v1.5.0'));

// --- Invariantes de la cadena (Frente D) ---
test('la cabecera se limpia al INICIAR streaming, no solo al detener', () => {
  const startIdx = streamBlock.indexOf("ipcMain.handle('start-streaming'");
  const stopIdx = streamBlock.indexOf("ipcMain.handle('stop-streaming'");
  const startBody = streamBlock.slice(startIdx, stopIdx);
  assert.match(startBody, /streamInitHeader = null;/);
});

test('encoder por defecto libx264 zerolatency y reintento único con h264_mf', () => {
  assert.match(streamBlock, /encoder: 'libx264'/);
  assert.match(streamBlock, /'-tune', 'zerolatency'/);
  assert.match(streamBlock, /'-profile:v', 'high'/);
  assert.match(streamBlock, /entry\.encoder = 'h264_mf'/);
  assert.match(streamBlock, /result\.kind === 'encoder'/);
});

test('la clasificación de errores reconoce encoder y TLS', () => {
  assert.match(streamBlock, /function classifyStreamError/);
  assert.match(streamBlock, /return 'encoder'/);
  assert.match(streamBlock, /return 'tls'/);
});

test('reconexión con backoff 5/10/20/40/60 y eventos por destino', () => {
  assert.match(streamBlock, /STREAM_RECONNECT_DELAYS_MS = \[5000, 10000, 20000, 40000, 60000\]/);
  assert.match(streamBlock, /stream-destination-status/);
  assert.match(streamBlock, /'reconnecting'/);
  assert.match(streamBlock, /'failed'/);
  assert.match(streamBlock, /'down'/);
});

test('cola con tope de 32 MB, probesize 8M, rtmp_buffer 1000 y log persistente', () => {
  assert.match(streamBlock, /STREAM_QUEUE_CAP_BYTES = 32 \* 1024 \* 1024/);
  assert.match(streamBlock, /'-probesize', '8M'/);
  assert.match(streamBlock, /'-rtmp_buffer', '1000'/);
  assert.match(streamBlock, /streaming\.log/);
  assert.match(streamBlock, /stderrRing/);
});

test('la telemetría no inventa valores: sin defaults de fps/bitrate en el envío', () => {
  const telemetryIdx = streamBlock.indexOf("webContents.send('stream-telemetry'");
  const telemetryBody = streamBlock.slice(telemetryIdx - 600, telemetryIdx + 500);
  assert.doesNotMatch(telemetryBody, /fps:.*\|\| 30|bitrate:.*4500 kbits\/s/);
  assert.match(telemetryBody, /fpsMatch && bitrateMatch/);
});

// --- Integración real: RTMP local con el ffmpeg empaquetado ---
let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = null; }
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  // Sin binario de ffmpeg-static (p. ej. instalación sin postinstall), usar el
  // ffmpeg del sistema para la integración local.
  ffmpegPath = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegPath;
}

test('integración RTMP local: push libx264 conecta; al matar el servidor el push muere (base de la detección de caída)', { skip: !ffmpegPath || !fs.existsSync(ffmpegPath || '') }, async (t) => {
  const port = 19399;
  const url = `rtmp://127.0.0.1:${port}/live/test`;
  const outFile = path.join(process.cwd(), 'scripts', '.tmp-rtmp-out.flv');
  try { fs.unlinkSync(outFile); } catch {}

  const server = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-listen', '1', '-i', url, '-c', 'copy', '-f', 'flv', outFile], { stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErr = '';
  server.stderr.on('data', (d) => { serverErr += d.toString(); });
  await new Promise((r) => setTimeout(r, 800));

  const client = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-profile:v', 'high',
    '-b:v', '800k', '-maxrate', '900k', '-bufsize', '900k', '-pix_fmt', 'yuv420p', '-g', '60',
    '-rtmp_buffer', '1000', '-rw_timeout', '8000000', '-f', 'flv', url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let clientErr = '';
  client.stderr.on('data', (d) => { clientErr += d.toString(); });

  // El servidor debe recibir datos: el archivo de salida crece.
  await new Promise((r) => setTimeout(r, 4000));
  const received = fs.existsSync(outFile) && fs.statSync(outFile).size > 10000;
  assert.ok(received, `el servidor RTMP local no recibió el stream. serverErr=${serverErr} clientErr=${clientErr}`);

  // Al matar el servidor, el cliente debe morir (eso detecta el 'close' de main).
  const clientClosed = new Promise((resolve) => client.once('close', (code) => resolve(code)));
  try { server.kill('SIGKILL'); } catch {}
  const code = await Promise.race([clientClosed, new Promise((r) => setTimeout(() => r('timeout'), 30000))]);
  assert.notEqual(code, 'timeout', 'el cliente RTMP no murió tras caer el servidor');
  try { client.kill('SIGKILL'); } catch {}
  try { fs.unlinkSync(outFile); } catch {}
});
