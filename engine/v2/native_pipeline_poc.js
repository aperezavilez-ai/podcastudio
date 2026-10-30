/**
 * engine/v2/native_pipeline_poc.js
 * 
 * PODCASTSTUDIO v2 - PRUEBA DE CONCEPTO AISLADA (Fase 2)
 * 
 * Pipeline Nativo con:
 * 1. Generador/Entrada de Test Master 1080p30 (Reloj PTS estricto)
 * 2. Canal de Audio 48 kHz estéreo (Sincronización A/V)
 * 3. Codificación por Hardware Directa vía Media Foundation (h264_mf + aac_mf)
 * 4. Salida Dual Simultánea:
 *    - Grabación Master en disco (MP4 optimizado)
 *    - Transmisión en Vivo RTMP / RTMPS (Facebook / YouTube / Custom)
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class NativePipelineEngine {
  constructor(options = {}) {
    this.rtmpUrl = options.rtmpUrl || null;
    this.recordPath = options.recordPath || path.join(__dirname, 'test_output_master.mp4');
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.fps = options.fps || 30;
    this.videoBitrate = options.videoBitrate || '4500k';
    this.audioBitrate = options.audioBitrate || '160k';
    this.process = null;
    this.stats = {
      fps: 0,
      bitrateKbps: 0,
      speed: '0x',
      frames: 0,
      time: '00:00:00'
    };
  }

  start(durationSeconds = 10) {
    return new Promise((resolve, reject) => {
      console.log('----------------------------------------------------');
      console.log(' INICIANDO PIPELINE MULTIMEDIA NATIVO v2           ');
      console.log(` Target: ${this.width}x${this.height} @ ${this.fps} FPS`);
      console.log(` Hardware Video Encoder: h264_mf (Media Foundation) `);
      console.log(` Hardware Audio Encoder: aac_mf (Media Foundation)  `);
      console.log(` Salida Disco: ${this.recordPath}`);
      if (this.rtmpUrl) console.log(` Salida RTMP: ${this.rtmpUrl}`);
      console.log('----------------------------------------------------\n');

      const args = [
        '-y',
        // 1. Reloj de Video Master Sintético a 30 FPS exactos (Zero-Jitter PTS)
        '-f', 'lavfi',
        '-i', `testsrc=duration=${durationSeconds}:size=${this.width}x${this.height}:rate=${this.fps}`,
        // 2. Reloj de Audio Master 48kHz
        '-f', 'lavfi',
        '-i', `sine=frequency=440:duration=${durationSeconds}:sample_rate=48000`,
        // 3. Parámetros de Codificación Hardware Windows
        '-c:v', 'h264_mf',
        '-b:v', this.videoBitrate,
        '-g', String(this.fps * 2), // Keyframe cada 2 segundos para RTMP / Facebook
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac_mf',
        '-b:a', this.audioBitrate,
        '-ar', '48000',
        '-ac', '2'
      ];

      // Configuración de Muxing Dual (Master Disco + RTMP)
      if (this.rtmpUrl) {
        // En emisión real: tee muxer o dual output
        args.push(
          '-f', 'flv', this.rtmpUrl,
          '-f', 'mp4', '-movflags', '+faststart', this.recordPath
        );
      } else {
        args.push(
          '-f', 'mp4',
          '-movflags', '+faststart',
          this.recordPath
        );
      }

      this.process = spawn('ffmpeg', args);

      this.process.stderr.on('data', (data) => {
        const text = data.toString();
        const fpsMatch = text.match(/fps=\s*([0-9.]+)/);
        const speedMatch = text.match(/speed=\s*([0-9.]+)x/);
        const timeMatch = text.match(/time=\s*([0-9:.]+)/);

        if (fpsMatch) this.stats.fps = parseFloat(fpsMatch[1]);
        if (speedMatch) this.stats.speed = speedMatch[1] + 'x';
        if (timeMatch) this.stats.time = timeMatch[1];

        if (text.includes('frame=')) {
          process.stdout.write(`\r[Native Engine v2] Progreso: ${this.stats.time} | Rendimiento: ${this.stats.fps} FPS | Factor: ${this.stats.speed} `);
        }
      });

      this.process.on('close', (code) => {
        console.log('\n');
        if (code === 0) {
          const fileExists = fs.existsSync(this.recordPath);
          const sizeBytes = fileExists ? fs.statSync(this.recordPath).size : 0;
          console.log(`✅ Pipeline finalizado con éxito (Código ${code}).`);
          console.log(`📦 Archivo grabado generado: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
          resolve({ success: true, sizeBytes, stats: this.stats });
        } else {
          console.error(`❌ El pipeline nativo terminó con error (Código ${code}).`);
          reject(new Error(`Exit code ${code}`));
        }
      });

      this.process.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGINT');
    }
  }
}

// Ejecución directa de prueba si se invoca desde la consola
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const engine = new NativePipelineEngine();
  engine.start(5).catch(console.error);
}
