'use strict';
// ============================================================================
// Motor PodcastStudio — archivo maestro en disco (núcleo de programa v3).
//
// En la v3 el disco es la fuente de verdad del flujo de programa: el
// proceso codificador/mezclador escribe UN archivo FLV de sesión y todos
// los consumidores (destinos y derivación de grabación) leen DE ESE
// ARCHIVO. Nadie se engancha a un tubo en memoria todavía vacío: cada
// lector comprueba la compuerta (cabecera + secuencia de vídeo + primer
// keyframe + un mínimo de bytes) LEYENDO EL PROPIO ARCHIVO antes de
// entregar un solo byte, y se une en el último keyframe con las etiquetas
// de secuencia re-selladas a su timestamp.
// ============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const GATE_MIN_BYTES = 16 * 1024;
const POLL_MS = 50;

function retimestampRecord(record, ts) {
  const out = Buffer.from(record);
  out.writeUIntBE(ts & 0xffffff, 4, 3);
  out[7] = (ts >> 24) & 0xff;
  return out;
}

// ----------------------------------------------------------------------------
// FlvGateScanner: parser FLV incremental. Acepta trozos partidos en
// cualquier punto (cabecera, cabecera de etiqueta, datos o prevTagSize).
// Todos los offsets son offsets absolutos dentro del archivo/flujo.
// ----------------------------------------------------------------------------
class FlvGateScanner {
  constructor() {
    this.pending = Buffer.alloc(0);
    this.headerOk = false;
    this.headerBytes = null; // 13 bytes: 'FLV' + versión/flags + tamaño + PreviousTagSize0
    this.seqTags = []; // { record, offset, type, ts } — registros completos
    this.gotVideoSeq = false;
    this.gotAudioSeq = false;
    this.sawKeyframe = false;
    this.keyframes = []; // { offset, ts }
    this.lastTagEndOffset = 0;
    this.videoTags = 0;
    this.firstVideoTs = null;
    this.lastVideoTs = null;
    this.totalBytes = 0;
    this._nextTagOffset = 0;
    this._corrupt = false;
  }

  // Alias de lectura cómodos.
  get videoTagCount() { return this.videoTags; }
  get hasVideoSequence() { return this.gotVideoSeq; }
  get lastCompleteTagEnd() { return this.lastTagEndOffset; }
  get seqRecords() { return this.seqTags; }

  push(chunk) {
    if (!chunk || chunk.length === 0) return this;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.totalBytes += buf.length;
    if (this._corrupt) return this;
    this.pending = this.pending.length ? Buffer.concat([this.pending, buf]) : Buffer.from(buf);
    this._drain();
    return this;
  }

  _drain() {
    for (;;) {
      if (!this.headerBytes) {
        if (this.pending.length < 13) return;
        if (this.pending.toString('ascii', 0, 3) !== 'FLV') {
          this._corrupt = true;
          this.pending = Buffer.alloc(0);
          return;
        }
        this.headerOk = true;
        this.headerBytes = Buffer.from(this.pending.subarray(0, 13));
        this.pending = this.pending.subarray(13);
        this._nextTagOffset = 13;
        this.lastTagEndOffset = 13;
        continue;
      }
      if (this.pending.length < 11) return;
      const dataSize = this.pending.readUIntBE(1, 3);
      const total = 11 + dataSize + 4;
      if (this.pending.length < total) return;
      const record = Buffer.from(this.pending.subarray(0, total));
      const offset = this._nextTagOffset;
      this.pending = this.pending.subarray(total);
      this._nextTagOffset += total;
      this.lastTagEndOffset = this._nextTagOffset;
      this._onTag(record, offset);
    }
  }

  _onTag(record, offset) {
    const type = record[0];
    const ts = record.readUIntBE(4, 3) | (record[7] << 24);
    if (type === 9) {
      this.videoTags += 1;
      if (this.firstVideoTs === null) this.firstVideoTs = ts;
      this.lastVideoTs = ts;
      if (record.length > 12) {
        const frameType = record[11] >> 4;
        const codecId = record[11] & 0x0f;
        const packetType = record[12];
        if (codecId === 7 && packetType === 0 && !this.gotVideoSeq) {
          this.gotVideoSeq = true;
          this.seqTags.push({ record, offset, type, ts });
          return;
        }
        if (codecId === 7 && packetType === 1 && frameType === 1) {
          this.sawKeyframe = true;
          this.keyframes.push({ offset, ts });
        }
      }
      return;
    }
    if (type === 8 && record.length > 12) {
      const soundFormat = record[11] >> 4;
      const aacPacketType = record[12];
      if (soundFormat === 10 && aacPacketType === 0 && !this.gotAudioSeq) {
        this.gotAudioSeq = true;
        this.seqTags.push({ record, offset, type, ts });
      }
    }
  }

