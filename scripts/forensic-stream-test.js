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
    width: 640,
    height: 480,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Handler para simular el worker de streaming exacto de electron/main.js
  ipcMain.handle('test-stream-worker', async (event, { chunks }) => {
    return new Promise((resolve) => {
      const flvOutputPath = path.join(testOutputDir, 'stream_output.flv');
      if (fs.existsSync(flvOutputPath)) fs.unlinkSync(flvOutputPath);

      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
      console.log(`[Stream Worker Test] Recibidos ${buffer.length} bytes para RTMP FLV worker...`);

      // Mismos argumentos que electron/main.js líneas 994-1019, escribiendo a archivo FLV local
      const workerArgs = [
        '-y',
        '-probesize', '32M',
        '-analyzeduration', '1000000',
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
        '-flvflags', 'no_duration_filesize',
        '-f', 'flv',
        flvOutputPath
      ];

      const proc = spawn(ffmpegPath, workerArgs);
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.stdin.write(buffer);
      proc.stdin.end();

      proc.on('close', (code) => {
        const exists = fs.existsSync(flvOutputPath) && fs.statSync(flvOutputPath).size > 0;
        const size = exists ? fs.statSync(flvOutputPath).size : 0;
        console.log(`[Stream Worker Test] FLV generado: ${exists} (${size} bytes)`);

        // Analizar flv con FFmpeg
        const probeProc = spawn(ffmpegPath, ['-i', flvOutputPath, '-f', 'null', '-']);
        let probeStderr = '';
        probeProc.stderr.on('data', d => { probeStderr += d.toString(); });
        probeProc.on('close', () => {
          const streamAudio = probeStderr.match(/Stream #0:1.*Audio:\s*([^\r\n]+)/);
          const streamVideo = probeStderr.match(/Stream #0:0.*Video:\s*([^\r\n]+)/);

          resolve({
            success: exists,
            sizeBytes: size,
            filePath: flvOutputPath,
            hasAudioStream: Boolean(streamAudio),
            audioDetails: streamAudio ? streamAudio[1] : null,
            hasVideoStream: Boolean(streamVideo),
            videoDetails: streamVideo ? streamVideo[1] : null,
            ffmpegLog: stderr.slice(-1000)
          });
        });
      });
    });
  });

  ipcMain.on('stream-test-finished', (event, results) => {
    const reportPath = path.join(testOutputDir, 'forensic-streaming-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log('[Stream Test] Resultados guardados en:', reportPath);
    app.quit();
  });

  const testHtml = `
  <!DOCTYPE html>
  <html>
  <body>
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const { ipcRenderer } = require('electron');

      async function runStreamTest() {
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        let hue = 0;
        function anim() {
          ctx.fillStyle = 'hsl(' + (hue % 360) + ', 50%, 25%)';
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 72px sans-serif';
          ctx.fillText('LIVE STREAM BROADCAST TEST - FRAME ' + hue, 100, 500);
          hue += 4;
          requestAnimationFrame(anim);
        }
        anim();

        const canvasStream = canvas.captureStream(30);
        const videoTrack = canvasStream.getVideoTracks()[0];

        // Audio Graph Master (Mic + BGM)
        const audioCtx = new AudioContext({ sampleRate: 48000 });
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        osc.connect(gain);

        const dest = audioCtx.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();

        const audioTrack = dest.stream.getAudioTracks()[0];
        const masterStream = new MediaStream([videoTrack, audioTrack]);

        const chunks = [];
        const recorder = new MediaRecorder(masterStream, { mimeType: 'video/webm;codecs=vp8,opus' });
        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(new Uint8Array(await e.data.arrayBuffer()));
          }
        };

        recorder.start(100);
        await new Promise(r => setTimeout(r, 2000));
        recorder.stop();
        await new Promise(r => setTimeout(r, 300));

        const result = await ipcRenderer.invoke('test-stream-worker', { chunks });
        ipcRenderer.send('stream-test-finished', result);
      }

      runStreamTest();
    </script>
  </body>
  </html>
  `;

  const htmlPath = path.join(testOutputDir, 'stream-runner.html');
  fs.writeFileSync(htmlPath, testHtml, 'utf-8');
  win.loadFile(htmlPath);
});
