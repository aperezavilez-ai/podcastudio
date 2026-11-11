'use strict';
// ============================================================================
// NÚCLEO EN VIVO v2.0.0 — grafo único de programa (Raíz A, reemplazo).
//
// Antes (v1.6.x): el canvas se codificaba en el renderer con MediaRecorder
// (VP8), OTRA vez con un segundo MediaRecorder dedicado para grabar, y
// cada destino de streaming y la grabación transcodificaban ese WebM a
// H.264 con libx264 en procesos separados: hasta CUATRO codificaciones
// por software del mismo programa compitiendo por la misma CPU.
//
// Ahora: captura → composición → UNA codificación → reparto con copia.
//   - Modo 'webcodecs' (primario): el renderer codifica el programa UNA
//     vez en H.264 con WebCodecs (hardware cuando la plataforma lo
//     ofrece) y envía el flujo elemental + el audio mezclado (WebM/Opus).
//     Este proceso solo MEZCLA: vídeo -c copy, audio → AAC una vez.
//   - Modo 'webm' (respaldo declarado): el renderer envía el WebM de
//     siempre y este proceso lo transcodifica UNA vez con el codificador
//     de la sonda de sesión (h264_mf primero; electron/stream-encoder.js).
//   En ambos modos la salida es UN flujo FLV (H.264+AAC) que se reparte
//   con -c copy: un worker por destino RTMPS y un consumidor para la
//   grabación máster. Ningún consumidor vuelve a codificar vídeo.
// ============================================================================

const RECONNECT_DELAYS_MS = [5000, 10000, 20000, 40000, 60000];
const QUEUE_CAP_BYTES = 32 * 1024 * 1024;
const STARTUP_TIMEOUT_MS = 20000;
const ROLLING_CAP_BYTES = 6 * 1024 * 1024;

// ----------------------------------------------------------------------------
// FlvJoinBuffer: permite que un consumidor se una al flujo «tarde» (un
// destino que reconecta, la grabación que arranca durante el vivo) sin
// recibir el historial completo ni un flujo indecodificable.
// Conserva: (a) la cabecera FLV, (b) las etiquetas de secuencia AVC/AAC
// re-selladas al timestamp del último keyframe, y (c) el flujo desde el
// último keyframe. El consumidor recibe (a)+(b)+(c): decodificable desde
// el primer byte y con el reloj empezando en ese keyframe.
// ----------------------------------------------------------------------------
class FlvJoinBuffer {
  constructor() {
    this.pending = Buffer.alloc(0);
    this.headerBytes = null; // 'FLV' + versión/flags + tamaño + PreviousTagSize0
    this.seqTags = []; // registros completos (cabecera de etiqueta + datos + prevTagSize)
    this.gotVideoSeq = false;
    this.gotAudioSeq = false;
    this.rolling = null; // Buffer desde el inicio del último tag keyframe
    this.rollingParts = [];
    this.rollingBytes = 0;
    this.lastKeyframeTs = 0;
    this.sawKeyframe = false;
  }

  ready() {
    return this.gotVideoSeq && this.sawKeyframe;
  }

  // El grafo renace (nuevo proceso de programa): la unión anterior ya no
  // describe este flujo (los relojes vuelven a cero) y se descarta.
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
          // Flujo corrupto: no hay unión posible; se descarta lo recibido.
          this.pending = Buffer.alloc(0);
          return;
        }
        this.headerBytes = Buffer.from(this.pending.subarray(0, 13));
        this.pending = this.pending.subarray(13);
        continue;
      }
      if (this.pending.length < 11) return;
      // FLV: byte 0 = tipo, bytes 1-3 = tamaño de datos (el timestamp va
      // en 4-7; leer el tamaño desde 4 desalinea todo el flujo).
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
        // Keyframe: el flujo de unión rueda desde aquí.
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
        // Sin keyframe nuevo en 6 MB: se suelta el rodante hasta el
        // próximo keyframe (la unión espera en vez de crecer sin fin).
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

  // Bytes con los que un consumidor nuevo se une AHORA, o null si el
  // flujo aún no tiene secuencia de vídeo + keyframe.
  snapshot() {
    if (!this.ready()) return null;
    const parts = [this.headerBytes];
    for (const tag of this.seqTags) parts.push(this.retimestamp(tag, this.lastKeyframeTs));
    for (const part of this.rollingParts) parts.push(part);
    return Buffer.concat(parts);
  }
}