  gatePassed() {
    return this.headerOk && this.gotVideoSeq && this.sawKeyframe && this.totalBytes >= GATE_MIN_BYTES;
  }

  latestKeyframe() {
    return this.keyframes.length ? this.keyframes[this.keyframes.length - 1] : null;
  }

  // Cabecera + etiquetas de secuencia re-selladas al timestamp dado: el
  // prefijo con el que un lector se une en un keyframe.
  buildPrefix(keyframeTs) {
    if (!this.headerBytes) return Buffer.alloc(0);
    const parts = [Buffer.from(this.headerBytes)];
    for (const tag of this.seqTags) parts.push(retimestampRecord(tag.record, keyframeTs));
    return Buffer.concat(parts);
  }
}

// Escaneo de un archivo completo (o de su cabeza) con un scanner propio.
function scanFileSync(filePath, maxBytes) {
  const scanner = new FlvGateScanner();
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch (e) { return { scanner, size: 0 }; }
  const toRead = maxBytes ? Math.min(size, maxBytes) : size;
  if (toRead <= 0) return { scanner, size };
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(toRead);
    let read = 0;
    while (read < toRead) {
      const n = fs.readSync(fd, buf, read, toRead - read, read);
      if (n <= 0) break;
      read += n;
    }
    scanner.push(buf.subarray(0, read));
    // El tamaño que manda en la compuerta es el del archivo, no el del
    // trozo leído cuando solo se leyó la cabeza.
    if (scanner.totalBytes < size && maxBytes && size > toRead) scanner.totalBytes = size;
  } catch (e) {
    // Archivo aún no disponible: el scanner queda vacío.
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (e) {} }
  }
  return { scanner, size };
}

// ----------------------------------------------------------------------------
// createMasterFileWriter: escritura ordenada y byte-exacta al archivo
// maestro. El scanner se alimenta ANTES de escribir cada chunk, así los
// offsets que publica describen lo que el chunk va a ocupar en disco.
// ----------------------------------------------------------------------------
function createMasterFileWriter({ filePath, log } = {}) {
  const logger = typeof log === 'function' ? log : () => {};
  if (!filePath) throw new Error('createMasterFileWriter: falta filePath');
  try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); } catch (e) {}
  const scanner = new FlvGateScanner();
  const stream = fs.createWriteStream(filePath, { flags: 'w' });
  let queue = Promise.resolve();
  let written = 0;
  let closedFlag = false;
  let streamError = null;
  stream.on('error', (err) => {
    streamError = err;
    logger(`Motor PodcastStudio: error escribiendo el archivo maestro ${filePath}: ${err.message}`);
  });
  const opened = new Promise((resolve) => {
    stream.once('open', () => resolve(true));
    stream.once('error', () => resolve(false));
  });

  function writeOne(buf) {
    return new Promise((resolve, reject) => {
      if (streamError) { reject(streamError); return; }
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else { written += buf.length; resolve(); }
      };
      try {
        const ok = stream.write(buf, (err) => { if (err) done(err); });
        if (ok) done();
        else stream.once('drain', () => done());
      } catch (e) { done(e); }
    });
  }

  function write(chunk) {
    if (!chunk || chunk.length === 0) return queue;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    scanner.push(buf); // ANTES de escribir: los offsets ya describen el chunk
    queue = queue.then(() => writeOne(buf)).catch((err) => {
      logger(`Motor PodcastStudio: fallo de escritura en el archivo maestro: ${err.message}`);
    });
    return queue;
  }

  async function closeSegment() {
    if (closedFlag) return;
    await queue;
    await opened;
    closedFlag = true;
    await new Promise((resolve) => {
      const finish = () => resolve();
      try {
        if (stream.fd != null && !stream.destroyed) {
          try { fs.fsync(stream.fd, () => { try { stream.end(finish); } catch (e) { resolve(); } }); return; }
          catch (e) {}
        }
        stream.end(finish);
      } catch (e) { resolve(); }
    });
  }

  return {
    filePath,
    scanner,
    write,
    flush: () => queue,
    bytesWritten: () => written,
    gatePassed: () => scanner.gatePassed(),
    keyframeOffsets: () => scanner.keyframes.map((k) => ({ ...k })),
    lastCompleteTagEnd: () => scanner.lastTagEndOffset,
    closeSegment,
    get closed() { return closedFlag; },
  };
}

