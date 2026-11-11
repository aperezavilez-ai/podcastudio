import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyStreamError, STREAM_ERROR_USER_MESSAGES } = require('../electron/stream-error.js');

// --- D1: el kind 'url' (nuevo) ---
test("'url': el texto real del log de la máquina del usuario", () => {
  // streaming.log (2026-11-11): Facebook recibió el intento y rechazó la
  // publicación por URL inválida. Antes de D1 caía en 'unknown'.
  const realLog = '[rtmps @ 0x55c2d8] Server error: Publish Rejected: Invalid URL';
  assert.equal(classifyStreamError(realLog), 'url');
});

test("'url': variantes de la regla van antes que las genéricas", () => {
  assert.equal(classifyStreamError('Invalid URL'), 'url');
  assert.equal(classifyStreamError('Error opening output: invalid url'), 'url');
  // Aunque el texto también mencione red, 'publish rejected' manda: la
  // plataforma SÍ fue alcanzada y rechazó la dirección.
  assert.equal(classifyStreamError('Publish Rejected: Invalid URL (network path /rtmp/)'), 'url');
});

test("'url': mensaje de usuario exacto para revisar servidor/clave", () => {
  assert.equal(
    STREAM_ERROR_USER_MESSAGES.url,
    'Facebook rechazó la dirección de publicación: revisa que el servidor no traiga la clave pegada ni la clave de una sesión cerrada'
  );
});

// --- Regresión: el resto de kinds conserva su comportamiento previo ---
test("'encoder': errores de codificador H.264 / Media Foundation", () => {
  assert.equal(classifyStreamError('[h264_mf @ 0x1] Error initializing output stream'), 'encoder');
  assert.equal(classifyStreamError('Unknown encoder libx264'), 'encoder');
  assert.equal(classifyStreamError('Error initializing output stream 0:0 -- Error while opening encoder'), 'encoder');
});

test("'tls': errores de TLS/SSL y de protocolo", () => {
  assert.equal(classifyStreamError('TLS handshake failed'), 'tls');
  assert.equal(classifyStreamError('SSL certificate problem: unable to get local issuer certificate'), 'tls');
  assert.equal(classifyStreamError('Protocol not found'), 'tls');
});

test("'auth': clave inválida y accesos denegados", () => {
  assert.equal(classifyStreamError('Invalid stream key'), 'auth');
  assert.equal(classifyStreamError('Access denied by server'), 'auth');
  assert.equal(classifyStreamError('HTTP error 403 Forbidden'), 'auth');
});

test("'network': servidor inalcanzable, timeouts y pipes rotos", () => {
  assert.equal(classifyStreamError('Connection refused'), 'network');
  assert.equal(classifyStreamError('Connection timed out'), 'network');
  assert.equal(classifyStreamError('Failed to resolve hostname'), 'network');
  assert.equal(classifyStreamError('Input/output error'), 'network');
});

test("'unknown': textos vacíos o sin ninguna señal conocida", () => {
  assert.equal(classifyStreamError(''), 'unknown');
  assert.equal(classifyStreamError(null), 'unknown');
  assert.equal(classifyStreamError(undefined), 'unknown');
  assert.equal(classifyStreamError('FFmpeg cerró antes de conectar (código 1).'), 'unknown');
});

test('todo kind tiene mensaje de usuario en español no vacío', () => {
  for (const kind of ['url', 'encoder', 'tls', 'auth', 'network', 'unknown']) {
    assert.equal(typeof STREAM_ERROR_USER_MESSAGES[kind], 'string');
    assert.ok(STREAM_ERROR_USER_MESSAGES[kind].length > 10, `sin mensaje para ${kind}`);
  }
});
