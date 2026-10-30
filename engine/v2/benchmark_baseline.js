/**
 * engine/v2/benchmark_baseline.js
 * 
 * Mide el rendimiento real del hardware en codificación 1080p30:
 * - h264_mf (Windows Media Foundation Hardware Encoder)
 * - h264_qsv (Intel Quick Sync Video)
 * - libx264 (Software CPU - baseline de v1.x)
 * 
 * Evalúa: FPS reales, uso de tiempo de CPU y ratio de velocidad (speed).
 */

import { spawn } from 'child_process';

function runEncoderBenchmark(encoderName, extraArgs = []) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', 'testsrc=duration=5:size=1920x1080:rate=30',
      '-f', 'lavfi',
      '-i', 'sine=frequency=1000:duration=5:sample_rate=48000',
      '-c:v', encoderName,
      '-b:v', '4500k',
      ...extraArgs,
      '-c:a', 'aac',
      '-b:a', '160k',
      '-f', 'null',
      '-'
    ];

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      const elapsedMs = Date.now() - startTime;
      const speedMatch = stderr.match(/speed=\s*([0-9.]+)x/g);
      const lastSpeed = speedMatch ? speedMatch[speedMatch.length - 1] : 'N/A';
      const fpsMatch = stderr.match(/fps=\s*([0-9.]+)/g);
      const lastFps = fpsMatch ? fpsMatch[fpsMatch.length - 1] : 'N/A';

      resolve({
        encoder: encoderName,
        success: code === 0,
        elapsedSeconds: (elapsedMs / 1000).toFixed(2),
        lastFps,
        lastSpeed,
        error: code !== 0 ? stderr.split('\n').slice(-4).join(' ').trim() : null
      });
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log(' PODCASTSTUDIO v2 - BENCHMARK DE HARDWARE ENCODING ');
  console.log(' Target: 1080p @ 30 FPS - Bitrate: 4500 kbps        ');
  console.log('====================================================\n');

  const encoders = [
    { name: 'h264_mf', args: [] },
    { name: 'h264_qsv', args: [] },
    { name: 'libx264', args: ['-preset', 'veryfast'] }
  ];

  for (const item of encoders) {
    process.stdout.write(`Evaluando ${item.name.padEnd(12)}... `);
    const res = await runEncoderBenchmark(item.name, item.args);
    if (res.success) {
      console.log(`✅ OK | Tiempo: ${res.elapsedSeconds}s | ${res.lastFps} | ${res.lastSpeed}`);
    } else {
      console.log(`❌ FALLO (${res.error})`);
    }
  }

  console.log('\nBenchmark finalizado con éxito.');
}

main();
