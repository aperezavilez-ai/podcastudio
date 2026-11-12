'use strict';
// ============================================================================
// Motor PodcastStudio — núcleo de programa v3 (el disco es la fuente de
// verdad).
//
// v2.0.0 repartía el flujo FLV EN MEMORIA a consumidores FFmpeg
// alimentados por stdin: la grabación se enganchaba a un FFmpeg con
// `-map 0:v:0` (no opcional) contra un tubo aún vacío y moría con EINVAL
// en vivo. La v3 cambia la costura, no el grafo:
//
//   captura → composición → UNA codificación → archivo maestro en disco
//     → los destinos leen del archivo tras superar su compuerta
//     → la grabación son RANGOS de ese archivo y se deriva file→file
//
//   - Modo 'webcodecs' (primario): el renderer codifica el programa UNA
//     vez en H.264 con WebCodecs y este proceso solo MEZCLA
//     (vídeo -c copy, audio → AAC una vez).
//   - Modo 'webm' (respaldo declarado): UNA transcodificación con el
//     codificador de la sonda de sesión (electron/stream-encoder.js),
//     con el bitrate del perfil de programa activo.
//   En ambos modos la salida FLV va al archivo maestro de sesión
//   (electron/master-file.js); ningún consumidor se engancha a un tubo
//   vacío ni vuelve a codificar vídeo salvo el destino cuya salida es
//   menor que el máster, que escala con mapeos SIEMPRE opcionales.
// ============================================================================

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMasterFileWriter, createMasterFileReader, validateMasterFile, FlvGateScanner } = require('./master-file');

const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 40000, 60000];
const QUEUE_CAP_BYTES = 32 * 1024 * 1024;
const STARTUP_TIMEOUT_MS = 20000;
const ROLLING_CAP_BYTES = 6 * 1024 * 1024;
const FRAME_LOG_INTERVAL_MS = 5000;
const DERIVATION_TIMEOUT_MS = 120000;

const DEFAULT_PROFILE = {
  id: '1080p',
  width: 1920,
  height: 1080,
  masterBitrateBps: 10000000,
  streamWidth: 1920,
  streamHeight: 1080,
  streamBitrateBps: 6000000,
};

// ----------------------------------------------------------------------------
// FlvJoinBuffer: permite que un consumidor se una al flujo «tarde» sin
// recibir el historial completo ni un flujo indecodificable. Conserva:
// (a) la cabecera FLV, (b) las etiquetas de secuencia AVC/AAC re-selladas
// al timestamp del último keyframe, y (c) el flujo desde el último
// keyframe. En la v3 la unión real la hace el lector del archivo maestro
// (mismo principio, sobre disco); esta clase se conserva como utilidad
// del núcleo y por compatibilidad con las pruebas de la Parte 1.
// ----------------------------------------------------------------------------
class FlvJoinBuffer {
  constructor() {
    this.pending = Buffer.alloc(0);
    this.headerBytes = null;
    this.seqTags = [];
    this.gotVideoSeq = false;
    this.gotAudioSeq = false;
    this.rolling = null;
    this.rollingParts = [];
    this.rollingBytes = 0;
    this.lastKeyframeTs = 0;
    this.sawKeyframe = false;
  }

  ready() {
    return this.gotVideoSeq && this.sawKeyframe;
  }

  reset() {
    this.pending = Buffer.alloc(0);
    this.headerBytes = null;
    this.seqTags = [];
    this.gotVideoSeq = false;
    this.gotAudioSeq = false;
    this.rollingParts = [];
    this.rollingBytes = 0;
    this.lastKeyframeTs = 0;
    this.sawKeyframe = false;
  }

  push(chunk) {
    if (!chunk || chunk.length === 0) return;
    this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
    this.drain();
  }

  drain() {
    for (;;) {
      if (!this.headerBytes) {
        if (this.pending.length < 13) return;
        if (this.pending.toString('ascii', 0, 3) !== 'FLV') {
          this.pending = Buffer.alloc(0);
          return;
        }
        this.headerBytes = Buffer.from(this.pending.subarray(0, 13));
        this.pending = this.pending.subarray(13);
        continue;
      }
      if (this.pending.length < 11) return;
      const dataSize = this.pending.readUIntBE(1, 3);
      const total = 11 + dataSize + 4;
      if (this.pending.length < total) return;
      const record = Buffer.from(this.pending.subarray(0, total));
      this.pending = this.pending.subarray(total);
      this.onTag(record);
    }
  }

  onTag(record) {
    const type = record[0];
    const ts = (record.readUIntBE(4, 3)) | (record[7] << 24);
    if (type === 9 && record.length > 12) {
      const frameType = record[11] >> 4;
      const codecId = record[11] & 0x0f;
      const packetType = record[12];
      if (codecId === 7 && packetType === 0 && !this.gotVideoSeq) {
        this.gotVideoSeq = true;
        this.seqTags.push(record);
        return;
      }
      if (codecId === 7 && packetType === 1 && frameType === 1) {
        this.sawKeyframe = true;
        this.lastKeyframeTs = ts;
        this.rollingParts = [record];
        this.rollingBytes = record.length;
        return;
      }
    }
    if (type === 8 && record.length > 12) {
      const soundFormat = record[11] >> 4;
      const aacPacketType = record[12];
      if (soundFormat === 10 && aacPacketType === 0 && !this.gotAudioSeq) {
        this.gotAudioSeq = true;
        this.seqTags.push(record);
        return;
      }
    }
    if (this.sawKeyframe) {
      this.rollingParts.push(record);
      this.rollingBytes += record.length;
      if (this.rollingBytes > ROLLING_CAP_BYTES) {
        this.sawKeyframe = false;
        this.rollingParts = [];
        this.rollingBytes = 0;
      }
    }
  }

  retimestamp(record, ts) {
    const out = Buffer.from(record);
    out.writeUIntBE(ts & 0xffffff, 4, 3);
    out[7] = (ts >> 24) & 0xff;
    return out;
  }

  snapshot() {
    if (!this.ready()) return null;
    const parts = [this.headerBytes];
    for (const tag of this.seqTags) parts.push(this.retimestamp(tag, this.lastKeyframeTs));
    for (const part of this.rollingParts) parts.push(part);
    return Buffer.concat(parts);
  }
}

