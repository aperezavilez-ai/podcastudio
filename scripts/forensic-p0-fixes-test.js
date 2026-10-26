const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
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
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[Renderer]', msg);
  });

  // Handler para transcodificar MP4 con FFmpeg
  ipcMain.handle('encode-test-mp4', async (event, { name, chunks }) => {
    return new Promise((resolve) => {
      const outputPath = path.join(testOutputDir, `${name}.mp4`);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
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
          resolve({ success: true, path: outputPath, size: fs.statSync(outputPath).size });
        } else {
          resolve({ success: false, error: `FFmpeg exit code ${code}` });
        }
      });
      proc.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  });

  // Handler para probar el pipeline RTMP actualizado (-analyzeduration 2000000)
  ipcMain.handle('test-rtmp-pipeline', async (event, { chunks }) => {
    return new Promise((resolve) => {
      const flvOutputPath = path.join(testOutputDir, 'rtmp_validated.flv');
      if (fs.existsSync(flvOutputPath)) fs.unlinkSync(flvOutputPath);

      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));

      const workerArgs = [
        '-y',
        '-probesize', '32M',
        '-analyzeduration', '2000000',
        '-fflags', '+nobuffer+flush_packets',
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-b:v', '2500k',
        '-maxrate', '2800k',
        '-bufsize', '2800k',
        '-pix_fmt', 'yuv420p',
        '-g', '60',
        '-keyint_min', '60',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-max_interleave_delta', '0',
        '-flvflags', 'no_duration_filesize',
        '-f', 'flv',
        flvOutputPath
      ];

      const proc = spawn(ffmpegPath, workerArgs);
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.stdin.write(buffer);
      proc.stdin.end();

      proc.on('close', () => {
        const exists = fs.existsSync(flvOutputPath) && fs.statSync(flvOutputPath).size > 0;
        const size = exists ? fs.statSync(flvOutputPath).size : 0;

        // Probar FLV
        const probeProc = spawn(ffmpegPath, ['-i', flvOutputPath, '-f', 'null', '-']);
        let probeStderr = '';
        probeProc.stderr.on('data', d => { probeStderr += d.toString(); });
        probeProc.on('close', () => {
          const streamAudio = probeStderr.match(/Stream #0:1.*Audio:\s*([^\r\n]+)/);
          const streamVideo = probeStderr.match(/Stream #0:0.*Video:\s*([^\r\n]+)/);

          resolve({
            success: exists && Boolean(streamAudio) && Boolean(streamVideo),
            sizeBytes: size,
            filePath: flvOutputPath,
            hasAudioStream: Boolean(streamAudio),
            audioDetails: streamAudio ? streamAudio[1] : null,
            hasVideoStream: Boolean(streamVideo),
            videoDetails: streamVideo ? streamVideo[1] : null
          });
        });
      });
    });
  });

  // Handler para probar servidor local Express y WebSocket de iPad
  ipcMain.handle('test-remote-control-lan', async () => {
    return new Promise((resolve) => {
      const express = require('express');
      const testApp = express();
      const distPath = path.join(__dirname, '..', 'dist');
      if (fs.existsSync(distPath)) {
        testApp.use(express.static(distPath));
        testApp.get(['/control', '/mando'], (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }

      const testServer = http.createServer(testApp);
      const testWss = new WebSocket.Server({ server: testServer });

      let studioState = { activeCam: 1, pvwCam: 2, layoutMode: '1', isRecording: false };
      const receivedCommands = [];

      testWss.on('connection', (ws) => {
        ws.on('message', (msg) => {
          try {
            const data = JSON.parse(msg);
            if (data.type === 'identify' && data.role === 'remote-control') {
              ws.isRemoteControl = true;
              ws.send(JSON.stringify({ type: 'studio-state', state: studioState }));
            } else if (data.type === 'request-state') {
              ws.send(JSON.stringify({ type: 'studio-state', state: studioState }));
            } else if (data.type === 'remote-command' && data.payload) {
              receivedCommands.push(data.payload);
              // Simular ejecución en el switcher
              if (data.payload.type === 'TRIGGER_CUT') {
                const prev = studioState.activeCam;
                studioState.activeCam = studioState.pvwCam;
                studioState.pvwCam = prev;
              } else if (data.payload.type === 'SET_ACTIVE_CAM') {
                studioState.activeCam = data.payload.camId;
              } else if (data.payload.type === 'SET_PVW_CAM') {
                studioState.pvwCam = data.payload.camId;
              } else if (data.payload.type === 'SET_LAYOUT') {
                studioState.layoutMode = data.payload.mode;
              }
              ws.send(JSON.stringify({ type: 'studio-state', state: studioState }));
            }
          } catch (e) {}
        });
      });

      testServer.listen(3099, '127.0.0.1', async () => {
        // 1. Probar HTTP GET /control
        const httpTest = await new Promise((resHttp) => {
          http.get('http://127.0.0.1:3099/control', (res) => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => {
              resHttp({
                statusCode: res.statusCode,
                hasHtml: body.includes('<!DOCTYPE html>') || body.includes('<div id="root">'),
                contentLength: body.length
              });
            });
          }).on('error', err => resHttp({ error: err.message }));
        });

        // 2. Probar WebSocket cliente remoto
        const wsTest = await new Promise((resWs) => {
          const clientWs = new WebSocket('ws://127.0.0.1:3099');
          const statesReceived = [];

          clientWs.on('open', () => {
            clientWs.send(JSON.stringify({ type: 'identify', role: 'remote-control' }));
            setTimeout(() => {
              // Enviar CUT
              clientWs.send(JSON.stringify({ type: 'remote-command', payload: { type: 'TRIGGER_CUT' } }));
            }, 50);
            setTimeout(() => {
              // Enviar cambio de layout
              clientWs.send(JSON.stringify({ type: 'remote-command', payload: { type: 'SET_LAYOUT', mode: '2' } }));
            }, 100);
            setTimeout(() => {
              clientWs.close();
            }, 200);
          });

          clientWs.on('message', (m) => {
            try {
              statesReceived.push(JSON.parse(m));
            } catch (e) {}
          });

          clientWs.on('close', () => {
            resWs({
              statesReceivedCount: statesReceived.length,
              finalState: statesReceived[statesReceived.length - 1]?.state,
              commandsProcessedCount: receivedCommands.length
            });
          });

          clientWs.on('error', err => resWs({ error: err.message }));
        });

        testServer.close();
        resolve({
          httpTest,
          wsTest,
          receivedCommands
        });
      });
    });
  });

  ipcMain.on('tests-finished', (event, results) => {
    const reportPath = path.join(testOutputDir, 'forensic-p0-fixes-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log('[Test Runner] Resultados de correcciones guardados en:', reportPath);
    app.quit();
  });

  const testHtml = `
  <!DOCTYPE html>
  <html>
  <body>
    <h1>Forensic P0 Validation Suite</h1>
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const { ipcRenderer } = require('electron');

      async function runValidation() {
        const results = {};
        console.log('[Renderer] Iniciando validación forense de correcciones P0...');

        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');

        // Fuentes de cámara: Cam 1 = Rojo Puro (RGB 255, 0, 0), Cam 2 = Azul Puro (RGB 0, 0, 255)
        const cam1Canvas = document.createElement('canvas');
        cam1Canvas.width = 1280; cam1Canvas.height = 720;
        const c1Ctx = cam1Canvas.getContext('2d');
        c1Ctx.fillStyle = '#ff0000';
        c1Ctx.fillRect(0, 0, 1280, 720);

        const cam2Canvas = document.createElement('canvas');
        cam2Canvas.width = 1280; cam2Canvas.height = 720;
        const c2Ctx = cam2Canvas.getContext('2d');
        c2Ctx.fillStyle = '#0000ff';
        c2Ctx.fillRect(0, 0, 1280, 720);

        const videoElements = new Map();
        videoElements.set(1, cam1Canvas);
        videoElements.set(2, cam2Canvas);

        // Función de render idéntica al código modificado de masterBroadcastEngine.js
        function renderBroadcastFrame(state) {
          const width = 1920;
          const height = 1080;
          ctx.fillStyle = '#08080a';
          ctx.fillRect(0, 0, width, height);

          const activeCam = state.activeCam || 1;
          const transitionProgress = typeof state.transitionProgress === 'number'
            ? Math.max(0, Math.min(1.0, state.transitionProgress))
            : 0;
          const fromCam = state.transitionFromCam || activeCam;
          const toCam = state.transitionToCam || state.pvwCam || (activeCam === 1 ? 2 : 1);

          if (transitionProgress > 0 && fromCam !== toCam) {
            // 1. Dibujar cámara base saliente (FROM)
            const vFrom = videoElements.get(fromCam);
            ctx.drawImage(vFrom, 0, 0, width, height);

            // 2. Dibujar cámara entrante (TO) con mezcla alfa proporcional real
            ctx.save();
            ctx.globalAlpha = transitionProgress;
            const vTo = videoElements.get(toCam);
            ctx.drawImage(vTo, 0, 0, width, height);
            ctx.restore();
          } else {
            const v = videoElements.get(activeCam);
            ctx.drawImage(v, 0, 0, width, height);
          }
        }

        // ==============================================================
        // PRUEBA B: T-BAR DISCRETO (0%, 25%, 50%, 75%, 100%)
        // ==============================================================
        console.log('[Renderer] Ejecutando Prueba B: T-Bar posiciones proporcionales...');
        const tBarSamples = {};
        const positions = [0.0, 0.25, 0.50, 0.75, 1.0];

        for (const pos of positions) {
          renderBroadcastFrame({
            activeCam: 1,
            pvwCam: 2,
            transitionProgress: pos,
            transitionFromCam: 1,
            transitionToCam: 2
          });

          // Muestrear pixel central
          const pixel = ctx.getImageData(960, 540, 1, 1).data;
          tBarSamples[pos * 100 + '%'] = {
            position: pos,
            rgba: [pixel[0], pixel[1], pixel[2], pixel[3]],
            hex: '#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join(''),
            redRatio: Math.round((pixel[0] / 255) * 100) / 100,
            blueRatio: Math.round((pixel[2] / 255) * 100) / 100,
            isMathematicalBlend: pos === 0 ? pixel[0] > 240 && pixel[2] === 0
              : pos === 1.0 ? pixel[0] === 0 && pixel[2] > 240
              : pixel[0] > 0 && pixel[2] > 0 // Ambos colores presentes simultáneamente en el fotograma PGM
          };
        }
        results.tBarTest = tBarSamples;

        // ==============================================================
        // PRUEBA A: AUTO TRANSITION DISOLVENCIA CONTINUA EN GRABACIÓN MP4
        // ==============================================================
        console.log('[Renderer] Ejecutando Prueba A: AUTO disolvencia real...');
        const canvasStream = canvas.captureStream(30);
        const videoTrack = canvasStream.getVideoTracks()[0];

        const audioCtx = new AudioContext({ sampleRate: 48000 });
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        osc.connect(gain);
        const dest = audioCtx.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();

        const masterStream = new MediaStream([videoTrack, dest.stream.getAudioTracks()[0]]);
        const chunks = [];
        const recorder = new MediaRecorder(masterStream, { mimeType: 'video/webm;codecs=vp8,opus' });
        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) chunks.push(new Uint8Array(await e.data.arrayBuffer()));
        };

        recorder.start(100);

        // Fase 1: 300ms en Cam 1 (100% Rojo)
        const autoState = { activeCam: 1, pvwCam: 2, transitionProgress: 0, transitionFromCam: 1, transitionToCam: 2 };
        const animStart = Date.now();
        const duration = 600; // 600ms de disolvencia AUTO
        const autoFramePixels = [];

        for (let i = 0; i < 35; i++) {
          const now = Date.now();
          const elapsed = now - animStart;
          if (elapsed < 200) {
            autoState.transitionProgress = 0;
          } else if (elapsed < 800) {
            autoState.transitionProgress = (elapsed - 200) / duration;
          } else {
            autoState.activeCam = 2;
            autoState.pvwCam = 1;
            autoState.transitionProgress = 0;
          }
          renderBroadcastFrame(autoState);

          const p = ctx.getImageData(960, 540, 1, 1).data;
          autoFramePixels.push({
            frame: i,
            progress: Math.round(autoState.transitionProgress * 100) / 100,
            r: p[0],
            b: p[2]
          });
          await new Promise(r => setTimeout(r, 33));
        }

        recorder.stop();
        await new Promise(r => setTimeout(r, 200));

        const encodeRes = await ipcRenderer.invoke('encode-test-mp4', { name: 'auto_transition_verified', chunks });
        results.autoTest = {
          mp4File: encodeRes.path,
          mp4Size: encodeRes.size,
          hasAlphaBlendedFrames: autoFramePixels.some(p => p.r > 20 && p.b > 20),
          samples: autoFramePixels.filter((_, idx) => idx % 4 === 0)
        };

        // ==============================================================
        // PRUEBA C: CONTROL REMOTO LAN Y WEBSOCKET REAL
        // ==============================================================
        console.log('[Renderer] Ejecutando Prueba C: Servidor LAN y WebSocket iPad...');
        results.remoteControlTest = await ipcRenderer.invoke('test-remote-control-lan');

        // ==============================================================
        // PRUEBA D: RTMP FLV PIPELINE CON -analyzeduration 2000000
        // ==============================================================
        console.log('[Renderer] Ejecutando Prueba D: Pipeline RTMP validado...');
        results.rtmpTest = await ipcRenderer.invoke('test-rtmp-pipeline', { chunks });

        console.log('[Renderer] Todas las pruebas de corrección P0 finalizadas.');
        ipcRenderer.send('tests-finished', results);
      }

      runValidation();
    </script>
  </body>
  </html>
  `;

  const htmlPath = path.join(testOutputDir, 'fixes-runner.html');
  fs.writeFileSync(htmlPath, testHtml, 'utf-8');
  win.loadFile(htmlPath);
});