// ----------------------------------------------------------------------------
// createProgramCore(deps) — dueño del grafo: proceso codificador/mezclador
// único, buffer de unión y consumidores con copia (destinos + grabación).
// deps: {
//   spawnImpl, ffmpegPath,
//   sessionEncoder: { getEncoder(), noteEncoderFailure(enc) },
//   classifyError(text) -> kind,
//   log(line),
//   onDestinationStatus(entry, status, extra),
//   onTelemetry({ fps, bitrate, droppedFrames }),
//   onRecordingStderr(text),
//   onRecordingFailed(message),
// }
// ----------------------------------------------------------------------------
function createProgramCore(deps) {
  const {
    ffmpegPath,
    sessionEncoder,
    classifyError,
    onDestinationStatus,
    onTelemetry,
    onRecordingStderr,
    onRecordingFailed,
  } = deps;
  // Valores por defecto defensivos: el contrato preferido es spawnImpl +
  // log (así los pasa main.js), pero el núcleo no debe romperse si quien
  // lo instancia (una prueba, otro anfitrión) ofrece logger en su lugar.
  const spawnImpl = typeof deps.spawnImpl === 'function'
    ? deps.spawnImpl
    : require('node:child_process').spawn;
  const log = typeof deps.log === 'function'
    ? deps.log
    : (deps.logger && typeof deps.logger.log === 'function' ? (...a) => deps.logger.log(...a) : () => {});

  let mode = null; // 'webm' | 'webcodecs'
  let encoderProc = null;
  let encoderLabel = null;
  let encoderStarting = null;
  let encoderStderrRing = [];
  let encoderIntentionalStop = false;
  let preModeAudioChunks = [];
  const joinBuffer = new FlvJoinBuffer();
  const destinations = new Map(); // id -> entry
  let recording = null; // { proc, partialPath, paused, bytesWritten, writeQueue, queuedBytes, stderrRing, intentionalStop, closed, failure }
  let lastTelemetryAt = 0;
  let lastDroppedFrames = 0;
  let sessionActive = false;

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
    return {
      args: [
        '-probesize', '8M',
        '-analyzeduration', '2000000',
        '-fflags', '+discardcorrupt+nobuffer',
        '-f', 'webm', '-i', 'pipe:0',
        ...buildStreamEncoderArgs(encoderLabel, threads),
        '-maxrate', '5000k',
        '-bufsize', '5000k',
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

  function handleEncoderDown(code) {
    joinBuffer.reset();
    const tail = encoderStderrRing.join('\n');
    const kind = classifyError(tail);
    log(`Núcleo v2: el proceso de programa se cerró (código ${code}, tipo ${kind}).`);
    const hadRecording = !!recording;
    if (hadRecording && recording) {
      recording.failure = recording.failure || `El proceso de programa se cerró durante la grabación (código ${code}).`;
      const failed = recording;
      recording = null;
      try { failed.proc?.stdin?.destroy(); failed.proc?.kill('SIGINT'); } catch (e) {}
      if (onRecordingFailed) onRecordingFailed(failed.failure);
    }
    if (!sessionActive && destinations.size === 0 && !hadRecording) return;
    // Volteo de codificador (solo modo webm): si el arranque/encode murió
    // por el codificador, la sesión aprende el otro y el grafo renace con él.
    if (mode === 'webm' && kind === 'encoder' && encoderLabel) {
      sessionEncoder.noteEncoderFailure(encoderLabel);
    }
    // El grafo renace si queda sesión; los destinos se re-enganchan solos
    // (cada uno respawnea y se une en el siguiente keyframe).
    for (const entry of destinations.values()) {
      if (!entry.intentionalStop) scheduleDestinationReconnect(entry, true);
    }
    if (destinations.size > 0) ensureEncoder();
  }

  function stopEncoder() {
    joinBuffer.reset();
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

  // --- reparto -------------------------------------------------------------
  function fanout(chunk) {
    joinBuffer.push(chunk);
    for (const entry of destinations.values()) {
      if (!entry.proc || entry.needsRestart) continue;
      feedConsumer(entry, chunk);
    }
    if (recording && recording.proc && !recording.paused && !recording.needsRestart) {
      feedConsumer(recording, chunk);
    }
  }

  function feedConsumer(consumer, chunk) {
    if (!consumer.joined) {
      const snap = joinBuffer.snapshot();
      if (!snap) return; // aún no hay keyframe: el consumidor espera en el buffer
      consumer.joined = true;
      enqueueWrite(consumer, snap);
      return;
    }
    if (consumer.queuedBytes > QUEUE_CAP_BYTES) {
      consumer.needsRestart = true;
      log(`Núcleo v2: consumidor ${consumer.name || 'grabación'} superó la cola de 32 MB; se reinicia.`);
      try { consumer.proc?.kill('SIGINT'); } catch (e) {}
      return;
    }
    enqueueWrite(consumer, chunk);
  }

  // --- destinos (workers de copia) ------------------------------------------
  function destinationArgs(entry) {
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

  function spawnDestination(entry) {
    return new Promise((resolveStartup) => {
      if (entry.startupTimer) { clearTimeout(entry.startupTimer); entry.startupTimer = null; }
      try { entry.proc?.stdin?.destroy(); entry.proc?.kill('SIGINT'); } catch (e) {}
      entry.connected = false;
      entry.closed = false;
      entry.joined = false;
      entry.needsRestart = false;
      entry.writeQueue = Promise.resolve();
      entry.queuedBytes = 0;
      entry.bytesWritten = 0;
      entry.stderrRing = [];
      let proc;
      try {
        proc = spawnImpl(ffmpegPath, destinationArgs(entry), { stdio: ['pipe', 'ignore', 'pipe'] });
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
        if (!result.success) { try { proc.kill('SIGINT'); } catch (e) {} }
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
        if (!entry.connected) {
          const fatal = message.match(/connection refused|connection timed out|network is unreachable|could not write header|error opening output|server error|authorization failed|access denied|invalid stream key|handshake failed|tls[^\r\n]*(?:error|fail)|failed to resolve|no route to host|input\/output error|permission denied/i);
          if (fatal) {
            settle({ success: false, error: fatal[0], kind: classifyError(message) });
            return;
          }
        }
        const frameMatch = message.match(/frame=\s*(\d+)/);
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
      // Si el grafo ya fluye, este worker puede unirse desde ya; si no,
      // fanout() lo alimentará cuando llegue el primer keyframe.
      if (joinBuffer.ready()) {
        // Nada que hacer: feedConsumer lo unirá con el próximo chunk.
      }
    });
  }

  function handleDestinationDown(entry, reason) {
    if (entry.intentionalStop || !sessionActive) return;
    entry.connected = false;
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
      connected: false,
      everConnected: false,
      closed: false,
      joined: false,
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
    };
    destinations.set(entry.id, entry);
    const result = await spawnDestination(entry);
    if (!result.success) {
      entry.intentionalStop = true;
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

  // --- grabación (consumidor de copia + blackdetect en la misma pasada) -----
  function recordingArgs(partialPath) {
    return [
      '-fflags', '+discardcorrupt+nobuffer',
      '-f', 'flv', '-i', 'pipe:0',
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', partialPath,
      // Segunda salida del MISMO proceso: detección de negro muestreada
      // (decodifica, no codifica) — misma disciplina que la v1.5.1.
      '-map', '0:v:0',
      '-vf', 'fps=2,blackdetect=d=0.5:pix_th=0.10',
      '-an',
      '-f', 'null',
      '-',
    ];
  }

  async function attachRecording({ partialPath }) {
    if (recording) return { success: false, error: 'Ya hay una grabación en curso en el núcleo.' };
    await ensureEncoder();
    let proc;
    try {
      proc = spawnImpl(ffmpegPath, recordingArgs(partialPath), { stdio: ['pipe', 'ignore', 'pipe'] });
    } catch (e) {
      return { success: false, error: e.message };
    }
    recording = {
      name: 'grabación',
      proc,
      partialPath,
      paused: false,
      joined: false,
      needsRestart: false,
      writeQueue: Promise.resolve(),
      queuedBytes: 0,
      bytesWritten: 0,
      writeError: null,
      stderrRing: [],
      intentionalStop: false,
      closed: false,
      failure: null,
    };
    const attachedRecording = recording;
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      if (onRecordingStderr) onRecordingStderr(text);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) {
          attachedRecording.stderrRing.push(line.trim());
          if (attachedRecording.stderrRing.length > 40) attachedRecording.stderrRing.shift();
        }
      }
    });
    proc.once('error', (err) => {
      if (recording && recording.proc === proc && !recording.intentionalStop) {
        recording.failure = recording.failure || err.message;
      }
    });
    proc.once('close', (code) => {
      if (recording && recording.proc === proc) {
        recording.closed = true;
        recording.closeCode = code;
      }
    });
    log(`Núcleo v2: grabación máster enganchada al flujo (copia sin recodificar) → ${partialPath}`);
    return { success: true };
  }

  function setRecordingPaused(paused) {
    if (recording) recording.paused = !!paused;
  }

  function getRecordingState() {
    if (!recording) return null;
    return {
      bytesWritten: recording.bytesWritten || 0,
      failure: recording.failure,
      writeError: recording.writeError,
      closed: recording.closed,
    };
  }

  // Cierre de la grabación: deja de alimentarla, vacía la cola, cierra
  // stdin y espera el cierre del proceso (con los mismos tiempos que el
  // stop-recording clásico: 60 s y, si no cierra, kill + 5 s).
  function stopRecording() {
    return new Promise((resolve) => {
      if (!recording) { resolve({ code: null, error: 'No hay grabación en el núcleo.' }); return; }
      const rec = recording;
      recording = null;
      rec.intentionalStop = true;
      const finish = (result) => {
        maybeStopEncoder();
        resolve(result);
      };
      (async () => {
        try { await rec.writeQueue; } catch (e) {}
        if (rec.closed) { finish({ code: rec.closeCode ?? 0 }); return; }
        let forced = null;
        const hardTimeout = setTimeout(() => {
          try { rec.proc?.kill('SIGKILL'); } catch (e) {}
          forced = setTimeout(() => finish({ code: rec.closeCode ?? -1, timedOut: true, error: 'FFmpeg no cerró el archivo de grabación dentro del tiempo permitido.' }), 5000);
        }, 60000);
        rec.proc.once('close', (code) => {
          clearTimeout(hardTimeout);
          if (forced) clearTimeout(forced);
          finish({ code: code ?? rec.closeCode ?? 0 });
        });
        try {
          if (rec.proc?.stdin && !rec.proc.stdin.destroyed) rec.proc.stdin.end();
        } catch (e) {}
      })();
    });
  }

  function detachRecording() {
    if (!recording) return;
    const rec = recording;
    recording = null;
    rec.intentionalStop = true;
    try { rec.proc?.stdin?.destroy(); rec.proc?.kill('SIGINT'); } catch (e) {}
    maybeStopEncoder();
  }

  // --- entradas del flujo -----------------------------------------------------
  function setSessionActive(active) {
    sessionActive = !!active;
  }

  // Escritura directa a la entrada del proceso de programa, con su propia
  // cola (las entradas no pasan por el reparto: van ANTES de él).
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
      // Simétrico al cambio webcodecs → webm: un chunk H.264 significa
      // que el renderer está en modo WebCodecs; el grafo se reinicia.
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

  // Sustituye la escritura webm improvisada: la entrada webm también usa
  // la cola de intake.
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

  // Espera a que el flujo tenga cabecera + keyframe (unión posible).
  function waitForFlow(timeoutMs = 4000) {
    return new Promise((resolve) => {
      if (joinBuffer.ready()) { resolve(true); return; }
      const started = Date.now();
      const timer = setInterval(() => {
        if (joinBuffer.ready()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(false); }
      }, 100);
    });
  }

  function getState() {
    return {
      mode,
      encoderLabel,
      destinations: destinations.size,
      recording: !!recording,
      flowReady: joinBuffer.ready(),
    };
  }

  function shutdown() {
    sessionActive = false;
    for (const entry of destinations.values()) destroyDestination(entry);
    destinations.clear();
    detachRecording();
    stopEncoder();
    mode = null;
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
    getState,
    shutdown,
  };
}

module.exports = { createProgramCore, FlvJoinBuffer };
