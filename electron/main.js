const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const express = require('express');
const https = require('https');
const selfsigned = require('selfsigned');
const { WebSocketServer } = require('ws');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);
let mainWindow;
let ffmpegRecordProcess = null;
let ffmpegStreamProcess = null;
let wss = null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let bestIp = '127.0.0.1';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('vbox') || nameLower.includes('vmware') || nameLower.includes('loopback')) continue;
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) return iface.address;
      }
    }
  }
  return bestIp;
}
const LOCAL_IP = getLocalIP();

const pems = selfsigned.generate([{ name: 'commonName', value: LOCAL_IP }], {
  days: 365, keySize: 2048,
  extensions: [
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: LOCAL_IP }] }
  ]
});
const options = { key: pems.private, cert: pems.cert };

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../icon.ico'))
    ? path.join(__dirname, '../icon.ico')
    : path.join(__dirname, '../icon.png');

  mainWindow = new BrowserWindow({
    width: 1500, height: 900, title: "PodcastStudio",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a',
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true); else callback(false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function startMediaServer() {
  const appServer = express();
  const server = https.createServer(options, appServer);
  wss = new WebSocketServer({ server });

  appServer.get('/camara', (req, res) => {
    res.send(`
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="background: #111; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center;">
          <video id="video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; display: none; z-index: -1;"></video>
          <div id="ui" style="position: relative; z-index: 10; background: rgba(0,0,0,0.8); padding: 20px; border-radius: 15px;">
            <h2 style="color: #ff6b00;">PodcastStudio</h2>
            <p>Si sale advertencia, toca <b>"Avanzado"</b> y <b>"Continuar"</b>.</p>
            <button id="startBtn" style="background: #ff6b00; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 8px; cursor: pointer;">INICIAR CÁMARA</button>
            <div id="status" style="margin-top: 20px; font-size: 14px; color: #aaa;">Esperando...</div>
          </div>
          <script>
              const ws = new WebSocket('wss://${LOCAL_IP}:3000');
              let pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
              document.getElementById('startBtn').addEventListener('click', async () => {
                  document.getElementById('startBtn').style.display = 'none';
                  document.getElementById('status').innerText = "Solicitando cámara...";
                  try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: true });
                      document.getElementById('video').srcObject = stream;
                      document.getElementById('video').style.display = 'block';
                      document.getElementById('video').style.zIndex = '1';
                      document.getElementById('ui').style.display = 'none';
                      stream.getTracks().forEach(track => pc.addTrack(track, stream));
                      pc.onicecandidate = e => { if (e.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate })); };
                      pc.createOffer().then(offer => { pc.setLocalDescription(offer); ws.send(JSON.stringify({ type: 'offer', offer: offer })); });
                  } catch (err) { document.getElementById('status').innerText = "ERROR: " + err.message; }
              });
              ws.onmessage = async e => {
                  const data = JSON.parse(e.data);
                  if (data.answer) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  if (data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              };
          </script>
      </body>
      </html>
    `);
  });

  let camIdCounter = 0;
  wss.on('connection', ws => {
    ws.clientId = `Mobil_${++camIdCounter}`;
    mainWindow.webContents.send('mobile-ws-connected', ws.clientId);
    ws.on('message', msg => {
      const data = JSON.parse(msg);
      if (data.type === 'offer') mainWindow.webContents.send('remote-offer', { id: ws.clientId, offer: data.offer });
      else if (data.type === 'candidate') mainWindow.webContents.send('remote-candidate', { id: ws.clientId, candidate: data.candidate });
    });
    ws.on('close', () => mainWindow.webContents.send('remote-disconnected', ws.clientId));
  });
  server.listen(3000, '0.0.0.0');
}

app.whenReady().then(() => { createWindow(); startMediaServer(); });

ipcMain.handle('get-qr-url', () => `https://${LOCAL_IP}:3000/camara`);
ipcMain.on('send-answer', (event, { id, answer }) => { if (wss) for (const c of wss.clients) if (c.clientId === id && c.readyState === 1) c.send(JSON.stringify({ answer })); });
ipcMain.on('send-candidate', (event, { id, candidate }) => { if (wss) for (const c of wss.clients) if (c.clientId === id && c.readyState === 1) c.send(JSON.stringify({ candidate })); });
ipcMain.on('open-external', (event, url) => shell.openExternal(url));
ipcMain.on('open-recordings-folder', () => shell.openPath('D:\\PROGRAMAS IA\\PODCASTSTUDIO1'));

let currentRecordingPath = null;
let streamDestinations = [];

// ============================================================================
// GRABACIÓN BROADCAST MASTER (MP4 LIMPIO + AUDIO MEZCLADO)
// ============================================================================
ipcMain.handle('start-recording', async () => {
  return new Promise((resolve) => {
    const dir = 'D:\\PROGRAMAS IA\\PODCASTUDIO1';
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}

    currentRecordingPath = path.join(dir, `Grabacion_${Date.now()}.mp4`);

    if (ffmpegRecordProcess) {
      try {
        if (ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) ffmpegRecordProcess.stdin.end();
        ffmpegRecordProcess.kill('SIGINT');
      } catch (e) {}
      ffmpegRecordProcess = null;
    }

    try {
      ffmpegRecordProcess = spawn(ffmpegPath, [
        '-f', 'webm',
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-movflags', '+faststart',
        '-y',
        currentRecordingPath
      ], {
        stdio: ['pipe', 'ignore', 'pipe']
      });

      ffmpegRecordProcess.on('error', (err) => {
        console.error('Error FFmpeg Grabación:', err.message);
      });

      ffmpegRecordProcess.on('close', () => {
        ffmpegRecordProcess = null;
      });

      resolve({ success: true, path: currentRecordingPath });
    } catch (err) {
      console.error('Fallo al iniciar grabación FFmpeg:', err);
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.on('record-chunk', (event, chunkBuffer) => {
  if (ffmpegRecordProcess && ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) {
    try {
      const buf = Buffer.isBuffer(chunkBuffer) ? chunkBuffer : Buffer.from(chunkBuffer);
      ffmpegRecordProcess.stdin.write(buf);
    } catch (e) {
      console.warn('Error escribiendo chunk de grabación:', e.message);
    }
  }
});

ipcMain.handle('stop-recording', async () => {
  return new Promise((resolve) => {
    if (ffmpegRecordProcess) {
      try {
        if (ffmpegRecordProcess.stdin && !ffmpegRecordProcess.stdin.destroyed) {
          ffmpegRecordProcess.stdin.end();
        }
        setTimeout(() => {
          if (ffmpegRecordProcess) {
            ffmpegRecordProcess.kill('SIGINT');
            ffmpegRecordProcess = null;
          }
          resolve({ success: true, path: currentRecordingPath });
        }, 800);
      } catch (e) {
        resolve({ success: true, path: currentRecordingPath });
      }
    } else {
      resolve({ success: false });
    }
  });
});

// ============================================================================
// TRANSMISIÓN EN VIVO REAL / MULTI-STREAMING SIMULTÁNEO (RTMP & RTMPS)
// ============================================================================
ipcMain.handle('start-streaming', async (event, payload) => {
  return new Promise((resolve) => {
    let targets = [];
    if (typeof payload === 'string') {
      targets = [{ id: 'custom', name: 'Stream', url: payload.trim() }];
    } else if (payload && Array.isArray(payload.destinations)) {
      targets = payload.destinations.filter(d => d.url && d.url.trim().length > 0);
    }

    if (targets.length === 0) {
      return resolve({ success: false, error: "No se proporcionaron destinos válidos con clave de transmisión." });
    }

    // Detener cualquier stream anterior
    if (ffmpegStreamProcess) {
      try {
        if (ffmpegStreamProcess.stdin && !ffmpegStreamProcess.stdin.destroyed) {
          ffmpegStreamProcess.stdin.end();
        }
        ffmpegStreamProcess.kill('SIGINT');
      } catch (e) {}
      ffmpegStreamProcess = null;
    }

    streamDestinations = targets;
    const urls = targets.map(t => t.url.trim());

    // Configuración de salida: FLV para 1 destino, o TEE pseudo-muxer para Multi-Streaming simultáneo
    let outputArgs = [];
    if (urls.length === 1) {
      outputArgs = ['-f', 'flv', urls[0]];
    } else {
      const teeTarget = urls.map(u => `[f=flv:onfail=ignore]${u}`).join('|');
      outputArgs = ['-f', 'tee', teeTarget];
    }

    const ffmpegArgs = [
      '-f', 'webm',
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-b:v', '2800k',
      '-maxrate', '3200k',
      '-bufsize', '6000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60',
      '-r', '30',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      ...outputArgs
    ];

    try {
      ffmpegStreamProcess = spawn(ffmpegPath, ffmpegArgs, {
        stdio: ['pipe', 'ignore', 'pipe']
      });

      let hasSentStarted = false;

      ffmpegStreamProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (!hasSentStarted && (msg.includes('Output #0') || msg.includes('Stream #0') || msg.includes('frame='))) {
          hasSentStarted = true;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-status', {
              active: true,
              destinations: streamDestinations
            });
          }
        }
      });

      ffmpegStreamProcess.on('error', (err) => {
        console.error('Error FFmpeg Streaming:', err);
        if (!hasSentStarted) {
          resolve({ success: false, error: err.message });
        }
      });

      ffmpegStreamProcess.on('close', (code) => {
        ffmpegStreamProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stream-status', {
            active: false,
            destinations: []
          });
        }
      });

      setTimeout(() => {
        resolve({ success: true, destinations: targets });
      }, 500);

    } catch (err) {
      console.error('Fallo al invocar FFmpeg stream:', err);
      resolve({ success: false, error: err.message });
    }
  });
});

// Receptor de chunks de audio/video del Master en vivo
ipcMain.on('stream-chunk', (event, chunkBuffer) => {
  if (ffmpegStreamProcess && ffmpegStreamProcess.stdin && !ffmpegStreamProcess.stdin.destroyed) {
    try {
      const buf = Buffer.isBuffer(chunkBuffer) ? chunkBuffer : Buffer.from(chunkBuffer);
      ffmpegStreamProcess.stdin.write(buf);
    } catch (e) {
      console.warn('Error escribiendo chunk a FFmpeg stream:', e.message);
    }
  }
});

ipcMain.handle('stop-streaming', async () => {
  return new Promise((resolve) => {
    if (ffmpegStreamProcess) {
      try {
        if (ffmpegStreamProcess.stdin && !ffmpegStreamProcess.stdin.destroyed) {
          ffmpegStreamProcess.stdin.end();
        }
        setTimeout(() => {
          if (ffmpegStreamProcess) {
            ffmpegStreamProcess.kill('SIGINT');
            ffmpegStreamProcess = null;
          }
          resolve({ success: true });
        }, 500);
      } catch (e) {
        resolve({ success: true });
      }
    } else {
      resolve({ success: false });
    }
  });
});