// ----------------------------------------------------------------------------
// createMasterFileReader: lector que comprueba la compuerta LEYENDO EL
// PROPIO ARCHIVO (scanner propio, nunca el del escritor) y sigue la cola
// del archivo en crecimiento respetando el backpressure del consumidor.
// ----------------------------------------------------------------------------
function createMasterFileReader({ filePath, log } = {}) {
  const logger = typeof log === 'function' ? log : () => {};
  let currentPath = filePath;
  let stopped = false;
  let running = false;
  let pendingNextPath = null;
  let onChunkCb = null;
  let followFromLatest = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitGate(timeoutMs = 20000) {
    const started = Date.now();
    while (!stopped) {
      const { scanner, size } = scanFileSync(currentPath, 4 * 1024 * 1024);
      if (size >= GATE_MIN_BYTES && scanner.headerOk && scanner.gotVideoSeq && scanner.sawKeyframe) return true;
      if (Date.now() - started >= timeoutMs) return false;
      await sleep(100);
    }
    return false;
  }

  // Lee y entrega [from, to) del archivo actual en trozos de 64 KB,
  // esperando al consumidor entre trozo y trozo (backpressure real).
  async function deliverRange(from, to, state) {
    let pos = from;
    let fd;
    try { fd = await fs.promises.open(currentPath, 'r'); } catch (e) { return from; }
    try {
      while (pos < to && !stopped) {
        const len = Math.min(64 * 1024, to - pos);
        const buf = Buffer.alloc(len);
        const { bytesRead } = await fd.read(buf, 0, len, pos);
        if (bytesRead <= 0) break;
        pos += bytesRead;
        state.offset = pos;
        const piece = bytesRead === len ? buf : buf.subarray(0, bytesRead);
        const maybe = onChunkCb(piece);
        if (maybe && typeof maybe.then === 'function') await maybe;
      }
    } catch (e) {
      logger(`Motor PodcastStudio: error leyendo el archivo maestro ${currentPath}: ${e.message}`);
    } finally {
      try { await fd.close(); } catch (e) {}
    }
    return pos;
  }

  // Abre la entrega en el archivo actual: prefijo re-sellado + bytes desde
  // el último keyframe (el prefijo sustituye a cabecera+secuencias).
  async function openAtLatestKeyframe(state) {
    const gateOk = await waitGate(20000);
    if (!gateOk || stopped) return false;
    const { scanner } = scanFileSync(currentPath);
    const kf = scanner.latestKeyframe();
    if (!kf) return false;
    const prefix = scanner.buildPrefix(kf.ts);
    if (prefix.length) {
      const maybe = onChunkCb(prefix);
      if (maybe && typeof maybe.then === 'function') await maybe;
    }
    state.offset = kf.offset;
    return true;
  }

  async function loop(state) {
    let openedOk;
    if (followFromLatest) {
      openedOk = await openAtLatestKeyframe(state);
    } else {
      state.offset = 0;
      openedOk = true;
    }
    if (!openedOk) { running = false; return; }
    while (!stopped) {
      // ¿Rotación pedida? Solo se cambia cuando la cola actual está drenada.
      if (pendingNextPath) {
        let size = 0;
        try { size = fs.statSync(currentPath).size; } catch (e) {}
        if (state.offset < size) {
          await deliverRange(state.offset, size, state);
          continue;
        }
        const next = pendingNextPath;
        pendingNextPath = null;
        currentPath = next;
        const okNext = await openAtLatestKeyframe(state);
        if (!okNext) break;
        continue;
      }
      let size = 0;
      try { size = fs.statSync(currentPath).size; } catch (e) { size = state.offset; }
      if (size > state.offset) {
        await deliverRange(state.offset, size, state);
      } else {
        await sleep(POLL_MS);
      }
    }
    running = false;
  }

  function start(onChunk, opts = {}) {
    if (running) return Promise.resolve();
    onChunkCb = onChunk;
    followFromLatest = opts.fromLatestKeyframe !== false;
    stopped = false;
    running = true;
    const state = { offset: 0 };
    reader._state = state;
    // La promesa vive hasta stop(): quien la lanza no la espera.
    loop(state).catch((err) => {
      running = false;
      logger(`Motor PodcastStudio: el lector del archivo maestro se detuvo: ${err.message}`);
    });
    return Promise.resolve();
  }

  function followTo(newFilePath) {
    if (!newFilePath || newFilePath === currentPath) return;
    if (!running) { currentPath = newFilePath; return; }
    pendingNextPath = newFilePath;
  }

  function stop() {
    stopped = true;
  }

  const reader = {
    waitGate,
    start,
    followTo,
    stop,
    get filePath() { return currentPath; },
    get stopped() { return stopped; },
    _state: { offset: 0 },
  };
  return reader;
}

