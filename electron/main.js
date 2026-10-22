const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
Menu.setApplicationMenu(null);
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

// Configurar App ID oficial para Windows para asociar el icono de PodcastStudio en la barra de tareas
if (process.platform === 'win32') {
  app.setAppUserModelId("com.podcaststudio.app");
}

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
  let iconPath = path.join(__dirname, '../icon.ico');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(process.resourcesPath || __dirname, 'icon.ico');
  }
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, '../icon.png');
  }

  mainWindow = new BrowserWindow({
    width: 1500, height: 900, title: "PodcastStudio",
    icon: iconPath,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#ffffff',
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0a0a0a',
  });

  mainWindow.setMenu(null);
  if (mainWindow.removeMenu) mainWindow.removeMenu();

  if (iconPath && fs.existsSync(iconPath)) {
    try { mainWindow.setIcon(iconPath); } catch (e) {}
  }

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true); else callback(false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const http = require('http');

const mobileClients = new Map();
let httpWsServer = null;

function startMediaServer() {
  const appServer = express();
  const server = https.createServer(options, appServer);
  
  // WebSocket seguro sobre HTTPS (puerto 3000)
  wss = new WebSocketServer({ server });

  // Servidor HTTP complementario para WebSocket estándar (puerto 3001)
  // Esto evita bloqueos de certificados autofirmados en iOS Safari y Android Chrome
  const plainHttpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PodcastStudio Signaling Server Active');
  });
  httpWsServer = new WebSocketServer({ server: plainHttpServer });

  const setupWebSocketConnection = (ws) => {
    const clientId = `Mobil_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
    ws.clientId = clientId;
    mobileClients.set(clientId, ws);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mobile-ws-connected', clientId);
    }

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        if (!mainWindow || mainWindow.isDestroyed()) return;

        if (data.type === 'offer') {
          mainWindow.webContents.send('remote-offer', { id: ws.clientId, offer: data.offer });
        } else if (data.type === 'candidate') {
          mainWindow.webContents.send('remote-candidate', { id: ws.clientId, candidate: data.candidate });
        }
      } catch (err) {
        console.error('Error procesando mensaje WebSocket:', err);
      }
    });

    ws.on('close', () => {
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });

    ws.on('error', () => {
      mobileClients.delete(ws.clientId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-disconnected', ws.clientId);
      }
    });
  };

  wss.on('connection', setupWebSocketConnection);
  httpWsServer.on('connection', setupWebSocketConnection);

  appServer.get('/camara', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>PodcastStudio Remote Cam</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
          #video { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; background: #000; z-index: 1; }
          .ui-layer { position: relative; z-index: 20; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 20px; pointer-events: none; }
          .header { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); pointer-events: auto; }
          .logo { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #ff6b00; }
          .badge { font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: #222; color: #aaa; border: 1px solid #444; }
          .badge.live { background: rgba(220,38,38,0.9); color: #fff; border-color: #ef4444; animation: pulse 1.5s infinite; }
          .badge.connected { background: rgba(22,101,52,0.9); color: #86efac; border-color: #4ade80; }
          .center-box { pointer-events: auto; background: rgba(15,15,18,0.92); backdrop-filter: blur(16px); padding: 28px 22px; border-radius: 20px; border: 1px solid rgba(255,107,0,0.3); text-align: center; max-width: 380px; margin: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
          .btn-main { background: linear-gradient(135deg, #ff6b00, #ea580c); color: white; border: none; padding: 16px 28px; font-size: 17px; font-weight: 800; border-radius: 12px; cursor: pointer; width: 100%; box-shadow: 0 8px 20px rgba(234,88,12,0.4); transition: transform 0.1s; }
          .btn-main:active { transform: scale(0.97); }
          .controls { display: flex; gap: 10px; justify-content: center; pointer-events: auto; margin-bottom: 10px; }
          .btn-action { background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        </style>
      </head>
      <body>
        <video id="video" autoplay playsinline webkit-playsinline muted></video>

        <div class="ui-layer">
          <div class="header">
            <div class="logo">
              <span>●</span> PodcastStudio Remote
            </div>
            <div id="statusBadge" class="badge">En Espera</div>
          </div>

          <div id="startDialog" class="center-box">
            <h2 style="color: #ff6b00; margin-bottom: 8px;">Cámara de Invitado</h2>
            <p style="font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.4;">
              Conéctate en vivo como cámara remota HD para el programa.
            </p>
            <button id="startBtn" class="btn-main">CONECTAR CÁMARA</button>
            <div id="connectHelp" style="margin-top: 14px; font-size: 11px; color: #777;">
              Toca "Permitir" cuando el navegador solicite acceso a cámara y micrófono.
            </div>
          </div>

          <div id="footerControls" class="controls" style="display: none;">
            <button id="flipCamBtn" class="btn-action">🔄 Girar Cámara</button>
            <button id="muteBtn" class="btn-action">🎤 Silenciar</button>
          </div>
        </div>

        <script>
          const LOCAL_IP = '${LOCAL_IP}';
          let ws = null;
          let pc = null;
          let currentStream = null;
          let currentFacing = 'user';
          let isMuted = false;

          const statusBadge = document.getElementById('statusBadge');
          const startDialog = document.getElementById('startDialog');
          const footerControls = document.getElementById('footerControls');
          const videoEl = document.getElementById('video');

          function updateStatus(text, type) {
            statusBadge.innerText = text;
            statusBadge.className = 'badge ' + (type || '');
          }

          function connectWebSocket() {
            return new Promise((resolve) => {
              // Intento 1: WSS en puerto 3000
              const wssUrl = 'wss://' + LOCAL_IP + ':3000';
              const wsUrl = 'ws://' + LOCAL_IP + ':3001';

              let socket = new WebSocket(wssUrl);
              let connected = false;

              const timer = setTimeout(() => {
                if (!connected) {
                  try { socket.close(); } catch (e) {}
                  // Fallback a WS estándar en puerto 3001 si WSS autofirmado es rechazado
                  socket = new WebSocket(wsUrl);
                  bindEvents(socket, resolve);
                }
              }, 1200);

              function bindEvents(s, done) {
                s.onopen = () => {
                  connected = true;
                  clearTimeout(timer);
                  ws = s;
                  done(s);
                };
                s.onmessage = async (e) => {
                  try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'answer' && pc) {
                      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                      updateStatus('EN VIVO ★ AL AIRE', 'live');
                    } else if (data.type === 'candidate' && pc) {
                      await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
                    }
                  } catch (err) {}
                };
                s.onclose = () => {
                  updateStatus('Desconectado', '');
                };
                s.onerror = () => {
                  if (!connected) {
                    clearTimeout(timer);
                    socket = new WebSocket(wsUrl);
                    bindEvents(socket, done);
                  }
                };
              }

              bindEvents(socket, resolve);
            });
          }

          async function startCameraAndStream() {
            startDialog.style.display = 'none';
            updateStatus('Solicitando cámara...', '');

            try {
              currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                audio: true
              });

              videoEl.srcObject = currentStream;
              videoEl.style.display = 'block';
              footerControls.style.display = 'flex';

              updateStatus('Conectando al Estudio...', '');
              await connectWebSocket();

              pc = new RTCPeerConnection({
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' }
                ]
              });

              currentStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, currentStream);
                if (track.kind === 'video') {
                  try {
                    const params = sender.getParameters();
                    if (!params.encodings) params.encodings = [{}];
                    params.encodings[0].maxBitrate = 2500000;
                    params.degradationPreference = 'maintain-framerate';
                    sender.setParameters(params);
                  } catch (e) {}
                }
              });

              pc.onicecandidate = (e) => {
                if (e.candidate && ws && ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
                }
              };

              pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                  updateStatus('EN VIVO ★ ESTUDIO', 'live');
                } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                  updateStatus('Reconectando...', '');
                }
              };

              const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
              });
              await pc.setLocalDescription(offer);

              if (ws && ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'offer', offer: offer }));
              }
            } catch (err) {
              startDialog.style.display = 'block';
              updateStatus('Error de Cámara', '');
              alert('Error al acceder a la cámara: ' + err.message);
            }
          }

          document.getElementById('startBtn').addEventListener('click', startCameraAndStream);

          document.getElementById('flipCamBtn').addEventListener('click', async () => {
            currentFacing = currentFacing === 'user' ? 'environment' : 'user';
            if (currentStream) {
              currentStream.getTracks().forEach(t => t.stop());
            }
            startCameraAndStream();
          });

          document.getElementById('muteBtn').addEventListener('click', () => {
            if (!currentStream) return;
            isMuted = !isMuted;
            currentStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
            document.getElementById('muteBtn').innerText = isMuted ? '🔇 Desmutear' : '🎤 Silenciar';
          });
        </script>
      </body>
      </html>
    `);
  });

  server.listen(3000, '0.0.0.0');
  plainHttpServer.listen(3001, '0.0.0.0');
}

app.whenReady().then(() => { createWindow(); startMediaServer(); });

ipcMain.handle('get-qr-url', () => `https://www.podcastudio.mx/remote-cam?slot=2&room=studio_cam_2`);

ipcMain.on('send-answer', (event, { id, answer }) => {
  const client = mobileClients.get(id);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({ type: 'answer', answer }));
  }
});

ipcMain.on('send-candidate', (event, { id, candidate }) => {
  const client = mobileClients.get(id);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify({ type: 'candidate', candidate }));
  }
});

ipcMain.on('open-external', (event, url) => shell.openExternal(url));

ipcMain.on('open-recordings-folder', () => {
  const recDir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'grabaciones');
  if (!fs.existsSync(recDir)) {
    try { fs.mkdirSync(recDir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(recDir);
});

let currentRecordingPath = null;
let streamDestinations = [];

// ============================================================================
// GRABACIÓN BROADCAST MASTER (MP4 LIMPIO + AUDIO MEZCLADO)
// ============================================================================
ipcMain.handle('start-recording', async () => {
  return new Promise((resolve) => {
    const dir = path.join('D:', 'PROGRAMAS IA', 'PODCASTUDIO', 'grabaciones');
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