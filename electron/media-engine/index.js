// Motor de medios nativo v2 — PodcastStudio
// Reemplaza la cadena canvas.captureStream → MediaRecorder → FFmpeg re-encode
// por una sola codificación directa por Hardware:
// frames raw (RGBA 1080p) + audio PCM (s16le 48k stereo) → FFmpeg rawvideo → H.264 (h264_mf/NVENC) → RTMP / MP4
//
// API:
//   engine.start({ destinations, config });
//   engine.writeFrame(buffer);   // RGBA 1920x1080x4 bytes
//   engine.writeAudio(buffer);   // PCM s16le 48kHz estéreo
//   engine.stop();

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

let activeWorkers = [];
let writeError = null;
let isRunning = false;
let currentConfig = null;

function buildArgs(destUrl, cfg) {
  const w = cfg.width || 1920;
  const h = cfg.height || 1080;
  const fps = cfg.fps || 30;
  const vBitrate = cfg.videoBitrate || 4500;
  const vMaxrate = cfg.videoMaxrate || 5000;
  const vBufsize = cfg.videoBufsize || 5000;
  const aBitrate = cfg.audioBitrate || 160;
  const aSr = cfg.audioSampleRate || 48000;
  const aCh = cfg.audioChannels || 2;

  const isWindows = process.platform === 'win32';
  const videoEncoderArgs = isWindows
    ? ['-c:v', 'h264_mf', '-b:v', `${vBitrate}k`]
    : [
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'main',
        '-level', '4.1',
        '-b:v', `${vBitrate}k`,
        '-maxrate', `${vMaxrate}k`,
        '-bufsize', `${vBufsize}k`,
      ];

  return [
    '-thread_queue_size', '512',
    // Entrada 0: Video raw RGBA directo desde Canvas
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${w}x${h}`,
    '-r', String(fps),
    '-i', 'pipe:0',

    '-thread_queue_size', '512',
    // Entrada 1 (FD 3): Audio PCM estéreo 48kHz desde AudioContext
    '-f', 's16le',
    '-ar', String(aSr),
    '-ac', String(aCh),
    '-i', 'pipe:3',

    // Codificación por Hardware H.264
    ...videoEncoderArgs,
    '-pix_fmt', 'yuv420p',
    '-g', String(fps * 2),
    '-keyint_min', String(fps),
    '-r', String(fps),

    // Codificación de Audio AAC
    '-c:a', 'aac',
    '-b:a', `${aBitrate}k`,
    '-ar', String(aSr),
    '-ac', String(aCh),

    // Formato de salida de emisión RTMP / FLV de latencia ultra baja
    '-max_interleave_delta', '0',
    '-flvflags', 'no_duration_filesize',
    '-rtmp_buffer', '200',
    '-rtmp_live', 'live',
    '-rw_timeout', '12000000',
    '-f', 'flv',
    destUrl,
  ];
}

function start(opts = {}) {
  if (isRunning) {
    return { success: false, error: 'El motor nativo ya se encuentra en ejecución.' };
  }
  const destinations = Array.isArray(opts.destinations)
    ? opts.destinations.filter(d => d?.url && d.url.trim())
    : [];

  currentConfig = opts.config || {};
  if (!destinations.length) {
    return { success: false, error: 'No se suministraron destinos válidos con clave de transmisión.' };
  }

  activeWorkers = [];
  writeError = null;

  for (const dest of destinations) {
    const args = buildArgs(dest.url.trim(), currentConfig);
    try {
      // stdio: [stdin (video pipe:0), stdout (ignore), stderr (pipe logs), custom (audio pipe:3)]
      const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe', 'pipe'] });
      
      const worker = {
        name: dest.name || 'Stream',
        url: dest.url,
        proc,
        connected: false
      };

      if (proc.stderr) {
        proc.stderr.on('data', (d) => {
          const msg = d.toString();
          if (msg.includes('frame=') && !worker.connected) {
            worker.connected = true;
          }
          if (currentConfig.debug || msg.includes('Error') || msg.includes('fatal')) {
            console.log(`[NativeEngine - ${worker.name}]:`, msg.trim());
          }
        });
      }

      proc.on('error', (err) => {
        writeError = err.message;
        console.error(`[NativeEngine - ${worker.name}] Error de proceso:`, err);
      });

      proc.on('close', (code) => {
        worker.connected = false;
        activeWorkers = activeWorkers.filter(w => w !== worker);
        if (activeWorkers.length === 0) isRunning = false;
      });

      activeWorkers.push(worker);
    } catch (e) {
      console.error(`[NativeEngine] Fallo al iniciar trabajador para ${dest.name}:`, e);
    }
  }

  if (activeWorkers.length === 0) {
    return { success: false, error: 'No se pudo iniciar ningún subproceso de codificación nativa.' };
  }

  isRunning = true;
  return { success: true, count: activeWorkers.length };
}

function writeFrame(buffer) {
  if (!isRunning || activeWorkers.length === 0 || !buffer) return false;
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    for (const w of activeWorkers) {
      if (w.proc?.stdin && !w.proc.stdin.destroyed) {
        w.proc.stdin.write(buf);
      }
    }
    return true;
  } catch (e) {
    writeError = e.message;
    return false;
  }
}

function writeAudio(buffer) {
  if (!isRunning || activeWorkers.length === 0 || !buffer) return false;
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    for (const w of activeWorkers) {
      // Audio FD 3
      const audioPipe = w.proc?.stdio?.[3];
      if (audioPipe && !audioPipe.destroyed) {
        audioPipe.write(buf);
      }
    }
    return true;
  } catch (e) {
    writeError = e.message;
    return false;
  }
}

function stop() {
  if (!isRunning && activeWorkers.length === 0) return { success: true };
  for (const w of activeWorkers) {
    try {
      if (w.proc?.stdin && !w.proc.stdin.destroyed) w.proc.stdin.end();
      if (w.proc?.stdio?.[3] && !w.proc.stdio[3].destroyed) w.proc.stdio[3].end();
      w.proc.kill('SIGINT');
    } catch (e) {}
  }
  activeWorkers = [];
  isRunning = false;
  currentConfig = null;
  return { success: true };
}

function getStatus() {
  return {
    running: isRunning,
    workers: activeWorkers.map(w => ({ name: w.name, connected: w.connected })),
    error: writeError
  };
}

module.exports = { start, stop, writeFrame, writeAudio, getStatus };