function fmtKbps(bps) {
  return `${Math.max(1, Math.round(Number(bps || 0) / 1000))}k`;
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ----------------------------------------------------------------------------
// createProgramCore(deps) — dueño del grafo: proceso codificador/mezclador
// único que escribe el archivo maestro, lectores por destino y grabación
// por rangos sobre ese archivo.
// deps: {
//   spawnImpl, ffmpegPath,
//   sessionEncoder: { getEncoder(), noteEncoderFailure(enc) },
//   classifyError(text) -> kind,
//   log(line),
//   onDestinationStatus(entry, status, extra),
//   onTelemetry({ fps, bitrate, droppedFrames }),
//   onRecordingStderr(text),
//   onRecordingFailed(message),
//   sessionsDir, selfTestDir,
//   onSelfTestResult(result), onSelfTestFlowNeeded(),
// }
// ----------------------------------------------------------------------------
function createProgramCore(deps) {
  const {
    ffmpegPath,
    onDestinationStatus,
    onTelemetry,
    onRecordingStderr,
    onRecordingFailed,
    onSelfTestResult,
    onSelfTestFlowNeeded,
  } = deps;
  const spawnImpl = typeof deps.spawnImpl === 'function'
    ? deps.spawnImpl
    : require('node:child_process').spawn;
  const log = typeof deps.log === 'function'
    ? deps.log
    : (deps.logger && typeof deps.logger.log === 'function' ? (...a) => deps.logger.log(...a) : () => {});
  const classifyError = typeof deps.classifyError === 'function' ? deps.classifyError : () => 'unknown';
  const sessionEncoder = deps.sessionEncoder && typeof deps.sessionEncoder.getEncoder === 'function'
    ? deps.sessionEncoder
    : { getEncoder: async () => 'libx264', noteEncoderFailure: () => {} };

  const sessionsDir = deps.sessionsDir || path.join(os.tmpdir(), 'podcastudio-v3', 'sessions');
  const selfTestDir = deps.selfTestDir || path.join(os.tmpdir(), 'podcastudio-v3', 'selftest');
  for (const dir of [sessionsDir, selfTestDir]) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }

  let profile = { ...DEFAULT_PROFILE };
  let mode = null; // 'webm' | 'webcodecs'
  let encoderProc = null;
  let encoderLabel = null;
  let encoderStarting = null;
  let encoderStderrRing = [];
  let encoderIntentionalStop = false;
  let encoderLastFrameLogAt = 0;
  let preModeAudioChunks = [];
  const joinBuffer = new FlvJoinBuffer();
  const destinations = new Map(); // id -> entry
  let sessionActive = false;
  let lastTelemetryAt = 0;
  let lastDroppedFrames = 0;

  // --- archivo maestro de sesión -----------------------------------------
  let sessionWriter = null;
  let sessionFilePath = null;
  const sessionWritersByFile = new Map(); // filePath -> writer
  const allSessionFiles = [];
  const protectedFiles = new Set(); // archivos en uso por una derivación en curso

  // --- grabación por rangos ----------------------------------------------
  let recording = null;

  // --- autoprueba ----------------------------------------------------------
  let selfTest = null;
  let lastSelfTestVerdict = null;

  function closeWriterOnce(writer) {
    if (!writer) return Promise.resolve();
    if (!writer.__psClosePromise) {
      writer.__psClosePromise = Promise.resolve(writer.closeSegment()).catch(() => {});
    }
    return writer.__psClosePromise;
  }

  function fileIsReferenced(file) {
    if (!file) return false;
    if (file === sessionFilePath) return true;
    if (protectedFiles.has(file)) return true;
    if (selfTest && selfTest.filePath === file) return true;
    if (recording && recording.ranges.some((r) => r.file === file)) return true;
    for (const entry of destinations.values()) {
      if (entry.readerFile === file) return true;
    }
    return false;
  }

  // Punto 10 del diseño v3: los archivos de sesión sin referencias se
  // borran al arrancar la siguiente sesión y en shutdown (best effort).
  function cleanupUnreferencedSessionFiles() {
    for (const file of [...allSessionFiles]) {
      if (fileIsReferenced(file)) continue;
      try { fs.unlinkSync(file); } catch (e) {}
      const idx = allSessionFiles.indexOf(file);
      if (idx >= 0) allSessionFiles.splice(idx, 1);
      sessionWritersByFile.delete(file);
    }
  }

  function createSessionWriter() {
    let filePath;
    let adoptSelfTest = false;
    if (selfTest && selfTest.active && selfTest.pendingSessionFile && !selfTest.writer) {
      filePath = selfTest.filePath;
      adoptSelfTest = true;
    } else {
      filePath = path.join(sessionsDir, `master-${Date.now()}.flv`);
    }
    cleanupUnreferencedSessionFiles();
    const writer = createMasterFileWriter({ filePath, log });
    sessionWriter = writer;
    sessionFilePath = filePath;
    sessionWritersByFile.set(filePath, writer);
    if (!allSessionFiles.includes(filePath)) allSessionFiles.push(filePath);
    if (adoptSelfTest) {
      selfTest.writer = writer;
      selfTest.isSessionFile = true;
      selfTest.pendingSessionFile = false;
    }
    log(`Núcleo v3: archivo maestro de sesión abierto → ${filePath}`);
    // Los lectores vivos siguen la rotación al archivo nuevo.
    for (const entry of destinations.values()) {
      if (entry.reader && entry.proc && !entry.intentionalStop && entry.readerFile && entry.readerFile !== filePath) {
        try { entry.reader.followTo(filePath); entry.readerFile = filePath; } catch (e) {}
      }
    }
    if (selfTest && selfTest.reader) {
      try { selfTest.reader.followTo(filePath); } catch (e) {}
    }
    // Una grabación pendiente abre su rango en el primer keyframe de
    // este archivo nuevo.
    if (recording && recording.pendingOpen && !recording.openRange) {
      recording.pendingForFile = filePath;
      recording.pendingMode = 'first';
    }
    return writer;
  }

  function detachSessionWriter() {
    const writer = sessionWriter;
    sessionWriter = null;
    sessionFilePath = null;
    if (writer) closeWriterOnce(writer);
    return writer;
  }

  // --- utilidades de escritura con backpressure (patrón v1.5.0) ---------
  function enqueueWrite(consumer, buf) {
    consumer.queuedBytes += buf.length;
    consumer.writeQueue = consumer.writeQueue
      .then(() => writeWithBackpressure(consumer.proc.stdin, buf))
      .then(() => { consumer.queuedBytes -= buf.length; consumer.bytesWritten = (consumer.bytesWritten || 0) + buf.length; })
      .catch((error) => {
        consumer.queuedBytes -= buf.length;
        consumer.writeError = error.message || String(error);
      });
    return consumer.writeQueue;
  }

  function writeWithBackpressure(stream, buf) {
    return new Promise((resolve, reject) => {
      if (!stream || stream.destroyed) { reject(new Error('stdin no disponible')); return; }
      let settled = false;
      const done = (err) => { if (!settled) { settled = true; err ? reject(err) : resolve(); } };
      try {
        const ok = stream.write(buf, (err) => { if (err) done(err); });
        if (ok) done();
        else stream.once('drain', () => done());
      } catch (e) { done(e); }
    });
  }

  // stderr observable (v3): TODAS las líneas de un proceso pasan por
  // log(...) con prefijo identificativo, excepto las de progreso
  // `frame=...`, que se vuelcan como máximo 1 cada 5 s por proceso.
  function logProcessLines(owner, prefix, text) {
    for (const rawLine of String(text).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^frame=/.test(line) || /\bframe=\s*\d+/.test(line) && /fps=/.test(line)) {
        const now = Date.now();
        if (now - (owner._lastFrameLogAt || 0) < FRAME_LOG_INTERVAL_MS) continue;
        owner._lastFrameLogAt = now;
      }
      log(`${prefix}: ${line}`);
    }
  }

  // --- proceso codificador/mezclador único -------------------------------
  function encoderArgs() {
    if (mode === 'webcodecs') {
      return {
        args: [
          '-fflags', '+discardcorrupt+nobuffer',
          '-f', 'h264', '-r', '30', '-i', 'pipe:0',
          '-f', 'webm', '-i', 'pipe:3',
          '-map', '0:v:0', '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
          '-max_interleave_delta', '0',
          '-f', 'flv', 'pipe:1',
        ],
        stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      };
    }
    const threads = 4;
    const { buildStreamEncoderArgs } = require('./stream-encoder');
    const masterRate = fmtKbps(profile.masterBitrateBps);
    return {
      args: [
        '-probesize', '8M',
        '-analyzeduration', '2000000',
        '-fflags', '+discardcorrupt+nobuffer',
        '-f', 'webm', '-i', 'pipe:0',
        ...buildStreamEncoderArgs(encoderLabel, threads),
        '-maxrate', masterRate,
        '-bufsize', masterRate,
        '-pix_fmt', 'yuv420p',
        '-g', '60',
        '-keyint_min', '30',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '160k',
        '-ar', '48000',
        '-ac', '2',
        '-max_interleave_delta', '0',
        '-f', 'flv', 'pipe:1',
      ],
      stdio: ['pipe', 'pipe', 'pipe'],
    };
  }

  async function ensureEncoder() {
    if (encoderProc) return true;
    if (!mode) return false;
    if (encoderStarting) return encoderStarting;
    encoderStarting = (async () => {
      if (mode === 'webm') {
        encoderLabel = await sessionEncoder.getEncoder();
      } else {
        encoderLabel = 'webcodecs-h264';
      }
      const { args, stdio } = encoderArgs();
      encoderStderrRing = [];
      encoderIntentionalStop = false;
      let proc;
      try {
        proc = spawnImpl(ffmpegPath, args, { stdio });
      } catch (e) {
        encoderStarting = null;
        log(`Núcleo v2: no se pudo lanzar el proceso de programa: ${e.message}`);
        return false;
      }
      createSessionWriter();
      encoderProc = proc;
      log(`Núcleo v2: proceso de programa en marcha (modo ${mode}, codificador ${encoderLabel}).`);
      proc.stdout.on('data', (chunk) => fanout(chunk));
      proc.stderr.on('data', (data) => {
        const text = data.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) {
            encoderStderrRing.push(line.trim());
            if (encoderStderrRing.length > 40) encoderStderrRing.shift();
          }
        }
        logProcessLines({ get _lastFrameLogAt() { return encoderLastFrameLogAt; }, set _lastFrameLogAt(v) { encoderLastFrameLogAt = v; } }, 'Núcleo v3: codificador', text);
        parseEncoderTelemetry(text);
      });
      proc.once('error', (err) => {
        if (encoderProc !== proc) return;
        log(`Núcleo v2: error del proceso de programa: ${err.message}`);
      });
      proc.once('close', (code) => {
        if (encoderProc !== proc) return;
        encoderProc = null;
        if (!encoderIntentionalStop) handleEncoderDown(code);
      });
      encoderStarting = null;
      return true;
    })();
    return encoderStarting;
  }

  function parseEncoderTelemetry(text) {
    const frameMatch = text.match(/frame=\s*(\d+)/);
    if (!frameMatch) return;
    const fpsMatch = text.match(/fps=\s*([\d.]+)/);
    const bitrateMatch = text.match(/bitrate=\s*([\d.]+\s*\w+\/s)/);
    const dropMatch = text.match(/drop=\s*(\d+)/);
    if (dropMatch) lastDroppedFrames = parseInt(dropMatch[1], 10);
    const now = Date.now();
    if (fpsMatch && bitrateMatch && now - lastTelemetryAt >= 1000) {
      lastTelemetryAt = now;
      if (onTelemetry) {
        onTelemetry({
          fps: parseFloat(fpsMatch[1]),
          bitrate: bitrateMatch[1],
          droppedFrames: lastDroppedFrames || 0,
        });
      }
    }
  }

  // Cierra el rango abierto de la grabación en el último tag completo de
  // su archivo. Devuelve true si había rango abierto.
  function freezeRecordingRange() {
    if (!recording || !recording.openRange) return false;
    const range = recording.openRange;
    const writer = sessionWritersByFile.get(range.file);
    const end = writer ? writer.lastCompleteTagEnd() : range.startOffset;
    range.endOffset = Math.max(range.startOffset, end);
    recording.openRange = null;
    return true;
  }

  function handleEncoderDown(code) {
    joinBuffer.reset();
    detachSessionWriter();
    const tail = encoderStderrRing.join('\n');
    const kind = classifyError(tail);
    log(`Núcleo v2: el proceso de programa se cerró (código ${code}, tipo ${kind}).`);
    const hadRecording = !!recording;
    if (recording && !recording.failure) {
      // Grabación activa al caer el codificador: el rango se congela y
      // la derivación posterior usa lo que haya en el archivo maestro.
      freezeRecordingRange();
      recording.pendingOpen = false;
      recording.failure = `El proceso de programa se cerró durante la grabación (código ${code}).`;
      if (onRecordingFailed) onRecordingFailed(recording.failure);
    }
    if (!sessionActive && destinations.size === 0 && !hadRecording) return;
    if (mode === 'webm' && kind === 'encoder' && encoderLabel) {
      sessionEncoder.noteEncoderFailure(encoderLabel);
    }
    // Los destinos vivos conservan su proceso: su lector hará followTo
    // al archivo nuevo cuando el grafo renazca. Los caídos o en arranque
    // se re-enganchan con un lector nuevo sobre el archivo vigente.
    for (const entry of destinations.values()) {
      if (entry.intentionalStop) continue;
      if (!(entry.proc && entry.connected)) scheduleDestinationReconnect(entry, true);
    }
    if (destinations.size > 0) ensureEncoder();
  }

  function stopEncoder() {
    joinBuffer.reset();
    detachSessionWriter();
    if (!encoderProc) return;
    encoderIntentionalStop = true;
    const proc = encoderProc;
    encoderProc = null;
    try { proc.stdin?.destroy(); } catch (e) {}
    if (mode === 'webcodecs') { try { proc.stdio[3]?.destroy(); } catch (e) {} }
    try { proc.kill('SIGINT'); } catch (e) {}
  }

  function maybeStopEncoder() {
    if (destinations.size === 0 && !recording) stopEncoder();
  }

  // --- reparto: la salida del codificador va SOLO al disco ---------------
  function fanout(chunk) {
    joinBuffer.push(chunk);
    // La salida del codificador va SOLO al archivo maestro de sesión.
    // (El tee de autoprueba sobre una sesión viva no copia estos chunks
    // tal cual —empezaría a mitad de etiqueta y el temporal no sería un
    // FLV válido—: lee del propio archivo maestro con su lector, que se
    // une en un keyframe con el prefijo re-sellado; ver runSelfTest.)
    if (sessionWriter) {
      try { sessionWriter.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); } catch (e) {}
      if (selfTest && selfTest.active && selfTest.writer === sessionWriter && !selfTest.firstByteAt) {
        selfTest.firstByteAt = Date.now();
      }
    }
    tryOpenRecordingRange();
  }

  // Abre el rango pendiente de la grabación si su keyframe ya existe en
  // el scanner del archivo que le toca.
  function tryOpenRecordingRange() {
    if (!recording || !recording.pendingOpen || recording.openRange || recording.failure) return;
    if (recording.paused) return;
    const file = recording.pendingForFile || sessionFilePath;
    if (!file) return;
    const writer = sessionWritersByFile.get(file);
    if (!writer) return;
    const keyframes = writer.scanner.keyframes;
    if (!keyframes.length) return;
    let kf = null;
    if (recording.pendingMode === 'latest') {
      kf = keyframes[keyframes.length - 1];
    } else if (recording.pendingMode === 'first') {
      kf = keyframes[0];
    } else { // 'next': primer keyframe en o tras el offset marcado
      kf = keyframes.find((k) => k.offset >= (recording.pendingSince || 0)) || null;
      // Si el archivo rotó mientras se esperaba, manda su primer keyframe.
      if (!kf && file !== sessionFilePath) kf = null;
    }
    if (!kf) return;
    const range = { file, startOffset: kf.offset, endOffset: null };
    recording.ranges.push(range);
    recording.openRange = range;
    recording.pendingOpen = false;
  }

  // --- destinos -------------------------------------------------------------
  function destinationIsCopy() {
    return profile.streamWidth === profile.width && profile.streamHeight === profile.height;
  }

  async function destinationArgs(entry) {
    if (destinationIsCopy()) {
      return [
        '-fflags', '+discardcorrupt+nobuffer',
        '-f', 'flv', '-i', 'pipe:0',
        '-c', 'copy',
        '-flvflags', 'no_duration_filesize',
        '-rtmp_buffer', '1000',
        '-rtmp_live', 'live',
        '-rw_timeout', '30000000',
        '-f', 'flv', entry.url,
      ];
    }
    // Salida menor que el máster: escalado con mapeos SIEMPRE opcionales
    // y el codificador de la sesión sondeada.
    const encoder = await sessionEncoder.getEncoder();
    const { buildStreamEncoderArgs } = require('./stream-encoder');
    const outRate = fmtKbps(profile.streamBitrateBps);
    return [
      '-fflags', '+discardcorrupt+nobuffer',
      '-f', 'flv', '-i', 'pipe:0',
      '-map', '0:v:0?',
      '-map', '0:a:0?',
      '-vf', `scale=${profile.streamWidth}:${profile.streamHeight}:flags=bicubic`,
      ...buildStreamEncoderArgs(encoder, 4),
      '-maxrate', outRate,
      '-bufsize', outRate,
      '-c:a', 'copy',
      '-f', 'flv', entry.url,
    ];
  }

  // Fase de compuerta + arranque del proceso de un destino. El FFmpeg
  // del destino SOLO se lanza cuando el lector supera la compuerta del
  // archivo maestro vigente (nunca contra un tubo vacío).
  async function spawnDestination(entry) {
    if (entry.startupTimer) { clearTimeout(entry.startupTimer); entry.startupTimer = null; }
    try { entry.reader?.stop(); } catch (e) {}
    entry.reader = null;
    entry.readerFile = null;
    try { entry.proc?.stdin?.destroy(); entry.proc?.kill('SIGINT'); } catch (e) {}
    entry.connected = false;
    entry.closed = false;
    entry.needsRestart = false;
    entry.writeQueue = Promise.resolve();
    entry.queuedBytes = 0;
    entry.bytesWritten = 0;
    entry.writeError = null;
    entry.stderrRing = [];

    // --- compuerta sobre el archivo de sesión vigente ---
    const gateDeadline = Date.now() + STARTUP_TIMEOUT_MS;
    let gateOk = false;
    while (!entry.intentionalStop && Date.now() < gateDeadline) {
      const file = sessionFilePath;
      if (!file) { await sleepMs(100); continue; }
      if (!entry.reader || entry.readerFile !== file) {
        try { entry.reader?.stop(); } catch (e) {}
        entry.reader = createMasterFileReader({ filePath: file, log });
        entry.readerFile = file;
      }
      const remaining = gateDeadline - Date.now();
      gateOk = await entry.reader.waitGate(Math.min(remaining, 1000));
      if (gateOk) break;
    }
    if (entry.intentionalStop) return { success: false, error: 'Destino detenido antes de conectar.', kind: 'unknown' };
    if (!gateOk) {
      const error = 'Tiempo agotado (20 s) esperando flujo de programa válido en el archivo maestro (compuerta sin superar).';
      return { success: false, error, kind: classifyError(error) };
    }

    const args = await destinationArgs(entry);
    return new Promise((resolveStartup) => {
      let proc;
      try {
        proc = spawnImpl(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
      } catch (error) {
        resolveStartup({ success: false, error: error.message, kind: classifyError(error.message) });
        return;
      }
      entry.proc = proc;
      let startupSettled = false;
      const settle = (result) => {
        if (startupSettled) return;
        startupSettled = true;
        if (entry.startupTimer) { clearTimeout(entry.startupTimer); entry.startupTimer = null; }
        if (!result.success) {
          try { entry.reader?.stop(); } catch (e) {}
          try { proc.kill('SIGINT'); } catch (e) {}
        }
        resolveStartup(result);
      };
      proc.stderr.on('data', (data) => {
        if (entry.proc !== proc) return;
        const message = data.toString();
        for (const line of message.split(/\r?\n/)) {
          if (line.trim()) {
            entry.stderrRing.push(line.trim());
            if (entry.stderrRing.length > 40) entry.stderrRing.shift();
          }
        }
        logProcessLines(entry, entry.name, message);
        if (!entry.connected) {
          const fatal = message.match(/connection refused|connection timed out|network is unreachable|could not write header|error opening output|server error|authorization failed|access denied|invalid stream key|handshake failed|tls[^\r\n]*(?:error|fail)|failed to resolve|no route to host|input\/output error|permission denied/i);
          if (fatal) {
            settle({ success: false, error: fatal[0], kind: classifyError(message) });
            return;
          }
        }
        const frameMatch = message.match(/(?:frame=\s*\d+|size=\s*[\d.]+\s*(?:kB|KiB|MB|MiB)\s+time=)/);
        if (frameMatch && !entry.connected) {
          entry.connected = true;
          entry.everConnected = true;
          entry.reconnectAttempts = 0;
          log(`${entry.name}: EN VIVO (copia sin recodificar; núcleo ${encoderLabel || mode}).`);
          if (onDestinationStatus) onDestinationStatus(entry, 'live', {});
          settle({ success: true });
        }
      });
      proc.once('error', (error) => {
        if (entry.proc !== proc) return;
        if (!startupSettled) settle({ success: false, error: error.message, kind: classifyError(error.message) });
        else if (entry.connected) handleDestinationDown(entry, `Error del proceso FFmpeg: ${error.message}`);
      });
      proc.once('close', (code) => {
        if (entry.proc !== proc) return;
        entry.closed = true;
        entry.connected = false;
        if (!startupSettled) {
          const tail = entry.stderrRing.slice(-6).join(' | ');
          settle({
            success: false,
            error: `FFmpeg cerró antes de conectar (código ${code ?? 'desconocido'}).${tail ? ` Última salida: ${tail}` : ''}`,
            kind: classifyError(entry.stderrRing.join('\n')),
          });
          return;
        }
        if (entry.everConnected && !entry.intentionalStop) {
          handleDestinationDown(entry, `FFmpeg se cerró (código ${code ?? 'desconocido'}).`);
        }
      });
      entry.startupTimer = setTimeout(() => {
        if (!entry.connected) {
          const tail = entry.stderrRing.slice(-6).join(' | ');
          settle({
            success: false,
            error: `Tiempo agotado (20 s) esperando que el servidor acepte el video.${tail ? ` Última salida: ${tail}` : ''}`,
            kind: classifyError(entry.stderrRing.join('\n')),
          });
          try { proc.kill('SIGINT'); } catch (e) {}
        }
      }, STARTUP_TIMEOUT_MS);
      // El lector alimenta el stdin del destino desde el archivo, con su
      // cola con backpressure y el tope histórico de 32 MB.
      const feed = (chunk) => {
        if (entry.proc !== proc) return Promise.resolve();
        if (entry.queuedBytes > QUEUE_CAP_BYTES) {
          entry.needsRestart = true;
          log(`Núcleo v2: consumidor ${entry.name || 'grabación'} superó la cola de 32 MB; se reinicia.`);
          try { proc.kill('SIGINT'); } catch (e) {}
          return Promise.resolve();
        }
        return enqueueWrite(entry, chunk);
      };
      try { entry.reader.start(feed, { fromLatestKeyframe: true }); } catch (e) {}
    });
  }

  function handleDestinationDown(entry, reason) {
    if (entry.intentionalStop || !sessionActive) return;
    entry.connected = false;
    try { entry.reader?.stop(); } catch (e) {}
    const tail = entry.stderrRing.slice(-8).join('\n');
    const kind = classifyError(`${reason}\n${tail}`);
    log(`${entry.name}: CAÍDO. ${reason}`);
    if (onDestinationStatus) {
      onDestinationStatus(entry, 'down', { error: reason, stderrTail: tail || undefined, kind });
    }
    scheduleDestinationReconnect(entry, false);
  }

  function scheduleDestinationReconnect(entry, immediate) {
    if (entry.intentionalStop || !sessionActive) return;
    if (entry.reconnectTimer) return;
    if (!immediate && entry.reconnectAttempts >= RECONNECT_DELAYS_MS.length) {
      log(`${entry.name}: reconexión agotada (5 intentos). Queda marcado como fallido.`);
      if (onDestinationStatus) {
        onDestinationStatus(entry, 'failed', { error: 'Reconexión agotada tras 5 intentos.', kind: 'network' });
      }
      return;
    }
    const delay = immediate ? 250 : RECONNECT_DELAYS_MS[entry.reconnectAttempts];
    if (!immediate) entry.reconnectAttempts += 1;
    if (onDestinationStatus) onDestinationStatus(entry, 'reconnecting', { nextRetryMs: delay });
    entry.reconnectTimer = setTimeout(async () => {
      entry.reconnectTimer = null;
      if (entry.intentionalStop || !sessionActive) return;
      await ensureEncoder();
      const result = await spawnDestination(entry);
      if (!result.success && !entry.intentionalStop && sessionActive) {
        handleDestinationDown(entry, result.error || 'La reconexión no logró conectar.');
      }
    }, delay);
  }

  async function addDestination(target) {
    await ensureEncoder();
    const entry = {
      id: target.id,
      name: target.name,
      url: target.url,
      target,
      proc: null,
      reader: null,
      readerFile: null,
      connected: false,
      everConnected: false,
      closed: false,
      needsRestart: false,
      writeQueue: Promise.resolve(),
      queuedBytes: 0,
      bytesWritten: 0,
      writeError: null,
      stderrRing: [],
      reconnectAttempts: 0,
      reconnectTimer: null,
      startupTimer: null,
      intentionalStop: false,
      _lastFrameLogAt: 0,
    };
    destinations.set(entry.id, entry);
    const result = await spawnDestination(entry);
    if (!result.success) {
      entry.intentionalStop = true;
      try { entry.reader?.stop(); } catch (e) {}
      try { entry.proc?.stdin?.destroy(); entry.proc?.kill('SIGINT'); } catch (e) {}
      destinations.delete(entry.id);
      return { success: false, error: result.error, kind: result.kind, entry };
    }
    return { success: true, entry };
  }

  function destroyDestination(entry) {
    entry.intentionalStop = true;
    if (entry.reconnectTimer) { clearTimeout(entry.reconnectTimer); entry.reconnectTimer = null; }
    if (entry.startupTimer) { clearTimeout(entry.startupTimer); entry.startupTimer = null; }
    try { entry.reader?.stop(); } catch (e) {}
    try { entry.proc?.stdin?.destroy(); entry.proc?.kill('SIGINT'); } catch (e) {}
  }

  async function removeAllDestinations() {
    const entries = [...destinations.values()];
    destinations.clear();
    await Promise.all(entries.map(async (entry) => {
      destroyDestination(entry);
      try {
        await entry.writeQueue;
        if (entry.proc?.stdin && !entry.proc.stdin.destroyed) entry.proc.stdin.end();
      } catch (e) {}
    }));
    maybeStopEncoder();
  }

  // --- grabación = rangos del archivo maestro ------------------------------
  // No hay ningún FFmpeg de grabación en vivo: designar la grabación es
  // abrir rangos [inicio, fin) sobre el archivo maestro, y detenerla es
  // materializar esos rangos en segmentos y derivar el MP4 file→file.
  async function attachRecording({ partialPath }) {
    if (recording) return { success: false, error: 'Ya hay una grabación en curso en el núcleo.' };
    await ensureEncoder();
    recording = {
      name: 'grabación',
      partialPath,
      ranges: [],
      openRange: null,
      pendingOpen: true,
      pendingForFile: null,
      pendingMode: 'next',
      pendingSince: 0,
      paused: false,
      failure: null,
      writeError: null,
      closed: false,
      segmentsDir: null,
    };
    if (sessionWriter && sessionFilePath) {
      const keyframes = sessionWriter.scanner.keyframes;
      if (keyframes.length) {
        // Rango en el último keyframe conocido de la sesión en curso.
        const kf = keyframes[keyframes.length - 1];
        const range = { file: sessionFilePath, startOffset: kf.offset, endOffset: null };
        recording.ranges.push(range);
        recording.openRange = range;
        recording.pendingOpen = false;
      } else {
        recording.pendingForFile = sessionFilePath;
        recording.pendingMode = 'next';
        recording.pendingSince = sessionWriter.scanner.lastTagEndOffset;
      }
    }
    // Sin writer todavía: pendingForFile queda null y el rango abrirá en
    // el primer keyframe del próximo archivo de sesión.
    log(`Núcleo v3: grabación designada como rangos del archivo maestro → ${partialPath}`);
    return { success: true };
  }

  function setRecordingPaused(paused) {
    if (!recording) return;
    if (paused) {
      freezeRecordingRange();
      recording.paused = true;
      recording.pendingOpen = false;
    } else {
      recording.paused = false;
      if (!recording.failure) {
        recording.pendingOpen = true;
        recording.pendingMode = 'next';
        recording.pendingForFile = sessionFilePath;
        const writer = sessionFilePath ? sessionWritersByFile.get(sessionFilePath) : null;
        recording.pendingSince = writer ? writer.scanner.lastTagEndOffset : 0;
        tryOpenRecordingRange();
      }
    }
  }

  function recordingBytesWritten(rec) {
    let total = 0;
    for (const range of rec.ranges) {
      if (range.endOffset !== null && range.endOffset !== undefined) {
        total += Math.max(0, range.endOffset - range.startOffset);
      } else {
        const writer = sessionWritersByFile.get(range.file);
        const upto = writer ? writer.bytesWritten() : range.startOffset;
        total += Math.max(0, upto - range.startOffset);
      }
    }
    return total;
  }

  function getRecordingState() {
    if (!recording) return null;
    return {
      bytesWritten: recordingBytesWritten(recording),
      failure: recording.failure,
      writeError: recording.writeError,
      closed: recording.closed,
    };
  }

  // Materializa un rango en un segmento FLV temporal: prefijo (cabecera
  // + secuencias re-selladas al timestamp del primer keyframe del rango)
  // + bytes del archivo maestro en [startOffset, endOffset).
  function writeSegmentFile(range, segmentPath) {
    return new Promise((resolve, reject) => {
      const writer = sessionWritersByFile.get(range.file);
      let scanner = writer ? writer.scanner : null;
      if (!scanner) {
        scanner = new FlvGateScanner();
        try { scanner.push(fs.readFileSync(range.file)); } catch (e) { reject(e); return; }
      }
      const kf = scanner.keyframes.find((k) => k.offset === range.startOffset) || scanner.keyframes.find((k) => k.offset >= range.startOffset);
      if (!kf) { reject(new Error('El rango de grabación no empieza en un keyframe conocido.')); return; }
      const prefix = scanner.buildPrefix(kf.ts);
      const out = fs.createWriteStream(segmentPath, { flags: 'w' });
      out.on('error', reject);
      out.write(prefix, () => {
        const src = fs.createReadStream(range.file, { start: range.startOffset, end: range.endOffset - 1 });
        src.on('error', reject);
        src.on('end', () => out.end(() => resolve()));
        src.pipe(out, { end: false });
      });
    });
  }

  // Derivación file→file con UN FFmpeg: copia al MP4 parcial y, en el
  // MISMO proceso, la verificación de negro muestreada como segunda
  // salida (la disciplina de la pasada única, ahora sobre archivos).
  function runDerivation(inputArgs, partialPath) {
    return new Promise((resolve) => {
      const args = [
        ...inputArgs,
        '-map', '0:v:0',
        '-map', '0:a?',
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y', partialPath,
        '-map', '0:v:0',
        '-vf', 'fps=2,blackdetect=d=0.5:pix_th=0.10',
        '-an',
        '-f', 'null',
        '-',
      ];
      let proc;
      try {
        proc = spawnImpl(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch (e) {
        resolve({ code: -1, error: e.message });
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { proc.kill('SIGKILL'); } catch (e) {}
        resolve({ code: -1, timedOut: true, error: 'La derivación de la grabación superó los 120 s permitidos.' });
      }, DERIVATION_TIMEOUT_MS);
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };
      proc.stderr.on('data', (data) => {
        const text = data.toString();
        if (onRecordingStderr) onRecordingStderr(text);
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) log(`Grabación: ${line.trim()}`);
        }
      });
      proc.once('error', (err) => finish({ code: -1, error: err.message }));
      proc.once('close', (code) => finish({ code: code ?? -1 }));
    });
  }

  async function stopRecording() {
    if (!recording) return { code: null, error: 'No hay grabación en el núcleo.' };
    const rec = recording;
    recording = null;
    // Se cierra el rango abierto de `rec` explícitamente en su archivo.
    if (rec.openRange) {
      const writer = sessionWritersByFile.get(rec.openRange.file);
      const end = writer ? writer.lastCompleteTagEnd() : rec.openRange.startOffset;
      rec.openRange.endOffset = Math.max(rec.openRange.startOffset, end);
      rec.openRange = null;
    }
    rec.closed = true;
    const finish = (result) => {
      for (const range of rec.ranges) protectedFiles.delete(range.file);
      if (rec.segmentsDir) { try { fs.rmSync(rec.segmentsDir, { recursive: true, force: true }); } catch (e) {} }
      maybeStopEncoder();
      return result;
    };
    const usableRanges = rec.ranges.filter((r) => (r.endOffset ?? 0) > r.startOffset);
    if (!usableRanges.length) {
      return finish({ code: -1, error: rec.failure || 'La grabación no capturó ningún rango completo del archivo maestro.' });
    }
    // Los archivos de los rangos quedan protegidos durante la derivación
    // y sus bytes deben estar en disco antes de copiar cada rango.
    for (const range of usableRanges) {
      protectedFiles.add(range.file);
      const writer = sessionWritersByFile.get(range.file);
      if (writer) { try { await writer.flush(); } catch (e) {} }
    }
    const epoch = Date.now();
    const segmentsDir = path.join(sessionsDir, `segments-${epoch}`);
    rec.segmentsDir = segmentsDir;
    try { fs.mkdirSync(segmentsDir, { recursive: true }); } catch (e) {}
    const segmentPaths = [];
    try {
      for (let i = 0; i < usableRanges.length; i += 1) {
        const segmentPath = path.join(segmentsDir, `seg-${i}.flv`);
        await writeSegmentFile(usableRanges[i], segmentPath);
        segmentPaths.push(segmentPath);
      }
    } catch (e) {
      return finish({ code: -1, error: `No se pudieron materializar los rangos de la grabación: ${e.message}` });
    }
    let inputArgs;
    if (segmentPaths.length === 1) {
      inputArgs = ['-fflags', '+discardcorrupt+nobuffer', '-i', segmentPaths[0]];
    } else {
      const listPath = path.join(segmentsDir, 'lista.txt');
      const listBody = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
      try { fs.writeFileSync(listPath, listBody, 'utf8'); } catch (e) {
        return finish({ code: -1, error: `No se pudo escribir la lista de concatenación: ${e.message}` });
      }
      inputArgs = ['-fflags', '+discardcorrupt+nobuffer', '-f', 'concat', '-safe', '0', '-i', listPath];
    }
    log(`Núcleo v3: derivación de la grabación desde ${segmentPaths.length} segmento(s) del archivo maestro → ${rec.partialPath}`);
    const result = await runDerivation(inputArgs, rec.partialPath);
    return finish(result);
  }

  function detachRecording() {
    if (!recording) return;
    const rec = recording;
    recording = null;
    if (rec.segmentsDir) { try { fs.rmSync(rec.segmentsDir, { recursive: true, force: true }); } catch (e) {} }
    maybeStopEncoder();
  }

  // --- perfil de programa ---------------------------------------------------
  function setProgramProfile(next) {
    if (!next || typeof next !== 'object') return { ...profile };
    const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);
    profile = {
      id: typeof next.id === 'string' && next.id ? next.id : profile.id,
      width: num(next.width, profile.width),
      height: num(next.height, profile.height),
      masterBitrateBps: num(next.masterBitrateBps, profile.masterBitrateBps),
      streamWidth: num(next.streamWidth, profile.streamWidth),
      streamHeight: num(next.streamHeight, profile.streamHeight),
      streamBitrateBps: num(next.streamBitrateBps, profile.streamBitrateBps),
    };
    log(`Núcleo v3: perfil de programa activo: ${profile.id} (máster ${profile.width}x${profile.height} a ${fmtKbps(profile.masterBitrateBps)}, salida ${profile.streamWidth}x${profile.streamHeight} a ${fmtKbps(profile.streamBitrateBps)}).`);
    return { ...profile };
  }

  // --- autoprueba del Motor PodcastStudio -----------------------------------
  async function runSelfTest({ durationMs = 3000 } = {}) {
    if (selfTest && selfTest.active && selfTest.promise) return selfTest.promise;
    const run = (async () => {
      const startedAt = Date.now();
      const st = {
        active: true,
        startedAt,
        firstByteAt: null,
        flowNeededCalled: false,
        writer: null,
        filePath: path.join(selfTestDir, `selftest-${startedAt}.flv`),
        isSessionFile: false,
        pendingSessionFile: false,
        promise: null,
      };
      selfTest = st;
      if (sessionWriter) {
        // Sesión en curso: el archivo temporal es un tee byte-exacto del
        // tramo del archivo maestro que cubre la prueba, leído con el
        // lector de la casa (unión en keyframe con prefijo re-sellado).
        st.writer = createMasterFileWriter({ filePath: st.filePath, log });
        st.reader = createMasterFileReader({ filePath: sessionFilePath, log });
        st.reader.start((chunk) => st.writer.write(chunk), { fromLatestKeyframe: true });
      } else {
        // Sin sesión: el temporal SERÁ el archivo de la próxima sesión
        // mientras dure la prueba.
        st.pendingSessionFile = true;
      }
      log('Núcleo v3: autoprueba del Motor PodcastStudio en marcha.');
      let timedOutNoFlow = false;
      for (;;) {
        const bytes = st.writer ? st.writer.bytesWritten() : 0;
        if (bytes > 0 && !st.firstByteAt) st.firstByteAt = Date.now();
        if (st.firstByteAt && Date.now() - st.firstByteAt >= durationMs) break;
        if (!st.firstByteAt && Date.now() - startedAt >= 1500 && !st.flowNeededCalled && !encoderProc) {
          st.flowNeededCalled = true;
          log('Núcleo v3: autoprueba sin flujo a los 1,5 s; se pide al renderer que arranque el flujo.');
          if (onSelfTestFlowNeeded) { try { onSelfTestFlowNeeded(); } catch (e) {} }
        }
        if (!st.firstByteAt && Date.now() - startedAt >= 15000) { timedOutNoFlow = true; break; }
        if (st.firstByteAt && Date.now() - startedAt >= 15000 + durationMs) break;
        await sleepMs(100);
      }
      const hadFlow = !!st.firstByteAt;
      // Cierre del temporal con fsync antes de validar.
      if (st.reader) { try { st.reader.stop(); } catch (e) {} }
      if (st.isSessionFile) {
        // El temporal ES el archivo de sesión: se detiene el codificador
        // si nada más lo usa y el archivo queda para validar.
        if (destinations.size === 0 && !recording) stopEncoder();
        if (st.writer) await closeWriterOnce(st.writer);
      } else if (st.writer) {
        await closeWriterOnce(st.writer);
      }
      st.active = false;
      let verdict;
      if (!hadFlow || !fs.existsSync(st.filePath)) {
        verdict = {
          ok: false, codec: null, width: null, height: null, fpsNominal: null,
          fpsMeasured: null, durationSec: 0, videoTags: 0, keyframes: 0, bytes: 0,
          error: 'sin flujo del renderer: no llegó ningún byte del flujo de programa durante la autoprueba.',
          stderrTail: '',
        };
      } else {
        verdict = await validateMasterFile({ filePath: st.filePath, ffmpegPath, spawnImpl });
        if (timedOutNoFlow) verdict = { ...verdict, ok: false, error: verdict.error || 'sin flujo del renderer' };
      }
      verdict = {
        ...verdict,
        mode,
        encoderLabel,
        file: st.filePath,
        at: new Date().toISOString(),
      };
      lastSelfTestVerdict = verdict;
      selfTest = null;
      log(`Núcleo v3: autoprueba terminada: ${verdict.ok ? 'OK' : 'FALLO'} (${verdict.codec || 'sin códec'}, ${verdict.width || '?'}x${verdict.height || '?'}, ${verdict.bytes} bytes).`);
      if (onSelfTestResult) { try { onSelfTestResult(verdict); } catch (e) {} }
      return verdict;
    })();
    if (selfTest) selfTest.promise = run;
    return run;
  }

  function getSelfTestState() {
    return lastSelfTestVerdict;
  }

  // --- entradas del flujo -----------------------------------------------------
  function setSessionActive(active) {
    sessionActive = !!active;
  }

  const intakeQueues = new Map(); // proc -> {queue, queued}
  function writeIntake(proc, buf, fdIndex = 0) {
    if (!proc) return;
    const stream = fdIndex === 3 ? proc.stdio[3] : proc.stdin;
    if (!stream || stream.destroyed) return;
    let slot = intakeQueues.get(proc);
    if (!slot) { slot = { queue: Promise.resolve() }; intakeQueues.set(proc, slot); }
    slot.queue = slot.queue
      .then(() => writeWithBackpressure(stream, buf))
      .catch(() => {});
  }

  function writeVideoChunk(buf) {
    if (!buf || buf.length === 0) return;
    if (mode === 'webm') {
      log('Núcleo v2: cambio de modo webm → webcodecs; el grafo se reinicia.');
      stopEncoder();
      mode = 'webcodecs';
    }
    if (!mode) {
      mode = 'webcodecs';
      if (preModeAudioChunks.length) {
        const pending = preModeAudioChunks;
        preModeAudioChunks = [];
        ensureEncoder().then(() => pending.forEach((b) => writeAudioChunk(b)));
      }
    }
    if (mode !== 'webcodecs') return;
    ensureEncoder().then((ok) => { if (ok && encoderProc) writeIntake(encoderProc, buf, 0); });
  }

  function writeAudioChunk(buf) {
    if (!buf || buf.length === 0) return;
    if (!mode) {
      if (preModeAudioChunks.length < 64) preModeAudioChunks.push(buf);
      return;
    }
    if (mode !== 'webcodecs') return;
    ensureEncoder().then((ok) => { if (ok && encoderProc) writeIntake(encoderProc, buf, 3); });
  }

  function writeWebm(buf) {
    if (!buf || buf.length === 0) return;
    if (mode === 'webcodecs') {
      log('Núcleo v2: cambio de modo webcodecs → webm; el grafo se reinicia.');
      stopEncoder();
      mode = 'webm';
    }
    if (!mode) mode = 'webm';
    ensureEncoder().then((ok) => { if (ok && encoderProc) writeIntake(encoderProc, buf, 0); });
  }

  // Espera a que el writer de sesión actual supere la compuerta del
  // archivo maestro (sondeo de 100 ms).
  function waitForFlow(timeoutMs = 4000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (sessionWriter && sessionWriter.gatePassed()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
      }, 100);
      if (sessionWriter && sessionWriter.gatePassed()) { clearInterval(timer); resolve(true); }
    });
  }

  function getState() {
    return {
      mode,
      encoderLabel,
      destinations: destinations.size,
      recording: !!recording,
      flowReady: sessionWriter ? sessionWriter.gatePassed() : joinBuffer.ready(),
      sessionFile: sessionFilePath,
      programProfile: { ...profile },
      selfTest: lastSelfTestVerdict,
    };
  }

  function shutdown() {
    sessionActive = false;
    for (const entry of destinations.values()) destroyDestination(entry);
    destinations.clear();
    detachRecording();
    if (selfTest && selfTest.writer && !selfTest.isSessionFile) closeWriterOnce(selfTest.writer);
    selfTest = null;
    stopEncoder();
    mode = null;
    // Borrado best effort de los archivos de sesión ya sin referencias
    // (el de la sesión que se cierra se libera al vaciar su cola).
    const closing = sessionWritersByFile.get(sessionFilePath);
    setTimeout(() => cleanupUnreferencedSessionFiles(), 250);
    void closing;
  }

  return {
    writeWebmChunk: writeWebm,
    writeVideoChunk,
    writeAudioChunk,
    waitForFlow,
    setSessionActive,
    addDestination,
    removeAllDestinations,
    attachRecording,
    setRecordingPaused,
    getRecordingState,
    stopRecording,
    detachRecording,
    maybeStopEncoder,
    setProgramProfile,
    runSelfTest,
    getSelfTestState,
    getState,
    shutdown,
  };
}

module.exports = { createProgramCore, FlvJoinBuffer };