// ----------------------------------------------------------------------------
// validateMasterFile: escaneo completo + sonda con `ffmpeg -i` (equivalente
// a ffprobe) para validar un archivo maestro o de autoprueba.
// ----------------------------------------------------------------------------
function validateMasterFile({ filePath, ffmpegPath, spawnImpl } = {}) {
  return new Promise((resolve) => {
    const spawnFn = typeof spawnImpl === 'function' ? spawnImpl : spawn;
    let fileBuf = null;
    let statSize = 0;
    try {
      statSize = fs.statSync(filePath).size;
      fileBuf = fs.readFileSync(filePath);
    } catch (e) {
      resolve({
        ok: false, codec: null, width: null, height: null, fpsNominal: null,
        fpsMeasured: null, durationSec: 0, videoTags: 0, keyframes: 0,
        bytes: 0, error: `No se pudo leer el archivo maestro: ${e.message}`, stderrTail: '',
      });
      return;
    }
    const scanner = new FlvGateScanner();
    scanner.push(fileBuf);
    const durationSec = (scanner.firstVideoTs !== null && scanner.lastVideoTs !== null && scanner.lastVideoTs > scanner.firstVideoTs)
      ? (scanner.lastVideoTs - scanner.firstVideoTs) / 1000
      : 0;
    const fpsMeasured = (scanner.videoTags > 1 && durationSec > 0)
      ? (scanner.videoTags - 1) / durationSec
      : null;
    const base = {
      codec: null, width: null, height: null, fpsNominal: null,
      fpsMeasured, durationSec, videoTags: scanner.videoTags,
      keyframes: scanner.keyframes.length, bytes: statSize,
    };
    if (!ffmpegPath) {
      const ok = scanner.headerOk && scanner.gotVideoSeq && scanner.keyframes.length >= 1;
      resolve({ ...base, ok, error: ok ? null : 'El archivo no supera la validación FLV (cabecera/secuencia/keyframe).', stderrTail: '' });
      return;
    }
    let proc;
    try {
      proc = spawnFn(ffmpegPath, ['-hide_banner', '-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      resolve({ ...base, ok: false, error: `No se pudo lanzar la sonda de vídeo: ${e.message}`, stderrTail: '' });
      return;
    }
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.once('error', (err) => {
      resolve({ ...base, ok: false, error: `La sonda de vídeo falló: ${err.message}`, stderrTail: stderr.slice(-2000) });
    });
    proc.once('close', () => {
      const videoLine = (stderr.match(/Stream[^\n]*Video:[^\n]*/) || [null])[0];
      let codec = null; let width = null; let height = null; let fpsNominal = null;
      if (videoLine) {
        const cm = videoLine.match(/Video:\s*([A-Za-z0-9_]+)/);
        if (cm) codec = cm[1];
        const dm = videoLine.match(/(\d{2,5})x(\d{2,5})/);
        if (dm) { width = parseInt(dm[1], 10); height = parseInt(dm[2], 10); }
        const fm = videoLine.match(/([\d.]+)\s*fps/);
        if (fm) fpsNominal = parseFloat(fm[1]);
      }
      const ok = scanner.headerOk && scanner.gotVideoSeq && scanner.keyframes.length >= 1 && !!videoLine;
      resolve({
        ...base, codec, width, height, fpsNominal, ok,
        error: ok ? null : 'El archivo no supera la validación (cabecera/secuencia/keyframe o sin stream de vídeo detectable).',
        stderrTail: stderr.slice(-2000),
      });
    });
  });
}

module.exports = {
  GATE_MIN_BYTES,
  FlvGateScanner,
  createMasterFileWriter,
  createMasterFileReader,
  validateMasterFile,
  _scanFileSync: scanFileSync,
  _retimestampRecord: retimestampRecord,
};
