const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const testOutputDir = path.join(__dirname, '..', 'test_output');
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  // Handler para transcodificar chunks de MediaRecorder a MP4 con FFmpeg
  ipcMain.handle('encode-test-mp4', async (event, { name, chunks }) => {
    return new Promise((resolve) => {
      const outputPath = path.join(testOutputDir, `${name}.mp4`);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
      console.log(`[FFmpeg Test] Codificando ${name} (${buffer.length} bytes recibidos)...`);

      const proc = spawn(ffmpegPath, [
        '-y',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        outputPath
      ]);

      proc.stdin.write(buffer);
      proc.stdin.end();

      proc.on('close', (code) => {
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          const size = fs.statSync(outputPath).size;
          console.log(`[FFmpeg Test] OK: ${name}.mp4 generado (${size} bytes)`);
          resolve({ success: true, path: outputPath, size });
        } else {
          resolve({ success: false, error: `FFmpeg exit code ${code}` });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  });

  // Handler para análisis acústico profundo con FFmpeg volumedetect
  ipcMain.handle('analyze-audio-file', async (event, filePath) => {
    return new Promise((resolve) => {
      let stderr = '';
      const proc = spawn(ffmpegPath, [
        '-i', filePath,
        '-af', 'volumedetect',
        '-f', 'null',
        '-'
      ]);

      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', () => {
        const meanMatch = stderr.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
        const maxMatch = stderr.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
        const streamMatch = stderr.match(/Stream #0:1.*Audio:\s*([^\r\n]+)/);
        const videoMatch = stderr.match(/Stream #0:0.*Video:\s*([^\r\n]+)/);

        resolve({
          hasAudio: Boolean(streamMatch),
          audioDetails: streamMatch ? streamMatch[1] : null,
          hasVideo: Boolean(videoMatch),
          videoDetails: videoMatch ? videoMatch[1] : null,
          meanVolume: meanMatch ? parseFloat(meanMatch[1]) : null,
          maxVolume: maxMatch ? parseFloat(maxMatch[1]) : null,
          rawLog: stderr
        });
      });
    });
  });

  // Handler para terminar las pruebas
  ipcMain.on('tests-finished', (event, results) => {
    const reportPath = path.join(testOutputDir, 'forensic-audio-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log('[Test Runner] Resultados guardados en:', reportPath);
    app.quit();
  });

  // Generar HTML ejecutable de prueba
  const testHtml = `
  <!DOCTYPE html>
  <html>
  <body>
    <h1>Forensic Test Runner</h1>
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const { ipcRenderer } = require('electron');

      async function runAllForensicTests() {
        const results = {};
        console.log('[Renderer] Iniciando suite forense Web Audio + Broadcast Composer...');

        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        // Generar un canvas activo animado
        let hue = 0;
        function draw() {
          ctx.fillStyle = 'hsl(' + (hue % 360) + ', 60%, 20%)';
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 60px sans-serif';
          ctx.fillText('FORENSIC P0 TEST BROADCAST CANVAS', 200, 540);
          hue += 5;
          requestAnimationFrame(draw);
        }
        draw();

        const canvasStream = canvas.captureStream(30);
        const videoTrack = canvasStream.getVideoTracks()[0];

        // 1. INICIALIZAR EL GRAFO DE AUDIO IDÉNTICO A masterBroadcastEngine.js
        const audioCtx = new AudioContext({ sampleRate: 48000 });
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const masterSumGain = audioCtx.createGain();
        masterSumGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        const masterLimiterNode = audioCtx.createDynamicsCompressor();
        masterLimiterNode.threshold.setValueAtTime(-1.5, audioCtx.currentTime);
        masterLimiterNode.knee.setValueAtTime(3.0, audioCtx.currentTime);
        masterLimiterNode.ratio.setValueAtTime(20.0, audioCtx.currentTime);
        masterLimiterNode.attack.setValueAtTime(0.002, audioCtx.currentTime);
        masterLimiterNode.release.setValueAtTime(0.05, audioCtx.currentTime);

        const masterOutputGain = audioCtx.createGain();
        masterOutputGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        const audioDestination = audioCtx.createMediaStreamDestination();

        const monitorSumGain = audioCtx.createGain();
        monitorSumGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        const monitorOutputGain = audioCtx.createGain();
        monitorOutputGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        // Conexiones del bus
        masterSumGain.connect(masterOutputGain);
        masterOutputGain.connect(masterLimiterNode);
        masterLimiterNode.connect(audioDestination);

        monitorSumGain.connect(monitorOutputGain);
        monitorOutputGain.connect(audioCtx.destination);

        // Bus BGM
        const bgmGainNode = audioCtx.createGain();
        bgmGainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        const bgmDuckingGain = audioCtx.createGain();
        bgmDuckingGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

        bgmGainNode.connect(bgmDuckingGain);
        bgmDuckingGain.connect(masterSumGain);
        bgmDuckingGain.connect(monitorSumGain);

        // Bus SFX
        const sfxGainNode = audioCtx.createGain();
        sfxGainNode.gain.setValueAtTime(0.9, audioCtx.currentTime);
        sfxGainNode.connect(masterSumGain);
        sfxGainNode.connect(monitorSumGain);

        // Canales de micrófono
        function createChannelStrip(id, label) {
          const trimGain = audioCtx.createGain();
          trimGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
          const faderGain = audioCtx.createGain();
          faderGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
          const muteGain = audioCtx.createGain();
          muteGain.gain.setValueAtTime(1.0, audioCtx.currentTime);
          const soloGain = audioCtx.createGain();
          soloGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

          trimGain.connect(faderGain);
          faderGain.connect(muteGain);
          muteGain.connect(soloGain);
          soloGain.connect(masterSumGain);

          if (id.startsWith('remote_')) {
            soloGain.connect(monitorSumGain);
          }

          return { trimGain, faderGain, muteGain, soloGain };
        }

        const micStrip = createChannelStrip('cam_1', 'Master Mic');

        // Fuentes de audio sintéticas estables para pruebas deterministas
        // Mic = 440 Hz (Nota La)
        const micOsc = audioCtx.createOscillator();
        micOsc.type = 'sine';
        micOsc.frequency.setValueAtTime(440, audioCtx.currentTime);
        const micGain = audioCtx.createGain();
        micGain.gain.setValueAtTime(0.0, audioCtx.currentTime); // apagado por defecto
        micOsc.connect(micGain);
        micGain.connect(micStrip.trimGain);
        micOsc.start();

        // BGM = 1000 Hz (Tono musical)
        const bgmOsc = audioCtx.createOscillator();
        bgmOsc.type = 'sine';
        bgmOsc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        const bgmSourceGain = audioCtx.createGain();
        bgmSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        bgmOsc.connect(bgmSourceGain);
        bgmSourceGain.connect(bgmGainNode);
        bgmOsc.start();

        // SFX = 880 Hz (Efecto de sonido)
        const sfxOsc = audioCtx.createOscillator();
        sfxOsc.type = 'triangle';
        sfxOsc.frequency.setValueAtTime(880, audioCtx.currentTime);
        const sfxSourceGain = audioCtx.createGain();
        sfxSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        sfxOsc.connect(sfxSourceGain);
        sfxSourceGain.connect(sfxGainNode);
        sfxOsc.start();

        // Helper para grabar N milisegundos y mandar al encoder FFmpeg
        async function recordScenario(name, durationMs) {
          const audioTrack = audioDestination.stream.getAudioTracks()[0];
          const stream = new MediaStream([videoTrack, audioTrack]);
          const chunks = [];
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });

          recorder.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0) {
              const ab = await e.data.arrayBuffer();
              chunks.push(new Uint8Array(ab));
            }
          };

          recorder.start(100);
          await new Promise(r => setTimeout(r, durationMs));
          recorder.stop();
          await new Promise(r => setTimeout(r, 200));

          const encodeRes = await ipcRenderer.invoke('encode-test-mp4', { name, chunks });
          if (!encodeRes.success) return { success: false, error: encodeRes.error };

          const analysis = await ipcRenderer.invoke('analyze-audio-file', encodeRes.path);
          return {
            name,
            file: encodeRes.path,
            sizeBytes: encodeRes.size,
            analysis
          };
        }

        // ==========================================
        // PRUEBA A: Micrófono solo -> MASTER -> MP4
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba A: Micrófono solo...');
        micGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        results.testA = await recordScenario('test_A_mic_only', 1500);

        // ==========================================
        // PRUEBA B: Música sola -> MASTER -> MP4
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba B: Música sola...');
        micGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        results.testB = await recordScenario('test_B_music_only', 1500);

        // ==========================================
        // PRUEBA C: SFX solo -> MASTER -> MP4
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba C: SFX solo...');
        micGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        results.testC = await recordScenario('test_C_sfx_only', 1500);

        // ==========================================
        // PRUEBA D: Micrófono + Música -> MASTER -> MP4
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba D: Micrófono + Música...');
        micGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        results.testD = await recordScenario('test_D_mic_plus_music', 1500);

        // ==========================================
        // PRUEBA E: Micrófono + Música + SFX -> MASTER -> MP4
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba E: Micrófono + Música + SFX...');
        micGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        results.testE = await recordScenario('test_E_all_three', 1500);

        // ==========================================
        // PRUEBA F: MUTE en Micrófono
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba F: MUTE...');
        micGain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        sfxSourceGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        micStrip.muteGain.gain.setValueAtTime(0.0, audioCtx.currentTime); // MUTED
        results.testF_mute = await recordScenario('test_F_mic_muted', 1000);
        micStrip.muteGain.gain.setValueAtTime(1.0, audioCtx.currentTime); // un-mute

        // ==========================================
        // PRUEBA G: Brickwall Limiter a señal sobresaturada (+12 dB)
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba G: Limiter anti-clipping...');
        micGain.gain.setValueAtTime(3.0, audioCtx.currentTime); // +10 dB sobrecargado
        bgmSourceGain.gain.setValueAtTime(2.0, audioCtx.currentTime);
        results.testG_limiter = await recordScenario('test_G_brickwall_limiter', 1000);

        // ==========================================
        // PRUEBA H: Auto-Ducking
        // ==========================================
        console.log('[Renderer] Ejecutando Prueba H: Ducking...');
        // Simular ducking: bgmDuckingGain a 0.25 (-12dB)
        micGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        bgmSourceGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        bgmDuckingGain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        results.testH_ducking = await recordScenario('test_H_ducked_bgm', 1000);

        console.log('[Renderer] Suite completada con éxito.');
        ipcRenderer.send('tests-finished', results);
      }

      runAllForensicTests().catch(err => {
        console.error('Error fatal en pruebas:', err);
      });
    </script>
  </body>
  </html>
  `;

  const htmlPath = path.join(testOutputDir, 'runner.html');
  fs.writeFileSync(htmlPath, testHtml, 'utf-8');
  win.loadFile(htmlPath);
});
